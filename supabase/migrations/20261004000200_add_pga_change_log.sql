-- Change history for pga_entries and pga_reports.
--
-- pga_change_log is append-only and written ONLY by the AFTER triggers below
-- (SECURITY DEFINER). Deleted rows are kept here in full (old_data), which is
-- what makes deletes recoverable (see 20261004000300_add_pga_restore_rpcs.sql).
--
-- Cascaded deletes (admin deletes a report -> FK ON DELETE CASCADE removes its
-- entries) are captured row by row: every cascaded entry gets its own DELETE
-- row with the same changed_at as the report's DELETE row. The trigger stamps
-- changed_at with statement_timestamp() (identical for a statement and all of
-- its cascades, distinct for separate statements in one transaction). That
-- shared changed_at is how restore_pga_report() finds "the entries that were
-- deleted together with the report".
--
-- Restores: the restore RPCs set the transaction-local flag app.pga_restore =
-- 'on'; while it is set, INSERTs are logged as 'RESTORE' and
-- stamp_pga_entry_scope() keeps the original frozen fob_id/region_id instead of
-- re-deriving them from the location's current parent. Normal inserts are
-- unaffected (the flag is never set outside the restore RPCs).
--
-- Locks: CREATE TABLE (new object), CREATE TRIGGER on pga_entries/pga_reports
-- (SHARE ROW EXCLUSIVE, milliseconds). No table rewrite.

set lock_timeout = '5s';

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
create table if not exists public.pga_change_log (
  id bigint generated always as identity primary key,
  table_name text not null check (table_name in ('pga_entries', 'pga_reports')),
  row_id uuid not null,
  operation text not null check (operation in ('INSERT', 'UPDATE', 'DELETE', 'RESTORE')),
  old_data jsonb,
  new_data jsonb,
  changed_by uuid,
  changed_at timestamptz not null default now(),
  report_id uuid,
  report_date date,
  location_id uuid
);

comment on table public.pga_change_log is
  'Append-only history of pga_entries/pga_reports, written by triggers. changed_by null = system/cron/service role. Deleted rows live here (old_data) and can be restored with restore_pga_entry/restore_pga_report.';

create index if not exists pga_change_log_changed_at_idx on public.pga_change_log (changed_at desc);
create index if not exists pga_change_log_table_row_idx on public.pga_change_log (table_name, row_id);
create index if not exists pga_change_log_report_id_idx on public.pga_change_log (report_id);
create index if not exists pga_change_log_location_id_idx on public.pga_change_log (location_id);

alter table public.pga_change_log enable row level security;

drop policy if exists "Admins can read change log" on public.pga_change_log;
create policy "Admins can read change log" on public.pga_change_log
  for select to authenticated using (public.is_admin(auth.uid()));

-- Append-only: nobody but the trigger owner writes. RLS already blocks writes
-- (no policies), the revokes also cover TRUNCATE, which RLS does not.
revoke all on public.pga_change_log from anon;
revoke insert, update, delete, truncate, references, trigger on public.pga_change_log from authenticated;
grant select on public.pga_change_log to authenticated;

-- ---------------------------------------------------------------------------
-- Trigger function
-- ---------------------------------------------------------------------------
create or replace function public.log_pga_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_row jsonb;
  v_op text := tg_op;
  v_report_id uuid;
  v_report_date date;
  v_location_id uuid;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    v_old := to_jsonb(old);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    v_new := to_jsonb(new);
  end if;

  if tg_op = 'UPDATE' and v_old = v_new then
    return null; -- no-op update, nothing to record
  end if;

  if tg_op = 'INSERT' and current_setting('app.pga_restore', true) = 'on' then
    v_op := 'RESTORE';
  end if;

  v_row := coalesce(v_new, v_old);

  if tg_table_name = 'pga_entries' then
    v_report_id := (v_row ->> 'report_id')::uuid;
    v_location_id := (v_row ->> 'location_id')::uuid;
    select r.date into v_report_date from pga_reports r where r.id = v_report_id;
    if v_report_date is null then
      -- Report already gone (cascade): take the date from its DELETE log row,
      -- if it was written first. Otherwise the report trigger back-fills it.
      select l.report_date into v_report_date
      from pga_change_log l
      where l.table_name = 'pga_reports' and l.row_id = v_report_id and l.operation = 'DELETE'
      order by l.id desc
      limit 1;
    end if;
  else
    v_report_id := (v_row ->> 'id')::uuid;
    v_report_date := (v_row ->> 'date')::date;
  end if;

  insert into pga_change_log
    (table_name, row_id, operation, old_data, new_data, changed_by, changed_at, report_id, report_date, location_id)
  values
    (tg_table_name, (v_row ->> 'id')::uuid, v_op, v_old, v_new, auth.uid(), statement_timestamp(), v_report_id, v_report_date, v_location_id);

  if tg_table_name = 'pga_reports' and tg_op = 'DELETE' then
    -- Entries removed by ON DELETE CASCADE in this same statement were logged
    -- before this row (RI triggers fire first) and could not see the report.
    update pga_change_log
       set report_date = old.date
     where table_name = 'pga_entries'
       and report_id = old.id
       and report_date is null
       and changed_at = statement_timestamp();
  end if;

  return null;
end;
$$;

revoke all on function public.log_pga_change() from public, anon, authenticated;

drop trigger if exists pga_entries_change_log_trg on public.pga_entries;
create trigger pga_entries_change_log_trg
  after insert or update or delete on public.pga_entries
  for each row execute function public.log_pga_change();

drop trigger if exists pga_reports_change_log_trg on public.pga_reports;
create trigger pga_reports_change_log_trg
  after insert or update or delete on public.pga_reports
  for each row execute function public.log_pga_change();

-- ---------------------------------------------------------------------------
-- stamp_pga_entry_scope: keep the original snapshot while restoring.
-- Identical to the previous body except for the early return guarded by the
-- restore flag (INSERT only, and only when a snapshot is supplied).
-- ---------------------------------------------------------------------------
create or replace function public.stamp_pga_entry_scope()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if tg_op = 'INSERT'
     and new.fob_id is not null
     and current_setting('app.pga_restore', true) = 'on' then
    return new;  -- restore_pga_entry/restore_pga_report: keep frozen scope
  end if;

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
