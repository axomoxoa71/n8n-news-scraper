CREATE TABLE notification_channels_t (
  id                       SERIAL       PRIMARY KEY,
  notification_profile_id  INTEGER      NOT NULL,
  position                 INTEGER      NOT NULL,
  channel_type             TEXT         NOT NULL
    CONSTRAINT notification_channels_t_channel_type_chk CHECK (channel_type IN ('email', 'slack')),
  email_addresses          TEXT,
  slack_webhook_url        TEXT,
  json                     JSONB,
  created_ts               TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_ts               TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX notification_channels_t_profile_id_idx
  ON notification_channels_t (notification_profile_id, position);
-- Trigger: keep updated_ts current on every UPDATE
CREATE TRIGGER notification_channels_t_updated_ts_trg
  BEFORE UPDATE ON notification_channels_t
  FOR EACH ROW EXECUTE FUNCTION set_updated_ts();
