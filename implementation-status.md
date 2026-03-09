# Implementation Status

Last updated: 2026-03-10

## Overall state

The repo is no longer empty. It now contains a working scaffold for the planned architecture:

- lightweight SPA frontend
- TypeScript `Express` backend
- shared types/fixtures package
- Storybook-first UI surface

The scaffold is intentionally mock-safe. Real production ClickUp reads are now implemented behind explicit opt-in. Real production ClickUp writes are still intentionally blocked.

## What is implemented

### Workspace / tooling

- npm workspaces configured at the repo root
- shared TypeScript base config
- install completed successfully
- backend now loads `.env` and `.env.local` from the repo root before parsing config
- blank optional env placeholders are normalized to unset values instead of crashing startup

### Frontend

- Vite-based SPA shell
- routes:
  - `/planning`
  - `/daily`
  - `/storybook-gate`
- basic styling and layout
- backend-backed planning screen with:
  - route-level loading state
  - retryable error state
  - rate-limit state using `Retry-After`
  - empty-state handling
  - manual refresh
- backend-backed daily board with:
  - route-level loading state
  - retryable error state
  - rate-limit state using `Retry-After`
  - empty-state handling
  - manual refresh
- visible read/write mode banner in the app routes
- `Connect ClickUp` action on planning/daily 401 states
- Vite dev proxy for `/api` and `/auth` to the backend
- Storybook config and initial stories
- route stories now use injected fixture loaders instead of backend fetches

### Backend

- `Express` app bootstrap
- route groups:
  - `/health`
  - `/auth`
  - `/api/clickup`
- real auth routes:
  - `GET /auth/clickup/start`
  - `GET /auth/clickup/callback`
  - `POST /auth/logout`
- mock-backed and live-read-capable endpoints:
  - `GET /api/clickup/schema`
  - `GET /api/clickup/planning`
  - `GET /api/clickup/daily`
  - `PATCH /api/clickup/tasks/:taskId/status`
  - `PATCH /api/clickup/tasks/:taskId/fields`
- encrypted HTTP-only cookie session for ClickUp OAuth state and access token
- request-scoped token resolution:
  - env token fallback via `CLICKUP_ACCESS_TOKEN`
  - session-backed OAuth token when authenticated
- write mode guard using `CLICKUP_WRITE_MODE`
- read mode guard using `CLICKUP_READ_MODE`
- ClickUp backend client with:
  - paginated list-task reads
  - hard cap of 100 fetched tasks per live snapshot
  - hard cap of 10 seconds per ClickUp HTTP request
  - list custom-field metadata fetch
  - workspace custom task-type fetch
  - short-lived in-memory caching
  - request deduplication for concurrent snapshot loads
  - 429 / `Retry-After` handling
  - console logging for live request start/success/failure/timeout/rate-limit events
- live normalization from ClickUp responses into the existing shared planning/daily shapes
- target-list field validation for the required planning/daily fields

### Shared package

- normalized types for planning, daily, and schema state
- fixture data for Storybook and mock backend responses
- canonical status lists and excluded planning statuses

## What is not implemented yet

### ClickUp integration

- production verification of OAuth and live read mode with real ClickUp app credentials

### UI behavior

- true drag-and-drop for daily board
- inline field editing in planning
- route-level states beyond the planning/daily screen level

### Safe write infrastructure

- `test-space` real-write adapter
- hard safeguards around allowlisted test workspace/list ids
- future verified `live` write enablement

## Validation completed

These commands succeeded:

- `npm install`
- `npm run typecheck`
- `npm run build`
- `HOME=/tmp STORYBOOK_DISABLE_TELEMETRY=1 npm run build-storybook`
- backend-only validation after the fetch-guardrail change:
  - `npm run typecheck --workspace backend`
  - `npm run build --workspace backend`

## Known environment caveat

Storybook tries to write settings under `/home/javier/.storybook` by default, which is blocked in this sandbox. Use:

```bash
HOME=/tmp STORYBOOK_DISABLE_TELEMETRY=1 npm run build-storybook
```

and similarly for local Storybook commands in this environment if needed.

## Stage 1 verification notes

New env surface:

- `CLICKUP_READ_MODE=mock|live`
- `CLICKUP_ACCESS_TOKEN=<server-side ClickUp token for local verification>`
- `CLICKUP_TARGET_TEAM_ID=2199933`
- `CLICKUP_TARGET_LIST_ID=901500224401`
- `CLICKUP_READ_CACHE_TTL_MS=30000`
- `CLICKUP_HTTP_TIMEOUT_MS=10000`

Default behavior remains mock-safe:

- if `CLICKUP_READ_MODE` is unset, `/api/clickup/schema`, `/planning`, and `/daily` still serve fixture-backed responses
- `CLICKUP_WRITE_MODE` still defaults to `mock`
- repo-root `.env` and `.env.local` are loaded automatically by the backend config module

## Stage 2 verification notes

Frontend app behavior now:

- `/planning` fetches `/api/clickup/planning`
- `/daily` fetches `/api/clickup/daily`
- the app shows backend read/write mode in the status banner after a successful load
- refresh is manual only; there is no background polling
- Storybook screen stories still use fixture-backed loaders

## Stage 3 verification notes

New env surface:

- `CLICKUP_OAUTH_AUTHORIZE_URL=https://app.clickup.com/api`
- `CLICKUP_CLIENT_ID=<ClickUp OAuth app client id>`
- `CLICKUP_CLIENT_SECRET=<ClickUp OAuth app client secret>`
- `CLICKUP_REDIRECT_URI=http://localhost:3000/auth/clickup/callback`
- `SESSION_SECRET=<16+ char secret>`
- `SESSION_COOKIE_SECURE=false` for local HTTP dev

OAuth behavior now:

- `/auth/clickup/start?returnTo=/planning` sets encrypted cookie state and redirects to ClickUp
- `/auth/clickup/callback` exchanges the code, validates workspace access, stores the access token in the encrypted session cookie, and redirects back to the requested route
- live reads can now use either `CLICKUP_ACCESS_TOKEN` or the session-backed OAuth token
- if a session-backed token becomes invalid, the backend clears the session and returns `401`
- `SESSION_SECRET` must be at least 16 characters or backend startup will fail

Operational learnings:

- the frontend only shows `Connect ClickUp` after a live read returns `401`
- `Connect ClickUp` will not appear if `CLICKUP_READ_MODE=mock`
- `Connect ClickUp` will not appear if `CLICKUP_ACCESS_TOKEN` is set, because the backend will use the env-token fallback instead of returning `401`
- empty placeholder values in `.env` are allowed now, but partially configured OAuth still requires all OAuth fields to be present together

## Recommended next implementation slice

1. Implement safe non-mock mutation adapters with explicit `test-space` allowlisting.
2. Keep production-list live writes blocked.
3. Add UI affordances for write-mode clarity and mutation verification.
4. Keep OAuth/session-backed live reads intact.
