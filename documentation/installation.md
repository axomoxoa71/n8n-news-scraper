# Installation

## Table of Contents

- [Installation](#installation)
  - [Table of Contents](#table-of-contents)
  - [Prerequisites](#prerequisites)
  - [Project Setup](#project-setup)
  - [Database Initialization](#database-initialization)
  - [Grafana OTEL Setup](#grafana-otel-setup)
  - [Run Modes](#run-modes)
    - [Development](#development)
    - [API Only](#api-only)
    - [Stop API](#stop-api)
    - [Restart API](#restart-api)
    - [Type Checking](#type-checking)
    - [API Tests](#api-tests)
    - [Production Build](#production-build)
    - [Local Production Preview](#local-production-preview)
    - [End-to-End Tests](#end-to-end-tests)
    - [Interactive End-to-End Test UI](#interactive-end-to-end-test-ui)
  - [Claude Desktop Configuration](#claude-desktop-configuration)
  - [MCP Inspector Usage](#mcp-inspector-usage)
  - [Troubleshooting](#troubleshooting)

## Prerequisites

- Node.js 20.x or newer
- npm 10.x or newer
- Git
- PostgreSQL 15.x or newer for durable profile storage
- Windows, macOS, or Linux

## Project Setup

1. Clone repository:

```bash
git clone https://github.com/axomoxoa71/news-scrapper.git
cd news-scrapper
```

2. Install dependencies:

```bash
npm install
```

3. Create local environment file:

```bash
copy .env.example .env
```

4. Edit `.env` and set your Postgres connection details:

- `PROFILE_STORE=postgres`
- `DATABASE_URL=postgresql://<user>:<password>@<host>:<port>/<database>`

If you prefer discrete variables instead of `DATABASE_URL`, use `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, and `PGPASSWORD`.

5. Start development server:

```bash
npm run dev
```

6. Open the local app URL shown in terminal. The default frontend URL is `http://localhost:5173` and the API runs on `http://127.0.0.1:4300`.

## Database Initialization

When `PROFILE_STORE=postgres`, startup is non-destructive by default and does not reinitialize schema unless explicitly enabled.

That startup initialization now also backfills `profiles_t.json` for older profiles and `notification_channels_t.json` for older channel rows that predate JSON snapshot columns.

- The startup path in `server/src/index.mjs` calls `repository.initialize()` before the server begins listening.
- Postgres initialization runs only when `INITIALIZE=true` is set.
- Initialization is non-destructive and does not execute `cleanup.sql`.
- The SQL file uses `CREATE TABLE IF NOT EXISTS`, so missing tables are created automatically.
- This means you do not need to run a migration command just to create the application tables.

What must already exist before startup:

- A reachable PostgreSQL server
- A database referenced by `DATABASE_URL` or `PGDATABASE`
- Valid credentials with permission to create tables, alter tables, and create indexes in that database

What gets created automatically:

- `profiles_t`
- `profile_urls_t`
- `rss_feeds_t`
- supporting indexes declared in `server/sql/init.sql`

What does not get created automatically:

- The PostgreSQL server itself
- The target database named in your connection string
- The database user or its permissions

If the database does not exist yet, create it first and then start the API. Example:

```bash
createdb news_scrapper
npm run dev
```

If you want to apply the schema manually before starting the API, run:

```bash
psql "$DATABASE_URL" -f server/sql/init.sql
```

Manual initialization is optional. In normal development, starting the API is enough.

## Profile Seeding

After the database is initialized, you can optionally seed predefined profiles (like "AI Demo") using one of these methods.

### Option 1: Seed via API (Recommended)

```bash
# Make sure the API is running (npm run start:api or npm run dev)
npm run seed:profiles
```

### Option 2: Seed via SQL (Direct Database)

```bash
npm run seed:sql
```

If you need to explicitly drop all tables, use:

```bash
npm run db:drop:all
```

For details and customization, see [server/sql/SEED.md](../../server/sql/SEED.md).

## Grafana OTEL Setup

This project can export backend traces to Grafana using OpenTelemetry.

1. Set backend OTEL variables (PowerShell example):

```powershell
$env:GRAFANA_OTLP_ENDPOINT="https://otlp-gateway-prod-us-central-0.grafana.net/otlp"
$env:GRAFANA_OTLP_USERNAME="<grafana_instance_id>"
$env:GRAFANA_OTLP_API_KEY="<grafana_api_key>"
$env:OTEL_SERVICE_NAME="news-scrapper-api"
$env:OTEL_DEPLOYMENT_ENVIRONMENT="local"
```

2. Start API (OTEL auto-starts when endpoint is configured):

```bash
npm run start:api
```

3. Optional: run OTEL Collector as a local gateway (recommended for production):

```powershell
$env:GRAFANA_OTLP_ENDPOINT="https://otlp-gateway-prod-us-central-0.grafana.net/otlp"
$env:GRAFANA_OTLP_AUTH_B64="<base64(username:api_key)>"
otelcol-contrib --config observability/otel-collector-config.yaml
```

4. To route backend through collector instead of direct Grafana export:

```powershell
$env:OTEL_EXPORTER_OTLP_ENDPOINT="http://127.0.0.1:4318"
```

With this setup, backend traces appear in Grafana Tempo. UI error messages include trace IDs that can be searched in logs/traces.

## Run Modes

### Development

```bash
npm run dev
```

This starts both the Vite frontend and the profile API.

### API Only

```bash
npm run start:api
```

`start:api` now runs a pre-start cleanup hook (`prestart:api`) that automatically kills any stale listener on port `4300` before starting the API process.

### Stop API

```bash
npm run stop:api
```

Use this to explicitly stop any process currently listening on API port `4300`.

### Restart API

```bash
npm run restart:api
```

This runs `stop:api` followed by `start:api`.

### Type Checking

```bash
npm run typecheck
```

### API Tests

```bash
npm run test:api
```

### Production Build

```bash
npm run build
```

### Local Production Preview

```bash
npm run preview
```

### End-to-End Tests

```bash
npm run test:e2e
```

### Interactive End-to-End Test UI

```bash
npm run test:e2e:ui
```

## Claude Desktop Configuration

This repository currently contains a web application and does not include a Claude Desktop MCP server implementation.

If an MCP server is added in the future, document the following here:

- MCP server executable command
- Required environment variables
- Claude Desktop config JSON snippet
- Verification steps

## MCP Inspector Usage

No MCP server is currently exposed by this repository, so MCP Inspector is not required for the current implementation.

If MCP support is added later, this section should include:

- Inspector launch command
- Connection endpoint details
- Example tool invocation and response validation

## Troubleshooting

- If dev server fails after dependency updates, remove `node_modules` and run `npm install` again.
- If the API fails to start with `ECONNREFUSED` or authentication errors, verify the values in your local `.env` file and confirm Postgres is reachable.
- If you close a terminal and suspect the API is still running, use `npm run stop:api` before starting a new API session.
- If the API fails with `database does not exist`, create the database first, then restart the API. Table creation is automatic only after a connection to an existing database succeeds.
- If you want to run without Postgres temporarily, remove database env vars or set `PROFILE_STORE=memory`.
- If Playwright tests fail with browser missing errors, run:

```bash
npx playwright install chromium
```

- If stale assets are shown in browser, hard-refresh the page (`Ctrl+F5` on Windows).
