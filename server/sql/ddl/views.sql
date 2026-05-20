-- ---------------------------------------------------------------------------
-- news_aggr_v: aggregated view with array_agg for tags
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.news_aggr_v AS
SELECT
  news.id,
  news.news_id,
  news.source_id,
  source.name AS source_name,
  source.description AS source_description,
  news.title,
  news.summary,
  news.sentiment,
  news.image,
  news.origin,
  news.url,
  news.published_ts,
  news.favorite,
  news.rag_status,
  news.rag_proc_guid,
  news.rag_error,
  news.categorization_status,
  news.categorization_proc_guid,
  news.categorization_error,
  news.created_ts,
  news.updated_ts,
  COALESCE(
    array_agg(DISTINCT tags.tag) FILTER (WHERE tags.id IS NOT NULL),
    ARRAY[]::TEXT[]
  ) AS tags,
  COALESCE(
    array_agg(DISTINCT tags.category) FILTER (WHERE tags.id IS NOT NULL),
    ARRAY[]::TEXT[]
  ) AS tag_categories
FROM public.news_t AS news
LEFT JOIN public.sources_t AS source
  ON source.id = news.source_id
LEFT JOIN public.news_tags_t AS news_tags
  ON news_tags.news_id = news.id
LEFT JOIN public.tags_t AS tags
  ON tags.id = news_tags.tags_id
GROUP BY
  news.id,
  source.id;

-- ---------------------------------------------------------------------------
-- news_v: de-normalized flat view — one row per news + tag combination
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS public.news_v;
CREATE OR REPLACE VIEW public.news_v AS
SELECT
  news.id,
  news.news_id,
  news.source_id,
  source.name                    AS source_name,
  source.description             AS source_description,
  news.title,
  news.summary,
  news.sentiment,
  news.image,
  news.origin,
  news.url,
  news.published_ts,
  news.favorite,
  news.rag_status,
  news.rag_proc_guid,
  news.rag_error,
  news.categorization_status,
  news.categorization_proc_guid,
  news.categorization_error,
  news.created_ts,
  news.updated_ts,
  news_tags.id                   AS news_tag_id,
  news_tags.tags_id,
  tags.tag,
  tags.category                  AS tag_category
FROM public.news_t AS news
LEFT JOIN public.sources_t AS source
  ON source.id = news.source_id
LEFT JOIN public.news_tags_t AS news_tags
  ON news_tags.news_id = news.id
LEFT JOIN public.tags_t AS tags
  ON tags.id = news_tags.tags_id;

DROP VIEW IF EXISTS public.profile_v;

-- ---------------------------------------------------------------------------
-- profiles_aggr_v: aggregated view with array_agg / jsonb_agg for tags and channels
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.profiles_aggr_v AS
SELECT
  profile.id,
  profile.name,
  profile.description,
  profile.source_id,
  source.name AS source_name,
  source.description AS source_description,
  profile.use_custom_sources,
  profile.notification_profile_id,
  notification_profile.name AS notification_profile_name,
  profile.created_ts,
  profile.updated_ts,
  COALESCE(
    array_agg(DISTINCT tags.tag) FILTER (WHERE tags.id IS NOT NULL),
    ARRAY[]::TEXT[]
  ) AS tags,
  COALESCE(
    array_agg(DISTINCT tags.category) FILTER (WHERE tags.id IS NOT NULL),
    ARRAY[]::TEXT[]
  ) AS tag_categories,
  COALESCE(
    jsonb_agg(
      DISTINCT jsonb_build_object(
        'id', channel.id,
        'position', channel.position,
        'channel_type', channel.channel_type,
        'email_addresses', channel.email_addresses,
        'slack_webhook_url', channel.slack_webhook_url
      )
    ) FILTER (WHERE channel.id IS NOT NULL),
    '[]'::JSONB
  ) AS notification_channels
FROM public.profiles_t AS profile
LEFT JOIN public.sources_t AS source
  ON source.id = profile.source_id
LEFT JOIN public.profile_tags_t AS profile_tags
  ON profile_tags.profile_id = profile.id
LEFT JOIN public.tags_t AS tags
  ON tags.id = profile_tags.tags_id
LEFT JOIN public.notification_profiles_t AS notification_profile
  ON notification_profile.id = profile.notification_profile_id
LEFT JOIN public.notification_channels_t AS channel
  ON channel.notification_profile_id = notification_profile.id
GROUP BY
  profile.id,
  source.id,
  notification_profile.id;

-- ---------------------------------------------------------------------------
-- profiles_v: de-normalized flat view — one row per profile + tag + channel combination
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS public.profiles_v;
CREATE OR REPLACE VIEW public.profiles_v AS
SELECT
  profile.id,
  profile.name,
  profile.description,
  profile.source_id,
  source.name                        AS source_name,
  source.description                 AS source_description,
  profile.use_custom_sources,
  profile.notification_profile_id,
  notification_profile.name          AS notification_profile_name,
  profile.created_ts,
  profile.updated_ts,
  profile_tags.id                    AS profile_tag_id,
  profile_tags.tags_id,
  tags.tag,
  tags.category                      AS tag_category,
  channel.id                         AS channel_id,
  channel.position                   AS channel_position,
  channel.channel_type,
  channel.email_addresses,
  channel.slack_webhook_url
FROM public.profiles_t AS profile
LEFT JOIN public.sources_t AS source
  ON source.id = profile.source_id
LEFT JOIN public.profile_tags_t AS profile_tags
  ON profile_tags.profile_id = profile.id
LEFT JOIN public.tags_t AS tags
  ON tags.id = profile_tags.tags_id
LEFT JOIN public.notification_profiles_t AS notification_profile
  ON notification_profile.id = profile.notification_profile_id
LEFT JOIN public.notification_channels_t AS channel
  ON channel.notification_profile_id = notification_profile.id;