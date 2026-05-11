-- Data-only cleanup script.
-- Removes all rows from application tables while preserving schema objects.
-- Usage: psql "$DATABASE_URL" -f server/sql/cleanup-data.sql

BEGIN;

TRUNCATE TABLE
  notification_channels_t,
  error_t,
  news_t,
  rss_feeds_t,
  profile_roles_t,
  profile_tags_t,
  profile_urls_t,
  profiles_t,
  notification_profiles_t
RESTART IDENTITY CASCADE;

COMMIT;
