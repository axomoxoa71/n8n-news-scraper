CREATE TABLE sources_t (
  id          SERIAL       PRIMARY KEY,
  name        TEXT         NOT NULL,
  description TEXT,
  json        JSONB,
  created_ts  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_ts  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX sources_t_name_idx
  ON sources_t (name);

-- Trigger: keep updated_ts current on every UPDATE
CREATE TRIGGER sources_t_updated_ts_trg
  BEFORE UPDATE ON sources_t
  FOR EACH ROW EXECUTE FUNCTION set_updated_ts();
