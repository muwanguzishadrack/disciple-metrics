# Backups runbook

Production data (~240 locations, ~8.8k PGA entries, weekly reports since
January 2026) lives only in Supabase. This runbook covers what Supabase does
for us, the logical backups we take ourselves, and how to prove a backup can
be restored.

## 1. Check the Supabase dashboard (monthly, and before any risky change)

Dashboard -> project -> **Database -> Backups**:

| Check | Where | What good looks like |
|---|---|---|
| Plan | Organization -> Billing | Free plan has **no** downloadable backups. Pro (or higher) keeps 7 days of daily backups; Team 14; Enterprise up to 30. |
| Daily backups | Database -> Backups -> Scheduled backups | A backup for each of the last 7 days, latest < 24 h old. |
| PITR | Database -> Backups -> Point in time | Optional paid add-on (needs Small compute or larger). Restores to any second in the retention window. Recommended once the weekly report volume makes "lose up to 24 h" unacceptable (Sunday afternoons are the busy window). |
| Restore button | same page | Restoring a daily backup/PITR **replaces the whole project database** and causes downtime. Never use it to recover a single report: use the change log restore RPCs (below) instead. |

Daily/PITR backups are physical and live inside Supabase. If the project or
the organization is lost (billing, account access, accidental project
deletion) they are gone too, which is why we also keep logical dumps outside
Supabase.

## 2. Small mistakes: no backup needed

Since 2026-10 every insert/update/delete on `pga_entries` and `pga_reports` is
recorded in `pga_change_log` (deleted rows in full). Admins can:

- list deleted reports: `select * from get_deleted_pga_reports();`
- list individually deleted entries: `select * from get_deleted_pga_entries();`
- restore: `select restore_pga_report('<report uuid>');` /
  `select restore_pga_entry(<log id>);`
- see who changed what: `select * from get_pga_change_log(p_from => '2026-10-01');`

Wrong values that were overwritten can be read from `old_data` in
`pga_change_log` and typed back.

## 3. Logical backups: `supabase/scripts/backup.sh`

```bash
export SUPABASE_DB_URL='postgresql://postgres.<project-ref>:<db-password>@aws-0-<region>.pooler.supabase.com:5432/postgres'
supabase/scripts/backup.sh                 # -> ~/disciple-metrics-backups/<UTC timestamp>/
supabase/scripts/backup.sh /secure/disk    # or an explicit directory
```

- Take the URL from Dashboard -> Connect (session pooler, port 5432, or the
  direct connection). Keep the password in a password manager; never commit
  it or paste it into the repo.
- Needs the Supabase CLI and Docker (`supabase db dump` runs `pg_dump` in a
  container). `psql` on PATH is optional (exports the pg_cron jobs).
- Read-only: only `pg_dump` and a `SELECT` on `cron.job` run against the DB.
- Output: `roles.sql`, `schema.sql`, `data.sql` (COPY format, includes
  `auth.users` with emails and password hashes), `cron.sql`, `SHA256SUMS`.
- **The dump contains personal data.** Store it encrypted (e.g.
  `age -r <recipient> -o backup.tar.age <(tar -C <dir> -c .)`, an encrypted
  disk, or a private bucket with restricted access). Do not store it in the
  repo, chat tools or e-mail.

### Recommended cadence

| When | What |
|---|---|
| Every Monday (after the Sunday report is complete) | `backup.sh`, keep 8 weekly copies |
| 1st of each month | keep that week's copy for 12 months |
| Right before every production migration ([ROLLOUT.md](ROLLOUT.md)) | `backup.sh` + note the dashboard daily backup timestamp |
| Quarterly | Restore test (section 4) |

## 4. Test a restore into the local stack (quarterly)

Never restore into production to "test". Use the local Docker stack:

```bash
# 1. Fresh local DB with the same schema as prod (migrations only, no seed)
supabase start
supabase db reset --no-seed

# 2. Load the data. Run as supabase_admin (local superuser) so auth/storage
#    tables are writable; replica mode skips triggers and FK checks during load.
#    roles and app_settings rows come from the migrations, so clear them first.
docker cp ~/disciple-metrics-backups/<stamp>/data.sql supabase_db_disciple-metrics:/tmp/data.sql
docker exec supabase_db_disciple-metrics psql -U supabase_admin -d postgres -X -q \
  -v ON_ERROR_STOP=1 --single-transaction \
  -c "SET session_replication_role = replica" \
  -c "truncate public.roles, public.app_settings cascade" \
  -f /tmp/data.sql
docker exec supabase_db_disciple-metrics rm /tmp/data.sql

# 3. Verify counts against production (run the same SELECT read-only on prod)
docker exec supabase_db_disciple-metrics psql -U postgres -X -c "
  select (select count(*) from pga_reports) reports,
         (select count(*) from pga_entries) entries,
         (select count(*) from locations) locations,
         (select count(*) from profiles) profiles,
         (select max(date) from pga_reports) latest_report"

# 4. Optional: log in to the local app with a real account (local only) and
#    open the latest report. Then wipe the local data again:
supabase db reset
```

Tested on 2026-10-04 with a dump of the local seed: all 138 pgTAP assertions
passed on the restored database.

If step 2 fails on an `auth.*` table (the hosted auth schema can be newer than
the local CLI's), update the CLI (`brew upgrade supabase`) or restore only the
`public` schema: `supabase db dump --db-url "$SUPABASE_DB_URL" --data-only
--use-copy -s public -f public-data.sql` and load that instead (profiles then
reference auth users that do not exist locally; replica mode allows it).

## 5. Disaster recovery (production lost or corrupted)

1. Stop writes: put the app in maintenance (Vercel) or pause the project.
2. Prefer Supabase's own restore (daily backup or PITR) from the dashboard:
   fastest and keeps auth intact.
3. If the project is gone: create a new project, then
   ```bash
   psql "$NEW_DB_URL" --single-transaction -v ON_ERROR_STOP=1 \
     -f roles.sql -f schema.sql \
     -c 'SET session_replication_role = replica' -f data.sql
   psql "$NEW_DB_URL" -f cron.sql
   ```
   (or `supabase db push` the migrations and load only `data.sql`, as in the
   local test). Update `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   and `SUPABASE_SERVICE_ROLE_KEY` in Vercel and redeploy. Users keep their
   passwords (hashes are in `auth.users`).
4. Run `supabase/scripts/schema_fingerprint_summary.sql` and compare with
   [MIGRATIONS.md](MIGRATIONS.md) to confirm the schema.
