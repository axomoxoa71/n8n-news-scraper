-- Resets and seeds a strict local baseline.
-- Includes a dedicated Error Test Profile for profile-switching UI tests.
-- Usage: psql "$DATABASE_URL" -f server/sql/seed.sql

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

-- 3 notification profiles
INSERT INTO notification_profiles_t (name, description)
VALUES
  ('Test Channel', 'Test notification channel for development.'),
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

-- 4 profiles (including Error Test Profile for switching/error visibility tests)
INSERT INTO profiles_t (
  name,
  description,
  use_custom_sources,
  notification_profile_id,
  json
)
VALUES
  (
    'AI LLM',
    'A profile for testing with LLMs',
    TRUE,
    1,
    NULL
  ),
  (
    'Agent Ecosystem',
    'Autonomous agents and tooling updates.',
    TRUE,
    2,
    NULL
  ),
  (
    'Model Releases',
    'Provider model and API release notes.',
    TRUE,
    3,
    NULL
  ),
  (
    'Error Test Profile',
    'Dedicated profile for error indicator and profile switching tests.',
    TRUE,
    1,
    NULL
  );

-- 12 profile URLs (3 per profile)
INSERT INTO profile_urls_t (profile_id, position, url, description)
VALUES
  (1, 0, 'https://www.technologyreview.com/topic/artificial-intelligence/', 'MIT Technology Review AI Coverage'),
  (1, 1, 'https://www.unite.ai/', 'Unite AI News'),
  (1, 2, 'https://aiuniverseexplorer.com/ai-news-aggregator/', 'AI Universe Explorer'),
  (2, 0, 'https://www.technologyreview.com/topic/artificial-intelligence/', 'MIT Technology Review AI'),
  (2, 1, 'https://venturebeat.com/category/ai/', 'Enterprise AI product coverage'),
  (2, 2, 'https://www.theregister.com/machine_learning/', 'Industry agent tooling updates'),
  (3, 0, 'https://openai.com/news/', 'OpenAI announcements'),
  (3, 1, 'https://ai.googleblog.com/', 'Google AI announcements'),
  (3, 2, 'https://www.anthropic.com/news', 'Anthropic product and policy updates'),
  (4, 0, 'https://status.openai.com/', 'Provider status updates'),
  (4, 1, 'https://www.githubstatus.com/', 'GitHub status and incident updates'),
  (4, 2, 'https://status.slack.com/', 'Slack status and incident updates');

-- 12 profile tags (3 per profile)
INSERT INTO profile_tags_t (profile_id, position, tag_name)
VALUES
  (1, 0, 'llm'),
  (1, 1, 'anthropic'),
  (1, 2, 'claude'),
  (2, 0, 'agents'),
  (2, 1, 'orchestration'),
  (2, 2, 'automation'),
  (3, 0, 'releases'),
  (3, 1, 'api'),
  (3, 2, 'changelog'),
  (4, 0, 'errors'),
  (4, 1, 'switching'),
  (4, 2, 'ui-test');

-- 12 profile roles (3 per profile)
INSERT INTO profile_roles_t (profile_id, position, role_name)
VALUES
  (1, 0, 'Solution Architect'),
  (1, 1, 'Software Engineer'),
  (1, 2, 'Data Scientist'),
  (2, 0, 'Architect'),
  (2, 1, 'Engineering Manager'),
  (2, 2, 'Product Manager'),
  (3, 0, 'CTO'),
  (3, 1, 'CIO'),
  (3, 2, 'Security Lead'),
  (4, 0, 'QA Engineer'),
  (4, 1, 'SRE'),
  (4, 2, 'Platform Engineer');

