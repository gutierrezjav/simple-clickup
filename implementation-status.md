# Implementation Status

Last updated: 2026-03-18

## Overall state

The repo is no longer empty. It now contains a working scaffold for the planned architecture:

- lightweight SPA frontend
- TypeScript `Express` backend
- shared types/fixtures package
- Storybook-first UI surface

The scaffold is intentionally mock-safe. Real production ClickUp reads are now implemented behind explicit opt-in. The current project roadmap is now read-only; write work has been split into [clickup-write-project-plan.md](/data/simple-clickup/clickup-write-project-plan.md).

## What is implemented

### Workspace / tooling

- npm workspaces configured at the repo root
- shared TypeScript base config
- install completed successfully
- backend `vitest` test harness with workspace-aware path resolution
- backend now loads `.env` and `.env.local` from the repo root before parsing config
- blank optional env placeholders are normalized to unset values instead of crashing startup

### Frontend

- Vite-based SPA shell
- routes:
  - `/planning`
  - `/daily`
- ClickUp-inspired layout alignment with no left sidebar and a single header shell
- backend-backed planning screen with:
  - route-level loading state
  - retryable error state
  - rate-limit state using `Retry-After`
  - empty-state handling
  - manual refresh
  - story rows are collapsible with no toggle for tasks/bugs
  - `Prio score` sorting uses ascending order (0 is highest priority)
  - read-only status badge using backend read mode only
  - denser list presentation with avatar-style assignee treatment
- backend-backed daily board with:
  - route-level loading state
  - retryable error state
  - rate-limit state using `Retry-After`
  - empty-state handling
  - manual refresh
  - horizontal swimlanes with story headers only (no story cards)
  - nested stories rendered as story rows, not cards
  - ancestor story rows kept visible when descendant daily work exists
  - cards are top-aligned within each status column
  - cards show `Prio score` and hide status (status implied by column)
  - swimlanes and cards sorted by lowest `Prio score`
  - client-side search and assignee filters over the fetched snapshot
  - filtered totals at page, row, and column level
  - filtered-empty state distinct from backend-empty state
  - read-only status badge using backend read mode only
- `Connect ClickUp` action on planning/daily 401 states
- Vite dev proxy for `/api` and `/auth` to the backend
- Storybook config and initial stories
- route stories now use injected fixture loaders instead of backend fetches
- frontend `vitest` coverage for pure daily filter/count behavior

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
  - hard cap of 500 fetched tasks per live task query
  - hard cap of 10 seconds per ClickUp HTTP request
  - list custom-field metadata fetch
  - workspace custom task-type fetch
  - workspace-plan lookup with conservative fallback to `100 rpm`
  - metadata-only schema reads
  - view-specific query shaping for planning and daily
  - short-lived in-memory per-view caching plus longer-lived metadata caching
  - request deduplication for concurrent identical reads
  - proactive local rate budgeting before upstream `429`s
  - 429 / `Retry-After` handling
  - structured one-line `pino` logging for ClickUp requests and logical backend reads
- live normalization from ClickUp responses into the existing shared planning/daily shapes
- daily normalization now preserves nested story rows and empty ancestor story headers when descendant work is active
- target-list field validation for live-read fields that are actually required by the current planning/daily normalization
- backend unit coverage for daily row normalization, including nested-story hierarchies

Read-only roadmap note:

- the current code still exposes guarded write stubs, but they are outside the active read-only roadmap
- the read product surface no longer exposes write-mode concepts
- write-path work is now tracked separately in [clickup-write-project-plan.md](/data/simple-clickup/clickup-write-project-plan.md)

### Shared package

- normalized types for planning, daily, and schema state
- fixture data for Storybook and mock backend responses
- canonical status lists and excluded planning statuses

## What is not implemented yet

### ClickUp integration

- production verification of OAuth and live read mode with real ClickUp app credentials
- validation that list-task filtering is sufficient before considering the filtered team-task endpoint

### Read UX

- optional planning filters as a final, non-blocking slice
- further ClickUp-like refinement if the current density/count treatment still differs too much from the source board

### Separate write project

- mutation adapters, test-space writes, inline edits, and daily status updates now live in [clickup-write-project-plan.md](/data/simple-clickup/clickup-write-project-plan.md)

## Validation completed

These commands succeeded:

- `npm install`
- `npm run typecheck`
- `npm run build`
- `HOME=/tmp STORYBOOK_DISABLE_TELEMETRY=1 npm run build-storybook`
- backend-only validation after the fetch-guardrail change:
  - `npm run test --workspace backend`
  - `npm run typecheck --workspace backend`
  - `npm run build --workspace backend`
- read-only UI validation after the contract/filter refresh:
  - `npm run test`
  - `npm run typecheck`
  - `npm run build`

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
- the app now shows only backend read mode in the route status badge
- refresh is manual only; there is no background polling
- Storybook screen stories still use fixture-backed loaders
- planning remains read-only with denser list styling and avatar-style assignee display
- daily now supports client-side search and assignee filters without changing backend requests
- daily now shows filtered totals in the page header, row headers, and column headers
- daily filtered-empty state is distinct from the backend-empty state

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
- `include_timl` means "include tasks in multiple lists"; it pulls in tasks added to the target list whose home list is elsewhere

## Stage 4 verification notes

New env surface:

- `LOG_FORMAT=pretty|json`
- `LOG_LEVEL=info|debug|warn|error|fatal|trace|silent`

Backend read behavior now:

- `GET /api/clickup/schema` fetches metadata only and no longer fetches task data
- live reads are split into dedicated schema, planning, and daily loaders instead of one broad shared snapshot
- metadata caching is longer-lived than planning/daily task caching
- planning live reads use `include_closed=false`, `include_timl=false`, and these statuses:
  - `BACKLOG`
  - `BUGS / ISSUES`
  - `IN UX DESIGN`
  - `READY TO REFINE`
  - `SPRINT READY`
  - `BLOCKED`
  - `SPRINT BACKLOG`
  - `IN PROGRESS`
  - `IN CODE REVIEW`
- daily live reads use `include_closed=false`, `include_timl=false`, and these statuses:
  - `BLOCKED`
  - `SPRINT BACKLOG`
  - `IN PROGRESS`
  - `IN CODE REVIEW`
  - `DEPLOYED TO DEV`
  - `TESTED IN DEV`
- backend logging now uses one-line structured `pino` logs per outbound ClickUp request and per logical backend read
- the backend resolves workspace plan on first live use, falls back to `100 rpm` if that lookup fails, and locally throttles at `90%` of the detected limit before dispatching more requests
- upstream `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` are captured when present and fed into the local limiter state
- daily normalization treats nested user stories as rows rather than cards and keeps ancestor rows visible if any descendant non-story work is still on the board

## Recommended next implementation slice

1. Verify the current live daily/planning list-task query shapes against real ClickUp board/list output and adjust only if filtering still misses visible work.
2. Decide whether the current read visual pass is sufficient or whether another density pass is needed to match the real board more closely.
3. Keep planning filters as the only remaining optional UI extension, and only do them after the live-read verification work.
