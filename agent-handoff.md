# Agent Handoff

Last updated: 2026-03-10

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
  - ClickUp OAuth/session flow
  - mock-safe and live-read-capable API routes
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
- [frontend/src/routes/planning-page.tsx](/data/custom-clickup/frontend/src/routes/planning-page.tsx): backend-backed planning screen with manual refresh and route states
- [frontend/src/routes/daily-page.tsx](/data/custom-clickup/frontend/src/routes/daily-page.tsx): backend-backed daily screen with manual refresh and route states
- [frontend/src/lib/clickup-api.ts](/data/custom-clickup/frontend/src/lib/clickup-api.ts): frontend fetch layer for planning/daily backend endpoints
- [frontend/src/lib/use-resource-loader.ts](/data/custom-clickup/frontend/src/lib/use-resource-loader.ts): reusable route loader hook
- [frontend/.storybook/main.ts](/data/custom-clickup/frontend/.storybook/main.ts): Storybook config

### Backend

- [backend/src/app.ts](/data/custom-clickup/backend/src/app.ts): Express app wiring
- [backend/src/routes/clickup.ts](/data/custom-clickup/backend/src/routes/clickup.ts): schema/planning/daily read endpoints and guarded write stubs
- [backend/src/routes/auth.ts](/data/custom-clickup/backend/src/routes/auth.ts): ClickUp OAuth start/callback/logout routes
- [backend/src/config.ts](/data/custom-clickup/backend/src/config.ts): env parsing for read mode, OAuth, and session cookie settings
- [backend/src/clickup/client.ts](/data/custom-clickup/backend/src/clickup/client.ts): ClickUp REST client with pagination and 429 handling
- [backend/src/clickup/service.ts](/data/custom-clickup/backend/src/clickup/service.ts): cached live snapshot loader and normalization
- [backend/src/clickup/oauth.ts](/data/custom-clickup/backend/src/clickup/oauth.ts): OAuth token exchange and authorized user/workspace fetches
- [backend/src/clickup/session.ts](/data/custom-clickup/backend/src/clickup/session.ts): encrypted cookie session storage
- [backend/src/clickup/token.ts](/data/custom-clickup/backend/src/clickup/token.ts): Authorization header normalization for env tokens and OAuth tokens

### Shared

- [shared/src/types.ts](/data/custom-clickup/shared/src/types.ts): normalized types and status constants
- [shared/src/fixtures.ts](/data/custom-clickup/shared/src/fixtures.ts): Storybook/mock data

## Current safety model

- Live production ClickUp reads are implemented behind explicit `CLICKUP_READ_MODE=live`.
- Live production ClickUp writes must not be used during development/testing.
- Default write mode is `mock`.
- `test-space` is planned but not implemented.
- `live` is intentionally blocked by default.

Current implementation note:

- live ClickUp reads are now implemented behind explicit `CLICKUP_READ_MODE=live`
- OAuth start/callback/logout are now implemented
- live reads can use either the env token fallback or the OAuth session token
- repo-root `.env` and `.env.local` are now loaded by the backend before config parsing
- live task fetch is capped at 100 tasks per snapshot
- live ClickUp HTTP requests are capped at 10 seconds each
- live ClickUp reads now emit console logs for request lifecycle and fetch limits
- default local behavior is still mock-safe
- production-list writes are still blocked
- daily live reads still need view-specific query shaping to avoid overfetch
- frontend styling now includes the ClickUp-inspired shell/density pass with swimlane-aligned daily layout

## Expected environment variables

Currently parsed:

- `PORT`
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
- The current live-read backend cache is keyed by resolved token, so env-token reads and session-token reads maintain separate cached snapshots.
- `include_timl` means "include tasks in multiple lists". It should stay off by default for Daily unless the board must include tasks whose home list is elsewhere.
- The immediate read-optimization target is Daily, not Planning.
- The intended Daily live query is:
  - `include_closed=false`
  - status filter limited to `BLOCKED`, `SPRINT BACKLOG`, `IN PROGRESS`, `IN CODE REVIEW`, `DEPLOYED TO DEV`, and `TESTED IN DEV`
  - `include_timl=false` unless cross-listed tasks are required
- Start with the existing list-task endpoint plus status filtering. Only move Daily to the filtered team-task endpoint if list-task filtering is not precise enough.

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

Tighten the Daily live-read query before starting write work:

- add `include_closed=false`
- pass the six Daily board statuses explicitly
- keep `include_timl=false` by default
- verify the list-task endpoint gives the expected reduction before considering the filtered team-task endpoint

After that:

- implement safe non-mock write adapters with explicit allowlisting for `test-space`
- keep production-list writes blocked
- connect mutation verification to the new shell/banner treatment

Do not start real write integration against the production list yet.
