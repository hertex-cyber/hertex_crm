# TZAHU CRM — Architecture Overview

> **Version:** 0.1.0-draft
> **Last Updated:** 2026-07-27
> **Status:** Foundational Design Phase
> **Owner:** Platform Architecture Team

---

## Table of Contents

1. [Tech Stack](#1-tech-stack)
2. [Architecture Principles](#2-architecture-principles)
3. [Quality Attribute Trade-Offs](#3-quality-attribute-trade-offs)
4. [System Context](#4-system-context)
5. [Container Diagram](#5-container-diagram)
6. [Component Architecture](#6-component-architecture)
7. [Layered Architecture per Module](#7-layered-architecture-per-module)
8. [Data Architecture](#8-data-architecture)
9. [Integration Architecture](#9-integration-architecture)
10. [Security Architecture](#10-security-architecture)
11. [Observability Architecture](#11-observability-architecture)
12. [Deployment Architecture](#12-deployment-architecture)
13. [Evolution Strategy](#13-evolution-strategy)

---

## 1. Tech Stack

### Backend

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Runtime | Python | 3.13 | Application runtime |
| Web Framework | Django | 5.x | Core web framework |
| REST API | Django REST Framework (DRF) | 3.x | REST API layer |
| API Schema | drf-spectacular | Latest | OpenAPI 3.0 schema generation |
| ASGI | Django Channels + Uvicorn | Latest | WebSocket support |
| WSGI | Gunicorn | Latest | Production WSGI server |
| Database ORM | Django ORM | 5.x | Database abstraction |
| Task Queue | Celery | 5.x | Background task processing |
| Message Broker | RabbitMQ | 3.13+ | Celery broker + event bus (AMQP 0-9-1) |
| Cache / Rate Limiter | Redis | 7.x | Cache, rate limiter, session store, channel layer |
| Vector DB | pgvector | 0.7+ | Vector embeddings on PostgreSQL |
| Connection Pooling | Pgbouncer | Latest | PostgreSQL connection pooling |
| File Storage | MinIO | Latest | S3-compatible object storage |

### AI Gateway (Sidecar)

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Runtime | Python | 3.13 | Application runtime |
| Web Framework | FastAPI | Latest | Async API for AI features |
| LLM Framework | LangChain | Latest | LLM orchestration, tool-calling, agent framework |
| LLM Provider | OpenAI (GPT-4o) | Latest | Primary LLM provider |
| LLM Provider | Anthropic (Claude) | Latest | Secondary LLM provider |
| Tool Protocol | MCP (Model Context Protocol) | Latest | Standardized AI tool exposure |
| Vector Store | pgvector | 0.7+ | Embedding storage + similarity search |

### Frontend

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Runtime | Node.js | 22.x | JavaScript runtime |
| Language | TypeScript | 5.x | Type safety |
| Framework | React | 19.x | UI component library |
| Build Tool | Vite | 6.x | Fast dev server + build |
| Component Library | MUI (Material UI) | 6.x | Design system + components |
| Server State | TanStack Query | 5.x | Server state management |
| Client State | Zustand | 5.x | Lightweight client state |
| Routing | React Router | 7.x | Client-side routing |
| HTTP Client | axios / TanStack Query | Latest | API communication |
| Forms | React Hook Form + Zod | Latest | Form validation |
| Testing | Vitest + Testing Library | Latest | Unit + integration tests |
| E2E Tests | Playwright | Latest | End-to-end browser tests |

### Infra & DevOps

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Container Runtime | Docker | Latest | Container packaging |
| Orchestration | Kubernetes | 1.30+ | Container orchestration |
| CI/CD | GitHub Actions | N/A | Build, test, deploy pipeline |
| Cloud Provider | AWS | N/A | Primary cloud infrastructure |
| Monitoring | Prometheus + Grafana | Latest | Metrics collection + dashboards |
| Tracing | OpenTelemetry | Latest | Distributed tracing |
| Logging | structlog | Latest | Structured JSON logging |
| CDN | CloudFront / Cloudflare | N/A | Static asset delivery |
| DNS | Route53 / Cloudflare | N/A | Domain management |

### Observability Stack

| Tool | Purpose |
|------|---------|
| Prometheus | Metrics collection and alerting |
| Grafana | Dashboards and visualization |
| OpenTelemetry | Distributed tracing |
| structlog | Structured JSON logging |
| Flower | Celery task monitoring |
| RabbitMQ Management UI | Queue monitoring |
| pg_stat_statements | Query performance analysis |

---

## 2. Architecture Principles

### 2.1 Isolation by Default, Sharing by Contract

Each bounded context owns its data and logic. Cross-context communication requires an explicit contract — either a domain event (async) or a defined API (sync). No module may directly import another module's domain models, query another module's database tables, or modify another module's state without going through the contract.

**Violation Consequence:** Non-local changes cascade across modules; team coordination overhead increases with team size. A change in the Lead model breaks the Opportunity module because they shared a database table.

### 2.2 Ports and Adapters (Hexagonal Architecture)

Domain logic depends on abstractions (ports), never on concrete implementations. Infrastructure implements those abstractions (adapters). The domain layer has zero imports from Django, DRF, or any framework. This ensures domain logic is testable in isolation — unit tests run in milliseconds without a database.

**Violation Consequence:** Domain logic is coupled to framework specifics; testing requires heavyweight infrastructure (database, Redis, etc.); framework migrations become painful.

### 2.3 Event-Driven Communication Between Modules

Modules communicate via domain events, not direct synchronous calls. A service method collects domain events from aggregates and publishes them via the EventPublisher port. The publisher emits to RabbitMQ (async) or in-process signal (sync, same-transaction). Subscribers live in the subscribing module's infrastructure layer.

**Violation Consequence:** Synchronous cross-module calls create latent coupling; a change in one module's internal flow breaks another module at runtime.

### 2.4 Tenant Isolation at the Database Layer

PostgreSQL Row-Level Security (RLS) ensures that even if application code has a bug — a misplaced `.all()`, a missing `filter(organization_id=...)`, a raw SQL query — the database itself prevents cross-tenant data leaks. RLS is the last line of defense, not the first. The application still scopes all queries, but RLS guarantees isolation when application code fails.

**Violation Consequence:** A single misplaced `.all()` leaks every tenant's data. Without RLS, this is a data breach; with RLS, it's a performance bug (the query returns empty set for the wrong tenant).

### 2.5 Observability as a Feature

Every request, background job, domain event, and external API call is traced, logged, and metered by default. Logs are structured JSON with correlation IDs. Metrics follow the RED method (Rate, Errors, Duration). Traces propagate across service boundaries via W3C Trace Context.

**Violation Consequence:** Debugging production issues becomes guesswork; SLA breaches go undetected; root cause analysis takes hours instead of minutes.

### 2.6 Synchronous for Queries, Asynchronous for Commands

Read operations return immediately via the request-response cycle. Write operations that trigger side effects — notifications, workflow execution, integration sync — do so via domain events and background workers. The user gets a 202 Accepted response and the side effects happen asynchronously.

**Violation Consequence:** Complex write paths hold database connections while waiting for email sending to complete; user-facing latency increases; request queue backs up.

### 2.7 Testability Determines Structure

If a component is hard to test, restructure it. The layered architecture (domain → application → infrastructure → API) is designed so that each layer is independently testable: domain tests need no database, application tests mock the repository port, infrastructure tests use a test database, API tests use DRF's test client.

**Violation Consequence:** Untested code becomes legacy on the day it's merged. Bugs are discovered in production instead of CI.

### 2.8 Convention over Configuration

Module layout, naming conventions, file organization, and design patterns are standardized across all bounded contexts. Every module has the same internal structure: `domain/`, `application/`, `infrastructure/`, `api/`, `adapters/`, `tests/`. Every aggregate follows the same pattern. Every API endpoint follows the same naming.

**Violation Consequence:** Each module reinvents the wheel; onboarding takes weeks instead of days; code reviews catch style issues instead of logic bugs.

---

## 3. Quality Attribute Trade-Offs

### 3.1 Security vs. Developer Velocity

| Trade-Off | Choice | Rationale |
|-----------|--------|-----------|
| RLS on every query | Enforced at DB layer | Prevents data leaks even if application code has bugs. Cost: ~5% query overhead for `current_setting()` lookup. |
| Short-lived JWT (15 min) | Enforced | Limits blast radius of token theft. Cost: more refresh requests; slightly higher auth server load. |
| Forced RLS on table owner | Enforced | Celery workers run as table owner; without FORCE RLS, RLS is bypassed for background tasks. Cost: all queries must set session variable. |

### 3.2 Performance vs. Isolation

| Trade-Off | Choice | Rationale |
|-----------|--------|-----------|
| Shared PostgreSQL schema (Pool) | Default model | Single schema is simpler to operate, migrate, and monitor. Cost: noisier neighbor problem; one tenant's heavy query affects all. |
| Dedicated database per tenant (Silo) | Phase 11 migration path | Available when a tenant outgrows the pool or needs data residency. Cost: operational complexity; cross-tenant queries require federation. |
| UUID v7 primary keys | All tables | Conflict-free multi-region generation. Cost: 16 bytes vs 4 bytes (int); 10-15% slower JOIN performance vs auto-increment. |

### 3.3 Consistency vs. Availability

| Trade-Off | Choice | Rationale |
|-----------|--------|-----------|
| Domain events: at-least-once delivery | RabbitMQ with confirms | Guarantees no event is lost. Cost: duplicate events possible (idempotency required in handlers). |
| Read replicas for reporting | Phase 11 | Eventually consistent reads for reports. Cost: replication lag (up to 50ms) means report may not reflect latest write. |
| Workflow execution: best-effort within timeout | 30s timeout with retry | Prevents runaway workflows. Cost: complex workflows may timeout and need manual retry. |

### 3.4 Modularity vs. Simplicity

| Trade-Off | Choice | Rationale |
|-----------|--------|-----------|
| Modular monolith (not microservices) | Phase 1-10 | Simpler deployment, debugging, and development. Cost: module boundaries are logical, not physical — a bad dependency can still be introduced. |
| Domain events, not direct imports | Cross-module communication | Decouples modules at compile time. Cost: event schemas must be versioned; debugging async flows is harder than sync. |
| import-linter enforced in CI | All modules | Prevents dependency violations at merge time. Cost: occasional refactoring when a dependency is needed but not allowed. |

### 3.5 AI Integration

| Trade-Off | Choice | Rationale |
|-----------|--------|-----------|
| Separate AI Gateway (FastAPI) | Dedicated service | Isolates LLM latency; independent scaling; network isolation for prompt injection. Cost: service-to-service latency; additional deployment complexity. |
| pgvector for embeddings (no Elasticsearch) | PostgreSQL extension | Avoids additional infrastructure; RLS applies to vectors automatically. Cost: pgvector is less performant than dedicated vector DBs at >10M vectors. |
| MCP for tool exposure | Standard protocol | Allows any MCP-compatible client to discover and invoke CRM tools. Cost: protocol overhead; additional abstraction layer. |

---

## 4. System Context

### 4.1 System Context Diagram (C4 Level 1)

```
                          ┌─────────────────────────────────────────────┐
                          │              TZAHU CRM SYSTEM               │
                          │                                             │
                          │  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
                          │  │ Web App  │  │ Mobile   │  │ Public   │  │
                          │  │ (React)  │  │ (React   │  │ API      │  │
                          │  │          │  │  Native) │  │          │  │
                          │  └────┬─────┘  └────┬─────┘  └────┬─────┘  │
                          │       │              │              │        │
                          │       └──────────────┴──────────────┘        │
                          │                      │                       │
                          │                      ▼                       │
                          │  ┌──────────────────────────────────────┐    │
                          │  │          CRM Backend (Django)         │    │
                          │  │  + AI Gateway (FastAPI)              │    │
                          │  └──────────────────────────────────────┘    │
                          │                      │                       │
                          │         ┌────────────┼────────────┐         │
                          │         ▼            ▼            ▼         │
                          │  ┌──────────┐ ┌──────────┐ ┌──────────┐    │
                          │  │PostgreSQL│ │  Redis   │ │ RabbitMQ │    │
                          │  │ +pgvector│ │          │ │          │    │
                          │  └──────────┘ └──────────┘ └──────────┘    │
                          │         │                                    │
                          │         ▼                                    │
                          │  ┌──────────────────────────────────┐       │
                          │  │ External Systems: SendGrid,      │       │
                          │  │ Twilio, OpenAI, Google, Slack,   │       │
                          │  │ Microsoft, HubSpot, Zoom, etc.   │       │
                          │  └──────────────────────────────────┘       │
                          └─────────────────────────────────────────────┘
```

### 4.2 Actors

| Actor | Description | Interaction Pattern |
|-------|-------------|-------------------|
| **Sales Rep** | Primary user — manages leads, contacts, opportunities, tasks | Web App + Mobile App |
| **Sales Manager** | Pipeline oversight, forecast management, team coaching | Web App |
| **Admin** | Org configuration, user management, workflow setup, integrations | Web App (Admin UI) |
| **System Admin** | TZAHU platform management, tenant provisioning | Admin Console |
| **API Client** | Third-party integration, custom app | REST API |
| **External System** | Google, Microsoft, Slack, Twilio, SendGrid, etc. | REST API + Webhooks |
| **Anonymous User** | Lead form submitter, public knowledge base | Public API |

### 4.3 External Systems

| System | Purpose | Integration Pattern |
|--------|---------|-------------------|
| PostgreSQL 16 + pgvector | Primary database, vector store | Native TCP via Pgbouncer |
| Redis 7 | Cache, rate limiter, WebSocket channel layer, session store | Native TCP |
| RabbitMQ 3.13+ | Celery broker, domain event bus | AMQP 0-9-1 |
| MinIO | File storage (S3-compatible) | S3 API |
| Celery Workers | Async task execution | RabbitMQ broker consumer |
| AI Gateway (FastAPI) | LLM proxy, embedding, RAG | HTTP (internal) |
| SendGrid / AWS SES | Transactional email | SMTP / HTTPS API |
| Twilio | SMS, Voice | REST API |
| OpenAI / Anthropic | LLM APIs | HTTPS (external) |
| Google / Microsoft | Calendar, Contacts, SSO | OAuth 2.0 + REST API |
| Slack | Notifications, workflow triggers | Webhook + REST API |

---

## 5. Container Diagram

### 5.1 Container Diagram (C4 Level 2)

```
┌──────────────────────────────────────────────────────────────────────┐
│                          Load Balancer                                 │
│                       (AWS ALB / nginx)                                │
└──────────────────────────────┬───────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                          Django Application                           │
│                               │                                       │
│              ┌────────────────┼────────────────┐                      │
│              ▼                ▼                ▼                      │
│  ┌────────────────────┐ ┌────────────┐ ┌──────────────┐              │
│  │  Gunicorn (WSGI)   │ │  Uvicorn   │ │ Celery Beat  │              │
│  │  REST API          │ │  (ASGI)    │ │ Scheduler    │              │
│  │  Admin Interface   │ │ WebSocket  │ │              │              │
│  └────────┬───────────┘ └────────────┘ └──────────────┘              │
│           │                                                           │
│  ┌────────┴──────────────────────────────────────────────────────┐   │
│  │                    Middleware Stack                            │   │
│  │  CORS → Security → Auth (JWT) → Tenant (RLS) → Log → Rate    │   │
│  └───────────────────────────────────────────────────────────────┘   │
│           │                                                           │
│  ┌────────┴──────────────────────────────────────────────────────┐   │
│  │                    URL Router                                  │   │
│  │  /auth/*  /api/v1/*  /admin/*  /ws/*  /health/*               │   │
│  └───────────────────────────────────────────────────────────────┘   │
│           │                                                           │
│  ┌────────┴──────────────────────────────────────────────────────┐   │
│  │                    Module Viewsets (DRF)                       │   │
│  │  LeadViewSet  ContactViewSet  OpportunityViewSet  TaskViewSet │   │
│  └───────────────────────────────────────────────────────────────┘   │
│           │                                                           │
│  ┌────────┴──────────────────────────────────────────────────────┐   │
│  │                 Application Service Layer                      │   │
│  │  LeadService  ContactService  WorkflowService  NotificationSvc │   │
│  └───────────────────────────────────────────────────────────────┘   │
│           │                                                           │
│  ┌────────┴──────────────────────────────────────────────────────┐   │
│  │                     Domain Layer                               │   │
│  │  Entities  Value Objects  Domain Events  Aggregates           │   │
│  └───────────────────────────────────────────────────────────────┘   │
│           │                                                           │
│  ┌────────┴──────────────────────────────────────────────────────┐   │
│  │                 Infrastructure Layer                           │   │
│  │  Repositories  Selectors  ORM Models  Event Bus  Migrations   │   │
│  └───────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────┬────────────────────────────────┘
                                       │
         ┌─────────────────────────────┼─────────────────────────────┐
         ▼                             ▼                             ▼
┌───────────────────┐    ┌───────────────────┐    ┌─────────────────────┐
│   PostgreSQL 16   │    │     Redis 7        │    │    RabbitMQ 3.13    │
│   + pgvector      │    │  Cache / Rate     │    │  Celery Broker      │
│   + RLS           │    │  Limiter / WS     │    │  Domain Event Bus   │
│   + pg_trgm       │    │  Sessions         │    │  DLX + HA Queues    │
└───────────────────┘    └───────────────────┘    └──────────┬──────────┘
                                                              │
                                                              ▼
                              ┌───────────────────────────────────────────┐
                              │          Celery Workers (K8s Pods)         │
                              │                                           │
                              │  ┌──────────┐ ┌──────────┐ ┌──────────┐  │
                              │  │ Workflow │ │ Notify   │ │ Reports  │  │
                              │  │ Queue    │ │ Queue    │ │ Queue    │  │
                              │  └──────────┘ └──────────┘ └──────────┘  │
                              │  ┌──────────┐ ┌──────────┐ ┌──────────┐  │
                              │  │Integratio│ │ Imports  │ │ Default  │  │
                              │  │ Queue    │ │ Queue    │ │ Queue    │  │
                              │  └──────────┘ └──────────┘ └──────────┘  │
                              └───────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                      AI Gateway (FastAPI Sidecar)                     │
│                                                                       │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐     │
│  │ LLM Proxy  │  │ Embedding  │  │ RAG        │  │ MCP        │     │
│  │ OpenAI/    │  │ Pipeline   │  │ Retriever  │  │ Server     │     │
│  │ Anthropic  │  │            │  │            │  │            │     │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘     │
│                                                                       │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                     │
│  │ Semantic   │  │ Sentiment  │  │ Prompt     │                     │
│  │ Search     │  │ Analysis   │  │ Templates  │                     │
│  └────────────┘  └────────────┘  └────────────┘                     │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                           MinIO (S3)                                  │
│                    File / Avatar / Attachment Storage                  │
│              /media/{org_id}/{entity_type}/{id}/{filename}           │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 6. Component Architecture

### 6.1 Django Application Server

**Role:** Serves REST API, Admin interface, and WebSocket connections.

**Components:**
- **Gunicorn** (WSGI) for synchronous API requests — 4-8 workers per pod
- **Uvicorn** (ASGI) workers for WebSocket connections (Django Channels)
- **Middleware stack:** CORS → Security → Auth (JWT) → Tenant (RLS) → Request Logging → Rate Limit
- **Health Check Endpoint:** `GET /health/` — DB, Redis, RabbitMQ, Celery, migration status

**Scaling:** Horizontal via K8s HPA based on CPU > 70% or p95 latency > 500ms. Stateless — session state in Redis.

### 6.2 PostgreSQL Database

**Role:** Primary data store. Relational data + vector embeddings (pgvector).

**Configuration:**
- PostgreSQL 16 with `pgvector`, `pg_trgm`, `uuid-ossp` extensions
- Pgbouncer for connection pooling (transaction mode) — max 50 DB connections for 1000 concurrent requests
- Read replicas for reporting and analytics queries (Phase 11)
- WAL archiving for point-in-time recovery (RPO < 5 minutes)

**Tenant Isolation:** RLS enforced via `app.current_organization_id` session variable. Every tenant-scoped table has `FORCE ROW LEVEL SECURITY` applied.

### 6.3 RabbitMQ (Message Broker)

**Role:** Celery broker, domain event bus, guaranteed message delivery. Redis is NOT used as a message broker — RabbitMQ handles all asynchronous messaging.

**Why RabbitMQ over Redis Streams:**
- RabbitMQ provides durable queues, publisher confirms, consumer acknowledgements, and dead-letter exchanges (DLX) natively
- AMQP 0-9-1 protocol gives rich routing with topic exchanges, direct routing, headers exchanges, and fanout patterns
- RabbitMQ Management UI provides built-in monitoring for queue depth, consumer lag, publish rates
- Operational separation: Redis failures don't affect message delivery, and RabbitMQ failures don't affect cache availability

**Configuration:**
- Durable queues: `workflow`, `notification`, `reports`, `integrations`, `imports`, `default`
- Dead-letter exchange (DLX) with TTL: failed messages after 3 retries go to `dlq.{queue_name}`
- Queue mirroring across all nodes for high availability (HA mode)
- Consumer acknowledgements with prefetch count = 1 (fair dispatch)
- Publishers use confirms (publisher confirms) for guaranteed delivery
- VHost per environment (dev, staging, prod) for logical isolation

### 6.4 Redis

**Role:** Cache, rate limiter, WebSocket channel layer, session store, idempotency key store. No longer serves as a message broker.

**Configuration:**
- Redis 7 without persistence for cache DB (allows restart without recovery delay)
- Key namespace convention: `{env}:{module}:{entity}:{id}`
- Maxmemory policy: `allkeys-lru` for cache DB; `noeviction` for session/rate-limit DBs
- Separate DB indices: 0=cache, 1=rate-limiter, 2=sessions, 3=channels, 4=idempotency

### 6.5 Celery Workers

**Role:** Execute background tasks: workflow actions, notification delivery, report generation, import processing, integration sync.

**Configuration:**
- Broker: RabbitMQ (not Redis)
- Task queues: `workflow`, `notification`, `reports`, `integrations`, `imports`, `default`
- Concurrency: 4-8 workers per queue (configurable)
- Task timeouts: 30s default, 300s max for reports
- Retry policy: 3 retries, exponential backoff (1s, 4s, 16s), dead-letter to DLX after 3 failures
- Prefetch count: 1 (fair dispatch — workers don't buffer tasks)
- Tenant-aware: every task carries `organization_id`; TenantAwareTask base class restores RLS context

### 6.6 AI Gateway (FastAPI Sidecar)

**Role:** Proxy all LLM API calls, manage prompt templates, generate embeddings, serve RAG queries.

**Rationale for separate service:**
- LLM inference is GPU-bound and latency-sensitive — would block Django's event loop
- Streaming responses via SSE are natural in FastAPI ASGI
- Network isolation: prompt injection in sidecar cannot reach CRM database
- Independent scaling: AI features may need more replicas than CRM APIs

**API Endpoints:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/chat/completions` | Proxy to LLM with prompt template injection |
| POST | `/v1/embeddings` | Generate embeddings for entity data |
| POST | `/v1/rag/query` | Retrieve + generate over org documents |
| POST | `/v1/analyze/sentiment` | Sentiment analysis on text |
| GET | `/v1/prompts` | List prompt templates |
| POST | `/v1/tools/call` | MCP tool execution |
| GET | `/v1/tools` | List available MCP tools |

### 6.7 MinIO (File Storage)

**Role:** S3-compatible object storage for file uploads, avatars, attachments, and report exports.

**Storage layout:** `/media/{org_id}/{entity_type}/{entity_id}/{filename}`

---

## 7. Layered Architecture per Module

### 7.1 Layer Definition

Every bounded context module follows the same four-layer architecture:

```
┌──────────────────────────────────────────────────────────────────┐
│                      API Layer (ViewSet / Serializer)             │
│  Responsibility: Request deserialization, permission checks,     │
│  input validation, response serialization.                       │
│  Rules: Calls Application Service. Never contains business logic.│
│  Test: DRF APITestCase. Mocks service layer.                     │
├──────────────────────────────────────────────────────────────────┤
│                   Application Layer (Service / Command/Query)     │
│  Responsibility: Orchestrate domain objects for a use case.      │
│  Manage transactions (one service method = one transaction).     │
│  Collect domain events and publish via EventPublisher.           │
│  Rules: Returns Result[T, E] — never throws for expected errors.│
│  Depends on Repository port (interface), not on ORM.             │
│  Test: pytest with mock repository.                              │
├──────────────────────────────────────────────────────────────────┤
│                      Domain Layer (Pure Python)                   │
│  Responsibility: Business logic, entities, value objects,        │
│  aggregate roots, domain events, domain exceptions.              │
│  Rules: NO Django imports. NO I/O. Pure functions only.          │
│  Test: Pure pytest — no database, no mocks. Millisecond tests.   │
├──────────────────────────────────────────────────────────────────┤
│                 Infrastructure Layer (Django-aware)               │
│  Responsibility: ORM Models, Repository implementations,         │
│  Selectors (complex read queries), Event Handlers, Migrations.   │
│  Rules: Implements ports from domain & application.              │
│  Test: pytest-django with test database. Factory Boy for fixtures.│
└──────────────────────────────────────────────────────────────────┘
```

### 7.2 Layer Dependency Rules (Enforced by import-linter)

```
api ──────────► application ──────────► domain
  │                  │                      │
  │                  │                      │
  └──────────────────┴──────────────────────┘
                         │
                         ▼
                  infrastructure
                  (implements ports from domain & application)
```

- `domain` → imports `shared_kernel` only
- `application` → imports `domain`, `shared_kernel`, and abstract ports
- `infrastructure` → imports anything in the module + `shared_kernel`
- `api` → imports `application`, `infrastructure`, and `shared_kernel`
- No layer imports another module's internals
- Cross-module communication: subscribe to events via `adapters/event_handlers.py`

### 7.3 Module Dependency Rules

```
shared_kernel ◄── identity ◄── organization ◄── rbac ◄── tenant
                                                              │
                    ┌─────────────────────────────────────────┘
                    ▼
              lead_management ◄── pipeline_management
                    │                    │
                    └────┬───────────────┘
                         ▼
                    activity ◄── task ◄── calendar
                         │
                    workflow ◄── notification
                         │
                    dashboard ◄── reports
                         │
                    ai ◄── voice_ai
                         │
                    integrations ◄── settings
                         │
                    audit ◄── search
```

---

## 8. Data Architecture

### 8.1 Database Schema Strategy

**Default:** Shared PostgreSQL schema with RLS for tenant isolation.

**Schema per module:** All modules share one `public` schema, but tables are organized by naming convention: `{module}_{entity}` — e.g., `lead_management_leads`, `pipeline_management_stages`.

**Why one schema, not per-module schemas:**
- Django's ORM struggles with cross-schema queries (no joins across schemas)
- Migrations across schemas require special handling
- RLS policies are applied at the table level regardless of schema
- Migration simplicity: one `python manage.py migrate` updates everything

### 8.2 ID Strategy

All primary keys use **UUID v7** (time-ordered UUIDs).

```python
import uuid
import time

def uuid7() -> uuid.UUID:
    # UUID v7: time-ordered, sortable by creation time
    # No central authority needed — safe for multi-region
    timestamp_ms = int(time.time() * 1000)
    random_bytes = uuid.uuid4().bytes[2:8]
    return uuid.UUID(bytes=timestamp_ms.to_bytes(6, 'big') + random_bytes)
```

### 8.3 Universal Table Columns

```sql
CREATE TABLE {module}_{entity} (
    id UUID PRIMARY KEY DEFAULT uuid7(),
    organization_id UUID NOT NULL REFERENCES organization_organizations(id),
    -- entity-specific columns
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_id UUID REFERENCES identity_users(id),
    updated_by_id UUID REFERENCES identity_users(id),
    deleted_at TIMESTAMPTZ  -- soft delete (NULL = active)
);
```

### 8.4 Indexing Strategy

| Index Type | When to Use | Example |
|-----------|-------------|---------|
| B-tree | Primary lookups, FK, sort, unique | `id`, `organization_id`, `email` |
| GIN | Full-text search, JSONB, arrays | `search_vector` (tsvector), `tags` |
| GiST | Exclusion constraints, geometry | Date range exclusion |
| BRIN | Large tables with natural ordering | `created_at` on append-only tables |
| Partial | Soft-delete filtering | `WHERE deleted_at IS NULL` |
| Composite | Multi-column query patterns | `(organization_id, stage_id, created_at)` |
| IVFFlat | Vector similarity search | `embedding vector_cosine_ops` |

### 8.5 Full-Text Search

```sql
ALTER TABLE lead_management_leads ADD COLUMN search_vector tsvector;

CREATE TRIGGER lead_search_vector_update
    BEFORE INSERT OR UPDATE ON lead_management_leads
    FOR EACH ROW EXECUTE FUNCTION
    tsvector_update_trigger(search_vector, 'pg_catalog.english',
        first_name, last_name, company, title, notes);

CREATE INDEX idx_leads_search ON lead_management_leads USING GIN(search_vector);
```

### 8.6 Vector Storage (pgvector)

```sql
CREATE EXTENSION vector;

ALTER TABLE lead_management_leads ADD COLUMN embedding vector(1536);
CREATE INDEX idx_leads_embedding ON lead_management_leads
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

RLS policies apply to vector columns — the embedding table includes `organization_id` and has RLS applied like any other tenant-scoped table.

### 8.7 Partitioning Strategy

Tables exceeding 100M rows or append-heavy tables (audit log, activity log) use range partitioning by `created_at` month.

```sql
CREATE TABLE audit_log (
    id UUID NOT NULL, organization_id UUID NOT NULL, created_at TIMESTAMPTZ NOT NULL, ...
) PARTITION BY RANGE (created_at);

CREATE TABLE audit_log_2026_01 PARTITION OF audit_log
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
```

---

## 9. Integration Architecture

### 9.1 Internal Communication Patterns

| Pattern | Mechanism | Use Case | Guarantee |
|---------|-----------|----------|-----------|
| **Synchronous Query** | HTTP (REST API) | Cross-module reads: "Get contact for opportunity" | At-most-once |
| **Domain Event (Async)** | RabbitMQ → Celery | Cross-module side effects: "Lead created → start workflow" | At-least-once |
| **Domain Event (Sync)** | In-process signal | Same-module, same-transaction events: "Update cache after save" | Exactly-once (same transaction) |
| **Shared Kernel** | Python import | Value objects, base classes, interfaces | N/A (compile-time) |

### 9.2 Event Flow

```
┌──────────┐    ┌──────────────┐    ┌─────────────────┐
│  Service  │───►│  Aggregate    │───►│  EventPublisher  │
│  executes │    │  records      │    │  (RabbitMQ)      │
│  command  │    │  domain event │    └────────┬────────┘
└──────────┘    └──────────────┘             │
                                               │
                                               ▼
                                   ┌─────────────────────┐
                                   │   Celery Worker      │
                                   │  (per-queue)         │
                                   │                      │
                                   │  ┌───────────────┐   │
                                   │  │  Idempotency   │   │
                                   │  │  Check (Redis) │   │
                                   │  └───────┬───────┘   │
                                   │          │           │
                                   │  ┌───────┴───────┐   │
                                   │  │  Event Handler │   │
                                   │  │  (module)     │   │
                                   │  └───────┬───────┘   │
                                   │          │           │
                                   │  ┌───────┴───────┐   │
                                   │  │  Retry?       │   │
                                   │  │  3 attempts   │   │
                                   │  └───────────────┘   │
                                   └─────────────────────┘
```

### 9.3 External Integration Patterns

| Pattern | Use Case | Implementation |
|---------|----------|---------------|
| **REST API (Outbound)** | SendGrid, Twilio, Slack | `httpx` with retry + circuit breaker |
| **Webhook (Outbound)** | Notify external system of CRM events | Celery task with retry + HMAC signing |
| **Webhook (Inbound)** | Receive events from external systems | Django view with signature verification |
| **OAuth 2.0** | Google, Microsoft, HubSpot | `requests-oauthlib` + encrypted token storage |
| **IMAP/SMTP** | Email sync | `imaplib` + `smtplib` via Celery |
| **WebSocket** | Real-time UI updates | Django Channels + Redis channel layer |
| **Event Polling** | Systems without webhooks | Celery periodic task with rate limiting |

### 9.4 Circuit Breaker Pattern

```
┌──────────┐    ┌──────────┐    ┌──────────┐
│  CLOSED   │───►│   OPEN    │───►│  HALF-   │
│ (normal)  │    │ (failing) │    │  OPEN    │
└──────────┘    └──────────┘    └──────────┘
     │                │               │
     ▼                ▼               ▼
  Success        Failure > 5     Timeout elapsed
                 in 60s          → try one request
```

---

## 10. Security Architecture

### 10.1 Authentication

```
Request ──► JWT in Authorization header
                │
                ▼
         ┌──────────────┐
         │   Verify      │
         │   Signature   │
         │   Expiry      │
         └──────┬───────┘
                │
         ┌──────┴───────┐
         │  Extract      │
         │  user_id,     │
         │  org_id,      │
         │  roles        │
         └──────┬───────┘
                │
         ┌──────┴───────┐
         │  Set request  │
         │  user + org   │
         │  context      │
         └──────────────┘
```

**Token structure (access):**
```json
{
  "sub": "user_uuid",
  "org": "organization_uuid",
  "role": "admin",
  "permissions": ["leads.create", "leads.read", "leads.update"],
  "exp": 1700000000,
  "iat": 1699999100,
  "jti": "unique_token_id"
}
```

**Token lifecycle:**
- Access token: 15 minutes (short-lived, avoid revocation complexity)
- Refresh token: 7 days (rotated on use, stored hashed in DB)
- Refresh rotation: old refresh token is invalidated when a new one is issued

### 10.2 Authorization (Three-Layer Model)

```
Layer 1: Authentication (is this a valid user?)
    └── JWT verification, tenant membership check

Layer 2: RBAC (can this role perform this action?)
    └── Role + Permission check at API layer (DRF permissions)

Layer 3: RLS (can this user see this row?)
    └── PostgreSQL Row-Level Security (automatic, last line of defense)
```

**Permission naming convention:** `{entity}.{action}` where action ∈ {create, read, update, delete, export, assign, convert}

### 10.3 Data Security

| Concern | Mechanism |
|---------|-----------|
| Data at rest (DB) | PostgreSQL TDE (or dm-crypt for volumes) |
| Data at rest (files) | MinIO SSE-S3 (AES-256) |
| Data in transit | TLS 1.3 for all external traffic; mTLS for internal service-to-service |
| Secrets | HashiCorp Vault or AWS Secrets Manager; never in env files or code |
| API keys (external) | Encrypted at rest (AES-256-GCM) in database; decrypted in-memory only |
| Passwords | bcrypt (cost factor 12) |
| OAuth tokens | Encrypted at rest; decrypted only in the integration service |
| PII / GDPR | Configurable field-level encryption; anonymization on demand |
| Audit trail | Append-only event log; immutable after 5 minutes |

### 10.4 API Security

| Measure | Implementation |
|---------|---------------|
| Rate limiting | django-ratelimit + Redis (tiered by plan) |
| CORS | Restricted to known origins (per-tenant config for API access) |
| CSRF | Token-based for browser; JWT for API (CSRF exempt) |
| SQL injection | Django ORM (parameterized queries); raw SQL prohibited in application code |
| XSS | DRF's JSON renderer (auto-escaped); Content-Type enforcement |
| Request size limit | 10MB POST body; file upload size per plan |
| Security headers | `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`, `Content-Security-Policy` |

---

## 11. Observability Architecture

### 11.1 Pillars

```
┌──────────────────────────────────────────────────────────────────┐
│                      OBSERVABILITY                                │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐   │
│  │   LOGGING    │  │   METRICS    │  │    TRACING            │   │
│  │              │  │              │  │                       │   │
│  │ • structlog  │  │ • Prometheus │  │ • OpenTelemetry       │   │
│  │ • JSON format│  │ • RED method │  │ • W3C Trace Context   │   │
│  │ • Correlation│  │ • SLOs       │  │ • Distributed traces  │   │
│  │   IDs        │  │ • Dashboards │  │   across services     │   │
│  └──────────────┘  └──────────────┘  └───────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

### 11.2 Logging (Structured JSON with structlog)

```json
{
  "timestamp": "2026-07-27T10:30:00.123Z",
  "level": "info",
  "event": "lead_created",
  "logger": "lead_management.application.services",
  "request_id": "req_abc123",
  "tenant_id": "org_uuid",
  "user_id": "user_uuid",
  "lead_id": "lead_uuid",
  "duration_ms": 45,
  "exception": null
}
```

### 11.3 Metrics (RED Method)

| Metric | Type | Labels |
|--------|------|--------|
| `http_requests_total` | Counter | method, endpoint, status, tenant |
| `http_request_duration_ms` | Histogram | method, endpoint, tenant |
| `celery_tasks_total` | Counter | queue, task_name, status |
| `db_queries_total` | Counter | module, operation |
| `cache_hit_ratio` | Gauge | cache_name |
| `ai_tokens_total` | Counter | model, feature, org |

### 11.4 SLOs

| Service | SLO | Burn Rate Alert |
|---------|-----|----------------|
| API (p95 latency) | < 500ms | 2% exceedance over 1h |
| API (error rate) | < 0.1% | 0.5% over 5 min |
| Workflow execution | < 5s from event → action | 10% over 10s |
| Email delivery | < 60s from trigger → SMTP | 5% over 120s |
| AI inference | < 2s p95 | 10% over 5s |
| Uptime | 99.95% | Any 5-min downtime |

---

## 12. Deployment Architecture

### 12.1 Environment Strategy

| Environment | Purpose | Infrastructure | Data |
|------------|---------|---------------|------|
| **local** | Developer machine | Docker Compose | Fresh DB per `make dev` |
| **dev** | Shared development | Single-node Docker | Anonymized production copy (weekly refresh) |
| **staging** | Pre-production validation | K8s (3-node) | Anonymized production copy (bi-weekly) |
| **production** | Live customer traffic | K8s (multi-node, multi-AZ) | Real customer data |
| **dr** | Disaster recovery | K8s (secondary region) | WAL streaming from primary |

### 12.2 Container Strategy

```
┌──────────────────────────────────────────────────────────────────┐
│                       Kubernetes Cluster                         │
│                                                                   │
│  ┌────────────────────┐  ┌────────────────────┐                 │
│  │  Django Pod         │  │  Django Pod         │  ...            │
│  │  - Gunicorn         │  │  - Gunicorn         │                 │
│  │  - Uvicorn (ASGI)   │  │  - Uvicorn (ASGI)   │                 │
│  └────────────────────┘  └────────────────────┘                 │
│                                                                   │
│  ┌────────────────────┐  ┌────────────────────┐                 │
│  │  Celery Workflow    │  │  Celery Notify      │  ...            │
│  │  Worker Pod         │  │  Worker Pod         │                 │
│  └────────────────────┘  └────────────────────┘                 │
│                                                                   │
│  ┌────────────────────┐  ┌────────────────────┐                 │
│  │  AI Gateway Pod     │  │  AI Gateway Pod     │  ...            │
│  │  - FastAPI          │  │  - FastAPI          │                 │
│  └────────────────────┘  └────────────────────┘                 │
│                                                                   │
│  ┌────────────────────┐  ┌────────────────────┐                 │
│  │  PostgreSQL          │  │  Redis              │                 │
│  │  (StatefulSet)       │  │  (StatefulSet)      │                 │
│  └────────────────────┘  └────────────────────┘                 │
│                                                                   │
│  ┌────────────────────┐  ┌────────────────────┐                 │
│  │  MinIO              │  │  Pgbouncer          │                 │
│  │  (StatefulSet)      │  │  (Deployment)       │                 │
│  └────────────────────┘  └────────────────────┘                 │
└──────────────────────────────────────────────────────────────────┘
```

### 12.3 CI/CD Pipeline

```
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│  PR      │  │  Lint    │  │  Test    │  │  Build   │  │  Deploy  │
│  Created │─►│ + Type   │─►│ + Cover  │─►│  Image   │─►│  to      │
│          │  │          │  │          │  │          │  │  Staging │
└──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘
                                                               │
                                                         ┌─────┴─────┐
                                                         │  Smoke     │
                                                         │  Tests     │
                                                         │  + E2E     │
                                                         └─────┬─────┘
                                                               │
                                                         ┌─────┴─────┐
                                                         │  Deploy   │
                                                         │  to Prod  │
                                                         │ (manual   │
                                                         │  approval)│
                                                         └───────────┘
```

### 12.4 Scaling Strategy

| Component | Scale Trigger | Action |
|-----------|--------------|--------|
| Django (API) | CPU > 70% OR p95 > 500ms | HPA: increase replicas |
| Celery (Workflow) | Queue depth > 1000 | HPA: increase worker replicas |
| Celery (Reports) | Queue depth > 100 | HPA: increase worker replicas |
| AI Gateway | CPU > 60% OR queue > 50 | HPA: increase replicas |
| PostgreSQL | Connection > 200 OR CPU > 70% | Vertical: larger instance; then read replicas |
| Redis | Memory > 80% | Vertical: larger instance; then cluster mode |

---

## 13. Evolution Strategy

### 13.1 When to Extract a Microservice

| Condition | Decision |
|-----------|----------|
| Module requires independent scaling (different from monolith) | Extract to service |
| Module needs a different tech stack (e.g., AI Gateway) | Extract to service |
| Module team wants independent deploy cadence | Extract to service |
| Module has a different latency/resource profile | Extract to service |
| "It might be faster as a service" (no data) | Stay in monolith |
| "It will be cleaner as a service" (no coupling evidence) | Stay in monolith |

### 13.2 Service Extraction Pattern

1. **Strangler Fig:** Add a facade in the monolith that routes requests to the new service
2. **Dual Write:** Write to both old and new; compare results in staging
3. **Verify Parity:** Automated comparison of monolith vs. service responses
4. **Cut Over:** Route all traffic to new service; keep monolith read-only for fallback
5. **Remove:** Delete the extracted code from the monolith

### 13.3 Technology Radar

| Technology | Status | Notes |
|-----------|--------|-------|
| Django 5.x | **Adopt** | Core framework |
| DRF + drf-spectacular | **Adopt** | REST API framework |
| PostgreSQL 16 + pgvector | **Adopt** | Primary database + vector store |
| Redis 7 | **Adopt** | Cache, rate limiter, WebSocket channel, session store |
| RabbitMQ | **Adopt** | Celery broker, event bus, guaranteed messaging |
| Celery | **Adopt** | Background task processing |
| MinIO | **Adopt** | S3-compatible file storage |
| Django Channels | **Adopt** | WebSocket real-time |
| pgbouncer | **Adopt** | Connection pooling |
| OpenTelemetry | **Adopt** | Observability |
| Prometheus + Grafana | **Adopt** | Metrics + dashboards |
| structlog | **Adopt** | Structured logging |
| React + TypeScript + Vite | **Adopt** | Frontend SPA |
| MUI | **Adopt** | Frontend component library |
| FastAPI | **Trial** | AI Gateway sidecar |
| LangChain | **Trial** | LLM orchestration, tool-calling, agent framework |
| OpenAI (GPT-4o) | **Trial** | Primary LLM provider |
| pgvector | **Trial** | Vector embeddings + semantic search |
| MCP (Model Context Protocol) | **Assess** | Standardized AI tool exposure |
| Temporal | **Assess** | Complex workflow orchestration (Phase 5+) |
| Elasticsearch | **Assess** | If PostgreSQL full-text search insufficient |
| gRPC | **Assess** | Internal service-to-service if microservices emerge |

---

> **Version:** 0.1.0-draft | **Last Updated:** 2026-07-27
> **This document describes the system as architected, not as built.**
> Implementation details may vary per phase, but the principles, patterns,
> and security model documented here are binding. Any deviation requires
> a new Architecture Decision Record (ADR).
