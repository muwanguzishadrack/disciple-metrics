# Production rollout: change history, restore, edit lock, range checks, analytics

Order matters: **database first, app second.** Every migration is additive;
the currently deployed app keeps working against the new database (the only
behaviour changes it will notice are the edit lock and the range checks,
both of which match how the app is used today; see "Behaviour changes").

All six files run in a few hundred milliseconds in total on production's
data size (~8.8k entries, 40 reports). Each starts with
`set lock_timeout = '5s'`: if a lock cannot be taken within 5 s the migration
fails and rolls back cleanly; just re-run it.

**When:** a weekday morning (EAT). Avoid Sunday 00:00 UTC (pg_cron creates the
weekly report) and Sunday/Monday when pastors and leaders are typing entries.

## Step 0: preparation (no production writes except the history repair)

1. Merge the branch; on the machine that will run the rollout:
   `supabase start && supabase db reset && supabase test db` -> `Result: PASS`.
2. Backup: run `supabase/scripts/backup.sh` (see [BACKUPS.md](BACKUPS.md)) and
   note the timestamp of the latest daily backup in the dashboard.
3. Drift check: run `supabase/scripts/schema_fingerprint_summary.sql` on prod
   (SQL editor). It must equal the table in [MIGRATIONS.md](MIGRATIONS.md).
   If anything differs, STOP: someone changed prod after 2026-10-04; fold the
   change into a migration first.
4. Data pre-checks (read-only, all must return 0 rows / 0):
   ```sql
   -- CHECK bounds (see 20261004000500); expect 0
   select count(*) from pga_entries where
     sv1 not between 0 and 10000 or sv2 not between 0 and 5000 or yxp not between 0 and 5000
     or kids not between 0 and 5000 or local not between 0 and 2000 or hc1 not between 0 and 2000
     or hc2 not between 0 and 1000 or mca not between 0 and 20000 or baptisms not between 0 and 1000
     or salvations_inhouse not between 0 and 2000 or salvations_livestream_enc not between 0 and 1000
     or salvations_livestream_yxp not between 0 and 1000 or salvations_mc not between 0 and 2000
     or salvations_other not between 0 and 5000 or salvations not between 0 and 20000
     or mechanics_get not between 0 and 2000 or mechanics_worship not between 0 and 2000
     or mechanics_training not between 0 and 5000 or mechanics not between 0 and 10000;
   -- names must be free; expect 0 rows
   select relname from pg_class where relnamespace = 'public'::regnamespace
     and relname in ('pga_change_log', 'app_settings');
   ```
5. Align the migration history: follow "One-time: align production's
   migration history" in [MIGRATIONS.md](MIGRATIONS.md) (backup table,
   `supabase link`, `migration repair`).
6. `supabase db push --dry-run` must list exactly these six files, in order:

   ```
   20261004000100_add_updated_by.sql
   20261004000200_add_pga_change_log.sql
   20261004000300_add_pga_restore_rpcs.sql
   20261004000400_add_pga_edit_lock.sql
   20261004000500_add_pga_entries_range_checks.sql
   20261004000600_add_pga_analytics_rpcs.sql
   ```

## Step 1: apply

```bash
supabase db push            # applies the six files, one transaction each
```

You may also push them one at a time by moving later files out of the folder,
or paste each file into the SQL editor in order. If you use the SQL editor or
the Supabase MCP `apply_migration`, afterwards record the versions so the CLI
stays in sync: `supabase migration repair --status applied <version>` for
each file (and delete any history rows the MCP created with other versions).

## Step 2: per-migration details, verification and rollback

Rollback = run the ROLLBACK block of that migration (and of every later one
first, in reverse order), then `supabase migration repair --status reverted <version>`.
Rolling back `..0200` deletes the change history collected since the rollout;
export it first if it matters:
`copy (select * from pga_change_log) to stdout with csv header` (psql).

### 20261004000100_add_updated_by.sql

- **Does:** adds nullable `updated_by uuid` to `pga_entries` and
  `pga_reports`; `set_updated_by()` BEFORE INSERT/UPDATE triggers stamp
  `auth.uid()` (untouched when null: service role, cron). No FK (avoids
  ambiguous PostgREST embeds with `created_by -> profiles`).
- **Locks:** ADD COLUMN without default = catalog-only, ACCESS EXCLUSIVE for
  milliseconds; CREATE TRIGGER = SHARE ROW EXCLUSIVE for milliseconds.
- **Verify:**
  ```sql
  select table_name, column_name from information_schema.columns
   where table_schema = 'public' and column_name = 'updated_by';          -- 2 rows
  select tgname from pg_trigger where tgname like 'set_pga_%_updated_by'; -- 2 rows
  ```
- **Rollback:**
  ```sql
  drop trigger if exists set_pga_entries_updated_by on public.pga_entries;
  drop trigger if exists set_pga_reports_updated_by on public.pga_reports;
  drop function if exists public.set_updated_by();
  alter table public.pga_entries drop column if exists updated_by;
  alter table public.pga_reports drop column if exists updated_by;
  ```

