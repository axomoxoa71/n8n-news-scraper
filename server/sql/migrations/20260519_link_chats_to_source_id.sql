-- Link chat persistence to sources (not profiles).
-- Keeps compatibility by backfilling from legacy profile_id when present.

ALTER TABLE chats_t
  ADD COLUMN IF NOT EXISTS source_id INTEGER REFERENCES sources_t(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'chats_t'
      AND column_name = 'profile_id'
  ) THEN
    UPDATE chats_t AS chats
    SET source_id = profiles.source_id
    FROM profiles_t AS profiles
    WHERE chats.source_id IS NULL
      AND chats.profile_id IS NOT NULL
      AND profiles.id = chats.profile_id;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS chats_source_id_idx ON chats_t(source_id);
