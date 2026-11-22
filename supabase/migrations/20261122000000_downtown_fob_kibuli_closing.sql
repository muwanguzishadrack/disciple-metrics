-- Org update, effective from the 2026-11-22 report:
--   1. Kansanga FOB births a new Downtown FOB (same region, GKMS).
--      Downtown = WHDWTN, WHKBYE, WHNDJE, WHSLRD, WHMSJA, WHMTND, WHZANA, WHRBGA
--      Kansanga keeps = WHKNGA, WHGBRD, WHMYNG, WHBZGA, WHNSBY, WHBSBL
--   2. WHKBLI (Kibuli) closes: archived, never deleted. It stays under
--      Kansanga so its history stays attributed there.
--
-- History is NOT restated. pga_entries.fob_id / region_id are frozen snapshots,
-- so moving locations only affects entries filed from now on. Entries already
-- in reports dated on or after the cutover are re-stamped so the whole
-- 2026-11-22 report uses the new arrangement. Older reports are checksummed
-- before and after and must be byte-identical.
--
-- Pure data change: no DDL. Skipped (with a notice) on databases that do not
-- carry the production org structure, e.g. a local `supabase db reset`, where
-- migrations run before seed.sql.

set lock_timeout = '5s';

do $$
declare
  cutover constant date := '2026-11-22';
  downtown_locs constant text[] :=
    array['WHDWTN','WHKBYE','WHNDJE','WHSLRD','WHMSJA','WHMTND','WHZANA','WHRBGA'];
  kansanga_locs constant text[] :=
    array['WHKNGA','WHGBRD','WHMYNG','WHBZGA','WHNSBY','WHBSBL'];
  history_before text;
  history_after text;
  entries_before bigint;
  entries_after bigint;
  fobs_before int;
  locs_before int;
  kansanga_id uuid;
  downtown_id uuid;
  n int;
begin
  select f.id into kansanga_id
  from public.fobs f join public.regions r on r.id = f.region_id
  where f.name = 'Kansanga' and r.name = 'GKMS' and f.archived_at is null;

  if kansanga_id is null
     or not exists (select 1 from public.locations where name = 'WHKBLI' and fob_id = kansanga_id)
     or exists (select 1 from public.fobs where name = 'Downtown') then
    raise notice 'org update 2026-11-22 skipped: production org structure not present or already applied';
    return;
  end if;

  select count(*) into fobs_before from public.fobs where archived_at is null;
  select count(*) into locs_before from public.locations where archived_at is null;

  select md5(coalesce(string_agg(e.id::text || ':' || e.fob_id::text || ':' || coalesce(e.region_id::text, '-')
                                 || ':' || e.location_id::text || ':' || e.updated_at::text, ',' order by e.id), '')),
         count(*)
    into history_before, entries_before
  from public.pga_entries e
  join public.pga_reports r on r.id = e.report_id
  where r.date < cutover;

  -- 1. Downtown FOB, in Kansanga's region
  insert into public.fobs (name, region_id)
  select 'Downtown', region_id from public.fobs where id = kansanga_id
  returning id into downtown_id;

  -- 2. Move the eight Downtown locations
  update public.locations
  set fob_id = downtown_id, updated_at = now()
  where name = any (downtown_locs) and fob_id = kansanga_id;
  get diagnostics n = row_count;
  if n <> 8 then raise exception 'expected to move 8 locations to Downtown, moved %', n; end if;

  -- 3. Close Kibuli (archive, keep under Kansanga)
  update public.locations
  set archived_at = now(), updated_at = now()
  where name = 'WHKBLI' and archived_at is null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'expected to archive WHKBLI, archived %', n; end if;

  -- 4. Re-stamp entries already filed in reports on/after the cutover.
  --    (The stamp trigger only fires on location_id changes, so set both.)
  update public.pga_entries e
  set fob_id = l.fob_id, region_id = f.region_id
  from public.locations l
  join public.fobs f on f.id = l.fob_id,
       public.pga_reports r
  where l.id = e.location_id
    and r.id = e.report_id
    and r.date >= cutover
    and (e.fob_id, e.region_id) is distinct from (l.fob_id, f.region_id);

  -- 5. Assert the end state
  select count(*) into n from public.fobs where archived_at is null;
  if n <> fobs_before + 1 then raise exception 'expected % active FOBs, found %', fobs_before + 1, n; end if;

  select count(*) into n from public.locations where archived_at is null;
  if n <> locs_before - 1 then raise exception 'expected % active locations, found %', locs_before - 1, n; end if;

  select count(*) into n from public.locations
  where fob_id = downtown_id and archived_at is null and name = any (downtown_locs);
  if n <> 8 then raise exception 'Downtown expected 8 active locations, found %', n; end if;

  select count(*) into n from public.locations where fob_id = downtown_id;
  if n <> 8 then raise exception 'Downtown holds % locations, expected exactly 8', n; end if;

  select count(*) into n from public.locations
  where fob_id = kansanga_id and archived_at is null and name = any (kansanga_locs);
  if n <> 6 then raise exception 'Kansanga expected 6 active locations, found %', n; end if;

  select count(*) into n from public.locations where fob_id = kansanga_id and archived_at is null;
  if n <> 6 then raise exception 'Kansanga holds % active locations, expected exactly 6', n; end if;

  select count(*) into n
  from public.pga_entries e
  join public.pga_reports r on r.id = e.report_id
  join public.locations l on l.id = e.location_id
  join public.fobs f on f.id = l.fob_id
  where r.date >= cutover
    and (e.fob_id, e.region_id) is distinct from (l.fob_id, f.region_id);
  if n > 0 then raise exception '% entries on/after % not on the new scope', n, cutover; end if;

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

  raise notice 'org update 2026-11-22 applied; % historical entries unchanged', entries_after;
end $$;
