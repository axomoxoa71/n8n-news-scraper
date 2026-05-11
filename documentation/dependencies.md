# Dependencies

## Table of Contents

1. [Runtime Dependencies](#runtime-dependencies)
2. [Development Dependencies](#development-dependencies)
3. [Dependency Notes](#dependency-notes)
4. [Security Scan Tooling](#security-scan-tooling)

## Runtime Dependencies

| Package                                   | Purpose                                                              |
| ----------------------------------------- | -------------------------------------------------------------------- |
| concurrently                              | Runs frontend and backend dev processes together                     |
| dotenv                                    | Loads backend environment variables from local `.env` files          |
| express                                   | HTTP API layer for profile CRUD routes                               |
| @opentelemetry/sdk-node                   | OpenTelemetry Node SDK bootstrap for backend tracing                 |
| @opentelemetry/auto-instrumentations-node | Automatic instrumentation for HTTP/Express and common Node libraries |
| @opentelemetry/exporter-trace-otlp-http   | OTLP HTTP trace exporter used to send traces to collector/Grafana    |
| @opentelemetry/resources                  | Resource metadata helpers for service attributes                     |
| @opentelemetry/semantic-conventions       | Standard semantic attribute constants for telemetry resources        |
| pino                                      | Standard structured logging framework for API and web client layers  |
| pg                                        | PostgreSQL client and connection pool                                |
| react                                     | Core UI library for component rendering                              |
| react-dom                                 | Browser rendering for React components                               |
| react-router-dom                          | Client-side route navigation between pages                           |

## Development Dependencies

| Package                     | Purpose                                          |
| --------------------------- | ------------------------------------------------ |
| vite                        | Build tool and development server                |
| typescript                  | Static type checking and TS compilation rules    |
| @vitejs/plugin-react        | React integration plugin for Vite                |
| @playwright/test            | End-to-end testing framework                     |
| eslint                      | Linting framework                                |
| @eslint/js                  | Base ESLint rules                                |
| eslint-plugin-react-hooks   | React hooks lint rules                           |
| eslint-plugin-react-refresh | React Fast Refresh lint integration              |
| globals                     | Shared global definitions for lint configuration |
| @types/react                | TypeScript type definitions for React            |
| @types/react-dom            | TypeScript type definitions for React DOM        |
| kill-port                   | Cross-platform utility to stop stale API process on port 4300 |

## Dependency Notes

- Build, test, and lint scripts are defined in `package.json`.
- `concurrently` is used by `npm run dev` and `npm run dev:test` to start both frontend and backend processes.
- `kill-port` is used by `npm run stop:api` and pre-start hooks (`prestart:api`, `predev:api`) to prevent stale API listeners from surviving terminal closures.
- Playwright is configured for Chromium desktop execution in `playwright.config.js`.
- The profile API uses `express` for routing and `pg` for Postgres access.
- OpenTelemetry packages in runtime dependencies enable backend trace export with W3C trace context propagation.
- `dotenv` loads local backend secrets from `.env` during development.
- TypeScript compiler options are centralized in `tsconfig.json`.

## Security Scan Tooling

- CodeQL and Semgrep are executed in GitHub Actions workflows under `.github/workflows/`.
- A separate non-deploy quality workflow (`.github/workflows/quality.yml`) runs lint, typecheck, backend API tests, and Playwright end-to-end tests on pushes and pull requests.
- Bandit is not enabled by default because this repository runtime is JavaScript/TypeScript (Node + React) rather than Python.
- If Python runtime components are introduced later, add Bandit with an explicit workflow and update this document.
