# Logging

## Table of Contents

1. [Overview](#overview)
2. [Backend Logging Framework](#backend-logging-framework)
3. [Web Logging Framework](#web-logging-framework)
4. [Log Structure](#log-structure)
5. [Trace Context Propagation](#trace-context-propagation)
6. [Error Logging](#error-logging)
7. [Examples](#examples)
8. [Level Guidance](#level-guidance)

## Overview

The backend emits structured JSON logs to stdout and propagates W3C trace context (`traceparent`) across inbound and outbound HTTP calls.

Goals:

- Keep request, error, and downstream-call events correlated by `trace_id`.
- Ensure every API error includes a `traceId` in the response body for UI correlation.
- Preserve compatibility with OTEL export when enabled, while still logging to terminal in all environments.

## Backend Logging Framework

- Logging implementation: `pino` via `server/src/logger.mjs` and `server/src/app.mjs`.
- Output target: process stdout (JSON lines).
- Request lifecycle logging:
  - Middleware creates trace context from incoming `traceparent` or generates a new one.
  - Middleware emits `http_request_completed` on response finish with latency and status.
- OTEL integration:
  - `server/src/index.mjs` conditionally starts OTEL SDK via `server/src/otel.mjs` when an OTLP endpoint is configured.
  - Structured logs continue even when OTEL export is disabled or unavailable.

## Web Logging Framework

- Logging implementation: `pino` browser logger via `src/logger.ts`.
- Instrumentation point: `src/api/profiles.ts` (`apiFetch` and `handleApiResponse`).
- Request lifecycle logging:
  - Emits `http_request_completed` for every web-to-API call.
  - Emits `http_request_failed` for network/runtime fetch failures.
  - Emits `http_response_error` for non-2xx API responses.

## Log Structure

All logs are emitted as structured JSON lines. The human-readable prefix is stored in a dedicated field:

- Prefix format: `[layer-severity-timestamp-traceid]`
- Prefix field: `log_prefix`
- Example prefix value: `[api-info-2026-05-07T11:22:08.464Z-e123654aa0d392b30483b877f99f7acb]`

The JSON payload has shared baseline fields:

- `timestamp`: ISO-8601 timestamp.
- `level`: severity (`info`, `error`).
- `message`: event name.
- `log_prefix`: formatted correlation prefix for quick scanning in terminal output.

Request-scoped logs include:

- `trace_id`: current trace id.
- `span_id`: current span id.
- `parent_span_id`: parent span id when incoming trace exists.
- `http_method`: request method.
- `http_route`: request URL.
- `http_status_code`: response status code.
- `duration_ms`: elapsed request duration (for completion logs).

Error logs may include:

- `error_name`
- `error_message`
- `error_stack`
- Additional context such as `workflow_url` for scrape webhook trigger failures.

## Trace Context Propagation

Inbound:

- API reads `traceparent` header.
- Valid trace ids are reused; malformed or all-zero ids are rejected and replaced.
- API sets a response `traceparent` header for client correlation.

Outbound:

- API client (`src/api/profiles.ts`) generates a `traceparent` for each browser request.
- Backend forwards request trace context to downstream webhook calls on `POST /api/news/profile/scrape`.
- Web logger keeps the generated request `trace_id` in client-side logs and links API error logs using backend `traceId` when returned.

UI correlation:

- Backend error responses include `traceId`.
- UI error handling shows trace id when available.

## Error Logging

Unhandled API exceptions are logged as `profiles_api_unhandled_error` with trace and HTTP metadata before a `500` response is sent.

Downstream scrape webhook failures are logged as:

- `scrap_webhook_trigger_failed` when the upstream response status is non-2xx.
- `scrap_webhook_trigger_error` when network/runtime exceptions occur.

## Examples

Request completion log:

```text
{"level":30,"timestamp":"2026-05-06T10:15:12.113Z","log_prefix":"[api-info-2026-05-06T10:15:12.113Z-5a6fcb5f0a8647efbf66d7078f629f6e]","layer":"api","trace_id":"5a6fcb5f0a8647efbf66d7078f629f6e","span_id":"24a7a2205f279d35","parent_span_id":null,"http_method":"GET","http_route":"/api/profiles","http_status_code":200,"duration_ms":4.129,"message":"http_request_completed"}
```

Unhandled error log:

```text
{"level":50,"timestamp":"2026-05-06T10:16:01.412Z","log_prefix":"[api-error-2026-05-06T10:16:01.412Z-e7f0f4b8d2f24557b4f9e8931c9df316]","layer":"api","trace_id":"e7f0f4b8d2f24557b4f9e8931c9df316","span_id":"b8b0dc4f2a9d1c06","parent_span_id":"0d06c1770f3f519f","http_method":"POST","http_route":"/api/profiles","error_name":"Error","error_message":"Simulated repository failure","message":"profiles_api_unhandled_error"}
```

Scrape webhook upstream failure log:

```text
{"level":50,"timestamp":"2026-05-06T10:17:44.002Z","log_prefix":"[webhook-error-2026-05-06T10:17:44.002Z-4d49e94d0cb84f3ca0f170f2ec98d2dd]","layer":"webhook","trace_id":"4d49e94d0cb84f3ca0f170f2ec98d2dd","span_id":"31ef4f5d665dd280","parent_span_id":null,"http_status_code":500,"workflow_url":"https://example.com/webhook/scrape","message":"scrap_webhook_trigger_failed"}
```

Web request completion log:

```text
{"level":30,"timestamp":"2026-05-07T12:05:33.221Z","log_prefix":"[web-info-2026-05-07T12:05:33.221Z-88f44a4f4135f32e62fd9f48de436e65]","layer":"web","trace_id":"88f44a4f4135f32e62fd9f48de436e65","http_method":"GET","http_route":"/api/news?profileId=3","http_status_code":200,"duration_ms":38.447,"message":"http_request_completed"}
```

## Level Guidance

- `info`:
  - Normal request completion and lifecycle events.
- `error`:
  - Unhandled exceptions.
  - Downstream dependency failures.
  - Any event that produces a `5xx` response.

Keep logs concise, structured, and free of sensitive data:

- Do not log credentials, API keys, or full connection strings.
- Prefer stable identifiers (`trace_id`, route, status code) over raw payload dumps.
