ALTER TABLE news_t
DROP COLUMN IF EXISTS rag_processed;

ALTER TABLE news_t
ADD COLUMN IF NOT EXISTS rag_status VARCHAR(20) NOT NULL DEFAULT 'NEW';

ALTER TABLE news_t
DROP CONSTRAINT IF EXISTS news_t_rag_status_chk,
ADD CONSTRAINT news_t_rag_status_chk CHECK (rag_status IN ('NEW', 'PROCESSING', 'DONE'));
