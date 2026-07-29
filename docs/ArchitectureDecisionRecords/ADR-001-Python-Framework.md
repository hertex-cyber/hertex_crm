# ADR-001: Python Web Framework

- **Status:** Accepted
- **Date:** 2025-07-27
- **Authors:** Chief Architect, Tech Lead

## Context

TZAHU CRM requires a web framework that supports rapid development of a multi-tenant, AI-first enterprise platform. The framework must provide mature ORM, admin interfaces, authentication, background task integration, and a large ecosystem. The team has expertise in Python and TypeScript.

## Options Considered

### 1. Django 5.x (Selected)
- **Pros:** Mature ORM with migrations, Django Admin for internal tooling, DRF for REST, massive ecosystem (Celery, Redis, etc.), ORM supports PostgreSQL features (pgvector, pg_trgm), built-in auth, middleware, signals, management commands, excellent documentation, largest Python web community, Django REST Framework is battle-tested.
- **Cons:** Monolithic by default (requires discipline for modularity), async support is newer (less mature than FastAPI), heavier than microframeworks, template layer is unnecessary if using React SPA.

### 2. FastAPI-only
- **Pros:** Native async, automatic OpenAPI docs, Pydantic validation, high performance, modern Python features.
- **Cons:** No ORM (requires SQLAlchemy/Alembic), no admin panel, no built-in auth, no management commands, smaller ecosystem for enterprise plugins, less mature for complex business logic, requires more boilerplate for enterprise features (admin, migrations, management commands).

### 3. NestJS (Node.js)
- **Pros:** Clean architecture, TypeScript-first, decorators, Dependency Injection built-in, modular by design.
- **Cons:** Different language (TS vs Python), smaller enterprise CRM ecosystem, ORM (TypeORM/Prisma) less mature than Django ORM, team Python expertise not leveraged, operational complexity of Node.js in enterprise context.

### 4. ASP.NET Core
- **Pros:** Excellent performance, strong typing, mature ecosystem, built-in DI, great tooling.
- **Cons:** C# language barrier, team lacks .NET expertise, smaller open-source community for CRM-specific packages, Linux deployment less documented, higher ramp-up cost.

## Decision

**Use Django 5.x as the primary web framework**, with DRF for REST APIs and a FastAPI sidecar for AI workloads (see ADR-007).

Django provides the fastest path to a production-ready enterprise CRM with its mature ORM, migrations, admin, auth, and ecosystem. The modular monolith architecture (ADR-002) enforces bounded contexts through Python packages, not framework features.

## Consequences

- **Positive:** Rapid development, mature ORM with PostgreSQL features, built-in admin for internal ops, strong migration system, large talent pool.
- **Negative:** Must enforce modular boundaries via import-linter and package structure (not relying on Django's monolithic nature). Async support in Django is newer; use sync views for CRUD, async only for AI/real-time endpoints (handled by FastAPI sidecar).
- **Migration:** If Django becomes a bottleneck for specific high-throughput sync paths, those can be extracted to FastAPI services later.

## Compliance

- Enforce Django version via `pyproject.toml`: `django = "~5.1.0"`
- Use `import-linter` to enforce bounded context boundaries
- CI checks: `django-admin check --deploy --fail-level WARNING`
- Regular security updates via `pip-audit` in CI
- DO NOT use Django templates; use DRF for API-only backend
