# Tests

## Table of Contents

1. [Test Framework](#test-framework)
2. [Test Files](#test-files)
3. [Detailed Test Inventory](#detailed-test-inventory)
4. [Seed Data Integration Tests](#seed-data-integration-tests)
5. [How to Run](#how-to-run)

## Test Framework

- Framework: Playwright (`@playwright/test`)
- Framework: Node test runner (`node:test`) for backend API tests
- Config: `playwright.config.js`
- Test location: `tests/`

## Test Files

- `tests/ai-news.spec.ts`
- `server/news-scraper-api.test.mjs`
- `server/seed-data.test.mjs`

## How to Run

```sh
# Run API unit tests (no server required)
npm run test:api

# Run seed data integration tests (requires running API + seeded data)
npm run seed:profiles
npm run test:seed

# Run E2E Playwright tests (requires running dev server)
npm run test:e2e
```

## Detailed Test Inventory

### entry page renders News Scraper and logo

- File: `tests/ai-news.spec.ts`
- What it tests:
  - Home page loads
  - Main heading "Scrap news from predefined trusted sources (URL, RSS) with help of AI via pre-defined profiles" is visible
  - Logo image with accessible name "News Scraper logo" is visible
  - Main navigation is visible
- Setup required:
  - Dev server available at configured `baseURL` (auto-started by Playwright webServer config)
- Assertions made:
  - `heading` role with name `Scrap news from predefined trusted sources (URL, RSS) with help of AI via pre-defined profiles` is visible
  - `img` role with name `News Scraper logo` is visible
  - `navigation` role with name `Main` is visible

### menus navigate to Profiles, Chatbot, and News pages

- File: `tests/ai-news.spec.ts`
- What it tests:
  - Menu navigation links switch between all pages
- Setup required:
  - Dev server available at configured `baseURL` (auto-started by Playwright webServer config)
- Assertions made:
  - Profiles heading visible after clicking Profiles menu
  - Chatbot heading visible after clicking Chatbot menu
  - News heading visible after clicking News menu

### AI LLM profile is selected by default when available

- File: `tests/ai-news.spec.ts`
- What it tests:
  - Active profile selection prefers `AI LLM` when that profile exists in the loaded profile list
  - Selection does not depend on API response ordering
- Setup required:
  - Dev server available at configured `baseURL` (auto-started by Playwright webServer config)
  - Playwright route interception for `GET /api/profiles` and `GET /api/notification-profiles`
- Assertions made:
  - Active profile combobox value is `AI LLM` after initial page load

### news page supports keyword search and favorites filtering

- File: `tests/ai-news.spec.ts`
- What it tests:
  - News view renders API-provided rows for the selected profile
  - Keyword search filters rows by title/summary
  - Favorites-only toggle filters out non-favorite rows
- Setup required:
  - Dev server available at configured `baseURL` (auto-started by Playwright webServer config)
  - Playwright route interception for `GET /api/profiles`, `GET /api/notification-profiles`, and `GET /api/news`
- Assertions made:
  - Both mocked news rows are initially visible
  - Keyword search leaves only the matching row
  - Favorites-only toggle leaves only favorite rows

### add profile dialog opens as a modal and can close

- File: `tests/ai-news.spec.ts`
- What it tests:
  - Add Profile action opens a modal dialog surface
  - Modal can be closed without saving
- Setup required:
  - Dev server available at configured `baseURL` (auto-started by Playwright webServer config)
- Assertions made:
  - Add profile dialog is visible after clicking Add Profile
  - Closing the dialog hides the modal and returns to profiles view

### profile form shows English validation message for missing mandatory fields

- File: `tests/ai-news.spec.ts`
- What it tests:
  - Mandatory profile fields validate with English-language error text
- Setup required:
  - Dev server available at configured `baseURL` (auto-started by Playwright webServer config)
- Assertions made:
  - Save attempt with missing required values shows a validation message in English

### user can add a profile with URLs and RSS settings

- File: `tests/ai-news.spec.ts`
- What it tests:
  - Profiles page accepts a new profile with mandatory name and URL inputs when Custom mode is enabled
  - Multiple source URLs can be added to one profile
  - RSS feed settings can be entered and saved
  - Saved profile row is rendered back to the user
- Setup required:
  - Dev server available at configured `baseURL` (auto-started by Playwright webServer config)
- Assertions made:
  - Saved profile list contains the created profile
  - Add dialog closes after save

### user can add unique tags and remove them directly in the tags tab

- File: `tests/ai-news.spec.ts`
- What it tests:
  - Tags can be added from the TAGS tab by keyboard or button
  - Duplicate tag names are blocked case-insensitively
  - Tags can be removed directly from the chip control
  - Saved tags round-trip back into edit mode
- Setup required:
  - Dev server available at configured `baseURL` (auto-started by Playwright webServer config)
- Assertions made:
  - Added tags are visible as chips in the dialog
  - Duplicate tag attempt shows a validation message and does not add a second chip
  - Removing a tag updates the chip list immediately
  - Edit mode shows the remaining saved tag chip

### user can add unique roles and remove them directly in the roles tab

- File: `tests/ai-news.spec.ts`
- What it tests:
  - Roles can be added from the ROLES tab by keyboard or button
  - Duplicate role names are blocked case-insensitively
  - Roles can be removed directly from the chip control
  - Saved roles round-trip back into edit mode
- Setup required:
  - Dev server available at configured `baseURL` (auto-started by Playwright webServer config)
- Assertions made:
  - Added roles are visible as chips in the dialog
  - Duplicate role attempt shows a validation message and does not add a second chip
  - Removing a role updates the chip list immediately
  - Edit mode shows the remaining saved role chip

### default AI mode hides URL and RSS editors and allows save

- File: `tests/ai-news.spec.ts`
- What it tests:
  - Custom mode is unchecked by default
  - URL and RSS editors are hidden while Custom is unchecked
  - Profile save succeeds without user-defined URL/RSS sources
- Setup required:
  - Dev server available at configured `baseURL` (auto-started by Playwright webServer config)
- Assertions made:
  - Custom checkbox is unchecked by default
  - URL and RSS source input controls are not rendered until Custom is enabled
  - Saved profile list contains the created profile

### disabling custom mode confirms and clears URL and RSS entries

- File: `tests/ai-news.spec.ts`
- What it tests:
  - Disabling Custom mode after entering source data asks for confirmation
  - Confirming the warning hides URL and RSS editors
  - Re-enabling Custom mode starts from cleared URL/RSS entries
- Setup required:
  - Dev server available at configured `baseURL` (auto-started by Playwright webServer config)
- Assertions made:
  - Confirmation dialog is accepted when Custom is unchecked
  - URL and RSS source controls are hidden after confirmation
  - Re-enabled URL and RSS first entries are present and empty

### profile save error shows backend trace ID

- File: `tests/ai-news.spec.ts`
- What it tests:
  - Save failures surface the backend trace ID in the UI validation message
  - Error correlation details are visible to the user for support/debugging handoff
- Setup required:
  - Dev server available at configured `baseURL` (auto-started by Playwright webServer config)
  - Playwright route interception for `POST /api/profiles` returns `500` with `traceId`
- Assertions made:
  - Alert message contains `Trace ID: <value>` from the backend response

### user can edit and delete a saved profile

- File: `tests/ai-news.spec.ts`
- What it tests:
  - A saved profile can be opened in edit mode
  - Updated values replace the previous saved profile content
  - A saved profile can be removed from the summary list
- Setup required:
  - Dev server available at configured `baseURL` (auto-started by Playwright webServer config)
- Assertions made:
  - Edit action switches the form into edit mode
  - Updated profile name and RSS title are visible after save
  - Previous profile name is no longer present after update
  - Deleted profile is removed and the empty state returns

### selected profile in header scopes Chatbot and News context

- File: `tests/ai-news.spec.ts`
- What it tests:
  - Active profile selection is shared across Chatbot and News routes
- Setup required:
  - Dev server available at configured `baseURL` (auto-started by Playwright webServer config)
- Assertions made:
  - Chatbot reflects the selected active profile
  - News page requests and renders content for the selected active profile

### active profile dropdown filters while typing

- File: `tests/ai-news.spec.ts`
- What it tests:
  - Header profile search input filters the active profile dropdown in real time
  - Filtered options still allow selecting the visible matching profile
  - Selected filtered profile scopes Chatbot context as expected
- Setup required:
  - Dev server available at configured `baseURL` (auto-started by Playwright webServer config)
- Assertions made:
  - Typing `beta` in `Search profiles` leaves only matching profile options
  - Non-matching profile option is hidden from the dropdown
  - After selecting from filtered results, Chatbot shows the selected profile name

### profile save sends multiple notification channel ids

- File: `tests/ai-news.spec.ts`
- What it tests:
  - Profile save payload includes selected multi-channel notification IDs
- Setup required:
  - Dev server available at configured `baseURL` (auto-started by Playwright webServer config)
  - Playwright route interception for profile save request
- Assertions made:
  - Saved request contains `notificationChannelIds` with multiple selected values

### notification channel multi-select supports keyboard-only selection

- File: `tests/ai-news.spec.ts`
- What it tests:
  - Notification channel selector supports keyboard-only search and selection
- Setup required:
  - Dev server available at configured `baseURL` (auto-started by Playwright webServer config)
- Assertions made:
  - Keyboard navigation opens list, filters options, and selects channels
  - Selected channels are displayed in form state

### notification channel multi-select shows empty state for unmatched search

- File: `tests/ai-news.spec.ts`
- What it tests:
  - Notification channel selector renders explicit empty state when search has no matches
- Setup required:
  - Dev server available at configured `baseURL` (auto-started by Playwright webServer config)
- Assertions made:
  - Unmatched search term shows no-result state message

### notification channels tab shows add and edit controls

- File: `tests/ai-news.spec.ts`
- What it tests:
  - Notification channels tab exposes controls needed for adding and editing channels
- Setup required:
  - Dev server available at configured `baseURL` (auto-started by Playwright webServer config)
- Assertions made:
  - Tab contains expected controls and labels for channel management

### news scraper API supports list, create, update, and delete

- File: `server/news-scraper-api.test.mjs`
- What it tests:
  - The backend API returns an empty profile list initially
  - The API can create a profile
  - The API can update a previously created profile
  - The API can delete a previously created profile
- Setup required:
  - None beyond local Node dependencies, because the test injects an in-memory repository
- Assertions made:
  - `GET /api/profiles` returns `200` with an empty array initially
  - `POST /api/profiles` returns `201` with the created profile payload
  - `PUT /api/profiles/:id` returns `200` with updated profile data
  - `DELETE /api/profiles/:id` returns `204`
  - Final `GET /api/profiles` returns an empty array

### news scraper API rejects duplicate tag names within the same profile

- File: `server/news-scraper-api.test.mjs`
- What it tests:
  - The backend validation rejects repeated tag names within one profile payload
- Setup required:
  - None beyond local Node dependencies, because the test injects an in-memory repository
- Assertions made:
  - `POST /api/profiles` returns `400` when duplicate tag names are sent
  - Error payload explains that tag names must be unique within the profile

### news scraper API rejects duplicate role names within the same profile

- File: `server/news-scraper-api.test.mjs`
- What it tests:
  - The backend validation rejects repeated role names within one profile payload
- Setup required:
  - None beyond local Node dependencies, because the test injects an in-memory repository
- Assertions made:
  - `POST /api/profiles` returns `400` when duplicate role names are sent
  - Error payload explains that role names must be unique within the profile

### news scraper API accepts default AI sources mode without custom URL and RSS input

- File: `server/news-scraper-api.test.mjs`
- What it tests:
  - A profile can be created in AI-recommended source mode without URL/RSS entries
- Setup required:
  - None beyond local Node dependencies, because the test injects an in-memory repository
- Assertions made:
  - `POST /api/profiles` returns `201` with `useCustomSources=false`
  - Response payload contains empty `urls` and `rssFeeds` arrays

### news scraper API accepts and returns notification channel ids

- File: `server/news-scraper-api.test.mjs`
- What it tests:
  - Profile create/update accepts valid `notificationChannelIds`
  - Returned payload preserves selected channel ids
- Setup required:
  - None beyond local Node dependencies, because the test injects an in-memory repository
- Assertions made:
  - `POST /api/profiles` and `PUT /api/profiles/:id` return selected notification channel ids

### news scraper API rejects invalid notification channel id values

- File: `server/news-scraper-api.test.mjs`
- What it tests:
  - Validation rejects malformed channel id values in `notificationChannelIds`
- Setup required:
  - None beyond local Node dependencies, because the test injects an in-memory repository
- Assertions made:
  - Invalid channel id values return `400` validation response

### news scraper API rejects unknown notification channel id references

- File: `server/news-scraper-api.test.mjs`
- What it tests:
  - Profile persistence rejects channel ids that do not exist
- Setup required:
  - None beyond local Node dependencies, because the test injects an in-memory repository
- Assertions made:
  - Unknown channel references return `400`

### news API returns profile-scoped news and persists favorite flag

- File: `server/news-scraper-api.test.mjs`
- What it tests:
  - `GET /api/news` returns only rows for the requested profile
  - News rows are ordered by most recent timestamp first
  - `PUT /api/news/{id}/favorite` persists boolean favorite state
- Setup required:
  - None beyond local Node dependencies, because the test injects an in-memory repository
- Assertions made:
  - `GET /api/news?profileId=<id>` returns expected profile-specific rows only
  - Newest row appears first in response order
  - Favorite update endpoint returns updated item with `favorite=true`
  - Subsequent list request shows persisted favorite state

### errors API supports create, list, search, and fetch-by-id

- File: `server/news-scraper-api.test.mjs`
- What it tests:
  - `POST /api/errors` creates a profile-scoped scrape error entry
  - `GET /api/errors` lists profile errors and supports text search
  - `GET /api/errors/{id}` returns a single error record for the same profile
- Setup required:
  - None beyond local Node dependencies, because the test injects an in-memory repository
- Assertions made:
  - Created error response contains normalized fields and an id
  - List endpoint returns the created item
  - Search query returns matching entries
  - Fetch-by-id endpoint returns expected workflow id

### scrape trigger clears existing profile errors before triggering workflow

- File: `server/news-scraper-api.test.mjs`
- What it tests:
  - `POST /api/news/profile/scrape` removes stale profile errors at scrape start
- Setup required:
  - Local upstream stub server for webhook target
- Assertions made:
  - Scrape trigger returns `202`
  - Error list for the profile is empty after trigger

### news API returns all profile-scoped rows even when roles are configured

- File: `server/news-scraper-api.test.mjs`
- What it tests:
  - News listing returns all rows for the selected profile, independent of profile role values
- Setup required:
  - None beyond local Node dependencies, because the test injects an in-memory repository
- Assertions made:
  - `GET /api/news?profileId=<id>` returns all profile-scoped rows even when role keywords appear only in a subset of items

### news API validates required profileId query parameter

- File: `server/news-scraper-api.test.mjs`
- What it tests:
  - `GET /api/news` rejects requests without a valid `profileId` query parameter
- Setup required:
  - None beyond local Node dependencies, because the test injects an in-memory repository
- Assertions made:
  - `GET /api/news` returns `400`
  - Error payload includes `profileId query parameter must be a positive integer.` and a valid `traceId`

### news favorite API validates profileId and favorite payload

- File: `server/news-scraper-api.test.mjs`
- What it tests:
  - `PUT /api/news/{id}/favorite` rejects non-integer `profileId` values in request body
  - `PUT /api/news/{id}/favorite` rejects non-boolean `favorite` values
- Setup required:
  - None beyond local Node dependencies, because the test injects an in-memory repository
- Assertions made:
  - Invalid `profileId` request returns `400` with `profileId in request body must be a positive integer.`
  - Invalid `favorite` request returns `400` with `favorite in request body must be a boolean.`
  - Both error responses include a valid `traceId`

### news favorite API validates news id path parameter

- File: `server/news-scraper-api.test.mjs`
- What it tests:
  - `PUT /api/news/{id}/favorite` rejects non-integer path id values
- Setup required:
  - None beyond local Node dependencies, because the test injects an in-memory repository
- Assertions made:
  - Request with non-integer path id returns `400`
  - Error payload includes `News id must be a positive integer.` and a valid `traceId`

### scrap trigger API returns 503 when workflow URL is not configured

- File: `server/news-scraper-api.test.mjs`
- What it tests:
  - Trigger endpoint fails fast when workflow URL configuration is missing
- Setup required:
  - None beyond local Node dependencies, because the test injects an in-memory repository
- Assertions made:
  - `POST /api/news/profile/scrape` returns `503`

### scrap trigger API validates profileId request body

- File: `server/news-scraper-api.test.mjs`
- What it tests:
  - Trigger endpoint validates `profileId` request payload
- Setup required:
  - None beyond local Node dependencies, because the test injects an in-memory repository
- Assertions made:
  - Invalid `profileId` values return `400` with validation message

### scrap trigger API forwards traceparent and returns accepted status

- File: `server/news-scraper-api.test.mjs`
- What it tests:
  - Trigger endpoint forwards trace context and accepts valid trigger requests
- Setup required:
  - Local upstream stub server for webhook target
- Assertions made:
  - `POST /api/news/profile/scrape` returns `202`
  - Upstream request receives forwarded `traceparent`

### scrap trigger API requires configured credentials

- File: `server/news-scraper-api.test.mjs`
- What it tests:
  - Trigger endpoint fails when required upstream credentials are not configured
- Setup required:
  - None beyond local Node dependencies, because the test injects an in-memory repository
- Assertions made:
  - Missing required credentials return non-success response (`502`/`503`) with error payload

### news scraper API propagates traceparent and returns traceId in 500 responses

- File: `server/news-scraper-api.test.mjs`
- What it tests:
  - Incoming W3C `traceparent` context is propagated through backend request handling
  - `500` response payload includes the same `traceId` for correlation
  - Response emits server-side `traceparent` header carrying the same `traceId`
- Setup required:
  - None beyond local Node dependencies, because the test injects a failing in-memory repository
- Assertions made:
  - `POST /api/profiles` returns `500` with `error` and `traceId`
  - `traceId` matches the incoming `traceparent`
  - Response `traceparent` header has valid format and matching `traceId`

### serializeProfileSnapshot returns the full normalized profile JSON

- File: `server/news-scraper-api.test.mjs`
- What it tests:
  - The Postgres persistence helper serializes the complete normalized profile payload
  - The JSON snapshot contains the same top-level fields and nested arrays sent through the profile repository boundary
- Setup required:
  - None beyond local Node dependencies
- Assertions made:
  - `serializeProfileSnapshot(profileInput)` matches `JSON.stringify(profileInput)` for a normalized profile payload

### serializeNotificationChannelSnapshot returns normalized channel JSON

- File: `server/news-scraper-api.test.mjs`
- What it tests:
  - The Postgres notification-channel persistence helper serializes normalized channel payloads for email and slack channel types
- Setup required:
  - None beyond local Node dependencies
- Assertions made:
  - Email channel payload serializes with `channelType="email"` and `emailAddresses`
  - Slack channel payload serializes with `channelType="slack"` and `slackWebhookUrl`

---

### Seed Data Integration Tests

All tests in this section are in `server/seed-data.test.mjs`.  
**Setup required:** API must be running and `npm run seed:profiles` must have been executed first.

#### exactly 4 profiles are seeded

- Verifies the total seeded profile count is exactly 4.

#### AI LLM profile exists

- Verifies the `AI LLM` profile is present.

#### Error Test Profile exists

- Verifies the `Error Test Profile` profile is present.

#### Agent Ecosystem profile exists

- Verifies the `Agent Ecosystem` profile is present.

#### Model Releases profile exists

- Verifies the `Model Releases` profile is present.

#### {Profile}: has at least 3 URLs _(for each of the 4 profiles)_

- Verifies each profile has a minimum of 3 URL entries.

#### {Profile}: has at least 3 RSS feeds _(for each of the 4 profiles)_

- Verifies each profile has a minimum of 3 RSS feed entries.

#### {Profile}: has at least 3 tags _(for each of the 4 profiles)_

- Verifies each profile has a minimum of 3 tags.

#### {Profile}: has at least 3 roles _(for each of the 4 profiles)_

- Verifies each profile has a minimum of 3 roles.

#### {Profile}: has exactly 3 news items _(for each of the 4 profiles)_

- Verifies exactly 3 news items are linked to each profile after seeding.

#### AI LLM profile contains https://invalid/ URL

- Verifies the invalid URL is present in the AI LLM profile for validation testing.

#### AI LLM profile contains specific valid URLs

- Verifies technologyreview.com, unite.ai, and aiuniverseexplorer.com URLs are present.

#### AI LLM profile contains https://invalid/rss.xml RSS feed

- Verifies the invalid RSS feed is present for feed error testing.

#### AI LLM profile contains https://planet-ai.net/rss.xml RSS feed

- Verifies the Planet AI feed is present.

#### AI LLM profile tags include llm, anthropic, claude

- Verifies all three required tags are present.

#### AI LLM profile roles include Solution Architect and Software Engineer

- Verifies both required roles are present.

#### Error Test Profile has exactly 3 seeded errors

- Verifies exactly 3 errors exist for the Error Test Profile.

#### Error Test Profile errors have deterministic trace IDs

- Verifies the 3 fixed trace IDs (`e4e4f6dd2df74f34b7746e72e5f67011/012/013`) are present.

#### Test Channel notification profile exists with correct email

- Verifies the `Test Channel` notification profile exists with `robert.bernhard71@gmail.com`.

## How to Run

```bash
npm run test:e2e
```

For backend API tests:

```bash
npm run test:api
```

For interactive debugging:

```bash
npm run test:e2e:ui
```
