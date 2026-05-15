-- Migration: rename chats_t.user_question to chats_t.message
-- Apply once on existing databases that still use the legacy column name.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'chats_t'
      AND column_name = 'user_question'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'chats_t'
      AND column_name = 'message'
  ) THEN
    ALTER TABLE chats_t RENAME COLUMN user_question TO message;
  END IF;
END $$;
