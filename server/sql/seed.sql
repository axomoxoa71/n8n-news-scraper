-- Appends a local baseline without clearing existing data.
-- Includes a dedicated Error Test Profile for profile-switching UI tests.
-- Usage: psql "$DATABASE_URL" -f server/sql/seed.sql

BEGIN;

\i server/sql/seed-tags.sql

-- 3 notification profiles
INSERT INTO notification_profiles_t (name, description)
VALUES
  ('AI Demo', 'AI Demo notification channel for development.'),
  ('Slack Alerts', 'Primary Slack webhook delivery channel.'),
  ('Ops Alerts', 'Operations-focused notification channel.');

-- notification channel rows
INSERT INTO notification_channels_t (
  notification_profile_id,
  position,
  channel_type,
  email_addresses,
  slack_webhook_url,
  json
)
VALUES
  (1, 0, 'email', '["robert.bernhard71@gmail.com"]', NULL, jsonb_build_object('channelType', 'email', 'emailAddresses', '["robert.bernhard71@gmail.com"]'::jsonb)),
  (2, 0, 'slack', NULL, 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXX', jsonb_build_object('channelType', 'slack', 'slackWebhookUrl', 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXX')),
  (2, 1, 'email', '["slack-backup@example.com"]', NULL, jsonb_build_object('channelType', 'email', 'emailAddresses', '["slack-backup@example.com"]'::jsonb)),
  (3, 0, 'email', '["ops@example.com"]', NULL, jsonb_build_object('channelType', 'email', 'emailAddresses', '["ops@example.com"]'::jsonb)),
  (3, 1, 'email', '["ops-oncall@example.com"]', NULL, jsonb_build_object('channelType', 'email', 'emailAddresses', '["ops-oncall@example.com"]'::jsonb));

-- 4 sources (AI Demo + additional profiles)
INSERT INTO sources_t (name, description)
VALUES
  ('AI Demo', 'A source for AI news demonstration.'),
  ('Agent Ecosystem Source', 'Agent and orchestration focused sources.'),
  ('Model Releases Source', 'Model and API release focused sources.'),
  ('Error Test Source', 'Deterministic source set for error profile testing.');

-- 10 source URLs (AI Demo has 1 URL, other sources have 3 URLs each)
INSERT INTO source_urls_t (source_id, position, url, description)
VALUES
  (1, 0, 'https://ai.meta.com/blog/', 'Meta AI Blog'),
  (2, 0, 'https://www.technologyreview.com/topic/artificial-intelligence/', 'MIT Technology Review AI'),
  (2, 1, 'https://venturebeat.com/category/ai/', 'Enterprise AI product coverage'),
  (2, 2, 'https://www.theregister.com/machine_learning/', 'Industry agent tooling updates'),
  (3, 0, 'https://openai.com/news/', 'OpenAI announcements'),
  (3, 1, 'https://ai.googleblog.com/', 'Google AI announcements'),
  (3, 2, 'https://www.anthropic.com/news', 'Anthropic product and policy updates'),
  (4, 0, 'https://status.openai.com/', 'Provider status updates'),
  (4, 1, 'https://www.githubstatus.com/', 'GitHub status and incident updates'),
  (4, 2, 'https://status.slack.com/', 'Slack status and incident updates');

