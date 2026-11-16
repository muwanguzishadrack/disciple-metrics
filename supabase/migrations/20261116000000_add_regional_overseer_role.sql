-- Regional Overseer role: the FOB Leader's access, one level up.
--
-- A regional_overseer is assigned to one region (user_assignments.region_id)
-- and gets, for every FOB and location in that region, what a fob_leader gets
-- for their FOB: read fobs/locations/entries, insert and update entries, update
-- reports that contain those entries. No deletes, no archiving, no editing of
-- locked reports (enforce_pga_entry_lock only exempts admins), no team access.
--
-- "In their region" means the location's CURRENT parent FOB's region
-- (locations.fob_id -> fobs.region_id), the same way fob_leader access uses the
-- location's current FOB. pga_entries.region_id snapshots are not used for access.
--
-- Additive and backwards compatible: the current app never writes region_id
-- and never assigns the new role, and every existing row still passes the
-- widened valid_assignment check.

set lock_timeout = '5s';

-- ---------------------------------------------------------------------------
-- Role
-- ---------------------------------------------------------------------------
insert into public.roles (id, name, description) values
  ('7d3c1a52-4f0e-4b8a-9c61-2e5f8a0b3d47', 'regional_overseer',
   'Access to all FOBs and locations within their assigned region')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------
alter table public.user_assignments
  add column region_id uuid
  constraint user_assignments_region_id_fkey references public.regions(id) on delete set null;
create index idx_user_assignments_region_id on public.user_assignments using btree (region_id);

alter table public.user_invitations
  add column region_id uuid
  constraint user_invitations_region_id_fkey references public.regions(id);

-- At most one scope per assignment (was: fob XOR location XOR neither).
alter table public.user_assignments drop constraint valid_assignment;
alter table public.user_assignments
  add constraint valid_assignment check (num_nonnulls(fob_id, location_id, region_id) <= 1);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.is_regional_overseer(p_user_id uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  SELECT EXISTS (
    SELECT 1
    FROM user_assignments ua
    JOIN roles r ON r.id = ua.role_id
    WHERE ua.user_id = p_user_id AND r.name = 'regional_overseer'
  );
$function$;

create or replace function public.get_user_region_id(p_user_id uuid)
 returns uuid
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  SELECT ua.region_id
  FROM user_assignments ua
  WHERE ua.user_id = p_user_id;
$function$;

-- FOB ids in the caller's region when the caller is a regional_overseer
-- (empty otherwise). SECURITY DEFINER so policies on locations / pga_reports
-- can use it without joining fobs under RLS: the fobs SELECT policy reads
-- locations, so a join to fobs inside a locations policy recurses forever.
create or replace function public.overseer_fob_ids()
returns setof uuid
language sql
stable
security definer
set search_path to 'public'
as $$
  select f.id
  from fobs f
  join user_assignments ua on ua.region_id = f.region_id
  join roles r on r.id = ua.role_id
  where ua.user_id = auth.uid()
    and r.name = 'regional_overseer';
$$;

comment on function public.overseer_fob_ids() is
  'FOB ids in the current user''s region if they are a regional_overseer, else none. Used by RLS.';

revoke all on function public.overseer_fob_ids() from public, anon;
grant execute on function public.overseer_fob_ids() to authenticated, service_role;

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
    LEFT JOIN fobs f ON f.id = l.fob_id
    WHERE ua.user_id = p_user_id
    AND (
      r.name = 'admin'
      OR r.name = 'manager'
      OR (r.name = 'regional_overseer' AND f.region_id = ua.region_id)
      OR (r.name = 'fob_leader' AND l.fob_id = ua.fob_id)
      OR (r.name = 'pastor' AND ua.location_id = p_location_id)
    )
  );
$function$;

create or replace function public.accessible_location_ids()
returns setof uuid
language sql
stable
security definer
set search_path to 'public'
as $$
  select l.id
  from locations l
  left join fobs f on f.id = l.fob_id
  where exists (
    select 1
    from user_assignments ua
    join roles r on r.id = ua.role_id
    where ua.user_id = auth.uid()
      and (
        r.name = 'admin'
        or r.name = 'manager'
        or (r.name = 'regional_overseer' and f.region_id = ua.region_id)
        or (r.name = 'fob_leader' and l.fob_id = ua.fob_id)
        or (r.name = 'pastor' and ua.location_id = l.id)
      )
  );
$$;

revoke all on function public.accessible_location_ids() from public, anon;
grant execute on function public.accessible_location_ids() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Policies (same rules as before plus the regional_overseer branch)
-- ---------------------------------------------------------------------------
drop policy "Users can read accessible fobs" on public.fobs;
create policy "Users can read accessible fobs" on public.fobs
  for select to authenticated using (
    is_admin_or_manager(auth.uid())
    OR (EXISTS ( SELECT 1
       FROM (user_assignments ua
         JOIN roles r ON ((r.id = ua.role_id)))
      WHERE ((ua.user_id = auth.uid()) AND (r.name = 'regional_overseer'::text) AND (ua.region_id = fobs.region_id))))
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

drop policy "Users can read accessible locations" on public.locations;
create policy "Users can read accessible locations" on public.locations
  for select to authenticated using (
    is_admin_or_manager(auth.uid())
    OR (locations.fob_id IN ( SELECT public.overseer_fob_ids()))
    OR (EXISTS ( SELECT 1
       FROM (user_assignments ua
         JOIN roles r ON ((r.id = ua.role_id)))
      WHERE ((ua.user_id = auth.uid()) AND (((r.name = 'fob_leader'::text) AND (ua.fob_id = locations.fob_id)) OR ((r.name = 'pastor'::text) AND (ua.location_id = locations.id))))))
  );

drop policy "Admins managers and FOB leaders can update PGA entries" on public.pga_entries;
create policy "Admins managers and FOB leaders can update PGA entries" on public.pga_entries
  for update to authenticated
  using (can_access_location(auth.uid(), location_id)
         AND (is_admin_or_manager(auth.uid()) OR is_fob_leader(auth.uid()) OR is_regional_overseer(auth.uid())))
  with check (can_access_location(auth.uid(), location_id)
         AND (is_admin_or_manager(auth.uid()) OR is_fob_leader(auth.uid()) OR is_regional_overseer(auth.uid())));

drop policy "Users can update accessible reports" on public.pga_reports;
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
    OR (EXISTS ( SELECT 1
       FROM (pga_entries pe
         JOIN locations l ON ((l.id = pe.location_id)))
      WHERE ((pe.report_id = pga_reports.id) AND (l.fob_id IN ( SELECT public.overseer_fob_ids())))))
  );
