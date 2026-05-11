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

By default, seed data provides 4 profiles (including a dedicated `Error Test Profile`) and 3 child rows per profile for profile-linked FK-backed tables.
For `error_t`, only `Error Test Profile` is seeded, with 3 deterministic error rows.
Only add extra records when a specific test scenario needs additional or specialized data.

## Default Baseline

The default SQL seed baseline creates 4 profiles (including `Error Test Profile`) and 3 rows per profile in profile-linked FK-backed tables:

- `profiles_t`: 4
- `profile_urls_t`: 12 total, with 3 rows per profile
- `profile_tags_t`: 12 total, with 3 rows per profile
- `profile_roles_t`: 12 total, with 3 rows per profile
- `rss_feeds_t`: 12 total, with 3 rows per profile
- `news_t`: 12 total, with 3 rows per profile
- `error_t`: 3 total, all seeded for `Error Test Profile`
- `notification_profiles_t`: 3
- `notification_channels_t`: 9 total, with 3 rows per notification profile

## Seed Files

- `server/sql/seed.sql`
  - Reset-style baseline seed for profiles, URLs, tags, RSS feeds, notification profiles/channels, and news.
- `server/sql/seed-news.sql`
  - Reset-style seed for exactly 9 news rows total, with 3 rows for each of the first 3 profiles.
- `server/sql/seed-profiles.json`
  - API seeding payload containing 4 profile definitions: `AI LLM`, `Agent Ecosystem`, `Model Releases`, and `Error Test Profile`.
  - `AI LLM` includes one invalid URL entry (`https://invalid/`) and one invalid RSS feed URL (`https://invalid/rss.xml`) for validation/error-path testing.
  - `Error Test Profile` includes 3 deterministic seeded error records via API seeding.
- `server/sql/cleanup.sql`
  - Drops application tables/functions to fully reset schema objects.
- `server/sql/seed-error-switching.sql`
  - Scenario seed that ensures an `Error Test Profile` exists and seeds deterministic `error_t` rows for profile-switching UI tests.

## Reset and Reseed

Use one of the following approaches.

1. SQL reset/reseed (Postgres CLI):

```bash
psql "$DATABASE_URL" -f server/sql/init.sql
psql "$DATABASE_URL" -f server/sql/seed.sql
```

2. API profile seeding only (requires API server running):

```bash
node server/scripts/seed-profiles.mjs
```

The API seed script performs post-seed verification and fails if seeded data does not match expected profile definitions, expected profile-specific error counts, and the baseline of 3 news records per profile.

## Error Switching Scenario Seed

To test profile-scoped error indicators when switching profiles, run:

```bash
psql "$DATABASE_URL" -f server/sql/seed-error-switching.sql
```

This seed file:

- Ensures `Error Test Profile` exists.
- Re-seeds `error_t` only for `Error Test Profile` with 3 deterministic entries.
- Is safe to rerun for the same scenario because it replaces scenario-targeted error rows before inserting fresh ones.

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
