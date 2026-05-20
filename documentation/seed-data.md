# Seed Data

## Table of Contents

1. [Overview](#overview)
2. [Default Baseline](#default-baseline)
3. [Seed Files](#seed-files)
4. [Reset and Reseed](#reset-and-reseed)
5. [Error Switching Scenario Seed](#error-switching-scenario-seed)
6. [When to Add Extra Seed Data](#when-to-add-extra-seed-data)

## Overview

This project uses a default seed baseline intended for testing and local development.

By default, seed data provides 4 profiles (including a dedicated `Error Test Profile`) linked to 4 sources.
Every source has 3 RSS feeds, while URL counts follow one explicit exception: `AI Demo` has exactly 1 instruction-defined URL and each other source has 3 URLs.
Each profile links to one source.
For `error_t`, only `Error Test Profile` is seeded, with 3 deterministic error rows.
Only add extra records when a specific test scenario needs additional or specialized data.

## Default Baseline

The default SQL seed baseline creates 4 profiles (including `Error Test Profile`) with deterministic row counts in FK-backed tables:

- `profiles_t`: 4
- `sources_t`: 4
- `source_urls_t`: 10 total (`AI Demo`: 1 URL, all other sources: 3 URLs each)
- `source_rss_feeds_t`: 12 total, with 3 rows per source
- `profile_tags_t`: 12 total, with 3 rows per profile
- `profile_roles_t`: 12 total, with 3 rows per profile
- `news_t`: 9 total, with 3 rows per source for sources 2-4 (`AI Demo` source has 0 seeded news rows)
- `error_t`: 3 total, all seeded for `Error Test Profile`
- `notification_profiles_t`: 3
- `notification_channels_t`: 5 total (`AI Demo`: 1, `Slack Alerts`: 2, `Ops Alerts`: 2)

## Seed Files

- `server/sql/seed.sql`
  - Non-destructive baseline seed for sources, source URLs, source RSS feeds, profiles, tags, roles, notification profiles/channels, and news.
  - `news_t.news_id` is generated deterministically as `SHA-256(link + title)` during insert.
- `server/sql/seed-profiles.json`
  - API seeding payload containing 4 profile definitions: `AI Demo`, `Agent Ecosystem`, `Model Releases`, and `Error Test Profile`.
  - `AI Demo` is seeded with the instruction-defined AI source set, including `https://ai.meta.com/blog/`, `https://openai.com/news/rss.xml`, `https://huggingface.co/blog/feed.xml`, and `https://github.com/axomoxoa71/news-scrapper/blob/main/news/ai-news.opml`.
  - `Error Test Profile` includes 3 deterministic seeded error records via API seeding.
- `server/sql/cleanup.sql`
  - Drops application tables/functions to fully reset schema objects.
- `server/sql/seed-error-switching.sql`
  - Scenario seed that ensures an `Error Test Profile` exists and seeds deterministic `error_t` rows for profile-switching UI tests.

## Reset and Reseed

Use one of the following approaches.

1. SQL initialize/seed without dropping existing tables (Postgres CLI):

```bash
psql "$DATABASE_URL" -f server/sql/migrations/20260516_change_news_id_to_text.sql
psql "$DATABASE_URL" -f server/sql/migrations/20260516_enable_pgcrypto.sql
psql "$DATABASE_URL" -f server/sql/init.sql
psql "$DATABASE_URL" -f server/sql/seed.sql
```

`seed.sql` uses `digest(..., 'sha256')` and requires `pgcrypto` (enabled by `20260516_enable_pgcrypto.sql` and `server/sql/ddl/00_functions.sql`).

2. API profile seeding only (requires API server running):

```bash
node server/scripts/seed-profiles.mjs
```

The API seed script performs post-seed verification and fails if seeded data does not match expected profile definitions, expected profile-specific error counts, and the baseline news expectations enforced by the script.

## Error Switching Scenario Seed

To test profile-scoped error indicators when switching profiles, run:

```bash
psql "$DATABASE_URL" -f server/sql/seed-error-switching.sql
```

This seed file:

- Ensures `Error Test Profile` exists.
- Adds deterministic `error_t` entries for `Error Test Profile` only when those trace IDs are not already present.
- Is safe to rerun for the same scenario because it avoids duplicate inserts.

## When to Add Extra Seed Data

Add extra seed files only when a test requires data beyond the default baseline.

Guidelines:

- Keep the default baseline unchanged at 3 parent records for root tables and 3 child rows per parent in FK-backed tables.
- Create a separate seed file for scenario-specific data.
- Document each additional seed file in this document, including:
  - Purpose
  - Tables affected
  - Record counts
  - How to run it
