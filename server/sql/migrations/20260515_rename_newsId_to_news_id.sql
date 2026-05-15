ALTER TABLE news_t
  ADD COLUMN IF NOT EXISTS news_id UUID;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'news_t'
      AND column_name = 'newsId'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'news_t'
        AND column_name = 'news_id'
    ) THEN
      EXECUTE 'UPDATE news_t SET news_id = "newsId" WHERE news_id IS NULL';
      EXECUTE 'ALTER TABLE news_t DROP COLUMN "newsId"';
    ELSE
      EXECUTE 'ALTER TABLE news_t RENAME COLUMN "newsId" TO news_id';
    END IF;
  END IF;
END $$;

UPDATE news_t
SET news_id = (
  substr(md5(concat('news_t:', id::text, ':', profile_id::text, ':', coalesce(link, ''))), 1, 8) || '-' ||
  substr(md5(concat('news_t:', id::text, ':', profile_id::text, ':', coalesce(link, ''))), 9, 4) || '-' ||
  substr(md5(concat('news_t:', id::text, ':', profile_id::text, ':', coalesce(link, ''))), 13, 4) || '-' ||
  substr(md5(concat('news_t:', id::text, ':', profile_id::text, ':', coalesce(link, ''))), 17, 4) || '-' ||
  substr(md5(concat('news_t:', id::text, ':', profile_id::text, ':', coalesce(link, ''))), 21, 12)
)::uuid
WHERE news_id IS NULL;

ALTER TABLE news_t
  ALTER COLUMN news_id SET NOT NULL;

ALTER TABLE news_t
  DROP CONSTRAINT IF EXISTS news_t_newsId_uk;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'news_t_news_id_uk'
  ) THEN
    ALTER TABLE news_t
      ADD CONSTRAINT news_t_news_id_uk UNIQUE (news_id);
  END IF;
END $$;
