# Environment Variables

## Table of Contents

1. [Defined Variables](#defined-variables)
2. [How Variables Are Used](#how-variables-are-used)
3. [Security Guidance](#security-guidance)

## Defined Variables

| Name                                 | Description                                                                                                                | Possible Values         | Default Value                                 |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- | ----------------------- | --------------------------------------------- |
| `CI`                                 | Indicates execution in CI environment; used by Playwright to enable retries and non-reuse behavior                         | `true`, `false`, unset  | Unset in local development                    |
| `NEWS_SCRAPER_ENV_FILE`              | Absolute path to an external env source loaded by the backend process (file path or directory containing shared env files) | Any valid absolute path | `C:\Users\rober15\.newsscraper`               |
| `PROFILE_STORE`                      | Selects the profile repository implementation for the API layer                                                            | `memory`, `postgres`    | `memory` unless Postgres env vars are present |
| `PORT`                               | TCP port used by the profile API server                                                                                    | Any valid port number   | `4300`                                        |
| `DATABASE_URL`                       | Full Postgres connection string for the profile API                                                                        | Standard Postgres URI   | Unset                                         |
| `PGHOST`                             | Postgres hostname when not using `DATABASE_URL`                                                                            | Hostname or IP          | Unset                                         |
| `PGPORT`                             | Postgres port when not using `DATABASE_URL`                                                                                | Valid port number       | `5432` when set through config fallback       |
| `PGDATABASE`                         | Postgres database name                                                                                                     | Any valid database name | Unset                                         |
| `PGUSER`                             | Postgres username                                                                                                          | Any valid username      | Unset                                         |
| `PGPASSWORD`                         | Postgres password                                                                                                          | Any valid password      | Unset                                         |
| `PGSSLMODE`                          | Controls SSL usage for Postgres connections                                                                                | `disable`, `require`    | `disable`                                     |
| `SCRAP_WEBHOOK_URL`                  | Scrape webhook endpoint URL used by backend route `POST /api/news/profile/scrape`                                          | Valid HTTP/HTTPS URL    | Unset (trigger route returns `503`)           |
| `N8N_WORKFLOW_URL`                   | Legacy alias for `SCRAP_WEBHOOK_URL`                                                                                       | Valid HTTP/HTTPS URL    | Unset                                         |
| `BASIC_AUTH_USER`                    | Basic auth username used when calling the scrape webhook                                                                   | Any non-empty string    | Unset (trigger route returns `503`)           |
| `BASIC_AUTH_PWD`                     | Basic auth password used when calling the scrape webhook                                                                   | Any non-empty string    | Unset (trigger route returns `503`)           |
| `OTEL_SDK_DISABLED`                  | Disables backend OpenTelemetry SDK startup when set to true                                                                | `true`, `false`         | `false` when OTLP target is configured        |
| `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` | Full OTLP HTTP traces endpoint used directly by the backend OTEL exporter                                                  | Any valid OTLP URL      | Unset                                         |
| `OTEL_EXPORTER_OTLP_ENDPOINT`        | Base OTLP endpoint used by the backend OTEL exporter (`/v1/traces` is appended automatically)                              | Any valid OTLP URL      | Unset                                         |
| `OTEL_EXPORTER_OTLP_HEADERS`         | Comma-separated OTLP headers for backend exporter auth (for example `Authorization=Basic <token>`)                         | Header list string      | Unset                                         |
| `OTEL_SERVICE_NAME`                  | Service name attached to exported telemetry resource metadata                                                              | Any non-empty string    | `news-scrapper-api`                           |
| `OTEL_SERVICE_VERSION`               | Service version attached to exported telemetry resource metadata                                                           | Semver or version text  | Unset                                         |
| `OTEL_DEPLOYMENT_ENVIRONMENT`        | Deployment environment resource attribute for traces (for example `local`, `dev`, `prod`)                                  | Any non-empty string    | Unset                                         |
| `GRAFANA_OTLP_ENDPOINT`              | Grafana Cloud OTLP gateway base URL used by backend exporter and collector exporter                                        | Any Grafana OTLP URL    | Unset                                         |
| `GRAFANA_OTLP_USERNAME`              | Grafana Cloud OTLP username (instance identifier) used by backend OTEL bootstrap to build Basic auth header                | Grafana instance ID     | Unset                                         |
| `GRAFANA_OTLP_API_KEY`               | Grafana Cloud API key used by backend OTEL bootstrap to build Basic auth header                                            | API key with OTLP scope | Unset                                         |
| `GRAFANA_OTLP_AUTH_B64`              | Base64 encoded `username:api_key` used by collector config (`Authorization: Basic ...`)                                    | Base64 string           | Unset                                         |

## How Variables Are Used

- `playwright.config.js` checks `process.env.CI` to:
  - Increase retries in CI (`retries: 2`)
  - Disable reuse of existing server in CI (`reuseExistingServer: false`)
- `server/src/index.mjs` loads `.env` from the repository root, then resolves `NEWS_SCRAPER_ENV_FILE` (or defaults to `C:\Users\rober15\.newsscraper`).
- If `NEWS_SCRAPER_ENV_FILE` points to a directory, the backend loads known shared env files (`postgres.env`, `n8n.env`) from that directory when present.
- If `NEWS_SCRAPER_ENV_FILE` points to a directory, environment-specific webhook files are discovered by naming convention:
  - `*.prod.env` for Production
  - `*.test.env` for Test
- If `NEWS_SCRAPER_ENV_FILE` points to a file, that file is loaded directly.
- Loaded external values fill missing keys, while explicitly provided process environment values remain authoritative.
- `server/src/config.mjs` reads `PROFILE_STORE`, `PORT`, and the Postgres variables to configure the API process.
- `server/src/config.mjs` also reads scrape webhook settings (`SCRAP_WEBHOOK_URL`, `N8N_WORKFLOW_URL`, `BASIC_AUTH_USER`, `BASIC_AUTH_PWD`).
- `src/api/profiles.ts` sends `x-app-environment` (`production` or `test`) with each API request.
- `server/src/config.mjs` resolves environment-aware scrape webhook settings from the selected `*.prod.env` / `*.test.env` file using original variable names (`SCRAP_WEBHOOK_URL`, `N8N_WORKFLOW_URL`, `BASIC_AUTH_USER`, `BASIC_AUTH_PWD`).
- `server/src/repository.mjs` switches between the in-memory repository and the Postgres repository.
- `server/src/postgres-repository.mjs` passes `DATABASE_URL` or the `PG*` values to the `pg` connection pool.
- `server/src/app.mjs` exposes `POST /api/news/profile/scrape`, validates `profileId`, builds the combined `scrape.profile` and `scrape.informationChannel` payload, propagates `traceparent`, and forwards to `SCRAP_WEBHOOK_URL` using configured basic auth credentials.
- `server/src/app.mjs` route `POST /api/news/profile/scrape` chooses webhook URL and credentials using the incoming `x-app-environment` request header.
- `server/src/index.mjs` starts the backend OTEL SDK when an OTLP target is configured and OTEL is not disabled.
- If OTEL is disabled or no OTLP target is configured, backend request/error logs continue to be emitted to terminal as structured JSON.
- `server/src/otel.mjs` configures OTEL auto-instrumentation and OTLP trace export using either:
  - Standard OTEL variables (`OTEL_EXPORTER_OTLP_*`), or
  - Grafana convenience variables (`GRAFANA_OTLP_ENDPOINT`, `GRAFANA_OTLP_USERNAME`, `GRAFANA_OTLP_API_KEY`).
- `observability/otel-collector-config.yaml` reads `GRAFANA_OTLP_ENDPOINT` and `GRAFANA_OTLP_AUTH_B64` for collector-side forwarding to Grafana.
- `.env.example` documents the expected local shape for backend configuration.

## Security Guidance

- Keep machine-level credentials in external env files (for example `C:\Users\rober15\.newsscraper\postgres.env` and `C:\Users\rober15\.newsscraper\n8n.env`) instead of repository files.
- If needed, steer the backend to another external secret file by setting `NEWS_SCRAPER_ENV_FILE`.
- Avoid storing database credentials inside repository files.
- Do not commit `.env`; it is ignored by git in this repository.
- In CI or deployment environments, set these variables in the platform secret store instead of writing them to files.
- Use a dedicated database user with only the privileges needed for this application.
- Rotate database passwords and connection strings regularly.
