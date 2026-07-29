# TZAHU CRM — Expanded Implementation Plan (v2)

> **Version:** 0.2.0
> **Last Updated:** 2026-07-27
> **Status:** Foundational Design Phase
> **Owner:** Platform Architecture Team

---

## Table of Contents

1. [Strategic Overview](#1-strategic-overview)
2. [Phase Interdependency Graph](#2-phase-interdependency-graph)
3. [Phase 0 — Foundation & Infrastructure](#3-phase-0--foundation--infrastructure)
4. [Phase 1 — Core Framework & Shared Kernel](#4-phase-1--core-framework--shared-kernel)
5. [Phase 2 — Multi-Tenancy & Security Infrastructure](#5-phase-2--multi-tenancy--security-infrastructure)
6. [Phase 3 — Lead, Contact & Account Management](#6-phase-3--lead-contact--account-management)
7. [Phase 4 — Pipeline, Opportunity, Activities & Tasks](#7-phase-4--pipeline-opportunity-activities--tasks)
8. [Phase 5 — Workflow & Automation Engine](#8-phase-5--workflow--automation-engine)
9. [Phase 6 — Notification Engine](#9-phase-6--notification-engine)
10. [Phase 7 — Reports, Dashboards & Analytics](#10-phase-7--reports-dashboards--analytics)
11. [Phase 8 — AI Platform](#11-phase-8--ai-platform)
12. [Phase 9 — Voice AI](#12-phase-9--voice-ai)
13. [Phase 10 — Integration Hub](#13-phase-10--integration-hub)
14. [Phase 11 — Enterprise & Scale](#14-phase-11--enterprise--scale)
15. [Phase 12 — Platform Evolution & Maintenance](#15-phase-12--platform-evolution--maintenance)
16. [Team Allocation Model](#16-team-allocation-model)
17. [Risk Register](#17-risk-register)
18. [Parallelization Opportunities](#18-parallelization-opportunities)
19. [Definition of Done](#19-definition-of-done)
20. [Module Inventory (60+ Modules)](#20-module-inventory-60-modules)

---

## 1. Strategic Overview

### 1.1 Purpose

This document defines the complete phased engineering roadmap for TZAHU CRM, covering 60+ modules across 12 phases. Each phase builds on the previous one with clear deliverables, acceptance criteria, dependencies, risks, and Definition of Done. The plan is designed for a 5-person engineering team building for 1,000+ organizations and 100,000+ users within 24 months.

### 1.2 Strategic Principles

1. **Foundations before features.** The first three phases contain zero customer-facing features. They build the architecture that makes features safe to add quickly later.

2. **Tenant isolation from day one.** Every phase from Phase 1 includes tenant-scoped design and tests.

3. **Test infrastructure as a deliverable.** Every phase's acceptance criteria includes a defined test suite.

4. **Observability is non-negotiable.** Every phase delivers structured logging, metrics, and basic dashboards.

5. **Security is layered, not bolted on.** Auth in Phase 1, RBAC in Phase 2, RLS in Phase 2, audit in every phase.

6. **Parallelize where possible.** Phases 4, 5, and 6 can partially overlap.

7. **Every module is a bounded context.** Each module owns its data, logic, and public API.

8. **Events are the backbone.** Cross-module communication happens via domain events, not direct calls.

### 1.3 Key Milestones

| Milestone | Timeline | Business Value |
|-----------|----------|----------------|
| M1: Foundation | Month 1 | Developer infrastructure |
| M2: Identity & Multi-Tenancy | Month 2 | Tenant isolation |
| M3: Core CRM Entities | Months 3-4 | Lead/Contact/Account management |
| M4: Sales Pipeline | Months 5-6 | Pipeline & Opportunity management |
| M5: Automation | Months 7-9 | Workflow engine & Notifications |
| M6: Analytics | Months 10-11 | Reports & Dashboards |
| M7: AI Platform | Months 12-14 | AI features & RAG |
| M8: Voice AI | Months 15-16 | Voice call intelligence |
| M9: Integration Hub | Months 17-19 | Third-party connectors |
| M10: Enterprise Scale | Months 20-24 | Multi-region, SSO, performance |

---

## 2. Phase Interdependency Graph

```
Phase 0 ──────────────────────────────────────────────────────────────────────► All phases
(Foundation)
    │
    ▼
Phase 1 ────────────► Phase 2 ────────────► Phase 3 ────────► Phase 4
(Core Framework)     (Multi-Tenancy)        (Lead/Contact/     (Pipeline/Opportunity/
│                                            Account)           Activity/Task)
│                                              │                    │
│  ┌───────────────────────────────────────────┘                    │
│  │   Phase 4b ─── Calendar Sync (Google/Outlook)                 │
│  │   Phase 4c ─── Email Sync (IMAP)                              │
│  ▼                                                                ▼
├──► Phase 5 ─────────────────────────────────────────────► Phase 6
│   (Workflow Engine)                                           (Notification)
│      │                                                            │
│      └────────────────────────┬───────────────────────────────────┘
│                               │
│                               ▼
│                          Phase 7
│                      (Reports/Dashboards)
│                               │
│                               ▼
│   ┌────────────────────── Phase 8 ──────────────────────┐
│   │                   (AI Platform)                      │
│   │                          │                            │
│   │                          ▼                            │
│   │                    Phase 9                            │
│   │                   (Voice AI)                          │
│   │                          │                            │
│   └──────────────────────────┼────────────────────────────┘
│                              ▼
│                         Phase 10
│                     (Integration Hub)
│                              │
│                              ▼
│                         Phase 11
│                     (Enterprise & Scale)
│                              │
│                              ▼
│                         Phase 12
│               (Platform Evolution & Maintenance)
└─────────────────────────────────────────────────────────────────
```

### Module Count by Phase

| Phase | Modules | Cumulative |
|-------|---------|------------|
| 0 | 10 (infrastructure items) | 10 |
| 1 | 5 (shared_kernel, identity, organization, rbac, base models) | 15 |
| 2 | 5 (tenant, rls, middleware, isolation tests, admin console) | 20 |
| 3 | 8 (lead, contact, account, scoring, dedup, search, import, conversion) | 28 |
| 4 | 7 (pipeline, opportunity, activity, task, calendar, email sync, dashboard views) | 35 |
| 5 | 6 (workflow model, condition engine, action engine, scheduler, templates, audit) | 41 |
| 6 | 6 (email, sms, in-app, push, slack, preferences) | 47 |
| 7 | 5 (report builder, dashboards, forecasting, scheduled delivery, analytics API) | 52 |
| 8 | 6 (ai gateway, embeddings, semantic search, prompts, cost tracking, rag) | 58 |
| 9 | 4 (voice telephony, transcription, analysis, coaching) | 62 |
| 10 | 6 (connector sdk, oauth vault, webhooks, sync engine, built-in connectors, rate limiting) | 68 |
| 11 | 7 (multi-region, celery ops, caching, enterprise sso, advanced rbac, data residency, dr) | 75 |

---

## 3. Phase 0 — Foundation & Infrastructure

**Duration:** 2-3 weeks
**Dependencies:** None (greenfield project)
**Risk Level:** Low
**Team:** Full team (5 engineers)

### Goals

Establish the development environment, tooling, CI/CD pipeline, and code quality enforcement before any application code is written.

### Deliverables

| # | Deliverable | Module | Description | Acceptance Criteria |
|---|---|---|---|---|
| 0.1 | Django project scaffold | config | Modular app structure, config/settings/, ASGI/WSGI | `python manage.py runserver` starts; health endpoint returns 200 |
| 0.2 | Poetry + pyproject.toml | config | Dependency management with locked versions | `poetry install` succeeds; `poetry check` passes |
| 0.3 | Docker Compose | infra | Django, PostgreSQL 16, Redis 7, RabbitMQ, Celery worker, MinIO, Pgbouncer | `docker compose up` starts all services; health checks pass |
| 0.4 | Code quality tooling | config | ruff, mypy (strict), import-linter, pre-commit hooks | `pre-commit run --all-files` passes with zero violations |
| 0.5 | CI/CD pipeline (GitHub Actions) | devops | Lint -> typecheck -> test -> build -> deploy | PR merge triggers pipeline; green build in < 10 min |
| 0.6 | Test framework | config | pytest, pytest-django, pytest-cov, factory-boy, pytest-benchmark | `pytest` discovers all tests; coverage configured to 90% |
| 0.7 | OpenTelemetry stub | observability | Logs, metrics, traces with console exporter | Log output shows structured JSON; span appears in console trace |
| 0.8 | Environment configuration | config | .env template, base/dev/staging/prod split | DJANGO_SETTINGS_MODULE selects correct settings |
| 0.9 | Makefile | config | `make dev`, `make test`, `make lint`, `make migrate`, `make seed` | All commands execute without error |
| 0.10 | First deployment target | devops | Staging environment (Docker host or minimal K8s) | `curl staging.api.tzahu.com/health` returns 200 |

### Acceptance Criteria (Phase 0 Gate)

- [ ] `docker compose up` starts all 7 services cleanly
- [ ] `make test` runs pytest with 0 failures
- [ ] `make lint` runs ruff + mypy + import-linter with 0 violations
- [ ] PR merged to main triggers GitHub Actions workflow
- [ ] Staging deployment returns HTTP 200 on health endpoint
- [ ] OpenTelemetry console exporter shows structured JSON log output

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Tooling version conflicts | Medium | Low | Lock all versions in pyproject.toml; use Docker for reproducible builds |
| CI pipeline slow | Medium | Medium | Parallelize job steps; cache pip/poetry deps; use GitHub Actions larger runner |
| Team not familiar with Django settings pattern | Low | Low | Document in DEVELOPMENT_GUIDE.md |

### Dependencies to Next Phase

- Phase 1 needs: working Django project, test framework, import-linter config, Docker Compose with DB

---

## 4. Phase 1 — Core Framework & Shared Kernel

**Duration:** 3-4 weeks
**Dependencies:** Phase 0
**Risk Level:** Medium
**Team:** Full team (5 engineers)

### Goals

Build the shared kernel primitives and foundation modules (Identity, Organization, RBAC).

### Deliverables

| # | Deliverable | Module | Description | Acceptance Criteria |
|---|---|---|---|---|
| 1.1 | Shared Kernel — Domain | shared_kernel | ValueObject, Entity, AggregateRoot, DomainEvent base classes | Unit tests: equality, hashing, immutability, event collection |
| 1.2 | Shared Kernel — VOs | shared_kernel | Email, PhoneNumber, Address, PersonName, Money, Currency, Percentage, TimeZone | Unit tests: validation, normalization, equality |
| 1.3 | Shared Kernel — Results | shared_kernel | Result[T,E], PaginatedResult[T], DomainError hierarchy | Unit tests: success/failure chaining, pagination math |
| 1.4 | Shared Kernel — Ports | shared_kernel | Repository[T] interface, EventPublisher port | Interface tests: contract adherence |
| 1.5 | Identity — Domain | identity | User aggregate, events (UserRegistered, UserInvited, UserLoggedIn) | Domain tests: password hashing, email verification |
| 1.6 | Identity — Application | identity | RegisterUser, LoginUser, InviteUser, RefreshToken commands | Integration tests: token creation, refresh cycle, password rotation |
| 1.7 | Identity — API | identity | /auth/register, /auth/login, /auth/refresh, /auth/me | API tests: happy path, validation errors, rate limiting |
| 1.8 | Identity — JWT | identity | Short-lived access token + refresh token, device tracking | Security tests: expired tokens rejected, refresh rotation |
| 1.9 | Organization — Domain | organization | Organization aggregate, Membership aggregate | Domain tests: status lifecycle, member management |
| 1.10 | Organization — API | organization | /orgs/ CRUD, /orgs/{id}/members/ management | API tests: CRUD, member addition/removal, role assignment |
| 1.11 | RBAC — Domain | rbac | Role aggregate, Permission VO, RoleAssignment entity | Domain tests: role hierarchy, permission checking |
| 1.12 | RBAC — API | rbac | /roles/, /permissions/, /assignments/ | API tests: CRUD, permission-based access control |
| 1.13 | Base Django models | shared_kernel | UUIDModel, TimestampedModel, SoftDeleteModel, TenantScopedModel | Migration tests: table creation, indexes, constraints |
| 1.14 | import-linter rules | config | Full layer enforcement for all Phase 1 modules | CI fails if domain imports Django |
| 1.15 | Logging & monitoring | observability | OpenTelemetry for all endpoints, Celery tasks, DB queries | Grafana dashboard shows request rate, error rate, latency |

### Acceptance Criteria (Phase 1 Gate)

- [ ] New user can register -> email verification -> login -> receive JWT -> access protected endpoints
- [ ] Organization can be created -> invite user -> user accepts -> user has role -> RBAC enforced
- [ ] import-linter fails if any module violates layer rules
- [ ] OpenAPI spec generated and valid for all public endpoints
- [ ] 90%+ test coverage on Shared Kernel, Identity, Organization, RBAC

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| RBAC design too complex (ACL vs. RBAC) | Medium | High | Start with flat RBAC; add hierarchy in Phase 11 |
| JWT secret management in CI | Medium | Medium | Use GitHub Actions secrets; ephemeral keys for test runs |
| import-linter too restrictive early | Medium | Low | Exempt current phase from strict full enforcement |

### Dependencies to Next Phase

- Phase 2 needs: Identity (users, orgs), RBAC, Shared Kernel, TenantScopedModel mixin

---

## 5. Phase 2 — Multi-Tenancy & Security Infrastructure

**Duration:** 2-3 weeks
**Dependencies:** Phase 1
**Risk Level:** Critical
**Team:** Full team (5 engineers)

### Goals

Implement the tenant isolation layer: PostgreSQL RLS, tenant resolution middleware, repository enforcement, Celery tenant propagation.

### Deliverables

| # | Deliverable | Module | Description | Acceptance Criteria |
|---|---|---|---|---|
| 2.1 | RLS Policy Engine | tenant | Migration utility that generates RLS policies for TenantScopedModel tables | `make generate_rls` produces valid SQL |
| 2.2 | Tenant Resolution Middleware | tenant | Middleware extracts org_id from JWT, sets PostgreSQL session variable | Unauthenticated request returns 401; missing tenant returns 403 |
| 2.3 | Tenant Repository Mixin | tenant | Repository base class auto-scopes queries by organization_id | User from OrgA cannot read OrgB data |
| 2.4 | Celery Tenant Propagation | tenant | Task-local storage for tenant context; middleware for Celery tasks | Background task for OrgA cannot access OrgB data |
| 2.5 | Tenant Model | tenant | Organization plan, status, feature flags, settings | Tenant lifecycle: provision -> activate -> suspend -> reactivate |
| 2.6 | Tenant Provisioning API | tenant | /tenants/ — create, get, update, suspend, delete | Provisioned tenant gets RLS-protected tables |
| 2.7 | Cross-Tenant Isolation Test Suite | tenant | 2 tenants -> assert no data leakage across 50+ endpoints | Zero false passes |
| 2.8 | Silo Escape Hatch | tenant | Documented procedure + migration script for dedicated database | Migration maintains FK integrity; zero data loss |
| 2.9 | Audit-Only Table Exception | tenant | Mechanism for non-tenant-scoped system tables | System tables have no RLS |

### Acceptance Criteria (Phase 2 Gate)

- [ ] Two tenants cannot read each other's data via any API endpoint
- [ ] Test suite runs 10,000+ isolation assertions in < 60 seconds
- [ ] Celery task for one tenant cannot access another tenant's data
- [ ] Provisioning a new tenant automatically applies RLS policies
- [ ] Suspending a tenant immediately blocks all data access

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| RLS disabled during local dev | High | Medium | Local dev uses DISABLE_RLS=True; CI enforces RLS ON |
| Migration creates table without RLS | Medium | Critical | Migration linter; every TenantScopedModel must have companion RLS migration |
| Raw SQL in migration bypasses repository | Medium | Critical | All data migrations go through bulk repositories; raw SQL reviewed by two engineers |
| Tenant context lost in async path | Medium | High | Structured logging includes tenant_id; alerts if tenant_id missing in production |

### Dependencies to Next Phase

- Phase 3 needs: RLS, tenant resolution, tenant-scoped repository base, Celery tenant propagation

---

## 6. Phase 3 — Lead, Contact & Account Management

**Duration:** 4-6 weeks
**Dependencies:** Phase 2, Phase 1
**Risk Level:** Medium
**Team:** 3 domain + 2 platform

### Goals

Build the core CRM entities: Leads, Contacts, and Accounts.

### Deliverables

| # | Deliverable | Module | Description | Acceptance Criteria |
|---|---|---|---|---|
| 3.1 | Lead Domain | lead | Lead aggregate: status lifecycle, source tracking, scoring, owner assignment | Domain tests: status transitions, validation, scoring |
| 3.2 | Lead API | lead | /leads/ CRUD, bulk create, status transitions, assignment, dedup | API tests: CRUD, status flows, bulk import |
| 3.3 | Lead Scoring Engine | lead | Score based on source, engagement, demographic fit, custom rules | Scoring tests: calculation, recalculation on update |
| 3.4 | Contact Domain | contact | Contact aggregate: email, phone, address, preferences, GDPR consent | Domain tests: preference validation, consent lifecycle |
| 3.5 | Contact API | contact | /contacts/ CRUD, merge, GDPR compliance (export, forget) | API tests: CRUD, merge, GDPR export anonymizes |
| 3.6 | Account Domain | account | Account aggregate: hierarchy (parent/child), industry, size, territory | Domain tests: hierarchy validation |
| 3.7 | Account API | account | /accounts/ CRUD, hierarchy management, territory assignment | API tests: CRUD, hierarchy CRUD, team assignments |
| 3.8 | Lead -> Contact -> Account Conversion | lead | Conversion workflow: lead -> contact + account + opportunity | Integration tests: full conversion flow |
| 3.9 | Duplicate Detection Engine | lead/contact | Configurable rules, merge UI, conflict resolution | Duplicate tests: exact match, fuzzy match |
| 3.10 | Search Index | search | PostgreSQL full-text search with weighted fields | Search tests: relevance ranking, tenant-scoped |
| 3.11 | Lead Import (CSV, Excel) | lead | Import pipeline: parse -> validate -> map -> dedup -> create -> report | Import tests: 10k rows, malformed data, partial success |

### Acceptance Criteria (Phase 3 Gate)

- [ ] Full lead lifecycle: create -> qualify -> convert -> creates contact + account + opportunity
- [ ] Duplicate detection prevents double entry within a tenant
- [ ] Import 10,000 leads in < 30 seconds; errors generate downloadable report
- [ ] Search across leads, contacts, accounts returns tenant-scoped results
- [ ] All APIs have OpenAPI docs; all endpoints have isolation tests

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Lead conversion logic becomes complex | High | Medium | Model as state machine with clear transitions; test every path |
| CSV import performance on large files | Medium | Medium | Stream parsing; batch DB inserts; Celery for >5k rows |
| Dedup fuzzy matching quality | Medium | High | Use pg_trgm for trigram similarity; per-tenant threshold config |

### Dependencies to Next Phase

- Phase 4 needs: Lead, Contact, Account domain models and APIs

---

## 7. Phase 4 — Pipeline, Opportunity, Activities & Tasks

**Duration:** 4-6 weeks
**Dependencies:** Phase 3
**Risk Level:** Medium
**Team:** 3 domain + 2 platform

### Goals

Implement the sales pipeline engine: configurable stages, opportunities with amounts/probability, activity logging, and task management.

### Deliverables

| # | Deliverable | Module | Description | Acceptance Criteria |
|---|---|---|---|---|
| 4.1 | Pipeline Domain | pipeline | Pipeline aggregate: stages with order, probability, rules | Domain tests: stage ordering, transition validation |
| 4.2 | Pipeline API | pipeline | /pipelines/ CRUD, default pipeline per org, stage management | API tests: CRUD, default assignment, stage reordering |
| 4.3 | Opportunity Domain | opportunity | Opportunity aggregate: amount, currency, stage, close date, win/loss | Domain tests: amount rules, probability-weighted forecast |
| 4.4 | Opportunity API | opportunity | /opportunities/ CRUD, stage transitions, forecast rollup, team selling | API tests: CRUD, forecast by pipeline/owner/territory |
| 4.5 | Activity Domain | activity | Activity aggregate (polymorphic): Call, Email, Meeting, Note | Domain tests: type validation, duration constraints |
| 4.6 | Activity API | activity | /activities/ CRUD, log call/email/meeting, entity timeline | API tests: CRUD, timeline view, polymorphic serialization |
| 4.7 | Task Domain | task | Task aggregate: assignee, due date, priority, status, related entity | Domain tests: assignment rules, overdue detection |
| 4.8 | Task API | task | /tasks/ CRUD, assignment, status updates, dashboard queries | API tests: CRUD, assignment, filtering |
| 4.9 | Calendar Sync (Read) | calendar | Google Calendar, Outlook Calendar read integration | Integration tests: OAuth flow, event sync, conflict detection |
| 4.10 | Email Sync (Read) | email_sync | IMAP integration: read inbound emails, link to entities | Integration tests: IMAP connection, email threading |

### Acceptance Criteria (Phase 4 Gate)

- [ ] Create pipeline with stages -> create opportunity -> move through stages -> forecast -> win/loss
- [ ] Log call/email against any entity -> see entity timeline -> filter by activity type
- [ ] Create task -> assign -> update -> complete -> dashboard shows overdue tasks
- [ ] Calendar and email sync work for test accounts
- [ ] All entities emit domain events for Workflow Engine (Phase 5)

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Activity polymorphism leads to complex DB schema | Medium | Medium | Generic FK with caution; prefer separate tables with union views |
| Calendar/email sync security (OAuth tokens) | High | High | Token encryption at rest; short-lived scopes; refresh monitoring |
| Forecast accuracy depends on data quality | Medium | Low | Document as expected value; don't promise precision |

### Dependencies to Next Phase

- Phase 5 needs: domain events from all Phase 3-4 entities
- Phase 6 needs: domain events for notification triggers
- Phase 7 needs: Phase 3-4 data for reports

---

## 8. Phase 5 — Workflow & Automation Engine

**Duration:** 6-8 weeks
**Dependencies:** Phase 3, Phase 4
**Risk Level:** High
**Team:** 3 domain + 2 platform

### Goals

Build the workflow automation engine — triggers, conditions, and actions.

### Deliverables

| # | Deliverable | Module | Description | Acceptance Criteria |
|---|---|---|---|---|
| 5.1 | Workflow Definition Model | workflow | Workflow: name, event trigger, conditions (AND/OR tree), ordered actions | Domain tests: condition evaluation, action execution order |
| 5.2 | Condition Engine | workflow | Evaluate conditions: field comparison, date math, set membership, sub-queries | Condition tests: every operator, nested AND/OR |
| 5.3 | Action Engine | workflow | Actions: update field, assign owner, webhook, create task, send notification | Action tests: idempotency, rollback, timeout |
| 5.4 | Workflow Execution Service | workflow | Match event -> evaluate conditions -> execute actions (Celery) | Integration tests: event triggers matching workflow |
| 5.5 | Loop Prevention | workflow | Execution depth limit (max 10), cycle detection, recursion guard | Safety tests: infinite loop terminates |
| 5.6 | Workflow Scheduler | workflow | Cron/time-based workflows | Schedule tests: cron parsing, timezone handling |
| 5.7 | Workflow API | workflow | /workflows/ CRUD, enable/disable, execution history, test-run | API tests: CRUD, test-run shows simulation without side effects |
| 5.8 | Workflow Audit | workflow | Every execution logged: trigger, conditions, actions, success/failure | Audit tests: completeness, failure tracking |
| 5.9 | Template Library | workflow | Pre-built templates: auto-assign, warm stale deals, follow-up | Template tests: import creates valid workflow |

### Acceptance Criteria (Phase 5 Gate)

- [ ] Create workflow: "When Lead created AND source = Website -> assign to queue -> Slack notification"
- [ ] Workflow executes within 5 seconds of event publication
- [ ] Loop detection catches and prevents infinite recursion
- [ ] Scheduled workflows fire at correct time across time zones
- [ ] Test-run mode evaluates conditions without executing actions
- [ ] 10,000 workflow executions per hour with < 1% failure rate

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Workflow execution performance at scale | High | High | Async via Celery; 30s timeout; parallel action execution |
| Condition evaluation on large datasets | Medium | Medium | Sub-query conditions evaluated in-DB, not in-memory |
| Users create conflicting workflows | Medium | High | Validation prevents update-triggers-update cycles |
| Debugging workflow failures | High | High | Execution trace UI; step-by-step replay; failure notifications |

### Dependencies to Next Phase

- Phase 6 needs: Workflow Action -> Send Notification

---

## 9. Phase 6 — Notification Engine

**Duration:** 3-4 weeks
**Dependencies:** Phase 5, Phase 1
**Risk Level:** Medium
**Team:** 3 domain + 2 platform

### Goals

Build multi-channel notification: in-app, email, SMS, push, Slack/Teams.

### Deliverables

| # | Deliverable | Module | Description | Acceptance Criteria |
|---|---|---|---|---|
| 6.1 | Notification Channel Abstraction | notification | Channel interface: deliver(recipient, template, context) -> Result | Channel tests: interface contract |
| 6.2 | Email Channel | notification | SMTP/SendGrid/SES, template rendering, bounce handling | Email tests: deliverability, bounce classification |
| 6.3 | SMS Channel | notification | Twilio integration, short/long code, opt-out handling | SMS tests: deliverability, opt-out respected |
| 6.4 | In-App Notification Channel | notification | WebSocket via Django Channels + Redis; notification center UI | In-app tests: real-time delivery, read/unread |
| 6.5 | Push Notification Channel | notification | Firebase Cloud Messaging for mobile push | Push tests: device token management |
| 6.6 | Slack/Teams Channel | notification | Webhook integration, message formatting, interactive buttons | Integration tests: webhook delivery |
| 6.7 | Notification Preferences | notification | Per-user, per-channel opt-in/out, quiet hours, digest frequency | Preference tests: channel preference enforced |
| 6.8 | Notification Templates | notification | Jinja2 templates, per-channel, variables, conditional blocks | Template tests: variable substitution |
| 6.9 | Notification API | notification | /notifications/ list, mark-read, preferences, template management | API tests: CRUD, pagination |
| 6.10 | Rate Limiting & Quotas | notification | Per-user, per-tenant, per-channel rate limits; daily quotas | Rate limit tests: throttling enforced |

### Acceptance Criteria (Phase 6 Gate)

- [ ] Workflow triggers "send email" -> email delivered within 10 seconds
- [ ] User opts out of SMS -> SMS not sent even if workflow triggers it
- [ ] In-app notification appears in real-time via WebSocket
- [ ] Email template renders correctly with context variables
- [ ] Rate limit exceeded -> notification queued, not dropped
- [ ] SMTP failure -> retry 3 times -> dead-letter -> alert

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Email deliverability (spam, blacklisting) | Medium | High | SPF/DKIM/DMARC setup; dedicated sending IPs; warm-up process |
| SMS costs at scale | Low | Medium | Per-message cost tracking; daily quota alerts |
| WebSocket scaling with multiple Django workers | Medium | High | Redis as channel layer; separate WebSocket service at scale |

### Dependencies to Next Phase

- Phase 7 needs: notification delivery metrics for dashboards

---

## 10. Phase 7 — Reports, Dashboards & Analytics

**Duration:** 4-6 weeks
**Dependencies:** Phases 3, 4, 5, 6
**Risk Level:** Medium
**Team:** 3 domain + 2 platform

### Goals

Build reporting and analytics: report builder, pre-built dashboards, pipeline analytics, forecasting.

### Deliverables

| # | Deliverable | Module | Description | Acceptance Criteria |
|---|---|---|---|---|
| 7.1 | Report Builder Engine | reports | Ad-hoc report: dimensions, measures, filters, sorting, grouping | Report tests: aggregation accuracy |
| 7.2 | Report Data Source Abstraction | reports | Register reportable models with field metadata | Source tests: field discovery, SQL generation |
| 7.3 | Report API | reports | /reports/ CRUD, execute (sync+async), export (CSV, PDF, XLSX), schedule | API tests: execution with 1M rows in < 30s |
| 7.4 | Pre-built Reports | reports | Pipeline by stage, lead by source, win rate, forecast vs actual | Report tests: data accuracy vs direct SQL |
| 7.5 | Dashboard Engine | dashboard | Dashboard: grid layout, widgets (chart, KPI, table), time range, sharing | Dashboard tests: widget rendering, data refresh |
| 7.6 | Sales Forecasting | dashboard | Forecast by pipeline/owner/territory; expected value; commit vs forecast | Forecast tests: calculation accuracy |
| 7.7 | Analytics API | dashboard | /analytics/ — aggregated metrics for frontend chart rendering | API tests: metric accuracy, time range filtering |
| 7.8 | Scheduled Report Delivery | reports | Email/Slack delivery on schedule (daily, weekly, monthly) | Schedule tests: timezone-aware scheduling |

### Acceptance Criteria (Phase 7 Gate)

- [ ] Create report: "Leads by source for Q3 2026" -> returns correct aggregated data
- [ ] Dashboard with 5 widgets loads in < 3 seconds for 100k leads
- [ ] Forecast widget shows expected vs committed value
- [ ] Schedule report "Weekly pipeline summary" -> email delivered every Monday 9am
- [ ] CSV export of 500k rows completes in < 60 seconds
- [ ] All reports respect tenant isolation

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Report query performance on large datasets | High | High | Materialized views; query timeout (30s); result caching |
| Report builder leads to SQL injection via user input | Low | Critical | Parameterized queries only; field whitelist |
| PDF/Excel rendering for large datasets | Medium | Medium | Async with Celery; streaming; 10MB size limit |

### Dependencies to Next Phase

- Phase 8 needs: Reports/Analytics data for AI model training

---

## 11. Phase 8 — AI Platform

**Duration:** 6-8 weeks
**Dependencies:** Phase 7, Phase 3
**Risk Level:** High
**Team:** 2 AI + 2 platform + 1 domain

### Goals

Build the AI platform: LLM gateway, RAG pipeline, semantic search, AI features.

### Deliverables

| # | Deliverable | Module | Description | Acceptance Criteria |
|---|---|---|---|---|
| 8.1 | AI Gateway Service | ai | FastAPI sidecar: unified LLM API abstraction, provider routing, retry, fallback | Gateway tests: OpenAI/Anthropic/self-hosted providers |
| 8.2 | Embedding Pipeline | ai | Entity embedding on create/update; batch re-embedding; model versioning | Embedding tests: vector dimension consistency |
| 8.3 | Semantic Search | ai | Hybrid search (vector + full-text); weighted ranking; faceted filters | Search tests: relevance ranking, tenant isolation |
| 8.4 | Prompt Management | ai | Versioned prompt templates; A/B testing; prompt registry API | Prompt tests: version immutability, template rendering |
| 8.5 | AI Lead Scoring | ai | ML-based lead scoring; explainable score (SHAP) | Scoring tests: score distribution, feature importance |
| 8.6 | Next-Best-Action | ai | Recommendation engine based on lead stage, engagement, history | NBA tests: recommendation relevance, business rule override |
| 8.7 | Sentiment Analysis | ai | Email/call transcript sentiment; trend detection; negative alert | Sentiment tests: accuracy vs labeled dataset |
| 8.8 | Conversation Summary | ai | AI-generated email thread summary; call transcript summary | Summary tests: coherence, entity extraction |
| 8.9 | AI Cost Tracking | ai | Per-feature, per-org token usage; budget alerts | Cost tests: usage attribution, budget enforcement |
| 8.10 | RAG Document Pipeline | ai | Document upload -> chunk -> embed -> index -> retrieval | RAG tests: chunk quality, retrieval precision/recall |

### Acceptance Criteria (Phase 8 Gate)

- [ ] Lead created -> embedding generated -> semantic search returns it for relevant queries
- [ ] AI Gateway proxies to multiple providers; provider failure triggers fallback
- [ ] Prompt template update creates new version; old prompts remain usable
- [ ] Lead scoring returns score with explainable factors within 500ms
- [ ] Next-best-action suggests relevant actions based on lead stage and history
- [ ] Cost tracking attributes token usage to specific AI feature and org

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| LLM hallucination in generated content | High | High | AI-generated content tagged; user must confirm; fact-checking layer |
| Embedding model deprecation | Medium | Medium | Model abstraction layer; re-embedding pipeline |
| AI latency impacts UX | Medium | High | AI features async where possible; streaming; caching for repeated queries |
| Prompt injection via CRM data fields | Medium | Critical | Input sanitization; output filtering; rate limits on generation |

### Dependencies to Next Phase

- Phase 9 needs: AI Gateway, Prompt Management, transcription pipeline

---

## 12. Phase 9 — Voice AI

**Duration:** 4-6 weeks
**Dependencies:** Phase 8
**Risk Level:** High
**Team:** 2 AI + 2 platform + 1 domain

### Goals

Integrate voice capabilities: call logging, transcription, analysis, AI coaching.

### Deliverables

| # | Deliverable | Module | Description | Acceptance Criteria |
|---|---|---|---|---|
| 9.1 | Voice Telephony Integration | voice_ai | Twilio Voice SDK: call routing, IVR, call recording | Integration tests: outbound/inbound call |
| 9.2 | Call Logging | voice_ai | Log calls, link to contact/lead/opportunity | Logging tests: call creation, entity linking |
| 9.3 | Real-Time Transcription | voice_ai | Twilio Media Streams -> WebSocket -> ASR (Deepgram/Whisper) | Transcription tests: accuracy, latency < 1s |
| 9.4 | Post-Call Analysis | voice_ai | Sentiment, talk ratio, objection detection, action items | Analysis tests: objection detection precision/recall |
| 9.5 | AI Call Coaching | voice_ai | Real-time whispers, post-call scorecard, coaching tips | Coaching tests: suggestion relevance |
| 9.6 | Voice API | voice_ai | /calls/ CRUD, recording playback, transcription view | API tests: recording access control |

### Acceptance Criteria (Phase 9 Gate)

- [ ] Initiate outbound call from CRM -> call connects -> audio streamed -> real-time transcription
- [ ] Post-call analysis generates sentiment score, talk ratio, detected objections
- [ ] AI coaching provides real-time suggestions during active call
- [ ] Call recordings are tenant-scoped
- [ ] Transcription and analysis complete within 2x call duration

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Audio streaming infrastructure complexity | High | High | Start with recorded audio analysis; add real-time streaming later |
| STT accuracy in domain terminology | Medium | Medium | Custom vocabulary in ASR; domain-specific Whisper fine-tuning |
| Voice data storage costs | Medium | Medium | Tiered storage: hot (30d), warm (1y), cold (archive) |
| Call recording consent regulations | High | Critical | Two-party consent detection; recording warning tone; configurable per region |

### Dependencies to Next Phase

- Phase 10 builds on all previous phases for integration connectors

---

## 13. Phase 10 — Integration Hub

**Duration:** 6-8 weeks
**Dependencies:** All previous phases
**Risk Level:** Medium
**Team:** 3 domain + 2 platform

### Goals

Build the third-party integration framework: connector SDK, OAuth, webhooks, sync engine.

### Deliverables

| # | Deliverable | Module | Description | Acceptance Criteria |
|---|---|---|---|---|
| 10.1 | Connector SDK | integrations | Python SDK: auth (OAuth, API Key, Basic), sync, webhook | SDK tests: auth flow, CRUD sync |
| 10.2 | OAuth Token Vault | integrations | Encrypted storage; refresh management; token lifecycle | Vault tests: encryption, auto-refresh |
| 10.3 | Webhook Delivery System | integrations | Event subscription, POST delivery, retry with backoff, HMAC signing | Webhook tests: delivery, retry (3s, 9s, 27s) |
| 10.4 | Sync Engine | integrations | Bidirectional sync: incremental, conflict resolution, mapping | Sync tests: create/update/delete sync |
| 10.5 | Built-in Connectors | integrations | Google Workspace, Microsoft 365, Mailchimp, HubSpot | Connector tests: OAuth, data mapping |
| 10.6 | Integration Management API | integrations | /integrations/ CRUD, auth config, sync status, logs | API tests: CRUD, auth flow |
| 10.7 | Inbound Webhook API | integrations | Receive webhooks, validate signature, route to internal event | Webhook tests: signature validation, idempotency |
| 10.8 | Rate Limit Management | integrations | Per-connector rate limit adaptation; backoff; queue management | Rate limit tests: adapter throttles to provider limits |

### Acceptance Criteria (Phase 10 Gate)

- [ ] Connect Google Workspace -> sync contacts -> bidirectional updates within 30 seconds
- [ ] Connect Mailchimp -> sync audience -> map to CRM lists -> two-way sync
- [ ] Outbound webhook fires on LeadCreated -> external system receives POST with HMAC signature
- [ ] Connector SDK: new connector built in < 100 lines of Python
- [ ] OAuth tokens encrypted at rest; expired tokens auto-refresh or alert

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Third-party API changes break connectors | High | Medium | Connector CI tests run daily; versioned connectors |
| OAuth token expiry disrupts sync | High | High | Proactive refresh; notification on failure; manual re-auth |
| Rate limits causing partial sync | Medium | Medium | Adaptive rate limiter; checkpoint/resume |

### Dependencies to Next Phase

- Phase 11 builds on top of the entire system for enterprise scale

---

## 14. Phase 11 — Enterprise & Scale

**Duration:** 8-12 weeks (ongoing)
**Dependencies:** All previous phases
**Risk Level:** High
**Team:** Full team (5 engineers)

### Goals

Production hardening for enterprise: performance optimization, multi-region, advanced security, operational excellence.

### Deliverables

| # | Deliverable | Module | Description | Acceptance Criteria |
|---|---|---|---|---|
| 11.1 | Multi-Region Read Replicas | infra | PostgreSQL read replicas; read/write splitting; < 50ms lag | Replica tests: read from closest region; failover < 30s |
| 11.2 | Celery Queue Optimization | infra | Named queues per workload; priority queues | Queue tests: high-priority before low-priority |
| 11.3 | Connection Pooling Optimization | infra | Pgbouncer config; max connections per tenant; idle timeout | Pooling tests: 1,000 concurrent with < 50 connections |
| 11.4 | Caching Strategy | infra | Redis for sessions, permissions, config, report results | Cache tests: hit ratio > 80%; invalidation on update |
| 11.5 | Enterprise SSO | identity | SAML 2.0, OIDC, Azure AD, Okta, Google Workspace | SSO tests: IdP-initiated, SP-initiated, JIT provisioning |
| 11.6 | Advanced RBAC | rbac | Field-level permissions, record-level, role hierarchy | Permission tests: field read/write restriction |
| 11.7 | Data Residency (Silo Model) | tenant | Dedicated DB per tenant; migration tool from Pool -> Silo | Migration tests: zero data loss, consistent sequence |
| 11.8 | Audit & Compliance | audit | SOC 2 evidence collection; GDPR export/deletion; audit log retention | Compliance tests: SOC 2 control mapping |
| 11.9 | Performance Benchmarking | qa | k6 load tests: 10k concurrent, 1M leads per org, complex reports | Benchmark: p95 API < 500ms, p99 < 2s |
| 11.10 | Disaster Recovery | infra | RPO < 5 min, RTO < 30 min; documented runbook; quarterly drill | DR tests: failover to secondary region |

### Acceptance Criteria (Phase 11 Gate)

- [ ] 1,000+ organizations with consistent p95 < 200ms
- [ ] Multi-region: EU user served from EU region; replication lag < 50ms
- [ ] SAML SSO: login via Okta -> JIT provisioning -> role mapping -> access
- [ ] Field-level permissions: Sales cannot see "budget" field; manager can
- [ ] Data residency: EU org migrates to dedicated EU database
- [ ] DR drill: failover in < 30 min; data loss < 5 min

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Multi-region PostgreSQL complexity | High | High | Consider Citus for distributed PG; sharded orgs to dedicated instances |
| Caching invalidation bugs lead to stale data | Medium | High | Cache-aside with TTL; write-through for critical data |
| Performance regression during feature development | High | Medium | Benchmark suite in CI; performance budget per endpoint |

---

## 15. Phase 12 — Platform Evolution & Maintenance

**Duration:** Ongoing
**Dependencies:** All previous phases
**Risk Level:** Low
**Team:** Rotating ownership

### Goals

Sustained engineering: performance monitoring, dependency updates, technical debt reduction, developer experience improvements.

### Deliverables

| # | Deliverable | Description | Cadence |
|---|---|---|---|
| 12.1 | Dependency Updates | Regular updates of Python, JS, and system dependencies | Monthly |
| 12.2 | Performance Optimization | Query optimization, N+1 detection, slow query analysis | Weekly |
| 12.3 | Security Audits | Dependency scanning, penetration testing, compliance reviews | Quarterly |
| 12.4 | Developer Experience | Tooling improvements, documentation, test speed optimization | Ongoing |
| 12.5 | Technical Debt Reduction | Refactoring, migration squashing, code cleanup | Per sprint |
| 12.6 | Feature Flag Management | Cleanup of stale feature flags | Monthly |
| 12.7 | Mobile API Support | API review for mobile client needs | Per sprint |
| 12.8 | Custom Objects Framework | Build-your-own module infrastructure | Phase 12+ |

---

## 16. Team Allocation Model

### Baseline Team: 5 Engineers

| Role | Count | Responsibilities |
|------|-------|-----------------|
| Platform Engineer | 2 | Infrastructure, CI/CD, backend core, shared kernel, performance |
| Domain Engineer | 2 | Business module implementation (leads, pipeline, workflow, reports) |
| AI Engineer | 1 | AI Gateway, embeddings, RAG, prompt management, Voice AI |

### Phase-Specific Allocation

| Phase | Focus | Allocation | Rationale |
|-------|-------|------------|-----------|
| 0-2 | Infrastructure & Core | Full team (5 platform) | Foundations require everyone's buy-in; no domain work yet |
| 3-4 | Business Entities | 3 domain + 2 platform | Platform team handles cross-cutting (search, import, calendar sync) |
| 5-6 | Automation | 3 domain + 2 platform | Workflow engine is the most complex deliverable; platform team builds execution infrastructure |
| 7 | Analytics | 4 domain + 1 platform | Report builder is primarily domain logic; platform handles async export |
| 8-9 | AI | 2 AI + 2 platform + 1 domain | AI engineers own gateway/model layer; platform handles infrastructure; domain bridges CRM data |
| 10 | Integration Hub | 2 domain + 2 platform + 1 AI | Domain engineers build connector SDK; platform builds webhook/sync; AI handles intelligent mapping |
| 11 | Enterprise | Full team | Everyone contributes to hardening their modules |

### Hiring Ramp

| Month | Team Size | New Hire Focus |
|-------|-----------|----------------|
| 1 | 3 (founding) | Platform, Django, DevOps |
| 3 | 5 (+2) | Domain engineers |
| 6 | 7 (+2) | AI engineer, Frontend engineer |
| 12 | 10 (+3) | Additional domain, QA, DevOps |
| 18 | 15 (+5) | Feature teams, SRE, Security |

---

## 17. Risk Register

### Critical Risks

| # | Risk | Phase | L | I | Mitigation | Contingency |
|---|------|-------|---|---|------------|-------------|
| R01 | Cross-tenant data leak due to RLS gap | 2-11 | Low | Critical | RLS test suite in CI; migration linter; pair review on RLS changes | Emergency tenant isolation mode; revert deployment |
| R02 | Workflow engine creates infinite loops | 5 | Med | Critical | Depth limit (10); cycle detection; self-terminating flag | Kill switch per workflow; admin override to disable all workflows |
| R03 | Prompt injection via CRM data fields | 8 | Med | Critical | Input sanitization; output filtering; rate limits | AI Gateway circuit breaker; manual review queue |
| R04 | GDPR deletion compliance failure | 3-11 | Low | Critical | Anonymization + retention audit; GDPR test suite | Legal review of deletion logic; manual data purge |

### High Risks

| # | Risk | Phase | L | I | Mitigation |
|---|------|-------|---|---|------------|
| R05 | AI LLM costs exceed budget | 8-9 | High | Med | Per-org budget caps; model tiering; caching |
| R06 | Multi-region DB replication latency | 11 | High | High | Read-from-replica for reporting; write-to-primary; monitor lag |
| R07 | Integration connector breakage | 10 | High | Med | Daily connector health checks; versioned connectors |
| R08 | PostgreSQL connection exhaustion at scale | 3-11 | Med | High | Pgbouncer mandatory; monitoring at 80% pool usage |
| R09 | Celery worker OOM from long-running tasks | 5-11 | Med | High | Task timeouts (30s default); separate queues for heavy tasks |
| R10 | Team sustainability at Django migration pace | 1-11 | Med | Med | Automate generation; migration review checklist; squash regularly |
| R11 | Audio streaming infrastructure complexity | 9 | High | High | Start with recorded audio; add real-time streaming later |
| R12 | Email deliverability (spam, blacklisting) | 6 | Med | High | SPF/DKIM/DMARC setup; dedicated IPs; domain warm-up |
| R13 | OAuth token expiry disrupts sync | 10 | High | High | Proactive refresh; notification on failure; manual re-auth |
| R14 | Report query performance at scale | 7 | High | High | Materialized views; 30s timeout; result caching with TTL |

### Medium Risks

| # | Risk | Phase | L | I | Mitigation |
|---|------|-------|---|---|------------|
| R15 | RLS disabled during local dev | 2 | High | Med | DISABLE_RLS=True for speed; CI enforces RLS ON |
| R16 | Lead conversion logic complexity | 3 | High | Med | State machine with clear transitions; test every path |
| R17 | Calendar/email sync complexity | 4 | Med | Med | Start with read-only sync; add write sync later |
| R18 | Workflow debugging difficulty | 5 | High | High | Execution trace UI; step-by-step replay |
| R19 | WebSocket scaling | 6 | Med | High | Redis channel layer; consider separate WebSocket service |
| R20 | Embedding model deprecation | 8 | Med | Med | Model abstraction layer; re-embedding pipeline |
| R21 | AI latency impacts UX | 8 | Med | High | Async AI; streaming; caching |
| R22 | Third-party API changes | 10 | High | Med | Daily health checks; versioned connectors |

### Risk Response Plan

| Response Type | Examples |
|---------------|----------|
| **Avoid** | Start with flat RBAC (not hierarchical); start with read-only calendar sync |
| **Mitigate** | RLS test suite; Celery task timeouts; circuit breakers on external calls |
| **Transfer** | Email deliverability (SendGrid); SMS (Twilio); Voice (Twilio); Monitoring (Datadog/Grafana Cloud) |
| **Accept** | Embedding model deprecation risk (we can re-embed); AI latency on first request (warm-up calls) |

---

## 18. Parallelization Opportunities

### Parallel Execution Tracks

| Track A | Track B | Track C | Conditions for Parallelization |
|---------|---------|---------|-------------------------------|
| **Phase 3** (Lead/Contact/Account) | **Phase 4 infra setup** (DB schema patterns, import infrastructure) | — | Phase 3 API design informs Phase 4 entity patterns |
| **Phase 5** (Workflow Engine) | **Phase 6** (Notification Engine) | — | Phase 5 needs Workflow Action interface; Notification implements it |
| **Phase 7** (Reports/Dashboards) | **Phase 5** (Workflow Engine) | — | Reports needs entity data from Phase 3-4; can build aggregation layer in parallel with Phase 5 |
| **Phase 8** (AI Platform — infrastructure) | **Phase 8** (AI features — models) | — | Gateway + Embedding pipeline parallel with Model training |
| **Phase 9** (Voice AI) | **Phase 8 late** (AI features) | — | Voice AI reuses AI Gateway; can parallelize after Gateway is stable |
| **Phase 10** (Connector SDK) | **Phase 10** (OAuth Vault) | **Phase 10** (Built-in connectors) | SDK is prerequisite for connectors; Vault and connectors can partially overlap |
| **Phase 11** (Multi-region reads) | **Phase 11** (SSO) | **Phase 11** (Caching) | Independent infrastructure tracks |

### Team Splitting During Parallel Phases

| Phase Combo | Team A | Team B | Communication |
|-------------|--------|--------|---------------|
| Phase 3 + Phase 4 | 3 domain (leads) | 2 platform (infra for pipeline/activity) | Daily sync; shared entity contracts |
| Phase 5 + Phase 6 | 3 domain (workflow engine) | 2 platform (notification channels) | API contract between Workflow Action -> Notification |
| Phase 7 + Phase 5 late | 2 domain (reports) | 3 platform (workflow optimization) | Reports reads from entity tables; no write conflicts |
| Phase 8 infra + features | 2 AI (gateway, embeddings) | 3 platform (fastapi sidecar, integration) | Gateway API contract; feature integration with Django |

### Sequencing Rules

1. **Infrastructure before features.** Shared infrastructure (RLS, Celery config, caching) must be complete before any feature that depends on it.
2. **API contracts first.** When teams work in parallel, the downstream team defines their required API contract first. The upstream team implements to that contract.
3. **Weekly integration gates.** Parallel tracks integrate every Friday. CI must pass with both tracks' code merged.

---

## 19. Definition of Done

Every deliverable in every phase must meet ALL of these criteria:

### Code Quality
- [ ] All code passes `ruff` linting with zero violations
- [ ] All code passes `mypy --strict` with zero violations
- [ ] All imports comply with `import-linter` contract rules
- [ ] No `TODO`, `FIXME`, or `XXX` comments in production code
- [ ] No commented-out code in any file
- [ ] No `print()` or `logging.debug()` left in production code
- [ ] All secrets, keys, and tokens use environment variables or vault

### Testing
- [ ] Unit tests for all domain layer public methods
- [ ] Integration tests for all application services
- [ ] API contract tests for all endpoints (drf-spectacular validation)
- [ ] Security tests for auth, RBAC, and tenant isolation
- [ ] Test coverage >= 90% for new code (measured by `pytest-cov`)
- [ ] No flaky tests (run 3x consecutively)
- [ ] Cross-tenant isolation tests pass

### Documentation
- [ ] OpenAPI (drf-spectacular) schema validates without errors
- [ ] Module README updated if module structure changed
- [ ] ADR written for any architecture decision made during phase
- [ ] Changelog entry written

### Observability
- [ ] Structured JSON logging for all new endpoints and Celery tasks
- [ ] Prometheus metrics (RED: Rate, Errors, Duration) for all new services
- [ ] OpenTelemetry spans for all new operations
- [ ] Grafana dashboard for module health (if new module)
- [ ] Alerts configured for error rate > 1% and p95 latency > 500ms

### Security
- [ ] All endpoints have authentication check
- [ ] All endpoints have appropriate RBAC permission check
- [ ] All tenant-scoped tables have RLS policies
- [ ] Test for OWASP Top 10 vulnerabilities (XSS, CSRF, SQLi, etc.)
- [ ] No sensitive data in logs (emails masked, PII redacted)
- [ ] Rate limiting applied to all public endpoints

### Performance
- [ ] Endpoint p95 latency < 500ms (under load test)
- [ ] No N+1 queries (verified via django-debug-toolbar or nplusone library)
- [ ] DB query count per endpoint < 20 (unless explicitly justified)
- [ ] Celery task duration < 30s (unless explicitly justified)
- [ ] Cache strategy documented and implemented

### Operations
- [ ] Database migration runs cleanly (forward + rollback tested)
- [ ] Celery task retry policy configured
- [ ] Health check endpoint includes new service
- [ ] Docker Compose updated if new service added
- [ ] CI/CD pipeline passes for the phase branch

---

## 20. Module Inventory (60+ Modules)

### Shared Kernel & Foundation (5)

| # | Module | Type | Phase | Description |
|---|--------|------|-------|-------------|
| 1 | shared_kernel | Core | 1 | ValueObjects, Entity, AggregateRoot, DomainEvent, Result, Repository port |
| 2 | config | Core | 0 | Django settings, URLs, WSGI/ASGI, Celery config |
| 3 | common | Core | 0 | Django-aware utilities, mixins, helpers |
| 4 | infrastructure | Core | 0 | Celery, RabbitMQ, Redis, MinIO, email, SMS adapters |
| 5 | observability | Core | 0 | OpenTelemetry setup, logging configuration, metrics |

### Identity & Security (5)

| # | Module | Type | Phase | Description |
|---|--------|------|-------|-------------|
| 6 | identity | Domain | 1 | Users, authentication, JWT, sessions, password management |
| 7 | organization | Domain | 1 | Organization profiles, memberships, settings |
| 8 | rbac | Domain | 1 | Roles, permissions, role assignments |
| 9 | tenant | Domain | 2 | Multi-tenant RLS, tenant lifecycle, Pool/Silo model |
| 10 | audit | Domain | 4+ | Event-sourced audit log, compliance reporting |

### Core CRM Entities (6)

| # | Module | Type | Phase | Description |
|---|--------|------|-------|-------------|
| 11 | lead | Domain | 3 | Lead management, status lifecycle, scoring |
| 12 | contact | Domain | 3 | Contact management, GDPR, preferences |
| 13 | account | Domain | 3 | Account management, hierarchy, territory |
| 14 | pipeline | Domain | 4 | Pipeline stages, management |
| 15 | opportunity | Domain | 4 | Opportunity management, forecasting |
| 16 | product | Domain | 4+ | Product catalog, pricing (future) |

### Activities & Communication (5)

| # | Module | Type | Phase | Description |
|---|--------|------|-------|-------------|
| 17 | activity | Domain | 4 | Activity logging (calls, emails, meetings, notes) |
| 18 | task | Domain | 4 | Task management, assignments, reminders |
| 19 | calendar | Integration | 4 | Calendar sync (Google, Outlook) |
| 20 | email_sync | Integration | 4 | Email sync (IMAP/SMTP) |
| 21 | messaging | Domain | 4+ | Internal messaging (future) |

### Automation (3)

| # | Module | Type | Phase | Description |
|---|--------|------|-------|-------------|
| 22 | workflow | Domain | 5 | Workflow engine, conditions, actions, scheduler |
| 23 | notification | Domain | 6 | Multi-channel notification (email, SMS, push, in-app, Slack) |
| 24 | webhook | Integration | 6 | Outbound webhook delivery, retry, signing |

### Analytics (4)

| # | Module | Type | Phase | Description |
|---|--------|------|-------|-------------|
| 25 | reports | Domain | 7 | Report builder, data sources, export |
| 26 | dashboard | Domain | 7 | Dashboards, widgets, KPI, charts |
| 27 | forecasting | Domain | 7 | Sales forecasting |
| 28 | analytics | Domain | 7 | Aggregated metrics API |

### AI & Intelligence (8)

| # | Module | Type | Phase | Description |
|---|--------|------|-------|-------------|
| 29 | ai_gateway | Service | 8 | FastAPI sidecar, LLM proxy, provider routing |
| 30 | embeddings | Domain | 8 | Embedding pipeline, vector storage |
| 31 | semantic_search | Domain | 8 | Hybrid vector + full-text search |
| 32 | prompt_mgmt | Domain | 8 | Prompt templates, versioning, registry |
| 33 | rag | Domain | 8 | RAG pipeline, document ingestion, retrieval |
| 34 | voice_ai | Domain | 9 | Voice telephony, transcription, analysis |
| 35 | call_coaching | Domain | 9 | AI call coaching, real-time suggestions |
| 36 | mcp_server | Service | 8 | Model Context Protocol server |

### Integrations (6)

| # | Module | Type | Phase | Description |
|---|--------|------|-------|-------------|
| 37 | integrations | Domain | 10 | Integration management, connector framework |
| 38 | connector_sdk | SDK | 10 | Python SDK for building connectors |
| 39 | oauth_vault | Domain | 10 | Encrypted OAuth token storage |
| 40 | sync_engine | Domain | 10 | Bidirectional sync framework |
| 41 | google_workspace | Connector | 10 | Google Contacts, Calendar connector |
| 42 | microsoft_365 | Connector | 10 | Microsoft Contacts, Calendar connector |
| 43 | mailchimp | Connector | 10 | Mailchimp connector |
| 44 | hubspot | Connector | 10 | HubSpot import connector |
| 45 | webhook_inbound | Domain | 10 | Inbound webhook receiver |

### Enterprise (7)

| # | Module | Type | Phase | Description |
|---|--------|------|-------|-------------|
| 46 | sso | Domain | 11 | SAML 2.0, OIDC, Azure AD, Okta |
| 47 | advanced_rbac | Domain | 11 | Field-level permissions, role hierarchy |
| 48 | data_residency | Infra | 11 | Silo model, Pool->Silo migration |
| 49 | multi_region | Infra | 11 | Read replicas, read/write splitting |
| 50 | backup | Infra | 11 | WAL archiving, PITR, automated backups |
| 51 | dr | Infra | 11 | Disaster recovery, failover |
| 52 | compliance | Domain | 11 | SOC 2, GDPR, audit evidence collection |

### Platform (6)

| # | Module | Type | Phase | Description |
|---|--------|------|-------|-------------|
| 53 | search | Domain | 3 | Full-text search index management |
| 54 | settings | Domain | 3 | Tenant and user settings |
| 55 | import | Domain | 3 | CSV/Excel import pipeline |
| 56 | export | Domain | 7 | Data export (CSV, PDF, XLSX) |
| 57 | billing | Integration | 10+ | Subscription, Stripe integration (Phase 12) |
| 58 | marketplace | Domain | 12+ | Connector marketplace (Phase 12+) |

### Infrastructure (4)

| # | Module | Type | Phase | Description |
|---|--------|------|-------|-------------|
| 59 | docker | DevOps | 0 | Dockerfiles, Docker Compose |
| 60 | k8s | DevOps | 0+ | K8s manifests, Helm charts |
| 61 | terraform | DevOps | 0+ | Infrastructure as Code |
| 62 | monitoring | DevOps | 0 | Prometheus, Grafana, Sentry |

---

> **Every phase in this plan is a business decision, not just a technical one.**
> Phase 0 and Phase 1 have zero customer value but infinite leverage — they determine
> whether subsequent phases take weeks or months. The tendency to skip or rush them
> is the single most predictable cause of startup engineering failure. Don't.
