# Agent Handoff

Last updated: 2026-03-26

## Project Summary

This repo is a read-only ClickUp client for the `Wingtra Cloud Dev` list. It ships a daily board, a hidden verification route, and a backend-owned ClickUp integration. The app is now intentionally narrow: no planning surface, no Storybook, no runtime mode split, and no env-token fallback.

## Current State

The application implementation is complete. The read-only roadmap is closed, the Lightsail deployment plan is complete, and the project is now in maintenance mode. The current runtime shape is one server-backed path:

- `/daily` is the primary route
- `/verify` is available for targeted session-backed verification only
- `/planning` has been removed from the app
- ClickUp data is read only from the backend
- the backend requires an OAuth-backed session token to read ClickUp data
- there is no Storybook, mock mode, live mode toggle, or `CLICKUP_ACCESS_TOKEN` environment path

Recent maintenance work tightened the daily board behavior and layout:

- only actual story items own story swimlanes
- story swimlanes remain visible even when a story has no child task cards yet
- task descendants inherit the correct swimlane instead of spawning accidental story rows
- daily status columns are now client-side collapsible and expandable from the header
- `SPRINT BACKLOG`, `IN PROGRESS`, and `IN CODE REVIEW` stay expanded by default even when empty
- `DEPLOYED TO STAGING` and `TESTED IN STAGING` now start collapsed by default even when they contain cards
- collapsed columns hide their cards and use a compact rail presentation
- sticky swimlane headers now keep a flat opaque surface during horizontal scroll
- the backend now exposes a dedicated story-status discrepancy read that compares each story against its active child-task progression
- the daily page triggers that discrepancy read lazily after the board loads and shows a dismissible warning banner when stories are out of sync
- the daily page now includes a frontend-only `Next` helper for standups that rotates through assignee filter names
- the `Next` helper skips `Unassigned` and `Javier Gutierrez`, keeps `Jessica Nilsson` last when present, and preserves its stored order across manual filter changes and refreshes
- after a round has started, the `Next` button now previews the upcoming speaker via a subtle first-name tooltip
- story swimlane titles now clamp to two lines and show the full title in a native overflow tooltip
- swimlane headers no longer show the old `x / n cards` counter, and the shared minimum row height is tighter again
- truncated daily card title, custom ID, and assignee text now expose the full value in a native tooltip
- daily swimlanes now use a slightly smaller shared minimum row height to keep sparse boards denser
- daily board design guardrails now live in [docs/clickup-reference.md](/data/simple-clickup/docs/clickup-reference.md) and [docs/clickup-v1-plan.md](/data/simple-clickup/docs/clickup-v1-plan.md)
- the old planning view and planning loader have been discontinued and removed from the active app
- the old Storybook-only fixtures, stories, and mode badges were removed as part of the simplification pass

Recent deployment-related commits:

- `de1dfa7` `Add Lightsail container deployment`
- `b1c494f` `Add AWS Lightsail container deployment plan`
- `e1a5f2c` `Fix frontend shared import resolution in tests`

## What Is Implemented

### Application Runtime

- [backend/src/app.ts](/data/simple-clickup/backend/src/app.ts): Express now serves the built frontend bundle in addition to `/api`, `/auth`, and `/health`.
- [backend/test/app.test.ts](/data/simple-clickup/backend/test/app.test.ts): backend coverage for SPA route serving, static asset serving, and API route preservation.
- [frontend/src/app.tsx](/data/simple-clickup/frontend/src/app.tsx): route shell for `/daily`, `/verify`, root redirect, and generic not-found handling.

### Containerization

- [Dockerfile](/data/simple-clickup/Dockerfile): multi-stage build for `shared`, `backend`, and `frontend`, with one runtime image serving both UI and API.
- [.dockerignore](/data/simple-clickup/.dockerignore): excludes local env files, docs, build output, and node modules from the image context.

### Deployment Automation

- [.github/workflows/deploy-lightsail-container.yml](/data/simple-clickup/.github/workflows/deploy-lightsail-container.yml): GitHub Actions workflow that installs dependencies, runs tests, builds and pushes the image to ECR Public, then updates a Lightsail container deployment.
- [scripts/deploy-lightsail-container.sh](/data/simple-clickup/scripts/deploy-lightsail-container.sh): creates the Lightsail container service if needed, injects runtime env vars, sets the public endpoint and health check, and waits for the service to reach `RUNNING`.

### OAuth And ClickUp Reads

- The backend reads ClickUp only with an OAuth-backed session token.
- The frontend shows the Connect ClickUp path when the backend returns `401`.
- The backend no longer supports read-mode switching, token env fallbacks, or schema/debug helper endpoints that are not part of the active product.

## What Was Tested

### Repo Verification

- `npm test`: passed
- `npm run build`: passed
- `bash -n scripts/deploy-lightsail-container.sh`: passed

