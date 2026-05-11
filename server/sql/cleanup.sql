-- Removes all application objects from the database.
-- Safe to run multiple times (all drops are IF EXISTS).
-- CASCADE handles FK constraints automatically.
--
-- Usage: psql "$DATABASE_URL" -f server/sql/cleanup.sql

-- ============================================================
-- Triggers (dropped implicitly by DROP TABLE CASCADE, but
-- listed explicitly for clarity and in case tables are kept)
-- ============================================================
DROP TRIGGER IF EXISTS notification_channels_t_updated_ts_trg  ON notification_channels_t;
DROP TRIGGER IF EXISTS notification_profiles_t_updated_ts_trg   ON notification_profiles_t;
DROP TRIGGER IF EXISTS error_t_updated_ts_trg                   ON error_t;
DROP TRIGGER IF EXISTS news_t_updated_ts_trg                    ON news_t;
DROP TRIGGER IF EXISTS rss_feeds_t_updated_ts_trg               ON rss_feeds_t;
DROP TRIGGER IF EXISTS profile_tags_t_updated_ts_trg            ON profile_tags_t;
DROP TRIGGER IF EXISTS profile_roles_t_updated_ts_trg           ON profile_roles_t;
DROP TRIGGER IF EXISTS profiles_t_updated_ts_trg                ON profiles_t;

-- ============================================================
-- Tables (CASCADE drops all indexes, constraints, and FKs)
-- Order: child tables first, then parent tables.
-- ============================================================
DROP TABLE IF EXISTS notification_channels_t  CASCADE;
DROP TABLE IF EXISTS notification_profiles_t  CASCADE;
DROP TABLE IF EXISTS error_t                  CASCADE;
DROP TABLE IF EXISTS news_t                   CASCADE;
DROP TABLE IF EXISTS rss_feeds_t              CASCADE;
DROP TABLE IF EXISTS profile_tags_t           CASCADE;
DROP TABLE IF EXISTS profile_roles_t          CASCADE;
DROP TABLE IF EXISTS profile_urls_t           CASCADE;
DROP TABLE IF EXISTS profiles_t               CASCADE;

-- ============================================================
-- Shared functions
-- ============================================================
DROP FUNCTION IF EXISTS set_updated_ts() CASCADE;
