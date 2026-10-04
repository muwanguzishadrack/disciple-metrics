-- Recoverable deletes + change-log listing (admin only).
--
-- There is NO deleted_at column: deleted rows live in pga_change_log
-- (operation = 'DELETE', old_data = full row), so every existing read path is
-- unchanged. These SECURITY DEFINER RPCs re-insert rows from old_data and
-- raise unless the caller is an admin.
--
-- Error contract (all raised as exceptions):
--   42501  PGA_ADMIN_ONLY: ...                caller is not an admin
--   P0001  PGA_RESTORE_NOT_FOUND: ...         no matching DELETE in the log
--   P0001  PGA_RESTORE_ALREADY_EXISTS: ...    row with that id exists again
--   P0001  PGA_RESTORE_REPORT_MISSING: ...    entry's report is deleted (restore the report first)
--   P0001  PGA_RESTORE_SLOT_TAKEN: ...        (report_id, location_id) already has an entry
--   P0001  PGA_RESTORE_LOCATION_MISSING: ...  entry's location no longer exists
--   P0001  PGA_RESTORE_DATE_TAKEN: ...        another report already uses that date
--
-- No locks on existing tables (functions only).

set lock_timeout = '5s';

-- ---------------------------------------------------------------------------
-- helpers (internal)
-- ---------------------------------------------------------------------------
create or replace function public.pga_assert_admin()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_admin(auth.uid()) then
    raise exception using errcode = '42501', message = 'PGA_ADMIN_ONLY: only admins can do this';
  end if;
end;
$$;

