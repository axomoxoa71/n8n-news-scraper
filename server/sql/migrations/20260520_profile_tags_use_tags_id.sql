-- Normalize profile_tags_t to store tag references via tags_id (n:m profile<->tags).
ALTER TABLE profile_tags_t
  ADD COLUMN IF NOT EXISTS tags_id INTEGER;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'profile_tags_t'
      AND column_name = 'tag_name'
  ) THEN
    UPDATE profile_tags_t AS profile_tag
    SET tags_id = tags.id
    FROM tags_t AS tags
    WHERE profile_tag.tags_id IS NULL
      AND profile_tag.tag_name IS NOT NULL
      AND lower(tags.tag) = lower(profile_tag.tag_name);
  END IF;
END $$;

DELETE FROM profile_tags_t
WHERE tags_id IS NULL;

ALTER TABLE profile_tags_t
  ALTER COLUMN tags_id SET NOT NULL;

DROP INDEX IF EXISTS profile_tags_t_profile_id_tag_name_idx;

CREATE UNIQUE INDEX IF NOT EXISTS profile_tags_t_profile_id_tags_id_idx
  ON profile_tags_t(profile_id, tags_id);

ALTER TABLE profile_tags_t
  DROP COLUMN IF EXISTS tag_name;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profile_tags_t_tags_id_fkey'
  ) THEN
    ALTER TABLE profile_tags_t
      ADD CONSTRAINT profile_tags_t_tags_id_fkey
        FOREIGN KEY (tags_id) REFERENCES tags_t(id) ON DELETE CASCADE;
  END IF;
END $$;
