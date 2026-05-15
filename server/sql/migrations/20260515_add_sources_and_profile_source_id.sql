BEGIN;

CREATE TABLE IF NOT EXISTS sources_t (
  id          SERIAL       PRIMARY KEY,
  name        TEXT         NOT NULL,
  description TEXT,
  created_ts  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_ts  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS sources_t_name_idx
  ON sources_t (name);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'sources_t_updated_ts_trg'
      AND tgrelid = 'sources_t'::regclass
  ) THEN
    CREATE TRIGGER sources_t_updated_ts_trg
      BEFORE UPDATE ON sources_t
      FOR EACH ROW EXECUTE FUNCTION set_updated_ts();
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS source_urls_t (
  id          SERIAL   PRIMARY KEY,
  source_id   INTEGER  NOT NULL,
  position    INTEGER  NOT NULL,
  url         TEXT     NOT NULL,
  description TEXT
);

CREATE INDEX IF NOT EXISTS source_urls_t_source_id_idx
  ON source_urls_t (source_id, position);

CREATE TABLE IF NOT EXISTS source_rss_feeds_t (
  id               SERIAL       PRIMARY KEY,
  source_id        INTEGER      NOT NULL,
  position         INTEGER      NOT NULL,
  feed_url         TEXT         NOT NULL,
  title            TEXT,
  refresh_cadence  TEXT         NOT NULL,
  format           TEXT         NOT NULL,
  category         TEXT,
  created_ts       TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_ts       TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS source_rss_feeds_t_source_id_idx
  ON source_rss_feeds_t (source_id, position);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'source_rss_feeds_t_updated_ts_trg'
      AND tgrelid = 'source_rss_feeds_t'::regclass
  ) THEN
    CREATE TRIGGER source_rss_feeds_t_updated_ts_trg
      BEFORE UPDATE ON source_rss_feeds_t
      FOR EACH ROW EXECUTE FUNCTION set_updated_ts();
  END IF;
END $$;

ALTER TABLE profiles_t
  ADD COLUMN IF NOT EXISTS source_id INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'source_urls_t_source_id_fkey'
  ) THEN
    ALTER TABLE source_urls_t
      ADD CONSTRAINT source_urls_t_source_id_fkey
        FOREIGN KEY (source_id) REFERENCES sources_t(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'source_rss_feeds_t_source_id_fkey'
  ) THEN
    ALTER TABLE source_rss_feeds_t
      ADD CONSTRAINT source_rss_feeds_t_source_id_fkey
        FOREIGN KEY (source_id) REFERENCES sources_t(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_t_source_id_fkey'
  ) THEN
    ALTER TABLE profiles_t
      ADD CONSTRAINT profiles_t_source_id_fkey
        FOREIGN KEY (source_id) REFERENCES sources_t(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Backfill one source per existing profile based on current URL/RSS rows.
WITH candidate_profiles AS (
  SELECT p.id, p.name, p.description
  FROM profiles_t p
  WHERE p.source_id IS NULL
)
INSERT INTO sources_t (name, description)
SELECT cp.name || ' Source', cp.description
FROM candidate_profiles cp;

WITH mapped AS (
  SELECT p.id AS profile_id, s.id AS source_id
  FROM profiles_t p
  JOIN sources_t s
    ON s.name = p.name || ' Source'
  WHERE p.source_id IS NULL
)
UPDATE profiles_t p
SET source_id = mapped.source_id
FROM mapped
WHERE p.id = mapped.profile_id;

INSERT INTO source_urls_t (source_id, position, url, description)
SELECT p.source_id, u.position, u.url, u.description
FROM profile_urls_t u
JOIN profiles_t p ON p.id = u.profile_id
WHERE p.source_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM source_urls_t su
    WHERE su.source_id = p.source_id
      AND su.position = u.position
      AND su.url = u.url
  );

INSERT INTO source_rss_feeds_t (
  source_id,
  position,
  feed_url,
  title,
  refresh_cadence,
  format,
  category
)
SELECT
  p.source_id,
  r.position,
  r.feed_url,
  r.title,
  r.refresh_cadence,
  r.format,
  r.category
FROM rss_feeds_t r
JOIN profiles_t p ON p.id = r.profile_id
WHERE p.source_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM source_rss_feeds_t sr
    WHERE sr.source_id = p.source_id
      AND sr.position = r.position
      AND sr.feed_url = r.feed_url
  );

COMMIT;
