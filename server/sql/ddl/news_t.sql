CREATE TABLE news_t (
  id           SERIAL       PRIMARY KEY,
  profile_id   INTEGER      NOT NULL,
  title        TEXT         NOT NULL,
  summary      TEXT         NOT NULL,
  origin       TEXT         NOT NULL,
  link         TEXT         NOT NULL,
  published_ts TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  favorite     BOOLEAN      NOT NULL DEFAULT FALSE,
  created_ts   TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_ts   TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX news_t_profile_id_published_ts_idx
  ON news_t (profile_id, published_ts DESC);

CREATE TRIGGER news_t_updated_ts_trg
  BEFORE UPDATE ON news_t
  FOR EACH ROW EXECUTE FUNCTION set_updated_ts();
