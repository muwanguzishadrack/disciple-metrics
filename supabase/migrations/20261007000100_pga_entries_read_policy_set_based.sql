-- Speed up every read of pga_entries (pga_report_summary, the four-week views,
-- the report pages) without changing who can see what.
--
-- The SELECT policy called can_access_location(auth.uid(), location_id) once
-- per row. It is a SECURITY DEFINER function, so Postgres cannot inline it,
-- and auth.uid() was re-evaluated per row too. With ~9,000 entries,
-- pga_report_summary (the dashboard / reports list query and the top query in
-- pg_stat_statements) took ~650 ms for an admin on production (2026-10-06).
--
-- The new policy asks for the caller's accessible locations once per
-- statement (a hashed subplan) and checks membership per row. The set is the
-- same as can_access_location's rule, written per location:
--   admin / manager   -> every location
--   fob_leader        -> locations in their FOB (locations.fob_id = ua.fob_id)
--   pastor            -> their own location
-- pga_entries.location_id is NOT NULL with a foreign key to locations, so
-- "every location" and "can_access_location is true" select the same rows.
--
-- can_access_location stays as it is (other policies and RPCs use it).

create or replace function public.accessible_location_ids()
returns setof uuid
language sql
stable
security definer
set search_path to 'public'
as $$
  select l.id
  from locations l
  where exists (
    select 1
    from user_assignments ua
    join roles r on r.id = ua.role_id
    where ua.user_id = auth.uid()
      and (
        r.name = 'admin'
        or r.name = 'manager'
        or (r.name = 'fob_leader' and l.fob_id = ua.fob_id)
        or (r.name = 'pastor' and ua.location_id = l.id)
      )
  );
$$;

comment on function public.accessible_location_ids() is
  'Location ids the current user (auth.uid()) can access; same rule as can_access_location. Used by RLS.';

revoke all on function public.accessible_location_ids() from public, anon;
grant execute on function public.accessible_location_ids() to authenticated, service_role;

drop policy "Users can read accessible entries" on public.pga_entries;

create policy "Users can read accessible entries"
  on public.pga_entries
  for select
  to authenticated
  using (location_id in (select public.accessible_location_ids()));
