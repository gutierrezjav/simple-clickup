# Simple ClickUp

Read-only ClickUp client for the `Wingtra Cloud Dev` list.

The active app surface is small and deliberate:

- `/daily`: primary board view
- `/verify`: hidden verification route for live spot-checks
- backend-owned ClickUp reads through an OAuth-backed session
- single-container deployment path for Amazon Lightsail Container Service

Current status: complete and in maintenance mode. The read-only roadmap and the Lightsail deployment work are closed.

## Workspace Layout

- `frontend/`: React + Vite UI
- `backend/`: TypeScript Express app, API routes, OAuth/session handling, and SPA serving
- `shared/`: shared types and ClickUp target constants
- `docs/`: handoff notes, implementation status, behavioral reference, and deployment plans

## Local Development

Install dependencies:

```bash
npm install
```

Run the frontend and backend together:

```bash
npm run dev
```

Default local URLs:

- frontend dev server: `http://localhost:3000`
- backend API and auth routes: `http://localhost:4000`

Useful commands:

```bash
npm run test
npm run typecheck
npm run build
docker build -t simple-clickup:local-test .
```

## Runtime Model

The project is read-only by design.

- the frontend never talks to ClickUp directly
- the backend reads ClickUp only with a session access token obtained through OAuth
- when no valid session exists, the backend returns `401` and the UI offers the Connect ClickUp flow
- there is no Storybook, no mock/live mode switch, and no `CLICKUP_ACCESS_TOKEN` env fallback
- `/planning` is no longer part of the app

The backend loads `.env` and `.env.local` values from the repo tree when present. See [.env.example](./.env.example) for the supported variables.

Core env vars for OAuth-enabled local or deployed use:

- `CLICKUP_CLIENT_ID`
- `CLICKUP_CLIENT_SECRET`
- `CLICKUP_REDIRECT_URI`
- `SESSION_SECRET`

Other supported env vars cover the API base URL, target workspace/list, request timeout, cache TTL, port, and secure-cookie toggle.

## Container And Deployment

Production runs as one container that serves both the frontend bundle and the backend API.

- [Dockerfile](./Dockerfile): multi-stage build for `shared`, `backend`, and `frontend`
- [.github/workflows/deploy-lightsail-container.yml](./.github/workflows/deploy-lightsail-container.yml): CI/CD pipeline
- [scripts/deploy-lightsail-container.sh](./scripts/deploy-lightsail-container.sh): Lightsail deployment helper

The deployed flow is:

1. GitHub Actions installs dependencies and runs verification checks.
2. The workflow builds one image and pushes it to Amazon ECR Public.
3. Lightsail Container Service deploys that image as the public app container.

## Notes

- `/verify` is intentionally kept out of the main navigation
- write behavior is intentionally out of scope in the active project
- the repo is optimized for maintenance and targeted fixes, not feature expansion

## Docs

- [docs/agent-handoff.md](./docs/agent-handoff.md)
- [docs/implementation-status.md](./docs/implementation-status.md)
- [docs/clickup-reference.md](./docs/clickup-reference.md)
- [docs/clickup-v1-plan.md](./docs/clickup-v1-plan.md)
- [docs/aws-lightsail-container-plan.md](./docs/aws-lightsail-container-plan.md)
- [docs/clickup-write-project-plan.md](./docs/clickup-write-project-plan.md)
