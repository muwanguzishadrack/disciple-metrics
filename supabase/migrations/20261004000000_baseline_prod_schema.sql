-- =============================================================================
-- BASELINE: production public schema as of 2026-10-04
-- =============================================================================
--
-- This file is a squashed, hand-reconstructed snapshot of the production
-- `public` schema (plus the auth.users -> profiles trigger and the pg_cron job),
-- introspected read-only from pg_catalog on 2026-10-04. It replaces the old
-- partial migration files, which now live in supabase/migrations_archive/ for
-- history only.
--
-- Production ALREADY HAS everything in this file. It must NEVER be executed
-- against production. Instead, record it as applied there:
--
--     supabase migration repair --status applied 20261004000000
--
-- See docs/database/MIGRATIONS.md for the full procedure.
--
-- Safety net: the guard below aborts (and the migration transaction rolls back)
-- if public.pga_entries already exists, so an accidental `db push` against prod
-- fails loudly instead of doing anything.
-- =============================================================================

do $$
begin
  if to_regclass('public.pga_entries') is not null then
    raise exception 'baseline 20261004000000 must not run on a database that already has the schema (production). Use: supabase migration repair --status applied 20261004000000';
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- Extensions
-- -----------------------------------------------------------------------------
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists pg_stat_statements with schema extensions;

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

create table public.profiles (
  id uuid not null,
  email text,
  theme text default 'system'::text,
  two_factor_enabled boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint profiles_pkey primary key (id),
  constraint profiles_id_fkey foreign key (id) references auth.users(id) on delete cascade
);
create index profiles_email_idx on public.profiles using btree (email);

create table public.audit_logs (
  id uuid not null default gen_random_uuid(),
  action text not null,
  user_id uuid,
  ip_address text,
  user_agent text,
  details jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  constraint audit_logs_pkey primary key (id),
  constraint audit_logs_user_id_fkey foreign key (user_id) references auth.users(id) on delete set null
);
comment on table public.audit_logs is 'Tracks authentication and security-related events for auditing purposes';
create index idx_audit_logs_action on public.audit_logs using btree (action);
create index idx_audit_logs_created_at on public.audit_logs using btree (created_at desc);
create index idx_audit_logs_user_id on public.audit_logs using btree (user_id);

create table public.roles (
  id uuid not null default gen_random_uuid(),
  name text not null,
  description text,
  created_at timestamptz default now(),
  constraint roles_pkey primary key (id),
  constraint roles_name_key unique (name)
);

create table public.regions (
  id uuid not null default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint regions_pkey primary key (id),
  constraint regions_name_key unique (name)
);

create table public.fobs (
  id uuid not null default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  region_id uuid,
  archived_at timestamptz,
  constraint fobs_pkey primary key (id),
  constraint fobs_name_key unique (name),
  constraint fobs_region_id_fkey foreign key (region_id) references public.regions(id)
);
comment on column public.fobs.archived_at is 'Retired FOB. Hidden from pickers/filters/new reports, still resolvable for frozen history.';

create table public.locations (
  id uuid not null default gen_random_uuid(),
  fob_id uuid not null,
  name text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  pastor text,
  contact text,
  archived_at timestamptz,
  constraint locations_pkey primary key (id),
  constraint locations_fob_id_fkey foreign key (fob_id) references public.fobs(id) on delete cascade
);
comment on column public.locations.archived_at is E'Location no longer in the official arrangement. Hidden from pickers and new\n   reports; still rendered in historical reports where entries exist.';
create index idx_locations_fob_id on public.locations using btree (fob_id);

create table public.user_assignments (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  role_id uuid not null,
  fob_id uuid,
  location_id uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint user_assignments_pkey primary key (id),
  constraint unique_user_assignment unique (user_id),
  constraint user_assignments_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade,
  constraint user_assignments_role_id_fkey foreign key (role_id) references public.roles(id),
  constraint user_assignments_fob_id_fkey foreign key (fob_id) references public.fobs(id) on delete set null,
  constraint user_assignments_location_id_fkey foreign key (location_id) references public.locations(id) on delete set null,
  constraint valid_assignment check (
    ((fob_id is null) and (location_id is null))
    or ((fob_id is not null) and (location_id is null))
    or ((fob_id is null) and (location_id is not null))
  )
);
create index idx_user_assignments_fob_id on public.user_assignments using btree (fob_id);
create index idx_user_assignments_location_id on public.user_assignments using btree (location_id);
create index idx_user_assignments_role_id on public.user_assignments using btree (role_id);
create index idx_user_assignments_user_id on public.user_assignments using btree (user_id);

