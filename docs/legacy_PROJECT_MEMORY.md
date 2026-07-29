# TZAHU CRM — Project Memory

> **Version:** 0.1.0-draft
> **Last Updated:** 2026-07-27
> **Status:** Foundational Design Phase
> **Owner:** Platform Architecture Team

---

## Table of Contents

1. [Vision & Business Context](#1-vision--business-context)
2. [Product Philosophy](#2-product-philosophy)
3. [Architecture Decision Records (ADR) Summary](#3-architecture-decision-records-adr-summary)
4. [Technology Choices & Rationale](#4-technology-choices--rationale)
5. [Modular Monolith Strategy](#5-modular-monolith-strategy)
6. [Coding Conventions & Standards](#6-coding-conventions--standards)
7. [Module Dependency Rules](#7-module-dependency-rules)
8. [Naming Conventions](#8-naming-conventions)
9. [Event Naming & Contracts](#9-event-naming--contracts)
10. [Folder Structure](#10-folder-structure)
11. [AI Architecture Decisions](#11-ai-architecture-decisions)
12. [Multi-Tenancy Decisions](#12-multi-tenancy-decisions)
13. [API Standards](#13-api-standards)
14. [Common Mistakes to Avoid](#14-common-mistakes-to-avoid)
15. [Current Implementation Status](#15-current-implementation-status)
16. [Pending Tasks](#16-pending-tasks)
17. [Future Roadmap](#17-future-roadmap)

---

## 1. Vision & Business Context

### Vision Statement

TZAHU CRM will be the most adaptable enterprise CRM platform — one that molds to any sales process rather than forcing the sales process to mold to the software. We achieve this through deep workflow automation, AI-native intelligence, and a modular architecture that grows with the customer.

### Business Goals

| Goal | Metric | Timeline |
|------|--------|----------|
| Multi-tenant SaaS launch | 50 paying organizations | R1 (6 months) |
| Enterprise readiness | SOC 2 Type II, GDPR, data residency | R2 (12 months) |
| Scale to 1,000+ orgs | 99.95% uptime, <200ms p95 API | R3 (18 months) |
| AI-native CRM | 40%+ user adoption of AI features | R3 |
| Integration Hub | 50+ third-party connectors | R4 (24 months) |
| 100,000+ active users | Sub-second query performance at scale | R4 |

### Target Audience

- **SMB** (10–100 users): Self-service onboarding, Stripe billing, templates
- **Mid-Market** (100–1,000 users): Dedicated instance option, advanced workflows, SLA support
- **Enterprise** (1,000+ users): Private cloud, compliance frameworks, dedicated SLAs, custom integrations

---

## 2. Product Philosophy

1. **Workflow-First Architecture** — The CRM is an engine first, a UI second. Every entity mutation publishes a domain event; the workflow engine is the subscriber that makes the system programmable. This principle prevented us from hardcoding lead assignment, notification, or stage transition logic into controllers — those are all workflow-driven.

2. **AI as a Platform Primitive, Not a Feature** — AI is not a separate product. Every module exposes embedding vectors, semantic search, and prompt templates as first-class constructs. The AI context is a first-class concern alongside the relational model.

3. **Isolation by Default, Sharing by Contract** — Tenants are isolated at the database row level (RLS), module internals by Python namespace (import-linter), and cross-module communication by domain events. Violating any of these boundaries requires explicit architectural review.

4. **Composability Over Configuration** — Rather than building a monolithic "settings" page with 200 toggles, we decompose capabilities into composable modules (Workflow, Automation, Notification) that users assemble via the UI. This keeps each module's domain model coherent and testable.

5. **Bounded Contexts Are the Unit of Ownership** — Each bounded context owns its data, its logic, and its public API. No cross-context joins. No shared tables. Every cross-context query goes through a well-defined API or event subscription.

6. **Observability Is a First-Class Feature** — Every module emits structured logs, metrics, and traces. If it cannot be measured, it does not go to production. This is not optional — it is a delivery criterion for every sprint.

7. **Don't Build What You Can Buy (Unless the Buy Is Wrong)** — Use PostgreSQL, RabbitMQ, Redis, Celery, MinIO, OpenTelemetry, and Django Admin as commodity infrastructure. Build only the domain logic that differentiates the product. Every dependency is evaluated against the total cost of ownership over 5 years.

---

## 3. Architecture Decision Records (ADR) Summary

All ADRs live in `docs/ArchitectureDecisionRecords/`. Below is the summary table:

| ADR | Title | Decision | Date |
|-----|-------|----------|------|
| 001 | Python Framework | Django 5.x (not FastAPI-only, not NestJS) | 2026-07-27 |
| 002 | Application Topology | Modular Monolith (not microservices) | 2026-07-27 |
| 003 | Database Isolation Model | Shared Schema + PostgreSQL RLS (with Silo escape hatch) | 2026-07-27 |
| 004 | ID Strategy | UUID v7 (not auto-increment, not UUID v4) | 2026-07-27 |
| 005 | Event Bus | Celery + RabbitMQ (not Redis Streams) | 2026-07-27 |
| 006 | Search Engine | PostgreSQL Full-Text Search (not Elasticsearch initially) | 2026-07-27 |
| 007 | AI Gateway | FastAPI sidecar (not embedded in Django) | 2026-07-27 |
| 008 | File Storage | MinIO (S3-compatible, on-premise option) | 2026-07-27 |
| 009 | Cache Layer | Redis (multi-tier: local + distributed) | 2026-07-27 |
| 010 | Background Tasks | Celery + RabbitMQ (not Dramatiq, not ARQ) | 2026-07-27 |
| 011 | API Style | DRF + Viewsets (not GraphQL initially) | 2026-07-27 |
| 012 | Authentication | JWT access + refresh token pair (not sessions) | 2026-07-27 |
| 013 | Testing Framework | pytest + pytest-django (not unittest) | 2026-07-27 |
| 014 | Monitoring | OpenTelemetry + Prometheus + Grafana | 2026-07-27 |
| 015 | Container Runtime | Docker + Kubernetes (not plain Docker Compose in prod) | 2026-07-27 |

**See also:** Each ADR in `docs/ArchitectureDecisionRecords/ADR-xxx-*.md`

---

## 4. Technology Choices & Rationale

### Why Django (over FastAPI-only, NestJS, .NET)

| Criterion | Django | FastAPI-only | NestJS | .NET Core |
|-----------|--------|-------------|--------|-----------|
| ORM (mature, migration-safe) | Yes — Django ORM | No — SQLAlchemy (good but more verbose) | TypeORM (less mature migrations) | Entity Framework (good but C# lock-in) |
| Admin interface | Django Admin out of box | Requires build | Requires build | Requires build |
| Ecosystem for SaaS | django-tenants, django-simple-history, django-guardian | Thin — many things from scratch | Growing — NestJS modules | Mature but .NET ecosystem |
| Background tasks | Celery integration mature | FastAPI + Celery/ARQ | Bull/BullMQ | Hangfire |
| Developer productivity | Very high for CRUD + business logic | High for APIs, low for admin | Medium | Medium-low |
| Learning curve for team | Medium | Low | Medium | High |
| Hiring pool | Large (Python) | Moderate | Large (JS/TS) | Moderate (C#) |

**Decision:** Django 5.x served with Gunicorn + Uvicorn (ASGI mode for real-time endpoints). The Django Admin alone saves months of development time for internal tooling, support dashboards, and tenant management. FastAPI is used as a sidecar for AI inference endpoints where async streaming matters.

### Why RabbitMQ (over Redis Streams as Celery Broker)

| Criterion | RabbitMQ | Redis Streams |
|-----------|----------|---------------|
| Message persistence | Disk-backed durable queues | AOF/RDB (best-effort without config tuning) |
| Routing flexibility | Topic exchanges, direct, headers, fanout | Single consumer group per stream |
| Dead-letter queue | Native DLX + per-queue TTL | Must build custom |
| Management UI | Built-in (RabbitMQ Management) | Third-party (RedisInsight) |
| Maturity for enterprise messaging | Very high — AMQP 0-9-1 standard | Medium — growing but less battle-tested for messaging |
| Monitoring | Queue depth, consumer lag, publish rates | Requires custom instrumentation |
| Failure recovery | Publisher confirms, consumer acknowledgements, automatic queue mirroring | Consumer groups with pending entry lists |

**Decision:** RabbitMQ as the Celery broker for guaranteed message delivery. Redis remains in use for all other roles: cache (with `allkeys-lru` eviction), rate limiter (sliding window counters), WebSocket channel layer (Django Channels), session store, and idempotency key storage. This is a clean separation of concerns — Redis serves in-memory fast-access purposes where data loss is acceptable on restart; RabbitMQ handles guaranteed delivery messaging where every event must be processed.

### Why Modular Monolith (over Microservices)

| Concern | Microservices | Modular Monolith | 
|---------|--------------|------------------|
| Team overhead at 5-person startup | Crushing (devops, service ownership, coordination) | Manageable |
| Debugging/observability | Requires distributed tracing stack from day 1 | Single process, pdb works |
| Deployment complexity | CI/CD matrix per service | Single deployable |
| Migration cost when scaling | Can extract modules later | Can extract modules later |
| Transactional integrity | Sagas, 2PC, eventual consistency hell | ACID within the monolith |
| Bounded context enforcement | Natural (network boundary) | Requires import-linter discipline |

**Decision:** Start as a strictly-enforced modular monolith with import-linter and domain events as the cross-module communication mechanism. Extract high-throughput or latency-critical contexts (AI Gateway, Workflow Engine, Search) into services only when profiling proves a bottleneck.

### Why PostgreSQL + RLS (over Schema-per-Tenant, DB-per-Tenant)

| Criterion | Shared Schema + RLS | Schema-per-Tenant | DB-per-Tenant |
|-----------|-------------------|-------------------|---------------|
| Operational cost at 1,000 tenants | Low — one schema, one migration | High — 1,000 schemas, 1,000 migrations | Very high — 1,000 databases |
| Isolation strength | Good (requires correct app + RLS) | Strong | Strongest |
| Migration simplicity | Runs once | Must run N times | Must run N times |
| Connection pooling efficiency | Excellent | Poor (many schemas, many connections) | Very poor |
| Cross-tenant analytics | Trivial | Moderate | Difficult |
| Compliance data residency | Needs escape hatch | Moderate | Easy |
| Fits 5-person team | Yes | Marginal | No |

**Decision:** Shared schema with PostgreSQL Row-Level Security as the default isolation mechanism. RLS policies are applied automatically via a migration that reads the `TenantScoped` marker interface from the Shared Kernel. Large enterprise tenants requiring dedicated infrastructure use a separate database instance (Silo model) — documented in the Multi-Tenancy Blueprint.

### Frontend Stack

| Technology | Purpose |
|-----------|---------|
| **React 18** | SPA framework with functional components and hooks |
| **Redux Toolkit** | State management with RTK Query for API data fetching and caching |
| **Material UI (MUI)** | Component library — consistent design system, responsive layout, theme support |
| **React Router v6** | Client-side routing with nested layouts, lazy loading, and route guards |
| **Axios** | HTTP client with interceptors for JWT injection, refresh token rotation, and error normalization |
| **TypeScript** | Type safety across the entire frontend codebase |
| **Vite** | Build tool — fast HMR development, optimized production builds |

### Infrastructure Stack

| Technology | Purpose |
|-----------|---------|
| **AWS (primary cloud provider)** | Compute (ECS/EKS), RDS (PostgreSQL), ElastiCache (Redis), MQ (RabbitMQ), S3 (file/backup storage), CloudFront (CDN), Route53 (DNS), ACM (TLS) |
| **Docker** | Containerization for local dev and CI/CD |
| **GitHub Actions** | CI/CD pipeline — lint, typecheck, test, build, deploy |
| **Nginx** | Reverse proxy, TLS termination, static file serving, rate limiting |
| **Terraform** | Infrastructure as Code — declarative AWS resource management |

---

## 5. Modular Monolith Strategy

### Module Isolation Contract

Every bounded context module lives in `backend/apps/<module_name>/` and follows this layout:

```
apps/lead_management/
├── domain/              # Entities, Value Objects, Domain Events, Aggregate Roots
│   ├── entities.py
│   ├── value_objects.py
│   ├── events.py
│   └── exceptions.py
├── application/         # Use cases, commands, queries, DTOs
│   ├── commands/
│   ├── queries/
│   ├── services/
│   └── dto.py
├── infrastructure/      # Django-specific implementations (ORM, repos, adapters)
│   ├── models.py
│   ├── repositories.py
│   ├── selectors.py
│   └── admin.py
├── api/                 # DRF views, serializers, urls, permissions
│   ├── views.py
│   ├── serializers.py
│   ├── permissions.py
│   ├── filters.py
│   ├── urls.py
│   └── tests/
├── adapters/            # Inbound/outbound port implementations
│   └── event_handlers.py
└── tests/               # Module-specific tests
    ├── test_domain.py
    ├── test_application.py
    └── test_api.py
```

### Enforcement

**import-linter** enforces that:
- `domain` may import only from `shared_kernel.domain`
- `application` may import only from `domain`, `shared_kernel`, and abstract interfaces
- `infrastructure` may import anything in the module + `shared_kernel`
- `api` may import from `application` and `infrastructure`
- No module may import from another module's `infrastructure` or `domain` directly
- Cross-module communication goes through `adapters/event_handlers.py` (event subscriptions) or the owning module's public API

### Shared Kernel Exception

`shared_kernel` is the sole exception to the sibling-isolation rule. Every module may import from it. In exchange:
- `shared_kernel` imports exactly zero Django packages
- `shared_kernel` contains no business logic — only structural primitives (Value Objects, base classes, interfaces)
- Changes to `shared_kernel` require the same rigor as public API changes

---

## 6. Coding Conventions & Standards

### Domain Layer (Zero Django Imports)

```python
# ✅ CORRECT — Pure Python, no Django dependency
class Email(ValueObject):
    def __init__(self, address: str):
        self._validate(address)
        self._normalized = address.lower().strip()

    def _validate(self, address: str) -> None:
        if not re.match(r'^[^@]+@[^@]+\.[^@]+$', address):
            raise ValidationError(f"Invalid email: {address}")

# ❌ WRONG — Domain should not depend on Django
from django.db import models  # NO
from django.core.validators import validate_email  # NO
```

### Service Layer Pattern

```python
# services.py — Application service
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

### View Layer (Thin, No Business Logic)

```python
# ✅ CORRECT
class LeadViewSet(viewsets.ModelViewSet):
    def perform_create(self, serializer):
        cmd = CreateLeadCommand(**serializer.validated_data, created_by=self.request.user)
        result = self.create_lead_service.execute(cmd)
        if result.is_failure:
            raise result.error
        return Response(result.value, status=201)
```

### Testing Conventions

- Every `domain` public method has unit tests (no Django dependency)
- Every `application` service has integration tests with real repositories
- Every API endpoint has contract tests (drf-spectacular for OpenAPI validation)
- Test file mirrors source file path: `test_<source_file>.py`
- Factory Boy for test data; never use fixtures for complex object graphs

---

## 7. Module Dependency Rules

### Allowed Dependency Graph

```
shared_kernel       ← Every module depends on shared_kernel
    ↑
identity           ← No upstream dependencies (foundation)
    ↑
organization       ← Depends on identity (users, orgs)
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
task               ← Depends on activity (can exist independently)
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

### Forbidden Dependencies (Enforced by import-linter)

- No module may import from another module's `infrastructure` layer
- No module may import from another module's `domain` layer directly (use events or API)
- No circular dependencies between modules
- `shared_kernel` may not import any module, including Django
- `audit` may not import domain models — it consumes events only

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
| Django Model Meta | Inner class | `class Meta:` |
| DB Table | snake_case (plural) | `leads`, `contact_accounts` |
| Serializer | PascalCase + Serializer | `LeadSerializer` |
| ViewSet | PascalCase + ViewSet | `LeadViewSet` |
| FilterSet | PascalCase + FilterSet | `LeadFilterSet` |
| Permission | PascalCase + Permission | `CanManageLeads` |
| Migration | auto-generated | `0001_initial.py` |
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

### Reconciliation Notes

**Why Python snake_case in URL paths?** — We use kebab-case (`/api/v1/leads/`) per REST convention. **Why camelCase in JSON?** — Industry standard for REST APIs; Django REST Framework's serializer handles the conversion transparently.

---

## 9. Event Naming & Contracts

### Event Name Convention

```
{Entity}{PastTenseVerb}
```

Examples: `LeadCreated`, `LeadAssigned`, `LeadConverted`, `ContactCreated`, `OpportunityWon`, `PipelineStageChanged`, `WorkflowExecuted`, `NotificationSent`, `ReportGenerated`, `ActivityLogged`, `TaskCompleted`, `IntegrationSynced`, `TenantProvisioned`, `UserInvited`, `OrganizationUpdated`.

### Event Contract Template

```python
@dataclass
class LeadCreated(DomainEvent):
    """Published when a new lead is created."""
    lead_id: UUID
    organization_id: UUID
    created_by: UUID
    source: str | None
    email: Email
    # All events carry: event_id (UUID), occurred_at (datetime)
```

### Publisher → Subscriber Map

| Event | Publisher | Subscribers |
|-------|-----------|-------------|
| LeadCreated | Lead Management | Workflow Engine, Search Index, Notification, Audit |
| LeadAssigned | Lead Management | Notification, Audit |
| LeadConverted | Lead Management | Contact Management, Notification, Audit |
| ContactCreated | Contact Management | Workflow Engine, Search Index, Audit |
| OpportunityWon | Opportunity Management | Workflow Engine, Notification, Reports, Audit |
| PipelineStageChanged | Pipeline Management | Workflow Engine, Audit |
| WorkflowExecuted | Workflow Engine | Audit |
| UserInvited | Identity | Notification, Audit |
| TenantProvisioned | Tenant | Organization Settings, Notification |

### Event Delivery Guarantees

- **At-least-once delivery** — Handlers must be idempotent
- **Retry policy:** 3 retries with exponential backoff (1s, 4s, 16s) then dead-letter queue
- **Monitoring:** Every event publish and consume is counted in metrics; dead-letter triggers PagerDuty alert
- **Event schema evolution:** Backward-compatible field additions only. Breaking changes require a new event version (e.g., `LeadCreatedV2`)

---

## 10. Folder Structure

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
│   │   ├── organization/          # Organization profiles
│   │   ├── rbac/                  # Roles, permissions, assignments
│   │   ├── tenant/                # Multi-tenant management, provisioning
│   │   ├── lead_management/       # Leads, sources, scoring
│   │   ├── contact_account/       # Contacts, accounts, relationships
│   │   ├── pipeline_management/   # Stages, probabilities, forecasts
│   │   ├── opportunity/           # Deals, amounts, competitors
│   │   ├── activity/              # Calls, emails, meetings (legacy)
│   │   ├── task/                  # Tasks, reminders
│   │   ├── calendar/              # Calendar sync, availability
│   │   ├── workflow/              # Workflow engine (triggers, conditions, actions)
│   │   ├── notification/          # Email, SMS, in-app, push
│   │   ├── dashboard/             # User dashboards, widgets
│   │   ├── reports/               # Report builder, aggregations
│   │   ├── ai/                    # AI gateway client, embeddings, prompts
│   │   ├── voice_ai/              # Voice AI integration
│   │   ├── integrations/          # Third-party connector framework
│   │   ├── settings/              # Tenant and user settings
│   │   ├── audit/                 # Event-sourced audit log
│   │   └── search/                # Search index management
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
│   ├── Dockerfile
│   └── pyproject.toml
├── frontend/                      # React SPA (Redux Toolkit, Material UI)
│   ├── src/
│   │   ├── components/         # Reusable UI components (MUI-based)
│   │   ├── features/           # Feature modules (leads, contacts, pipeline)
│   │   ├── store/              # Redux Toolkit store, slices, middleware
│   │   ├── services/           # Axios API client, interceptors, error handling
│   │   ├── hooks/              # Custom React hooks
│   │   ├── layouts/            # App shell, navigation, tenant layout
│   │   ├── pages/              # Route pages
│   │   ├── utils/              # Formatters, validators, constants
│   │   └── types/              # TypeScript type definitions
│   ├── package.json
│   ├── Dockerfile
│   └── tsconfig.json
├── mobile/                        # React Native (future)
├── infra/                         # Terraform, K8s manifests
│   ├── terraform/
│   └── kubernetes/
├── scripts/                       # DevOps, data migration, seed scripts
├── docs/                          # This documentation
│   ├── PROJECT_MEMORY.md
│   ├── IMPLEMENTATION_PLAN.md
│   ├── ARCHITECTURE_OVERVIEW.md
│   ├── ...
│   ├── ModuleBlueprints/
│   └── ArchitectureDecisionRecords/
├── .github/                       # CI/CD workflows
├── .gitignore
└── README.md
```

---

## 11. AI Architecture Decisions

### AI Gateway as a Sidecar

**Decision:** AI inference runs in a separate FastAPI service (`ai_gateway/`), not embedded in Django.

**Why:**
1. **Different scaling profile** — AI inference is GPU-bound and latency-sensitive. A long-running LLM inference blocks the Django event loop. Sidecar isolates the scaling concern.
2. **Streaming** — Server-Sent Events (SSE) for streaming LLM responses are natural in FastAPI ASGI; Django's WSGI heritage makes streaming awkward.
3. **Security** — The AI gateway can be network-isolated, with authentication via short-lived tokens from the main app. An LLM prompt injection in the sidecar cannot reach the CRM database directly.
4. **Language flexibility** — The sidecar could be rewritten in a different language (e.g., Rust for tokenization) without affecting the CRM.

### AI Stack Overview

| Component | Technology | Purpose |
|-----------|-----------|---------|
| LLM Provider | OpenAI (GPT-4o, GPT-4o-mini) + Anthropic (Claude) | Primary and fallback LLM for generation and reasoning |
| Framework | LangChain | Chain composition, tool-calling abstraction, agent orchestration, retriever integration |
| Vector Store | PostgreSQL + pgvector | Operational simplicity, tenant-scoped RLS on vectors, ACID compliance |
| Embeddings | OpenAI `text-embedding-3-small` | Default embedding provider with abstraction layer for switching |
| Semantic Search | Hybrid (pgvector cosine + PostgreSQL FTS) | Weighted ranking combining vector similarity and keyword relevance |
| Prompt Management | Database-backed versioned templates | Immutable prompt versions, A/B testing, prompt registry API |
| RAG Pipeline | LangChain + pgvector + MinIO | Document ingestion, chunking, embedding, retrieval-augmented generation |
| MCP Server | FastAPI + LangChain MCP adapter | Model Context Protocol for standardized tool exposure |
| Tool Execution | LangChain tool-calling | Structured tool definitions, parameter validation, execution sandbox |
| Caching | Redis | LLM response cache, embedding cache, frequent query cache |
| Voice AI | Deepgram / Whisper for ASR, ElevenLabs / OpenAI TTS | Speech-to-text and text-to-speech for voice features |
| Monitoring | OpenTelemetry + LangSmith or LangFuse | LLM call tracing, token accounting, cost attribution, latency tracking |

### LangChain Integration Pattern

LangChain is used as the orchestration layer, not as a hard dependency throughout the stack:

```python
# ai_gateway/app/services/chain_service.py

from langchain_openai import ChatOpenAI
from langchain.agents import AgentExecutor, create_openai_functions_agent
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.tools import tool

class CRMChainService:
    """
    LangChain orchestration for CRM AI features.
    
    Design rationale:
    - LangChain is isolated to the AI Gateway service only — the Django monolith
      never imports LangChain directly.
    - Chains are stateless and tenant-scoped (org_id passed in context).
    - Tool definitions are generated dynamically from the CRM's tool registry.
    """

    def __init__(self, llm_provider: str = "openai"):
        self.llm = ChatOpenAI(model="gpt-4o", temperature=0.1)
        self.prompt_registry = PromptRegistry()

    def create_agent(self, org_id: str, tools: list[CRM Tool]) -> AgentExecutor:
        """Create a tenant-scoped agent with CRM-specific tools."""
        prompt = self.prompt_registry.get_agent_prompt(org_id)
        langchain_tools = [self._to_langchain_tool(t) for t in tools]
        agent = create_openai_functions_agent(self.llm, langchain_tools, prompt)
        return AgentExecutor(
            agent=agent,
            tools=langchain_tools,
            handle_parsing_errors=True,
            max_iterations=5,
            early_stopping_method="force",
        )

    def _to_langchain_tool(self, crm_tool: CRMTool) -> Tool:
        """Convert a CRM tool definition to a LangChain tool."""
        return tool(crm_tool.name, crm_tool.description)(crm_tool.execute)
```

### Model Context Protocol (MCP) Architecture

MCP standardizes how CRM tools and data sources are exposed to AI models. Rather than each AI feature building its own tool-calling mechanism, the MCP server provides a unified interface:

```
                    ┌─────────────────────────────┐
                    │    AI Gateway (FastAPI)       │
                    │                              │
  LLM ◄────────────►│  MCP Server                  │
  (OpenAI/Claude)    │  ┌───────────────────────┐  │
                    │  │  Tool Registry          │  │
                    │  │  • search_contacts()    │  │
                    │  │  • get_lead()          │  │
                    │  │  • create_opportunity() │  │
                    │  │  • get_pipeline_stage() │  │
                    │  │  • send_email()        │  │
                    │  │  • schedule_meeting()  │  │
                    │  └───────────────────────┘  │
                    │  ┌───────────────────────┐  │
                    │  │  Resource Providers    │  │
                    │  │  • crm://leads/{id}   │  │
                    │  │  • crm://contacts/    │  │
                    │  │  • crm://opportunities│  │
                    │  │  • crm://reports/     │  │
                    │  └───────────────────────┘  │
                    │  ┌───────────────────────┐  │
                    │  │  Prompt Templates      │  │
                    │  │  • lead-scoring        │  │
                    │  │  • next-best-action    │  │
                    │  │  • conversation-summary│  │
                    │  └───────────────────────┘  │
                    └─────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────────────────┐
                    │    Django Monolith           │
                    │  (Tool execution via API)   │
                    └─────────────────────────────┘
```

MCP enables:
1. **Standardized tool discovery** — AI models discover available tools at runtime via the MCP protocol
2. **Tenant-scoped resources** — All resource URIs include `org_id`, enforced by the gateway
3. **Prompt templates as resources** — Scoring, summarization, and analysis prompts are versioned MCP resources
4. **Future-proofing** — Any MCP-compatible client (custom UI, VS Code extension, Slack bot) can interact with the same tool set

### Tool Calling Architecture

Tools are first-class definitions stored in the database, not hardcoded in code:

```python
# ai_gateway/app/domain/tools.py

@dataclass
class CRMTool:
    """A callable tool that the AI can invoke on behalf of a user."""
    name: str                    # e.g., "search_contacts"
    description: str             # LLM-facing description for tool selection
    parameters: JSONSchema       # JSON Schema for parameter validation
    required_ permission: str    # Permission check: e.g., "contact.read"
    execution_url: str           # Internal API endpoint to execute
    cache_ttl_seconds: int       # Cache duration for repeat calls
    timeout_seconds: int         # Max execution time
    is_idempotent: bool          # Safe to retry on failure?

class ToolRegistry:
    """
    Registry of tools available to AI agents.
    
    Tools can be:
    - Built-in (CRM operations: search, create, update)
    - Custom (user-defined via workflow engine actions)
    - Integration (third-party: Send email, create Slack message)
    """

    def get_tools_for_agent(self, org_id: str, agent_type: str) -> list[CRMTool]:
        """Return tools available for a given agent type in an org."""
        # Agents: LeadScoringAgent, NextBestActionAgent, SalesCoachAgent, etc.
```

**Tool execution flow:**
1. LLM decides to call `search_contacts(query="Acme Corp")`
2. MCP server receives the tool call, validates parameters against JSON Schema
3. Gateway checks permission: does the user have `contact.read`?
4. Gateway calls internal API (`/api/v1/contacts/?search=Acme Corp`) with user's JWT
5. Result is returned to LLM for response generation
6. Full tool call (input, output, latency, tokens) is logged for audit and cost tracking

### Embedding Strategy

- **Vector storage:** PostgreSQL + pgvector extension (not Pinecone/Weaviate). Rationale: operational simplicity — no additional service to manage, RLS applies naturally to vector searches, and ACID compliance for embedding data.
- **Embedding model:** `text-embedding-3-small` (OpenAI) as default, with model abstraction layer for provider switching.
- **Semantic search:** Hybrid search (pgvector cosine similarity + PostgreSQL full-text search with weighted ranking).

### Prompt Management

- Prompts are versioned templates stored in the database (not hardcoded)
- Each prompt template has: `prompt_id`, `version`, `template_string`, `model`, `parameters`, `created_by`
- Prompt versions are immutable once used — new versions create new rows
- All LLM calls are logged with: `prompt_id`, `version`, `input_tokens`, `output_tokens`, `latency_ms`, `response_preview`, `user_id`, `organization_id`

### RAG Architecture

- Documents are stored in MinIO, chunked, embedded, and indexed in pgvector
- Retrieval is tenant-scoped (RLS on the vector store via `organization_id` column)
- Chunk strategy: RecursiveCharacterTextSplitter with 512-token chunks, 128-token overlap
- Hybrid retrieval: vector similarity (cosine) weighted 0.7 + keyword (BM25 via pg_trgm) weighted 0.3
- Re-ranking: Cross-encoder re-ranker on top-20 results for precision (Cohere or BAAI/bge-reranker-v2)

---

## 12. Multi-Tenancy Decisions

### Isolation Model: Pool + Silo Escape Hatch

- **Default:** Shared schema + PostgreSQL RLS (Pool model)
- **Enterprise/Compliance escape:** Dedicated database instance (Silo model), documented in the Tenant Blueprint
- **Migration path:** Pool → Silo is a mechanical process because every tenant-scoped table has a consistent `organization_id` column

### RLS Policy Template

```sql
CREATE POLICY tenant_isolation_{table_name} ON {schema}.{table_name}
    USING (organization_id = current_setting('app.current_organization_id')::uuid);
```

- `app.current_organization_id` is set by middleware on every authenticated request
- Celery tasks propagate tenant context via task-local storage
- AI Gateway receives tenant context via JWT claims

### Tenant Resolution Chain

1. **Request** → JWT contains `organization_id` and `user_id`
2. **Middleware** validates JWT, resolves tenant, sets `current_organization_id` in PostgreSQL session
3. **RLS** transparently filters all queries
4. **Event publishing** enriches all events with `organization_id`
5. **Celery handler** restores `current_organization_id` before processing events

### Critical Failure Scenario

If RLS is ever bypassed (e.g., raw SQL in a migration, an API view using `Model.objects.all()` without going through a tenant-scoped repository), cross-tenant data leak is the result. Mitigation:
- Automated test suite that creates two tenants and asserts no cross-tenant data access via any API endpoint
- `SELECT current_setting('app.current_organization_id') IS NOT NULL` check in every Celery task handler
- Migration review checklist: every migration must verify RLS policies exist for new tables

---

## 13. API Standards

### Versioning

- URL-based versioning: `/api/v1/`, `/api/v2/`
- Version is part of the URL, not a header (easier for third-party integrators, caching, and debugging)
- Backward-compatible changes (new fields, new endpoints) don't require a version bump
- Breaking changes (field removal, behavior change) require a new version
- Each version maps to a Django URL configuration that imports versioned viewsets

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

- Tiered by subscription plan:
  - Free: 100 req/min
  - Growth: 1,000 req/min
  - Enterprise: 10,000 req/min (configurable)
- Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- Rate limit violation returns `429 Too Many Requests`

### Idempotency

- POST requests accept an optional `Idempotency-Key` header (UUID v4)
- Key stored in Redis with TTL of 24 hours
- Duplicate key returns cached response with `200 OK` (not 201)
- Critical for payment, lead creation, and integration sync endpoints

---

## 14. Common Mistakes to Avoid

| # | Mistake | Consequence | Prevention |
|---|---------|-------------|------------|
| 1 | Putting business logic in views | Untestable, duplicated logic | All logic in application services |
| 2 | Importing Django in domain layer | Locks domain to Django forever | import-linter enforcement |
| 3 | Cross-module direct imports | Tight coupling, violates bounded contexts | Use events or public API only |
| 4 | Skipping RLS on a new table | Cross-tenant data leak | Automated migration checks |
| 5 | Using auto-increment IDs | Multi-region write conflicts | UUID v7 from day 1 |
| 6 | Not idempotent event handlers | Duplicate processing on retry | Idempotency keys in event handlers |
| 7 | Hardcoding prompts in code | Ops nightmare for prompt tuning | Database-backed prompt templates |
| 8 | Not setting timeouts on external calls | Cascading failures | Circuit breakers + timeouts |
| 9 | Mixing tenant and non-tenant data | RLS bypass, data leak | Repository layer always scopes by org_id |
| 10 | No audit for critical mutations | Compliance failure, impossible debugging | Domain events + audit module |
| 11 | Synchronous cross-context calls | Latency cascade, tight coupling | Domain events + async handlers |
| 12 | Sharing DB connections across tenants | Connection pool exhaustion | Pgbouncer + connection pooling per pool |
| 13 | Not testing RLS in CI | Regression introduces data leak | Every test run includes RLS validation |
| 14 | Ignoring Celery worker concurrency | Task pile-up, OOM, retry storms | Named queues, rate limits, concurrency control |
| 15 | No structured logging | Impossible to debug in production | JSON logging + OpenTelemetry from day 1 |

---

## 15. Current Implementation Status

```
Phase 0 — Foundation
├── Repository setup          ❌ Not started
├── CI/CD pipeline            ❌ Not started
├── Docker configuration      ❌ Not started
├── Coding standards doc      ✅ Complete (this document)
└── Project memory            ✅ Complete (this document)

Phase 1 — Core Framework
├── Shared Kernel             ❌ Not started
├── Identity module           ❌ Not started
├── Organization module       ❌ Not started
├── RBAC module               ❌ Not started
└── Architecture decisions    ✅ Complete (ADRs written)

Phase 2 — Multi-Tenancy
├── Tenant module             ❌ Not started
├── RLS migration tools       ❌ Not started
├── Middleware                 ❌ Not started
└── Tenant isolation tests    ❌ Not started

Phase 3+ — Business Modules   ❌ Not started
```

---

## 16. Pending Tasks

**Immediate (documentation phase):**
- [x] Write `PROJECT_MEMORY.md` — living source of truth
- [x] Write `IMPLEMENTATION_PLAN.md` — phased engineering roadmap
- [x] Write `ARCHITECTURE_OVERVIEW.md` — high-level platform architecture
- [x] Write Identity & Multi-Tenancy Module Blueprint
- [ ] Write ADR documents for each key decision (ADR-001 through ADR-015)

**Next (Phase 0 — Engineering setup):**
- [ ] Initialize Django project with modular structure
- [ ] Configure Poetry, pyproject.toml, and dependency management
- [ ] Set up Docker Compose (Django, PostgreSQL, Redis, RabbitMQ, Celery, MinIO)
- [ ] Configure import-linter with all dependency rules
- [ ] Set up pre-commit hooks (ruff, mypy, import-linter)
- [ ] Create CI/CD GitHub Actions workflow
- [ ] Configure pytest, pytest-django, factory-boy, coverage
- [ ] Write first test (shared kernel base class tests)
- [ ] Set up OpenTelemetry instrumentation stubs

**Phase 1:**
- [ ] Implement `shared_kernel` domain primitives
- [ ] Implement Identity module (User, JWT, registration)
- [ ] Implement Organization module
- [ ] Implement RBAC module
- [ ] Implement Tenant module with RLS infrastructure

---

## 17. Future Roadmap

### R1 — MVP (Months 1–6)
- Complete identity, RBAC, tenant, organization
- Lead management (CRUD + import + scoring)
- Contact & account management
- Pipeline & opportunity management
- Activity logging
- Task management
- Basic workflow (stage transitions, assignment rules)
- Email notification
- Simple dashboards
- REST API v1

### R2 — Growth (Months 7–12)
- Advanced workflow engine (conditions, delays, branching)
- Report builder
- Calendar integration (Google, Outlook)
- File attachments (MinIO)
- Full-text search
- Integration Hub (REST connector framework)
- Mobile API
- SOC 2 Type II readiness
- GDPR compliance tooling

### R3 — Scale (Months 13–18)
- AI Assistant (lead scoring, next-best-action, sentiment)
- Email sync (IMAP/SMTP)
- Voice AI (call logging, transcription, analysis)
- K8s production deployment
- Multi-region active-active reads
- Performance optimization at 1,000+ orgs
- Webhook delivery system

### R4 — Enterprise (Months 19–24)
- 50+ integrations
- Enterprise SSO (SAML, OIDC)
- Advanced RBAC (field-level permissions)
- Data residency (Silo model)
- Custom objects (build your own module)
- Billing & subscription management
- Marketplace

---

> **This document is the single source of truth for the TZAHU CRM project.**
> Every architectural decision, convention, and rule recorded here is binding unless
> superseded by a new ADR. If something is not documented here, it does not exist.