### 20261004000200_add_pga_change_log.sql

- **Does:** creates `pga_change_log` (+4 indexes, RLS: admins SELECT only, no
  write policies, writes/TRUNCATE revoked from anon/authenticated);
  `log_pga_change()` SECURITY DEFINER AFTER INSERT/UPDATE/DELETE triggers on
  `pga_entries` and `pga_reports` (cascaded entry deletes are logged per row;
  report date back-filled); replaces `stamp_pga_entry_scope()` with an
  identical body plus an early return used only while a restore RPC runs
  (`app.pga_restore = 'on'`).
- **Locks:** new table; CREATE TRIGGER on both tables (milliseconds).
- **Overhead:** one small INSERT into the log per changed row (plus a PK
  lookup for the report date). A full re-stamp of all 8.8k entries would add
  8.8k log rows (~10 MB with jsonb); normal weekly volume is ~250 rows.
- **Verify:**
  ```sql
  select count(*) from pga_change_log;                                     -- 0
  select tgname from pg_trigger where tgname like 'pga_%_change_log_trg';  -- 2 rows
  -- after the first real edit in the app:
  select operation, table_name, changed_by, changed_at from pga_change_log order by id desc limit 5;
  ```
- **Rollback:**
  ```sql
  drop trigger if exists pga_entries_change_log_trg on public.pga_entries;
  drop trigger if exists pga_reports_change_log_trg on public.pga_reports;
  drop function if exists public.log_pga_change();
  drop table if exists public.pga_change_log;
  create or replace function public.stamp_pga_entry_scope()
   returns trigger language plpgsql security definer set search_path to 'public'
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
  ```
  (requires `..0300` rolled back first: its functions reference the table.)

### 20261004000300_add_pga_restore_rpcs.sql

- **Does:** SECURITY DEFINER, admin-only RPCs `restore_pga_entry(bigint)`,
  `restore_pga_report(uuid)`, `get_deleted_pga_reports()`,
  `get_deleted_pga_entries(int)`, `get_pga_change_log(date, date, uuid, int, int)`
  and two internal helpers (`pga_assert_admin()`, `pga_reinsert_row(text, jsonb)`,
  not executable by API roles). EXECUTE granted to authenticated/service_role,
  revoked from anon/PUBLIC.
- **Locks:** none on tables.
- **Verify:**
  ```sql
  select proname from pg_proc where pronamespace = 'public'::regnamespace
   and proname in ('restore_pga_entry','restore_pga_report','get_deleted_pga_reports',
                   'get_deleted_pga_entries','get_pga_change_log');           -- 5 rows
  -- as postgres in the SQL editor (no JWT) the RPCs must refuse:
  select * from get_deleted_pga_reports();   -- ERROR PGA_ADMIN_ONLY (42501)
  ```
  Then, logged in as an admin in the app (after the UI ships), the deleted
  lists load.
- **Rollback:**
  ```sql
  drop function if exists public.get_pga_change_log(date, date, uuid, integer, integer);
  drop function if exists public.get_deleted_pga_entries(integer);
  drop function if exists public.get_deleted_pga_reports();
  drop function if exists public.restore_pga_report(uuid);
  drop function if exists public.restore_pga_entry(bigint);
  drop function if exists public.pga_reinsert_row(text, jsonb);
  drop function if exists public.pga_assert_admin();
  ```

### 20261004000400_add_pga_edit_lock.sql

- **Does:** `app_settings` table (RLS: authenticated SELECT, admin UPDATE;
  value check for `pga_edit_lock_days`), row `('pga_edit_lock_days', 14)`,
  `get_pga_lock_days()`, `is_pga_report_locked(date)`, and
  `enforce_pga_entry_lock()` BEFORE INSERT/UPDATE/DELETE trigger on
  `pga_entries`. Non-admin authenticated users get
  `P0001 PGA_ENTRY_LOCKED: ...` for reports older than 14 days (Nairobi date).
  Admins, service role, pg_cron and nested FK cascades are not affected.
- **Locks:** new table; CREATE TRIGGER on `pga_entries` (milliseconds).
- **Verify:**
  ```sql
  select * from app_settings;                         -- pga_edit_lock_days | 14
  select get_pga_lock_days(),
         is_pga_report_locked(current_date - 30),     -- true
         is_pga_report_locked(current_date);          -- false
  ```
  Then in the app as a FOB leader: editing last week's report works; editing a
  report from > 14 days ago shows an error.
- **Tuning without a migration:** an admin can change the window:
  `update app_settings set value = '21' where key = 'pga_edit_lock_days';`
- **Emergency off-switch (keeps everything else):**
  `alter table public.pga_entries disable trigger enforce_pga_entry_lock_trg;`
- **Rollback:**
  ```sql
  drop trigger if exists enforce_pga_entry_lock_trg on public.pga_entries;
  drop function if exists public.enforce_pga_entry_lock();
  drop function if exists public.is_pga_report_locked(date);
  drop function if exists public.get_pga_lock_days();
  drop table if exists public.app_settings;
  ```

