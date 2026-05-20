CREATE TABLE tags_t (
  id          SERIAL       PRIMARY KEY,
  category    TEXT         NOT NULL,
  tag         TEXT         NOT NULL,
  created_ts  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_ts  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX tags_t_category_idx
  ON tags_t (category);

CREATE UNIQUE INDEX tags_t_tag_idx
  ON tags_t (lower(tag));

CREATE UNIQUE INDEX tags_t_category_tag_idx
  ON tags_t (lower(category), lower(tag));

CREATE TRIGGER tags_t_updated_ts_trg
  BEFORE UPDATE ON tags_t
  FOR EACH ROW EXECUTE FUNCTION set_updated_ts();