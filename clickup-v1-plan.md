# ClickUp Client V1 Plan

Last updated: 2026-03-09

## Goal

Build a simple ClickUp client for the single list `Wingtra Cloud Dev` with:

- a planning view
- a daily view
- a Storybook-first component phase that can be reviewed before full app integration
- real ClickUp OAuth
- server-side ClickUp API access
- update-only workflows in v1

## Summary

The app should use a simple split architecture: a lightweight SPA frontend plus a TypeScript `Express` backend. The browser UI never talks to ClickUp directly. The `Express` server owns ClickUp OAuth, session handling, schema validation, data fetching, and mutations. No persistent database is used in v1; session state is ephemeral and stored in encrypted cookies. `Fastify` is unnecessary for this scope and should not be introduced in v1.

The app has two core screens:

- `planning`: ranked backlog centered on user stories, collapsed by default
- `daily`: drag-and-drop workflow board with story rows and exact ClickUp status columns

Before those screens are fully integrated into the app, their UI building blocks should be implemented and reviewed in Storybook with mocked data and mocked write behavior.

## Current status

What already exists in the repo:

- npm workspaces for `frontend`, `backend`, and `shared`
- SPA frontend scaffold with routes for planning, daily, and a Storybook gate page
- Storybook config plus initial component/screen stories
- `Express` backend scaffold with:
  - health route
  - auth route placeholders
  - mock-safe ClickUp API routes
- shared normalized types and fixtures
- safe write-mode contract with `mock`, `test-space`, and `live`

What is still stubbed:

- real ClickUp OAuth flow
- real live-read ClickUp API client
- schema validation against the real target list
- drag-and-drop implementation
- inline editing implementation
- test-space write adapter

Current validation status:

- workspace install completed
- `npm run typecheck` passes
- `npm run build` passes
- Storybook static build passes

Storybook note for this environment:

- in this sandbox, Storybook build should be run with `HOME=/tmp STORYBOOK_DISABLE_TELEMETRY=1` to avoid permission issues under `/home/javier/.storybook`

Safety rule for v1:

- live ClickUp reads are allowed in development
- live ClickUp writes are not used for development/testing until explicit verification guardrails exist
- write-path testing must use mocks or a dedicated ClickUp test space/list

## Delivery phases

### Phase 1: Storybook-first UI verification

- Build the shared UI components and screen-level compositions in Storybook before full app integration.
- Use mocked planning and daily datasets in Storybook.
- Use mocked edit handlers in Storybook for inline field edits and daily-board drag-and-drop.
- Include enough realistic states for review:
  - collapsed story rows
  - expanded story rows with subtasks
  - standalone task row
  - standalone bug row
  - loading, empty, error, and rate-limited read states
  - mocked write-disabled / mocked-write indicators
- Treat Storybook review as a verification gate before wiring the whole app to live backend data.

### Phase 2: App integration

- After Storybook review, wire the approved components into the SPA routes and `Express` backend.
- Keep the same component contracts used in Storybook so integration is mostly data wiring rather than UI redesign.

## Core implementation changes

### 1. App shell and auth

- Use a lightweight SPA frontend and a TypeScript `Express` backend.
- Implement ClickUp OAuth authorization-code flow.
- Add connect/callback/logout flows.
- Store access token and minimal session state in encrypted HTTP-only cookies.
- Clear session and force reconnect when the token is invalid or revoked.

### 2. Server-side ClickUp integration

- Centralize ClickUp API calls in one server-side client module.
- Validate the target list id and required schema on first authenticated load.
- Fetch tasks from the target list with pagination and normalize server-side.
- Fetch custom-field metadata for the target list.
- Update standard fields and custom fields through the correct ClickUp endpoints.
- Add server-side read guardrails:
  - short-lived response caching for planning/daily reads
  - request deduplication for concurrent identical reads
  - bounded polling/manual refresh only, no aggressive background sync
  - 429 handling with backoff and `Retry-After` support
- Add server-side write guardrails:
  - mutation adapter with `mock`, `test-space`, and `live` modes
  - default mode for local dev and automated tests is `mock`
  - `live` mode must require explicit environment opt-in
  - production-list writes must stay disabled until verification gates are implemented

### 3. Normalized app model

- Classify items primarily by ClickUp task type.
- Use hierarchy as fallback when type data is inconsistent.
- Normalize into:
  - `Story`
  - `Subtask`
  - `StandaloneTask`
  - `StandaloneBug`
- Ignore epics in v1 even if story records contain epic references.

### 4. Storybook and component system

- Add Storybook to the frontend workspace as a first-class development surface.
- Build core reusable components in Storybook first:
  - planning list row
  - story expand/collapse control
  - inline editable field cells
  - daily board column
  - daily card
  - story row header
  - standalone row variants
  - app mode/status banner for `mock`, `test-space`, or disabled writes
