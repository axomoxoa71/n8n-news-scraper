CREATE TABLE profile_roles_t (
  id          SERIAL       PRIMARY KEY,
  profile_id  INTEGER      NOT NULL,
  position    INTEGER      NOT NULL,
  role_name   TEXT         NOT NULL,
  created_ts  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_ts  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX profile_roles_t_profile_id_idx
  ON profile_roles_t (profile_id, position);

CREATE UNIQUE INDEX profile_roles_t_profile_id_role_name_idx
  ON profile_roles_t (profile_id, lower(role_name));

CREATE TRIGGER profile_roles_t_updated_ts_trg
  BEFORE UPDATE ON profile_roles_t
  FOR EACH ROW EXECUTE FUNCTION set_updated_ts();
