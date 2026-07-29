# TZAHU CRM — Implementation Plan

> **Version:** 0.1.0-draft
> **Last Updated:** 2026-07-27
> **Status:** Foundational Design Phase
> **Owner:** Platform Architecture Team

---

## Table of Contents

1. [Overview & Guiding Principles](#1-overview--guiding-principles)
2. [Phase 0 — Foundation & Infrastructure](#2-phase-0--foundation--infrastructure)
3. [Phase 1 — Core Framework & Shared Kernel](#3-phase-1--core-framework--shared-kernel)
4. [Phase 2 — Multi-Tenancy & Security Infrastructure](#4-phase-2--multi-tenancy--security-infrastructure)
5. [Phase 3 — Lead, Contact & Account Management](#5-phase-3--lead-contact--account-management)
6. [Phase 4 — Pipeline, Opportunity, Activities & Tasks](#6-phase-4--pipeline-opportunity-activities--tasks)
7. [Phase 5 — Workflow & Automation Engine](#7-phase-5--workflow--automation-engine)
8. [Phase 6 — Notification Engine](#8-phase-6--notification-engine)
9. [Phase 7 — Reports, Dashboards & Analytics](#9-phase-7--reports-dashboards--analytics)
10. [Phase 8 — AI Platform](#10-phase-8--ai-platform)
11. [Phase 9 — Voice AI](#11-phase-9--voice-ai)
12. [Phase 10 — Integration Hub](#12-phase-10--integration-hub)
13. [Phase 11 — Enterprise & Scale](#13-phase-11--enterprise--scale)
14. [Phase Interdependency Graph](#14-phase-interdependency-graph)
15. [Risk Register](#15-risk-register)

---

## 1. Overview & Guiding Principles

### Purpose

This document defines the phased engineering roadmap for TZAHU CRM. Each phase builds on the previous one, with clear deliverables, acceptance criteria, dependencies, and risks. The plan is designed for a 5-person engineering team building for 1,000+ organizations and 100,000+ users within 24 months.

### Strategic Principles

1. **Foundations before features.** The first three phases contain zero customer-facing features. They build the architecture that makes features safe to add quickly later. Skipping this is the #1 cause of rewrites.

2. **Tenant isolation from day one.** Every phase from Phase 1 includes tenant-scoped design and tests. Retrofitting multi-tenancy is a multi-month disaster; building it in from the first migration costs a few extra lines per table.

3. **Test infrastructure as a deliverable.** Every phase's acceptance criteria includes a defined test suite (unit, integration, contract, security). "Working" means passing tests, not running code.

4. **Observability is non-negotiable.** Every phase delivers structured logging, metrics, and basic dashboards for the feature being built. No feature ships without monitoring.

5. **Security is layered, not bolted on.** Authentication in Phase 1, authorization (RBAC) in Phase 2, tenant isolation (RLS) in Phase 2, audit in every phase. Each layer is independently testable.

6. **Parallelize where possible.** Phases 4, 5, and 6 can partially overlap because they depend on Phase 3's entities but not on each other's implementation details (they communicate via events).

### Team Allocation Model

| Phase | Focus | Recommended Team Split |
|-------|-------|----------------------|
| 0–2 | Infrastructure & Core | Full team (5 engineers) |
| 3–4 | Business Entities | 3 domain engineers + 2 platform |
| 5–7 | Automation & Analytics | 3 domain + 2 platform |
| 8–9 | AI & Voice | 2 AI + 2 platform + 1 domain |
| 10–11 | Scale & Enterprise | Full team |

---

## 2. Phase 0 — Foundation & Infrastructure

**Duration:** 2–3 weeks
**Dependencies:** None (greenfield project)
**Risk Level:** Low

### Goals

Establish the development environment, tooling, CI/CD pipeline, and code quality enforcement before any application code is written. This is the scaffolding — every subsequent phase depends on it.

### Deliverables

| # | Deliverable | Description | Acceptance Criteria |
|---|-------------|-------------|---------------------|
| 0.1 | Django project scaffold | `tzahu_crm/backend/` with modular app structure, `config/` settings, ASGI/WSGI | `python manage.py runserver` starts; health endpoint returns 200 |
| 0.2 | Poetry + pyproject.toml | Dependency management with locked versions | `poetry install` succeeds; `poetry check` passes |
| 0.3 | Docker Compose | Django, PostgreSQL 16, Redis 7, RabbitMQ, Celery worker, MinIO, Pgbouncer | `docker compose up` starts all services; health checks pass |
| 0.4 | Code quality tooling | ruff, mypy (strict), import-linter, pre-commit hooks | `pre-commit run --all-files` passes with zero violations |
| 0.5 | CI/CD pipeline (GitHub Actions) | Lint → typecheck → test → build → deploy (initial to staging) | PR merge triggers pipeline; green build in < 10 min |
| 0.6 | Test framework | pytest, pytest-django, pytest-cov, factory-boy, pytest-benchmark | `pytest` discovers and runs all tests; coverage configured to 90% |
| 0.7 | OpenTelemetry stub | Instrumentation setup (logs, metrics, traces) with console exporter | Log output shows structured JSON; span appears in console trace |
| 0.8 | Environment configuration | `.env` template, settings base/dev/staging/prod split | `DJANGO_SETTINGS_MODULE` selects correct settings; secrets never committed |
| 0.9 | Makefile | Common commands: `make dev`, `make test`, `make lint`, `make migrate`, `make seed` | All commands execute without error |
| 0.10 | First deployment target | Staging environment (single Docker host or minimal K8s) | `curl staging.api.tzahu.com/health` returns 200 |

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Tooling version conflicts | Medium | Low | Lock all tool versions in pyproject.toml; use Docker for reproducible builds |
| CI pipeline slow | Medium | Medium | Parallelize job steps; cache pip/poetry deps |
| Team not familiar with Django's settings pattern | Low | Low | Document settings pattern in DEVELOPMENT_GUIDE.md |

### Dependencies to Next Phase

- Phase 1 needs: working Django project, test framework, import-linter config, Docker Compose with DB

---

## 3. Phase 1 — Core Framework & Shared Kernel

**Duration:** 3–4 weeks
**Dependencies:** Phase 0
**Risk Level:** Medium

### Goals

Build the shared kernel primitives (Value Objects, base classes, interfaces) and the foundation modules (Identity, Organization, RBAC). At the end of this phase, the system has user registration, authentication, organization creation, and role-based access control — with no business features.

### Deliverables

| # | Deliverable | Description | Acceptance Criteria |
|---|-------------|-------------|---------------------|
| 1.1 | Shared Kernel — Domain | `ValueObject`, `Entity`, `AggregateRoot`, `DomainEvent` base classes | Unit tests: equality, hashing, immutability, event collection |
| 1.2 | Shared Kernel — VOs | `Email`, `PhoneNumber`, `Address`, `PersonName`, `Money`, `Currency`, `Percentage`, `TimeZone` | Unit tests: validation, normalization, equality |
| 1.3 | Shared Kernel — Results | `Result[T, E]`, `PaginatedResult[T]`, Domain error hierarchy | Unit tests: success/failure chaining, pagination math |
| 1.4 | Shared Kernel — Ports | `Repository[T]` generic interface, `EventPublisher` port | Interface tests: contract adherence |
| 1.5 | Identity — Domain | User aggregate, events (UserRegistered, UserInvited, UserLoggedIn) | Domain tests: password hashing, email verification |
| 1.6 | Identity — Application | RegisterUser, LoginUser, InviteUser, RefreshToken commands | Integration tests: token creation, refresh cycle, password rotation |
| 1.7 | Identity — API | `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/me` | API tests: happy path, validation errors, rate limiting |
| 1.8 | Identity — JWT | Short-lived access token (15 min) + long-lived refresh token (7 days), device tracking | Security tests: expired tokens rejected, refresh rotation protects against theft |
| 1.9 | Organization — Domain | Organization aggregate, events (OrganizationCreated, OrganizationUpdated, OrganizationDeleted) | Domain tests: name validation, subscription tier, status lifecycle |
| 1.10 | Organization — API | `/orgs/` CRUD, `/orgs/{id}/members/` management | API tests: CRUD, member addition/removal, role assignment |
| 1.11 | RBAC — Domain | Role aggregate, Permission value object, RoleAssignment entity | Domain tests: role hierarchy resolution, permission checking |
| 1.12 | RBAC — API | `/roles/`, `/permissions/`, `/assignments/` | API tests: CRUD, permission-based access control |
| 1.13 | Base Django models | `UUIDModel`, `TimestampedModel`, `SoftDeleteModel`, `TenantScopedModel` mixins | Migration tests: table creation, indexes, constraints |
| 1.14 | import-linter rules | Full layer enforcement for all Phase 1 modules | CI fails if domain imports Django; fails if modules cross-import without permission |
| 1.15 | Logging & monitoring | OpenTelemetry instrumented for all endpoints, Celery tasks, DB queries | Grafana dashboard shows request rate, error rate, p50/p95/p99 latency |

### Acceptance Criteria (Phase 1 Gate)

- New user can register → email verification → login → receive JWT → access protected endpoints
- Organization can be created → invite user → user accepts → user has role → RBAC enforced
- import-linter fails if any module violates layer rules
- OpenAPI spec (drf-spectacular) is generated and valid for all public endpoints
- 90%+ test coverage on Shared Kernel, Identity, Organization, RBAC

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| RBAC design too complex (ACL vs. RBAC) | Medium | High | Start with flat RBAC (role → permissions map); add hierarchy in Phase 11 |
| JWT secret management in CI | Medium | Medium | Use GitHub Actions secrets; generate ephemeral keys for test runs |
| import-linter too restrictive early | Medium | Low | Exempt the current phase from strict full enforcement; tighten as more modules come online |

### Dependencies to Next Phase

- Phase 2 needs: Identity (users, orgs), RBAC, Shared Kernel, TenantScopedModel mixin

---

## 4. Phase 2 — Multi-Tenancy & Security Infrastructure

**Duration:** 2–3 weeks
**Dependencies:** Phase 1 (Identity, Organization, RBAC)
**Risk Level:** **Critical** — mistakes here are data leaks

### Goals

Implement the tenant isolation layer: PostgreSQL RLS policies, tenant resolution middleware, repository enforcement, Celery tenant propagation, and automated RLS testing. Every table created from this point forward is automatically tenant-scoped.

### Deliverables

| # | Deliverable | Description | Acceptance Criteria |
|---|-------------|-------------|---------------------|
| 2.1 | RLS Policy Engine | Migration utility that reads `TenantScopedModel` classes and creates RLS policies for their tables | `make generate_rls` produces valid SQL; policies exist for all tenant-scoped tables |
| 2.2 | Tenant Resolution Middleware | Middleware that extracts `organization_id` from JWT and sets `app.current_organization_id` in PostgreSQL session | Unauthenticated request returns 401; authenticated request sets session variable; missing tenant returns 403 |
| 2.3 | Tenant Repository Mixin | Repository base class that automatically scopes all queries by `organization_id` | Repository test: user from OrgA cannot read OrgB's data even if RLS is somehow bypassed |
| 2.4 | Celery Tenant Propagation | Task-local storage for tenant context; middleware for Celery tasks that restores `app.current_organization_id` | Background task processing event for OrgA cannot read/write OrgB data |
| 2.5 | Tenant Model | Organization plan, status (active/trial/suspended/disabled), feature flags, settings | Tenant lifecycle: provision → activate → suspend → reactivate → delete |
| 2.6 | Tenant Provisioning API | `/tenants/` — create, get, update, suspend, delete | Provisioned tenant gets RLS-policy-protected tables; suspended tenant returns 403 for all data access |
| 2.7 | Cross-Tenant Isolation Test Suite | Automated test factory: create 2 tenants → assert no data leakage across 50+ API endpoints | Zero false passes: every endpoint is tested for isolation |
| 2.8 | Silo Escape Hatch | Documented procedure + migration script for moving a tenant to a dedicated database | Migration maintains foreign key integrity; zero data loss; documented rollback |
| 2.9 | Audit-Only Table Exception | Mechanism for non-tenant-scoped system tables (audit log, metrics) | System tables have no RLS; explicit permission required to create new non-scoped tables |

### Acceptance Criteria (Phase 2 Gate)

- Two tenants with identical data structures cannot read each other's data via any API endpoint
- Test suite runs 10,000+ isolation assertions in < 60 seconds
- Celery task processing events for one tenant cannot access another tenant's data
- Provisioning a new tenant automatically applies RLS policies to all tables
- Suspending a tenant immediately blocks all data access

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| RLS disabled during local dev | High | Medium | Local dev sets `DISABLE_RLS=True` for speed; CI enforces RLS is ON |
| Migration creates table without RLS | Medium | **Critical** | Migration linter: every new table that inherits `TenantScopedModel` must have a companion RLS migration |
| Raw SQL in migration bypasses repository | Medium | **Critical** | All data migrations go through bulk repositories; raw SQL reviewed by two engineers |
| Tenant context lost in async path | Medium | High | Structured logging includes tenant_id; alerts fire if tenant_id is missing in production |

### Dependencies to Next Phase

- Phase 3 needs: RLS, tenant resolution, tenant-scoped repository base, Celery tenant propagation

---

## 5. Phase 3 — Lead, Contact & Account Management

**Duration:** 4–6 weeks
**Dependencies:** Phase 2 (Multi-tenancy), Phase 1 (Identity, Organization)
**Risk Level:** Medium

### Goals

Build the core CRM entities: Leads, Contacts, and Accounts. This is the data foundation — every subsequent business module (Pipeline, Opportunity, Activity) references these entities. At the end of this phase, users can import, create, manage, merge, deduplicate, and search leads/contacts/accounts with full tenant isolation.

### Deliverables

| # | Deliverable | Description | Acceptance Criteria |
|---|-------------|-------------|---------------------|
| 3.1 | Lead Domain | Lead aggregate: status lifecycle (New → Contacted → Qualified → Converted → Disqualified → Recycled), source tracking, scoring, owner assignment | Domain tests: status transitions, validation rules, scoring math |
| 3.2 | Lead API | `/leads/` CRUD, bulk create, status transitions, assignment, deduplication | API tests: CRUD, status flows, bulk import, dedup match/hide |
| 3.3 | Lead Scoring | Score based on: source, engagement, demographic fit, custom rules | Scoring tests: score calculation, recalculation on field update |
| 3.4 | Contact Domain | Contact aggregate: email, phone, address associations, communication preferences, GDPR consent tracking | Domain tests: preference validation, consent lifecycle |
| 3.5 | Contact API | `/contacts/` CRUD, merge, GDPR compliance (export, forget) | API tests: CRUD, merge, GDPR export to JSON, GDPR delete anonymizes |
| 3.6 | Account Domain | Account aggregate: hierarchy (parent/child), industry type, size, territory | Domain tests: hierarchy validation, account team |
| 3.7 | Account API | `/accounts/` CRUD, hierarchy management, territory assignment | API tests: CRUD, hierarchy CRUD, team assignments |
| 3.8 | Lead → Contact → Account Conversion | Conversion workflow: lead → contact + account + opportunity creation | Integration tests: full conversion flow with all related entities created |
| 3.9 | Duplicate Detection Engine | Configurable rules (email, phone, name+company match), merge UI, conflict resolution | Duplicate tests: exact match, fuzzy match, merge preserves history |
| 3.10 | Search Index (Lead/Contact/Account) | PostgreSQL full-text search with weighted fields (title > description > notes) | Search tests: relevance ranking, tenant-scoped results, pagination |
| 3.11 | Lead Import (CSV, Excel) | Import pipeline: parse → validate → map → dedup → create → report | Import tests: 10k rows, malformed data, partial success, error report generation |

### Acceptance Criteria (Phase 3 Gate)

- Full lead lifecycle: create → qualify → convert → creates contact + account + opportunity
- Duplicate detection prevents double entry within a tenant
- Import 10,000 leads in < 30 seconds; errors generate downloadable report
- Search across leads, contacts, accounts returns tenant-scoped, relevance-ranked results
- All APIs have OpenAPI docs; all endpoints have isolation tests

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Lead conversion logic becomes complex | High | Medium | Model conversion as a state machine with clear transitions; test every path |
| CSV import performance on large files | Medium | Medium | Stream parsing; batch DB inserts; async processing with Celery for >5k rows |
| Dedup fuzzy matching quality | Medium | High | Use `pg_trgm` for trigram similarity; allow per-tenant threshold config |

### Dependencies to Next Phase

- Phase 4 needs: Lead, Contact, Account domain models and APIs

---

## 6. Phase 4 — Pipeline, Opportunity, Activities & Tasks

**Duration:** 4–6 weeks
**Dependencies:** Phase 3 (Lead, Contact, Account)
**Risk Level:** Medium

### Goals

Implement the sales pipeline engine: configurable stages, opportunities with amounts/probability, activity logging (calls, emails, meetings), and task management. This is the revenue-tracking core of the CRM.

### Deliverables

| # | Deliverable | Description | Acceptance Criteria |
|---|-------------|-------------|---------------------|
| 4.1 | Pipeline Domain | Pipeline aggregate: stages with order, probability, rules (e.g., cannot skip stage) | Domain tests: stage ordering, transition validation, probability normalization |
| 4.2 | Pipeline API | `/pipelines/` CRUD, default pipeline per org, stage management | API tests: CRUD, default assignment, stage reordering |
| 4.3 | Opportunity Domain | Opportunity aggregate: amount, currency, stage, close date, product, competitor, win/loss reason | Domain tests: amount rules, probability-weighted forecast, stage transition with timestamp |
| 4.4 | Opportunity API | `/opportunities/` CRUD, stage transitions, forecast rollup, team selling | API tests: CRUD, forecast by pipeline, by owner, by territory |
| 4.5 | Activity Domain | Activity aggregate (polymorphic): Call, Email, Meeting, Note. Duration, outcome, follow-up | Domain tests: type validation, duration constraints, outcome enum |
| 4.6 | Activity API | `/activities/` CRUD, log call/email/meeting, activity timeline for lead/contact/opportunity | API tests: CRUD, timeline view, polymorphic serialization |
| 4.7 | Task Domain | Task aggregate: assignee, due date, priority, status, related entity (polymorphic) | Domain tests: assignment rules, overdue detection, priority sorting |
| 4.8 | Task API | `/tasks/` CRUD, assignment, status updates, dashboard query (mine, overdue, today) | API tests: CRUD, assignment, filtering, dashboard queries |
| 4.9 | Calendar Sync (Read) | Google Calendar, Outlook Calendar read integration; meeting creation from CRM | Integration tests: OAuth flow, event sync, conflict detection |
| 4.10 | Email Sync (Read) | IMAP integration: read inbound emails, link to contacts/leads/opportunities | Integration tests: IMAP connection, email threading, entity linking |

### Acceptance Criteria (Phase 4 Gate)

- Create pipeline with stages → create opportunity → move through stages → update forecast → win/loss
- Log call/email against any entity → see entity timeline → filter by activity type
- Create task → assign → update → complete → dashboard shows overdue tasks
- Calendar and email sync work for test accounts
- All entities emit domain events for Workflow Engine (Phase 5)

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Activity polymorphism leads to complex DB schema | Medium | Medium | Use generic foreign key (ContentType) with caution; prefer separate activity type tables with union views |
| Calendar/email sync security (OAuth tokens) | High | High | Token encryption at rest; short-lived scopes; token refresh monitoring |
| Forecast accuracy depends on data quality | Medium | Low | Document forecast as "expected value" (probability × amount); don't promise precision |

### Dependencies to Next Phase

- Phase 5 needs: domain events from all Phase 3–4 entities
- Phase 6 needs: domain events for notification triggers
- Phase 7 needs: Phase 3–4 data for reports

---

## 7. Phase 5 — Workflow & Automation Engine

**Duration:** 6–8 weeks
**Dependencies:** Phase 3, Phase 4 (domain events)
**Risk Level:** **High** — most complex technical deliverable

### Goals

Build the workflow automation engine — the heart of the CRM's programmability. Users define triggers (lead created, opportunity won), conditions (lead source = "Website", amount > $10k), and actions (assign, notify, update field, trigger webhook). This is what differentiates TZAHU from a simple database UI.

### Deliverables

| # | Deliverable | Description | Acceptance Criteria |
|---|-------------|-------------|---------------------|
| 5.1 | Workflow Model | Workflow definition: name, event trigger, conditions (AND/OR tree), ordered actions | Domain tests: condition evaluation, action execution order, AND/OR logic |
| 5.2 | Condition Engine | Evaluate conditions against entity state: field comparison, date math, set membership, sub-queries | Condition tests: every operator (eq, neq, gt, lt, contains, in, between, is_set), nested AND/OR |
| 5.3 | Action Engine | Execute actions: update field, assign owner, trigger webhook, create task, send notification, call API | Action tests: idempotency, rollback on failure, execution order, timeout handling |
| 5.4 | Workflow Execution Service | Match incoming event → evaluate conditions → execute actions (within Celery task) | Integration tests: event triggers matching workflow; conditions filter correctly; actions execute |
| 5.5 | Loop Prevention | Execution depth limit (max 10 nested workflows), cycle detection, recursion guard | Safety tests: infinite loop scenario terminates; max depth exceeded returns error |
| 5.6 | Workflow Scheduler | Cron/time-based workflows (e.g., "every Monday at 9am, email stale leads") | Schedule tests: cron expression parsing, timezone handling, daylight saving |
| 5.7 | Workflow API | `/workflows/` CRUD, enable/disable, execution history, test-run | API tests: CRUD, test-run shows simulation result without side effects |
| 5.8 | Workflow Audit | Every workflow execution is logged: trigger event, conditions evaluated, actions executed, success/failure | Audit tests: execution log completeness, failure tracking, performance metrics |
| 5.9 | Template Library | Pre-built workflow templates: "Auto-assign Web leads", "Warm stale deals", "Follow-up after demo" | Template tests: import creates valid workflow; template update migrates existing |

### Acceptance Criteria (Phase 5 Gate)

- Create workflow: "When Lead created AND source = Website → assign to round-robin queue → send Slack notification"
- Workflow executes within 5 seconds of event publication
- Loop detection catches and prevents infinite recursion
- Scheduled workflows fire at correct time across time zones
- Test-run mode evaluates conditions without executing actions
- 10,000 workflow executions per hour with < 1% failure rate

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Workflow execution performance at scale | High | High | Async execution via Celery; workflow execution timeout (30s max); parallel action execution where possible |
| Condition evaluation on large datasets | Medium | Medium | Sub-query conditions evaluated in-DB via WHERE clause, not in-memory |
| Users create conflicting workflows | Medium | High | Workflow validation prevents update-triggers-update cycles; execution order by priority |
| Debugging workflow failures | High | High | Execution trace UI; step-by-step replay; failure notifications to workflow creator |

### Dependencies to Next Phase

- Phase 6 needs: Workflow Action → Send Notification
- Phase 7 needs: Workflow execution metrics for reporting

---

## 8. Phase 6 — Notification Engine

**Duration:** 3–4 weeks
**Dependencies:** Phase 5 (Workflow Engine actions), Phase 1 (Identity)
**Risk Level:** Medium

### Goals

Build the multi-channel notification system: in-app, email, SMS, push, and Slack/Teams. The notification engine is driven by the Workflow Engine — notifications are an action type that workflows can invoke.

### Deliverables

| # | Deliverable | Description | Acceptance Criteria |
|---|-------------|-------------|---------------------|
| 6.1 | Notification Channel Abstraction | Channel interface: deliver(recipient, template, context) → Result | Channel tests: interface contract adherence for each channel |
| 6.2 | Email Channel | SMTP/transactional email (SendGrid or AWS SES), template rendering, bounce handling | Email tests: deliverability, template rendering, bounce classification |
| 6.3 | SMS Channel | Twilio integration, short code/long code, opt-out handling | SMS tests: deliverability, opt-out list respected |
| 6.4 | In-App Notification Channel | WebSocket push via Django Channels + Redis; notification center UI | In-app tests: real-time delivery, read/unread, notification list |
| 6.5 | Push Notification Channel | Firebase Cloud Messaging (FCM) for mobile push | Push tests: device token management, delivery receipt |
| 6.6 | Slack/Teams Channel | Webhook integration, message formatting, interactive buttons | Integration tests: webhook delivery, message formatting |
| 6.7 | Notification Preferences | Per-user, per-channel opt-in/opt-out, quiet hours, digest frequency | Preference tests: channel preference enforced; quiet hours suppress delivery |
| 6.8 | Notification Templates | Template engine (Jinja2): per-channel templates, variables, conditional blocks | Template tests: variable substitution, conditional rendering, missing variable handling |
| 6.9 | Notification API | `/notifications/` list, mark-read, preferences, template management | API tests: CRUD, preferences enforced, pagination |
| 6.10 | Rate Limiting & Quotas | Per-user, per-tenant, per-channel rate limits; daily quotas | Rate limit tests: throttling enforced, quotas reset daily, admin override |

### Acceptance Criteria (Phase 6 Gate)

- Workflow triggers "send email" action → email delivered via SendGrid within 10 seconds
- User can opt out of SMS → SMS not sent even if workflow triggers it
- In-app notification appears in real-time via WebSocket
- Email template renders correctly with context variables
- Rate limit exceeded → notification queued, not dropped
- Notification delivery failure (SMTP down) → retry 3 times → dead-letter → alert

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Email deliverability (spam, blacklisting) | Medium | High | SPF/DKIM/DMARC setup; dedicated sending IPs; warm-up process for new domains |
| SMS costs at scale | Low | Medium | Per-message cost tracking; daily quota alerts; hybrid SMS/email fallback |
| WebSocket scaling with multiple Django workers | Medium | High | Use Redis as channel layer; consider separate WebSocket service at scale |

### Dependencies to Next Phase

- Phase 7 needs: notification delivery metrics for dashboards

---

## 9. Phase 7 — Reports, Dashboards & Analytics

**Duration:** 4–6 weeks
**Dependencies:** Phases 3, 4 (data sources), Phase 5 (workflow metrics), Phase 6 (notification metrics)
**Risk Level:** Medium

### Goals

Build the reporting and analytics platform: configurable report builder, pre-built dashboards, pipeline analytics, sales forecasting, and activity metrics.

### Deliverables

| # | Deliverable | Description | Acceptance Criteria |
|---|-------------|-------------|---------------------|
| 7.1 | Report Builder Engine | Ad-hoc report definition: dimensions, measures, filters, sorting, grouping | Report tests: aggregation accuracy, filter correctness, group-by correctness |
| 7.2 | Report Data Source Abstraction | Register reportable models with field metadata; support for aggregate queries | Source tests: field discovery, type mapping, aggregate SQL generation |
| 7.3 | Report API | `/reports/` CRUD, execute (sync + async), export (CSV, PDF, XLSX), schedule | API tests: CRUD, execution with 1M rows in < 30s, export format correctness |
| 7.4 | Pre-built Reports | Pipeline by stage, lead by source, activity by type, win rate by user, forecast vs. actual | Report tests: data accuracy vs. direct SQL query |
| 7.5 | Dashboard Engine | Dashboard: grid layout, widgets (chart, KPI, table), time range, sharing | Dashboard tests: widget rendering, data refresh, sharing permissions |
| 7.6 | Sales Forecasting | Forecast by pipeline, by owner, by territory; expected value (probability-weighted); commit vs. forecast | Forecast tests: calculation accuracy, time period aggregation, trend line |
| 7.7 | Analytics API | `/analytics/` — aggregated metrics endpoints for frontend chart rendering | API tests: metric accuracy, time range filtering, org-scoped |
| 7.8 | Scheduled Report Delivery | Email/Slack delivery of reports on schedule (daily, weekly, monthly) | Schedule tests: delivery list generation, attachment formatting, timezone-aware scheduling |

### Acceptance Criteria (Phase 7 Gate)

- Create report: "Leads by source for Q3 2026" → returns correct aggregated data
- Dashboard with 5 widgets loads in < 3 seconds for 100k leads
- Forecast widget shows expected value vs. committed value for current quarter
- Schedule report "Weekly pipeline summary" → email delivered every Monday at 9am org timezone
- CSV export of 500k rows completes in < 60 seconds
- All reports respect tenant isolation — no cross-org data in results

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Report query performance on large datasets | High | High | Materialized views for common aggregations; query timeout (30s); result caching with TTL |
| Complex report builder leads to SQL injection via user input | Low | **Critical** | Parameterized queries only; field whitelist validation; no raw user input in SQL |
| PDF/Excel rendering for large datasets | Medium | Medium | Async generation with Celery; streaming response; size limit (10MB) with download link |

### Dependencies to Next Phase

- Phase 8 needs: Reports/Analytics data for AI model training

---

## 10. Phase 8 — AI Platform

**Duration:** 6–8 weeks
**Dependencies:** Phase 7 (reports/analytics data), Phase 3 (entity data for embeddings)
**Risk Level:** **High** — novel technology integration

### Goals

Build the AI platform: LLM gateway, RAG pipeline, semantic search, AI features (lead scoring, next-best-action, sentiment analysis, conversation summary). This phase establishes the architecture for all AI features.

### Deliverables

| # | Deliverable | Description | Acceptance Criteria |
|---|-------------|-------------|---------------------|
| 8.1 | AI Gateway Service | FastAPI sidecar: unified LLM API abstraction, provider routing, retry, fallback | Gateway tests: OpenAI/Anthropic/self-hosted providers; fallback on failure; usage tracking |
| 8.2 | Embedding Pipeline | Entity embedding on create/update; batch re-embedding; model versioning | Embedding tests: vector dimension consistency, tenant-scoped isolation |
| 8.3 | Semantic Search | Hybrid search (vector similarity + full-text); weighted ranking; faceted filters | Search tests: relevance ranking, hybrid scoring, tenant isolation |
| 8.4 | Prompt Management | Versioned prompt templates; A/B testing; prompt registry API | Prompt tests: version immutability, template rendering, variable validation |
| 8.5 | AI Features — Lead Scoring | ML-based lead scoring: demographic + behavioral features; explainable score (SHAP) | Scoring tests: score distribution, feature importance, cold-start handling |
| 8.6 | AI Features — Next-Best-Action | Recommendation engine: based on lead stage, engagement, historical patterns | NBA tests: recommendation relevance, diversity, business rule override |
| 8.7 | AI Features — Sentiment Analysis | Email/call transcript sentiment; trend detection; negative sentiment alert | Sentiment tests: accuracy vs. labeled dataset, drift detection |
| 8.8 | AI Features — Conversation Summary | AI-generated email thread summary; call transcript summary; entity-linked | Summary tests: coherence, entity extraction accuracy, token budget management |
| 8.9 | AI Cost Tracking | Per-feature, per-org token usage; budget alerts; model cost dashboard | Cost tests: usage attribution, budget enforcement, alert triggering |
| 8.10 | RAG Document Pipeline | Document upload → chunk → embed → index → retrieval for Q&A over org data | RAG tests: chunk quality, retrieval precision/recall, answer accuracy |

### Acceptance Criteria (Phase 8 Gate)

- Lead created → embedding generated → semantic search returns it for relevant queries
- AI Gateway proxies requests to multiple providers; provider failure triggers automatic fallback
- Prompt template update creates new version; old prompts remain usable for historical requests
- Lead scoring returns a score with explainable factors within 500ms
- Next-best-action suggests relevant actions based on lead stage and history
- Cost tracking attributes token usage to specific AI feature and org; budget alerts fire at 80%

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| LLM hallucination in generated content | High | High | All AI-generated content is tagged as "AI-generated"; user must confirm before using; fact-checking layer where possible |
| Embedding model deprecation | Medium | Medium | Model abstraction layer; re-embedding pipeline for model migration |
| AI latency impacts user experience | Medium | High | AI features are async where possible; streaming for text generation; caching for repeated queries |
| Prompt injection via CRM data fields | Medium | **Critical** | Input sanitization in embedding pipeline; output filtering; rate limits on generation |

### Dependencies to Next Phase

- Phase 9 needs: AI Gateway, Prompt Management, transcription pipeline

---

## 11. Phase 9 — Voice AI

**Duration:** 4–6 weeks
**Dependencies:** Phase 8 (AI Platform)
**Risk Level:** High

### Goals

Integrate voice capabilities: call logging, transcription, analysis, and AI-powered call coaching. This phase assumes integration with a telephony provider (Twilio, Zoom Phone, or custom SIP).

### Deliverables

| # | Deliverable | Description | Acceptance Criteria |
|---|-------------|-------------|---------------------|
| 9.1 | Voice Telephony Integration | Twilio Voice SDK integration: call routing, IVR, call recording | Integration tests: outbound call, inbound call routing, recording start/stop |
| 9.2 | Call Logging | Log inbound/outbound calls; link to contact/lead/opportunity; call duration, outcome | Logging tests: call creation, entity linking, duration calculation |
| 9.3 | Real-Time Transcription | Twilio Media Streams → WebSocket → ASR (Deepgram / Whisper) → text stream | Transcription tests: accuracy, latency (< 1s delay), speaker diarization |
| 9.4 | Post-Call Analysis | Sentiment trend, talk-to-listen ratio, objection detection, action item extraction | Analysis tests: objection detection precision/recall, action item accuracy |
| 9.5 | AI Call Coaching | Real-time suggestions (whisper mode); post-call scorecard; coaching tips generation | Coaching tests: suggestion relevance, scorecard consistency |
| 9.6 | Voice API | `/calls/` CRUD, recording playback, transcription view, analysis view | API tests: CRUD, recording access control, transcription scrolling |

### Acceptance Criteria (Phase 9 Gate)

- Initiate outbound call from CRM → call connects → audio streamed → real-time transcription displayed
- Post-call analysis generates sentiment score, talk ratio, detected objections
- AI coaching provides real-time suggestions during active call
- Call recordings are tenant-scoped; OrgA cannot access OrgB recordings
- Transcription and analysis complete within 2x call duration

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Audio streaming infrastructure complexity | High | High | Start with recorded audio analysis; add real-time streaming later |
| Speech-to-text accuracy in domain-specific terminology | Medium | Medium | Custom vocabulary in ASR engine; domain-specific fine-tuning for Whisper |
| Voice data storage costs | Medium | Medium | Tiered storage: hot (30 days), warm (1 year), cold (archive); recording compression |
| Regulatory (call recording consent) | High | **Critical** | Two-party consent detection; recording warning tone; configurable per region |

### Dependencies to Next Phase

- Phase 10 builds on all previous phases for integration connectors

---

## 12. Phase 10 — Integration Hub

**Duration:** 6–8 weeks
**Dependencies:** All previous phases
**Risk Level:** Medium

### Goals

Build the third-party integration framework: connector SDK, OAuth token management, webhook delivery, sync engine, and a marketplace for connectors. This phase opens the CRM to the ecosystem.

### Deliverables

| # | Deliverable | Description | Acceptance Criteria |
|---|-------------|-------------|---------------------|
| 10.1 | Connector SDK | Python SDK for building connectors: auth (OAuth, API Key, Basic), sync, webhook | SDK tests: auth flow, CRUD sync, error handling, rate limit handling |
| 10.2 | OAuth Token Vault | Encrypted storage for OAuth tokens; refresh management; token lifecycle | Vault tests: encryption/decryption, auto-refresh, token revocation detection |
| 10.3 | Webhook Delivery System | Outbound webhook: event subscription, delivery (POST), retry with backoff, signing | Webhook tests: delivery, retry with backoff (3s, 9s, 27s), HMAC signing verification |
| 10.4 | Sync Engine | Bidirectional sync framework: incremental sync, conflict resolution, mapping | Sync tests: create/update/delete sync, conflict resolution strategies (source wins, target wins, manual) |
| 10.5 | Built-in Connectors | Google Workspace (Contacts, Calendar), Microsoft 365 (Contacts, Calendar), Mailchimp, HubSpot (import) | Connector tests: OAuth flow, data mapping, sync round-trip, error handling |
| 10.6 | Integration Management API | `/integrations/` CRUD, auth configuration, sync status, logs | API tests: CRUD, auth flow UI, sync status, error logs |
| 10.7 | Webhook API (Inbound) | Receive webhooks from external systems; validate signature; route to internal event | Webhook tests: signature validation, replay protection, idempotency |
| 10.8 | Rate Limit Management | Per-connector rate limit adaptation; automatic backoff; queue management | Rate limit tests: adapter throttles to provider limits; queue builds and drains correctly |

### Acceptance Criteria (Phase 10 Gate)

- Connect Google Workspace → sync contacts → bidirectional updates within 30 seconds
- Connect Mailchimp → sync audience → map to CRM lists → two-way sync
- Outbound webhook fires on LeadCreated → external system receives POST with HMAC signature
- Connector SDK: new connector can be built in < 100 lines of Python
- OAuth tokens are encrypted at rest; expired tokens auto-refresh or alert user

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Third-party API changes break connectors | High | Medium | Connector CI tests run daily; versioned connectors; migration guide for breaking changes |
| OAuth token expiry disrupts sync | High | High | Proactive token refresh (before expiry); notification on refresh failure; manual re-auth flow |
| Rate limits causing partial sync | Medium | Medium | Adaptive rate limiter; sync checkpoint/resume; admin alerts on persistent rate limiting |

### Dependencies to Next Phase

- Phase 11 builds on top of the entire system for enterprise scale

---

## 13. Phase 11 — Enterprise & Scale

**Duration:** 8–12 weeks (ongoing)
**Dependencies:** All previous phases
**Risk Level:** High

### Goals

Production hardening for enterprise scale: performance optimization at 1,000+ orgs, multi-region deployment, advanced security (SAML SSO, field-level permissions), and operational excellence.

### Deliverables

| # | Deliverable | Description | Acceptance Criteria |
|---|-------------|-------------|---------------------|
| 11.1 | Multi-Region Read Replicas | PostgreSQL read replicas in secondary regions; read/write splitting; < 50ms replication lag | Replica tests: read traffic served from closest region; failover < 30s |
| 11.2 | Celery Queue Optimization | Named queues per workload (notifications, workflows, reports, integrations); priority queues | Queue tests: high-priority tasks processed before low; no queue starvation |
| 11.3 | Connection Pooling Optimization | Pgbouncer configuration; max connections per tenant; idle timeout tuning | Pooling tests: 1,000 concurrent requests with < 50 DB connections |
| 11.4 | Caching Strategy | Redis cache for: user sessions, permissions, tenant config, report results, entity lookups | Cache tests: cache hit ratio > 80%; invalidation on entity update; TTL enforcement |
| 11.5 | Enterprise SSO | SAML 2.0, OIDC, Azure AD, Okta, Google Workspace | SSO tests: IdP-initiated, SP-initiated, Just-In-Time provisioning, group sync |
| 11.6 | Advanced RBAC | Field-level permissions, record-level permissions, role hierarchy | Permission tests: field read/write restriction, record sharing rules, hierarchy resolution |
| 11.7 | Data Residency (Silo Model) | Dedicated database per tenant; migration tool from Pool → Silo | Migration tests: zero data loss, consistent sequence, rollback viability |
| 11.8 | Audit & Compliance | SOC 2 evidence collection; GDPR data export/deletion; audit log retention policy | Compliance tests: SOC 2 control mapping, GDPR deletion verification, retention enforcement |
| 11.9 | Performance Benchmarking | k6 load tests: 10k concurrent users, 1M leads per org, complex report queries | Benchmark: p95 API < 500ms, p99 < 2s, report < 30s for 500k rows |
| 11.10 | Disaster Recovery | RPO < 5 minutes, RTO < 30 minutes; documented runbook; quarterly DR drill | DR tests: failover to secondary region; data loss within RPO; RTO met |

### Acceptance Criteria (Phase 11 Gate)

- 1,000+ organizations running on shared infrastructure with consistent p95 < 200ms
- Multi-region: user in EU served from EU region; cross-region replication lag < 50ms
- SAML SSO: login via Okta → JIT user provisioning → role mapping → access granted
- Field-level permissions: user in Sales cannot see "budget" field on opportunity; manager can
- Data residency: EU org can be migrated to dedicated EU database; all queries scoped to that DB
- DR drill: failover to secondary region completes in < 30 minutes; data loss < 5 minutes

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Multi-region PostgreSQL complexity at 1,000+ orgs | High | High | Consider Citus (CitusDB) for distributed PostgreSQL; or migrate sharded orgs to dedicated instances |
| Caching invalidation bugs lead to stale data | Medium | High | Cache-aside pattern with TTL; write-through for critical data; invalidation integration tests |
| Performance regression during feature development | High | Medium | Benchmark suite runs in CI; performance budget per endpoint; regression alerting |

---

## 14. Phase Interdependency Graph

```
Phase 0 ──────────────────────────────────────────────────────────────────► All phases
    │
    ▼
Phase 1 ────────────────► Phase 2 ────────────────► Phase 3 ────────► Phase 4
(Core Framework)         (Multi-Tenancy)            (Lead/Contact/    (Pipeline/Opportunity/
                                                    Account)          Activity/Task)
                                                         │                 │
                                                         │                 │
                                                         ▼                 ▼
                                                    Phase 5 ──────────► Phase 6
                                                    (Workflow Engine)   (Notification)
                                                         │                 │
                                                         └────────┬────────┘
                                                                  │
                                                                  ▼
                                                             Phase 7
                                                         (Reports/Dashboards)
                                                                  │
                                                                  ▼
                                                             Phase 8
                                                           (AI Platform)
                                                                  │
                                                                  ▼
                                                             Phase 9
                                                            (Voice AI)
                                                                  │
                                                                  ▼
                                                            Phase 10
                                                        (Integration Hub)
                                                                  │
                                                                  ▼
                                                            Phase 11
                                                       (Enterprise & Scale)
```

### Parallelization Opportunities

| Parallel Tracks | Conditions | 
|----------------|------------|
| Phase 3 + Phase 4 infrastructure work | Phase 3 API design informs Phase 4 entity patterns |
| Phase 6 (Notification Engine) can start mid-Phase 5 | Phase 5 needs Workflow Action interface; Notification implements it |
| Phase 7 (Reports) can start mid-Phase 4 | Reports needs entity data; can build aggregation layer in parallel with Phase 5 |
| Phase 9 (Voice AI) can start late Phase 8 | Voice AI reuses AI Gateway; can parallelize after Gateway is stable |

---

## 15. Risk Register

| Risk | Phases | Likelihood | Impact | Mitigation |
|------|--------|-----------|--------|------------|
| Cross-tenant data leak due to RLS gap | 2–11 | Low | **Critical** | RLS test suite runs in CI; migration linter; pair review on all RLS-related changes |
| Workflow engine creates infinite loops | 5 | Medium | **Critical** | Depth limit (10); cycle detection; self-terminating workflow flag |
| AI LLM costs exceed budget | 8–9 | High | Medium | Per-org budget caps; model tiering (cheaper model for non-critical); caching |
| Multi-region DB replication latency | 11 | High | High | Read-from-replica for reporting; write-to-primary; monitor replication lag |
| Integration connector breakage | 10 | High | Medium | Daily connector health checks; versioned connectors; deprecation policy |
| Team cannot sustain Django migration pace | 1–11 | Medium | Medium | Automate migration generation; migration review checklist; squash migrations regularly |
| PostgreSQL connection exhaustion at scale | 3–11 | Medium | High | Pgbouncer mandatory; connection pooling tuned; monitoring alerts at 80% pool usage |
| Celery worker OOM from long-running tasks | 5–11 | Medium | High | Task timeouts (30s default); worker concurrency limits; separate queues for heavy tasks |
| GDPR deletion compliance failure | 3–11 | Low | **Critical** | Anonymization + retention audit; GDPR test suite; legal review of deletion logic |

---

> **Every phase in this plan is a business decision, not just a technical one.**
> Phase 0 and Phase 1 have zero customer value but infinite leverage — they determine
> whether subsequent phases take weeks or months. The tendency to skip or rush them
> is the single most predictable cause of startup engineering failure. Don't.
