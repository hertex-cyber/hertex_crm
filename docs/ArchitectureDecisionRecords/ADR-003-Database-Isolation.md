# ADR-003: Database Isolation Strategy — Shared Schema + PostgreSQL RLS

- **Status:** Accepted
- **Date:** 2025-07-27
- **Authors:** Chief Architect, Database Lead

## Context

TZAHU CRM is a multi-tenant platform. Each tenant must be isolated for data privacy and compliance (GDPR, SOC 2, HIPAA considerations). The isolation strategy affects schema migrations, connection management, backup/restore, and query performance.

## Options Considered

### 1. Shared Schema + PostgreSQL Row-Level Security (Selected)
- **Pros:** Single database, single pool of connections, schema migrations applied once, shared connection pool efficiency, RLS provides row-level isolation at database level, RLS policies are transparent to application code (Django querysets automatically filtered), easy cross-tenant analytics (with RLS bypass for superusers), lower operational cost.
- **Cons:** RLS performance overhead (small for indexed tenant_id columns), risk of RLS misconfiguration exposing data, all tenants share database resources (noisy neighbor potential), tenant data cannot be physically separated without migration.

### 2. Schema-per-Tenant
- **Pros:** Logical separation via PostgreSQL schemas, each tenant has own tables, easy to backup/restore per tenant, clean separation.
- **Cons:** Connection pooling is complex (need per-schema pool or search_path switching), migrations must run N times (N tenants), Django multi-db routing complexity, operational overhead at scale (1000+ schemas), cross-tenant analytics require UNION ALL across schemas.

### 3. Database-per-Tenant
- **Pros:** Strongest isolation, independent backup/restore, per-tenant performance tuning, can be moved to separate servers.
- **Cons:** Maximum operational complexity, connection pool explosion (N databases × pool size), migrations must run N times, expensive at scale (1000+ databases), cross-tenant reporting nearly impossible, disaster recovery complexity.

## Decision

**Use Shared Schema with PostgreSQL Row-Level Security** for the primary isolation strategy.

- Every table has a `tenant_id` column (UUID v7, NOT NULL, indexed).
- RLS is enabled on every tenant-scoped table.
- RLS policy: `tenant_id = current_setting('app.current_tenant_id')::uuid`
- Django middleware sets `app.current_tenant_id` at request start.
- Superusers/admins can bypass RLS via `app.bypass_rls` setting.
- Provide a **Silo Escape Hatch**: For tenants requiring physical data separation (enterprise contracts, regulatory), a signal-based mechanism can move their data to a dedicated database instance with a tenant-specific connection string. This is a configuration toggle, not a code fork.

## Consequences

- **Positive:** Simple operations (single database), shared pool, migrations run once, built-in row-level security.
- **Positive:** RLS is defense-in-depth; application-level tenant filtering remains the primary mechanism.
- **Negative:** Must always include `tenant_id` in queries (indexed); RLS is a safety net, not the primary filter.
- **Negative:** RLS has minor per-query overhead (verified <5% for typical CRM queries).
- **Negative:** Default privileges and RLS must be correctly configured in every migration.
- **Silo Escape Hatch:** Documented in `infrastructure/tenant/silo.py`; uses Django database router to switch connection per-tenant.

## Compliance

- All migration files must include `CREATE POLICY` for RLS.
- CI runs RLS audit script: `python manage.py audit_rls` verifies every tenant-scoped table has RLS enabled.
- SQL linter (sqlfluff) checks for missing `tenant_id` columns.
- PR review checklist: "Is this table tenant-scoped? Does it have RLS?"