-- 12 RSS feeds (3 per profile)
INSERT INTO rss_feeds_t (
  profile_id,
  position,
  feed_url,
  title,
  refresh_cadence,
  format,
  category
)
VALUES
  (1, 0, 'https://planet-ai.net/rss.xml', 'Planet AI', 'Every 30 minutes', 'RSS 2.0', 'LLM Updates'),
  (1, 1, 'https://syncedreview.com/feed/', 'Synced Global AI News', 'Hourly', 'RSS 2.0', 'AI Research'),
  (1, 2, 'https://www.infoq.com/ai-ml-data-eng/feed/', 'InfoQ AI/ML', 'Twice daily', 'RSS 2.0', 'AI Engineering'),
  (2, 0, 'https://feeds.feedburner.com/oreilly/radar/atom', 'OReilly Radar', 'Hourly', 'Atom', 'AI Engineering'),
  (2, 1, 'https://venturebeat.com/category/ai/feed/', 'VentureBeat AI', 'Hourly', 'RSS 2.0', 'AI Industry'),
  (2, 2, 'https://www.theregister.com/machine_learning/headlines.atom', 'The Register ML', 'Twice daily', 'Atom', 'Agent Ecosystem'),
  (3, 0, 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', 'The Verge AI', 'Hourly', 'RSS 2.0', 'AI Industry'),
  (3, 1, 'https://openai.com/news/rss.xml', 'OpenAI News', 'Hourly', 'RSS 2.0', 'Provider Releases'),
  (3, 2, 'https://www.anthropic.com/news/rss.xml', 'Anthropic News', 'Twice daily', 'RSS 2.0', 'Provider Releases'),
  (4, 0, 'https://status.openai.com/history.rss', 'OpenAI Status', 'Hourly', 'RSS 2.0', 'Operational Status'),
  (4, 1, 'https://www.githubstatus.com/history.rss', 'GitHub Status', 'Hourly', 'RSS 2.0', 'Operational Status'),
  (4, 2, 'https://status.slack.com/feed/rss', 'Slack Status', 'Hourly', 'RSS 2.0', 'Operational Status');

-- 12 news rows (3 per profile)
INSERT INTO news_t (
  profile_id,
  title,
  summary,
  origin,
  link,
  published_ts,
  favorite
)
VALUES
  (
    1,
    'Open-source agent benchmark published',
    'A new benchmark compares autonomous coding agents on reliability, cost, and latency.',
    'Agent Weekly',
    'https://example.com/news/agent-benchmark',
    CURRENT_TIMESTAMP - INTERVAL '15 minutes',
    FALSE
  ),
  (
    1,
    'Foundation model vendor expands enterprise controls',
    'New deployment controls add policy gating, audit trails, and regional rollout management.',
    'Enterprise AI Brief',
    'https://example.com/news/enterprise-controls',
    CURRENT_TIMESTAMP - INTERVAL '50 minutes',
    TRUE
  ),
  (
    1,
    'Inference cost report shows efficiency gains',
    'New benchmarking data highlights lower latency and lower token costs across production workloads.',
    'Model Ops Daily',
    'https://example.com/news/inference-cost-report',
    CURRENT_TIMESTAMP - INTERVAL '3 hours',
    FALSE
  ),
  (
    2,
    'Model release improves long-context reasoning',
    'Vendors report measurable reductions in retrieval failures on long-context prompts.',
    'Applied AI Journal',
    'https://example.com/news/long-context',
    CURRENT_TIMESTAMP - INTERVAL '2 hours',
    TRUE
  ),
  (
    2,
    'Agent framework adds human approval checkpoints',
    'The latest agent orchestration release adds configurable approval gates before high-impact actions.',
    'Agent Platform Review',
    'https://example.com/news/approval-checkpoints',
    CURRENT_TIMESTAMP - INTERVAL '4 hours',
    FALSE
  ),
  (
    2,
    'Tool-using agents improve task recovery rates',
    'A new evaluation shows better retry behavior and reduced failure loops in multi-step workflows.',
    'Workflow Systems Weekly',
    'https://example.com/news/task-recovery',
    CURRENT_TIMESTAMP - INTERVAL '7 hours',
    TRUE
  ),
  (
    3,
    'Vector stores add temporal query controls',
    'New temporal filtering features improve freshness for production RAG workloads.',
    'Data Infra Digest',
    'https://example.com/news/vector-temporal',
    CURRENT_TIMESTAMP - INTERVAL '5 hours',
    FALSE
  ),
  (
    3,
    'Model provider ships new API version',
    'Release notes include upgraded reasoning modes, response formatting controls, and migration guidance.',
    'API Release Tracker',
    'https://example.com/news/api-version',
    CURRENT_TIMESTAMP - INTERVAL '8 hours',
    TRUE
  ),
  (
    3,
    'Safety update tightens moderation defaults',
    'Provider defaults now include stricter policy presets and clearer override documentation.',
    'Provider Change Log',
    'https://example.com/news/moderation-defaults',
    CURRENT_TIMESTAMP - INTERVAL '11 hours',
    FALSE
  ),
  (
    4,
    'Synthetic error-run baseline generated',
    'A deterministic error-seed scenario was generated to validate profile switching behavior in the UI.',
    'QA Seed Runner',
    'https://example.com/news/error-seed-baseline',
    CURRENT_TIMESTAMP - INTERVAL '20 minutes',
    FALSE
  ),
  (
    4,
    'Workflow retry path exercised',
    'Test harness intentionally triggered retry paths to validate error visibility per selected profile.',
    'Integration Test Digest',
    'https://example.com/news/workflow-retry-test',
    CURRENT_TIMESTAMP - INTERVAL '70 minutes',
    TRUE
  ),
  (
    4,
    'Error indicator switching validated',
    'UI switching across profiles correctly adapted error count and button visibility in latest run.',
    'UI Validation Notes',
    'https://example.com/news/error-indicator-switching',
    CURRENT_TIMESTAMP - INTERVAL '5 hours',
    FALSE
  );

-- 3 error rows for Error Test Profile (profile-switching test baseline)
INSERT INTO error_t (
  profile_id,
  trace_id,
  instance_id,
  error_message,
  error_description,
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
    4,
    'e4e4f6dd2df74f34b7746e72e5f67001',
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
    4,
    'e4e4f6dd2df74f34b7746e72e5f67002',
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
    4,
    'e4e4f6dd2df74f34b7746e72e5f67003',
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

-- Rebuild normalized JSON snapshots in profiles_t
UPDATE profiles_t AS profile
SET json = jsonb_build_object(
  'name', profile.name,
  'description', COALESCE(profile.description, ''),
  'useCustomSources', profile.use_custom_sources,
  'tags', COALESCE(
    (
      SELECT jsonb_agg(tag_row.tag_name ORDER BY tag_row.position, tag_row.id)
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
      FROM profile_urls_t AS url_row
      WHERE url_row.profile_id = profile.id
    ),
    '[]'::jsonb
  ),
  'rssFeeds', COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'feedUrl', rss_row.feed_url,
          'title', COALESCE(rss_row.title, ''),
          'refreshCadence', rss_row.refresh_cadence,
          'format', rss_row.format,
          'category', COALESCE(rss_row.category, '')
        )
        ORDER BY rss_row.position, rss_row.id
      )
      FROM rss_feeds_t AS rss_row
      WHERE rss_row.profile_id = profile.id
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
