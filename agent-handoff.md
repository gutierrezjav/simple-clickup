# Agent Handoff

Last updated: 2026-03-09

## Read this first

Recommended reading order:

1. [clickup-v1-plan.md](/data/custom-clickup/clickup-v1-plan.md)
2. [implementation-status.md](/data/custom-clickup/implementation-status.md)
3. [clickup-reference.md](/data/custom-clickup/clickup-reference.md)
4. [clickup-research.md](/data/custom-clickup/clickup-research.md)

## Repo layout

- `frontend/`
  - SPA shell
  - Storybook config
  - screen/component stories
- `backend/`
  - `Express` server scaffold
  - auth placeholders
  - mock-safe API routes
- `shared/`
  - normalized domain types
  - canonical status constants
  - fixture builders / mock data

## Important files

### Root

- [package.json](/data/custom-clickup/package.json): workspace scripts
- [clickup-v1-plan.md](/data/custom-clickup/clickup-v1-plan.md): target implementation plan
- [implementation-status.md](/data/custom-clickup/implementation-status.md): current delivery status

### Frontend

- [frontend/src/app.tsx](/data/custom-clickup/frontend/src/app.tsx): route shell
- [frontend/src/routes/planning-page.tsx](/data/custom-clickup/frontend/src/routes/planning-page.tsx): planning mock screen
- [frontend/src/routes/daily-page.tsx](/data/custom-clickup/frontend/src/routes/daily-page.tsx): daily mock screen
- [frontend/.storybook/main.ts](/data/custom-clickup/frontend/.storybook/main.ts): Storybook config

### Backend

- [backend/src/app.ts](/data/custom-clickup/backend/src/app.ts): Express app wiring
- [backend/src/routes/clickup.ts](/data/custom-clickup/backend/src/routes/clickup.ts): schema/planning/daily mock endpoints and guarded write stubs
- [backend/src/config.ts](/data/custom-clickup/backend/src/config.ts): env parsing and write mode

### Shared

- [shared/src/types.ts](/data/custom-clickup/shared/src/types.ts): normalized types and status constants
- [shared/src/fixtures.ts](/data/custom-clickup/shared/src/fixtures.ts): Storybook/mock data

## Current safety model

- Live production ClickUp reads are allowed in the plan, but not implemented yet.
- Live production ClickUp writes must not be used during development/testing.
- Default write mode is `mock`.
- `test-space` is planned but not implemented.
- `live` is intentionally blocked by default.

## Expected environment variables

Currently parsed:

- `PORT`
- `CLICKUP_WRITE_MODE`

Likely next env vars to add in the backend:

- `CLICKUP_CLIENT_ID`
- `CLICKUP_CLIENT_SECRET`
- `CLICKUP_REDIRECT_URI`
- `SESSION_SECRET`
- `CLICKUP_TARGET_LIST_ID`
- `CLICKUP_TEST_WORKSPACE_ID`
- `CLICKUP_TEST_LIST_ID`

## Working commands

### Install

```bash
npm install
```

### Typecheck

```bash
npm run typecheck
```

### Build app

```bash
npm run build
```

### Run frontend and backend

```bash
npm run dev
```

### Storybook

In this sandboxed environment:

```bash
HOME=/tmp STORYBOOK_DISABLE_TELEMETRY=1 npm run build-storybook
```

## Recommended next task

Implement live read-only ClickUp integration in the backend:

- keep the current normalized response shapes
- keep `CLICKUP_WRITE_MODE=mock`
- replace fixture-backed reads with real paginated ClickUp reads
- add read guardrails:
  - caching
  - request deduplication
  - bounded refresh behavior
  - 429 / `Retry-After` handling

Do not start real write integration against the production list yet.
