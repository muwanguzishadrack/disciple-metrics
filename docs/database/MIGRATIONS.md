# Database migrations

## TL;DR

- `supabase/migrations/` is now the **complete** source of truth for the
  database. `supabase db reset` on a local stack rebuilds the production
  `public` schema exactly (verified: see "How the baseline was verified").
- `20261004000000_baseline_prod_schema.sql` is a squashed snapshot of
  production as of 2026-10-04. **It must never run on production** — production
  already has all of it. It is recorded there as applied with
  `supabase migration repair` (procedure below). It also refuses to run if
  `public.pga_entries` already exists, so an accidental push fails loudly and
  rolls back.
- The old, partial migration files moved to `supabase/migrations_archive/`
  (kept for history only; nothing reads that folder).
- New changes go in new files **after** the baseline
  (`supabase migration new <name>`), get tested locally with
  `supabase db reset && supabase test db`, and are rolled out with the
  procedure in [ROLLOUT.md](ROLLOUT.md).

## Why a baseline was needed

Before this change the repo could not rebuild the database: `pga_reports`,
`pga_entries`, `audit_logs`, the report views and RPCs, all RLS policies, the
triggers and the pg_cron job had been created directly on production (Supabase
MCP / dashboard) and were never committed. Production's migration history
(`supabase_migrations.schema_migrations`) has 45 versions, none of which match
the 9 files that were in the repo.

## Local workflow

```bash
supabase start                 # Docker; config in supabase/config.toml
supabase db reset              # baseline + migrations + supabase/seed.sql
supabase test db               # pgTAP tests in supabase/tests/database
supabase gen types typescript --local --schema public   # compare with types/supabase.ts
```

Local URLs: API `http://127.0.0.1:54321`, DB
`postgresql://postgres:postgres@127.0.0.1:54322/postgres`, Studio
`http://127.0.0.1:54323`. Seed users (local only) are listed at the top of
`supabase/seed.sql`.

`types/supabase.ts` is generated from the local stack and then re-adds the
`__InternalSupabase` block the hosted generator emits (see git history for
the exact diff; it must stay additive).

## One-time: align production's migration history (no schema change)

This only edits the bookkeeping table `supabase_migrations.schema_migrations`.
It does not run any SQL against `public`. Do it right before the first
`supabase db push`, e.g. as step 0 of [ROLLOUT.md](ROLLOUT.md).

1. Take a backup of the history table (SQL editor, or psql with the prod URL):

   ```sql
   create table supabase_migrations.schema_migrations_backup_20261004 as
   select * from supabase_migrations.schema_migrations;
   ```

2. Link the CLI to the project (the user does this; agents must not):

   ```bash
   supabase link --project-ref <project-ref>
   supabase migration list          # shows 45 remote-only + 7 local-only versions
   ```

3. Mark the 45 historical remote versions as reverted (this deletes their rows
   from the history table only; the schema they created stays), and the
   baseline as applied:

   ```bash
   supabase migration repair --status reverted \
     20260102121405 20260102134046 20260103131515 20260103131530 20260103131552 \
     20260103131612 20260103131628 20260103131645 20260103131716 20260103131817 \
     20260103131930 20260103132446 20260103140217 20260103141522 20260103151921 \
     20260103192502 20260103192602 20260103201550 20260104043101 20260104044852 \
     20260104050742 20260104053045 20260104085340 20260104090336 20260104090817 \
     20260121054544 20260121070126 20260121070134 20260121071256 20260121071310 \
     20260122131111 20260122212131 20260122212416 20260124064537 20260124071037 \
     20260129085830 20260228075940 20260228080018 20260228080625 20260726074859 \
     20260726080113 20260726082016 20260726084918 20260802043324 20260830044911

   supabase migration repair --status applied 20261004000000
   ```

4. Check: `supabase migration list` must show `20261004000000` on both sides
   and only the not-yet-applied new migrations as local-only.
   `supabase db push --dry-run` must list exactly those new files and **not**
   the baseline.

Why not keep the 45 rows? `supabase db push` refuses to run while the remote
history has versions that do not exist locally. The alternative (45 empty
placeholder files) would clutter the repo for no benefit; the backup table
from step 1 keeps the original history.

## How the baseline was verified

`supabase/scripts/schema_fingerprint.sql` is a read-only catalog query that
emits one md5 per object (columns incl. defaults/generated expressions/comments,
relations incl. RLS flags/ACLs/owners/reloptions, constraints incl.
`convalidated`, indexes, policies, function definitions + ACLs, views,
triggers incl. the `auth.users` trigger, pg_cron jobs, extensions).
`schema_fingerprint_summary.sql` aggregates that per category.

On 2026-10-04 the summary was identical on production (read-only query) and on
a local stack with only the baseline applied:

| category   | objects | md5                              |
|------------|--------:|----------------------------------|
| column     | 131     | 90ae5cd1354cf8aff00bc137d89a0a8c |
| constraint | 36      | afe260ad020bfcf16b5f0ff10e35a038 |
| cron       | 1       | 1e73e44ba2196b33e3d70b28a0c78e67 |
| extension  | 6       | 72398aaf682c4a2acd516151343c45a9 |
| function   | 15      | 09ef4efcb50d0a4d6774be01fdf88b98 |
| index      | 36      | 7482ddfc55b49234b91d2ac62b3737a0 |
| policy     | 39      | ff795ea1dc60087964e6cdd6cf2c1f68 |
| relation   | 13      | 2e2359d7506b439395688bca85021d5d |
| trigger    | 9       | a34e2b5c780cdd8f22579e060c975bc9 |
| view       | 3       | 43a0b9bb35d9a564d30bd34e289d2d81 |

Re-run it after any production change to detect drift:

```bash
# local
docker exec -i supabase_db_disciple-metrics psql -U postgres -X -A -t \
  < supabase/scripts/schema_fingerprint_summary.sql
# prod: paste schema_fingerprint_summary.sql into the SQL editor (read-only)
```

Note: column order inside tables may differ from production (production has
dropped columns). The fingerprint compares by name, which is what matters to
the app and to PostgREST.

## Rules for new migrations

- Never change production through the dashboard/MCP without committing the
  same SQL as a migration file. If it happens anyway, re-run the fingerprint
  and fold the drift into a new migration.
- Additive and backwards compatible: the deployed app must keep working when
  the DB ships first.
- Start each file with `set lock_timeout = '5s';` so a migration waits at most
  5 s for a lock instead of queueing behind long transactions (and blocking
  every later query on the table).
- Never write `pga_entries.salvations` (generated) and never re-derive
  `pga_entries.fob_id/region_id` (frozen snapshots).
- Add pgTAP tests in `supabase/tests/database/` and run `supabase test db`.
