-- Org update per the NCS sheet "DM Updates 6th Nov" (252 locations / 37 FOBs /
-- 8 regions), effective from the 2026-11-08 report:
--   1. New Northern region = Arua (was Western) + Gulu (was Eastern).
--   2. New GEAR region = Entebbe, Kajjansi, Nakawuka (were GKMS) + Mpigi (was GKMW).
--   3. New Kibibi FOB (Eastern) = WHBDND, WHKBBI, WHNMGR, WHNWPD (were Jinja).
--   4. Americas FOB renamed North America (same row, so its history follows the name).
--
-- History is NOT restated. pga_entries.fob_id / region_id are frozen snapshots
-- (see migrations_archive/20260830120000), so re-parenting FOBs and locations
-- only affects entries filed from now on. Entries already in reports dated on
-- or after the cutover are re-stamped to the new scope so the whole
-- 2026-11-08 report uses the new arrangement. Older reports are checksummed
-- before and after and must be byte-identical.
--
-- Pure data change: no DDL. Skipped (with a notice) on databases that do not
-- carry the production org structure, e.g. a local `supabase db reset`, where
-- migrations run before seed.sql.

set lock_timeout = '5s';

do $$
declare
  cutover constant date := '2026-11-08';
  history_before text;
  history_after text;
  entries_before bigint;
  entries_after bigint;
  n int;
  expected record;
