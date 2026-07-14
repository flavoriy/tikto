# TikTo

[![Quality gate](https://sonarcloud.io/api/project_badges/quality_gate?project=flavoriy_tikto)](https://sonarcloud.io/summary/new_code?id=flavoriy_tikto)

TikTo is a workspace monorepo split into one public web/BFF app and five internal microservices (`gateway`, `profile`, `tasks`, `calendar`, `dashboard`).

```text
Browser
  -> apps/web             # Next.js UI and BFF proxy routes
     -> services/gateway   # API Gateway (rate limiting, route proxying, health aggregation)
        -> services/profile   # profile domain and persistence
        -> services/tasks     # task domain and persistence
        -> services/calendar  # calendar/event domain and persistence
        -> services/dashboard # dashboard composition over internal HTTP APIs
```

Only `apps/web` (and optionally `services/gateway` internally) should receive incoming client traffic. The internal services run behind Docker Compose or Kubernetes cluster networking.
# TikTo Application

TikTo is a task and calendar planning application built with Next.js, TypeScript, Supabase, and Prisma. This repository contains the application source code and the CI/CD workflows used to validate, package, scan, publish, and deploy the application through GitOps.

The package name is `taskflow`; the Kubernetes workload is deployed with the `tikto` application slug.

## Key Capabilities

- Next.js 16 App Router application with authenticated dashboard routes and API endpoints.
- Task, event, profile, integration, and dashboard service layers backed by repository-based data access.
- Supabase Auth, Supabase PostgreSQL, Prisma, Google OAuth foundations, Google Calendar/Tasks sync foundations, Telegram settings, and QStash reminder webhook foundations.
- Reusable GitHub Actions workflows for ESLint analysis, TypeScript validation, unit testing, coverage reporting, production builds, and SonarCloud quality-gate checks.
- Docker image delivery pipeline with environment-scoped version tags, Trivy HIGH/CRITICAL vulnerability scanning, and GHCR publishing.
- Composite GitHub Actions for AWS Secrets Manager loading, image tag generation, GitOps manifest updates, and Argo CD deployment verification.

## Repository Layout

```text
apps/
  web/
    src/
    Dockerfile
    package.json
    next.config.ts
    tsconfig.json

services/
  gateway/
    src/
    Dockerfile
    package.json
  profile/
    src/
    prisma/schema.prisma
    Dockerfile
    package.json
  tasks/
    src/
    prisma/schema.prisma
    Dockerfile
    package.json
  calendar/
    src/
    prisma/schema.prisma
    Dockerfile
    package.json
  dashboard/
    src/
    Dockerfile
    package.json

packages/
  contracts/        # DTO validation and serializers shared across service boundaries
  service-runtime/  # HTTP, health, logging, error, and DB helpers for services
  shared/           # generic utilities such as dates and Supabase env helpers
```

Generated files and build outputs are not committed:

```text
apps/web/.next/
dist-services/
services/*/src/generated/
coverage/
test-results/
playwright-report/
```

## Requirements

- Node.js 24.x for local development parity with the current lockfile.
- npm workspaces.
- A Supabase project for authentication and Postgres.
- Docker only if you want to run the container path locally.

## Environment
Available features:

- Email/password authentication (with automatic registration if the account doesn't exist) and Google OAuth sign-in through Supabase Auth.
- Protected dashboard layout with responsive navigation.
- Task CRUD with status, priority, overdue, completed, upcoming, and board-oriented views.
- Event CRUD with timed and all-day event handling.
- Dashboard summaries for daily planning.
- User profile and timezone settings.
- Google integration routes for OAuth, import, incremental sync, retry, callback, and disconnect flows.
- Telegram integration settings and reminder delivery foundations.
- Health endpoint for Kubernetes readiness checks.

In progress:

- Calendar watch renewal exists as a route; longer-running automation is planned for production-style operation.
- Existing Supabase databases should rerun the SQL setup/schema scripts when new reminder or sync columns are added.
- End-to-end integration testing requires live third-party credentials and webhook configuration.

## Technology Stack

Create a root `.env` or `.env.local` from `.env.example`. Keep env files out of git.

Minimum local values:
## Repository Structure

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000

TIKTO_GATEWAY_API_URL=http://localhost:4000
TIKTO_PROFILE_API_URL=http://localhost:4100
TIKTO_TASKS_API_URL=http://localhost:4200
TIKTO_CALENDAR_API_URL=http://localhost:4300
TIKTO_DASHBOARD_API_URL=http://localhost:4400
TIKTO_INTERNAL_API_KEY=

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

DATABASE_URL=
PROFILE_DATABASE_URL=
TASKS_DATABASE_URL=
CALENDAR_DATABASE_URL=
TOKEN_ENCRYPTION_KEY=
```

Use `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for newer Supabase projects. `NEXT_PUBLIC_SUPABASE_ANON_KEY` is still accepted for older projects.

## Local Development

Install dependencies:

```bash
npm install
```

Build all internal services (including gateway):

```bash
npm run services:build
```

Run each process in a separate terminal:

```bash
npm run service:gateway:start
npm run service:profile:start
npm run service:tasks:start
npm run service:calendar:start
npm run service:dashboard:start
npm run dev
```

Health checks:

```text
http://localhost:3000/api/health
http://localhost:4000/health
http://localhost:4100/health
http://localhost:4200/health
http://localhost:4300/health
http://localhost:4400/health
```

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Start `apps/web` with the Next.js dev server |
| `npm run web:build` | Build the web app |
| `npm run services:build` | Generate Prisma clients and compile all internal services |
| `npm run service:gateway:build` | Build the API gateway service |
| `npm run service:gateway:start` | Start the compiled gateway service |
| `npm run service:profile:start` | Start the compiled profile service |
| `npm run service:tasks:start` | Start the compiled tasks service |
| `npm run service:calendar:start` | Start the compiled calendar service |
| `npm run service:dashboard:start` | Start the compiled dashboard service |
| `npm run typecheck` | Typecheck web, packages, and services |
| `npm run test:run` | Run Vitest tests |
| `npm run lint` | Run ESLint |

The old `api:*` aliases were removed so there is no longer a misleading shared API service entrypoint.

## Containers & Optimization

To optimize build performance and save CI resources, TikTo uses a **Docker Base Image** pattern:
- **`base.Dockerfile`**: Contains the common Node.js 22 runtime, system dependencies (`openssl`, `libc6-compat`), and root `node_modules` (installed via `npm ci`).
- **Service Dockerfiles**: Use a parameterized `ARG BASE_IMAGE` build argument defaulting to `tikto-base:local`. They copy compiled code from the base image instead of re-installing dependencies.

### Local Development with Containers

1. Build the base image locally:
   ```bash
   npm run docker:build-base
   ```
2. Build the individual service containers (this will be nearly instantaneous):
   ```bash
   docker compose build
   ```
3. Run everything locally:
   ```bash
   docker compose up
   ```

The image repositories are:
```text
ghcr.io/flavoriy/tikto-base
ghcr.io/flavoriy/tikto-web
ghcr.io/flavoriy/tikto-gateway
ghcr.io/flavoriy/tikto-profile
ghcr.io/flavoriy/tikto-tasks
ghcr.io/flavoriy/tikto-calendar
ghcr.io/flavoriy/tikto-dashboard
```

## Kubernetes

Deploy each unit as its own Deployment and ClusterIP Service. Expose `tikto-web` and `tikto-gateway`.

Example internal URLs for the web pod:

```env
TIKTO_GATEWAY_API_URL=http://tikto-gateway:4000
TIKTO_PROFILE_API_URL=http://tikto-profile:4100
TIKTO_TASKS_API_URL=http://tikto-tasks:4200
TIKTO_CALENDAR_API_URL=http://tikto-calendar:4300
TIKTO_DASHBOARD_API_URL=http://tikto-dashboard:4400
```

Use ConfigMaps for non-sensitive config such as service URLs and feature flags. Use Kubernetes Secrets, AWS Secrets Manager through External Secrets/CSI, or Vault Agent injection for sensitive values:

```text
DATABASE_URL
PROFILE_DATABASE_URL
TASKS_DATABASE_URL
CALENDAR_DATABASE_URL
TOKEN_ENCRYPTION_KEY
TIKTO_INTERNAL_API_KEY
SUPABASE_SERVICE_ROLE_KEY
```

Runtime env var changes require a pod restart or rollout.
Image tags are generated by the deployment workflow as environment-scoped run-number tags:

```text
ghcr.io/flavoriy/tikto:dev-42
ghcr.io/flavoriy/tikto:prod-43
```

The tag format is `<environment>-<github.run_number>`. This keeps each deployment tag unique, avoids the old static `v0.0.1` pattern, and makes the running image traceable back to the GitHub Actions run.

## Logs and Trace

Internal services write structured JSON logs to stdout:

- `service_listening` when a service starts.
- `http_request` for each non-health request, including `requestId`, method, path, status, duration, and error code.
Workflow entrypoints:

- `.github/workflows/pr-checks.yml` (runs CI checks on pull requests)
- `.github/workflows/deploy-dev.yml` (runs CI and deploys to Dev on push to `dev` branch)
- `.github/workflows/deploy-prod.yml` (runs CI and deploys to Prod on push to `main` branch)

Healthcheck request logs are hidden by default. Enable them while debugging:

```bash
LOG_HEALTHCHECKS=true npm run service:gateway:start
```
| Workflow | Responsibility |
|---|---|
| `.github/workflows/ci.yaml` | ESLint analysis, TypeScript validation, production build, unit tests with coverage, and SonarCloud analysis |
| `.github/workflows/cd.yaml` | Docker build, HIGH/CRITICAL Trivy scan, GHCR push, GitOps manifest update, and Argo CD verification |

The web BFF propagates `x-request-id` to internal services. If the incoming request does not have one, the web app generates it.

## CI/CD and GitOps

GitHub Actions runs CI and security checks before deploying. The deployment workflow behaves as follows:
1. **Build Base Image**: It first builds and pushes the common dependencies base image `ghcr.io/flavoriy/tikto-base:${IMAGE_TAG}` to GitHub Container Registry (using GHA layer cache to complete in seconds if dependencies have not changed).
2. **Build Microservices (Parallel Matrix)**: It launches parallel matrix jobs to build, scan (via Trivy), and push the microservice images (`web`, `gateway`, `profile`, `tasks`, `calendar`, `dashboard`), passing the built base image via `--build-arg BASE_IMAGE`. Only services with detected changes (calculated via `dorny/paths-filter`) are built and pushed.

Production approval is handled by the GitHub Environment named `prod`. Configure required reviewers in GitHub:
| Event | Behavior |
|---|---|
| Pull request to `dev` or `main` | Runs CI only; no deployment from pull requests |
| Push or merge to `dev` | Runs CI and deploys to the development environment |
| Push or merge to `main` | Runs CI and deploys through the protected `prod` GitHub Environment |
| Manual dispatch | Runs the same workflow manually |

## Delivery Workflow

1. GitHub Actions validates linting, types, tests, coverage, and production build.
2. SonarCloud runs quality analysis when configured for the event.
3. The deployment job assumes an AWS role through GitHub Actions OIDC.
4. Shared and environment-specific values are loaded from AWS Secrets Manager.
5. Docker builds the application image with environment-specific public build arguments.
6. Trivy scans the image and fails on HIGH or CRITICAL vulnerabilities.
7. The approved image is pushed to GHCR.
8. The matching GitOps image patch is updated:

```text
Settings -> Environments -> prod -> Required reviewers
```

GitOps manifests are stored outside this app repo in:
9. Argo CD sync and image verification run when Argo CD access is configured.

## CI/CD Configuration

GitHub repository secret:

| Secret | Purpose |
|---|---|
| `AWS_ROLE_TO_ASSUME` | IAM role ARN that GitHub Actions can assume with OIDC |

```text
https://github.com/Flavoriy/gitops-manifest.git
```

The expected manifest patch path is:

```text
apps/tikto/overlays/<env>/patch-image.yaml
```

That patch file contains image lines for all image repositories. The deploy workflow fails if any expected image repository is missing, which prevents a partial production update.

The IAM role needs `secretsmanager:GetSecretValue` access for those secret IDs.