create table public.user_invitations (
  id uuid not null default gen_random_uuid(),
  email text not null,
  role_id uuid not null,
  fob_id uuid,
  location_id uuid,
  invited_by uuid not null,
  token text not null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint user_invitations_pkey primary key (id),
  constraint user_invitations_token_key unique (token),
  constraint user_invitations_role_id_fkey foreign key (role_id) references public.roles(id),
  constraint user_invitations_fob_id_fkey foreign key (fob_id) references public.fobs(id),
  constraint user_invitations_location_id_fkey foreign key (location_id) references public.locations(id),
  constraint user_invitations_invited_by_fkey foreign key (invited_by) references public.profiles(id) on delete set null
);
create index user_invitations_email_idx on public.user_invitations using btree (email);
create index user_invitations_expires_at_idx on public.user_invitations using btree (expires_at);
create index user_invitations_token_idx on public.user_invitations using btree (token);

create table public.pga_reports (
  id uuid not null default gen_random_uuid(),
  date date not null,
  created_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint pga_reports_pkey primary key (id),
  constraint pga_reports_date_key unique (date),
  constraint pga_reports_created_by_fkey foreign key (created_by) references public.profiles(id) on delete set null
);
create index idx_pga_reports_created_by on public.pga_reports using btree (created_by);
create index idx_pga_reports_date on public.pga_reports using btree (date desc);

create table public.pga_entries (
  id uuid not null default gen_random_uuid(),
  report_id uuid not null,
  location_id uuid not null,
  sv1 integer default 0,
  sv2 integer default 0,
  yxp integer default 0,
  kids integer default 0,
  local integer default 0,
  hc1 integer default 0,
  hc2 integer default 0,
  created_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  baptisms integer default 0,
  mca integer default 0,
  salvations_inhouse integer default 0,
  salvations_mc integer default 0,
  salvations_other integer default 0,
  mechanics_get integer default 0,
  mechanics_worship integer default 0,
  salvations_livestream_enc integer default 0,
  salvations_livestream_yxp integer default 0,
  salvations integer generated always as (
    ((((coalesce(salvations_livestream_enc, 0) + coalesce(salvations_livestream_yxp, 0))
      + coalesce(salvations_inhouse, 0)) + coalesce(salvations_mc, 0)) + coalesce(salvations_other, 0))
  ) stored,
  mechanics_training integer default 0,
  mechanics integer default 0,
  fob_id uuid not null,
  region_id uuid,
  constraint pga_entries_pkey primary key (id),
  constraint unique_report_location unique (report_id, location_id),
  constraint pga_entries_report_id_fkey foreign key (report_id) references public.pga_reports(id) on delete cascade,
  constraint pga_entries_location_id_fkey foreign key (location_id) references public.locations(id),
  constraint pga_entries_created_by_fkey foreign key (created_by) references public.profiles(id) on delete set null,
  constraint pga_entries_fob_id_fkey foreign key (fob_id) references public.fobs(id),
  constraint pga_entries_region_id_fkey foreign key (region_id) references public.regions(id)
);
comment on column public.pga_entries.fob_id is E'FOB at the time the entry was filed. Frozen -- does not follow later\n   re-parenting of the location. Read paths must prefer this over the live join.';
create index idx_pga_entries_created_by on public.pga_entries using btree (created_by);
create index idx_pga_entries_location_id on public.pga_entries using btree (location_id);
create index idx_pga_entries_report_id on public.pga_entries using btree (report_id);
create index pga_entries_fob_id_idx on public.pga_entries using btree (fob_id);
create index pga_entries_region_id_idx on public.pga_entries using btree (region_id);

-- -----------------------------------------------------------------------------
-- Reference data: roles (same ids as production)
-- -----------------------------------------------------------------------------
insert into public.roles (id, name, description, created_at) values
  ('50a04d2d-9e1d-42d9-b0e8-71f263a6144b', 'admin', 'Full access to all FOBs, Locations, Reports, and Entries', '2026-01-03 13:15:15.87213+00'),
  ('ff7c1bbc-0426-42b1-9760-febe2c891490', 'fob_leader', 'Access to all locations within their assigned FOB', '2026-01-03 13:15:15.87213+00'),
  ('c1bbb9b3-3101-4150-bb44-324a4bdf36f8', 'pastor', 'Access only to their assigned location', '2026-01-03 13:15:15.87213+00'),
  ('45bd74cd-d6b8-44b9-8176-fa41295bdba3', 'manager', 'Manager with admin permissions except delete operations', '2026-01-24 06:45:37.843216+00')
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- Functions
-- -----------------------------------------------------------------------------

create or replace function public.handle_updated_at()
 returns trigger
 language plpgsql
as $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

create or replace function public.update_updated_at_column()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

create or replace function public.handle_new_user()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$function$;

