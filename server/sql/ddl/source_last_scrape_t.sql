CREATE TABLE source_last_scrape_t (
  id               SERIAL       PRIMARY KEY,
  source_id        INTEGER      NOT NULL,
  last_scrape_ts   TIMESTAMPTZ,
  created_ts       TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_ts       TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX source_last_scrape_t_source_id_idx
  ON source_last_scrape_t (source_id);

-- Trigger: keep updated_ts current on every UPDATE
CREATE TRIGGER source_last_scrape_t_updated_ts_trg
  BEFORE UPDATE ON source_last_scrape_t
  FOR EACH ROW EXECUTE FUNCTION set_updated_ts();
