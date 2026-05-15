CREATE TABLE source_urls_t (
  id          SERIAL   PRIMARY KEY,
  source_id   INTEGER  NOT NULL,
  position    INTEGER  NOT NULL,
  url         TEXT     NOT NULL,
  description TEXT
);

CREATE INDEX source_urls_t_source_id_idx
  ON source_urls_t (source_id, position);