create or replace function public.is_admin(p_user_id uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  SELECT EXISTS (
    SELECT 1
    FROM user_assignments ua
    JOIN roles r ON r.id = ua.role_id
    WHERE ua.user_id = p_user_id AND r.name = 'admin'
  );
$function$;

create or replace function public.is_admin_or_manager(p_user_id uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  SELECT EXISTS (
    SELECT 1
    FROM user_assignments ua
    JOIN roles r ON r.id = ua.role_id
    WHERE ua.user_id = p_user_id AND r.name IN ('admin', 'manager')
  );
$function$;

create or replace function public.is_fob_leader(p_user_id uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  SELECT EXISTS (
    SELECT 1
    FROM user_assignments ua
    JOIN roles r ON r.id = ua.role_id
    WHERE ua.user_id = p_user_id AND r.name = 'fob_leader'
  );
$function$;

create or replace function public.get_user_role(p_user_id uuid)
 returns text
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  SELECT r.name
  FROM user_assignments ua
  JOIN roles r ON r.id = ua.role_id
  WHERE ua.user_id = p_user_id;
$function$;

create or replace function public.get_user_fob_id(p_user_id uuid)
 returns uuid
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  SELECT ua.fob_id
  FROM user_assignments ua
  WHERE ua.user_id = p_user_id;
$function$;

create or replace function public.get_user_location_id(p_user_id uuid)
 returns uuid
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  SELECT ua.location_id
  FROM user_assignments ua
  WHERE ua.user_id = p_user_id;
$function$;

create or replace function public.can_access_location(p_user_id uuid, p_location_id uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  SELECT EXISTS (
    SELECT 1
    FROM user_assignments ua
    JOIN roles r ON r.id = ua.role_id
    LEFT JOIN locations l ON l.id = p_location_id
    WHERE ua.user_id = p_user_id
    AND (
      r.name = 'admin'
      OR r.name = 'manager'
      OR (r.name = 'fob_leader' AND l.fob_id = ua.fob_id)
      OR (r.name = 'pastor' AND ua.location_id = p_location_id)
    )
  );
$function$;

create or replace function public.stamp_pga_entry_scope()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  select l.fob_id, f.region_id
    into new.fob_id, new.region_id
  from locations l
  join fobs f on f.id = l.fob_id
  where l.id = new.location_id;

  if new.fob_id is null then
    raise exception 'stamp_pga_entry_scope: unknown location %', new.location_id;
  end if;

  return new;
end;
$function$;

create or replace function public.auto_generate_weekly_pga_report()
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  report_date date;
  existing_report_id uuid;
begin
  -- Use East Africa Time (UTC+3) for the report date
  report_date := (current_timestamp at time zone 'Africa/Nairobi')::date;

  -- Check if a report already exists for this date
  select id into existing_report_id
  from pga_reports
  where pga_reports.date = report_date;

  -- Only create if no report exists
  if existing_report_id is null then
    insert into pga_reports (date, created_by)
    values (report_date, null);
  end if;
end;
$function$;

create or replace function public.get_epga_detail(p_date date)
 returns table(location_id uuid, location_name text, sv1 integer, sv2 integer, yxp integer, total integer)
 language sql
 stable
 set search_path to 'public'
as $function$
  SELECT
    e.location_id,
    l.name AS location_name,
    COALESCE(e.sv1, 0)::int AS sv1,
    COALESCE(e.sv2, 0)::int AS sv2,
    COALESCE(e.yxp, 0)::int AS yxp,
    COALESCE(e.sv1 + e.sv2 + e.yxp, 0)::int AS total
  FROM pga_entries e
  JOIN pga_reports r ON r.id = e.report_id
  JOIN locations l ON l.id = e.location_id
  WHERE r.date = p_date
  ORDER BY (e.sv1 + e.sv2 + e.yxp) DESC;
$function$;

create or replace function public.get_four_week_epga_detail(p_date date)
 returns jsonb
 language plpgsql
 stable
 set search_path to 'public'
as $function$
DECLARE
  v_result jsonb;
  v_anchor_rn int;
BEGIN
  WITH numbered AS (
    SELECT date, ROW_NUMBER() OVER (ORDER BY date DESC) AS rn
    FROM pga_reports
  )
  SELECT rn INTO v_anchor_rn FROM numbered WHERE date = p_date;

  IF v_anchor_rn IS NULL THEN
    RETURN jsonb_build_object('dates', '[]'::jsonb, 'locations', '[]'::jsonb, 'metricAverages', NULL);
  END IF;

  WITH numbered_reports AS (
    SELECT id, date, ROW_NUMBER() OVER (ORDER BY date DESC) AS rn
    FROM pga_reports
  ),
  window_reports AS (
    SELECT id, date, rn
    FROM numbered_reports
    WHERE rn BETWEEN v_anchor_rn AND v_anchor_rn + 3
  ),
  dates_arr AS (
    SELECT jsonb_agg(date ORDER BY date ASC) AS dates FROM window_reports
  ),
  window_with_slot AS (
    SELECT wr.id, wr.date, wr.rn,
           (SELECT COUNT(*) - 1 FROM window_reports) - (wr.rn - v_anchor_rn) AS slot
    FROM window_reports wr
  ),
  entries_with_slot AS (
    SELECT
      e.location_id,
      l.name AS location_name,
      ws.slot,
      (SELECT COUNT(*) FROM window_reports) AS window_size,
      COALESCE(e.sv1, 0) + COALESCE(e.sv2, 0) + COALESCE(e.yxp, 0) AS entry_total
    FROM window_with_slot ws
    JOIN pga_entries e ON e.report_id = ws.id
    JOIN locations l ON l.id = e.location_id
  ),
  loc_agg AS (
    SELECT
      es.location_id,
      es.location_name,
      MAX(es.window_size)::int AS window_size,
      jsonb_agg(
        jsonb_build_object('slot', es.slot, 'total', es.entry_total)
        ORDER BY es.slot
      ) AS slot_data
    FROM entries_with_slot es
    GROUP BY es.location_id, es.location_name
  ),
  locations_arr AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'locationId', la.location_id,
        'location', la.location_name,
        'weekTotals', (
          SELECT jsonb_agg(
            CASE WHEN lk.val IS NOT NULL THEN to_jsonb(lk.val) ELSE 'null'::jsonb END
            ORDER BY gs.idx
          )
          FROM generate_series(0, la.window_size - 1) AS gs(idx)
          LEFT JOIN LATERAL (
            SELECT (elem->>'total')::int AS val
            FROM jsonb_array_elements(la.slot_data) AS elem
            WHERE (elem->>'slot')::int = gs.idx
          ) lk ON true
        ),
        'average', (
          SELECT ROUND(AVG(val))::int
          FROM (
            SELECT (elem->>'total')::int AS val
            FROM jsonb_array_elements(la.slot_data) AS elem
          ) t
        )
      )
      ORDER BY (
        SELECT ROUND(AVG(val))::int
        FROM (
          SELECT (elem->>'total')::int AS val
          FROM jsonb_array_elements(la.slot_data) AS elem
        ) t
      ) DESC
    ) AS locations
    FROM loc_agg la
  ),
  metric_avgs AS (
    SELECT
      ROUND(AVG(COALESCE(date_sv1, 0)))::int AS sv1,
      ROUND(AVG(COALESCE(date_sv2, 0)))::int AS sv2,
      ROUND(AVG(COALESCE(date_yxp, 0)))::int AS yxp,
      ROUND(AVG(COALESCE(date_total, 0)))::int AS total
    FROM (
      SELECT
        SUM(e.sv1) AS date_sv1,
        SUM(e.sv2) AS date_sv2,
        SUM(e.yxp) AS date_yxp,
        SUM(e.sv1 + e.sv2 + e.yxp) AS date_total
      FROM window_reports wr
      JOIN pga_entries e ON e.report_id = wr.id
      GROUP BY wr.date
    ) per_date
  )
  SELECT jsonb_build_object(
    'dates', COALESCE((SELECT dates FROM dates_arr), '[]'::jsonb),
    'locations', COALESCE((SELECT locations FROM locations_arr), '[]'::jsonb),
    'metricAverages', (SELECT row_to_json(m)::jsonb FROM metric_avgs m)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

create or replace function public.get_four_week_pga_detail(p_date date)
 returns jsonb
 language plpgsql
 stable
 set search_path to 'public'
as $function$
DECLARE
  v_result jsonb;
  v_anchor_rn int;
BEGIN
  WITH numbered AS (
    SELECT date, ROW_NUMBER() OVER (ORDER BY date DESC) AS rn
    FROM pga_reports
  )
  SELECT rn INTO v_anchor_rn FROM numbered WHERE date = p_date;

  IF v_anchor_rn IS NULL THEN
    RETURN jsonb_build_object('dates', '[]'::jsonb, 'locations', '[]'::jsonb, 'metricAverages', NULL);
  END IF;

  WITH numbered_reports AS (
    SELECT id, date, ROW_NUMBER() OVER (ORDER BY date DESC) AS rn
    FROM pga_reports
  ),
  window_reports AS (
    SELECT id, date, rn
    FROM numbered_reports
    WHERE rn BETWEEN v_anchor_rn AND v_anchor_rn + 3
  ),
  dates_arr AS (
    SELECT jsonb_agg(date ORDER BY date ASC) AS dates FROM window_reports
  ),
  window_with_slot AS (
    SELECT wr.id, wr.date, wr.rn,
           (SELECT COUNT(*) - 1 FROM window_reports) - (wr.rn - v_anchor_rn) AS slot
    FROM window_reports wr
  ),
  entries_with_slot AS (
    SELECT
      e.location_id,
      l.name AS location_name,
      ws.slot,
      (SELECT COUNT(*) FROM window_reports) AS window_size,
      COALESCE(e.sv1, 0) + COALESCE(e.sv2, 0) + COALESCE(e.yxp, 0) +
      COALESCE(e.kids, 0) + COALESCE(e.local, 0) + COALESCE(e.hc1, 0) + COALESCE(e.hc2, 0) AS entry_total
    FROM window_with_slot ws
    JOIN pga_entries e ON e.report_id = ws.id
    JOIN locations l ON l.id = e.location_id
  ),
  loc_agg AS (
    SELECT
      es.location_id,
      es.location_name,
      MAX(es.window_size)::int AS window_size,
      jsonb_agg(
        jsonb_build_object('slot', es.slot, 'total', es.entry_total)
        ORDER BY es.slot
      ) AS slot_data
    FROM entries_with_slot es
    GROUP BY es.location_id, es.location_name
  ),
  locations_arr AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'locationId', la.location_id,
        'location', la.location_name,
        'weekTotals', (
          SELECT jsonb_agg(
            CASE WHEN lk.val IS NOT NULL THEN to_jsonb(lk.val) ELSE 'null'::jsonb END
            ORDER BY gs.idx
          )
          FROM generate_series(0, la.window_size - 1) AS gs(idx)
          LEFT JOIN LATERAL (
            SELECT (elem->>'total')::int AS val
            FROM jsonb_array_elements(la.slot_data) AS elem
            WHERE (elem->>'slot')::int = gs.idx
          ) lk ON true
        ),
        'average', (
          SELECT ROUND(AVG(val))::int
          FROM (
            SELECT (elem->>'total')::int AS val
            FROM jsonb_array_elements(la.slot_data) AS elem
          ) t
        )
      )
      ORDER BY (
        SELECT ROUND(AVG(val))::int
        FROM (
          SELECT (elem->>'total')::int AS val
          FROM jsonb_array_elements(la.slot_data) AS elem
        ) t
      ) DESC
    ) AS locations
    FROM loc_agg la
  ),
  metric_avgs AS (
    SELECT
      ROUND(AVG(COALESCE(date_sv1, 0)))::int AS sv1,
      ROUND(AVG(COALESCE(date_sv2, 0)))::int AS sv2,
      ROUND(AVG(COALESCE(date_yxp, 0)))::int AS yxp,
      ROUND(AVG(COALESCE(date_kids, 0)))::int AS kids,
      ROUND(AVG(COALESCE(date_local, 0)))::int AS local,
      ROUND(AVG(COALESCE(date_hc1, 0)))::int AS hc1,
      ROUND(AVG(COALESCE(date_hc2, 0)))::int AS hc2,
      ROUND(AVG(COALESCE(date_total, 0)))::int AS total
    FROM (
      SELECT
        SUM(e.sv1) AS date_sv1,
        SUM(e.sv2) AS date_sv2,
        SUM(e.yxp) AS date_yxp,
        SUM(e.kids) AS date_kids,
        SUM(e.local) AS date_local,
        SUM(e.hc1) AS date_hc1,
        SUM(e.hc2) AS date_hc2,
        SUM(e.sv1 + e.sv2 + e.yxp + e.kids + e.local + e.hc1 + e.hc2) AS date_total
      FROM window_reports wr
      JOIN pga_entries e ON e.report_id = wr.id
      GROUP BY wr.date
    ) per_date
  )
  SELECT jsonb_build_object(
    'dates', COALESCE((SELECT dates FROM dates_arr), '[]'::jsonb),
    'locations', COALESCE((SELECT locations FROM locations_arr), '[]'::jsonb),
    'metricAverages', (SELECT row_to_json(m)::jsonb FROM metric_avgs m)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

-- -----------------------------------------------------------------------------
-- Views (security_invoker so RLS of the caller applies)
-- -----------------------------------------------------------------------------

create view public.pga_report_summary with (security_invoker = true) as
 SELECT r.id AS report_id,
    r.date,
    r.created_at,
    COALESCE(sum(e.sv1), 0::bigint)::integer AS sv1,
    COALESCE(sum(e.sv2), 0::bigint)::integer AS sv2,
    COALESCE(sum(e.yxp), 0::bigint)::integer AS yxp,
    COALESCE(sum(e.kids), 0::bigint)::integer AS kids,
    COALESCE(sum(e.local), 0::bigint)::integer AS local,
    COALESCE(sum(e.hc1), 0::bigint)::integer AS hc1,
    COALESCE(sum(e.hc2), 0::bigint)::integer AS hc2,
    COALESCE(sum(e.sv1 + e.sv2 + e.yxp + e.kids + e.local + e.hc1 + e.hc2), 0::bigint)::integer AS total,
    COALESCE(sum(e.salvations), 0::bigint)::integer AS salvations,
    COALESCE(sum(e.salvations_livestream_enc), 0::bigint)::integer AS salvations_livestream_enc,
    COALESCE(sum(e.salvations_livestream_yxp), 0::bigint)::integer AS salvations_livestream_yxp,
    COALESCE(sum(e.salvations_inhouse), 0::bigint)::integer AS salvations_inhouse,
    COALESCE(sum(e.salvations_mc), 0::bigint)::integer AS salvations_mc,
    COALESCE(sum(e.salvations_other), 0::bigint)::integer AS salvations_other,
    COALESCE(sum(e.baptisms), 0::bigint)::integer AS baptisms,
    COALESCE(sum(e.mca), 0::bigint)::integer AS mca,
    COALESCE(sum(e.mechanics), 0::bigint)::integer AS mechanics,
    COALESCE(sum(e.mechanics_get), 0::bigint)::integer AS mechanics_get,
    COALESCE(sum(e.mechanics_worship), 0::bigint)::integer AS mechanics_worship,
    COALESCE(sum(e.mechanics_training), 0::bigint)::integer AS mechanics_training,
    COALESCE(sum(e.sv1 + e.sv2 + e.yxp), 0::bigint)::integer AS epga_total
   FROM pga_reports r
     LEFT JOIN pga_entries e ON e.report_id = r.id
  GROUP BY r.id, r.date, r.created_at;

create view public.four_week_pga_summary with (security_invoker = true) as
 WITH numbered AS (
         SELECT pga_report_summary.report_id,
            pga_report_summary.date,
            pga_report_summary.total,
            row_number() OVER (ORDER BY pga_report_summary.date DESC) AS rn
           FROM pga_report_summary
        )
 SELECT cur.report_id,
    cur.date,
    max(CASE WHEN prev.rn = (cur.rn + 3) THEN prev.total ELSE NULL::integer END) AS wk1_total,
    max(CASE WHEN prev.rn = (cur.rn + 3) THEN prev.date ELSE NULL::date END) AS wk1_date,
    max(CASE WHEN prev.rn = (cur.rn + 2) THEN prev.total ELSE NULL::integer END) AS wk2_total,
    max(CASE WHEN prev.rn = (cur.rn + 2) THEN prev.date ELSE NULL::date END) AS wk2_date,
    max(CASE WHEN prev.rn = (cur.rn + 1) THEN prev.total ELSE NULL::integer END) AS wk3_total,
    max(CASE WHEN prev.rn = (cur.rn + 1) THEN prev.date ELSE NULL::date END) AS wk3_date,
    cur.total AS wk4_total,
    cur.date AS wk4_date,
    round((COALESCE(max(CASE WHEN prev.rn = (cur.rn + 3) THEN prev.total ELSE NULL::integer END), 0)
         + COALESCE(max(CASE WHEN prev.rn = (cur.rn + 2) THEN prev.total ELSE NULL::integer END), 0)
         + COALESCE(max(CASE WHEN prev.rn = (cur.rn + 1) THEN prev.total ELSE NULL::integer END), 0)
         + cur.total)::numeric / (
        CASE WHEN max(CASE WHEN prev.rn = (cur.rn + 3) THEN 1 ELSE NULL::integer END) IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN max(CASE WHEN prev.rn = (cur.rn + 2) THEN 1 ELSE NULL::integer END) IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN max(CASE WHEN prev.rn = (cur.rn + 1) THEN 1 ELSE NULL::integer END) IS NOT NULL THEN 1 ELSE 0 END + 1)::numeric)::integer AS average
   FROM numbered cur
     LEFT JOIN numbered prev ON prev.rn >= (cur.rn + 1) AND prev.rn <= (cur.rn + 3)
  GROUP BY cur.report_id, cur.date, cur.total, cur.rn
  ORDER BY cur.date DESC;

create view public.four_week_epga_summary with (security_invoker = true) as
 WITH numbered AS (
         SELECT pga_report_summary.report_id,
            pga_report_summary.date,
            pga_report_summary.epga_total,
            row_number() OVER (ORDER BY pga_report_summary.date DESC) AS rn
           FROM pga_report_summary
        )
 SELECT cur.report_id,
    cur.date,
    max(CASE WHEN prev.rn = (cur.rn + 3) THEN prev.epga_total ELSE NULL::integer END) AS wk1_total,
    max(CASE WHEN prev.rn = (cur.rn + 3) THEN prev.date ELSE NULL::date END) AS wk1_date,
    max(CASE WHEN prev.rn = (cur.rn + 2) THEN prev.epga_total ELSE NULL::integer END) AS wk2_total,
    max(CASE WHEN prev.rn = (cur.rn + 2) THEN prev.date ELSE NULL::date END) AS wk2_date,
    max(CASE WHEN prev.rn = (cur.rn + 1) THEN prev.epga_total ELSE NULL::integer END) AS wk3_total,
    max(CASE WHEN prev.rn = (cur.rn + 1) THEN prev.date ELSE NULL::date END) AS wk3_date,
    cur.epga_total AS wk4_total,
    cur.date AS wk4_date,
    round((COALESCE(max(CASE WHEN prev.rn = (cur.rn + 3) THEN prev.epga_total ELSE NULL::integer END), 0)
         + COALESCE(max(CASE WHEN prev.rn = (cur.rn + 2) THEN prev.epga_total ELSE NULL::integer END), 0)
         + COALESCE(max(CASE WHEN prev.rn = (cur.rn + 1) THEN prev.epga_total ELSE NULL::integer END), 0)
         + cur.epga_total)::numeric / (
        CASE WHEN max(CASE WHEN prev.rn = (cur.rn + 3) THEN 1 ELSE NULL::integer END) IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN max(CASE WHEN prev.rn = (cur.rn + 2) THEN 1 ELSE NULL::integer END) IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN max(CASE WHEN prev.rn = (cur.rn + 1) THEN 1 ELSE NULL::integer END) IS NOT NULL THEN 1 ELSE 0 END + 1)::numeric)::integer AS average
   FROM numbered cur
     LEFT JOIN numbered prev ON prev.rn >= (cur.rn + 1) AND prev.rn <= (cur.rn + 3)
  GROUP BY cur.report_id, cur.date, cur.epga_total, cur.rn
  ORDER BY cur.date DESC;

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create trigger on_profile_updated
  before update on public.profiles
  for each row execute function public.handle_updated_at();

create trigger on_invitation_updated
  before update on public.user_invitations
  for each row execute function public.handle_updated_at();

create trigger update_fobs_updated_at
  before update on public.fobs
  for each row execute function public.update_updated_at_column();

create trigger update_locations_updated_at
  before update on public.locations
  for each row execute function public.update_updated_at_column();

create trigger update_user_assignments_updated_at
  before update on public.user_assignments
  for each row execute function public.update_updated_at_column();

create trigger update_pga_reports_updated_at
  before update on public.pga_reports
  for each row execute function public.update_updated_at_column();

create trigger update_pga_entries_updated_at
  before update on public.pga_entries
  for each row execute function public.update_updated_at_column();

create trigger stamp_pga_entry_scope_trg
  before insert or update of location_id on public.pga_entries
  for each row execute function public.stamp_pga_entry_scope();

-- -----------------------------------------------------------------------------
-- Row level security
-- -----------------------------------------------------------------------------

alter table public.audit_logs enable row level security;
alter table public.fobs enable row level security;
alter table public.locations enable row level security;
alter table public.pga_entries enable row level security;
alter table public.pga_reports enable row level security;
alter table public.profiles enable row level security;
alter table public.regions enable row level security;
alter table public.roles enable row level security;
alter table public.user_assignments enable row level security;
alter table public.user_invitations enable row level security;

-- audit_logs
create policy "Service role can insert audit logs" on public.audit_logs
  for insert to service_role with check (true);
create policy "Users can read own audit logs" on public.audit_logs
  for select to authenticated using (user_id = auth.uid());

-- fobs
create policy "Admins and managers can update fobs" on public.fobs
  for update to authenticated
  using (is_admin_or_manager(auth.uid())) with check (is_admin_or_manager(auth.uid()));
create policy "Admins can delete fobs" on public.fobs
  for delete to authenticated using (is_admin(auth.uid()));
create policy "Admins can insert fobs" on public.fobs
  for insert to authenticated with check (is_admin(auth.uid()));
create policy "Anonymous can read fobs" on public.fobs
  for select to anon using (true);
create policy "Users can read accessible fobs" on public.fobs
  for select to authenticated using (
    is_admin_or_manager(auth.uid())
    OR (EXISTS ( SELECT 1
       FROM (user_assignments ua
         JOIN roles r ON ((r.id = ua.role_id)))
      WHERE ((ua.user_id = auth.uid()) AND (r.name = 'fob_leader'::text) AND (ua.fob_id = fobs.id))))
    OR (EXISTS ( SELECT 1
       FROM ((user_assignments ua
         JOIN roles r ON ((r.id = ua.role_id)))
         JOIN locations l ON ((l.id = ua.location_id)))
      WHERE ((ua.user_id = auth.uid()) AND (r.name = 'pastor'::text) AND (l.fob_id = fobs.id))))
  );

-- locations
create policy "Admins and managers can update locations" on public.locations
  for update to authenticated
  using (is_admin_or_manager(auth.uid())) with check (is_admin_or_manager(auth.uid()));
create policy "Admins can delete locations" on public.locations
  for delete to authenticated using (is_admin(auth.uid()));
create policy "Admins can insert locations" on public.locations
  for insert to authenticated with check (is_admin(auth.uid()));
create policy "Anonymous can read locations" on public.locations
  for select to anon using (true);
create policy "Users can read accessible locations" on public.locations
  for select to authenticated using (
    is_admin_or_manager(auth.uid())
    OR (EXISTS ( SELECT 1
       FROM (user_assignments ua
         JOIN roles r ON ((r.id = ua.role_id)))
      WHERE ((ua.user_id = auth.uid()) AND (((r.name = 'fob_leader'::text) AND (ua.fob_id = locations.fob_id)) OR ((r.name = 'pastor'::text) AND (ua.location_id = locations.id))))))
  );

-- pga_entries
create policy "Admins can delete entries" on public.pga_entries
  for delete to authenticated using (is_admin(auth.uid()));
create policy "Admins managers and FOB leaders can update PGA entries" on public.pga_entries
  for update to authenticated
  using (can_access_location(auth.uid(), location_id) AND (is_admin_or_manager(auth.uid()) OR is_fob_leader(auth.uid())))
  with check (can_access_location(auth.uid(), location_id) AND (is_admin_or_manager(auth.uid()) OR is_fob_leader(auth.uid())));
create policy "Users can insert entries for accessible locations" on public.pga_entries
  for insert to authenticated with check (can_access_location(auth.uid(), location_id));
create policy "Users can read accessible entries" on public.pga_entries
  for select to authenticated using (can_access_location(auth.uid(), location_id));

-- pga_reports
create policy "Admins can delete reports" on public.pga_reports
  for delete to authenticated using (is_admin(auth.uid()));
create policy "Authenticated users can insert reports" on public.pga_reports
  for insert to authenticated with check (true);
create policy "Authenticated users can read reports" on public.pga_reports
  for select to authenticated using (true);
create policy "Users can update accessible reports" on public.pga_reports
  for update to authenticated using (
    is_admin_or_manager(auth.uid())
    OR (created_by = auth.uid())
    OR (EXISTS ( SELECT 1
       FROM (((pga_entries pe
         JOIN user_assignments ua ON ((ua.user_id = auth.uid())))
         JOIN roles r ON ((r.id = ua.role_id)))
         JOIN locations l ON ((l.id = pe.location_id)))
      WHERE ((pe.report_id = pga_reports.id) AND (r.name = 'fob_leader'::text) AND (l.fob_id = ua.fob_id))))
  );

-- profiles
create policy "Admins can view all profiles" on public.profiles
  for select using (is_admin(auth.uid()));
create policy "Users can delete own profile" on public.profiles
  for delete using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles
  for insert with check (auth.uid() = id);
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);

