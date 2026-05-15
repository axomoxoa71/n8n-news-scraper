ALTER TABLE news_t
  ALTER COLUMN news_id TYPE TEXT
  USING news_id::text;
