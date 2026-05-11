CREATE TABLE profile_tags_t (
  id          SERIAL       PRIMARY KEY,
  profile_id  INTEGER      NOT NULL,
  position    INTEGER      NOT NULL,
  tag_name    TEXT         NOT NULL,
  created_ts  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_ts  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX profile_tags_t_profile_id_idx
  ON profile_tags_t (profile_id, position);

CREATE UNIQUE INDEX profile_tags_t_profile_id_tag_name_idx
  ON profile_tags_t (profile_id, lower(tag_name));
-- Trigger: keep updated_ts current on every UPDATE
CREATE TRIGGER profile_tags_t_updated_ts_trg
  BEFORE UPDATE ON profile_tags_t
  FOR EACH ROW EXECUTE FUNCTION set_updated_ts();
