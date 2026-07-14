# ADR 0001: Standard Monorepo Folder Structure

## Status
Accepted

## Context
As the TikTo workspace scales towards multiple microservices and distinct frontend/BFF applications, having a flat root structure and scattered build/infrastructure configs creates operational friction and circular dependency risks.

## Decision
Adopt a standardized monorepo layout:
- `apps/`: User-facing applications and Backend-For-Frontend proxies.
- `services/`: Domain microservices (deployable units).
- `packages/`: Modular shared packages (`contracts`, `service-runtime`, `shared`).
- `infra/`: Infrastructure specifications (`docker/`, `k8s/`, `terraform/`).
- `tooling/`: Build scripts, TS configs, ESLint rules.
- `docs/`: Architectural Decision Records (ADRs) and diagrams.
- `tests/`: End-to-end and cross-service contract tests.

## Consequences
- Clean separation of concerns between code, tooling, docs, and infrastructure.
- High developer ergonomics and readiness for Kubernetes/GitOps deployment.