-- 12 source RSS feeds (3 per source)
INSERT INTO source_rss_feeds_t (
  source_id,
  position,
  feed_url,
  description
)
VALUES
  (1, 0, 'https://openai.com/news/rss.xml', 'OpenAI News RSS'),
  (1, 1, 'https://huggingface.co/blog/feed.xml', 'Hugging Face Blog RSS'),
    (1, 2, 'https://github.com/axomoxoa71/news-scrapper/blob/main/news/ai-news.opml', 'AI News OPML'),
  (2, 0, 'https://feeds.feedburner.com/oreilly/radar/atom', 'OReilly Radar RSS'),
  (2, 1, 'https://venturebeat.com/category/ai/feed/', 'VentureBeat AI RSS'),
  (2, 2, 'https://www.theregister.com/machine_learning/headlines.atom', 'The Register ML RSS'),
  (3, 0, 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', 'The Verge AI RSS'),
  (3, 1, 'https://openai.com/news/rss.xml', 'OpenAI News RSS'),
  (3, 2, 'https://www.anthropic.com/news/rss.xml', 'Anthropic News RSS'),
  (4, 0, 'https://status.openai.com/history.rss', 'OpenAI Status RSS'),
  (4, 1, 'https://www.githubstatus.com/history.rss', 'GitHub Status RSS'),
  (4, 2, 'https://status.slack.com/feed/rss', 'Slack Status RSS');

-- 4 profiles (including Error Test Profile for switching/error visibility tests)
INSERT INTO profiles_t (
  name,
  description,
  source_id,
  use_custom_sources,
  notification_profile_id,
  json
)
VALUES
  (
    'AI Demo',
    'A profile AI news demonstration',
    1,
    TRUE,
    1,
    NULL
  ),
  (
    'Agent Ecosystem',
    'Autonomous agents and tooling updates.',
    2,
    TRUE,
    2,
    NULL
  ),
  (
    'Model Releases',
    'Provider model and API release notes.',
    3,
    TRUE,
    3,
    NULL
  ),
  (
    'Error Test Profile',
    'Dedicated profile for error indicator and profile switching tests.',
    4,
    TRUE,
    1,
    NULL
  );

-- profile tags (8 for profile 1, 3 each for profiles 2-4)
WITH profile_tag_seed(profile_id, tag_name) AS (
  VALUES
    (1, 'llm'),
    (1, 'openai'),
    (1, 'claude'),
    (1, 'anthropic'),
    (1, 'meta'),
    (1, 'agentic AI'),
    (1, 'MCP'),
    (1, 'RAG'),
    (2, 'agents'),
    (2, 'orchestration'),
    (2, 'automation'),
    (3, 'releases'),
    (3, 'api'),
    (3, 'changelog'),
    (4, 'errors'),
    (4, 'switching'),
    (4, 'ui-test')
)
INSERT INTO profile_tags_t (profile_id, tags_id)
SELECT seed.profile_id, tags.id
FROM profile_tag_seed AS seed
INNER JOIN tags_t AS tags
  ON lower(tags.tag) = lower(seed.tag_name);

-- profile roles (2 for profile 1, 3 each for profiles 2-4)
INSERT INTO profile_roles_t (profile_id, position, role_name)
VALUES
  (1, 0, 'Solution Architect'),
  (1, 1, 'Software Engineer'),
  (1, 2, 'Product Manager'),
  (2, 0, 'Architect'),
  (2, 1, 'Engineering Manager'),
  (2, 2, 'Product Manager'),
  (3, 0, 'CTO'),
  (3, 1, 'CIO'),
  (3, 2, 'Security Lead'),
  (4, 0, 'QA Engineer'),
  (4, 1, 'SRE'),
  (4, 2, 'Platform Engineer');


-- 9 news rows (3 each for sources 2-4; AI Demo source 1 intentionally empty)
INSERT INTO news_t (
  news_id,
  source_id,
  title,
  summary,
  origin,
  url,
  published_ts,
  favorite
)
SELECT
  encode(digest(seed_item.url || seed_item.title, 'sha256'), 'hex'),
  seed_item.source_id,
  seed_item.title,
  seed_item.summary,
  seed_item.origin,
  seed_item.url,
  CURRENT_TIMESTAMP - seed_item.age_interval,
  seed_item.favorite
FROM (
  VALUES
    (
      2,
      'Model release improves long-context reasoning',
      'Vendors report measurable reductions in retrieval failures on long-context prompts.',
      'Applied AI Journal',
      'https://example.com/news/long-context',
      INTERVAL '2 hours',
      TRUE
    ),
    (
      2,
      'Agent framework adds human approval checkpoints',
      'The latest agent orchestration release adds configurable approval gates before high-impact actions.',
      'Agent Platform Review',
      'https://example.com/news/approval-checkpoints',
      INTERVAL '4 hours',
      FALSE
    ),
    (
      2,
      'Tool-using agents improve task recovery rates',
      'A new evaluation shows better retry behavior and reduced failure loops in multi-step workflows.',
      'Workflow Systems Weekly',
      'https://example.com/news/task-recovery',
      INTERVAL '7 hours',
      TRUE
    ),
    (
      3,
      'Vector stores add temporal query controls',
      'New temporal filtering features improve freshness for production RAG workloads.',
      'Data Infra Digest',
      'https://example.com/news/vector-temporal',
      INTERVAL '5 hours',
      FALSE
    ),
    (
      3,
      'Model provider ships new API version',
      'Release notes include upgraded reasoning modes, response formatting controls, and migration guidance.',
      'API Release Tracker',
      'https://example.com/news/api-version',
      INTERVAL '8 hours',
      TRUE
    ),
    (
      3,
      'Safety update tightens moderation defaults',
      'Provider defaults now include stricter policy presets and clearer override documentation.',
      'Provider Change Log',
      'https://example.com/news/moderation-defaults',
      INTERVAL '11 hours',
      FALSE
    ),
    (
      4,
      'Synthetic error-run baseline generated',
      'A deterministic error-seed scenario was generated to validate profile switching behavior in the UI.',
      'QA Seed Runner',
      'https://example.com/news/error-seed-baseline',
      INTERVAL '20 minutes',
      FALSE
    ),
    (
      4,
      'Workflow retry path exercised',
      'Test harness intentionally triggered retry paths to validate error visibility per selected profile.',
      'Integration Test Digest',
      'https://example.com/news/workflow-retry-test',
      INTERVAL '70 minutes',
      TRUE
    ),
    (
      4,
      'Error indicator switching validated',
      'UI switching across profiles correctly adapted error count and button visibility in latest run.',
      'UI Validation Notes',
      'https://example.com/news/error-indicator-switching',
      INTERVAL '5 hours',
      FALSE
    )
) AS seed_item(source_id, title, summary, origin, url, age_interval, favorite);

INSERT INTO news_tags_t (news_id, tags_id)
WITH ordered_news AS (
  SELECT
    news_row.id,
    news_row.url
  FROM news_t AS news_row
),
ordered_tags AS (
  SELECT
    tag_row.id,
    ROW_NUMBER() OVER (
      ORDER BY lower(tag_row.category), lower(tag_row.tag), tag_row.id
    ) - 1 AS tag_pos,
    COUNT(*) OVER () AS tag_count
  FROM tags_t AS tag_row
  WHERE lower(tag_row.category) = 'news'
)
SELECT
  news_row.id,
  candidate_tag.id
FROM ordered_news AS news_row
JOIN LATERAL (
  SELECT DISTINCT tag_choice.id, tag_choice.tag_pos
  FROM ordered_tags AS tag_choice
  WHERE tag_choice.tag_count > 0
    AND tag_choice.tag_pos IN (
      MOD(ABS(hashtext(news_row.url)), tag_choice.tag_count),
      MOD(ABS(hashtext(news_row.url)) + 1, tag_choice.tag_count)
    )
  ORDER BY tag_choice.tag_pos
  LIMIT 2
) AS candidate_tag ON TRUE;

-- 3 error rows for Error Test Profile source (profile-switching test baseline)
INSERT INTO error_t (
  external_ref_id,
  external_ref_type,
  external_ref_name,
  trace_id,
  execution_id,
  error_message,
  error_details,
  error_stack,
  error_http_code,
  node_name,
  node_type,
  workflow_name,
  workflow_id,
  json
)
VALUES
  (
    '4',
    'source',
    'Error Test Profile',
    'e4e4f6dd2df74f34b7746e72e5f67011',
    'exec-seed-001',
    'Synthetic switching test error',
    'Intentional seeded error used to verify profile switching and error indicator behavior in the UI.',
    'Error: seeded switching test failure at simulateSwitchingScenario (workflow.js:21:5)',
    500,
    'Switching Test Node',
    'code',
    'news-scrape-workflow',
    'wf-error-test-004',
    jsonb_build_object('phase', 'test', 'seedType', 'switching')
  ),
  (
    '4',
    'source',
    'Error Test Profile',
    'e4e4f6dd2df74f34b7746e72e5f67012',
    'exec-seed-002',
    'Synthetic payload parse failure',
    'Intentional seeded payload parsing failure used for modal stack/json viewer tests.',
    'SyntaxError: Unexpected end of JSON input at parsePayload (workflow.js:57:13)',
    500,
    'Parse Payload',
    'code',
    'news-scrape-workflow',
    'wf-error-test-005',
    jsonb_build_object('phase', 'parse', 'seedType', 'switching')
  ),
  (
    '4',
    'source',
    'Error Test Profile',
    'e4e4f6dd2df74f34b7746e72e5f67013',
    'exec-seed-003',
    'Synthetic downstream timeout',
    'Intentional seeded downstream timeout used for profile-specific error count verification.',
    'TimeoutError: downstream request exceeded 10s timeout at dispatchResult (workflow.js:142:7)',
    504,
    'Dispatch Result',
    'httpRequest',
    'news-scrape-workflow',
    'wf-error-test-006',
    jsonb_build_object('phase', 'dispatch', 'seedType', 'switching')
  );

-- Add id to notification_channels_t JSON snapshots
UPDATE notification_channels_t AS ch
SET json = ch.json || jsonb_build_object('id', ch.id);

-- Rebuild normalized JSON snapshots in sources_t
UPDATE sources_t AS source
SET json = jsonb_build_object(
  'id', source.id,
  'name', source.name,
  'description', COALESCE(source.description, ''),
  'urls', COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'url', url_row.url,
          'description', COALESCE(url_row.description, '')
        )
        ORDER BY url_row.position, url_row.id
      )
      FROM source_urls_t AS url_row
      WHERE url_row.source_id = source.id
    ),
    '[]'::jsonb
  ),
  'rssFeeds', COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'feedUrl', rss_row.feed_url,
          'description', COALESCE(rss_row.description, '')
        )
        ORDER BY rss_row.position, rss_row.id
      )
      FROM source_rss_feeds_t AS rss_row
      WHERE rss_row.source_id = source.id
    ),
    '[]'::jsonb
  )
);

