# Profile and News Seeding

## Table of Contents

1. [Files](#files)
2. [Methods](#methods)
3. [Customizing Profile Seed Data](#customizing-profile-seed-data)
4. [Idempotency](#idempotency)
5. [Default Baseline](#default-baseline)

This directory contains tools to initialize predefined profiles and sample news into the News Scraper application.

## Files

- `seed-profiles.json` - Reusable JSON definition of profiles to seed
- `seed.sql` - Direct SQL initialization for profiles and related source tables (Postgres)
- `seed-news.sql` - Direct SQL initialization for sample profile-linked news rows (Postgres)
- `seed-error-switching.sql` - Scenario SQL seed to add an Error Test Profile and deterministic error rows for profile-switching UI tests

## Methods

### Method 1: API-Based Seeding (Recommended)

```bash
node server/scripts/seed-profiles.mjs
```

**Options:**

- Default seed file: `server/sql/seed-profiles.json`
- Custom seed file: `node server/scripts/seed-profiles.mjs --file path/to/custom-seed.json`
- Custom API endpoint: `API_BASE_URL=http://localhost:3000 node server/scripts/seed-profiles.mjs`

**Example:**

```bash
# Start the API first
npm run start:api

# In another terminal, seed the database
node server/scripts/seed-profiles.mjs
```

### Method 2: Direct SQL Seeding for Profiles (Postgres)

Use this to seed profiles directly via SQL. This method does not require the API to be running.

`seed.sql` generates each `news_t.news_id` deterministically as `SHA-256(link + title)` using `digest(..., 'sha256')`.

```bash
psql "$DATABASE_URL" -f server/sql/seed.sql
```

Or with discrete Postgres variables:

```bash
psql -h localhost -U postgres -d news_scrapper -f server/sql/seed.sql
```

### Method 3: Direct SQL Seeding for Sample News (Postgres)

Use this to seed sample profile-linked news rows directly via SQL.

`seed-news.sql` generates each `news_t.news_id` deterministically as `SHA-256(link + title)` using `digest(..., 'sha256')`.

```bash
psql "$DATABASE_URL" -f server/sql/seed-news.sql
```

Or via npm script:

```bash
npm run seed:news:sql
```

Note: SQL hash generation requires the `pgcrypto` extension. Ensure `server/sql/migrations/20260516_enable_pgcrypto.sql` (or `server/sql/init.sql`) has been applied.

**Advantages:**

- No API needed
- Safe to rerun for local demos and testing
- Fast for bulk operations

### Method 4: Direct SQL Seeding for Error Switching Scenario (Postgres)

Use this to add a dedicated Error Test Profile and seed three deterministic error rows only for that profile.

```bash
psql "$DATABASE_URL" -f server/sql/seed-error-switching.sql
```

This scenario seed is designed for UI testing where error visibility depends on the currently selected profile.

## Customizing Profile Seed Data

Edit `server/sql/seed-profiles.json` to modify predefined profiles:

```json
[
  {
    "name": "Profile Name",
    "description": "Optional description",
    "useCustomSources": true,
    "tags": ["tag1", "tag2"],
    "roles": ["Engineer", "CTO"],
    "urls": [
      {
        "url": "https://example.com",
        "description": "Optional source description"
      }
    ],
    "rssFeeds": [
      {
        "feedUrl": "https://example.com/feed.xml",
        "title": "Feed Title",
        "refreshCadence": "Hourly",
        "format": "RSS 2.0",
        "category": "News"
      }
    ]
  }
]
```

## Idempotency

`seed-profiles.mjs` (API-based profile seeding) remains idempotent:

- If a profile with the same name already exists, it is skipped
- If seeded profile data partially exists, only missing pieces are added
- Safe to run multiple times without duplicating data

`seed.sql` and `seed-news.sql` are reset-style scripts:

- Existing table rows in their scope are cleared first
- The same baseline dataset is recreated on each run

## Default Baseline

Default SQL seed baseline (`server/sql/seed.sql`) creates a profile-switching test baseline with 4 profiles (including `Error Test Profile`) and mostly 3 child rows per profile in profile-linked FK tables. The `AI Demo` profile intentionally has a single URL source from instructions:

- **profiles_t:** 4
- **profile_urls_t:** 10 total (`AI Demo` has 1, other profiles have 3)
- **profile_tags_t:** 12 total (3 per profile)
- **profile_roles_t:** 12 total (3 per profile)
- **rss_feeds_t:** 12 total (3 per profile)
- **news_t:** 12 total (3 per profile)
- **error_t:** 3 total (all 3 seeded errors belong to `Error Test Profile`)
- **notification_profiles_t:** 3
- **notification_channels_t:** 9 total (3 per notification profile)

Default API profile seed (`server/sql/seed-profiles.json`) contains 3 profiles.
