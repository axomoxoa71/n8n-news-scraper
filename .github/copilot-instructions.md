# Project Instructions

## Table of Contents

1. [Documentation First](#documentation-first)
2. [Testing](#testing)
3. [Documentation Sync](#documentation-sync)
4. [Markdown Structure](#markdown-structure)
5. [Documentation](#documentation)
6. [Change Discipline](#change-discipline)

## Best Practices

- Try to look out for best practices in code, documentation, testing, and project structure.
- If you see an opportunity to improve the project in any of these areas, take it!

## Logging

- OTEL based logging and log in case of any exception or error in the codebase. Logs should be structured and include relevant context to facilitate debugging and monitoring.
- Tracecontext should be propagated across all components and layers of the application to enable end-to-end tracing and correlation of logs, metrics, and traces for better observability and troubleshooting.
- Error Message on UI should show traceid for better debugging and correlation with backend logs.

## Security

- Peform security reviews for any code changes, especially those that handle authentication, secrets, or external communication.
- Follow secure coding practices and avoid hardcoding secrets or sensitive information in the codebase.
- Use environment variables or secure vaults for managing secrets and credentials.
- Scan code by using tools like `semgrep, codeql, bandit` to identify potential security issues before merging changes.
- Verify code based on OWASP top 10 security risks and ensure that the code does not introduce vulnerabilities such as injection, broken authentication, or sensitive data exposure.

## Testing

- Test first development approach must be followed for all code changes.
- Automated tests are required for any capability added or changed in this project.
- New functionality should include test coverage appropriate to the scope of the change.
- Regressions should be covered by automated tests when fixed.
- Provide and load test data for all tables (by default: 3 records per table) to enable testing and local development without manual data setup. Consider if atable contains a FK to have 3 records for each referenced record to allow testing of different relationships and scenarios.
- If you need more and different test data with specific properties for testing or development, create additional seed files and document them in `documentation/seed-data.md`.
- Use descriptive test names and organize tests logically to facilitate understanding and maintenance.
- Ensure that tests are reliable and do not produce false positives or negatives.

### Test Data

- I need some test data which has a fix setup
- 4 Profiles MUST be created in total, each with 3 URLs, 3 RSS feeds, 3 tags, and 3 roles.
- 2 of these profiles are predefined and should be named `AI LLM` and `Error Test Profile`.
- For each profile 3 news items should be created linked to that profile.
- There should be tests to verify that the seeded data is correctly created and can be used for testing and development.

#### AI LLM Profile

- Profile Name: AI LLM
- Profile Description: A profile for testing with LLMs
- Tags: llm, anthropic, claude
- Roles: Solution Architect, Software Engineer
- Url: https://www.technologyreview.com/topic/artificial-intelligence/, https://www.unite.ai/, https://aiuniverseexplorer.com/ai-news-aggregator/, https://invalid/
- RSS: https://planet-ai.net/rss.xml, https://invalid/rss.xml

#### Error Test Profile

- Profile Name: Error Test
- Should have 3 deterministic errors seeded in `error_t` for testing error display and correlation with trace IDs.

#### Notification Channels

- Channel Name: Test Channel
- Email: robert.bernhard71@gmail.com

# Database Conventions

- Use following naming conventions for database
  - Tables: snake_case plural and suffix \_t (for example: `user_profiles_t`, `news_items_t`)
  - Columns: snake_case (for example: `created_at`, `profile_name`)
  - Primary keys: `id`
  - Dates: suffix \_date (for exmample: `order_date`)
  - Timesstamps: suffix \_ts (for exmample: `created_ts`, `updated_ts`)
  - Default Field
    - `created_ts` with default value `CURRENT_TIMESTAMP`
    - `updated_ts` with default value `CURRENT_TIMESTAMP` and `ON UPDATE CURRENT_TIMESTAMP`
  - Foreign keys: `{referenced_table_singular}_id` (for example: `user_profile_id`)
  - Indices: `{table_name}_{column_name}_idx` (for example: `user_profiles_profile_name_idx`)
  - Check Constraints: `{table_name}_{column_name}_chk` (for example: `user_profiles_profile_name_chk`)
  - Separate DDL per table in own script in /server/sql/ddl/ (for example: `user_profiles.sql`, `news_items.sql`)
  - All FK should be located in a single file in /server/sql/fk/ (`foreign_keys.sql`)

## User Interface

- Use dark theme for the user interface, with a color palette that includes dark backgrounds and lighter text for contrast.
- Ensure that the UI is responsive and works well on different screen sizes and devices.
- Use a consistent design language and style across all pages and components.
- UI MUST be explicitly in english language. Do not use any other language in the UI text, even for placeholder or sample content.
- UI Error should show traceid for better debugging and correlation with backend logs.

## Documentation Sync

- Documentation in `documentation/` must be kept in sync with code and implementation.
- Any code or capability change that affects behavior, interfaces, or workflows must update the relevant documentation.

## Markdown Structure

- Any documentation markdown file must have a table of contents.
- The table of contents must be kept up to date with the document content.

## Documentation

## General

- Any documentation must have a table of contents.
- The table of contents must be kept up to date with the document content.
- Documentation should be clear, concise, and well-structured to facilitate understanding and navigation.
- Use consistent formatting and style across all documentation files.
- Use examples and diagrams where appropriate to illustrate concepts and workflows. (preferably using mermaid)
- Link to related documentation and resources to provide additional context and information.
- Avoid describing the same information redundantly across multiple documents; instead, link to a single source of truth when possible.
- For any code-related documentation, ensure that it is accurate and reflects the current state of the codebase.

### README.md

- File: /README.md
- Should provide a high-level overview of the project, including:
  - What the project is
  - Key features and capabilities
  - Quick start instructions
  - Links to detailed documentation

- Each major capability or tool should be briefly described in the README with links to the full documentation in `documentation/`.
- The README should be concise and focused on providing an introduction and navigation to the project.
- If possible show the core architecture of the component in graphical way by using mermaid diagrams.

### Logging Documentation

- File: /documentation/logging.md
- Should describe the logging strategy and practices for the project, including:
  - Logging framework and configuration
  - Log structure and format
  - Trace context propagation
  - Examples of logging in code
  - Guidelines for what to log and at what level (info, warning, error, etc.)

### Requirements Documentation

- File: /requirements/\*-requirements.md
- Should contain detailed requirements for the project, including:
  - Functional requirements
  - Non-functional requirements
  - User stories or use cases
  - Acceptance criteria

### API Documentation

- File: /documentation/api/\*-api.md
- Should contain a link to openapi specification for any API implemented in the project. File: /documentation/api/\*-openapi.json or /documentation/\*-openapi.yaml
- Generate a swagger like html from the openapi specification and link it in the API documentation for better readability and store in /documentation/api/html/ (for example: /documentation/api/html/news-scraper-api.html)
- Should contain the openapi specification in YAML or JSON format as a code block, along with any necessary explanations or examples for using the API.
- If the API is implemented using a framework that supports automatic generation of OpenAPI specs (like FastAPI, NestJS, etc.), ensure that the generated documentation is included and kept up to date with any changes to the API.

### Implementation

- File: /documentation/implementation.md
- Should provide a detailed description of the implementation of the project, including:
  - Architecture overview (components, interactions, data flow)
  - Key components and their interactions
  - Data flow and processing
  - Any important design decisions or trade-offs made during development

### Installation

- File: /documentation/installatiion.md
- Should contain everything needed to get the project up and running, including:
  - Prerequisites
  - Setup steps
  - Claude Desktop configuration
  - MCP Inspector usage

### Dependencies

- File: /documentation/dependencies.md
- Should list all major dependencies and their purpose in the project.

### Tests

- File: tests.md
- Should list all tests in the project with:
  - What they test
  - Setup required
  - Assertions made

### Environment Variables

- File: /documentation/environment-variables.md
- Should contain all details for environment variables
- Each Environment Variable should be described by:
  - Name
  - Description
  - Possible values
  - Default value

### MCP Tool Documentation

- File Name: tools.md
- Tool documentation must contain a list of tools broken down by area.
- Tool documentation must use each tool as its own chapter or section.
- Each tool section must show:
  - description
  - input
    - schema: parameters with description, type, and whether required
    - example input
  - output
    - schema: parameters with description, type, and whether required
    - example input

## Change Discipline

- Any changes on documentation must remain consistent with these instructions.
- Any changes on code base (test, config, tests,..) must be synchronized with documentation.

## Jira Template Ticket Creation Workflow

- Tool selection is mandatory:
  - If the user asks to create a ticket "from template" or provides `template_issue_key` (for example `FLICA-122`), use `jira_create_ticket_from_template`.
  - Do not use `jira_create_issue` for template-based requests.

- For `jira_create_ticket_from_template`, if the tool returns `status=needs_placeholder_values`, always collect user input for each placeholder before retrying creation.
- Prompt the user once per placeholder, using the placeholder name in the question text (for example: `Provide a value for {integration}`).
- Do not skip placeholders and do not batch multiple placeholders into one free-text prompt.
- After collecting values for all required placeholders, call `jira_create_ticket_from_template` again with `placeholder_values` filled for every required placeholder.
- If the user leaves a required placeholder empty, ask again for that specific placeholder.
