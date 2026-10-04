-- Who-last-edited: pga_entries.updated_by / pga_reports.updated_by
--
-- Set by a BEFORE INSERT/UPDATE trigger to auth.uid(). When auth.uid() is null
-- (service role, pg_cron, FK cascades run by the auth server) the column is
-- left untouched. Deliberately NO foreign key to profiles: pga_entries and
-- pga_reports already have created_by -> profiles, and a second FK to the same
-- table would make PostgREST embeds like `profiles(...)` ambiguous.
--
-- Locks: ADD COLUMN without a default is a catalog-only change (brief ACCESS
-- EXCLUSIVE). CREATE TRIGGER takes SHARE ROW EXCLUSIVE briefly.

set lock_timeout = '5s';

alter table public.pga_entries add column if not exists updated_by uuid;
alter table public.pga_reports add column if not exists updated_by uuid;

comment on column public.pga_entries.updated_by is
  'auth.uid() of the last user who inserted/updated the row (null = system/service role or never edited since 2026-10).';
comment on column public.pga_reports.updated_by is
  'auth.uid() of the last user who inserted/updated the row (null = system/service role or never edited since 2026-10).';

create or replace function public.set_updated_by()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is not null then
    new.updated_by := v_uid;
  end if;
  return new;
end;
$$;

revoke all on function public.set_updated_by() from public, anon, authenticated;

drop trigger if exists set_pga_entries_updated_by on public.pga_entries;
create trigger set_pga_entries_updated_by
  before insert or update on public.pga_entries
  for each row execute function public.set_updated_by();

drop trigger if exists set_pga_reports_updated_by on public.pga_reports;
create trigger set_pga_reports_updated_by
  before insert or update on public.pga_reports
  for each row execute function public.set_updated_by();
