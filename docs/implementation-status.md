# Implementation Status

Last updated: 2026-04-02

## Summary

The active read-only roadmap and the Lightsail deployment plan are complete. The repo now has a verified read-only ClickUp client centered on the daily board, a TypeScript `Express` backend, shared normalized types, and a GitHub Actions deployment path for Amazon Lightsail Container Service.

## What Has Been Done

### Frontend

- `/daily` is the primary product route
- `/verify` remains available for targeted live verification but is hidden from the main navigation
- `/planning` is no longer part of the app
- route-level loading, retry, rate-limit, and empty states are implemented
- daily renders story rows, standalone task/bug rows, nested stories as rows, and visible ancestors
- daily keeps story rows visible even before any child task cards exist
- daily story swimlane headers show the story assignee avatar and name instead of the old `Story` pill
- daily keeps task-parent hierarchies inside the correct inherited swimlane instead of promoting parent tasks into story rows
- daily supports local search and assignee filters plus filtered totals, and story assignees now participate in the assignee filter even without matching child cards
- daily includes a frontend-only `Next` helper that cycles through assignee filter names for standup facilitation
- after a round has started, the `Next` button shows a subtle tooltip preview of the upcoming speaker using only their first name
- daily status columns are client-side collapsible and expandable from the header, and collapsed columns hide their cards
- `SPRINT BACKLOG`, `IN PROGRESS`, and `IN CODE REVIEW` no longer auto-collapse when empty, though manual collapsing still works
- daily lazily requests story-status discrepancy data after the board loads and shows a dismissible warning banner when parent stories fall behind their active child-task progression
- daily cards are top-aligned in each status column
- daily swimlane headers keep a sticky flat surface during horizontal scrolling, and the card layout is denser than the original board styling
- truncated daily card title, custom ID, and assignee text now expose the full value in a native tooltip only when the text overflows
- the `Next` helper uses the current assignee filter list, including story-only assignees, skips `Unassigned`, `Javier Gutierrez`, and `Basil Weibel`, keeps `Jessica Nilsson` last when present, and preserves its stored order across search, manual assignee changes, clear-filters, and refresh actions
- the current daily board design guidance is documented in [docs/clickup-reference.md](/data/simple-clickup/docs/clickup-reference.md) and [docs/clickup-v1-plan.md](/data/simple-clickup/docs/clickup-v1-plan.md)

### Backend

- `/health`, `/auth`, and `/api/clickup` route groups are implemented
- OAuth start and callback flows are implemented
- session-backed reads support `daily`, `story-status-discrepancies`, and verification summaries
- ClickUp reads include metadata caching, task caching, request deduplication, and rate-limit handling
- backend normalization converts ClickUp responses into the shared daily shapes and the story-status discrepancy report
- the discontinued planning loader and planning route have been removed from the active app
- unused mode toggles, token env fallback, and non-active API helpers were removed

### Shared

- normalized types exist for daily and story-status discrepancy data, plus the verification summary schema shape
- canonical daily statuses and the ClickUp target constants are shared between frontend and backend

### Deployment

- the repo ships a multi-stage Docker image that serves both the frontend and backend from one runtime container
- the backend serves the built SPA bundle alongside `/api`, `/auth`, and `/health`
- the GitHub Actions deployment workflow and Lightsail deployment helper are implemented
- the AWS/GitHub deployment setup is complete and the deployment plan is closed

## Remaining Work

- no active implementation work remains on the current roadmap
- the old planning view has been discontinued and is no longer planned
- future targeted fixes are only needed if new live mismatches or deployment regressions are observed
- all mutation work remains outside this completed read-only project

## Known Caveats

- The headless browser used by automation does not share your local authenticated ClickUp browser session.
- `/verify` is intentionally hidden from the main navigation even though it remains a supported route.

## Main Entry Points

- [docs/agent-handoff.md](/data/simple-clickup/docs/agent-handoff.md): fastest handoff for the next agent
- [docs/clickup-v1-plan.md](/data/simple-clickup/docs/clickup-v1-plan.md): closed read-only roadmap
- [docs/clickup-reference.md](/data/simple-clickup/docs/clickup-reference.md): stable behavior and data reference
- [backend/src/clickup/service.ts](/data/simple-clickup/backend/src/clickup/service.ts): core read normalization
- [frontend/src/routes/daily-page.tsx](/data/simple-clickup/frontend/src/routes/daily-page.tsx): daily board UI
