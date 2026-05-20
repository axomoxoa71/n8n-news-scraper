CREATE TABLE news_t (
  id           SERIAL       PRIMARY KEY,
  news_id      TEXT         NOT NULL,
  source_id    INTEGER      NOT NULL,
  title        TEXT         NOT NULL,
  summary      TEXT         NOT NULL,
  sentiment    TEXT,
  image        TEXT,
  origin       TEXT,
  url          TEXT         NOT NULL,
  published_ts TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  favorite     BOOLEAN      NOT NULL DEFAULT FALSE,
  rag_status   VARCHAR(20)  NOT NULL DEFAULT 'NEW',
  rag_proc_guid TEXT,
  rag_error TEXT,
  categorization_status VARCHAR(20)  NOT NULL DEFAULT 'NEW',
  categorization_proc_guid TEXT,
  categorization_error TEXT,
  created_ts   TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_ts   TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT news_t_news_id_uk UNIQUE (news_id),
  CONSTRAINT news_t_rag_status_chk CHECK (rag_status IN ('NEW', 'PROCESSING', 'DONE', 'ERROR')),
  CONSTRAINT news_t_categorization_status_chk CHECK (categorization_status IN ('NEW', 'PROCESSING', 'DONE', 'ERROR'))
);

CREATE INDEX news_t_source_id_published_ts_idx
  ON news_t (source_id, published_ts DESC);

CREATE INDEX news_t_rag_status_idx
  ON news_t (rag_status);

CREATE INDEX news_t_categorization_status_idx
  ON news_t (categorization_status);

CREATE TRIGGER news_t_updated_ts_trg
  BEFORE UPDATE ON news_t
  FOR EACH ROW EXECUTE FUNCTION set_updated_ts();
