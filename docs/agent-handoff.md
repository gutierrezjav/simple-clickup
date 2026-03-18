# Agent Handoff

Last updated: 2026-03-18

## Project Summary

This repo is a read-only ClickUp client for the `Wingtra Cloud Dev` list. It ships a planning view, a daily board, and a backend-owned ClickUp integration. Write work remains out of scope.

## Current State

Phases 1 and 2 are done. The read-only UI, OAuth flow, live-read backend, daily board filters, and current layout pass are implemented and verified against the real ClickUp planning and daily views.

## Read Order

1. [implementation-status.md](/data/simple-clickup/docs/implementation-status.md)
2. [clickup-v1-plan.md](/data/simple-clickup/docs/clickup-v1-plan.md)
3. [clickup-reference.md](/data/simple-clickup/docs/clickup-reference.md)

## Main Entry Points

### Root

- [package.json](/data/simple-clickup/package.json): workspace scripts
- [docs/implementation-status.md](/data/simple-clickup/docs/implementation-status.md): current delivered state
- [docs/clickup-v1-plan.md](/data/simple-clickup/docs/clickup-v1-plan.md): active roadmap
- [docs/clickup-reference.md](/data/simple-clickup/docs/clickup-reference.md): stable product and data-model reference

### Frontend

- [frontend/src/app.tsx](/data/simple-clickup/frontend/src/app.tsx): route shell
- [frontend/src/routes/planning-page.tsx](/data/simple-clickup/frontend/src/routes/planning-page.tsx): planning screen
- [frontend/src/routes/daily-page.tsx](/data/simple-clickup/frontend/src/routes/daily-page.tsx): daily board screen
- [frontend/src/routes/verification-page.tsx](/data/simple-clickup/frontend/src/routes/verification-page.tsx): hidden verification screen for targeted live checks
- [frontend/src/lib/clickup-api.ts](/data/simple-clickup/frontend/src/lib/clickup-api.ts): frontend fetch layer
- [frontend/src/lib/daily-board.ts](/data/simple-clickup/frontend/src/lib/daily-board.ts): pure daily filtering and totals
- [frontend/src/styles.css](/data/simple-clickup/frontend/src/styles.css): main layout and board styling

### Backend

- [backend/src/app.ts](/data/simple-clickup/backend/src/app.ts): Express app wiring
- [backend/src/routes/clickup.ts](/data/simple-clickup/backend/src/routes/clickup.ts): read endpoints
- [backend/src/routes/auth.ts](/data/simple-clickup/backend/src/routes/auth.ts): OAuth routes
- [backend/src/config.ts](/data/simple-clickup/backend/src/config.ts): env parsing
- [backend/src/clickup/service.ts](/data/simple-clickup/backend/src/clickup/service.ts): live loaders and normalization
- [backend/src/clickup/client.ts](/data/simple-clickup/backend/src/clickup/client.ts): ClickUp REST client
- [backend/src/clickup/verification.ts](/data/simple-clickup/backend/src/clickup/verification.ts): verification summary builder
- [backend/test/clickup-service.test.ts](/data/simple-clickup/backend/test/clickup-service.test.ts): backend behavior coverage

### Shared

- [shared/src/types.ts](/data/simple-clickup/shared/src/types.ts): canonical types and status constants
- [shared/src/fixtures.ts](/data/simple-clickup/shared/src/fixtures.ts): fixture data for mock mode and Storybook

## Working Commands

```bash
npm install
npm run dev
npm run test
npm run typecheck
npm run build
HOME=/tmp STORYBOOK_DISABLE_TELEMETRY=1 npm run build-storybook
```

## Environment Notes

Most local work should stay in mock mode.

For live reads, the backend supports:

- `CLICKUP_READ_MODE=live`
- `CLICKUP_ACCESS_TOKEN` or OAuth session auth
- `CLICKUP_CLIENT_ID`
- `CLICKUP_CLIENT_SECRET`
- `CLICKUP_REDIRECT_URI`
- `SESSION_SECRET`
- `SESSION_COOKIE_SECURE=false` for local HTTP

## Guardrails

- Do not add production write behavior in this project.
- Keep backend reads server-side; the frontend should not call ClickUp directly.
- Do not treat every observed ClickUp field as hard-required. Only fields used by the current normalization should block reads.
- Leave `docs/clickup-write-project-plan.md` untouched unless the task is explicitly about mutations.

## Next Agent Focus

- keep the verified read model stable and fix only new concrete live mismatches
- leave `/verify` available for targeted checks, but do not surface it in the primary navigation
- keep optional planning filters deferred until they are explicitly needed
