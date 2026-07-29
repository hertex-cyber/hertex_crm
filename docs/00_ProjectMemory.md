# TZAHU CRM — Project Memory

> **Version:** 0.2.0
> **Last Updated:** 2026-07-27
> **Status:** Foundational Design Phase
> **Owner:** Platform Architecture Team
> **Permanent Document:** Yes — this is the canonical brain of the project.

---

## Table of Contents

1. [Project Vision & Business Goals](#1-project-vision--business-goals)
2. [Product Philosophy](#2-product-philosophy)
3. [Target Audience & Market Positioning](#3-target-audience--market-positioning)
4. [Architecture Decision Records (ADR) Summary](#4-architecture-decision-records-adr-summary)
5. [Technology Choices & Rationale](#5-technology-choices--rationale)
6. [DDD Bounded Contexts & Module Boundaries](#6-ddd-bounded-contexts--module-boundaries)
7. [Folder Structure](#7-folder-structure)
8. [Naming Conventions](#8-naming-conventions)
9. [Coding Standards & Conventions](#9-coding-standards--conventions)
10. [API Standards](#10-api-standards)
11. [Security Decisions](#11-security-decisions)
12. [Multi-Tenancy Decisions](#12-multi-tenancy-decisions)
13. [AI Architecture Decisions](#13-ai-architecture-decisions)
14. [Deployment Decisions](#14-deployment-decisions)
15. [Things Intentionally Avoided](#15-things-intentionally-avoided)
16. [Known Risks & Mitigations](#16-known-risks--mitigations)
17. [Future Roadmap](#17-future-roadmap)
18. [Pending Decisions](#18-pending-decisions)
19. [Completed Phases & Current Status](#19-completed-phases--current-status)
20. [Lessons Learned](#20-lessons-learned)
21. [ADR References](#21-adr-references)

---

## 1. Project Vision & Business Goals

### Vision Statement

TZAHU CRM will be the most adaptable enterprise CRM platform — one that molds to any sales process rather than forcing the sales process to mold to the software. We achieve this through deep workflow automation, AI-native intelligence, and a modular architecture that grows with the customer.

### Mission

Democratize enterprise-grade CRM by making AI-driven, workflow-automated sales intelligence accessible to every organization, from 10-person startups to 10,000-person global enterprises.

### Business Goals

| Goal | Metric | Timeline | Owner |
|------|--------|----------|-------|
| Multi-tenant SaaS launch | 50 paying organizations | R1 (6 months) | Product |
| Enterprise readiness | SOC 2 Type II, GDPR, data residency | R2 (12 months) | Security |
| Scale to 1,000+ orgs | 99.95% uptime, <200ms p95 API | R3 (18 months) | Infrastructure |
| AI-native CRM adoption | 40%+ user adoption of AI features | R3 (18 months) | AI Team |
| Integration Hub maturity | 50+ third-party connectors | R4 (24 months) | Platform |
| 100,000+ active users | Sub-second query performance at scale | R4 (24 months) | Platform |
| Revenue target | $5M ARR | R4 (24 months) | Business |

---

## 2. Product Philosophy

Seven principles guide every product and architecture decision:

1. **Workflow-First Architecture** — The CRM is an engine first, a UI second. Every entity mutation publishes a domain event; the workflow engine is the subscriber that makes the system programmable. This principle prevented us from hardcoding lead assignment, notification, or stage transition logic into controllers — those are all workflow-driven.

2. **AI as a Platform Primitive, Not a Feature** — AI is not a separate product. Every module exposes embedding vectors, semantic search, and prompt templates as first-class constructs. The AI context is a first-class concern alongside the relational model.

3. **Isolation by Default, Sharing by Contract** — Tenants are isolated at the database row level (RLS), module internals by Python namespace (import-linter), and cross-module communication by domain events. Violating any of these boundaries requires explicit architectural review.

4. **Composability Over Configuration** — Rather than building a monolithic "settings" page with 200 toggles, we decompose capabilities into composable modules (Workflow, Automation, Notification) that users assemble via the UI. This keeps each module's domain model coherent and testable.

5. **Bounded Contexts Are the Unit of Ownership** — Each bounded context owns its data, its logic, and its public API. No cross-context joins. No shared tables. Every cross-context query goes through a well-defined API or event subscription.

6. **Observability Is a First-Class Feature** — Every module emits structured logs, metrics, and traces. If it cannot be measured, it does not go to production. This is not optional — it is a delivery criterion for every sprint.

7. **Don't Build What You Can Buy (Unless the Buy Is Wrong)** — Use PostgreSQL, RabbitMQ, Redis, Celery, MinIO, OpenTelemetry, and Django Admin as commodity infrastructure. Build only the domain logic that differentiates the product. Every dependency is evaluated against the total cost of ownership over 5 years.

---

## 3. Target Audience & Market Positioning

### Target Segments

| Segment | Size | Users | Needs | TZAHU Approach |
|---------|------|-------|-------|---------------|
| **SMB** | 10–100 | Self-service, affordable | Easy setup, templates, basic automation | Stripe billing, self-service onboarding, pre-built workflow templates |
| **Mid-Market** | 100–1,000 | Sales teams, managers | Advanced workflows, reports, integrations | Dedicated instance option, advanced workflow engine, integration SDK |
| **Enterprise** | 1,000+ | Sales orgs, ops, leadership | Compliance, SSO, custom objects, SLA | Private cloud option, SAML SSO, field-level permissions, custom modules |

### Competitive Positioning

| Competitor | Strength | Weakness | TZAHU Advantage |
|-----------|----------|----------|-----------------|
| **Salesforce** | Ecosystem, brand, enterprise features | Cost, complexity, rigid data model | AI-native, workflow-first, lower TCO, faster time-to-value |
| **HubSpot** | UX, inbound marketing, SMB-friendly | Expensive at scale, limited customization | Open architecture, enterprise-ready, modular pricing |
| **Dynamics 365** | Microsoft ecosystem, enterprise compliance | Complex licensing, clunky UX | Modern UX, AI-first, API-first, K8s-native |
| **Zoho** | Low cost, broad feature set | UX quality, integration depth | AI-powered workflow, better UX, scalable architecture |
| **LeadSquared** | Lead-to-revenue focus, India market | Niche, limited enterprise features | Global scale, AI platform, multi-region, enterprise compliance |

### Key Differentiators

1. **AI-Native Architecture** — AI is not bolted on; it's a platform primitive with embedding pipelines, prompt management, and RAG for every entity
2. **Workflow-First Design** — The entire CRM is programmable via the workflow engine; every action is a composable workflow step
3. **Modular Monolith with Extraction Path** — Start simple with a monolith, extract to microservices when data proves the need
4. **Enterprise-Grade Multi-Tenancy from Day 1** — RLS-based isolation with silo escape hatch, not retrofitted
5. **Open Ecosystem** — API-first, webhook-native, connector SDK for building custom integrations

---

## 4. Architecture Decision Records (ADR) Summary

All ADRs live in `docs/ArchitectureDecisionRecords/`. Below is the complete summary:

| ADR | Title | Decision | Status | Date |
|-----|-------|----------|--------|------|
| 001 | Python Framework | Django 5.x (not FastAPI-only, not NestJS) | Approved | 2026-07-27 |
| 002 | Application Topology | Modular Monolith (not microservices) | Approved | 2026-07-27 |
| 003 | Database Isolation Model | Shared Schema + PostgreSQL RLS (with Silo escape hatch) | Approved | 2026-07-27 |
| 004 | ID Strategy | UUID v7 (not auto-increment, not UUID v4) | Approved | 2026-07-27 |
| 005 | Event Bus | Celery + RabbitMQ (not Redis Streams) | Approved | 2026-07-27 |
| 006 | Search Engine | PostgreSQL Full-Text Search (not Elasticsearch initially) | Approved | 2026-07-27 |
| 007 | AI Gateway | FastAPI sidecar (not embedded in Django) | Approved | 2026-07-27 |
| 008 | File Storage | MinIO (S3-compatible, on-premise option) | Approved | 2026-07-27 |
| 009 | Cache Layer | Redis (multi-tier: local + distributed) | Approved | 2026-07-27 |
| 010 | Background Tasks | Celery + RabbitMQ (not Dramatiq, not ARQ) | Approved | 2026-07-27 |
| 011 | API Style | DRF + Viewsets (not GraphQL initially) | Approved | 2026-07-27 |
| 012 | Authentication | JWT access + refresh token pair (not sessions) | Approved | 2026-07-27 |
| 013 | Testing Framework | pytest + pytest-django (not unittest) | Approved | 2026-07-27 |
| 014 | Monitoring | OpenTelemetry + Prometheus + Grafana | Approved | 2026-07-27 |
| 015 | Container Runtime | Docker + Kubernetes (not plain Docker Compose in prod) | Approved | 2026-07-27 |
| 016 | Frontend Framework | React + TypeScript + Vite (not Next.js, not Vue) | Draft | 2026-07-27 |
| 017 | State Management | Zustand + TanStack Query (not Redux) | Draft | 2026-07-27 |
| 018 | API Documentation | drf-spectacular (OpenAPI 3.0) | Draft | 2026-07-27 |
| 019 | Password Hashing | bcrypt (cost factor 12) | Draft | 2026-07-27 |
| 020 | LLM Provider Strategy | OpenAI primary, Anthropic fallback, self-hosted option | Draft | 2026-07-27 |

---

## 5. Technology Choices & Rationale

### Backend Stack

| Category | Choice | Rationale | Alternatives Considered |
|----------|--------|-----------|------------------------|
| Web Framework | Django 5.x | ORM, admin, ecosystem, SaaS libraries (django-tenants, drf, etc.) | FastAPI-only, NestJS, .NET Core |
| API Framework | DRF + drf-spectacular | Mature, browsable API, OpenAPI auto-generation | GraphQL, tRPC, Ninja |
| Database | PostgreSQL 16 + pgvector + pg_trgm | ACID, RLS, vector support, full-text search, operational simplicity | MySQL, CockroachDB, Supabase |
| Message Broker | RabbitMQ | Durable queues, DLX, routing flexibility, AMQP standard | Redis Streams, AWS SQS, Kafka |
| Cache | Redis 7 | Speed, multi-purpose (cache, rate limit, WS, sessions) | Memcached, Dragonfly |
| Task Queue | Celery | Mature, Django integration, beat scheduler, monitoring | Dramatiq, ARQ, Huey |
| File Storage | MinIO | S3-compatible, self-hostable, no vendor lock-in | AWS S3, GCS, Azure Blob |
| AI Gateway | FastAPI sidecar | Async streaming, different scaling profile, network isolation | Embedded in Django, separate Node.js service |
| Search | PostgreSQL FTS → pgvector hybrid | No additional service, RLS applies naturally, ACID for indexes | Elasticsearch, MeiliSearch, Typesense |
| LLM Framework | LangChain | Chain composition, tool-calling, agent orchestration, retriever integration | LlamaIndex, custom, Vercel AI SDK |
| Vector Store | pgvector | Same DB as relational data, RLS, ACID, no new infrastructure | Pinecone, Weaviate, Qdrant, Chroma |

### Frontend Stack

| Category | Choice | Rationale | Alternatives Considered |
|----------|--------|-----------|------------------------|
| Framework | React 18 + TypeScript | Ecosystem, hiring, type safety | Vue 3, Svelte, Solid |
| Build Tool | Vite | Fast HMR, optimized builds, ESM-native | Webpack, Turbopack, Parcel |
| UI Library | Material UI (MUI) | Design system maturity, accessibility, theming | Ant Design, Chakra UI, Radix |
| State Management | Zustand + TanStack Query | Lightweight, server-state specialization, no boilerplate | Redux Toolkit, MobX, Jotai |
| Routing | React Router v6 | De facto standard, nested layouts, lazy loading, route guards | TanStack Router, Next.js router |
| HTTP Client | Axios | Interceptors for JWT/refresh/error, wide adoption | ky, fetch, RTK Query |
| Form Handling | React Hook Form + Zod | Performant, schema validation, TypeScript-first | Formik, Final Form |

### Infrastructure & DevOps

| Category | Choice | Rationale |
|----------|--------|-----------|
| Container Runtime | Docker | Universal, local dev reproduces prod |
| Orchestration | Kubernetes (K8s) | Self-healing, auto-scaling, rolling updates |
| CI/CD | GitHub Actions | Integrated with repo, matrix builds, caching |
| IaC | Terraform | State management, multi-cloud, modular |
| Cloud Provider | AWS (primary) | EKS, RDS, ElastiCache, S3, CloudFront |
| Monitoring | OpenTelemetry → Prometheus → Grafana | Open standard, vendor-neutral, rich dashboarding |
| Logging | structlog → stdout → Loki/CloudWatch | Structured JSON, correlation IDs |
| Error Tracking | Sentry | Exception tracking, performance monitoring, release health |
| Secret Management | AWS Secrets Manager / HashiCorp Vault | Audit, rotation, encryption |
| API Gateway | Nginx + AWS ALB | Reverse proxy, TLS termination, rate limiting, WAF |

---

## 6. DDD Bounded Contexts & Module Boundaries

### Context Map

```
┌──────────────────────────────────────────────────────────────────┐
│                    SHARED KERNEL                                  │
│  Value Objects, Base Classes, Interfaces, Result Type,           │
│  Domain Event Base, Repository Port                              │
└──────────────────────────────────────────────────────────────────┘
         ▲              ▲              ▲              ▲
         │              │              │              │
┌────────┴──────┐ ┌────┴────────┐ ┌───┴─────────┐ ┌─┴────────────┐
│   IDENTITY    │ │ORGANIZATION │ │    RBAC     │ │   TENANT     │
│  (Foundation) │ │ (Foundation)│ │ (Foundation)│ │(Foundation)  │
└───────┬───────┘ └──────┬──────┘ └──────┬──────┘ └──────┬───────┘
        │                 │               │               │
        └─────────────────┴───────────────┴───────────────┘
                            │
                            ▼
              ┌─────────────────────────────┐
              │      CRM CORE MODULES        │
              │                              │
              │  Lead Management             │
              │  Contact & Account           │
              │  Pipeline & Opportunity      │
              │  Activity & Task             │
              │  Calendar & Meetings         │
              │  Products & Price Books      │
              │  Quotes, Orders, Invoices    │
              └──────────────┬──────────────┘
                             │
                             ▼
              ┌─────────────────────────────┐
              │      AUTOMATION LAYER        │
              │                              │
              │  Workflow Engine             │
              │  Approval Engine             │
              │  Marketing Automation        │
              │  Notification Center         │
              └──────────────┬──────────────┘
                             │
                             ▼
              ┌─────────────────────────────┐
              │      INTELLIGENCE LAYER      │
              │                              │
              │  AI Assistant                │
              │  Semantic Search             │
              │  RAG & Vector Search         │
              │  Voice AI                    │
              │  Lead Scoring                │
              └──────────────┬──────────────┘
                             │
                             ▼
              ┌─────────────────────────────┐
              │      ECOSYSTEM LAYER         │
              │                              │
              │  Integration Hub             │
              │  Webhook Management          │
              │  API Keys & Developer Portal │
              │  Marketplace                 │
              └──────────────────────────────┘
```

### Module Dependency Rules (Enforced by import-linter)

```
shared_kernel       ← Every module depends on shared_kernel (NO Django imports)
    ↑
identity           ← Foundation module (no upstream deps)
    ↑
organization       ← Depends on identity
    ↑
rbac               ← Depends on identity + organization
    ↑
tenant             ← Depends on identity, organization, rbac
----------------------------------------------------------
lead               ← Depends on tenant, organization
    ↑
contact_account    ← Depends on lead, tenant
    ↑
pipeline           ← Depends on lead, contact_account
    ↑
opportunity        ← Depends on pipeline, contact_account, lead
    ↑
activity           ← Depends on opportunity, lead, contact_account
    ↑
task               ← Depends on activity
    ↑
calendar           ← Depends on activity, task
----------------------------------------------------------
workflow           ← Depends on opportunity, lead, contact_account, task (events)
    ↑
notification       ← Depends on workflow, identity
    ↑
dashboard          ← Depends on all analytics data (reads only)
    ↑
reports            ← Depends on all analytics data (reads only)
----------------------------------------------------------
ai                 ← Depends on reports, workflow, search
    ↑
voice_ai           ← Depends on ai
    ↑
integrations       ← Depends on identity, lead, opportunity, activity
----------------------------------------------------------
settings           ← Depends on identity, organization, tenant
audit              ← Consumes events from all modules (no domain deps)
search             ← Consumes events from lead, contact_account, opportunity
```

### Forbidden Dependencies

- No module may import from another module's `infrastructure` layer
- No module may import from another module's `domain` layer directly (use events or API)
- No circular dependencies between modules
- `shared_kernel` may not import any module, including Django
- `audit` may not import domain models — it consumes events only

---

## 7. Folder Structure

```
tzahu_crm/
├── backend/
│   ├── config/                    # Django settings (base, dev, staging, prod)
│   │   ├── settings/
│   │   ├── urls/
│   │   ├── asgi.py
│   │   ├── wsgi.py
│   │   └── celery.py
│   ├── apps/
│   │   ├── shared_kernel/         # Cross-cutting primitives (NO Django imports)
│   │   ├── identity/              # Users, authentication, JWT
│   │   ├── organization/          # Organization profiles, memberships
│   │   ├── rbac/                  # Roles, permissions, assignments
│   │   ├── tenant/                # Multi-tenant management, RLS
│   │   ├── lead_management/       # Leads, sources, scoring, conversion
│   │   ├── contact_account/       # Contacts, accounts, relationships
│   │   ├── pipeline_management/   # Stages, probabilities, forecasts
│   │   ├── opportunity/           # Deals, amounts, competitors, team selling
│   │   ├── activity/              # Calls, emails, meetings, notes
│   │   ├── task/                  # Tasks, reminders, assignments
│   │   ├── calendar/              # Calendar sync, availability, meetings
│   │   ├── product/               # Products, price books, catalogs
│   │   ├── quote/                 # Quotes, proposals, approvals
│   │   ├── order/                 # Orders, fulfillment
│   │   ├── invoice/               # Invoices, credit notes
│   │   ├── contract/              # Contracts, renewals
│   │   ├── payment/               # Payment processing, receipts
│   │   ├── support_ticket/        # Support tickets, case management
│   │   ├── knowledge_base/        # KB articles, categories
│   │   ├── campaign/              # Campaigns, lists, tracking
│   │   ├── marketing/             # Marketing automation, email campaigns
│   │   ├── workflow/              # Workflow engine (triggers, conditions, actions)
│   │   ├── approval/              # Approval workflows, routing
│   │   ├── notification/          # Email, SMS, in-app, push
│   │   ├── dashboard/             # User dashboards, widgets, KPIs
│   │   ├── reports/               # Report builder, aggregations, schedules
│   │   ├── ai/                    # AI gateway client, embeddings, prompts
│   │   ├── voice_ai/              # Voice AI integration
│   │   ├── document/              # Document generation, templates
│   │   ├── file/                  # File attachments, versioning
│   │   ├── search/                # Search index management
│   │   ├── custom_fields/         # Dynamic field definitions
│   │   ├── custom_modules/        # Custom object definitions
│   │   ├── audit/                 # Event-sourced audit log
│   │   ├── integrations/          # Third-party connector framework
│   │   ├── billing/               # Billing, subscriptions, metering
│   │   ├── feature_flags/         # Feature flag management
│   │   ├── api_keys/              # API key management
│   │   ├── webhooks/              # Outbound webhook delivery
│   │   ├── developer_portal/      # Developer docs, playground
│   │   ├── marketplace/           # App marketplace
│   │   └── settings/              # Tenant and user settings
│   ├── common/                    # Shared utilities (Django-aware)
│   ├── infrastructure/            # Celery, RabbitMQ, Redis, MinIO, email, SMS adapters
│   ├── templates/                 # Django templates (admin, email)
│   ├── static/                    # Static assets
│   ├── media/                     # User-uploaded files (dev; MinIO in prod)
│   ├── manage.py
│   ├── pyproject.toml
│   ├── poetry.lock
│   ├── Dockerfile
│   └── docker-compose.yml
├── ai_gateway/                    # FastAPI sidecar for AI inference
│   ├── app/
│   │   ├── main.py
│   │   ├── config/
│   │   ├── domain/               # Tool definitions, prompt templates, agent config
│   │   ├── services/             # LLM proxy, embedding, RAG, MCP server
│   │   ├── api/                  # FastAPI routes for AI endpoints
│   │   └── adapters/             # OpenAI, Anthropic, pgvector clients
│   ├── Dockerfile
│   └── pyproject.toml
├── frontend/                      # React SPA (MUI, TanStack Query, Zustand)
│   ├── src/
│   │   ├── components/           # Reusable UI components
│   │   ├── features/             # Feature modules (leads, contacts, pipeline)
│   │   ├── store/                # Zustand stores
│   │   ├── hooks/                # Custom React hooks
│   │   ├── layouts/              # App shell, navigation, tenant layout
│   │   ├── pages/                # Route pages
│   │   ├── services/             # Axios API client, interceptors
│   │   ├── utils/                # Formatters, validators, constants
│   │   └── types/                # TypeScript type definitions
│   ├── package.json
│   ├── Dockerfile
│   └── tsconfig.json
├── mobile/                        # React Native (future, R3+)
├── infra/                         # Terraform, K8s manifests
│   ├── terraform/
│   └── kubernetes/
├── scripts/                       # DevOps, data migration, seed scripts
├── docs/                          # Documentation
│   ├── 00_ProjectMemory.md       # This file — canonical project brain
│   ├── 01_ProjectVision.md
│   ├── 02_BusinessRequirements.md
│   ├── 03_FunctionalRequirements.md
│   ├── 04_NonFunctionalRequirements.md
│   ├── 05_ProductRoadmap.md
│   ├── ARCHITECTURE_OVERVIEW.md
│   ├── IMPLEMENTATION_PLAN.md
│   ├── ModuleBlueprints/
│   └── ArchitectureDecisionRecords/
├── .github/                       # CI/CD workflows
│   └── workflows/
├── .gitignore
└── README.md
```

---

## 8. Naming Conventions

### Python / Django

| Element | Convention | Example |
|---------|-----------|---------|
| Module (Python file) | snake_case | `lead_management/` |
| Class | PascalCase | `LeadService`, `Email` |
| Function/Method | snake_case | `assign_to()`, `get_by_id()` |
| Private method | _snake_case | `_validate_email()` |
| Constant | UPPER_SNAKE_CASE | `MAX_LEAD_OWNERS` |
| Django Model | PascalCase (singular) | `LeadModel`, `ContactModel` |
| DB Table | snake_case (plural) | `leads`, `contact_accounts` |
| Serializer | PascalCase + Serializer | `LeadSerializer` |
| ViewSet | PascalCase + ViewSet | `LeadViewSet` |
| FilterSet | PascalCase + FilterSet | `LeadFilterSet` |
| Permission class | PascalCase + Permission | `CanManageLeads` |
| Command | PascalCase + Command | `AssignLeadCommand` |
| Query | PascalCase + Query | `GetLeadByIdQuery` |
| DTO | PascalCase + DTO | `LeadResponseDTO` |
| Domain Event | PascalCase (past tense) | `LeadConverted` |
| Value Object | PascalCase (noun) | `Email`, `Money`, `PhoneNumber` |

### Database

| Element | Convention | Example |
|---------|-----------|---------|
| Table name | snake_case, plural | `leads`, `pipeline_stages` |
| Primary key | `id` (UUID v7) | `id` |
| Foreign key | `{singular_table}_id` | `lead_id`, `organization_id` |
| Created timestamp | `created_at` | `created_at` |
| Updated timestamp | `updated_at` | `updated_at` |
| Soft delete | `deleted_at` (nullable) | `deleted_at` |
| Tenant column | `organization_id` | `organization_id` |
| Audit columns | `created_by_id`, `updated_by_id` | `created_by_id` |
| Join table | `{table1}_{table2}` alpha order | `lead_tags` (lead + tag) |
| Index | `idx_{table}_{column}` | `idx_leads_email` |
| Unique constraint | `uq_{table}_{columns}` | `uq_leads_org_email` |
| Check constraint | `ck_{table}_{rule}` | `ck_opportunities_amount_positive` |

### API / REST

| Element | Convention | Example |
|---------|-----------|---------|
| URL path | kebab-case, plural | `/api/v1/leads/` |
| Query params | snake_case | `?created_after=2026-01-01` |
| Request body | camelCase (JSON) | `"firstName": "John"` |
| Response body | camelCase (JSON) | `"totalCount": 100` |
| Error code | UPPER_SNAKE_CASE | `"LEAD_NOT_FOUND"` |
| Event name | PascalCase, past tense | `LeadConverted` |

### Event Naming

```
{Entity}{PastTenseVerb}
```

Examples: `LeadCreated`, `LeadAssigned`, `LeadConverted`, `ContactCreated`, `OpportunityWon`, `PipelineStageChanged`, `WorkflowExecuted`, `NotificationSent`, `ReportGenerated`, `ActivityLogged`, `TaskCompleted`, `IntegrationSynced`, `TenantProvisioned`, `UserInvited`, `OrganizationUpdated`.

---

## 9. Coding Standards & Conventions

### Domain Layer (Zero Django Imports)

```python
# CORRECT — Pure Python, no Django dependency
class Email(ValueObject):
    def __init__(self, address: str):
        self._validate(address)
        self._normalized = address.lower().strip()

    def _validate(self, address: str) -> None:
        if not re.match(r'^[^@]+@[^@]+\.[^@]+$', address):
            raise ValidationError(f"Invalid email: {address}")

# WRONG — Domain should not depend on Django
from django.db import models  # NO
from django.core.validators import validate_email  # NO
```

### Service Layer Pattern

```python
@dataclass
class AssignLeadCommand:
    lead_id: UUID
    user_id: UUID
    assigned_by: UUID

class LeadAssignmentService:
    def __init__(self, lead_repo: Repository[Lead], event_publisher: EventPublisher):
        self.lead_repo = lead_repo
        self.event_publisher = event_publisher

    def execute(self, cmd: AssignLeadCommand) -> Result[Lead, DomainError]:
        lead = self.lead_repo.get_by_id(cmd.lead_id)
        if not lead:
            return Result.failure(NotFoundError(f"Lead {cmd.lead_id} not found"))
        lead.assign_to(cmd.user_id, cmd.assigned_by)
        self.lead_repo.save(lead)
        self.event_publisher.publish(LeadAssigned(lead_id=lead.id, ...))
        return Result.success(lead)
```

### Testing Conventions

- Every `domain` public method has unit tests (no Django dependency)
- Every `application` service has integration tests with real repositories
- Every API endpoint has contract tests (drf-spectacular for OpenAPI validation)
- Test file mirrors source file path: `test_<source_file>.py`
- Factory Boy for test data; never use fixtures for complex object graphs
- Coverage target: 90%+ overall, 100% on domain layer

### Layer Enforcement (import-linter)

```
api ──────────► application ──────────► domain
  │                  │                      │
  └──────────────────┴──────────────────────┘
                         │
                         ▼
                  infrastructure
```

---

## 10. API Standards

### Versioning

- URL-based versioning: `/api/v1/`, `/api/v2/`
- Backward-compatible changes (new fields, new endpoints) don't require a version bump
- Breaking changes (field removal, behavior change) require a new version

### Pagination

```json
{
    "data": [...],
    "pagination": {
        "page": 1,
        "pageSize": 100,
        "totalCount": 1542,
        "hasNext": true,
        "hasPrevious": false
    }
}
```

- Cursor-based pagination for high-write entities (Activity, Event Log)
- Page-based pagination for low-write entities (Organization, User)
- Default page size: 100; maximum: 1000

### Error Response Format

```json
{
    "error": {
        "code": "LEAD_NOT_FOUND",
        "message": "Lead with ID 123e4567-e89b-12d3-a456-426614174000 not found",
        "details": {},
        "requestId": "req_abc123",
        "timestamp": "2026-07-27T10:30:00Z"
    }
}
```

### Rate Limiting

- Tiered by subscription plan: Free (100 req/min), Growth (1,000 req/min), Enterprise (10,000 req/min)
- Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- Rate limit violation returns `429 Too Many Requests`

### Idempotency

- POST requests accept optional `Idempotency-Key` header (UUID v4)
- Key stored in Redis with TTL of 24 hours
- Duplicate key returns cached response with `200 OK`
- Critical for payment, lead creation, and integration sync endpoints

---

## 11. Security Decisions

### Authentication

- JWT access token (15 min) + refresh token (7 days, rotated on use)
- RS256 signed (asymmetric — public key in API, private key in secret manager)
- `jti` stored in Redis until token expiry for immediate revocation
- Rate limit on `/auth/login`: 5 attempts per 15 minutes per IP

### Authorization (Three-Layer)

```
Layer 1: Authentication (is this a valid user?)
    └── JWT verification, tenant membership check
Layer 2: RBAC (can this role perform this action?)
    └── Role + Permission check at API layer (DRF permissions)
Layer 3: RLS (can this user see this row?)
    └── PostgreSQL Row-Level Security (automatic, mandatory)
```

### Data Security

| Concern | Mechanism |
|---------|-----------|
| Data at rest (DB) | PostgreSQL TDE / dm-crypt for volumes |
| Data at rest (files) | MinIO SSE-S3 (AES-256) |
| Data in transit | TLS 1.3 for all external traffic; mTLS for internal service-to-service |
| Secrets | AWS Secrets Manager / HashiCorp Vault; never in env files or code |
| API keys (external) | Encrypted at rest (AES-256-GCM) in database |
| Passwords | bcrypt (cost factor 12) |
| OAuth tokens | Encrypted at rest; decrypted only in the integration service |
| PII / GDPR | Configurable field-level encryption; anonymization on demand |
| Audit trail | Append-only event log; immutable after 5 minutes |

---

## 12. Multi-Tenancy Decisions

### Isolation Model: Pool + Silo Escape Hatch

- **Default:** Shared schema + PostgreSQL RLS (Pool model)
- **Enterprise/Compliance escape:** Dedicated database instance (Silo model)
- **Migration path:** Pool → Silo is a mechanical process because every tenant-scoped table has a consistent `organization_id` column

### RLS Policy Template

```sql
CREATE POLICY tenant_isolation_{table_name} ON {schema}.{table_name}
    USING (organization_id = current_setting('app.current_organization_id')::uuid);
```

### Tenant Resolution Chain

1. **Request** → JWT contains `organization_id` and `user_id`
2. **Middleware** validates JWT, resolves tenant, sets `app.current_organization_id` in PostgreSQL session
3. **RLS** transparently filters all queries
4. **Event publishing** enriches all events with `organization_id`
5. **Celery handler** restores `app.current_organization_id` before processing events

### Critical Failure Scenario

If RLS is ever bypassed (e.g., raw SQL in a migration, an API view using `Model.objects.all()` without going through a tenant-scoped repository), cross-tenant data leak is the result. Mitigation:
- Automated test suite that creates two tenants and asserts no cross-tenant data access via any API endpoint
- `SELECT current_setting('app.current_organization_id') IS NOT NULL` check in every Celery task handler
- Migration review checklist: every migration must verify RLS policies exist for new tables

---

## 13. AI Architecture Decisions

### AI Gateway as a Sidecar

AI inference runs in a separate FastAPI service (`ai_gateway/`), not embedded in Django. Rationale:
1. Different scaling profile — AI inference is GPU-bound and latency-sensitive
2. Streaming — Server-Sent Events (SSE) for streaming LLM responses are natural in FastAPI ASGI
3. Security — The AI gateway can be network-isolated, with authentication via short-lived tokens
4. Language flexibility — The sidecar could be rewritten without affecting the CRM

### AI Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| LLM Provider | OpenAI (GPT-4o, GPT-4o-mini) + Anthropic (Claude) | Primary and fallback LLM |
| Framework | LangChain | Chain composition, tool-calling, agent orchestration |
| Vector Store | PostgreSQL + pgvector | Operational simplicity, tenant-scoped RLS on vectors |
| Embeddings | OpenAI `text-embedding-3-small` | Default embedding provider |
| Semantic Search | Hybrid (pgvector cosine + PostgreSQL FTS) | Weighted ranking combining vector and keyword relevance |
| Prompt Management | Database-backed versioned templates | Immutable prompt versions, A/B testing |
| RAG Pipeline | LangChain + pgvector + MinIO | Document ingestion, chunking, embedding, retrieval |
| MCP Server | FastAPI + LangChain MCP adapter | Model Context Protocol for standardized tool exposure |
| Tool Execution | LangChain tool-calling | Structured tool definitions, parameter validation |
| Caching | Redis | LLM response cache, embedding cache |
| Voice AI | Deepgram/Whisper for ASR, ElevenLabs/OpenAI TTS | Speech-to-text and text-to-speech |
| AI Monitoring | OpenTelemetry + LangFuse | LLM call tracing, token accounting, cost attribution |

### LangChain Integration Pattern

LangChain is isolated to the AI Gateway service only — the Django monolith never imports LangChain directly. Chains are stateless and tenant-scoped. Tool definitions are generated dynamically from the CRM's tool registry.

### Model Context Protocol (MCP)

MCP standardizes how CRM tools and data sources are exposed to AI models. Rather than each AI feature building its own tool-calling mechanism, the MCP server provides a unified interface. Any MCP-compatible client (custom UI, VS Code extension, Slack bot) can interact with the same tool set.

---

## 14. Deployment Decisions

### Environment Strategy

| Environment | Purpose | Infrastructure | Data |
|------------|---------|---------------|------|
| **local** | Developer machine | Docker Compose | Fresh DB per `make dev` |
| **dev** | Shared development | Single-node Docker | Anonymized production copy (weekly) |
| **staging** | Pre-production validation | K8s (3-node) | Anonymized production copy (bi-weekly) |
| **production** | Live customer traffic | K8s (multi-node, multi-AZ) | Real customer data |
| **dr** | Disaster recovery | K8s (secondary region) | WAL streaming from primary |

### CI/CD Pipeline

```
PR Created → Lint + Typecheck → Test + Coverage → Build Image → Deploy to Staging
    → Smoke Tests + E2E → Deploy to Prod (manual approval)
```

### Scaling Strategy

| Component | Scale Trigger | Action |
|-----------|--------------|--------|
| Django (API) | CPU > 70% OR p95 > 500ms | HPA: increase replicas |
| Celery (Workflow) | Queue depth > 1000 | HPA: increase worker replicas |
| AI Gateway | CPU > 60% OR queue > 50 | HPA: increase replicas |
| PostgreSQL | Connections > 200 OR CPU > 70% | Vertical: larger instance; then read replicas |
| Redis | Memory > 80% | Vertical: larger instance; then cluster mode |

---

## 15. Things Intentionally Avoided

| # | Technology/Practice | Reason Avoided | Alternative |
|---|-------------------|----------------|-------------|
| 1 | **Microservices** at launch | Team size (5), operational overhead, no proven bottleneck | Modular monolith with extraction path |
| 2 | **GraphQL** as primary API | Complexity for CRUD-heavy CRM, caching challenges | REST (DRF) + drf-spectacular for docs |
| 3 | **Elasticsearch** initially | Operational complexity, no proven need at <1M records | PostgreSQL FTS + pgvector hybrid |
| 4 | **Kafka** as event bus | Overkill for current scale, operational overhead | RabbitMQ (mature, simpler, sufficient) |
| 5 | **Event Sourcing / CQRS** with separate read store | Development speed, team familiarity with patterns | CQRS-lite: domain events for write, selectors for read |
| 6 | **gRPC** for inter-service communication | No microservices yet, HTTP is sufficient | REST for now; assess gRPC if services emerge |
| 7 | **Serverless (Lambda)** | Cold starts, state management complexity | Containerized Django on K8s |
| 8 | **WebSocket** for everything | Complexity premium for CRUD operations | REST for CRUD, WebSocket only for real-time notifications |
| 9 | **Blockchain, Web3** | Zero relevance to CRM domain | N/A |
| 10 | **NoSQL databases** | ACID requirements, relational nature of CRM data | PostgreSQL (document storage via JSONB where needed) |
| 11 | **Machine learning model training** in-house | Compute cost, data requirements, distraction from product | Pre-trained models + fine-tuning via APIs |
| 12 | **SSR / Next.js** for frontend | API-first strategy, mobile app later, simpler deployment | SPA with React + Vite |
| 13 | **Role hierarchy / inheritance** in Phase 1 | Complexity, unclear value at launch | Flat RBAC; hierarchy in Phase 11 if evidenced |
| 14 | **Tenant-per-schema** as default | Migration complexity at 1000+ schemas, connection pooling issues | Shared schema + RLS |
| 15 | **Self-hosted LLMs** initially | Cost, expertise required, rapid model evolution | OpenAI + Anthropic with abstraction layer |

---

## 16. Known Risks & Mitigations

| # | Risk | Likelihood | Impact | Mitigation | Phase |
|---|------|-----------|--------|------------|-------|
| 1 | Cross-tenant data leak due to RLS gap | Low | Critical | RLS test suite in CI, migration linter, pair review on RLS changes | 2–11 |
| 2 | Workflow engine creates infinite loops | Medium | Critical | Depth limit (10), cycle detection, self-terminating workflow flag | 5 |
| 3 | AI LLM costs exceed budget | High | Medium | Per-org budget caps, model tiering, caching, cost tracking dashboards | 8–9 |
| 4 | Multi-region DB replication latency | High | High | Read-from-replica for reporting, write-to-primary, monitor replication lag | 11 |
| 5 | Integration connector breakage (API changes) | High | Medium | Daily connector health checks, versioned connectors, deprecation policy | 10 |
| 6 | Team cannot sustain Django migration pace | Medium | Medium | Automate migration generation, migration review checklist, squash regularly | 1–11 |
| 7 | PostgreSQL connection exhaustion at scale | Medium | High | Pgbouncer mandatory, connection pooling tuned, monitoring at 80% pool | 3–11 |
| 8 | Celery worker OOM from long-running tasks | Medium | High | Task timeouts (30s default), separate queues for heavy tasks, concurrency limits | 5–11 |
| 9 | GDPR deletion compliance failure | Low | Critical | Anonymization + retention audit, GDPR test suite, legal review | 3–11 |
| 10 | AI hallucination in generated content | High | High | AI-generated content tagged, user confirmation required, fact-checking layer | 8–9 |
| 11 | Prompt injection via CRM data fields | Medium | Critical | Input sanitization, output filtering, rate limits on generation | 8 |
| 12 | Single person bus factor | Medium | High | Documentation (these docs), pair programming, code review required | 0–11 |
| 13 | Django Admin exposes too much data | Low | High | Admin restricted to staff, tenant-scoped admin, audit on admin actions | 1 |
| 14 | Async task queue backlog during traffic spike | Medium | Medium | Named queues with priority, autoscaling workers, queue depth alerts | 5 |
| 15 | SSO integration complexity (SAML) | Medium | Medium | Use成熟的 library (python3-saml), thorough testing with major IdPs | 11 |

---

## 17. Future Roadmap

**R1 — MVP (Months 1–6):** Identity, RBAC, tenant, lead/contact/account, pipeline/opportunity, activities, tasks, basic workflow, email notifications, simple dashboards, REST API v1.

**R2 — Growth (Months 7–12):** Advanced workflow, report builder, calendar sync (Google, Outlook), file attachments (MinIO), full-text search, integration hub (connector SDK), mobile API, SOC 2 Type II readiness, GDPR compliance tooling.

**R3 — Scale (Months 13–18):** AI Assistant (lead scoring, next-best-action, sentiment), email sync (IMAP/SMTP), voice AI (call logging, transcription, analysis), K8s production, multi-region active-active reads, performance optimization at 1,000+ orgs, webhook delivery system.

**R4 — Enterprise (Months 19–24):** 50+ integrations, enterprise SSO (SAML, OIDC), advanced RBAC (field-level permissions), data residency (Silo model), custom objects (build your own module), billing & subscription management, marketplace.

See `docs/05_ProductRoadmap.md` for detailed timeline, dependencies, risks, and exit criteria per release.

---

## 18. Pending Decisions

| # | Decision | Options | Deadline | Owner |
|---|----------|---------|----------|-------|
| 1 | **Monitoring/alerting platform for AI costs** | LangFuse vs. custom vs. Helicone | R2 | AI Team |
| 2 | **Mobile app framework** | React Native vs. Flutter vs. PWA-first | R2 | Frontend Lead |
| 3 | **API documentation portal** | Stoplight vs. Redoc vs. custom | R1 | Platform Lead |
| 4 | **Email delivery provider** | SendGrid vs. AWS SES vs. Postmark | R1 | Infrastructure Lead |
| 5 | **SMS provider** | Twilio vs. Vonage vs. AWS SNS | R2 | Platform Lead |
| 6 | **Payment processor** | Stripe vs. Paddle vs. Chargebee | R3 | Product Lead |
| 7 | **Self-hosted LLM strategy** | vLLM vs. Ollama vs. TGI vs. none | R3 | AI Team |
| 8 | **Document generation engine** | WeasyPrint vs. ReportLab vs. DocRaptor | R2 | Platform Lead |
| 9 | **OAuth provider for SSO** | Auth0 vs. Okta vs. Keycloak (self-hosted) | R3 | Security Lead |
| 10 | **Container registry** | ECR vs. Docker Hub vs. GHCR | R0 | Infrastructure Lead |

---

## 19. Completed Phases & Current Status

```
Phase 0 — Foundation
├── Project memory document          ✅ Complete
├── Architecture decision records    ✅ Complete (20 ADRs drafted)
├── Architecture overview            ✅ Complete
├── Implementation plan              ✅ Complete
├── Identity & Multi-Tenancy BP      ✅ Complete (1,608 lines)
├── Business requirements            ✅ Complete (00_ProjectMemory.md)
├── Functional requirements          ✅ Complete (03_FunctionalRequirements.md)
├── Non-functional requirements      ✅ Complete (04_NonFunctionalRequirements.md)
├── Product roadmap                  ✅ Complete (05_ProductRoadmap.md)
│
├── Repository setup                 ❌ Not started
├── CI/CD pipeline                   ❌ Not started
├── Docker configuration             ❌ Not started
└── Coding standards doc             ✅ Complete (this document)

Phase 1 — Core Framework
├── Shared Kernel                    ❌ Not started
├── Identity module                  ❌ Not started
├── Organization module              ❌ Not started
├── RBAC module                      ❌ Not started
└── Module blueprints                ❌ Not started (except Identity)

Phase 2+ — Not started
```

---

## 20. Lessons Learned

### Architectural Lessons (from other CRM/ERP projects)

1. **Tenant isolation retrofits are catastrophic.** Building multi-tenancy after single-tenant launch requires schema changes, data migration, and application-level scoping for every query. The cost is 3–6 months of engineering. We build it from day one.

2. **Skipping import-linter leads to tangled modules within 2 sprints.** Without automated enforcement, bounded contexts bleed. A "quick" import from another module's model becomes a permanent dependency that blocks extraction. Enforce from commit 1.

3. **Event-driven architecture requires idempotency from the start.** The first time a Celery task processes a duplicate event, you learn why idempotency keys matter. We build idempotency into every event handler pattern.

4. **Prompts are code, not configuration.** Hard-coding prompts in Python files makes A/B testing, versioning, and auditing impossible. Database-backed prompt templates with version immutability are essential for AI features.

5. **UUID v7 is worth the storage cost.** Auto-increment IDs seem simpler until you need multi-region writes, pre-insert ID generation, or client-side ID generation. UUID v7 solves all of these with minimal performance impact.

6. **Observability must be wired in, not bolted on.** Adding structured logging, metrics, and tracing after shipping features means retrofitting every controller, service, and model. Wire OpenTelemetry at the framework level from day one.

7. **The admin interface is an asset, not an afterthought.** Django Admin, properly configured with tenant scoping and permissions, serves as internal tooling, support dashboards, and operational interfaces — saving months of custom admin UI development.

8. **Workflow-first is hard but worth it.** The temptation to hardcode "when lead is created, assign to user X" is overwhelming in a sprint. But every hardcoded rule becomes a feature request for customization. The workflow engine must be built before it's needed.

9. **Test the isolation boundary, not just the happy path.** A test suite that only tests "user can read own data" but not "user cannot read other tenant's data" gives false confidence. Cross-tenant isolation tests are the most important tests in the system.

10. **Documentation debt compounds faster than code debt.** Without a project memory document, decisions are repeated, rationale is lost, and onboarding takes weeks. This document is the antidote.

---

## 21. ADR References

Each Architecture Decision Record lives in `docs/ArchitectureDecisionRecords/ADR-XXX-title.md`:

| ADR | File | Status |
|-----|------|--------|
| 001 | `ADR-001-python-framework.md` | Draft |
| 002 | `ADR-002-application-topology.md` | Draft |
| 003 | `ADR-003-database-isolation-model.md` | Draft |
| 004 | `ADR-004-id-strategy.md` | Draft |
| 005 | `ADR-005-event-bus.md` | Draft |
| 006 | `ADR-006-search-engine.md` | Draft |
| 007 | `ADR-007-ai-gateway.md` | Draft |
| 008 | `ADR-008-file-storage.md` | Draft |
| 009 | `ADR-009-cache-layer.md` | Draft |
| 010 | `ADR-010-background-tasks.md` | Draft |
| 011 | `ADR-011-api-style.md` | Draft |
| 012 | `ADR-012-authentication.md` | Draft |
| 013 | `ADR-013-testing-framework.md` | Draft |
| 014 | `ADR-014-monitoring.md` | Draft |
| 015 | `ADR-015-container-runtime.md` | Draft |
| 016 | `ADR-016-frontend-framework.md` | Draft |
| 017 | `ADR-017-state-management.md` | Draft |
| 018 | `ADR-018-api-documentation.md` | Draft |
| 019 | `ADR-019-password-hashing.md` | Draft |
| 020 | `ADR-020-llm-provider-strategy.md` | Draft |

---

> **This document is the single source of truth for the TZAHU CRM project.**
> Every architectural decision, convention, and rule recorded here is binding unless superseded by a new ADR.
> If something is not documented here, it does not exist.
>
> **Last Updated:** 2026-07-27
> **Owner:** Platform Architecture Team
