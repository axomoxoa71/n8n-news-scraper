DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'news_t'
      AND column_name = 'link'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'news_t'
      AND column_name = 'url'
  ) THEN
    EXECUTE 'ALTER TABLE news_t RENAME COLUMN link TO url';
  END IF;
END $$;
