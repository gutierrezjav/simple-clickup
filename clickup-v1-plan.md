# ClickUp Client Read Project Plan

Last updated: 2026-03-10

## Goal

Build a read-only ClickUp client for the single list `Wingtra Cloud Dev` with:

- a planning view
- a daily view
- Storybook-first UI review before app integration changes
- real ClickUp OAuth
- server-side ClickUp API access for reads only

The write roadmap is now tracked separately in [clickup-write-project-plan.md](/data/simple-clickup/clickup-write-project-plan.md).

## Summary

This project is now explicitly read-only. The browser UI never talks to ClickUp directly. The TypeScript `Express` backend owns OAuth, session handling, schema validation, read fetching, normalization, caching, rate-limit handling, and read observability.

The app has two core screens:

- `planning`: ranked backlog centered on user stories, collapsed by default
- `daily`: read-only workflow board with story rows and exact ClickUp status columns

This project should no longer plan or prioritize mutations, write safety flows, mocked write UX, or write-mode product concepts. Those belong to the separate write project.

## Current status

What already exists in the repo:

- npm workspaces for `frontend`, `backend`, and `shared`
- SPA frontend scaffold with routes for planning and daily
- Storybook config plus initial component/screen stories
- `Express` backend scaffold with:
  - health route
  - real ClickUp OAuth start/callback/logout flows
  - live-read-capable ClickUp API routes behind explicit opt-in
  - separate schema, planning, and daily live loaders
  - structured `pino` logging for ClickUp reads
  - workspace-plan-aware local rate budgeting
  - daily normalization that preserves nested story rows and visible ancestors
- shared normalized types and fixtures
- backend `vitest` coverage for daily row normalization and nested story hierarchies

What is still needed for this read project:

- optional planning filters at the end of the roadmap
- production verification that the list-task endpoint filters are precise enough for planning and daily
- any further density/alignment refinements discovered during live verification

Current validation status:

- workspace install completed
- `npm run test` passes
- `npm run test --workspace backend` passes
- `npm run typecheck` passes
- `npm run build` passes
- Storybook static build passes

## Delivery phases

### Phase 1: Read-only contract cleanup (completed)

- Remove write-mode concepts from the read product surface.
- Keep the current read endpoints, but stop treating `writeMode` as part of the planning/daily contract.
- Replace the current read/write banner with a read-only status badge that shows only `Mock reads` or `Live reads`.
- Update docs so this repo’s next implementation slices are read-only only.
- Add [clickup-write-project-plan.md](/data/simple-clickup/clickup-write-project-plan.md) as the separate future write roadmap.

### Phase 2: Daily read UX improvements (completed)

- Add client-side daily filters only:
  - search
  - assignee
  - clear filters
- Keep filtering entirely local to the fetched snapshot; do not add backend query params.
- Add filtered card totals at:
  - page header level
  - column header level
  - row header level
- Add a filtered-empty state distinct from the backend-empty state.
- Keep the existing six columns, backend query shape, and normalization rules.

### Phase 3: Read visual refresh (initial pass completed)

- Push both screens closer to ClickUp visually without copying exact branding or trade dress.
- Use a lighter neutral canvas, denser spacing, compact toolbar/filter chrome, stronger chips, and clearer hierarchy.
- Daily gets the larger visual change because it also gains filters and totals.
- Planning gets the same visual language, but no new filters in required scope.
- Treat any additional density tweaks as follow-up work driven by live verification, not as a blocked unfinished phase.

### Phase 4: Optional planning filters

- Planning filters are explicitly last and optional.
- If implemented, they are client-side only and include:
  - search
  - assignee
  - status
  - kind
  - clear filters
- Planning filtering should be descendant-aware:
  - a story remains visible if the parent matches or any child matches
  - when filters are active, expanded stories show only matching children
- This optional phase does not block completion of the core read project.

## Core implementation changes

### 1. App shell and auth