-- regions
create policy "Admins and managers can update regions" on public.regions
  for update to authenticated using (is_admin_or_manager(auth.uid()));
create policy "Admins can delete regions" on public.regions
  for delete to authenticated using (is_admin(auth.uid()));
create policy "Admins can insert regions" on public.regions
  for insert to authenticated with check (is_admin(auth.uid()));
create policy "Authenticated users can read regions" on public.regions
  for select to authenticated using (true);

-- roles
create policy "Anyone can read roles" on public.roles
  for select to authenticated using (true);

-- user_assignments
create policy "Admins can delete assignments" on public.user_assignments
  for delete to authenticated using (is_admin(auth.uid()));
create policy "Admins can insert assignments" on public.user_assignments
  for insert to authenticated with check (is_admin(auth.uid()));
create policy "Admins can read all assignments" on public.user_assignments
  for select to authenticated using (is_admin(auth.uid()));
create policy "Admins can update assignments" on public.user_assignments
  for update to authenticated
  using (is_admin(auth.uid())) with check (is_admin(auth.uid()));
create policy "Users can read own assignment" on public.user_assignments
  for select to authenticated using (user_id = auth.uid());

-- user_invitations
create policy "Admins can delete invitations" on public.user_invitations
  for delete using (is_admin(auth.uid()));
create policy "Admins can insert invitations" on public.user_invitations
  for insert with check (is_admin(auth.uid()));
create policy "Admins can update invitations" on public.user_invitations
  for update using (is_admin(auth.uid()));
create policy "Admins can view invitations" on public.user_invitations
  for select using (is_admin(auth.uid()));

-- -----------------------------------------------------------------------------
-- Grants: production uses the Supabase defaults (ALL on tables/views and
-- EXECUTE on functions for anon, authenticated, service_role), which the local
-- stack's default privileges already apply. Stated explicitly for clarity.
-- -----------------------------------------------------------------------------
grant all on all tables in schema public to anon, authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- pg_cron: weekly report generation (Sundays 00:00 UTC = 03:00 EAT)
-- -----------------------------------------------------------------------------
grant usage on schema cron to postgres;
select cron.schedule(
  'auto-generate-weekly-pga-report',
  '0 0 * * 0',
  $$select public.auto_generate_weekly_pga_report();$$
);
