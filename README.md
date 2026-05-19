# AI News Scrapper

## Table of Contents

1. [What This Project Is](#what-this-project-is)
2. [Key Features](#key-features)
3. [Quick Start](#quick-start)
4. [Architecture](#architecture)
5. [Documentation Index](#documentation-index)

## What This Project Is

AI News Scrapper is a React + TypeScript web application with a small Node API layer for browsing AI news content and managing collection profiles backed by Postgres.

The application provides an entry experience for navigating between:

- Profiles configuration with editable URLs and RSS settings
- Profiles configuration with editable tags, URLs, and RSS settings
- Chatbot interaction
- News listing (title, summary, origin, link, timestamp, favorite)

The current implementation uses a Vite frontend, an Express-based API, and Playwright-based end-to-end validation. News content is retrieved through API endpoints backed by repository storage, and Chatbot interaction with history and quick replies is available through backend API endpoints.

## Key Features

- Dark-themed entry page with AI News branding/logo
- Route-based navigation (`/`, `/profiles`, `/chatbot`, `/news`)
- Multi-profile editor with required name, reusable tags, repeated source URLs, RSS feed settings, and saved profile actions
- API layer for profile CRUD operations at `/api/profiles`
- API layer for profile-scoped news retrieval and favorite toggling at `/api/news`
- Postgres-backed profile persistence when database environment variables are configured
- News page with structured columns:
  - Title
  - Summary
  - Origin
  - Timestamp
  - Link
- News page controls for:
  - Auto-refresh every 5 minutes
  - Manual refresh button
  - Last refresh indicator
  - Keyword filtering on title and summary
  - Favorites-only filtering
- Automated browser tests with Playwright
- TypeScript configuration and type-check script

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Run development server:

```bash
npm run dev
```

3. Configure the backend securely:

- Copy `.env.example` to a local `.env`
- Set `PROFILE_STORE=postgres`
- Provide `DATABASE_URL` or the `PG*` variables described in `documentation/environment-variables.md`
- Keep `.env` untracked; it is ignored by git

4. Build production bundle:

```bash
npm run build
```

5. Run type checks:

```bash
npm run typecheck
```

6. Run end-to-end tests:

```bash
npm run test:e2e
```

## Architecture

```mermaid
graph TD
	Browser[Browser] --> Main[main.tsx]
	Main --> Router[BrowserRouter]
	Router --> App[App Shell]
	App --> ApiClient[/api fetch client/]
	ApiClient --> Api[Express API]
	Api --> Repo[Profiles Repository]
	Repo --> Postgres[(Postgres)]

	App --> Home[Home Page]
	App --> Profiles[Profiles Page]
	App --> Chatbot[Chatbot Page]
	App --> News[News Page]

	Home --> Logo[src/resources/logo.png]
	News --> NewsApi[/api/news]
	NewsApi --> NewsTable[(news_t)]

	Playwright[Playwright Tests] --> DevStack[Vite + API Dev Stack]
	DevStack --> App
	DevStack --> Api
```

## Documentation Index

- Implementation details: [documentation/implementation.md](documentation/implementation.md)
- Logging strategy: [documentation/logging.md](documentation/logging.md)
- Installation guide: [documentation/installation.md](documentation/installation.md)
- News Scraper API reference: [documentation/api/news-scraper-api.md](documentation/api/news-scraper-api.md)
- Dependencies reference: [documentation/dependencies.md](documentation/dependencies.md)
- Environment variables: [documentation/environment-variables.md](documentation/environment-variables.md)
- Main screen requirements: [requirements/main-screen-requirements.md](requirements/main-screen-requirements.md)
- Profile requirements: [requirements/profiles-requirements.md](requirements/profiles-requirements.md)
- News search requirements: [requirements/news-search-requirements.md](requirements/news-search-requirements.md)
- Notification channel requirements: [requirements/notification-channels-requirements.md](requirements/notification-channels-requirements.md)
- Chatbot requirements: [requirements/chatbot-requirements.md](requirements/chatbot-requirements.md)
- Chatbot chat screen requirements: [requirements/chatbot-chat-requirements.md](requirements/chatbot-chat-requirements.md)
- Chatbot history screen requirements: [requirements/chatbot-history-requirements.md](requirements/chatbot-history-requirements.md)
- Error management requirements: [requirements/error-management-requirements.md](requirements/error-management-requirements.md)
- Tests inventory: [tests.md](tests.md)
- Tool documentation: [tools.md](tools.md)
