#!/bin/bash
set -e

LOCAL_URL="postgresql://vega_user:vega_password@localhost:5432/vega_db"
SUPABASE_URL="postgresql://postgres:LKDQOxy08jhA0SR5@db.zabjsmufkktttksrtlfm.supabase.co:5432/postgres"
DUMP_FILE="local_data_$(date +%Y%m%d_%H%M%S).sql"

echo "→ Dumping local database..."
PGPASSWORD=vega_password /usr/local/opt/postgresql@15/bin/pg_dump \
  -U vega_user -h localhost -p 5432 -d vega_db \
  --data-only --no-owner --no-acl \
  -f "$DUMP_FILE"

echo "→ Dump saved to $DUMP_FILE"
echo "→ Restoring to Supabase..."

psql "$SUPABASE_URL" < "$DUMP_FILE"

echo "✓ Migration complete!"