### 20261004000500_add_pga_entries_range_checks.sql

- **Does:** 19 CHECK constraints `pga_entries_<column>_range`
  (`>= 0 and <= bound`, NULL allowed), added NOT VALID then VALIDATEd (only
  if no row violates; otherwise a NOTICE names the violators and the
  constraint stays NOT VALID but enforced for new writes). Violations raise
  SQLSTATE `23514`.
- **Locks:** ACCESS EXCLUSIVE on `pga_entries` from the first ADD CONSTRAINT
  until commit (the migration is one transaction): 19 scans of 8.8k rows,
  well under a second. Reads of `pga_entries` wait during that time.
- **Verify:**
  ```sql
  select conname, convalidated from pg_constraint
   where conrelid = 'public.pga_entries'::regclass and conname like '%\_range'
   order by 1;                                                            -- 19 rows, all true
  ```
- **Rollback:**
  ```sql
  do $$
  declare c text;
  begin
    for c in select conname from pg_constraint
             where conrelid = 'public.pga_entries'::regclass and conname like 'pga\_entries\_%\_range'
    loop
      execute format('alter table public.pga_entries drop constraint %I', c);
    end loop;
  end $$;
  ```

### 20261004000600_add_pga_analytics_rpcs.sql

- **Does:** SECURITY INVOKER, STABLE RPCs `get_pga_period_totals(date, date, text)`,
  `get_pga_trend(date, date, uuid, uuid, uuid)`, `get_missing_pga_entries(date)`.
  Existing RLS scopes the results per role. EXECUTE to authenticated/service_role only.
- **Locks:** none on tables.
- **Verify** (SQL editor runs as postgres = bypasses RLS = admin view):
  ```sql
  select * from get_pga_period_totals(current_date - 28, current_date, 'region');
  select report_date, entry_count, sv1 from get_pga_trend(current_date - 56, current_date);
  select count(*) from get_missing_pga_entries((select max(date) from pga_reports));
  -- cross-check one number with the existing view:
  select sv1 from pga_report_summary where date = (select max(date) from pga_reports);
  ```
- **Rollback:**
  ```sql
  drop function if exists public.get_missing_pga_entries(date);
  drop function if exists public.get_pga_trend(date, date, uuid, uuid, uuid);
  drop function if exists public.get_pga_period_totals(date, date, text);
  ```

## Step 3: post-rollout checks (prod, read-only)

1. Fingerprint after rollout must equal the local stack with all migrations:

   | category   | objects | md5                              |
   |------------|--------:|----------------------------------|
   | column     | 147     | 3602f11f5dcc1faf4c1ddb2cdf848159 |
   | constraint | 60      | 57d19c0c2614c1a879071f3f03c256b9 |
   | cron       | 1       | 1e73e44ba2196b33e3d70b28a0c78e67 |
   | extension  | 6       | 72398aaf682c4a2acd516151343c45a9 |
   | function   | 30      | 146832288c10af12d0d94e77ff911541 |
   | index      | 42      | 40b5056dd1f6b54e3d44b89e96764dd8 |
   | policy     | 42      | ef98f5645c36f171bea3a733500e24f1 |
   | relation   | 16      | ff7fe15777b0027738265a09a0493150 |
   | trigger    | 15      | 1d4cb87f2f2266e265acd1c64f42f7af |
   | view       | 3       | 43a0b9bb35d9a564d30bd34e289d2d81 |

   (If you ran the files through a tool that executes as a role other than
   `postgres`, `relation`/`function` may differ only by owner/ACL; inspect
   with `schema_fingerprint.sql`.)
2. Existing pages: dashboard, reports list, a report detail, four-week views,
   locations, team. Log in as a pastor and submit/view; as a FOB leader edit a
   report from this week.
3. Next Sunday after 00:00 UTC: `select * from pga_reports order by date desc limit 1;`
   (cron still creates the report) and
   `select * from pga_change_log where table_name = 'pga_reports' order by id desc limit 1;`
   (logged with `changed_by` null).
4. Supabase advisors (Dashboard -> Advisors): no new security warnings
   (functions all have `search_path` set; new tables have RLS).

## Behaviour changes the current app will see

- **Edit lock:** pastors, FOB leaders and managers can no longer
  insert/edit entries of reports older than 14 days. Production data: all
  7,509 historical inserts by non-admins (pastor 5,731, manager 1,135,
  FOB leader 643) happened within 8 days of the report date (p99 <= 5 days); edits since 2026-08-30 were within 3 days except
  one at 24 days (editor unknown). The old UI shows its generic error toast;
  the new UI maps `PGA_ENTRY_LOCKED:` to a friendly message.
- **Range checks:** values < 0 or above the per-metric bound fail with
  `23514` (old UI: generic error). No existing row is near a bound.
- **History:** `updated_at` behaviour is unchanged; `updated_by` and the
  change log are new and invisible to the old UI.
