CREATE TABLE rss_feeds_t (
  id               SERIAL       PRIMARY KEY,
  profile_id       INTEGER      NOT NULL,
  position         INTEGER      NOT NULL,
  feed_url         TEXT         NOT NULL,
  title            TEXT,
  refresh_cadence  TEXT         NOT NULL,
  format           TEXT         NOT NULL,
  category         TEXT,
  created_ts       TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_ts       TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX rss_feeds_t_profile_id_idx
  ON rss_feeds_t (profile_id, position);
-- Trigger: keep updated_ts current on every UPDATE
CREATE TRIGGER rss_feeds_t_updated_ts_trg
  BEFORE UPDATE ON rss_feeds_t
  FOR EACH ROW EXECUTE FUNCTION set_updated_ts();
