-- All foreign key constraints for the schema.
-- Applied after all DDL files so that referenced tables already exist.
-- Each block is idempotent: skipped if the constraint already exists.

-- profile_urls_t -> profiles_t
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profile_urls_t_profile_id_fkey'
  ) THEN
    ALTER TABLE profile_urls_t
      ADD CONSTRAINT profile_urls_t_profile_id_fkey
        FOREIGN KEY (profile_id) REFERENCES profiles_t(id) ON DELETE CASCADE;
  END IF;
END $$;

-- source_urls_t -> sources_t
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'source_urls_t_source_id_fkey'
  ) THEN
    ALTER TABLE source_urls_t
      ADD CONSTRAINT source_urls_t_source_id_fkey
        FOREIGN KEY (source_id) REFERENCES sources_t(id) ON DELETE CASCADE;
  END IF;
END $$;

-- profile_tags_t -> profiles_t
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profile_tags_t_profile_id_fkey'
  ) THEN
    ALTER TABLE profile_tags_t
      ADD CONSTRAINT profile_tags_t_profile_id_fkey
        FOREIGN KEY (profile_id) REFERENCES profiles_t(id) ON DELETE CASCADE;
  END IF;
END $$;

-- source_rss_feeds_t -> sources_t
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'source_rss_feeds_t_source_id_fkey'
  ) THEN
    ALTER TABLE source_rss_feeds_t
      ADD CONSTRAINT source_rss_feeds_t_source_id_fkey
        FOREIGN KEY (source_id) REFERENCES sources_t(id) ON DELETE CASCADE;
  END IF;
END $$;

-- profile_roles_t -> profiles_t
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profile_roles_t_profile_id_fkey'
  ) THEN
    ALTER TABLE profile_roles_t
      ADD CONSTRAINT profile_roles_t_profile_id_fkey
        FOREIGN KEY (profile_id) REFERENCES profiles_t(id) ON DELETE CASCADE;
  END IF;
END $$;

-- profiles_t -> sources_t
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_t_source_id_fkey'
  ) THEN
    ALTER TABLE profiles_t
      ADD CONSTRAINT profiles_t_source_id_fkey
        FOREIGN KEY (source_id)
          REFERENCES sources_t(id) ON DELETE SET NULL;
  END IF;
END $$;

-- rss_feeds_t -> profiles_t
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rss_feeds_t_profile_id_fkey'
  ) THEN
    ALTER TABLE rss_feeds_t
      ADD CONSTRAINT rss_feeds_t_profile_id_fkey
        FOREIGN KEY (profile_id) REFERENCES profiles_t(id) ON DELETE CASCADE;
  END IF;
END $$;

-- news_t -> sources_t
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'news_t_source_id_fkey'
  ) THEN
    ALTER TABLE news_t
      ADD CONSTRAINT news_t_source_id_fkey
        FOREIGN KEY (source_id) REFERENCES sources_t(id) ON DELETE CASCADE;
  END IF;
END $$;

-- error_t -> profiles_t
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'error_t_profile_id_fkey'
  ) THEN
    ALTER TABLE error_t
      ADD CONSTRAINT error_t_profile_id_fkey
        FOREIGN KEY (profile_id) REFERENCES profiles_t(id) ON DELETE CASCADE;
  END IF;
END $$;

-- notification_channels_t -> notification_profiles_t
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'notification_channels_t_notification_profile_id_fkey'
  ) THEN
    ALTER TABLE notification_channels_t
      ADD CONSTRAINT notification_channels_t_notification_profile_id_fkey
        FOREIGN KEY (notification_profile_id)
          REFERENCES notification_profiles_t(id) ON DELETE CASCADE;
  END IF;
END $$;

-- profiles_t -> notification_profiles_t (optional link, set null on delete)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_t_notification_profile_id_fkey'
  ) THEN
    ALTER TABLE profiles_t
      ADD CONSTRAINT profiles_t_notification_profile_id_fkey
        FOREIGN KEY (notification_profile_id)
          REFERENCES notification_profiles_t(id) ON DELETE SET NULL;
  END IF;
END $$;

-- source_last_scrape_t -> sources_t
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'source_last_scrape_t_source_id_fkey'
  ) THEN
    ALTER TABLE source_last_scrape_t
      ADD CONSTRAINT source_last_scrape_t_source_id_fkey
        FOREIGN KEY (source_id) REFERENCES sources_t(id) ON DELETE CASCADE;
  END IF;
END $$;

