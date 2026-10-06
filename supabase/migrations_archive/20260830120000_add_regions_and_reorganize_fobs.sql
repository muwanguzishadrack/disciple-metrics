-- Introduce the Region layer (Region -> FOB -> Location) per the NCS sheet
-- (DOC-20260814-WA0010.xlsx, 244 locations / 36 FOBs / 6 regions).
--
-- Cutover semantics: this applies from the 2026-08-30 report forward. Existing
-- history is NOT restated. FOB is currently derived at read time by joining
-- pga_entries -> locations -> fobs, so re-parenting a location would silently
-- move every past entry with it. To prevent that, pga_entries gets its own
-- fob_id, frozen to the pre-cutover parent BEFORE any location moves.
--
-- region_id on history IS derived (from the location's new region): 22 of the
-- 24 moves stay inside their region, no region figure has ever been published,
-- and per-location numbers are untouched -- so nothing is restated.
--
-- Retired FOBs (Global West, Sentema) are archived, never deleted: frozen
-- history points at those rows, and locations.fob_id is ON DELETE CASCADE.

-- ---------------------------------------------------------------------------
-- 1. Regions
-- ---------------------------------------------------------------------------

create table if not exists public.regions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

insert into public.regions (name)
values ('Eastern'), ('GKME'), ('GKMS'), ('GKMW'), ('Global'), ('Western')
on conflict (name) do nothing;

alter table public.regions enable row level security;

create policy "Authenticated users can read regions"
  on public.regions for select to authenticated using (true);

create policy "Admins can insert regions"
  on public.regions for insert to authenticated
  with check (public.is_admin(auth.uid()));

create policy "Admins and managers can update regions"
  on public.regions for update to authenticated
  using (public.is_admin_or_manager(auth.uid()));

create policy "Admins can delete regions"
  on public.regions for delete to authenticated
  using (public.is_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- 2. FOBs gain a region and an archive flag
-- ---------------------------------------------------------------------------

alter table public.fobs
  add column if not exists region_id uuid references public.regions (id),
  add column if not exists archived_at timestamptz;

-- Every lookup below resolves a FOB by name; make that provably unambiguous.
alter table public.fobs add constraint fobs_name_key unique (name);

comment on column public.fobs.archived_at is
  'Retired FOB. Hidden from pickers/filters/new reports, still resolvable for frozen history.';

insert into public.fobs (name)
values ('Americas'), ('Europe & Oceania'), ('Bweyogerere')
on conflict (name) do nothing;

update public.fobs f
set region_id = r.id, updated_at = now()
from public.regions r
where r.name = case f.name
    when 'Gulu' then 'Eastern'
    when 'Iganga' then 'Eastern'
    when 'Jinja' then 'Eastern'
    when 'Kamuli' then 'Eastern'
    when 'Mbale' then 'Eastern'
    when 'Wairaka' then 'Eastern'

    when 'Bweyogerere' then 'GKME'
    when 'Kira' then 'GKME'
    when 'Kitukutwe' then 'GKME'
    when 'Kungu' then 'GKME'
    when 'Makerere' then 'GKME'
    when 'Mukono' then 'GKME'
    when 'Mukono Central' then 'GKME'
    when 'Naalya' then 'GKME'

    when 'Bugolobi' then 'GKMS'
    when 'Entebbe' then 'GKMS'
    when 'Joggo' then 'GKMS'
    when 'Kajjansi' then 'GKMS'
    when 'Kansanga' then 'GKMS'
    when 'Nakawa' then 'GKMS'
    when 'Nakawuka' then 'GKMS'

    when 'Gayaza' then 'GKMW'
    when 'Kabubbu' then 'GKMW'
    when 'Kiti' then 'GKMW'
    when 'Matugga' then 'GKMW'
    when 'Mpigi' then 'GKMW'
    when 'Wakiso' then 'GKMW'

    when 'Americas' then 'Global'
    when 'Europe & Oceania' then 'Global'
    when 'Kenya' then 'Global'
    when 'Rest of Africa' then 'Global'

    when 'Arua' then 'Western'
    when 'Fort Portal' then 'Western'
    when 'Hoima' then 'Western'
    when 'Masaka' then 'Western'
    when 'Mbarara' then 'Western'
  end;

-- ---------------------------------------------------------------------------
-- 3. Locations gain an archive flag
-- ---------------------------------------------------------------------------

alter table public.locations
  add column if not exists archived_at timestamptz;

comment on column public.locations.archived_at is
  'Location no longer in the official arrangement. Hidden from pickers and new
   reports; still rendered in historical reports where entries exist.';

-- ---------------------------------------------------------------------------
-- 4. pga_entries carry their own scope
-- ---------------------------------------------------------------------------

alter table public.pga_entries
  add column if not exists fob_id uuid references public.fobs (id),
  add column if not exists region_id uuid references public.regions (id);

comment on column public.pga_entries.fob_id is
  'FOB at the time the entry was filed. Frozen -- does not follow later
   re-parenting of the location. Read paths must prefer this over the live join.';

-- ---------------------------------------------------------------------------
-- 5. FREEZE -- must run before any location moves
-- ---------------------------------------------------------------------------

update public.pga_entries e
set fob_id = l.fob_id
from public.locations l
where l.id = e.location_id
  and e.fob_id is null;

do $$
declare unfrozen int;
begin
  select count(*) into unfrozen from public.pga_entries where fob_id is null;
  if unfrozen > 0 then
    raise exception 'freeze incomplete: % entries without fob_id', unfrozen;
  end if;
end $$;

alter table public.pga_entries alter column fob_id set not null;

create index if not exists pga_entries_fob_id_idx on public.pga_entries (fob_id);
create index if not exists pga_entries_region_id_idx on public.pga_entries (region_id);

-- ---------------------------------------------------------------------------
-- 6. Re-parent the 24 moving locations
-- ---------------------------------------------------------------------------

-- Global West splits by continent
update public.locations set fob_id = (select id from public.fobs where name = 'Europe & Oceania'), updated_at = now()
where name in ('WHAUST','WHEUOL','WHGMNY','WHGNVA','WHKFLD','WHLEDS','WHLUTN','WHNWLS','WHUKDM','WHWGAN');

update public.locations set fob_id = (select id from public.fobs where name = 'Americas'), updated_at = now()
where name in ('WHBMDA','WHBOST','WHCNDA','WHTXAS','WHUSOA');

-- Naalya keeps only WHNLYA; the rest form Bweyogerere
update public.locations set fob_id = (select id from public.fobs where name = 'Bweyogerere'), updated_at = now()
where name in ('WHBLID','WHBYGR','WHKWGA','WHMSDY','WHNTDA','WHSETA','WHSOND');

-- Sentema dissolves
update public.locations set fob_id = (select id from public.fobs where name = 'Makerere'), updated_at = now()
where name = 'WHMSNF';

update public.locations set fob_id = (select id from public.fobs where name = 'Wakiso'), updated_at = now()
where name = 'WHSNTM';

-- ---------------------------------------------------------------------------
-- 7. Archive what leaves the arrangement
-- ---------------------------------------------------------------------------

update public.fobs set archived_at = now(), updated_at = now()
where name in ('Global West','Sentema');

-- Absent from the NCS sheet; zero entries and zero assignments, so they simply
-- stop appearing. Parked rather than deleted -- both carry a named pastor and
-- read as sheet omissions, and the delete path cascades hard.
update public.locations set archived_at = now(), updated_at = now()
where name in ('WHNMPG','WHPLSA');

-- ---------------------------------------------------------------------------
-- 8. Derive region on history -- must run after the re-parent
-- ---------------------------------------------------------------------------

update public.pga_entries e
set region_id = f.region_id
from public.locations l
join public.fobs f on f.id = l.fob_id
where l.id = e.location_id
  and e.region_id is null;

-- ---------------------------------------------------------------------------
-- 9. Assignments
-- ---------------------------------------------------------------------------

-- Global West's leader follows their own campus (WHUKDM) and 10 of 15 sites.
-- Americas is intentionally left without a fob_leader.
update public.user_assignments ua
set fob_id = (select id from public.fobs where name = 'Europe & Oceania'), updated_at = now()
from public.profiles p
where p.id = ua.user_id and p.email = 'ukdm.worshipharvestuk@gmail.com';

-- Naalya's second leader takes Bweyogerere (7 of the 8 former Naalya sites).
update public.user_assignments ua
set fob_id = (select id from public.fobs where name = 'Bweyogerere'), updated_at = now()
from public.profiles p
where p.id = ua.user_id and p.email = 'kweika@outlook.com';

-- Sentema's account was a campus account, not a district leader: it is the only
-- non-admin account that has ever filed WHSNTM, and WHSNTM has no pastor
-- assignment. As a pastor it keeps reporting and keeps its history, because the
-- pastor RLS rule matches on location_id and is immune to the FOB move.
update public.user_assignments ua
set role_id = (select id from public.roles where name = 'pastor'),
    fob_id = null,
    location_id = (select id from public.locations where name = 'WHSNTM'),
    updated_at = now()
from public.profiles p
where p.id = ua.user_id and p.email = 'whsentema@gmail.com';

-- ---------------------------------------------------------------------------
-- 10. Stamp scope on every new entry
-- ---------------------------------------------------------------------------

create or replace function public.stamp_pga_entry_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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
$$;

drop trigger if exists stamp_pga_entry_scope_trg on public.pga_entries;

create trigger stamp_pga_entry_scope_trg
  before insert or update of location_id on public.pga_entries
  for each row execute function public.stamp_pga_entry_scope();

-- ---------------------------------------------------------------------------
-- 11. Assert the end state matches the NCS sheet
-- ---------------------------------------------------------------------------

do $$
declare
  n int;
  expected record;
begin
  select count(*) into n from public.regions;
  if n <> 6 then raise exception 'expected 6 regions, found %', n; end if;

  select count(*) into n from public.fobs where archived_at is null;
  if n <> 36 then raise exception 'expected 36 active FOBs, found %', n; end if;

  select count(*) into n from public.fobs where archived_at is null and region_id is null;
  if n > 0 then raise exception '% active FOBs have no region', n; end if;

  select count(*) into n from public.locations where archived_at is null;
  if n <> 244 then raise exception 'expected 244 active locations, found %', n; end if;

  select count(*) into n from public.locations l
  join public.fobs f on f.id = l.fob_id
  where f.archived_at is not null;
  if n > 0 then raise exception '% locations still hang off an archived FOB', n; end if;

  for expected in
    select * from (values
      ('Americas', 5), ('Europe & Oceania', 10), ('Bweyogerere', 7),
      ('Naalya', 1), ('Makerere', 6), ('Wakiso', 12), ('Mbale', 5)
    ) as t(fob, sites)
  loop
    select count(*) into n
    from public.locations l
    join public.fobs f on f.id = l.fob_id
    where f.name = expected.fob and l.archived_at is null;

    if n <> expected.sites then
      raise exception 'FOB % expected % active locations, found %', expected.fob, expected.sites, n;
    end if;
  end loop;

  select count(*) into n from public.pga_entries where region_id is null;
  if n > 0 then raise exception '% entries without a region', n; end if;

  -- History must not have moved: Global West and Sentema still own their past.
  select count(*) into n from public.pga_entries e
  join public.fobs f on f.id = e.fob_id where f.name = 'Global West';
  if n < 459 then raise exception 'Global West history shrank: expected at least 459 entries, found %', n; end if;

  select count(*) into n from public.pga_entries e
  join public.fobs f on f.id = e.fob_id where f.name = 'Sentema';
  if n < 68 then raise exception 'Sentema history shrank: expected at least 68 entries, found %', n; end if;

  select count(*) into n from public.user_assignments ua
  join public.profiles p on p.id = ua.user_id
  join public.fobs f on f.id = ua.fob_id
  where p.email = 'ukdm.worshipharvestuk@gmail.com' and f.name = 'Europe & Oceania';
  if n <> 1 then raise exception 'ukdm leader not on Europe & Oceania'; end if;

  select count(*) into n from public.user_assignments ua
  join public.profiles p on p.id = ua.user_id
  join public.fobs f on f.id = ua.fob_id
  where p.email = 'kweika@outlook.com' and f.name = 'Bweyogerere';
  if n <> 1 then raise exception 'kweika not on Bweyogerere'; end if;

  select count(*) into n from public.user_assignments ua
  join public.profiles p on p.id = ua.user_id
  join public.roles r on r.id = ua.role_id
  join public.locations l on l.id = ua.location_id
  where p.email = 'whsentema@gmail.com' and r.name = 'pastor' and l.name = 'WHSNTM';
  if n <> 1 then raise exception 'whsentema not pastor of WHSNTM'; end if;
end $$;
