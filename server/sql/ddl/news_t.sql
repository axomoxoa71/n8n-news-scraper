CREATE TABLE news_t (
  id           SERIAL       PRIMARY KEY,
  news_id      TEXT         NOT NULL,
  source_id    INTEGER      NOT NULL,
  title        TEXT         NOT NULL,
  summary      TEXT         NOT NULL,
  origin       TEXT,
  link         TEXT         NOT NULL,
  published_ts TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  favorite     BOOLEAN      NOT NULL DEFAULT FALSE,
  created_ts   TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_ts   TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT news_t_news_id_uk UNIQUE (news_id)
);

CREATE INDEX news_t_source_id_published_ts_idx
  ON news_t (source_id, published_ts DESC);

CREATE TRIGGER news_t_updated_ts_trg
  BEFORE UPDATE ON news_t
  FOR EACH ROW EXECUTE FUNCTION set_updated_ts();
