# Simple Clickup

Read-only ClickUp client for the `Wingtra Cloud Dev` list.

The app provides:

- a planning view at `/planning`
- a daily board at `/daily`
- a verification view at `/verify`
- backend-owned ClickUp reads and OAuth
- a single-container deployment path for Amazon Lightsail Container Service

Current status: complete. The read-only roadmap and deployment plan are closed, and the project is in maintenance mode.

## Workspace Layout

- `frontend/`: React + Vite UI
- `backend/`: TypeScript Express API and OAuth/session handling
- `shared/`: shared types, fixtures, and schema constants
- `docs/`: project plans, status, and deployment reference

## Local Development

Install dependencies:

```bash
npm install
```

Start frontend and backend together:

```bash
npm run dev
```

Useful commands:

```bash
npm run test
npm run typecheck
npm run build
```

The default local shape is:

- frontend dev server: `http://localhost:3000`
- backend API: `http://localhost:4000`

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

The backend loads `.env` and `.env.local` values from the repo tree when present.

## Deployment

Production deployment is already wired:

- GitHub Actions builds and tests the repo
- the image is pushed to Amazon ECR Public
- Amazon Lightsail Container Service runs one container serving both UI and API

The deployment workflow is in `.github/workflows/deploy-lightsail-container.yml`.

## Notes

- `/verify` is intentionally kept out of the main navigation
- the frontend never talks to ClickUp directly
- write-mode work is intentionally out of scope in this repo
- Storybook in this environment should be run with `HOME=/tmp STORYBOOK_DISABLE_TELEMETRY=1`

## Docs

- `docs/implementation-status.md`
- `docs/agent-handoff.md`
- `docs/clickup-v1-plan.md`
- `docs/clickup-reference.md`
- `docs/aws-lightsail-container-plan.md`
