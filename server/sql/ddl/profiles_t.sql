CREATE TABLE profiles_t (
  id                       SERIAL       PRIMARY KEY,
  name                     TEXT         NOT NULL,
  description              TEXT,
  use_custom_sources       BOOLEAN      NOT NULL DEFAULT FALSE,
  json                     JSONB,
  notification_profile_id  INTEGER,
  created_ts               TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_ts               TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Trigger: keep updated_ts current on every UPDATE
CREATE TRIGGER profiles_t_updated_ts_trg
  BEFORE UPDATE ON profiles_t
  FOR EACH ROW EXECUTE FUNCTION set_updated_ts();
