-- Removes all application objects from the database.
-- Safe to run multiple times (all drops are IF EXISTS).
-- CASCADE handles FK constraints automatically.
--
-- Usage: psql "$DATABASE_URL" -f server/sql/cleanup.sql

-- ============================================================
-- Triggers
-- Note: trigger drops are intentionally omitted because
-- DROP TRIGGER ... ON <table> fails when the table does not exist.
-- Tables are dropped with CASCADE below, which removes triggers too.
-- ============================================================

-- ============================================================
-- Tables (CASCADE drops all indexes, constraints, and FKs)
-- Order: child tables first, then parent tables.
-- ============================================================
DROP TABLE IF EXISTS notification_channels_t  CASCADE;
DROP TABLE IF EXISTS notification_profiles_t  CASCADE;
DROP TABLE IF EXISTS source_last_scrape_t     CASCADE;
DROP TABLE IF EXISTS source_rss_feeds_t       CASCADE;
DROP TABLE IF EXISTS source_urls_t            CASCADE;
DROP TABLE IF EXISTS sources_t                CASCADE;
DROP TABLE IF EXISTS chats_t                  CASCADE;
DROP TABLE IF EXISTS error_t                  CASCADE;
DROP TABLE IF EXISTS news_tags_t              CASCADE;
DROP TABLE IF EXISTS news_t                   CASCADE;
DROP TABLE IF EXISTS tags_t                   CASCADE;
DROP TABLE IF EXISTS rss_feeds_t              CASCADE;
DROP TABLE IF EXISTS profile_tags_t           CASCADE;
DROP TABLE IF EXISTS profile_roles_t          CASCADE;
DROP TABLE IF EXISTS profile_urls_t           CASCADE;
DROP TABLE IF EXISTS profiles_t               CASCADE;

-- ============================================================
-- Shared functions
-- ============================================================
DROP FUNCTION IF EXISTS set_updated_ts() CASCADE;
