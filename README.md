# 📱 TikTo Application Monorepo

TikTo is a task and calendar planning application structured as a monorepo containing a public web frontend/BFF and five internal microservices.

## 🏗️ Architecture & Service Layout

* **`apps/web`**: Next.js 16 (App Router) user interface and Backend-for-Frontend (BFF) proxy.
* **`services/gateway`**: Express-based API Gateway. Handles rate-limiting, internal route proxying, and health aggregation.
* **`services/profile`**: Profile domain service (Prisma + Supabase Postgres).
* **`services/tasks`**: Task management service (Prisma + Supabase Postgres).
* **`services/calendar`**: Calendar event service (Prisma + Supabase Postgres).
* **`services/dashboard`**: Composition service that aggregates data from profile, tasks, and calendar.

---

## 🔄 CI/CD Workflow

```mermaid
flowchart TD
    Developer[Developer] -->|Pull Request| PR[PR Validation Pipeline]
    PR -->|Runs| Lint[ESLint / Typecheck]
    PR -->|Runs| Test[Vitest / Coverage]
    PR -->|Scans| Sonar[SonarCloud Quality Gate]
    
    Developer -->|Merge / Git Tag| Tag[Release Pipeline]
    Tag -->|Authenticates| OIDC[AWS OIDC Credentials]
    Tag -->|Loads| Secrets[Secrets Manager Variables]
    Tag -->|Builds| Docker[Docker Build]
    Tag -->|Scans| Trivy[Trivy Vulnerability Scan]
    Tag -->|Pushes| GHCR[Publish to GHCR]
    GHCR -->|Promotes| GitOps[Update gitops-manifest patch-image.yaml]
```

### 1. Pull Request Validation
Every pull request triggers:
* **Linting & Typechecking**: `npm run lint` & `npm run typecheck`
* **Unit Testing**: Vitest testing with coverage reports
* **Code Quality**: SonarCloud Quality Gate analysis

### 2. Container Delivery & Security
On a merge or new tag (e.g. `v2.0.15`):
* GHA builds Docker images using a optimized **Base Dockerfile** pattern to save build time.
* **Trivy Scanner** checks for HIGH and CRITICAL vulnerabilities in the built images.
* Images are published to GitHub Container Registry (GHCR) with environment-specific tags.

### 3. GitOps Automation
Once the image is pushed, the CD pipeline automatically commits the new image tag to the `gitops-manifest` repository, triggering Argo CD deployment.

---

## 🛠️ Useful Commands

### Local Development
1. **Install dependencies**:
   ```bash
   npm install
   ```
2. **Build internal microservices & generate Prisma client**:
   ```bash
   npm run services:build
   ```
3. **Run local dev server**:
   * Next.js Web: `npm run dev`
   * API Gateway: `npm run service:gateway:start`
   * Profile Service: `npm run service:profile:start`
   * Tasks Service: `npm run service:tasks:start`
   * Calendar Service: `npm run service:calendar:start`
   * Dashboard Service: `npm run service:dashboard:start`

### Running with Docker Compose
To run all services locally in containers:
```bash
docker-compose up --build
```

---

## 🔍 Troubleshooting & Fixes

### ❌ Connection Refused on Internal Gateway Calls
* **Issue**: Pods attempting to call the API Gateway via `http://tikto-gateway:4000` fail with `Connection Refused` during active rollouts.
* **Cause**: Argo Rollouts dynamically updates the selector for the main `tikto-gateway` service to shift traffic. Without an Istio sidecar inside a pod, it cannot resolve the shifting backend endpoint.
* **Solution**: Change the target address to the dedicated stable gateway endpoint:
  ```env
  TIKTO_GATEWAY_API_URL=http://tikto-gateway-stable:4000
  ```
