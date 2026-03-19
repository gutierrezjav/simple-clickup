# AWS Lightsail Container Deployment Plan

Last updated: 2026-03-19

## Status

Done.

The repo implementation, GitHub Actions deployment workflow, and required AWS/GitHub deployment setup are complete. Keep this document as reference for the deployed shape and for future maintenance.

## Summary

- Target platform: Amazon Lightsail Container Service.
- Container registry: Amazon ECR Public by default.
- Deployment flow: GitHub Actions builds one image, pushes it to the registry, then updates the Lightsail container deployment.
- Runtime shape: one container serves both the frontend and the API.
- Database: keep the first deployment stateless; add an external database later if needed.

## Why This Option

- A fixed public IPv4 is no longer required, so a managed hostname-based service is acceptable.
- Public images are acceptable, which keeps Lightsail Container Service compatible with the registry choice.
- The current app already assumes one origin for frontend, API, and auth, so one container is the simplest production shape.
- Lightsail Container Service is cheaper and simpler to operate than running a dedicated VM for a small stateless app.

## Application Shape

- Add a multi-stage Dockerfile at the repo root.
- Build `shared`, `backend`, and `frontend` in the image build.
- Run a single Node process in the final image.
- Update the backend to serve the built frontend assets and SPA fallback in addition to existing `/api`, `/auth`, and `/health` routes.
- Expose one port in the container, with `PORT=8080` in production.

## Production Configuration

Use the existing backend config model and set these values in the Lightsail deployment:

- `PORT=8080`
- `SESSION_COOKIE_SECURE=true`
- `SESSION_SECRET=<strong-random-secret>`
- `CLICKUP_CLIENT_ID=<value>`
- `CLICKUP_CLIENT_SECRET=<value>`
- `CLICKUP_REDIRECT_URI=https://<your-domain>/auth/clickup/callback`
- Other required `CLICKUP_*` variables already supported by the backend config

## AWS Components

- One Lightsail Container Service.
- One public endpoint container.
- One custom domain mapped to the service endpoint.
- Lightsail-managed TLS for HTTPS.
- One Amazon ECR Public repository for the deployable image.

## CI/CD Flow

- Trigger on `push` to `main` and `workflow_dispatch`.
- Use GitHub OIDC to assume an AWS role from GitHub Actions.
- Build the image once in CI.
- Push tags for both `latest` and the commit SHA to ECR Public.
- Update the Lightsail container service to deploy the new image tag.
- Do not SSH into hosts and do not build on the target environment.

## Database Strategy

- First release: no database inside the container service.
- First persistent database step: add a separate managed database, preferably Lightsail Managed Database for the lowest-ops AWS option.
- If the requirement changes to "DB in the same deployed stack", switch the compute target to a Lightsail VM with Docker Compose instead of forcing persistence into Lightsail Container Service.

## Validation Checklist

- The container image builds locally and in GitHub Actions.
- The Lightsail endpoint serves the app successfully over HTTPS.
- The custom domain serves the same deployment successfully over HTTPS.
- Direct browser refresh works on `/planning`, `/daily`, and `/verify`.
- `/health` returns `200`.
- Frontend requests to `/api` and `/auth` work through the same origin.
- ClickUp OAuth completes with secure cookies enabled.
- A GitHub Actions run can deploy a new image without manual console changes.

## References

- AWS Lightsail pricing: https://aws.amazon.com/lightsail/pricing/
- AWS Lightsail container services overview: https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-container-services.html
- AWS Lightsail container deployments: https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-container-services-deployments.html
- AWS Lightsail container FAQ: https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-faq-containers.html
- Amazon ECR pricing: https://aws.amazon.com/ecr/pricing/
- GitHub OIDC for AWS: https://docs.github.com/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services
