CREATE TABLE news_tags_t (
  id          SERIAL       PRIMARY KEY,
  news_id     INTEGER      NOT NULL,
  tags_id     INTEGER      NOT NULL,
  created_ts  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_ts  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX news_tags_t_news_id_tags_id_idx
  ON news_tags_t (news_id, tags_id);

CREATE TRIGGER news_tags_t_updated_ts_trg
  BEFORE UPDATE ON news_tags_t
  FOR EACH ROW EXECUTE FUNCTION set_updated_ts();
