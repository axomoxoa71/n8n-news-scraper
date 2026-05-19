CREATE TABLE error_t (
  id                SERIAL       PRIMARY KEY,
  external_ref_id   TEXT,
  external_ref_type TEXT,
  external_ref_name TEXT,
  trace_id          TEXT,
  execution_id      TEXT,
  error_message     TEXT         NOT NULL,
  error_details     TEXT,
  error_stack       TEXT,
  error_http_code   INTEGER,
  node_name         TEXT,
  node_type         TEXT,
  workflow_name     TEXT,
  workflow_id       TEXT         NOT NULL,
  json              JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_ts        TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_ts        TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT error_t_error_http_code_chk
    CHECK (error_http_code IS NULL OR (error_http_code >= 100 AND error_http_code <= 999))
);

CREATE INDEX error_t_created_ts_idx
  ON error_t (created_ts DESC);

CREATE TRIGGER error_t_updated_ts_trg
  BEFORE UPDATE ON error_t
  FOR EACH ROW EXECUTE FUNCTION set_updated_ts();
