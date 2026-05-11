# News Scraper API

## Table of Contents

- [News Scraper API](#news-scraper-api)
  - [Table of Contents](#table-of-contents)
  - [Overview](#overview)
  - [Endpoints](#endpoints)
  - [OpenAPI Specification](#openapi-specification)
  - [OpenAPI UI](#openapi-ui)
  - [Examples](#examples)

## Overview

The API exposes profile CRUD operations and profile-scoped news operations for the News page. It is served by the Node backend under `/api` and persists to Postgres when database environment variables are configured.

Profiles can optionally include notification channel selection metadata. Multi-select values are accepted through `notificationChannelIds` and persisted in the profile snapshot. For compatibility, `notificationProfileId` is also accepted and returned.

When notification channel IDs are provided, every selected ID must reference an existing notification profile (`/api/notification-profiles`); unknown IDs are rejected with `400`.

Profile-scoped scrape errors are persisted in `error_t` and exposed through `/api/errors` endpoints. Before each new scrape trigger (`POST /api/news/profile/scrape`), existing errors for the selected profile are cleared so only errors from the latest scrape run remain visible.

Error payloads include `traceId` for cross-layer troubleshooting and log correlation. `POST /api/errors` accepts `traceId` optionally; if omitted, the backend generates a fallback trace ID.

## Endpoints

- `GET /api/health`
- `GET /api/profiles`
- `POST /api/profiles`
- `PUT /api/profiles/{id}`
- `DELETE /api/profiles/{id}`
- `GET /api/news?profileId={id}`
- `PUT /api/news/{id}/favorite`
- `GET /api/errors?profileId={id}&search={term}`
- `GET /api/errors/{id}?profileId={id}`
- `POST /api/errors`
- `GET /api/notification-profiles`
- `POST /api/notification-profiles`
- `PUT /api/notification-profiles/{id}`
- `DELETE /api/notification-profiles/{id}`
- `POST /api/news/profile/scrape`

## OpenAPI Specification

The standalone OpenAPI specification is maintained in:

- [news-scraper-openapi.yaml](news-scraper-openapi.yaml)
- Open in Swagger Editor: [Swagger Editor (news-scraper-openapi.yaml)](https://editor.swagger.io/?url=https://raw.githubusercontent.com/axomoxoa71/news-scrapper/main/documentation/api/news-scraper-openapi.yaml)

For convenience, you can also open the raw spec directly:

```yaml
$ref: ./news-scraper-openapi.yaml
```

## OpenAPI UI

You have two options for a Swagger-like view generated from the OpenAPI YAML.

1. Local interactive Swagger UI preview (recommended during development):

```bash
npm run openapi:preview
```

Then open `http://127.0.0.1:8090`.

2. Generated static HTML documentation from the same spec:

```bash
npm run openapi:build
```

This generates:

- [html/news-scraper-openapi.html](html/news-scraper-openapi.html)

## Examples

Create profile request:

```json
{
  "name": "Daily AI Movers",
  "description": "Tracks vendor announcements and research updates.",
  "useCustomSources": true,
  "tags": ["vendors", "research"],
  "roles": ["Engineer", "CTO"],
  "urls": [
    {
      "url": "https://example.com/announcements",
      "description": "Vendor announcements"
    }
  ],
  "rssFeeds": [
    {
      "feedUrl": "https://example.com/feed.xml",
      "title": "Daily Movers Feed",
      "refreshCadence": "Every 30 minutes",
      "format": "RSS 2.0",
      "category": "AI product updates"
    }
  ]
}
```

List profiles response:

```json
[
  {
    "id": 1,
    "name": "Daily AI Movers",
    "description": "Tracks vendor announcements and research updates.",
    "useCustomSources": true,
    "tags": ["vendors", "research"],
    "roles": ["Engineer", "CTO"],
    "urls": [
      {
        "url": "https://example.com/announcements",
        "description": "Vendor announcements"
      }
    ],
    "rssFeeds": [
      {
        "feedUrl": "https://example.com/feed.xml",
        "title": "Daily Movers Feed",
        "refreshCadence": "Every 30 minutes",
        "format": "RSS 2.0",
        "category": "AI product updates"
      }
    ]
  }
]
```

Create profile request with AI-recommended sources:

```json
{
  "name": "AI Suggested Sources",
  "description": "Use AI to select high-quality sources",
  "useCustomSources": false,
  "tags": [],
  "urls": [],
  "rssFeeds": []
}
```

List news response:

```json
[
  {
    "id": 12,
    "profileId": 1,
    "title": "Open-source agent benchmark published",
    "summary": "New benchmark compares autonomous coding agents.",
    "origin": "Agent Weekly",
    "link": "https://example.com/news/agent-benchmark",
    "timestamp": "2026-05-06T10:30:00.000Z",
    "favorite": false
  }
]
```

Update favorite request:

```json
{
  "profileId": 1,
  "favorite": true
}
```
