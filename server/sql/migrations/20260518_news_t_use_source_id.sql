BEGIN;

ALTER TABLE news_t
  ADD COLUMN IF NOT EXISTS source_id INTEGER;

-- Backfill from profile -> source linkage for existing rows.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'news_t'
      AND column_name = 'profile_id'
  ) THEN
    UPDATE news_t AS news
    SET source_id = profile_row.source_id
    FROM profiles_t AS profile_row
    WHERE news.source_id IS NULL
      AND news.profile_id = profile_row.id
      AND profile_row.source_id IS NOT NULL;
  END IF;
END $$;

ALTER TABLE news_t
  ALTER COLUMN source_id SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'news_t_profile_id_fkey'
  ) THEN
    ALTER TABLE news_t DROP CONSTRAINT news_t_profile_id_fkey;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'news_t_source_id_fkey'
  ) THEN
    ALTER TABLE news_t
      ADD CONSTRAINT news_t_source_id_fkey
        FOREIGN KEY (source_id) REFERENCES sources_t(id) ON DELETE CASCADE;
  END IF;
END $$;

DROP INDEX IF EXISTS news_t_profile_id_published_ts_idx;
CREATE INDEX IF NOT EXISTS news_t_source_id_published_ts_idx
  ON news_t (source_id, published_ts DESC);

ALTER TABLE news_t DROP COLUMN IF EXISTS profile_id;

COMMIT;
