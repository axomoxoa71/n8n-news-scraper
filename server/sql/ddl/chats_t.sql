-- Integration table for chatbot workflow persistence (n8n-facing).
-- UI clients access chat data only via backend API endpoints, not this table directly.
CREATE TABLE chats_t (
  id                  SERIAL       PRIMARY KEY,
  session_id          TEXT         NOT NULL,
  message             TEXT         NOT NULL,
  role                TEXT         NOT NULL,
  quality             INTEGER,
  event_ts            TIMESTAMPTZ,
  created_ts          TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for session correlation
CREATE INDEX chats_session_id_idx ON chats_t(session_id);

-- Check constraint for valid role values
ALTER TABLE chats_t ADD CONSTRAINT chats_role_chk
  CHECK (role IN ('assistant', 'user'));
