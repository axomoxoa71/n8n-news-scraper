-- Remove ordering column from profile_tags_t to keep it as pure n:m relation.
DROP INDEX IF EXISTS profile_tags_t_profile_id_idx;

ALTER TABLE profile_tags_t
  DROP COLUMN IF EXISTS position;

CREATE INDEX IF NOT EXISTS profile_tags_t_profile_id_idx
  ON profile_tags_t (profile_id);
