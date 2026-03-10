# Agent Handoff

Last updated: 2026-03-10

## Read this first

Recommended reading order:

1. [clickup-v1-plan.md](/data/simple-clickup/clickup-v1-plan.md)
2. [implementation-status.md](/data/simple-clickup/implementation-status.md)
3. [clickup-reference.md](/data/simple-clickup/clickup-reference.md)
4. [clickup-research.md](/data/simple-clickup/clickup-research.md)
5. [clickup-write-project-plan.md](/data/simple-clickup/clickup-write-project-plan.md) only if you are explicitly working on the separate write project

## Repo layout

- `frontend/`
  - SPA shell
  - Storybook config
  - screen/component stories
- `backend/`
  - `Express` server scaffold
  - ClickUp OAuth/session flow
  - mock-safe and live-read-capable API routes
- `shared/`
  - normalized domain types
  - canonical status constants
  - fixture builders / mock data

## Important files

### Root

- [package.json](/data/simple-clickup/package.json): workspace scripts
- [clickup-v1-plan.md](/data/simple-clickup/clickup-v1-plan.md): read-only implementation plan
- [clickup-write-project-plan.md](/data/simple-clickup/clickup-write-project-plan.md): separate deferred write project
- [implementation-status.md](/data/simple-clickup/implementation-status.md): current delivery status

### Frontend

- [frontend/src/app.tsx](/data/simple-clickup/frontend/src/app.tsx): route shell
- [frontend/src/routes/planning-page.tsx](/data/simple-clickup/frontend/src/routes/planning-page.tsx): backend-backed planning screen with manual refresh and route states
- [frontend/src/routes/daily-page.tsx](/data/simple-clickup/frontend/src/routes/daily-page.tsx): backend-backed daily screen with manual refresh and route states
- [frontend/src/lib/clickup-api.ts](/data/simple-clickup/frontend/src/lib/clickup-api.ts): frontend fetch layer for planning/daily backend endpoints
- [frontend/src/lib/daily-board.ts](/data/simple-clickup/frontend/src/lib/daily-board.ts): pure client-side daily filtering and count logic
- [frontend/src/lib/assignee.ts](/data/simple-clickup/frontend/src/lib/assignee.ts): shared avatar/assignee display helpers for planning and daily
- [frontend/src/lib/use-resource-loader.ts](/data/simple-clickup/frontend/src/lib/use-resource-loader.ts): reusable route loader hook
- [frontend/.storybook/main.ts](/data/simple-clickup/frontend/.storybook/main.ts): Storybook config

### Backend

- [backend/src/app.ts](/data/simple-clickup/backend/src/app.ts): Express app wiring
- [backend/src/routes/clickup.ts](/data/simple-clickup/backend/src/routes/clickup.ts): schema/planning/daily read endpoints and guarded write stubs
- [backend/src/routes/auth.ts](/data/simple-clickup/backend/src/routes/auth.ts): ClickUp OAuth start/callback/logout routes
- [backend/src/config.ts](/data/simple-clickup/backend/src/config.ts): env parsing for read mode, OAuth, and session cookie settings
- [backend/src/clickup/client.ts](/data/simple-clickup/backend/src/clickup/client.ts): ClickUp REST client with pagination and 429 handling
- [backend/src/clickup/service.ts](/data/simple-clickup/backend/src/clickup/service.ts): cached live loaders and normalization, including nested-story daily row handling
- [backend/src/clickup/oauth.ts](/data/simple-clickup/backend/src/clickup/oauth.ts): OAuth token exchange and authorized user/workspace fetches
- [backend/src/clickup/session.ts](/data/simple-clickup/backend/src/clickup/session.ts): encrypted cookie session storage
- [backend/src/clickup/token.ts](/data/simple-clickup/backend/src/clickup/token.ts): Authorization header normalization for env tokens and OAuth tokens
- [backend/test/clickup-service.test.ts](/data/simple-clickup/backend/test/clickup-service.test.ts): `vitest` coverage for daily row normalization and nested story hierarchies
- [frontend/src/lib/daily-board.test.ts](/data/simple-clickup/frontend/src/lib/daily-board.test.ts): `vitest` coverage for daily client-side filtering and count behavior

### Shared

- [shared/src/types.ts](/data/simple-clickup/shared/src/types.ts): normalized types and status constants
- [shared/src/fixtures.ts](/data/simple-clickup/shared/src/fixtures.ts): Storybook/mock data

## Current safety model

- Live production ClickUp reads are implemented behind explicit `CLICKUP_READ_MODE=live`.
- This project is now planned as read-only.
- The separate write roadmap lives in [clickup-write-project-plan.md](/data/simple-clickup/clickup-write-project-plan.md).
- Live production ClickUp writes must not be used during development/testing.

Current implementation note:

