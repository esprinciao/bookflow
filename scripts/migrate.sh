#!/usr/bin/env bash
# Applies supabase/migrations/*.sql in filename order, once each.
#
# Tracked in a schema_migrations table so re-running is a no-op, and each file
# runs inside a single transaction — a migration that fails halfway leaves the
# database exactly as it was.
#
# Usage: SUPABASE_DB_URL=postgresql://... ./scripts/migrate.sh
set -euo pipefail

if [[ -z "${SUPABASE_DB_URL:-}" && -f .env.local ]]; then
  SUPABASE_DB_URL="$(grep -E '^SUPABASE_DB_URL=' .env.local | head -1 | cut -d= -f2-)"
fi
: "${SUPABASE_DB_URL:?set SUPABASE_DB_URL (see .env.example)}"

command -v psql >/dev/null || { echo "psql not found. brew install libpq" >&2; exit 1; }

psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -q -c \
  "create table if not exists public.schema_migrations (
     version    text primary key,
     applied_at timestamptz not null default now()
   );"

for file in supabase/migrations/*.sql; do
  version="$(basename "$file")"
  if [[ "$(psql "$SUPABASE_DB_URL" -tAc \
        "select 1 from public.schema_migrations where version = '$version'")" == "1" ]]; then
    echo "  skip   $version"
    continue
  fi
  echo "  apply  $version"
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 --single-transaction -q \
    -f "$file" \
    -c "insert into public.schema_migrations (version) values ('$version');"
done

echo "migrations up to date"
