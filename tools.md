# Tools

## Table of Contents

1. [Overview](#overview)
2. [Development Tools](#development-tools)
3. [Quality and Validation Tools](#quality-and-validation-tools)
4. [Testing Tools](#testing-tools)

## Overview

This project is a frontend application and does not currently expose custom MCP tools from the repository itself.

To keep operational usage documented, this file treats project scripts and test operations as tools used by contributors.

## Development Tools

## Dev Server

### Description

Starts the Vite development server with hot module replacement.

### Input

#### Schema

| Parameter | Type   | Required | Description                  |
| --------- | ------ | -------- | ---------------------------- |
| command   | string | yes      | npm script command           |
| host      | string | no       | Override host passed to Vite |
| port      | number | no       | Override port passed to Vite |

#### Example Input

```json
{
  "command": "npm run dev",
  "host": "127.0.0.1",
  "port": 4173
}
```

### Output

#### Schema

| Field    | Type   | Required | Description                   |
| -------- | ------ | -------- | ----------------------------- |
| localUrl | string | yes      | Local URL where app is served |
| status   | string | yes      | Process status                |

#### Example Output

```json
{
  "localUrl": "http://127.0.0.1:4173",
  "status": "running"
}
```

## Build

### Description

Builds an optimized production bundle with Vite.

### Input

#### Schema

| Parameter | Type   | Required | Description        |
| --------- | ------ | -------- | ------------------ |
| command   | string | yes      | npm script command |

#### Example Input

```json
{
  "command": "npm run build"
}
```

### Output

#### Schema

| Field     | Type   | Required | Description     |
| --------- | ------ | -------- | --------------- |
| status    | string | yes      | Build result    |
| outputDir | string | yes      | Build directory |

#### Example Output

```json
{
  "status": "success",
  "outputDir": "dist"
}
```

## Quality and Validation Tools

## Type Check

### Description

Runs TypeScript static validation with no emitted files.

### Input

#### Schema

| Parameter | Type   | Required | Description        |
| --------- | ------ | -------- | ------------------ |
| command   | string | yes      | npm script command |

#### Example Input

```json
{
  "command": "npm run typecheck"
}
```

### Output

#### Schema

| Field  | Type   | Required | Description         |
| ------ | ------ | -------- | ------------------- |
| status | string | yes      | Type-check result   |
| errors | array  | no       | Type errors, if any |

#### Example Output

```json
{
  "status": "success",
  "errors": []
}
```

## Lint

### Description

Runs ESLint checks across the codebase.

### Input

#### Schema

| Parameter | Type   | Required | Description        |
| --------- | ------ | -------- | ------------------ |
| command   | string | yes      | npm script command |

#### Example Input

```json
{
  "command": "npm run lint"
}
```

### Output

#### Schema

| Field    | Type   | Required | Description   |
| -------- | ------ | -------- | ------------- |
| status   | string | yes      | Lint result   |
| warnings | number | no       | Warning count |
| errors   | number | no       | Error count   |

#### Example Output

```json
{
  "status": "success",
  "warnings": 0,
  "errors": 0
}
```

## Testing Tools

## End-to-End Test Run

### Description

Runs Playwright end-to-end tests in headless mode.

### Input

#### Schema

| Parameter | Type   | Required | Description        |
| --------- | ------ | -------- | ------------------ |
| command   | string | yes      | npm script command |

#### Example Input

```json
{
  "command": "npm run test:e2e"
}
```

### Output

#### Schema

| Field  | Type   | Required | Description     |
| ------ | ------ | -------- | --------------- |
| status | string | yes      | Test run status |
| passed | number | yes      | Passed tests    |
| failed | number | yes      | Failed tests    |

#### Example Output

```json
{
  "status": "success",
  "passed": 2,
  "failed": 0
}
```

## End-to-End Test UI

### Description

Runs Playwright interactive UI mode for debugging tests.

### Input

#### Schema

| Parameter | Type   | Required | Description        |
| --------- | ------ | -------- | ------------------ |
| command   | string | yes      | npm script command |

#### Example Input

```json
{
  "command": "npm run test:e2e:ui"
}
```

### Output

#### Schema

| Field  | Type   | Required | Description   |
| ------ | ------ | -------- | ------------- |
| status | string | yes      | Launch status |
| mode   | string | yes      | UI mode       |

#### Example Output

```json
{
  "status": "running",
  "mode": "interactive"
}
```
