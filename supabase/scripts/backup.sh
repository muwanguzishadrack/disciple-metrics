#!/usr/bin/env bash
# Logical backup of a Supabase Postgres database (roles + schema + data).
#
# Usage:
#   SUPABASE_DB_URL='postgresql://postgres.<ref>:<password>@<pooler-host>:5432/postgres' \
#     supabase/scripts/backup.sh [output-dir]
#
#   - SUPABASE_DB_URL is required. Use the SESSION pooler (port 5432) or the
#     direct connection string from Dashboard -> Connect. Never commit it.
#   - output-dir defaults to $BACKUP_DIR or ~/disciple-metrics-backups.
#     Keep backups OUT of the git repo: data.sql contains personal data
#     (emails, password hashes in auth.users).
#
# Produces <output-dir>/<UTC timestamp>/:
#   roles.sql   custom roles (supabase db dump --role-only)
#   schema.sql  all non-system schemas (supabase db dump)
#   data.sql    all data incl. auth.users, as COPY (supabase db dump --data-only --use-copy)
#   cron.sql    pg_cron jobs (INSERTs; cron schema is not part of the dumps above)
#   SHA256SUMS  checksums
#
# Requires: Supabase CLI + Docker (supabase db dump runs pg_dump in a container).
# Optional: psql on PATH for the cron export (skipped otherwise).
# Read-only: only pg_dump / SELECT run against the database.
set -euo pipefail

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "SUPABASE_DB_URL is not set" >&2
  exit 1
fi

out_root="${1:-${BACKUP_DIR:-$HOME/disciple-metrics-backups}}"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
out="$out_root/$stamp"
mkdir -p "$out"
chmod 700 "$out_root" "$out" 2>/dev/null || true

echo "Backing up to $out"

supabase db dump --db-url "$SUPABASE_DB_URL" --role-only -f "$out/roles.sql"
supabase db dump --db-url "$SUPABASE_DB_URL" -f "$out/schema.sql"
supabase db dump --db-url "$SUPABASE_DB_URL" --data-only --use-copy -f "$out/data.sql"

if command -v psql >/dev/null 2>&1; then
  psql "$SUPABASE_DB_URL" -X -A -t -v ON_ERROR_STOP=1 -c "
    select format('select cron.schedule(%L, %L, %L);', jobname, schedule, command)
    from cron.job order by jobid" > "$out/cron.sql"
else
  echo "-- psql not available: cron jobs not exported (see supabase/migrations baseline)" > "$out/cron.sql"
fi

(cd "$out" && shasum -a 256 ./*.sql > SHA256SUMS)

for f in roles.sql schema.sql data.sql; do
  if [[ ! -s "$out/$f" ]]; then
    echo "ERROR: $f is empty" >&2
    exit 1
  fi
done

echo "Done:"
ls -lh "$out"