- live ClickUp reads are now implemented behind explicit `CLICKUP_READ_MODE=live`
- OAuth start/callback/logout are now implemented
- live reads can use either the env token fallback or the OAuth session token
- repo-root `.env` and `.env.local` are now loaded by the backend before config parsing
- live task fetch is capped at 500 tasks per live task query
- live ClickUp HTTP requests are capped at 10 seconds each
- live reads are now split into dedicated schema, planning, and daily loaders
- `/api/clickup/schema` is now metadata-only and no longer fetches task data
- live ClickUp reads now emit structured one-line `pino` logs
- live reads now use workspace-plan-aware local rate budgeting with upstream rate-limit header handling
- backend unit tests now cover nested daily story hierarchies
- frontend unit tests now cover daily search/assignee filtering and filtered counts
- nested stories now render as their own daily rows rather than board cards
- ancestor story rows remain visible when descendant active work exists deeper in the hierarchy
- default local behavior is still mock-safe
- production-list writes are still blocked, but that work is now outside this project’s roadmap
- frontend styling now includes the ClickUp-inspired shell/density pass with swimlane-aligned daily layout
- the read UI no longer exposes `writeMode`; planning and daily use a read-only status badge
- daily now supports local search and assignee filters plus filtered totals and a filtered-empty state

## Expected environment variables

Currently parsed:

- `PORT`
- `LOG_FORMAT`
- `LOG_LEVEL`
- `CLICKUP_WRITE_MODE`
- `CLICKUP_READ_MODE`
- `CLICKUP_ACCESS_TOKEN`
- `CLICKUP_API_BASE_URL`
- `CLICKUP_OAUTH_AUTHORIZE_URL`
- `CLICKUP_CLIENT_ID`
- `CLICKUP_CLIENT_SECRET`
- `CLICKUP_REDIRECT_URI`
- `CLICKUP_TARGET_TEAM_ID`
- `CLICKUP_TARGET_LIST_ID`
- `CLICKUP_READ_CACHE_TTL_MS`
- `CLICKUP_HTTP_TIMEOUT_MS`
- `SESSION_SECRET`
- `SESSION_COOKIE_SECURE`

Likely next env vars to add in the backend:

- `CLICKUP_TEST_WORKSPACE_ID`
- `CLICKUP_TEST_LIST_ID`

## Operational learnings

- `Connect ClickUp` only appears when the frontend receives a `401` from a live backend read.
- If `CLICKUP_READ_MODE=mock`, the connect flow is never shown.
- If `CLICKUP_ACCESS_TOKEN` is set, the backend uses that token as a fallback and the connect flow is usually bypassed.
- `SESSION_SECRET` must be at least 16 characters.
- Empty placeholder values in `.env` are normalized to unset now, but partially configured OAuth still fails validation until all OAuth fields are present.
- The current live-read backend cache is keyed by resolved token and token source, so env-token reads and session-token reads maintain separate cached state.
- `GET /api/clickup/schema` now fetches metadata only and no longer overfetches tasks.
- `include_timl` means "include tasks in multiple lists". It should stay off by default for both Planning and Daily unless cross-listed tasks are explicitly required.
- The Planning live query is:
  - `include_closed=false`
  - status filter limited to `BACKLOG`, `BUGS / ISSUES`, `IN UX DESIGN`, `READY TO REFINE`, `SPRINT READY`, `BLOCKED`, `SPRINT BACKLOG`, `IN PROGRESS`, and `IN CODE REVIEW`
  - `include_timl=false`
- The Daily live query is:
  - `include_closed=false`
  - status filter limited to `BLOCKED`, `SPRINT BACKLOG`, `IN PROGRESS`, `IN CODE REVIEW`, `DEPLOYED TO DEV`, and `TESTED IN DEV`
  - `include_timl=false`
- Start with the existing list-task endpoint plus status filtering. Only move to the filtered team-task endpoint if list-task filtering is not precise enough.
- Logging now uses one-line structured `pino` logs for outbound ClickUp requests and logical backend reads.
- The backend now resolves workspace plan on first live use, falls back to `100 rpm` if needed, and locally throttles at `90%` of the detected limit while still honoring upstream `Retry-After` and `X-RateLimit-*` headers.

## Working commands

### Install

```bash
npm install
```

### Typecheck

```bash
npm run typecheck
```

### Backend tests

```bash
npm run test --workspace backend
```

### Frontend tests

```bash
npm run test --workspace frontend
```

### Build app

```bash
npm run build
```

### Run frontend and backend

```bash
npm run dev
```

The frontend dev server now proxies `/api` and `/auth` to `http://localhost:4000`.

For OAuth local verification:

```bash
CLICKUP_READ_MODE=live
CLICKUP_CLIENT_ID=...
CLICKUP_CLIENT_SECRET=...
CLICKUP_REDIRECT_URI=http://localhost:3000/auth/clickup/callback
SESSION_SECRET=<16+ chars>
SESSION_COOKIE_SECURE=false
```

### Storybook

In this sandboxed environment:

```bash
HOME=/tmp STORYBOOK_DISABLE_TELEMETRY=1 npm run build-storybook
```

## Recommended next task

Stay on the read-only project:

- verify the current live planning/daily query shapes against real ClickUp output and close any remaining board/count mismatches
- decide whether another read-only visual density pass is still needed after using the current UI against live data
- leave planning filters until the end; they remain optional

Only switch to [clickup-write-project-plan.md](/data/simple-clickup/clickup-write-project-plan.md) if the task is explicitly about mutations.
