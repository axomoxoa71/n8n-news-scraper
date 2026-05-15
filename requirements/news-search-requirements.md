# News Search Requirements

## Table of Contents

- [News Search Requirements](#news-search-requirements)
  - [Table of Contents](#table-of-contents)
  - [Purpose](#purpose)
  - [Functional Requirements](#functional-requirements)
  - [Non-Functional Requirements](#non-functional-requirements)
  - [User Stories and Use Cases](#user-stories-and-use-cases)
  - [Acceptance Criteria](#acceptance-criteria)

## Purpose

Define requirements for retrieving, searching, filtering, sorting, and paginating profile-scoped news results.

## Functional Requirements

1. The News page must load news by selected profile using `GET /api/news?profileId={id}`.
2. The page must provide keyword filtering over title and summary fields.
3. The page must provide favorites-only filtering.
4. The page must support sorting by newest-first and oldest-first.
5. The page must support pagination for larger result sets.
6. Favorite state updates must persist through `PUT /api/news/{id}/favorite`.
7. The News page must support manual refresh and periodic auto-refresh.
8. When roles exist on the selected profile, role relevance filtering and prioritization of collected news is handled by the n8n scraping workflow layer, not by the UI or API. Profile roles are forwarded to n8n as part of the scrape payload so the workflow can apply relevance logic during collection.

## Non-Functional Requirements

1. Results and controls must remain responsive on desktop and mobile screen sizes.
2. Search and filtering operations must not block the UI for normal data volumes.
3. Empty states must be explicit and understandable in English.
4. API validation failures must be handled safely and shown with trace ID when available.
5. News interactions must preserve accessibility expectations for keyboard and screen reader users.

## User Stories and Use Cases

1. As a reader, I want to search by keyword so I can quickly find relevant AI news.
2. As a reader, I want to mark favorites so I can revisit important items.
3. As a product lead, I want oldest/newest sorting so I can analyze historical progression.
4. As a user, I want pagination so that long result lists remain easy to navigate.
5. As a user, I want news context to follow my selected profile so that results stay relevant.

## Acceptance Criteria

1. Entering a keyword filters visible rows and clearing it restores default list behavior.
2. Toggling favorites-only displays only rows with `favorite=true`.
3. Sort selection changes ordering consistently for the current result set.
4. Updating favorite state persists and is reflected after refresh.
5. Missing or invalid `profileId` from API calls returns a handled error state.
6. Pagination controls correctly disable previous/next at boundaries.
