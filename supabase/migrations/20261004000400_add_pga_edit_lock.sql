-- Edit lock: entries of reports older than N days can only be changed by admins.
--
-- N = app_settings 'pga_edit_lock_days' (default 14). Chosen from production
-- data on 2026-10-04 (dates in Africa/Nairobi, lag = action date - report date):
--   * entry creation by non-admin users (pastor 5731, manager 1135,
--     fob_leader 643 rows): p99 <= 5 days, max 8 days -> 100% allowed at 14.
--   * genuine edits since 2026-08-30 (earlier edit times were overwritten by a
--     bulk migration): 99% within 3 days; a single edit at 24 days (editor
--     unknown, likely an admin).
-- A report dated D is locked when D < today(Nairobi) - N, i.e. entries can be
-- typed/edited up to and including N days after the report date.
--
-- Enforcement trigger on pga_entries (BEFORE INSERT/UPDATE/DELETE):
--   * auth.uid() is null (service role, pg_cron, import script) -> allowed
--   * caller is admin                                            -> allowed
--   * nested (pg_trigger_depth() > 1): FK cascades such as the
--     created_by SET NULL when a user is deleted, or an admin's
--     report delete cascading to entries                         -> allowed
--   * otherwise, if the (old or new) report date is locked        -> error
--     SQLSTATE P0001, message starting 'PGA_ENTRY_LOCKED:'
--
-- Locks: CREATE TABLE app_settings (new), CREATE TRIGGER on pga_entries
-- (SHARE ROW EXCLUSIVE, milliseconds).

set lock_timeout = '5s';

-- ---------------------------------------------------------------------------
-- app_settings
-- ---------------------------------------------------------------------------
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now(),
  constraint app_settings_pga_edit_lock_days_valid check (
    key <> 'pga_edit_lock_days'
    or (jsonb_typeof(value) = 'number'
        and (value #>> '{}')::numeric = trunc((value #>> '{}')::numeric)
        and (value #>> '{}')::numeric between 1 and 3650)
  )
);

comment on table public.app_settings is 'Small key/value application settings. Readable by authenticated users, writable by admins.';

alter table public.app_settings enable row level security;

drop policy if exists "Authenticated users can read app settings" on public.app_settings;
create policy "Authenticated users can read app settings" on public.app_settings
  for select to authenticated using (true);

drop policy if exists "Admins can update app settings" on public.app_settings;
create policy "Admins can update app settings" on public.app_settings
  for update to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

revoke all on public.app_settings from anon;
revoke insert, delete, truncate, references, trigger on public.app_settings from authenticated;
grant select, update on public.app_settings to authenticated;

drop trigger if exists update_app_settings_updated_at on public.app_settings;
create trigger update_app_settings_updated_at
  before update on public.app_settings
  for each row execute function public.update_updated_at_column();

insert into public.app_settings (key, value)
values ('pga_edit_lock_days', '14'::jsonb)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Lock functions
-- ---------------------------------------------------------------------------
create or replace function public.get_pga_lock_days()
returns integer
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(
    (select (s.value #>> '{}')::integer from app_settings s where s.key = 'pga_edit_lock_days'),
    14
  );
$$;

create or replace function public.is_pga_report_locked(p_report_date date)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select p_report_date < (now() at time zone 'Africa/Nairobi')::date - public.get_pga_lock_days();
$$;

revoke all on function public.get_pga_lock_days() from public, anon;
revoke all on function public.is_pga_report_locked(date) from public, anon;
grant execute on function public.get_pga_lock_days() to authenticated, service_role;
grant execute on function public.is_pga_report_locked(date) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Enforcement trigger
-- ---------------------------------------------------------------------------
create or replace function public.enforce_pga_entry_lock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_days integer;
  v_cutoff date;
  v_date date;
  v_old_report uuid;
  v_new_report uuid;
begin
  if v_uid is null or pg_trigger_depth() > 1 or public.is_admin(v_uid) then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  v_days := public.get_pga_lock_days();
  v_cutoff := (now() at time zone 'Africa/Nairobi')::date - v_days;

  if tg_op = 'INSERT' then
    v_old_report := null;
    v_new_report := new.report_id;
  elsif tg_op = 'UPDATE' then
    v_old_report := old.report_id;
    v_new_report := new.report_id;
  else
    v_old_report := old.report_id;
    v_new_report := null;
  end if;

  select min(r.date) into v_date
  from pga_reports r
  where r.id = v_old_report or r.id = v_new_report;

  if v_date is not null and v_date < v_cutoff then
    raise exception using
      errcode = 'P0001',
      message = format('PGA_ENTRY_LOCKED: the %s report is locked (entries can only be changed within %s days of the report date). Ask an admin to make this change.', v_date, v_days),
      hint = 'Admins can still edit locked reports.';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.enforce_pga_entry_lock() from public, anon, authenticated;

drop trigger if exists enforce_pga_entry_lock_trg on public.pga_entries;
create trigger enforce_pga_entry_lock_trg
  before insert or update or delete on public.pga_entries
  for each row execute function public.enforce_pga_entry_lock();
