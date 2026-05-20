-- Master schema initialisation script.
-- For manual psql usage: psql "$DATABASE_URL" -f server/sql/init.sql
--
-- The application loads the split DDL/FK files directly via postgres-repository.mjs.
-- This file combines them in the correct order for convenience.
--
-- ============================================================
-- Shared functions
-- ============================================================
\i server/sql/ddl/00_functions.sql

-- ============================================================
-- DDL – one file per table (order matters: no FKs yet)
-- ============================================================
\i server/sql/ddl/profiles_t.sql
\i server/sql/ddl/sources_t.sql
\i server/sql/ddl/source_urls_t.sql
\i server/sql/ddl/source_rss_feeds_t.sql
\i server/sql/ddl/source_last_scrape_t.sql
\i server/sql/ddl/profile_urls_t.sql
\i server/sql/ddl/profile_roles_t.sql
\i server/sql/ddl/profile_tags_t.sql
\i server/sql/ddl/rss_feeds_t.sql
\i server/sql/ddl/error_t.sql
\i server/sql/ddl/news_t.sql
\i server/sql/ddl/news_tags_t.sql
\i server/sql/ddl/tags_t.sql
\i server/sql/ddl/notification_profiles_t.sql
\i server/sql/ddl/notification_channels_t.sql
\i server/sql/ddl/views.sql

-- ============================================================
-- Foreign keys
-- ============================================================
\i server/sql/fk/foreign_keys.sql

-- ============================================================
-- Initial reference data
-- ============================================================
\i server/sql/seed-tags.sql

-- Note: Legacy inline DDL has been removed.
-- Use the split files under server/sql/ddl and server/sql/fk as the single source of truth.