CREATE TABLE source_rss_feeds_t (
  id         SERIAL       PRIMARY KEY,
  source_id  INTEGER      NOT NULL,
  position   INTEGER      NOT NULL,
  feed_url   TEXT         NOT NULL,
  description TEXT,
  created_ts TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_ts TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX source_rss_feeds_t_source_id_idx
  ON source_rss_feeds_t (source_id, position);

-- Trigger: keep updated_ts current on every UPDATE
CREATE TRIGGER source_rss_feeds_t_updated_ts_trg
  BEFORE UPDATE ON source_rss_feeds_t
  FOR EACH ROW EXECUTE FUNCTION set_updated_ts();
