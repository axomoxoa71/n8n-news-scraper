-- Add profile_id to chats_t so chat history can be queried by profile
-- without relying on an in-memory session map that resets on server restart.
ALTER TABLE chats_t
  ADD COLUMN IF NOT EXISTS profile_id INTEGER REFERENCES profiles_t(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS chats_profile_id_idx ON chats_t(profile_id);
