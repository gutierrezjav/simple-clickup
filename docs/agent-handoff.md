# Agent Handoff

Last updated: 2026-03-26

## Project Summary

This repo is a read-only ClickUp client for the `Wingtra Cloud Dev` list. It ships a daily board, a verification page, and a backend-owned ClickUp integration. The latest work adds a lazy story-status discrepancy check on top of the daily board plus the containerized deployment path for Amazon Lightsail Container Service.

## Current State

The application implementation is complete. The read-only roadmap is closed, the Lightsail deployment plan is complete, and the project is now in maintenance mode. The app works locally in both mock mode and live OAuth mode, and the repo contains the finalized container build and GitHub Actions deployment path.

Recent maintenance work tightened the daily board behavior and layout:

- only actual story items own story swimlanes
- task descendants inherit the correct swimlane instead of spawning accidental story rows
- daily status columns are now client-side collapsible and expandable from the header
- `SPRINT BACKLOG`, `IN PROGRESS`, and `IN CODE REVIEW` stay expanded by default even when empty
- collapsed columns hide their cards and use a compact rail presentation
- sticky swimlane headers now keep a flat opaque surface during horizontal scroll
- the backend now exposes a dedicated story-status discrepancy read that compares each story against its active child-task progression
- the daily page triggers that discrepancy read lazily after the board loads and shows a dismissible warning banner when stories are out of sync
- the daily page now includes a frontend-only `Next` helper for standups that rotates through assignee filter names
- the `Next` helper skips `Unassigned` and `Javier Gutierrez`, keeps `Jessica Nilsson` last when present, and preserves its stored order across manual filter changes and refreshes
- daily board design guardrails now live in [docs/clickup-reference.md](/data/simple-clickup/docs/clickup-reference.md) and [docs/clickup-v1-plan.md](/data/simple-clickup/docs/clickup-v1-plan.md)
- the old planning view and planning loader have been discontinued and removed from the active app

Recent deployment-related commits:

- `de1dfa7` `Add Lightsail container deployment`
- `b1c494f` `Add AWS Lightsail container deployment plan`
- `e1a5f2c` `Fix frontend shared import resolution in tests`

## What Is Implemented

### Application Runtime

- [backend/src/app.ts](/data/simple-clickup/backend/src/app.ts): Express now serves the built frontend bundle in addition to `/api`, `/auth`, and `/health`.
- [backend/test/app.test.ts](/data/simple-clickup/backend/test/app.test.ts): backend coverage for SPA route serving, static asset serving, and API route preservation.
- [shared/src/fixtures.ts](/data/simple-clickup/shared/src/fixtures.ts): still provides mock-mode data when `CLICKUP_READ_MODE=mock`.

### Containerization

- [Dockerfile](/data/simple-clickup/Dockerfile): multi-stage build for `shared`, `backend`, and `frontend`, with one runtime image serving both UI and API.
- [.dockerignore](/data/simple-clickup/.dockerignore): excludes local env files, docs, build output, and node modules from the image context.

### Deployment Automation

- [.github/workflows/deploy-lightsail-container.yml](/data/simple-clickup/.github/workflows/deploy-lightsail-container.yml): GitHub Actions workflow that installs dependencies, runs tests, builds and pushes the image to ECR Public, then updates a Lightsail container deployment.
- [scripts/deploy-lightsail-container.sh](/data/simple-clickup/scripts/deploy-lightsail-container.sh): creates the Lightsail container service if needed, injects runtime env vars, sets the public endpoint and health check, and waits for the service to reach `RUNNING`.

### OAuth And Live Reads

- The backend already supported OAuth and live reads before the deployment work.
- Local Docker OAuth mode now works when the container is started with runtime env vars, `CLICKUP_READ_MODE=live`, no `CLICKUP_ACCESS_TOKEN`, `PORT=8080`, and a localhost callback URL.
- The frontend shows the Connect ClickUp path when the backend returns `401`.

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
  - `CLICKUP_READ_MODE=live`
  - `CLICKUP_ACCESS_TOKEN=`
  - `CLICKUP_REDIRECT_URI=http://localhost:8080/auth/clickup/callback`
  - `SESSION_COOKIE_SECURE=false`
- Verified the live-mode pre-login state:
  - backend listened on port `8080`
  - `GET /api/clickup/daily` returned `401 Unauthorized`
  - response header `x-custom-clickup-read-mode: live`

## Open Follow-Ups

No active delivery work remains on the current roadmap.

Optional or deferred items only:

- optional UX polish such as exposing the mock/live status banner on Daily
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
- [frontend/src/styles.css](/data/simple-clickup/frontend/src/styles.css): daily board layout, collapsed-column styling, sticky swimlane treatment, and discrepancy warning styling
- [frontend/src/routes/verification-page.tsx](/data/simple-clickup/frontend/src/routes/verification-page.tsx): verification screen and only visible mock/live badge

### Backend

- [backend/src/app.ts](/data/simple-clickup/backend/src/app.ts): Express app wiring and frontend static serving
- [backend/src/routes/clickup.ts](/data/simple-clickup/backend/src/routes/clickup.ts): read endpoints, including `/api/clickup/story-status-discrepancies`
- [backend/src/routes/auth.ts](/data/simple-clickup/backend/src/routes/auth.ts): OAuth routes
- [backend/src/config.ts](/data/simple-clickup/backend/src/config.ts): env parsing
- [backend/src/clickup/service.ts](/data/simple-clickup/backend/src/clickup/service.ts): mock/live read-mode behavior plus story-status discrepancy logic
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
  -e CLICKUP_READ_MODE=live \
  -e CLICKUP_ACCESS_TOKEN= \
  -e CLICKUP_REDIRECT_URI=http://localhost:8080/auth/clickup/callback \
  -e SESSION_COOKIE_SECURE=false \
  simple-clickup:local-test
```

## Guardrails

- Do not add production write behavior in this project.
- Keep backend reads server-side; the frontend should not call ClickUp directly.
- Do not bake secrets into the Docker image or Dockerfile.
- Treat GitHub Actions environment vars/secrets as the source of truth for deployed container env.
- If a database becomes necessary, treat it as a separate follow-up decision. The current Lightsail container plan is stateless.

## Next Agent Focus

- maintenance only
- investigate only if new live mismatches, deployment regressions, or OAuth issues are observed
- any future mutation work should start from [docs/clickup-write-project-plan.md](/data/simple-clickup/docs/clickup-write-project-plan.md)
