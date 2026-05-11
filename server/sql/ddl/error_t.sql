CREATE TABLE error_t (
  id                SERIAL       PRIMARY KEY,
  profile_id        INTEGER      NOT NULL,
  trace_id          TEXT         NOT NULL,
  instance_id       TEXT         NOT NULL,
  error_message     TEXT         NOT NULL,
  error_description TEXT,
  error_stack       TEXT,
  error_http_code   INTEGER,
  node_name         TEXT         NOT NULL,
  node_type         TEXT         NOT NULL,
  workflow_name     TEXT         NOT NULL,
  workflow_id       TEXT         NOT NULL,
  json              JSONB        DEFAULT '{}'::jsonb,
  created_ts        TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_ts        TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT error_t_error_http_code_chk
    CHECK (error_http_code IS NULL OR (error_http_code >= 100 AND error_http_code <= 999))
);

CREATE INDEX error_t_profile_id_created_ts_idx
  ON error_t (profile_id, created_ts DESC);

CREATE TRIGGER error_t_updated_ts_trg
  BEFORE UPDATE ON error_t
  FOR EACH ROW EXECUTE FUNCTION set_updated_ts();
