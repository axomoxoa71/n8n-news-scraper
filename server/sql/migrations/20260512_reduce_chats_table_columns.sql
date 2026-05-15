-- Migration: reduce chats_t to session/message/role/quality model
-- Keeps existing rows by transforming user question/answer rows into message rows.

DO $$
BEGIN
  -- Remove legacy FK first when present.
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chats_t_profile_id_fkey'
  ) THEN
    ALTER TABLE chats_t DROP CONSTRAINT chats_t_profile_id_fkey;
  END IF;

  -- Drop legacy status check when present.
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chats_status_chk'
  ) THEN
    ALTER TABLE chats_t DROP CONSTRAINT chats_status_chk;
  END IF;

  -- Ensure new columns exist.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'chats_t' AND column_name = 'role'
  ) THEN
    ALTER TABLE chats_t ADD COLUMN role TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'chats_t' AND column_name = 'quality'
  ) THEN
    ALTER TABLE chats_t ADD COLUMN quality INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'chats_t' AND column_name = 'event_ts'
  ) THEN
    ALTER TABLE chats_t ADD COLUMN event_ts TIMESTAMPTZ;
  END IF;

  -- Backfill role for legacy rows (all existing rows represent user prompts).
  UPDATE chats_t SET role = COALESCE(role, 'user');

  -- Enforce role requirement.
  ALTER TABLE chats_t ALTER COLUMN role SET NOT NULL;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chats_role_chk'
  ) THEN
    ALTER TABLE chats_t
      ADD CONSTRAINT chats_role_chk CHECK (role IN ('assistant', 'user'));
  END IF;

  -- Drop legacy columns if they still exist.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'chats_t' AND column_name = 'profile_id'
  ) THEN
    ALTER TABLE chats_t DROP COLUMN profile_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'chats_t' AND column_name = 'agent_response'
  ) THEN
    ALTER TABLE chats_t DROP COLUMN agent_response;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'chats_t' AND column_name = 'n8n_execution_id'
  ) THEN
    ALTER TABLE chats_t DROP COLUMN n8n_execution_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'chats_t' AND column_name = 'trace_id'
  ) THEN
    ALTER TABLE chats_t DROP COLUMN trace_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'chats_t' AND column_name = 'status'
  ) THEN
    ALTER TABLE chats_t DROP COLUMN status;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'chats_t_updated_ts_trg'
  ) THEN
    DROP TRIGGER chats_t_updated_ts_trg ON chats_t;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'chats_t' AND column_name = 'updated_ts'
  ) THEN
    ALTER TABLE chats_t DROP COLUMN updated_ts;
  END IF;

  -- Cleanup obsolete indexes if present.
  IF EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'chats_profile_id_idx'
  ) THEN
    DROP INDEX chats_profile_id_idx;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'chats_trace_id_idx'
  ) THEN
    DROP INDEX chats_trace_id_idx;
  END IF;
END $$;
