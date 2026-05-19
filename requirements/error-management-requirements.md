# Error Management Requirements

## Table of Contents

- [Error Management Requirements](#error-management-requirements)
  - [Table of Contents](#table-of-contents)
  - [Purpose](#purpose)
  - [Functional Requirements](#functional-requirements)
  - [Non-Functional Requirements](#non-functional-requirements)
  - [User Stories and Use Cases](#user-stories-and-use-cases)
  - [Acceptance Criteria](#acceptance-criteria)

## Purpose

Define requirements for collecting, validating, storing, searching, and presenting scrape and workflow errors with traceable diagnostics.

## Functional Requirements

1. The API must expose global error listing through `GET /api/errors` with optional search query and optional `profileId` filter.
2. The API must expose error details through `GET /api/errors/:id` with optional `profileId` filter.
3. The API must allow creating error entries through `POST /api/errors` with required workflow and execution metadata.
4. Error creation must validate required fields: `profileId`, `errorMessage`, `executionId`, `nodeName`, `nodeType`, `workflowName`, `workflowId`.
5. `errorHttpCode`, when provided, must be validated as a 3-digit integer (100-999).
6. The UI must show an Errors page across all profiles by default and support free-text search across key error fields.
7. The UI must auto-refresh and manual-refresh error data and display last refresh time.
8. The UI must provide details view capabilities for large fields (message, stack, payload) and support copy-to-clipboard.
9. If no errors exist globally, the UI must keep the Errors page available and show a clear empty state.
10. Starting a new scrape run must clear prior errors for the selected profile before processing fresh results.

## Non-Functional Requirements

1. Error UI must clearly communicate failure state in English.
2. Error retrieval and filtering must remain responsive for normal profile-level error volumes.
3. User-visible API failures must include trace ID when available.
4. Error handling paths must log structured events with trace context.
5. Error diagnostics shown in UI must preserve key troubleshooting attributes (trace ID, execution ID, workflow and node metadata).

## User Stories and Use Cases

1. As an operator, I want to view the latest scrape errors for a profile so I can quickly detect run failures.
2. As a support engineer, I want to search errors by trace ID or execution ID so I can investigate incidents efficiently.
3. As a developer, I want full workflow and node context in each error so root-cause analysis is faster.
4. As a user, I want one-click refresh and optional auto-refresh so I can monitor new errors during active runs.
5. As a troubleshooter, I want to copy long error details to clipboard so I can share diagnostics.

## Acceptance Criteria

1. Calling `GET /api/errors` without `profileId` returns global results; if `profileId` is provided and invalid, the API returns handled `400` validation error.
2. Creating an error without any required field returns handled `400` validation error.
3. Creating an error with invalid `errorHttpCode` (outside 100-999) returns handled `400` validation error.
4. Errors page filters list results using user-entered search terms and keeps newest items first.
5. Errors page supports manual refresh and optional periodic auto-refresh.
6. Error detail content can be opened and copied for message, stack, and payload diagnostics.