begin
  if not exists (
    select 1 from public.fobs f join public.regions r on r.id = f.region_id
    where f.name = 'Jinja' and r.name = 'Eastern'
  ) then
    raise notice 'org update 2026-11-08 skipped: production org structure not present';
    return;
  end if;

  -- -------------------------------------------------------------------------
  -- Snapshot of history (reports before the cutover)
  -- -------------------------------------------------------------------------
  select md5(coalesce(string_agg(e.id::text || ':' || e.fob_id::text || ':' || coalesce(e.region_id::text, '-')
                                 || ':' || e.location_id::text || ':' || e.updated_at::text, ',' order by e.id), '')),
         count(*)
    into history_before, entries_before
  from public.pga_entries e
  join public.pga_reports r on r.id = e.report_id
  where r.date < cutover;

  -- -------------------------------------------------------------------------
  -- 1. Regions
  -- -------------------------------------------------------------------------
  insert into public.regions (name) values ('Northern'), ('GEAR')
  on conflict (name) do nothing;

  -- -------------------------------------------------------------------------
  -- 2. Rename Americas -> North America
  -- -------------------------------------------------------------------------
  update public.fobs set name = 'North America', updated_at = now()
  where name = 'Americas'
    and not exists (select 1 from public.fobs where name = 'North America');

  -- -------------------------------------------------------------------------
  -- 3. Kibibi FOB
  -- -------------------------------------------------------------------------
  insert into public.fobs (name, region_id)
  select 'Kibibi', id from public.regions where name = 'Eastern'
  on conflict (name) do nothing;

  -- -------------------------------------------------------------------------
  -- 4. Re-parent FOBs to their new regions
  -- -------------------------------------------------------------------------
  update public.fobs f
  set region_id = r.id, updated_at = now()
  from public.regions r
  where r.name = case f.name
      when 'Arua' then 'Northern'
      when 'Gulu' then 'Northern'
      when 'Entebbe' then 'GEAR'
      when 'Kajjansi' then 'GEAR'
      when 'Nakawuka' then 'GEAR'
      when 'Mpigi' then 'GEAR'
    end
    and f.region_id is distinct from r.id;

  -- -------------------------------------------------------------------------
  -- 5. Move the four Kibibi locations out of Jinja
  -- -------------------------------------------------------------------------
  update public.locations
  set fob_id = (select id from public.fobs where name = 'Kibibi'), updated_at = now()
  where name in ('WHBDND', 'WHKBBI', 'WHNMGR', 'WHNWPD');

  -- -------------------------------------------------------------------------
  -- 6. Re-stamp entries already filed in reports on/after the cutover.
  --    (The stamp trigger only fires on location_id changes, so set both.)
  -- -------------------------------------------------------------------------
  update public.pga_entries e
  set fob_id = l.fob_id, region_id = f.region_id
  from public.locations l
  join public.fobs f on f.id = l.fob_id,
       public.pga_reports r
  where l.id = e.location_id
    and r.id = e.report_id
    and r.date >= cutover
    and (e.fob_id, e.region_id) is distinct from (l.fob_id, f.region_id);

  -- -------------------------------------------------------------------------
  -- 7. Assert the end state matches the sheet
  -- -------------------------------------------------------------------------
  select count(*) into n from public.regions;
  if n <> 8 then raise exception 'expected 8 regions, found %', n; end if;

  select count(*) into n from public.fobs where archived_at is null;
  if n <> 37 then raise exception 'expected 37 active FOBs, found %', n; end if;

  select count(*) into n from public.locations where archived_at is null;
  if n <> 252 then raise exception 'expected 252 active locations, found %', n; end if;

  for expected in
    select * from (values
      ('Iganga', 'Eastern', 6),
      ('Jinja', 'Eastern', 8),
      ('Kamuli', 'Eastern', 3),
      ('Kibibi', 'Eastern', 4),
      ('Mbale', 'Eastern', 6),
      ('Wairaka', 'Eastern', 5),
      ('Entebbe', 'GEAR', 7),
      ('Kajjansi', 'GEAR', 7),
      ('Mpigi', 'GEAR', 7),
      ('Nakawuka', 'GEAR', 5),
      ('Bweyogerere', 'GKME', 8),
      ('Kira', 'GKME', 6),
      ('Kitukutwe', 'GKME', 9),
      ('Kungu', 'GKME', 6),
      ('Makerere', 'GKME', 7),
      ('Mukono', 'GKME', 9),
      ('Mukono Central', 'GKME', 5),
      ('Naalya', 'GKME', 1),
      ('Bugolobi', 'GKMS', 7),
      ('Joggo', 'GKMS', 7),
      ('Kansanga', 'GKMS', 15),
      ('Nakawa', 'GKMS', 5),
      ('Gayaza', 'GKMW', 7),
      ('Kabubbu', 'GKMW', 7),
      ('Kiti', 'GKMW', 6),
      ('Matugga', 'GKMW', 9),
      ('Wakiso', 'GKMW', 11),
      ('Europe & Oceania', 'Global', 9),
      ('Kenya', 'Global', 11),
      ('North America', 'Global', 6),
      ('Rest of Africa', 'Global', 6),
      ('Arua', 'Northern', 8),
      ('Gulu', 'Northern', 3),
      ('Fort Portal', 'Western', 7),
      ('Hoima', 'Western', 4),
      ('Masaka', 'Western', 6),
      ('Mbarara', 'Western', 9)
    ) as t(fob, region, sites)
  loop
    select count(*) into n
    from public.fobs f
    join public.regions r on r.id = f.region_id
    where f.name = expected.fob and r.name = expected.region and f.archived_at is null;
    if n <> 1 then
      raise exception 'FOB % is not an active FOB in region %', expected.fob, expected.region;
    end if;

    select count(*) into n
    from public.locations l
    join public.fobs f on f.id = l.fob_id
    where f.name = expected.fob and l.archived_at is null;
    if n <> expected.sites then
      raise exception 'FOB % expected % active locations, found %', expected.fob, expected.sites, n;
    end if;
  end loop;

  -- Every entry on/after the cutover carries the new scope.
  select count(*) into n
  from public.pga_entries e
  join public.pga_reports r on r.id = e.report_id
  join public.locations l on l.id = e.location_id
  join public.fobs f on f.id = l.fob_id
  where r.date >= cutover
    and (e.fob_id, e.region_id) is distinct from (l.fob_id, f.region_id);
  if n > 0 then raise exception '% entries on/after % not on the new scope', n, cutover; end if;

  -- History before the cutover is untouched.
  select md5(coalesce(string_agg(e.id::text || ':' || e.fob_id::text || ':' || coalesce(e.region_id::text, '-')
                                 || ':' || e.location_id::text || ':' || e.updated_at::text, ',' order by e.id), '')),
         count(*)
    into history_after, entries_after
  from public.pga_entries e
  join public.pga_reports r on r.id = e.report_id
  where r.date < cutover;

  if history_after <> history_before or entries_after <> entries_before then
    raise exception 'history before % changed (% -> % entries)', cutover, entries_before, entries_after;
  end if;

  raise notice 'org update 2026-11-08 applied; % historical entries unchanged', entries_after;
end $$;
