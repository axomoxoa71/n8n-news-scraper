# Profiles Requirements

## Table of Contents

- [Profiles Requirements](#profiles-requirements)
  - [Table of Contents](#table-of-contents)
  - [Purpose](#purpose)
  - [Functional Requirements](#functional-requirements)
  - [Non-Functional Requirements](#non-functional-requirements)
  - [User Stories and Use Cases](#user-stories-and-use-cases)
  - [Acceptance Criteria](#acceptance-criteria)

## Purpose

Define requirements for creating, editing, validating, and maintaining profile configurations used by scraping, chatbot context, and news filtering.

## Functional Requirements

1. The system must support create, read, update, and delete operations for profiles.
2. A profile must include a required name and optional description.
3. A profile must support `useCustomSources` to toggle user-managed URL/RSS sources.
4. When `useCustomSources=true`, at least one URL and one RSS feed must be provided.
5. The profile editor must support TAGS and ROLES chip-style inputs.
6. Tag and role values must be unique per profile, case-insensitive.
7. A profile must support optional notification channel selection via `notificationChannelIds`.
8. Profile forms must support Add flow in a modal dialog and Edit flow from saved profile list.
9. The root layout must provide an active profile selector that scopes Chatbot and News pages.

## Non-Functional Requirements

1. UI text must be in English.
2. The profile workflow must be usable on desktop and mobile breakpoints.
3. Validation errors must be actionable and shown inline where possible.
4. On backend/API failure, user-visible errors must include trace ID when provided.
5. Profile APIs must emit structured logs with trace context for correlation.

## User Stories and Use Cases

1. As an analyst, I want to create a profile with custom URLs and RSS feeds so that I can monitor trusted sources.
2. As a manager, I want to add role metadata so that relevant news can be prioritized by audience.
3. As an operator, I want to attach notification channels to a profile so that downstream alerts can be routed correctly.
4. As a user, I want to switch active profile from the header so that Chatbot and News views use the same context.
5. As a support engineer, I want trace IDs in error messages so that I can correlate UI failures with backend logs.

## Acceptance Criteria

1. Creating a profile with valid required fields returns success and displays the saved profile.
2. Creating or updating a profile with duplicate tags or roles fails with a validation message.
3. Saving with `useCustomSources=false` succeeds with empty URL/RSS arrays.
4. Disabling custom mode after entering URL/RSS values prompts confirmation and clears source entries on confirmation.
5. Selecting a different active profile changes the context shown on Chatbot and News pages.
6. Saving with invalid or unknown `notificationChannelIds` fails with a `400` validation error.
