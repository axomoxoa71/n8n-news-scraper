CREATE TABLE profile_urls_t (
  id          SERIAL   PRIMARY KEY,
  profile_id  INTEGER  NOT NULL,
  position    INTEGER  NOT NULL,
  url         TEXT     NOT NULL,
  description TEXT
);

CREATE INDEX profile_urls_t_profile_id_idx
  ON profile_urls_t (profile_id, position);
