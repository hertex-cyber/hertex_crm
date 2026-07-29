# ADR-002: Application Topology — Modular Monolith

- **Status:** Accepted
- **Date:** 2025-07-27
- **Authors:** Chief Architect, DevOps Lead

## Context

TZAHU CRM must balance development velocity with long-term scalability. Early microservices introduce orchestration complexity, network latency, distributed transactions, and operational overhead that slow down feature delivery. However, the architecture must not preclude future extraction into services.

## Options Considered

### 1. Modular Monolith (Selected)
- **Pros:** Single deployable unit (low ops cost), bounded contexts enforced via Python packages, shared database with schema isolation, easy refactoring, fast development, simple CI/CD, straightforward debugging, enables DDD with aggregate boundaries. Modules communicate via Python function calls (synchronous) or RabbitMQ events (asynchronous). Future extraction of hot modules is possible.
- **Cons:** Single deployment means correlated failures, scaling requires vertical scaling or running multiple instances, Cannot scale individual modules independently without extraction, deployment requires whole-application restart.

### 2. Microservices
- **Pros:** Independent scaling, independent deployment, technology heterogeneity, fault isolation, team autonomy.
- **Cons:** Distributed system complexity (network latency, partial failure, eventual consistency), requires API gateway, service mesh, distributed tracing, saga patterns for transactions, significant DevOps overhead, slower feature development initially, over-engineering for early-stage product.

### 3. Serverless (Lambda + API Gateway)
- **Pros:** No server management, auto-scaling, pay-per-use.
- **Cons:** Cold starts, 15-minute timeout, statelessness complicates Django patterns, database connection pooling issues, vendor lock-in,不适合 long-running background tasks, complex local development, significantly higher cost at scale.

## Decision

**Adopt a Modular Monolith** with strict bounded contexts enforced by Python package boundaries and `import-linter`.

Each module (Identity, Lead, Opportunity, Workflow, AI, Integration) is a Django app within the same project. Modules communicate via:
- **Synchronous:** Internal Python API (service layer → service layer) for queries and commands within a request lifecycle
- **Asynchronous:** Domain events published to RabbitMQ (via outbox pattern) for cross-module coordination

The monolith deploys as a single Docker image with multiple processes (Gunicorn for HTTP, Celery worker for tasks, FastAPI sidecar for AI).

## Consequences

- **Positive:** Fastest development velocity, simple deployment, single codebase, easy debugging, monorepo simplifies dependency management.
- **Positive:** Bounded contexts are explicit in code, enabling future extraction to microservices without rewrite.
- **Negative:** Requires import-linter discipline; modules CAN import from Shared Kernel but NOT from other modules' internals.
- **Negative:** Scaling is all-or-nothing until extraction; mitigate by running multiple instances behind load balancer.
- **Migration Path:** When a module needs independent scaling (e.g., Workflow Engine), extract it as a separate service behind a RabbitMQ facade. The monolith boundary makes this a surgical extraction, not a full rewrite.

## Compliance

- `import-linter` enforces: `shared_kernel` can be imported by all modules; modules CANNOT import from other modules' `domain` or `infrastructure` layers.
- CI checks: `lint-imports` job fails on cross-module violations.
- `tox.ini` / `pyproject.toml` defines package boundaries.
- Module interfaces (public API) are defined in each module's `__init__.py`.
- New Django apps must be approved by architecture review.
