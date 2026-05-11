CREATE TABLE notification_profiles_t (
  id          SERIAL       PRIMARY KEY,
  name        TEXT         NOT NULL,
  description TEXT,
  created_ts  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_ts  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX notification_profiles_t_name_idx
  ON notification_profiles_t (name);
-- Trigger: keep updated_ts current on every UPDATE
CREATE TRIGGER notification_profiles_t_updated_ts_trg
  BEFORE UPDATE ON notification_profiles_t
  FOR EACH ROW EXECUTE FUNCTION set_updated_ts();
