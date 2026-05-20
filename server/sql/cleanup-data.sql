-- Data-only cleanup script intentionally disabled by default.
-- This script is kept as a placeholder to preserve table data across normal operations.
-- Usage: psql "$DATABASE_URL" -f server/sql/cleanup-data.sql

DO $$
BEGIN
  RAISE NOTICE 'cleanup-data.sql is a no-op to avoid destructive data cleanup.';
END $$;
