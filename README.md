# TikTo

TikTo is a workspace monorepo split into one public web/BFF app and four internal services.

```text
Browser
  -> apps/web             # Next.js UI and BFF proxy routes
     -> services/profile  # profile domain and persistence
     -> services/tasks    # task domain and persistence
     -> services/calendar # calendar/event domain and persistence
     -> services/dashboard # dashboard composition over internal HTTP APIs
```

Only `apps/web` should receive public traffic. The services are intended to run behind Docker Compose or Kubernetes networking.

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

Create a root `.env` or `.env.local` from `.env.example`. Keep env files out of git.

Minimum local values:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000

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

Build all internal services:

```bash
npm run services:build
```

Run each process in a separate terminal:

```bash
npm run service:profile:start
npm run service:tasks:start
npm run service:calendar:start
npm run service:dashboard:start
npm run dev
```

Health checks:

```text
http://localhost:3000/api/health
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
| `npm run services:build` | Generate service Prisma clients and compile all services |
| `npm run service:profile:start` | Start the compiled profile service |
| `npm run service:tasks:start` | Start the compiled tasks service |
| `npm run service:calendar:start` | Start the compiled calendar service |
| `npm run service:dashboard:start` | Start the compiled dashboard service |
| `npm run typecheck` | Typecheck web, packages, and services |
| `npm run test:run` | Run Vitest tests |
| `npm run lint` | Run ESLint |

The old `api:*` aliases were removed so there is no longer a misleading shared API service entrypoint.

## Containers

Each deployable unit owns its Dockerfile:

```bash
docker compose build tikto-web
docker compose build tikto-profile
docker compose build tikto-tasks
docker compose build tikto-calendar
docker compose build tikto-dashboard
```

Run everything locally:

```bash
docker compose up --build
```

The image model is one image per deployable unit:

```text
ghcr.io/flavoriy/tikto-web
ghcr.io/flavoriy/tikto-profile
ghcr.io/flavoriy/tikto-tasks
ghcr.io/flavoriy/tikto-calendar
ghcr.io/flavoriy/tikto-dashboard
```

## Kubernetes

Deploy each unit as its own Deployment and ClusterIP Service. Expose only `tikto-web`.

Example internal URLs for the web pod:

```env
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

## Logs and Trace

Internal services write structured JSON logs to stdout:

- `service_listening` when a service starts.
- `http_request` for each non-health request, including `requestId`, method, path, status, duration, and error code.

Healthcheck request logs are hidden by default. Enable them while debugging:

```bash
LOG_HEALTHCHECKS=true npm run service:profile:start
```

The web BFF propagates `x-request-id` to internal services. If the incoming request does not have one, the web app generates it.

## CI/CD and GitOps

GitHub Actions runs CI before deploy. The deploy workflow then builds, scans, and pushes all five images.

Production approval is handled by the GitHub Environment named `prod`. Configure required reviewers in GitHub:

```text
Settings -> Environments -> prod -> Required reviewers
```

GitOps manifests are stored outside this app repo in:

```text
https://github.com/Flavoriy/gitops-manifest.git
```

The expected manifest patch path is:

```text
apps/tikto/overlays/<env>/patch-image.yaml
```

That patch file must contain image lines for all five image repositories. The deploy workflow fails if any expected image repository is missing, which prevents a partial production update.