- Keep the existing lightweight SPA frontend and TypeScript `Express` backend.
- Keep ClickUp OAuth authorization-code flow as-is for reads.
- Keep encrypted HTTP-only cookie sessions.
- Keep reconnect behavior for invalid or revoked tokens.

### 2. Server-side read integration

- Keep ClickUp API calls centralized in the backend client module.
- Keep schema validation, pagination, normalization, caching, deduplication, and rate-limit handling server-side.
- Keep live reads split into `schema`, `planning`, and `daily`.
- Keep current list-task query shaping for planning and daily.
- Keep `pino` request logging and logical read summaries.
- Do not add server-side filter params for planning or daily in this project.

### 3. Read-only API contract

- Keep:
  - `GET /auth/clickup/start`
  - `GET /auth/clickup/callback`
  - `POST /auth/logout`
  - `GET /api/clickup/schema`
  - `GET /api/clickup/planning`
  - `GET /api/clickup/daily`
- Planning and daily responses should become read-only payloads:
  - `planning`: `items`
  - `daily`: `rows`
- `readMode` continues to come from the existing `x-custom-clickup-read-mode` response header.
- `writeMode` is removed from the read contract and from the read UI.

### 4. Planning view

- Route: `/planning`
- Keep current list behavior:
  - stories as main items
  - collapsed by default
  - expansion reveals non-closed subtasks
  - sort by `Prio score` ascending
- Required scope:
  - denser list rows
  - clearer status/kind chips
  - stronger assignee/avatar treatment
  - more compact child-row layout
  - header/count polish aligned with the daily refresh
- Optional last scope:
  - client-side search, assignee, status, and kind filters
  - descendant-aware matching

### 5. Daily view

- Route: `/daily`
- Fixed columns in this order:
  - `BLOCKED`
  - `SPRINT BACKLOG`
  - `IN PROGRESS`
  - `IN CODE REVIEW`
  - `DEPLOYED TO DEV`
  - `TESTED IN DEV`
- Keep these composition rules:
  - one row per story
  - the story itself is row header only, not a board card
  - nested stories are rows, not cards
  - only non-story children render as cards
  - ancestor stories remain visible if descendant non-story work is visible
  - add `Tasks` and `Bugs` rows for standalone work
- Add client-side filters:
  - search
  - assignee
  - clear filters
- Daily search is case-insensitive and matches:
  - story row title
  - card title
  - card custom ID
- Assignee filter applies to cards only.
- Row visibility rules:
  - a story row stays visible if its title matches the search or any of its cards match the active filters
  - if a story row matches by title, show all cards that survive the assignee filter
  - if a story row matches only through cards, show only the matching cards
  - `Tasks` and `Bugs` rows remain visible only if they still have matching cards

## Test plan

- Docs and roadmap:
  - this project’s docs no longer recommend write-path work
  - [clickup-write-project-plan.md](/data/simple-clickup/clickup-write-project-plan.md) exists and contains the deferred write roadmap
- Read-only contract:
  - planning/daily frontend data no longer expects `writeMode`
  - the read-only status badge still reflects `Mock reads` vs `Live reads`
- Daily filter behavior:
  - story-title search keeps the row visible
  - card title/custom ID search narrows cards correctly
  - assignee filter narrows cards without changing backend requests
  - page, row, and column totals switch correctly between total and filtered totals
  - filtered-empty state is distinct from backend-empty state
- Planning required scope:
  - existing sorting and expand/collapse behavior stays intact
  - visual-only refactor does not change planning data behavior
- Validation already completed in repo:
  - `npm run test`
  - `npm run typecheck`
  - `npm run build`
- Planning optional scope, only if implemented:
  - child title/custom ID search keeps the parent story visible
  - assignee/status filters are descendant-aware
  - kind filter applies only to top-level items

## Assumptions

- Client-side filters are local UI state only.
- Filters are not URL-synced and are not persisted across full page reloads.
- The current backend read query shaping is sufficient for this slice.
- Existing write scaffolding may remain in the codebase temporarily, but it is out of scope for this project.
- Planning filters are non-blocking and should only be done after the required daily/read-only work is complete.
