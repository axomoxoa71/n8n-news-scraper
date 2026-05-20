-- Scenario seed for UI error-switching tests.
-- Adds/ensures an "Error Test Profile" and seeds three deterministic errors only for that profile.
-- Usage: psql "$DATABASE_URL" -f server/sql/seed-error-switching.sql

BEGIN;

-- Ensure dedicated profile for error-switching UI tests exists.
INSERT INTO profiles_t (
  name,
  description,
  use_custom_sources,
  notification_profile_id,
  json
)
SELECT
  'Error Test Profile',
  'Dedicated profile to test switching and profile-scoped error indicators.',
  FALSE,
  (
    SELECT id
    FROM notification_profiles_t
    ORDER BY id ASC
    LIMIT 1
  ),
  NULL
WHERE NOT EXISTS (
  SELECT 1
  FROM profiles_t
  WHERE lower(name) = lower('Error Test Profile')
);

WITH target_profile AS (
  SELECT id, name
  FROM profiles_t
  WHERE lower(name) = lower('Error Test Profile')
),
error_templates AS (
  SELECT *
  FROM (
    VALUES
      (
        'Error Test Profile',
        'e4e4f6dd2df74f34b7746e72e5f67011',
        'Synthetic switching test error',
        'Intentional seeded error to validate profile switching behavior in the UI.',
        'Error: seeded switching test failure at simulateSwitchingScenario (workflow.js:21:5)',
        500,
        'Switching Test Node',
        'code',
        'news-scrape-workflow',
        'wf-error-test-switch-011',
        jsonb_build_object('phase', 'test', 'seedType', 'switching')
      ),
      (
        'Error Test Profile',
        'e4e4f6dd2df74f34b7746e72e5f67012',
        'Synthetic payload parse failure',
        'Intentional seeded payload parsing failure used for modal stack/json viewer tests.',
        'SyntaxError: Unexpected end of JSON input at parsePayload (workflow.js:57:13)',
        500,
        'Parse Payload',
        'code',
        'news-scrape-workflow',
        'wf-error-test-switch-012',
        jsonb_build_object('phase', 'parse', 'seedType', 'switching')
      ),
      (
        'Error Test Profile',
        'e4e4f6dd2df74f34b7746e72e5f67013',
        'Synthetic downstream timeout',
        'Intentional seeded downstream timeout used for profile-specific error count verification.',
        'TimeoutError: downstream request exceeded 10s timeout at dispatchResult (workflow.js:142:7)',
        504,
        'Dispatch Result',
        'httpRequest',
        'news-scrape-workflow',
        'wf-error-test-switch-013',
        jsonb_build_object('phase', 'dispatch', 'seedType', 'switching')
      )
  ) AS t(
    profile_name,
    trace_id,
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
)
INSERT INTO error_t (
  external_ref_id,
  external_ref_type,
  trace_id,
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
SELECT
  profile.id::text,
  'source',
  template.trace_id,
  template.error_message,
  template.error_details,
  template.error_stack,
  template.error_http_code,
  template.node_name,
  template.node_type,
  template.workflow_name,
  template.workflow_id,
  template.json
FROM target_profile AS profile
JOIN error_templates AS template
  ON lower(profile.name) = lower(template.profile_name)
WHERE NOT EXISTS (
  SELECT 1
  FROM error_t AS existing_error
  WHERE existing_error.trace_id = template.trace_id
)
ORDER BY profile.id;

COMMIT;