### Container Verification

- `docker build -t simple-clickup:local-test .`: passed
- Started the built image locally and verified:
  - `GET /health` returned `200`
  - `GET /daily` served the compiled frontend HTML

### OAuth Mode Verification

- Restarted the local container with runtime env vars from `.env` plus overrides:
  - `PORT=8080`
  - `CLICKUP_REDIRECT_URI=http://localhost:8080/auth/clickup/callback`
  - `SESSION_COOKIE_SECURE=false`
- Verified the pre-login state:
  - backend listened on port `8080`
  - `GET /api/clickup/daily` returned `401 Unauthorized`

## Open Follow-Ups

No active delivery work remains on the current roadmap.

Optional or deferred items only:

- Database support is still intentionally deferred. The current deployment path assumes a stateless app container.

## Main Entry Points

### Root

- [package.json](/data/simple-clickup/package.json): workspace scripts
- [Dockerfile](/data/simple-clickup/Dockerfile): runtime image build
- [.github/workflows/deploy-lightsail-container.yml](/data/simple-clickup/.github/workflows/deploy-lightsail-container.yml): CI/CD entry point
- [scripts/deploy-lightsail-container.sh](/data/simple-clickup/scripts/deploy-lightsail-container.sh): Lightsail deployment helper
- [docs/aws-lightsail-container-plan.md](/data/simple-clickup/docs/aws-lightsail-container-plan.md): deployment plan and rationale

### Frontend

- [frontend/src/app.tsx](/data/simple-clickup/frontend/src/app.tsx): route shell
- [frontend/src/routes/daily-page.tsx](/data/simple-clickup/frontend/src/routes/daily-page.tsx): daily board screen
- [frontend/src/lib/clickup-api.ts](/data/simple-clickup/frontend/src/lib/clickup-api.ts): frontend fetch layer, including the lazy story-status discrepancy read
- [frontend/src/lib/daily-board.ts](/data/simple-clickup/frontend/src/lib/daily-board.ts): daily filter logic and visible-status derivation
- [frontend/src/lib/daily-meeting.ts](/data/simple-clickup/frontend/src/lib/daily-meeting.ts): frontend-only standup rotation logic for the `Next` helper
- [frontend/src/components/task/task-primitives.tsx](/data/simple-clickup/frontend/src/components/task/task-primitives.tsx): shared task text rendering and overflow-aware native tooltip behavior
- [frontend/src/styles.css](/data/simple-clickup/frontend/src/styles.css): daily board layout, row sizing, collapsed-column styling, sticky swimlane treatment, and discrepancy warning styling
- [frontend/src/routes/verification-page.tsx](/data/simple-clickup/frontend/src/routes/verification-page.tsx): verification screen

### Backend

- [backend/src/app.ts](/data/simple-clickup/backend/src/app.ts): Express app wiring and frontend static serving
- [backend/src/routes/clickup.ts](/data/simple-clickup/backend/src/routes/clickup.ts): read endpoints, including `/api/clickup/story-status-discrepancies`
- [backend/src/routes/auth.ts](/data/simple-clickup/backend/src/routes/auth.ts): OAuth routes
- [backend/src/config.ts](/data/simple-clickup/backend/src/config.ts): env parsing
- [backend/src/clickup/service.ts](/data/simple-clickup/backend/src/clickup/service.ts): session-backed read service plus story-status discrepancy logic
- [backend/test/app.test.ts](/data/simple-clickup/backend/test/app.test.ts): SPA serving and route safety coverage

## Working Commands

```bash
npm install
npm run dev
npm run test
npm run typecheck
npm run build
docker build -t simple-clickup:local-test .
```

Local OAuth-mode container run:

```bash
docker run -d --rm \
  --name simple-clickup-local \
  -p 8080:8080 \
  --env-file .env \
  -e PORT=8080 \
  -e CLICKUP_REDIRECT_URI=http://localhost:8080/auth/clickup/callback \
  -e SESSION_COOKIE_SECURE=false \
  simple-clickup:local-test
```

## Guardrails

- Do not add production write behavior in this project.
- Keep backend reads server-side; the frontend should not call ClickUp directly.
- Keep the runtime simple; do not reintroduce Storybook, mock/live mode switching, or token-env fallbacks without an explicit scope change.
- Do not bake secrets into the Docker image or Dockerfile.
- Treat GitHub Actions environment vars/secrets as the source of truth for deployed container env.
- If a database becomes necessary, treat it as a separate follow-up decision. The current Lightsail container plan is stateless.

## Next Agent Focus

- maintenance only
- investigate only if new live mismatches, deployment regressions, or OAuth issues are observed
- any future mutation work should start from [docs/clickup-write-project-plan.md](/data/simple-clickup/docs/clickup-write-project-plan.md)