-- Insert one row of p_table (pga_entries | pga_reports) from a jsonb snapshot,
-- keeping its original id / created_by / created_at. Generated columns
-- (salvations) are skipped; user references that no longer exist are nulled.
create or replace function public.pga_reinsert_row(p_table text, p_data jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cols text;
  v_data jsonb := p_data;
begin
  if p_table not in ('pga_entries', 'pga_reports') then
    raise exception 'pga_reinsert_row: unsupported table %', p_table;
  end if;

  if (v_data ->> 'created_by') is not null
     and not exists (select 1 from profiles p where p.id = (v_data ->> 'created_by')::uuid) then
    v_data := jsonb_set(v_data, '{created_by}', 'null'::jsonb);
  end if;
  if p_table = 'pga_entries' and (v_data ->> 'region_id') is not null
     and not exists (select 1 from regions r where r.id = (v_data ->> 'region_id')::uuid) then
    v_data := jsonb_set(v_data, '{region_id}', 'null'::jsonb);
  end if;

  select string_agg(quote_ident(a.attname), ', ' order by a.attnum)
    into v_cols
  from pg_attribute a
  where a.attrelid = ('public.' || p_table)::regclass
    and a.attnum > 0
    and not a.attisdropped
    and a.attgenerated = ''
    and v_data ? a.attname;

  perform set_config('app.pga_restore', 'on', true);
  execute format(
    'insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I, $1)',
    p_table, v_cols, v_cols, p_table
  ) using v_data;
  perform set_config('app.pga_restore', 'off', true);
end;
$$;

revoke all on function public.pga_assert_admin() from public, anon, authenticated;
revoke all on function public.pga_reinsert_row(text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- restore_pga_entry
-- ---------------------------------------------------------------------------
create or replace function public.restore_pga_entry(p_log_id bigint)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_log pga_change_log%rowtype;
  v_entry_id uuid;
  v_report_id uuid;
  v_location_id uuid;
begin
  perform public.pga_assert_admin();

  select * into v_log
  from pga_change_log
  where id = p_log_id and table_name = 'pga_entries' and operation = 'DELETE';
  if not found then
    raise exception using errcode = 'P0001',
      message = format('PGA_RESTORE_NOT_FOUND: change-log row %s is not a deleted PGA entry', p_log_id);
  end if;

  v_entry_id := (v_log.old_data ->> 'id')::uuid;
  v_report_id := (v_log.old_data ->> 'report_id')::uuid;
  v_location_id := (v_log.old_data ->> 'location_id')::uuid;

  if exists (select 1 from pga_entries where id = v_entry_id) then
    raise exception using errcode = 'P0001',
      message = 'PGA_RESTORE_ALREADY_EXISTS: this entry has already been restored';
  end if;
  if not exists (select 1 from pga_reports where id = v_report_id) then
    raise exception using errcode = 'P0001',
      message = format('PGA_RESTORE_REPORT_MISSING: the report for %s no longer exists; restore the report first',
                       coalesce(v_log.report_date::text, 'this entry'));
  end if;
  if not exists (select 1 from locations where id = v_location_id) then
    raise exception using errcode = 'P0001',
      message = 'PGA_RESTORE_LOCATION_MISSING: the location of this entry no longer exists';
  end if;
  if exists (select 1 from pga_entries where report_id = v_report_id and location_id = v_location_id) then
    raise exception using errcode = 'P0001',
      message = 'PGA_RESTORE_SLOT_TAKEN: this location already has an entry in that report';
  end if;

  perform public.pga_reinsert_row('pga_entries', v_log.old_data);
  return v_entry_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- restore_pga_report
--   Re-inserts the report (original id/date) and every entry that was deleted
--   together with it (same changed_at as the report's DELETE row). Entries
--   whose location no longer exists, or whose slot is taken, are skipped; the
--   return value is the number of entries actually restored (compare with
--   get_deleted_pga_reports().entry_count).
-- ---------------------------------------------------------------------------
create or replace function public.restore_pga_report(p_report_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_log pga_change_log%rowtype;
  v_entry record;
  v_count integer := 0;
begin
  perform public.pga_assert_admin();

  if exists (select 1 from pga_reports where id = p_report_id) then
    raise exception using errcode = 'P0001',
      message = 'PGA_RESTORE_ALREADY_EXISTS: this report exists (already restored?)';
  end if;

  select * into v_log
  from pga_change_log
  where table_name = 'pga_reports' and row_id = p_report_id and operation = 'DELETE'
  order by id desc
  limit 1;
  if not found then
    raise exception using errcode = 'P0001',
      message = 'PGA_RESTORE_NOT_FOUND: no deleted report with that id';
  end if;

  if exists (select 1 from pga_reports where date = (v_log.old_data ->> 'date')::date) then
    raise exception using errcode = 'P0001',
      message = format('PGA_RESTORE_DATE_TAKEN: a report for %s already exists; delete or merge it first',
                       v_log.old_data ->> 'date');
  end if;

  perform public.pga_reinsert_row('pga_reports', v_log.old_data);

  for v_entry in
    select distinct on (l.row_id) l.old_data
    from pga_change_log l
    where l.table_name = 'pga_entries'
      and l.operation = 'DELETE'
      and l.report_id = p_report_id
      and l.changed_at = v_log.changed_at
    order by l.row_id, l.id desc
  loop
    continue when exists (select 1 from pga_entries e where e.id = (v_entry.old_data ->> 'id')::uuid);
    continue when not exists (select 1 from locations lo where lo.id = (v_entry.old_data ->> 'location_id')::uuid);
    continue when exists (
      select 1 from pga_entries e
      where e.report_id = p_report_id and e.location_id = (v_entry.old_data ->> 'location_id')::uuid
    );
    perform public.pga_reinsert_row('pga_entries', v_entry.old_data);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- get_deleted_pga_reports: reports currently deleted (not since restored)
-- ---------------------------------------------------------------------------
create or replace function public.get_deleted_pga_reports()
returns table(
  report_id uuid,
  report_date date,
  deleted_at timestamptz,
  deleted_by uuid,
  deleted_by_name text,
  entry_count integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.pga_assert_admin();

  return query
  select
    d.row_id,
    d.report_date,
    d.changed_at,
    d.changed_by,
    p.email,
    (select count(distinct c.row_id)::integer
       from pga_change_log c
      where c.table_name = 'pga_entries'
        and c.operation = 'DELETE'
        and c.report_id = d.row_id
        and c.changed_at = d.changed_at)
  from (
    select distinct on (l.row_id) l.*
    from pga_change_log l
    where l.table_name = 'pga_reports' and l.operation = 'DELETE'
    order by l.row_id, l.id desc
  ) d
  left join profiles p on p.id = d.changed_by
  where not exists (select 1 from pga_reports r where r.id = d.row_id)
  order by d.changed_at desc;
end;
$$;

-- ---------------------------------------------------------------------------
-- get_deleted_pga_entries: entries deleted on their own (NOT as part of a
-- report delete) and not since restored. report_exists = false means the
-- report was deleted later; restore it first, then the entry.
-- ---------------------------------------------------------------------------
create or replace function public.get_deleted_pga_entries(p_limit integer default 100)
returns table(
  log_id bigint,
  entry_id uuid,
  report_id uuid,
  report_date date,
  location_id uuid,
  location_name text,
  deleted_at timestamptz,
  deleted_by uuid,
  deleted_by_name text,
  report_exists boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.pga_assert_admin();

  return query
  select
    d.id,
    d.row_id,
    d.report_id,
    d.report_date,
    d.location_id,
    lo.name,
    d.changed_at,
    d.changed_by,
    p.email,
    exists (select 1 from pga_reports r where r.id = d.report_id)
  from (
    select distinct on (l.row_id) l.*
    from pga_change_log l
    where l.table_name = 'pga_entries' and l.operation = 'DELETE'
    order by l.row_id, l.id desc
  ) d
  left join locations lo on lo.id = d.location_id
  left join profiles p on p.id = d.changed_by
  where not exists (select 1 from pga_entries e where e.id = d.row_id)
    and not exists (
      select 1 from pga_change_log rl
      where rl.table_name = 'pga_reports'
        and rl.operation = 'DELETE'
        and rl.row_id = d.report_id
        and rl.changed_at = d.changed_at
    )
  order by d.changed_at desc, d.id desc
  limit greatest(coalesce(p_limit, 100), 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- get_pga_change_log: newest first, optional filters. Dates are interpreted
-- in Africa/Nairobi (the users' local day).
-- ---------------------------------------------------------------------------
create or replace function public.get_pga_change_log(
  p_from date default null,
  p_to date default null,
  p_location_id uuid default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table(
  id bigint,
  table_name text,
  row_id uuid,
  operation text,
  old_data jsonb,
  new_data jsonb,
  changed_by uuid,
  changed_by_name text,
  changed_at timestamptz,
  report_date date,
  location_id uuid,
  location_name text,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.pga_assert_admin();

  return query
  select
    l.id,
    l.table_name,
    l.row_id,
    l.operation,
    l.old_data,
    l.new_data,
    l.changed_by,
    p.email,
    l.changed_at,
    l.report_date,
    l.location_id,
    lo.name,
    count(*) over ()
  from pga_change_log l
  left join profiles p on p.id = l.changed_by
  left join locations lo on lo.id = l.location_id
  where (p_from is null or (l.changed_at at time zone 'Africa/Nairobi')::date >= p_from)
    and (p_to is null or (l.changed_at at time zone 'Africa/Nairobi')::date <= p_to)
    and (p_location_id is null or l.location_id = p_location_id)
  order by l.changed_at desc, l.id desc
  limit greatest(coalesce(p_limit, 50), 0)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants: authenticated only (the functions themselves enforce admin).
-- ---------------------------------------------------------------------------
revoke all on function public.restore_pga_entry(bigint) from public, anon;
revoke all on function public.restore_pga_report(uuid) from public, anon;
revoke all on function public.get_deleted_pga_reports() from public, anon;
revoke all on function public.get_deleted_pga_entries(integer) from public, anon;
revoke all on function public.get_pga_change_log(date, date, uuid, integer, integer) from public, anon;

grant execute on function public.restore_pga_entry(bigint) to authenticated, service_role;
grant execute on function public.restore_pga_report(uuid) to authenticated, service_role;
grant execute on function public.get_deleted_pga_reports() to authenticated, service_role;
grant execute on function public.get_deleted_pga_entries(integer) to authenticated, service_role;
grant execute on function public.get_pga_change_log(date, date, uuid, integer, integer) to authenticated, service_role;