- Build screen-level Storybook stories for:
  - planning screen composition
  - daily board composition
- Use typed fixture builders so Storybook scenarios share the same normalized shapes as the real app.
- Add interaction stories where useful for:
  - inline priority/assignee/planning-bucket edits
  - expand/collapse behavior
  - drag-and-drop status updates using mocked handlers

### 5. Planning view

- Route: `/planning`
- Render one ranked list.
- Stories are the main items and start collapsed.
- Expanding a story reveals all non-closed subtasks.
- Sort stories by `Prio score` descending.
- Sort subtasks by `Prio score` descending.
- Include items with this exact logic:
  - `Task Type = User Story` and status not in:
    - `DEPLOYED TO DEV`
    - `TESTED IN DEV`
    - `DEPLOYED TO STAGING`
    - `TESTED IN STAGING`
    - `DEPLOYED TO PROD`
    - `PROD MINOR ISSUE`
    - `CLOSED`
  - plus `Task Type = Bug` with tag `po prio` or `qa prio` and status not in that same excluded set
  - plus any item whose status is `SPRINT BACKLOG`
- Allow inline editing only for:
  - `Prio score`
  - assignee
  - `Planning bucket`

### 6. Daily view

- Route: `/daily`
- Fixed columns in this order:
  - `BLOCKED`
  - `SPRINT BACKLOG`
  - `IN PROGRESS`
  - `IN CODE REVIEW`
  - `DEPLOYED TO DEV`
  - `TESTED IN DEV`
- Render one row per story.
- The story itself is the row header only, not a board card.
- Render child tasks inside the matching status columns.
- Add two extra rows:
  - `Tasks` for standalone tasks
  - `Bugs` for standalone bugs
- Support drag-and-drop for status changes only.
- Do not support drag-based reparenting, row ordering, or type conversion.

### 7. Mutation behavior

- Revalidate server data after every mutation.
- Use optimistic UI only for small field/status edits.
- Keep creation, deletion, comments, attachments, and rich detail editing out of v1.
- Do not use live production ClickUp writes during development or automated testing.
- Implement write execution behind an environment-controlled adapter:
  - `mock`: return simulated successful mutations and optionally persist them in-memory for the current session
  - `test-space`: execute real writes only against an explicit allowlisted ClickUp workspace/list intended for testing
  - `live`: reserved for later, and blocked by default in v1 until verification safeguards exist
- Add a visible app/environment indicator so the user always knows whether edits are mocked, targeting a test space, or disabled.

## Public/internal interfaces

### Internal server routes

- `GET /auth/clickup/start`
- `GET /auth/clickup/callback`
- `POST /auth/logout`
- `GET /api/clickup/schema`
- `GET /api/clickup/planning`
- `GET /api/clickup/daily`
- `PATCH /api/clickup/tasks/:taskId/status`
- `PATCH /api/clickup/tasks/:taskId/fields`

### Internal normalized types

- `SchemaConfig`
- `PlanningItem`
- `StoryRow`
- `DailyCard`
- `InlineEditableField`
- `WriteMode`

### Storybook support

- component fixtures and fixture builders for planning and daily states
- mocked mutation adapters for Storybook interaction stories
- screen-level stories that mirror the intended `/planning` and `/daily` routes

## Test plan

- Storybook review of the planning and daily compositions before app integration
- interaction coverage in Storybook for inline edits, expand/collapse, and drag-and-drop with mocked handlers
- OAuth connect/callback/logout and invalid-session handling
- schema validation against the target list and required fields
- planning filter inclusion/exclusion logic
- story collapse/expand behavior
- `Prio score` ordering for stories and subtasks
- daily row grouping for stories, standalone tasks, and standalone bugs
- daily column mapping using exact ClickUp status names
- drag-and-drop status mutation flow in `mock` mode
- custom-field update flow for `Prio score` and `Planning bucket` in `mock` mode
- integration coverage for real writes only against a dedicated test ClickUp space/list, never the live production list
- explicit assertion that local dev and CI cannot perform production-list writes unless a separate future verification gate is added
- graceful behavior on ClickUp API errors and rate limits
- cached read behavior, request deduplication, and 429 backoff handling

## Assumptions

- Target list stays `901500224401`.
- ClickUp task types remain stable enough to use as the primary classifier.
- Missing `Prio score` sorts below scored items.
- No persistent DB is acceptable for v1.
- Re-auth after restart/session loss is acceptable.
- Epic support is deferred.
- `Express` is the chosen backend; `Fastify` is intentionally deferred.
- Live production reads are acceptable in v1.
- Live production writes are intentionally deferred until verification and safety gates exist.
- Storybook approval is a required phase before full app integration.
