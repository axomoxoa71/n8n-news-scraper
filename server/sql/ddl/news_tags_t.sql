CREATE TABLE news_tags_t (
  id          SERIAL       PRIMARY KEY,
  news_id     INTEGER      NOT NULL,
  position    INTEGER      NOT NULL,
  tag         TEXT         NOT NULL,
  created_ts  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_ts  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX news_tags_t_news_id_idx
  ON news_tags_t (news_id, position);

CREATE UNIQUE INDEX news_tags_t_news_id_tag_idx
  ON news_tags_t (news_id, lower(tag));

CREATE TRIGGER news_tags_t_updated_ts_trg
  BEFORE UPDATE ON news_tags_t
  FOR EACH ROW EXECUTE FUNCTION set_updated_ts();