-- Rebuild normalized JSON snapshots in profiles_t
UPDATE profiles_t AS profile
SET json = jsonb_build_object(
  'id', profile.id,
  'name', profile.name,
  'description', COALESCE(profile.description, ''),
  'systemPrompt', CASE
    WHEN profile.name = 'AI Demo' THEN 'You are an AI news assistant who focuses on news related to the tags and for the roles provided in this profile. You provide concise and informative summaries of the latest developments in the AI field, tailored to the interests of the users linked to this profile.'
    WHEN profile.name = 'Agent Ecosystem' THEN 'Focus on agent ecosystems and orchestration.'
    WHEN profile.name = 'Model Releases' THEN 'Focus on model releases and benchmarks.'
    WHEN profile.name = 'Error Test Profile' THEN 'Used for error handling validation.'
    ELSE ''
  END,
  'sourceId', profile.source_id,
  'useCustomSources', profile.use_custom_sources,
  'tags', COALESCE(
    (
      SELECT jsonb_agg(tags.tag ORDER BY tag_row.position, tag_row.id)
      FROM profile_tags_t AS tag_row
      INNER JOIN tags_t AS tags ON tags.id = tag_row.tags_id
      WHERE tag_row.profile_id = profile.id
    ),
    '[]'::jsonb
  ),
  'tagIds', COALESCE(
    (
      SELECT jsonb_agg(tag_row.tags_id ORDER BY tag_row.position, tag_row.id)
      FROM profile_tags_t AS tag_row
      WHERE tag_row.profile_id = profile.id
    ),
    '[]'::jsonb
  ),
  'roles', COALESCE(
    (
      SELECT jsonb_agg(role_row.role_name ORDER BY role_row.position, role_row.id)
      FROM profile_roles_t AS role_row
      WHERE role_row.profile_id = profile.id
    ),
    '[]'::jsonb
  ),
  'urls', COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'url', url_row.url,
          'description', COALESCE(url_row.description, '')
        )
        ORDER BY url_row.position, url_row.id
      )
      FROM source_urls_t AS url_row
      WHERE url_row.source_id = profile.source_id
    ),
    '[]'::jsonb
  ),
  'rssFeeds', COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'feedUrl', rss_row.feed_url,
          'description', COALESCE(rss_row.description, '')
        )
        ORDER BY rss_row.position, rss_row.id
      )
      FROM source_rss_feeds_t AS rss_row
      WHERE rss_row.source_id = profile.source_id
    ),
    '[]'::jsonb
  ),
  'notificationProfileId', profile.notification_profile_id,
  'notificationChannelIds', CASE
    WHEN profile.notification_profile_id IS NULL THEN '[]'::jsonb
    ELSE jsonb_build_array(profile.notification_profile_id)
  END
);

COMMIT;
