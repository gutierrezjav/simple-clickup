# Simple ClickUp

Read-only ClickUp client for the `Wingtra Cloud Dev` list.

The current product surface is centered on the daily board:

- `/daily`: primary board view
- `/verify`: hidden verification route for live spot-checks
- `/planning`: compatibility redirect to `/daily`
- backend-owned ClickUp reads plus OAuth session support
- single-container deployment path for Amazon Lightsail Container Service

Current status: complete. The read-only roadmap and the Lightsail deployment plan are closed, and the repo is now in maintenance mode.

## Workspace Layout

- `frontend/`: React + Vite UI
- `backend/`: TypeScript Express app, API routes, OAuth/session handling, and SPA serving
- `shared/`: shared types, fixtures, and schema constants
- `docs/`: handoff notes, implementation status, reference behavior, and deployment plans

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

## Read Modes

The project is read-only by design.

- `mock` mode is the default safe local mode
- `live` mode uses server-side ClickUp access through either an access token or OAuth session auth

Typical live-mode variables:

- `CLICKUP_READ_MODE=live`
- `CLICKUP_CLIENT_ID`
- `CLICKUP_CLIENT_SECRET`
- `CLICKUP_REDIRECT_URI`
- `SESSION_SECRET`

The backend loads `.env` and `.env.local` values from the repo tree when present. See [.env.example](./.env.example) for the supported variables.

## Container And Deployment

Production runs as one container that serves both the frontend bundle and the backend API.

- [Dockerfile](./Dockerfile): multi-stage build for `shared`, `backend`, and `frontend`
- [.github/workflows/deploy-lightsail-container.yml](./.github/workflows/deploy-lightsail-container.yml): CI/CD pipeline
- [scripts/deploy-lightsail-container.sh](./scripts/deploy-lightsail-container.sh): Lightsail deployment helper

The deployed flow is:

1. GitHub Actions installs dependencies and runs tests.
2. The workflow builds one image and pushes it to Amazon ECR Public.
3. Lightsail Container Service deploys that image as the public app container.

## Notes

- `/verify` is intentionally kept out of the main navigation
- the frontend never talks to ClickUp directly
- write-mode work is intentionally out of scope in the active project
- Storybook in this environment should be run with `HOME=/tmp STORYBOOK_DISABLE_TELEMETRY=1`

## Docs

- [docs/agent-handoff.md](./docs/agent-handoff.md)
- [docs/implementation-status.md](./docs/implementation-status.md)
- [docs/clickup-reference.md](./docs/clickup-reference.md)
- [docs/clickup-v1-plan.md](./docs/clickup-v1-plan.md)
- [docs/aws-lightsail-container-plan.md](./docs/aws-lightsail-container-plan.md)
