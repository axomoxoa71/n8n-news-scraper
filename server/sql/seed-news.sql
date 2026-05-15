-- Reset-style seed: exactly 9 sample news rows total (3 for each of the first 3 sources).

BEGIN;

DELETE FROM news_t;

WITH first_three_sources AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY id ASC) AS source_rn
  FROM sources_t
  ORDER BY id ASC
  LIMIT 3
)
INSERT INTO news_t (
  news_id,
  source_id,
  title,
  summary,
  origin,
  link,
  published_ts,
  favorite
)
SELECT
  encode(digest(template.link || template.title, 'sha256'), 'hex'),
  source.id,
  template.title,
  template.summary,
  template.origin,
  template.link,
  CURRENT_TIMESTAMP - template.age_interval,
  template.favorite
FROM first_three_sources AS source
JOIN (
  VALUES
    (
      1,
      1,
      'Open-source agent benchmark published',
      'A new benchmark compares autonomous coding agents on reliability, cost, and latency.',
      'Agent Weekly',
      'https://example.com/news/agent-benchmark',
      INTERVAL '15 minutes',
      FALSE
    ),
    (
      1,
      2,
      'Foundation model vendor expands enterprise controls',
      'New deployment controls add policy gating, audit trails, and regional rollout management.',
      'Enterprise AI Brief',
      'https://example.com/news/enterprise-controls',
      INTERVAL '50 minutes',
      TRUE
    ),
    (
      1,
      3,
      'Inference cost report shows efficiency gains',
      'New benchmarking data highlights lower latency and lower token costs across production workloads.',
      'Model Ops Daily',
      'https://example.com/news/inference-cost-report',
      INTERVAL '3 hours',
      FALSE
    ),
    (
      2,
      1,
      'Model release improves long-context reasoning',
      'Vendors report measurable reductions in retrieval failures on long-context prompts.',
      'Applied AI Journal',
      'https://example.com/news/long-context',
      INTERVAL '2 hours',
      TRUE
    ),
    (
      2,
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
      3,
      'Tool-using agents improve task recovery rates',
      'A new evaluation shows better retry behavior and reduced failure loops in multi-step workflows.',
      'Workflow Systems Weekly',
      'https://example.com/news/task-recovery',
      INTERVAL '7 hours',
      TRUE
    ),
    (
      3,
      1,
      'Vector stores add temporal query controls',
      'New temporal filtering features improve freshness for production RAG workloads.',
      'Data Infra Digest',
      'https://example.com/news/vector-temporal',
      INTERVAL '5 hours',
      FALSE
    ),
    (
      3,
      2,
      'Model provider ships new API version',
      'Release notes include upgraded reasoning modes, response formatting controls, and migration guidance.',
      'API Release Tracker',
      'https://example.com/news/api-version',
      INTERVAL '8 hours',
      TRUE
    ),
    (
      3,
      3,
      'Safety update tightens moderation defaults',
      'Provider defaults now include stricter policy presets and clearer override documentation.',
      'Provider Change Log',
      'https://example.com/news/moderation-defaults',
      INTERVAL '11 hours',
      FALSE
    )
) AS template(source_rn, item_rn, title, summary, origin, link, age_interval, favorite)
  ON source.source_rn = template.source_rn
ORDER BY source.source_rn, template.item_rn;

COMMIT;
