ALTER TABLE news_t
  ADD COLUMN IF NOT EXISTS news_id UUID;

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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'news_t_news_id_uk'
  ) THEN
    ALTER TABLE news_t
      ADD CONSTRAINT news_t_news_id_uk UNIQUE (news_id);
  END IF;
END $$;