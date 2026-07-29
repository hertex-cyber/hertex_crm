# TZAHU CRM — Architecture Overview

> **Version:** 0.1.0-draft
> **Last Updated:** 2026-07-27
> **Status:** Foundational Design Phase
> **Owner:** Platform Architecture Team

---

## Table of Contents

1. [System Context](#1-system-context)
2. [Architecture Principles](#2-architecture-principles)
3. [Container Diagram](#3-container-diagram)
4. [Component Architecture](#4-component-architecture)
5. [Layered Architecture per Module](#5-layered-architecture-per-module)
6. [Data Architecture](#6-data-architecture)
7. [Integration Architecture](#7-integration-architecture)
8. [Security Architecture](#8-security-architecture)
9. [Observability Architecture](#9-observability-architecture)
10. [Deployment Architecture](#10-deployment-architecture)
11. [Evolution Strategy](#11-evolution-strategy)

---

## 1. System Context

```
┌─────────────────────────────────────────────────────────────────────┐
│                         TZAHU CRM SYSTEM                            │
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────────────┐  │
│  │   Web     │  │  Mobile   │  │  Public   │  │  Admin Console    │  │
│  │   App     │  │   App     │  │   API     │  │  (Internal)       │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └─────────┬──────────┘  │
│       │              │              │                  │             │
│       └──────────────┴──────────────┴──────────────────┘             │
│                              │                                       │
│                              ▼                                       │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │               TZAHU CRM Backend (Django)                      │    │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────┐   │    │
│  │  │  Identity   │ │  Lead Mgmt │ │  Pipeline  │ │ Workflow │   │    │
│  │  │  + Auth     │ │  + Contact │ │  + Oppty   │ │  Engine  │   │    │
│  │  └────────────┘ └────────────┘ └────────────┘ └──────────┘   │    │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────┐   │    │
│  │  │ Notification│ │  Reports   │ │    AI      │ │Integrations│   │    │
│  │  └────────────┘ └────────────┘ └────────────┘ └──────────┘   │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                              │                                       │
│         ┌────────────────────┼────────────────────┐                 │
│         ▼                    ▼                    ▼                   │
│  ┌──────────┐     ┌──────────────┐     ┌──────────────┐┐         │
│  │PostgreSQL│     │     Redis    │     │   RabbitMQ   ││         │
│  │  + RLS   │     │  Cache+Rate  │     │   Message    ││         │
│  │          │     │  Limiter+WS  │     │    Broker    ││         │
│  └──────────┘     └──────────────┘     └──────────────┘┘         │
│                                                                    │
│  ┌──────────────┐     ┌────────────────────┐     ┌────────────┐  │
│  │    MinIO     │     │   Celery Workers   │     │ AI Gateway │  │
│  │ File Storage │     │  (Background Jobs) │     │  (FastAPI) │  │
│  └──────────────┘     └────────────────────┘     └────────────┘  │
│         └────────────────────┘     └──────────────────┘             │
│                                                                     │
│         ┌──────────────────────────────────────────────────┐        │
│         │  External Services: SendGrid, Twilio, OpenAI,    │        │
│         │  Google, Microsoft, Slack, Zoom, HubSpot, etc.   │        │
│         └──────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────────────┘
```

### Actors

| Actor | Description | Interaction Pattern |
|-------|-------------|-------------------|
| **Sales Rep** | Primary user — manages leads, contacts, opportunities, tasks | Web App + Mobile App |
| **Sales Manager** | Pipeline oversight, forecast management, team coaching | Web App |
| **Admin** | Org configuration, user management, workflow setup, integrations | Web App (Admin UI) |
| **System Admin** | TZAHU platform management, tenant provisioning | Admin Console |
| **API Client** | Third-party integration, custom app | REST API |
| **External System** | Google, Microsoft, Slack, Twilio, SendGrid, etc. | REST API + Webhooks |
| **Anonymous User** | Lead form submitter, public knowledge base | Public API |

### External Systems

| System | Purpose | Integration Pattern |
|--------|---------|-------------------|
| PostgreSQL 16 | Primary database, vector store (pgvector) | Native TCP |
| Redis 7 | Cache, rate limiter, WebSocket channel layer, session store | Native TCP |
| RabbitMQ | Celery broker, event bus, guaranteed message delivery | AMQP 0-9-1 |
| MinIO | File storage (S3-compatible) | S3 API |
| Celery Workers | Async task execution (workflow, notifications, reports) | RabbitMQ broker |
| AI Gateway (FastAPI) | LLM proxy, embedding, RAG | HTTP (internal) |
| SendGrid / SES | Transactional email | SMTP / API |
| Twilio | SMS, Voice | REST API |
| OpenAI / Anthropic | LLM APIs | HTTP (external) |
| Google / Microsoft | Calendar, Contacts, SSO | OAuth 2.0 + REST API |
| Slack | Notifications, workflow triggers | Webhook + REST API |

---

## 2. Architecture Principles

### Strategic Principles

| # | Principle | Rationale | Violation Consequence |
|---|-----------|-----------|----------------------|
| 1 | **Isolation by default, sharing by contract** | Each bounded context owns its data and logic. Cross-context communication requires an explicit contract (event or API). | Non-local changes cascade across modules; team coordination overhead increases with team size. |
| 2 | **Ports and Adapters (Hexagonal)** | Domain logic depends on abstractions (ports); infrastructure implements them (adapters). | Domain logic is coupled to framework specifics; testing requires heavyweight infrastructure. |
| 3 | **Event-driven communication** | Modules communicate via domain events, not direct calls. | Synchronous cross-module calls create latent coupling; a change in one module breaks another. |
| 4 | **Tenant isolation at the database layer** | PostgreSQL RLS ensures no application code can accidentally read another tenant's data. | A single misplaced `.all()` leaks every tenant's data. RLS is the last line of defense. |
| 5 | **Observability as a feature** | Every request, job, and event is traced, logged, and metered. | Debugging production issues becomes guesswork; SLA breaches go undetected. |
| 6 | **Synchronous for queries, asynchronous for commands** | Reads return immediately; writes that trigger side effects do so via events. | Complex write paths hold DB connections; user waits for email sending to complete. |
| 7 | **Testability determines structure** | If a component is hard to test, restructure it. Testing is not an afterthought. | Untested code becomes legacy on the day it's merged. |
| 8 | **Convention over configuration** | Module layout, naming, and patterns are standardized. | Each module reinvents the wheel; onboarding takes weeks instead of days. |

---

## 3. Container Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Load Balancer                            │
│                      (nginx / AWS ALB)                           │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Django Application                          │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                     WSGI/ASGI Server                      │  │
│  │               (Gunicorn + Uvicorn workers)                 │  │
│  └──────────────────────────┬────────────────────────────────┘  │
│                             │                                    │
│  ┌──────────────────────────┼────────────────────────────────┐  │
│  │            Middleware Stack                               │  │
│  │  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐   │  │
│  │  │ CORS    │ │ Auth     │ │ Tenant   │ │ Request    │   │  │
│  │  │         │ │ (JWT)    │ │ (RLS ctx)│ │ Logging    │   │  │
│  │  └─────────┘ └──────────┘ └──────────┘ └────────────┘   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                             │                                    │
│  ┌──────────────────────────┼────────────────────────────────┐  │
│  │              URL Router (config/urls/)                    │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐   │  │
│  │  │ /auth/*  │ │ /api/*   │ │ /admin/* │ │ /ws/*      │   │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └────────────┘   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                             │                                    │
│  ┌──────────────────────────┴────────────────────────────────┐  │
│  │                  Module Viewsets (DRF)                    │  │
│  │  LeadViewSet │ ContactViewSet │ OpportunityViewSet │ ...  │  │
│  └──────────────────────────┬────────────────────────────────┘  │
│                             │                                    │
│  ┌──────────────────────────┴────────────────────────────────┐  │
│  │                Application Service Layer                  │  │
│  │  LeadService │ ContactService │ WorkflowService │ ...     │  │
│  └──────────────────────────┬────────────────────────────────┘  │
│                             │                                    │
│  ┌──────────────────────────┴────────────────────────────────┐  │
│  │                     Domain Layer                          │  │
│  │  Entities │ Value Objects │ Domain Events │ Aggregates    │  │
│  └──────────────────────────┬────────────────────────────────┘  │
│                             │                                    │
│  ┌──────────────────────────┴────────────────────────────────┐  │
│  │                Infrastructure Layer                       │  │
│  │  Repositories │ Selectors │ Event Bus │ ORM Models        │  │
│  └──────────────────────────┬────────────────────────────────┘  │
└─────────────────────────────┼────────────────────────────────────┘
                              │
        ┌─────────────────────┬─────────────────────┬──────────────────┐
        ▼                     ▼                     ▼                  │
┌───────────────┐   ┌───────────────┐   ┌───────────────┐             │
│  PostgreSQL   │   │     Redis     │   │   RabbitMQ    │             │
│  Primary + RLS │   │  Cache/Rate   │   │  Message      │             │
│  + pgvector   │   │  Limiter/WS   │   │  Broker       │             │
└───────────────┘   └───────────────┘   └───────┬───────┘             │
                                                │                     │
                                                ▼                     │
┌─────────────────────────────────────────────────────────────────┐  │
│                        Celery Workers (RabbitMQ Consumer)       │  │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐  │  │
│  │ Workflow   │ │ Notification│ │  Reports   │ │ Integrations│  │  │
│  │ Queue      │ │ Queue      │ │  Queue     │ │ Queue      │  │  │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘  │  │
└─────────────────────────────────────────────────────────────────┘  │
                                                                      │
┌─────────────────────────────────────────────────────────────────┐  │
│                      AI Gateway (FastAPI)                       │  │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐  │  │
│  │ LLM Proxy  │ │ Embedding  │ │  RAG       │ │  MCP       │  │  │
│  │ (OpenAI/   │ │ Pipeline   │ │  Retriever │ │  Server    │  │  │
│  │  Anthropic)│ │            │ │            │ │            │  │  │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘  │  │
└─────────────────────────────────────────────────────────────────┘  │
                                                                      │
┌─────────────────────────────────────────────────────────────────┐  │
│                          MinIO (S3)                             │  │
│                     File Storage                                │  │
└─────────────────────────────────────────────────────────────────┘  │

┌─────────────────────────────────────────────────────────────────┐
│                      AI Gateway (FastAPI)                       │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐  │
│  │ LLM Proxy  │ │ Embedding  │ │  RAG       │ │  Semantic  │  │
│  │ (OpenAI/   │ │ Pipeline   │ │  Retriever │ │  Search    │  │
│  │  Anthropic)│ │            │ │            │ │            │  │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Component Architecture

### Core Components

#### 4.1 Django Application Server

**Role:** Serves REST API, Admin interface, and WebSocket connections.

**Components:**
- **Gunicorn** (WSGI) for synchronous API requests
- **Uvicorn** (ASGI) workers for WebSocket connections (Django Channels)
- **Middleware stack:** CORS → Security → Auth (JWT) → Tenant (RLS) → Request Logging → Rate Limit

**Scaling:** Horizontal via K8s replicas. Stateless — session state in Redis, not local memory.

**Health Check Endpoint:** `GET /health/` — returns DB connectivity, Redis connectivity, RabbitMQ connectivity, Celery worker availability, last migration applied.

#### 4.2 PostgreSQL Database

**Role:** Primary data store. Relational data + vector embeddings (pgvector).

**Configuration:**
- PostgreSQL 16 with `pgvector`, `pg_trgm`, `uuid-ossp` extensions
- Pgbouncer for connection pooling (transaction mode)
- Read replicas for reporting and analytics queries (Phase 11)
- WAL archiving for point-in-time recovery

**Tenant Isolation:** RLS enforced via `app.current_organization_id` session variable.

**Key Tables by Module:**
See each module blueprint in `docs/ModuleBlueprints/`.

#### 4.3 RabbitMQ

**Role:** Celery broker, domain event bus, guaranteed message delivery. Redis is NOT used as a message broker — RabbitMQ handles all asynchronous messaging.

**Why separate from Redis:**
- RabbitMQ provides durable queues, publisher confirms, consumer acknowledgements, and dead-letter exchanges (DLX) natively — Redis Streams requires custom implementations for all of these.
- AMQP 0-9-1 protocol gives rich routing with topic exchanges, direct routing, headers exchanges, and fanout patterns.
- RabbitMQ Management UI provides built-in monitoring for queue depth, consumer lag, publish rates, and connection status.
- Operational separation: Redis failures don't affect message delivery, and RabbitMQ failures don't affect cache availability.

**Configuration:**
- Durable queues for all task types: `workflow`, `notification`, `reports`, `integrations`, `imports`, `default`
- Dead-letter exchange (DLX) with TTL: failed messages after 3 retries go to `dlq.{queue_name}`
- Queue mirroring across all nodes for high availability (HA mode)
- Consumer acknowledgements with prefetch count = 1 (fair dispatch)
- Publishers use confirms (publisher confirms) for guaranteed delivery
- VHost per environment (dev, staging, prod) for logical isolation

#### 4.4 Redis

**Role:** Cache, rate limiter, WebSocket channel layer, session store, idempotency key store. No longer serves as a message broker.

**Configuration:**
- Redis 7 without persistence for cache DB (allows restart without recovery delay)
- Key namespace convention: `{env}:{module}:{entity}:{id}`
- Maxmemory policy: `allkeys-lru` for cache DB; `noeviction` for session/rate-limit DBs
- Separate DB indices: 0=cache, 1=rate-limiter, 2=sessions, 3=channels, 4=idempotency

#### 4.5 Celery Workers

**Role:** Execute background tasks: workflow actions, notification delivery, report generation, import processing, integration sync.

**Configuration:**
- Broker: RabbitMQ (not Redis)
- Task queues: `workflow`, `notification`, `reports`, `integrations`, `imports`, `default`
- Concurrency: 4–8 workers per queue (configurable)
- Task timeouts: 30s default, 300s max for reports
- Retry policy: 3 retries, exponential backoff (1s, 4s, 16s), dead-letter to DLX after 3 failures
- Prefetch count: 1 (fair dispatch — workers don't buffer tasks)
- Monitoring: Flower dashboard, RabbitMQ Management UI, Prometheus metrics exporter

#### 4.6 AI Gateway (FastAPI Sidecar)

**Role:** Proxy all LLM API calls, manage prompt templates, generate embeddings, serve RAG queries.

**Rationale for separate service:**
- LLM inference is GPU-bound and latency-sensitive — would block Django's event loop
- Streaming responses via SSE are natural in FastAPI ASGI
- Network isolation: prompt injection in sidecar cannot reach CRM database
- Independent scaling: AI features may need more replicas than CRM APIs

**API Endpoints:**
- `POST /v1/chat/completions` — Proxy to LLM provider with prompt template injection
- `POST /v1/embeddings` — Generate embeddings for entity data
- `POST /v1/rag/query` — Retrieve + generate over org documents
- `POST /v1/analyze/sentiment` — Sentiment analysis on text
- `GET /v1/prompts` — List prompt templates

---

## 5. Layered Architecture per Module

Every bounded context module follows the same layered architecture:

```
┌─────────────────────────────────────────────────────────────────┐
│                        API Layer (ViewSet)                      │
│  • Request deserialization  • Permission checks                 │
│  • Input validation          • Response serialization           │
│  • Calls Application Service (one method = one use case)        │
│  • Never contains business logic                                │
├─────────────────────────────────────────────────────────────────┤
│                     Application Layer (Service)                 │
│  • Orchestrates domain objects for a use case                   │
│  • Manages transactions (one service method = one transaction)  │
│  • Collects domain events and publishes via EventPublisher      │
│  • Returns Result[T, E] — never throws for expected failures    │
│  • Depends on Repository port, not on ORM                       │
├─────────────────────────────────────────────────────────────────┤
│                       Domain Layer (Pure Python)                │
│  • Entities (mutable, identity-based)                           │
│  • Value Objects (immutable, value-based)                       │
│  • Aggregate Roots (consistency boundary, event source)         │
│  • Domain Events (facts that happened)                          │
│  • Domain Exceptions (business rule violations)                 │
│  • NO Django imports. NO I/O. PURE FUNCTIONS.                   │
├─────────────────────────────────────────────────────────────────┤
│                   Infrastructure Layer (Django-aware)           │
│  • ORM Models (Django models mapping to DB)                     │
│  • Repositories (implement Repository[T] port)                  │
│  • Selectors (complex read queries, DTO projection)             │
│  • Event Handlers (subscribe to events from other modules)      │
│  • Migrations, Admin config, Management commands                │
└─────────────────────────────────────────────────────────────────┘
```

### Layer Dependency Rules (Enforced by import-linter)

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
- Cross-module: subscribe to events via `adapters/event_handlers.py`

---

## 6. Data Architecture

### 6.1 Database Schema Strategy

**Default:** Shared PostgreSQL schema with RLS for tenant isolation.

**Schema per module:** All modules share one `public` schema, but tables are organized by naming convention:
- `{module}_{entity}` — e.g., `lead_management_leads`, `pipeline_management_stages`

**Why one schema, not per-module schemas:**
- Django's ORM struggles with cross-schema queries (no joins across schemas)
- Migrations across schemas require special handling
- RLS policies are applied at the table level regardless of schema
- Migration simplicity: one `python manage.py migrate` updates everything

### 6.2 ID Strategy

**All primary keys use UUID v7** (time-ordered UUIDs).

```python
import uuid

def uuid7() -> uuid.UUID:
    # UUID v7: time-ordered, sortable by creation time
    # Generated without a central authority — safe for multi-region
    ...
```

**Why not auto-increment:**
| Concern | Auto-increment | UUID v7 |
|---------|---------------|---------|
| Multi-region writes | Conflicts across regions | Safe — no coordination needed |
| Sortable by time | No (unless identity pattern) | Yes — B-tree index friendly |
| URL-safe | Exposes record count | Opaque |
| Storage (PK) | 4 bytes (int) or 8 bytes (bigint) | 16 bytes (UUID) |
| JOIN performance | Better (smaller, sequential) | Slightly worse (random) |

**Trade-off accepted:** UUID v7 is larger (16 bytes vs 4 bytes) and slightly slower for joins than auto-increment. The operational benefit of conflict-free multi-region generation outweighs the storage cost at our scale (18M rows for the largest table at 100k orgs × avg 180 rows/entity).

### 6.3 Universal Table Columns

Every table in the system follows this convention:

```sql
CREATE TABLE {module}_{entity} (
    id UUID PRIMARY KEY DEFAULT uuid7(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    -- entity-specific columns here...
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_id UUID REFERENCES identity_users(id),
    updated_by_id UUID REFERENCES identity_users(id),
    deleted_at TIMESTAMPTZ  -- soft delete (NULL = active)
);
```

### 6.4 Indexing Strategy

| Index Type | When to Use | Example |
|-----------|-------------|---------|
| B-tree | Primary lookups, FK, sort, unique | `id`, `organization_id`, `email` |
| GIN | Full-text search, JSONB, arrays | `search_vector` (tsvector), `tags` |
| GiST | Exclusion constraints, geometry | Date range exclusion |
| BRIN | Large tables with natural ordering | `created_at` on append-only tables |
| Partial | Soft-delete filtering | `WHERE deleted_at IS NULL` |
| Composite | Multi-column query patterns | `(organization_id, stage_id, created_at)` |

**Rule of thumb:** Index every foreign key, every column used in `WHERE` or `ORDER BY`, and every unique constraint. Monitor unused indexes via `pg_stat_user_indexes` and remove quarterly.

### 6.5 Full-Text Search

```sql
-- Each searchable table has a tsvector column
ALTER TABLE lead_management_leads ADD COLUMN search_vector tsvector;

-- Populated by trigger on INSERT/UPDATE
CREATE TRIGGER lead_search_vector_update
    BEFORE INSERT OR UPDATE ON lead_management_leads
    FOR EACH ROW EXECUTE FUNCTION
    tsvector_update_trigger(search_vector, 'pg_catalog.english',
        first_name, last_name, company, title, notes);

-- GIN index for fast search
CREATE INDEX idx_leads_search ON lead_management_leads USING GIN(search_vector);

-- Search query
SELECT * FROM lead_management_leads
WHERE search_vector @@ plainto_tsquery('english', 'Acme Corp')
ORDER BY ts_rank(search_vector, plainto_tsquery('english', 'Acme Corp')) DESC;
```

### 6.6 Vector Storage (pgvector)

```sql
CREATE EXTENSION vector;

-- Embedding column on searchable entities
ALTER TABLE lead_management_leads ADD COLUMN embedding vector(1536);
CREATE INDEX idx_leads_embedding ON lead_management_leads
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

### 6.7 Partitioning Strategy

**When to partition:**
- Tables exceeding 100M rows
- Append-heavy tables (audit log, activity log, event log)
- Tables with clear time-based access patterns

**Partitioning method:** Range partitioning by `created_at` month.

```sql
CREATE TABLE audit_log (
    id UUID NOT NULL,
    organization_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    ...
) PARTITION BY RANGE (created_at);

CREATE TABLE audit_log_2026_01 PARTITION OF audit_log
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
```

---

## 7. Integration Architecture

### 7.1 Internal Communication Patterns

| Pattern | Mechanism | Use Case | Guarantee |
|---------|-----------|----------|-----------|
| **Synchronous Query** | HTTP (REST API) | Cross-module reads: "Get contact for opportunity" | At-most-once |
| **Domain Event (Async)** | RabbitMQ → Celery | Cross-module side effects: "Lead created → start workflow" | At-least-once |
| **Domain Event (Sync)** | In-process signal | Same-module, same-transaction events: "Update cache after save" | Exactly-once (same transaction) |
| **Shared Kernel** | Python import | Value objects, base classes, interfaces | N/A (compile-time) |

### 7.2 Event Flow

```
┌──────────┐     ┌──────────────┐     ┌─────────────────┐
│  Service  │────►│  Aggregate    │────►│  EventPublisher  │
│  executes │     │  records      │     │  (RabbitMQ)      │
│  command  │     │  domain event │     └────────┬────────┘
└──────────┘     └──────────────┘              │
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

### 7.3 External Integration Patterns

| Pattern | Use Case | Implementation |
|---------|----------|---------------|
| **REST API (Outbound)** | SendGrid, Twilio, Slack | `httpx` with retry + circuit breaker |
| **Webhook (Outbound)** | Notify external system of CRM events | Celery task with retry + HMAC signing |
| **Webhook (Inbound)** | Receive events from external systems | Django view with signature verification |
| **OAuth 2.0** | Google, Microsoft, HubSpot | `requests-oauthlib` + encrypted token storage |
| **IMAP/SMTP** | Email sync | `imaplib` + `smtplib` via Celery |
| **WebSocket** | Real-time UI updates | Django Channels + Redis channel layer |
| **Event Polling** | Systems without webhooks | Celery periodic task with rate limiting |

### 7.4 Circuit Breaker Pattern

Every outbound external call goes through a circuit breaker:

```
┌──────────┐    ┌──────────┐    ┌──────────┐
│  CLOSED   │───►│   OPEN    │───►│  HALF-   │
│ (normal)  │    │ (failing) │    │  OPEN    │
└──────────┘    └──────────┘    └──────────┘
     │                │               │
     │                │               │
     ▼                ▼               ▼
  Success        Failure > 5     Timeout elapsed
                 in 60s          → try one request
```

---

## 8. Security Architecture

### 8.1 Authentication

```
Request ──► JWT in Authorization header
                │
                ▼
         ┌──────────────┐
         │   Verify     │
         │   Signature  │
         │   Expiry     │
         └──────┬───────┘
                │
         ┌──────┴───────┐
         │  Extract     │
         │  user_id,    │
         │  org_id,     │
         │  roles       │
         └──────┬───────┘
                │
         ┌──────┴───────┐
         │  Set request │
         │  user + org  │
         │  context     │
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
- Refresh rotation: old refresh token is invalidated when a new one is issued (protects against token theft)

**Security measures:**
- RS256 signed (asymmetric — public key in API, private key in secret manager)
- `jti` stored in Redis until token expiry for immediate revocation capability
- Rate limit on `/auth/login`: 5 attempts per 15 minutes per IP
- Rate limit on `/auth/refresh`: 10 attempts per minute per user

### 8.2 Authorization

**Three-layer authorization model:**

```
Layer 1: Authentication (is this a valid user?)
    └── JWT verification, tenant membership check

Layer 2: RBAC (can this role perform this action?)
    └── Role + Permission check at API layer (DRF permissions)

Layer 3: RLS (can this user see this row?)
    └── PostgreSQL Row-Level Security (automatic)
```

**RBAC Model:**
```
Organization
    └── Role (e.g., Admin, Manager, Rep, Read-only)
            └── Permission (e.g., lead.create, lead.read, lead.update, lead.delete)
                    └── Scope (org-wide, team, own)
```

**Permission naming convention:** `{entity}.{action}` where action ∈ {create, read, update, delete, export, assign, convert}

### 8.3 Data Security

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
| Audit trail | Append-only event log; immutable after 5 minutes (write-once-read-many storage) |

### 8.4 API Security

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

## 9. Observability Architecture

### 9.1 Pillars

```
┌─────────────────────────────────────────────────────────────────┐
│                      OBSERVABILITY                               │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │   LOGGING    │  │   METRICS    │  │    TRACING            │   │
│  │              │  │              │  │                       │   │
│  │ • structlog  │  │ • Prometheus │  │ • OpenTelemetry       │   │
│  │ • JSON format│  │ • RED method │  │ • W3C Trace Context   │   │
│  │ • Correlation│  │ • SLOs       │  │ • Distributed traces  │   │
│  │   IDs        │  │ • Dashboards │  │   across services     │   │
│  └──────────────┘  └──────────────┘  └───────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 9.2 Logging

**Structured JSON logging with `structlog`:**

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

**Log levels:**
| Level | Usage |
|-------|-------|
| `debug` | Development only — never in production |
| `info` | Business events: entity created, workflow executed, notification sent |
| `warning` | Degraded state: retry attempt, rate limit nearing, cache miss |
| `error` | Recoverable failure: external API timeout, Celery task failure |
| `critical` | Unrecoverable: DB connection lost, disk full, RLS misconfiguration |

### 9.3 Metrics

**RED method** (Rate, Errors, Duration) for every service:

| Metric | Type | Labels | Example |
|--------|------|--------|---------|
| `http_requests_total` | Counter | method, endpoint, status, tenant | `http_requests_total{method="GET", endpoint="/api/v1/leads/", status="200"}` |
| `http_request_duration_ms` | Histogram | method, endpoint, tenant | p50, p95, p99 latency |
| `http_errors_total` | Counter | method, endpoint, error_code | `http_errors_total{error_code="LEAD_NOT_FOUND"}` |
| `celery_tasks_total` | Counter | queue, task_name, status | Tasks executed, failed, retried |
| `celery_task_duration_ms` | Histogram | queue, task_name | Task execution time |
| `db_queries_total` | Counter | module, operation | Query count per request |
| `db_query_duration_ms` | Histogram | module, operation | Slow query detection |
| `cache_hit_ratio` | Gauge | cache_name | Cache effectiveness |
| `rls_policy_hits` | Counter | table_name | RLS policy evaluation count |
| `ai_tokens_total` | Counter | model, feature, org | Token usage tracking |

### 9.4 Tracing

Every request and background job generates a trace:

```
Request: POST /api/v1/leads/
  │
  ├── Middleware: 2ms
  ├── Auth: 5ms
  ├── Tenant Resolution: 1ms
  ├── View: LeadViewSet.create: 10ms
  │   ├── Serializer validation: 3ms
  │   └── Service: CreateLeadService.execute: 45ms
  │       ├── Repository.save: 20ms
  │       │   └── DB INSERT: 15ms
  │       ├── EventPublisher.publish: 5ms
  │       │   └── Redis XADD: 3ms
  │       └── Cache.invalidate: 2ms
  └── Response serialization: 2ms
Total: 70ms
```

### 9.5 SLOs

| Service | SLO | Measurement | Burn Rate Alert |
|---------|-----|------------|-----------------|
| API (p95 latency) | < 500ms | Histogram | 2% exceedance over 1h |
| API (error rate) | < 0.1% | Counter | 0.5% over 5 min |
| Workflow execution | < 5s from event → action | Histogram | 10% over 10s |
| Email delivery | < 60s from trigger → SMTP | Histogram | 5% over 120s |
| Report execution | < 30s for 500k rows | Histogram | 5% over 60s |
| AI inference | < 2s p95 | Histogram | 10% over 5s |
| DB query (p99) | < 100ms | Histogram | 1% over 500ms |
| Uptime | 99.95% | Blackbox | Any 5-min downtime |

### 9.6 Alerting

| Severity | Response Time | Examples |
|----------|--------------|---------|
| **Critical** | < 15 min | RLS policy failure, DB connection loss, 5xx rate > 5% |
| **High** | < 30 min | p95 latency > 1s, Celery queue backlog > 10k, dead-letter events > 100 |
| **Medium** | < 4 hours | Cache hit ratio < 50%, error rate > 0.5%, disk > 80% |
| **Low** | < 24 hours | SSL cert expiry < 30 days, unused indexes, slow migrations |

---

## 10. Deployment Architecture

### 10.1 Environment Strategy

| Environment | Purpose | Infrastructure | Data |
|------------|---------|---------------|------|
| **local** | Developer machine | Docker Compose | Fresh DB per `make dev` |
| **dev** | Shared development | Single-node Docker | Anonymized production copy (weekly refresh) |
| **staging** | Pre-production validation | K8s (3-node) | Anonymized production copy (bi-weekly) |
| **production** | Live customer traffic | K8s (multi-node, multi-AZ) | Real customer data |
| **dr** | Disaster recovery | K8s (secondary region) | WAL streaming from primary |

### 10.2 CI/CD Pipeline

```
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│  PR      │   │  Lint    │   │  Test    │   │  Build   │   │  Deploy  │
│  Created │──►│ + Type   │──►│ + Cover  │──►│  Image   │──►│  to      │
│          │   │          │   │          │   │          │   │  Staging │
└──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘
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

### 10.3 Container Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                          Kubernetes Cluster                     │
│                                                                  │
│  ┌────────────────────┐  ┌────────────────────┐                 │
│  │  Django Pod        │  │  Django Pod        │  ...            │
│  │  - Gunicorn        │  │  - Gunicorn        │                 │
│  │  - Uvicorn (ASGI)  │  │  - Uvicorn (ASGI)  │                 │
│  └────────────────────┘  └────────────────────┘                 │
│                                                                  │
│  ┌────────────────────┐  ┌────────────────────┐                 │
│  │  Celery Worker Pod │  │  Celery Worker Pod │  ...            │
│  │  - workflow queue  │  │  - notify queue    │                 │
│  └────────────────────┘  └────────────────────┘                 │
│                                                                  │
│  ┌────────────────────┐  ┌────────────────────┐                 │
│  │  AI Gateway Pod    │  │  AI Gateway Pod    │  ...            │
│  │  - FastAPI         │  │  - FastAPI         │                 │
│  └────────────────────┘  └────────────────────┘                 │
│                                                                  │
│  ┌────────────────────┐  ┌────────────────────┐                 │
│  │  PostgreSQL         │  │  Redis             │                 │
│  │  (StatefulSet)      │  │  (StatefulSet)     │                 │
│  └────────────────────┘  └────────────────────┘                 │
│                                                                  │
│  ┌────────────────────┐  ┌────────────────────┐                 │
│  │  MinIO              │  │  Pgbouncer         │                 │
│  │  (StatefulSet)      │  │  (Deployment)      │                 │
│  └────────────────────┘  └────────────────────┘                 │
└─────────────────────────────────────────────────────────────────┘
```

### 10.4 Scaling Strategy

| Component | Scale Trigger | Action |
|-----------|--------------|--------|
| Django (API) | CPU > 70% OR p95 > 500ms | HPA: increase replicas |
| Celery (Workflow) | Queue depth > 1000 | HPA: increase worker replicas |
| Celery (Reports) | Queue depth > 100 | HPA: increase worker replicas |
| AI Gateway | CPU > 60% OR queue > 50 | HPA: increase replicas |
| PostgreSQL | Connection > 200 OR CPU > 70% | Vertical: larger instance; then read replicas |
| Redis | Memory > 80% | Vertical: larger instance; then cluster mode |

---

## 11. Evolution Strategy

### 11.1 When to Extract a Microservice

A module stays in the monolith until the evidence says otherwise:

| Condition | Decision |
|-----------|----------|
| Module requires independent scaling (different from monolith) | Extract to service |
| Module needs a different tech stack (e.g., AI Gateway) | Extract to service |
| Module team wants independent deploy cadence | Extract to service |
| Module has a different latency/resource profile | Extract to service |
| "It might be faster as a service" (no data) | Stay in monolith |
| "It will be cleaner as a service" (no coupling evidence) | Stay in monolith |

### 11.2 Service Extraction Pattern

When extraction is justified, follow this pattern:

1. **Strangler Fig:** Add a facade in the monolith that routes requests to the new service
2. **Dual Write:** Write to both old and new; compare results in staging
3. **Verify Parity:** Automated comparison of monolith vs. service responses
4. **Cut Over:** Route all traffic to new service; keep monolith read-only for fallback
5. **Remove:** Delete the extracted code from the monolith

### 11.3 Technology Radar

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
| React + Redux Toolkit | **Adopt** | Frontend SPA |
| Material UI (MUI) | **Adopt** | Frontend component library |
| FastAPI | **Trial** | AI Gateway sidecar |
| LangChain | **Trial** | LLM orchestration, tool-calling, agent framework |
| OpenAI (GPT-4o) | **Trial** | Primary LLM provider |
| pgvector | **Trial** | Vector embeddings + semantic search |
| Flower | **Trial** | Celery monitoring |
| Docker + Kubernetes | **Trial** | Container orchestration |
| Temporal | **Assess** | Complex workflow orchestration (Phase 5+) |
| Elasticsearch | **Assess** | If PostgreSQL full-text search insufficient |
| MCP (Model Context Protocol) | **Assess** | Standardized AI tool exposure |
| gRPC | **Assess** | Internal service-to-service if microservices emerge |

---

> **This document describes the system as architected, not as built.**
> Implementation details may vary per phase, but the principles, patterns,
> and security model documented here are binding. Any deviation requires
> a new Architecture Decision Record (ADR).
