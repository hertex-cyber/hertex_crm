# TZAHU CRM — System Architecture (C4 Model)

> **Version:** 0.1.0-draft
> **Last Updated:** 2026-07-27
> **Status:** Foundational Design Phase
> **Owner:** Platform Architecture Team

---

## Table of Contents

1. [System Context Diagram (C4 Level 1)](#1-system-context-diagram-c4-level-1)
2. [Container Diagram (C4 Level 2)](#2-container-diagram-c4-level-2)
3. [Component Diagram (C4 Level 3)](#3-component-diagram-c4-level-3)
4. [Deployment Diagram](#4-deployment-diagram)
5. [Request Flow](#5-request-flow)
6. [Event Flow](#6-event-flow)
7. [AI Flow](#7-ai-flow)
8. [Celery Task Flow](#8-celery-task-flow)

---

## 1. System Context Diagram (C4 Level 1)

```
                         ┌──────────────────────────────────────────┐
                         │           TZAHU CRM System               │
                         │  "AI-first multi-tenant enterprise CRM"  │
                         └──────────────────────────────────────────┘
                                     │              │
            ┌────────────────────────┼──────────────┼──────────────────┐
            │                        │              │                  │
            ▼                        ▼              ▼                  ▼
┌───────────────────┐   ┌───────────────────┐   ┌────────────┐   ┌────────────┐
│   Sales Rep       │   │  Sales Manager    │   │   Admin    │   │ System     │
│   (Web + Mobile)  │   │  (Web)            │   │   (Web)    │   │ Admin      │
└────────┬──────────┘   └────────┬──────────┘   └──────┬─────┘   └──────┬─────┘
         │                       │                     │                │
         └───────────────────────┼─────────────────────┼────────────────┘
                                 │                     │
         ┌───────────────────────┼─────────────────────┼────────────────┐
         │                       │                     │                │
         │                       ▼                     ▼                │
         │              ┌────────────────────────────────────┐          │
         │              │          TZAHU CRM System          │          │
         │              │  [Django] CRM Backend + REST API   │          │
         │              │  [FastAPI] AI Gateway Sidecar      │          │
         │              │  [Celery] Background Task Workers  │          │
         │              │  [React] Web Application           │          │
         │              └────────────────────────────────────┘          │
         │                       │           │                          │
         │         ┌─────────────┴───────────┴──────────────┐           │
         │         │                                        │           │
         │         ▼                                        ▼           │
         │  ┌────────────────────┐                ┌────────────────────┐ │
         │  │ Email System       │                │ SMS System         │ │
         │  │ [SendGrid / SES]   │                │ [Twilio]           │ │
         │  └────────────────────┘                └────────────────────┘ │
         │         │                                        │           │
         │         ▼                                        ▼           │
         │  ┌────────────────────┐                ┌────────────────────┐ │
         │  │ AI Provider        │                │ Calendar Provider  │ │
         │  │ [OpenAI / Anthropic]│               │ [Google / MS]      │ │
         │  └────────────────────┘                └────────────────────┘ │
         │         │                                        │           │
         │         ▼                                        ▼           │
         │  ┌────────────────────┐                ┌────────────────────┐ │
         │  │ Slack / Teams      │                │ HubSpot / Others   │ │
         │  └────────────────────┘                └────────────────────┘ │
         └──────────────────────────────────────────────────────────────┘
```

### External Systems

| System | Description | Interaction |
|--------|-------------|-------------|
| PostgreSQL 16 + pgvector | Primary database + vector embeddings | Native TCP via Pgbouncer |
| Redis 7 | Cache, rate limiter, WebSocket channel, session store | Native TCP |
| RabbitMQ 3.13+ | Celery broker + domain event bus | AMQP 0-9-1 |
| MinIO | S3-compatible file storage | S3 API |
| SendGrid / SES | Transactional email delivery | SMTP / HTTPS |
| Twilio | SMS and voice communication | REST API |
| OpenAI / Anthropic | LLM APIs for AI features | HTTPS |
| Google / Microsoft | Calendar, Contacts, SSO integration | OAuth 2.0 + REST API |
| Slack / Teams | Notifications and workflow triggers | Webhook + REST API |

---

## 2. Container Diagram (C4 Level 2)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Load Balancer / CDN                                 │
│                     AWS CloudFront + ALB / nginx                             │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ [Container: Web Application]  React + TypeScript + Vite                     │
│                                                                              │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐  │
│  │  TanStack Query     │  │  Zustand (Client    │  │  React Router       │  │
│  │  (Server State)     │  │  State)             │  │  (Routing)          │  │
│  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘  │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐  │
│  │  MUI Components     │  │  React Hook Form    │  │  axios (HTTP)       │  │
│  │  (Design System)    │  │  + Zod (Validation) │  │                     │  │
│  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ [Container: Django Application]  Python 3.13 + Django 5.x                    │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  Gunicorn (WSGI) — 4-8 workers per pod                               │   │
│  │  Uvicorn (ASGI) — WebSocket workers via Django Channels              │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  Middleware Stack                                                     │   │
│  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌────────┐ ┌──────┐ ┌──────────────┐   │   │
│  │  │CORS  │ │Securi│ │Auth  │ │Tenant  │ │Log   │ │Rate Limit    │   │   │
│  │  │      │ │ty    │ │(JWT) │ │(RLS)   │ │      │ │(Redis-backed)│   │   │
│  │  └──────┘ └──────┘ └──────┘ └────────┘ └──────┘ └──────────────┘   │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  URL Router                                                           │   │
│  │  /auth/*  /api/v1/*  /admin/*  /ws/*  /health/*  /public/*          │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  Module Viewsets (DRF)                                                │   │
│  │  identity: AuthViewSet, UserViewSet                                  │   │
│  │  organization: OrgViewSet, MembershipViewSet                          │   │
│  │  rbac: RoleViewSet, PermissionViewSet                                 │   │
│  │  lead_management: LeadViewSet, ContactViewSet, AccountViewSet         │   │
│  │  pipeline_management: PipelineViewSet, OpportunityViewSet             │   │
│  │  activity: ActivityViewSet, TaskViewSet                               │   │
│  │  workflow: WorkflowViewSet, ExecutionViewSet                          │   │
│  │  notification: NotificationViewSet, PreferenceViewSet                 │   │
│  │  reports: ReportViewSet, DashboardViewSet                             │   │
│  │  integrations: ConnectorViewSet, WebhookViewSet                       │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  Application Services                                                │   │
│  │  LeadService → CreateLeadCommand → CreateLeadHandler                 │   │
│  │  ContactService → MergeContactsCommand → MergeContactsHandler        │   │
│  │  WorkflowService → EvaluateWorkflowCommand → ExecuteActionsHandler   │   │
│  │  ... (one service class per bounded context)                         │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  Domain Layer (Pure Python, no Django imports)                       │   │
│  │  Entities | Value Objects | Aggregate Roots | Domain Events         │   │
│  │  Domain Exceptions | Domain Services                                 │   │
│  │  Lead, Contact, Account, Opportunity, Task, Workflow, etc.          │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  Infrastructure Layer (Django-aware)                                 │   │
│  │  ORM Models → Repositories → Selectors → Event Handlers             │   │
│  │  TenantScopedModel → UUIDModel → TimestampedModel → SoftDeleteModel │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────┬─────────────────────────────────────┘
                                        │
        ┌───────────────────────────────┼───────────────────────────────┐
        ▼                               ▼                               ▼
┌───────────────────┐       ┌───────────────────┐       ┌─────────────────────┐
│ [Container:       │       │ [Container:       │       │ [Container:         │
│  PostgreSQL 16]   │       │  Redis 7]         │       │  RabbitMQ 3.13]     │
│                   │       │                   │       │                     │
│ • Relational data │       │ • Cache (DB 0)    │       │ • Celery broker     │
│ • pgvector        │       │ • Rate limit(DB 1)│       │ • Domain event bus  │
│ • RLS enforcement │       │ • Sessions (DB 2) │       │ • DLX for failures  │
│ • Full-text search│       │ • WS channel(DB 3)│       │ • HA queue mirroring│
│ • pg_trgm         │       │ • Idempotency(DB4)│       │ • Publisher confirms│
└───────────────────┘       └───────────────────┘       └──────────┬──────────┘
                                                                   │
                                                                   ▼
                                          ┌───────────────────────────────────┐
                                          │ [Container: Celery Workers]       │
                                          │                                   │
                                          │  ┌──────────┐ ┌────────────────┐  │
                                          │  │ Workflow  │ │ Notification   │  │
                                          │  │ Queue     │ │ Queue          │  │
                                          │  └──────────┘ └────────────────┘  │
                                          │  ┌──────────┐ ┌────────────────┐  │
                                          │  │ Reports  │ │ Integrations   │  │
                                          │  │ Queue    │ │ Queue          │  │
                                          │  └──────────┘ └────────────────┘  │
                                          │  ┌──────────┐ ┌────────────────┐  │
                                          │  │ Imports  │ │ Default        │  │
                                          │  │ Queue    │ │ Queue          │  │
                                          │  └──────────┘ └────────────────┘  │
                                          └───────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ [Container: AI Gateway]  FastAPI Sidecar                                    │
│                                                                              │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────┐   │
│  │ LLM Proxy Service    │  │ Embedding Service    │  │ RAG Service      │   │
│  │ • Provider routing   │  │ • Text → vector(1536)│  │ • Document chunk │   │
│  │ • Retry + fallback   │  │ • Batch embedding    │  │ • Hybrid search  │   │
│  │ • Prompt injection   │  │ • Model versioning   │  │ • Re-ranking     │   │
│  │ • Streaming via SSE  │  │                      │  │ • Context window │   │
│  └──────────────────────┘  └──────────────────────┘  └──────────────────┘   │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────┐   │
│  │ MCP Server           │  │ Sentiment Analysis   │  │ Prompt Manager   │   │
│  │ • Tool discovery     │  │ • Text classification│  │ • Versioning     │   │
│  │ • Tool execution     │  │ • Entity extraction  │  │ • A/B testing    │   │
│  │ • Standard protocol  │  │ • Trend detection    │  │ • Template lib   │   │
│  └──────────────────────┘  └──────────────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ [Container: MinIO]  S3-Compatible Object Storage                            │
│                                                                              │
│  /media/{org_id}/{entity_type}/{entity_id}/{filename}                       │
│  • User avatars, file attachments, report exports, call recordings          │
│  • SSE-S3 encryption at rest (AES-256)                                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Container Summary

| Container | Technology | Scaling | Replicas (prod) |
|-----------|-----------|---------|----------------|
| Web Application | React + TypeScript + Vite | CDN + S3 static hosting | N/A (static) |
| Django Application | Python 3.13 + Django 5.x | HPA (CPU > 70%) | 4-12 |
| Celery Workers | Python 3.13 + Celery 5.x | HPA (queue depth) | 2-8 per queue |
| AI Gateway | Python 3.13 + FastAPI | HPA (CPU > 60%) | 2-6 |
| PostgreSQL 16 | PostgreSQL 16 + pgvector | Vertical + read replicas | 1 primary + N replicas |
| Redis 7 | Redis 7 | Vertical + cluster mode | 3-node cluster |
| RabbitMQ | RabbitMQ 3.13 | HA queue mirroring | 3-node cluster |
| MinIO | MinIO | Distributed mode | 4 nodes |

---

## 3. Component Diagram (C4 Level 3)

### 3.1 Django Monolith Internal Structure

```
┌──────────────────────────────────────────────────────────────────────────┐
│                      Django Application Container                         │
│                                                                           │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  Middleware Layer                                                   │  │
│  │                                                                     │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │  │
│  │  │ CorsMiddleware│  │SecurityMiddle│  │AuthMiddleware (jwt)     │  │  │
│  │  │ • CORS headers│  │ • HSTS       │  │ • Verify JWT signature  │  │  │
│  │  │ • Allowed     │  │ • XSS protect│  │ • Extract user/org      │  │  │
│  │  │   origins     │  │ • CSP headers│  │ • Validate membership   │  │  │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘  │  │
│  │                                                                     │  │
│  │  ┌────────────────────────────┐  ┌──────────────────────────────┐  │  │
│  │  │TenantMiddleware (RLS)      │  │LoggingMiddleware             │  │  │
│  │  │ • Set app.current_org_id   │  │ • Request ID generation      │  │  │
│  │  │ • Validate tenant active   │  │ • structlog context          │  │  │
│  │  │ • Check tenant suspension  │  │ • Duration tracking          │  │  │
│  │  └────────────────────────────┘  └──────────────────────────────┘  │  │
│  │                                                                     │  │
│  │  ┌────────────────────────────┐  ┌──────────────────────────────┐  │  │
│  │  │RateLimitMiddleware         │  │OpenTelemetryMiddleware       │  │  │
│  │  │ • Redis-backed rate limiter│  │ • Span creation              │  │  │
│  │  │ • Tiered by plan tier      │  │ • HTTP attributes            │  │  │
│  │  │ • Per-endpoint limits      │  │ • Context propagation        │  │  │
│  │  └────────────────────────────┘  └──────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                    │                                     │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  Routing Layer                                                      │  │
│  │                                                                     │  │
│  │  ┌─────────────┐  ┌────────────────┐  ┌────────────┐  ┌─────────┐  │  │
│  │  │ /api/v1/*   │  │ /admin/*       │  │ /ws/*      │  │ /health │  │  │
│  │  │ DRF Routers  │  │ Django Admin  │  │ Channels   │  │ Health  │  │  │
│  │  └─────────────┘  └────────────────┘  └────────────┘  └─────────┘  │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                    │                                     │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  API Layer (per module)                                            │  │
│  │                                                                     │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │  │
│  │  │ ViewSets     │  │ Serializers  │  │ Permissions  │             │  │
│  │  │ • CRUD views │  │ • Input val  │  │ • RBAC check │             │  │
│  │  │ • Actions    │  │ • Output fmt │  │ • Scope      │             │  │
│  │  │ • Filters    │  │ • Nested     │  │ • Ownership  │             │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘             │  │
│  │                                                                     │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │  │
│  │  │ Filtersets   │  │ Pagination   │  │ OpenAPI      │             │  │
│  │  │ • django-flt │  │ • Cursor     │  │ • drf-spect  │             │  │
│  │  │ • Custom flt │  │ • Page       │  │ • Schema gen │             │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘             │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                    │                                     │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  Application Layer (per module)                                    │  │
│  │                                                                     │  │
│  │  ┌────────────────────────┐  ┌──────────────────────────┐          │  │
│  │  │ Service Classes         │  │ Command / Query Handlers │          │  │
│  │  │ • LeadService           │  │ • CreateLeadCommand     │          │  │
│  │  │ • ContactService        │  │ • UpdateLeadCommand     │          │  │
│  │  │ • WorkflowService       │  │ • ConvertLeadCommand    │          │  │
│  │  │ • NotificationService   │  │ • GetLeadQuery          │          │  │
│  │  └────────────────────────┘  └──────────────────────────┘          │  │
│  │                                                                     │  │
│  │  ┌────────────────────────┐  ┌──────────────────────────┐          │  │
│  │  │ DTOs / Input Ports     │  │ Event Publishers         │          │  │
│  │  │ • CreateLeadDTO        │  │ • EventPublisher port   │          │  │
│  │  │ • LeadResponseDTO      │  │ • RabbitMQPublisher     │          │  │
│  │  │ • SearchCriteriaDTO    │  │ • InProcessPublisher    │          │  │
│  │  └────────────────────────┘  └──────────────────────────┘          │  │
│  │                                                                     │  │
│  │  ┌──────────────────────────────────────────────────────────────┐  │  │
│  │  │  Unit of Work / Transaction Management                       │  │  │
│  │  │  • One service method = one transaction                      │  │  │
│  │  │  • Events collected and published after commit               │  │  │
│  │  └──────────────────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                    │                                     │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  Domain Layer (Pure Python, no framework imports)                  │  │
│  │                                                                     │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │  │
│  │  │ AggregateRoots│  │ Entities     │  │ ValueObjects │             │  │
│  │  │ • Lead        │  │ • Session    │  │ • Email      │             │  │
│  │  │ • Contact     │  │ • Activity   │  │ • Phone      │             │  │
│  │  │ • Opportunity │  │ • Task       │  │ • Money      │             │  │
│  │  │ • Workflow    │  │ • Stage      │  │ • Address    │             │  │
│  │  │ • Organization│  │              │  │ • PersonName │             │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘             │  │
│  │                                                                     │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │  │
│  │  │ DomainEvents  │  │ Domain       │  │ Repository   │             │  │
│  │  │ • LeadCreated │  │ Exceptions   │  │ Ports (interf)│             │  │
│  │  │ • LeadConvert │  │ • LeadNot    │  │ • LeadRepo   │             │  │
│  │  │ • OppWon      │  │   FoundError │  │ • ContactRepo│             │  │
│  │  │ • TaskComplete│  │ • Invalid    │  │ • WorkflowRep│             │  │
│  │  │ • EmailSent   │  │   Transition │  │ • etc        │             │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘             │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                    │                                     │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  Infrastructure Layer (per module)                                 │  │
│  │                                                                     │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │  │
│  │  │ ORM Models   │  │ Repositories │  │ Selectors    │             │  │
│  │  │ • LeadModel   │  │ • LeadRepo   │  │ • LeadSearch │             │  │
│  │  │ • ContactModel│  │ • ContactRepo│  │ • PipelineSum│             │  │
│  │  │ • migrations  │  │ (implement   │  │ • ForecastQry│             │  │
│  │  └──────────────┘  │  ports)      │  └──────────────┘             │  │
│  │                     └──────────────┘                               │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐    │  │
│  │  │ EventHandlers│  │ Admin Config │  │ Management Commands  │    │  │
│  │  │ • Handle     │  │ • ModelAdmin │  │ • bulk_import        │    │  │
│  │  │   LeadCreated│  │ • Inlines    │  │ • recalculate_scores │    │  │
│  │  │ • Handle     │  │ • List filters│  │ • sync_embeddings   │    │  │
│  │  │   OppWon     │  └──────────────┘  └──────────────────────┘    │  │
│  │  └──────────────┘                                                 │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Module Cross-Section (lead_management example)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Module: lead_management                                                   │
│                                                                           │
│  api/                                                                     │
│  ├── views.py        → LeadViewSet, ContactViewSet, AccountViewSet      │
│  ├── serializers.py  → LeadSerializer, LeadListSerializer, LeadImport    │
│  ├── permissions.py  → LeadPermission, ContactPermission                 │
│  ├── filters.py      → LeadFilterSet, ContactFilterSet                   │
│  ├── urls.py         → router.register('leads', LeadViewSet)            │
│  └── openapi.py      → Extended schema for drf-spectacular              │
│                                                                           │
│  application/                                                             │
│  ├── services.py     → LeadService, ContactService, LeadScoringService  │
│  ├── commands.py     → CreateLeadCommand, UpdateLeadCommand,            │
│  │                     ConvertLeadCommand, AssignLeadCommand             │
│  ├── queries.py      → GetLeadQuery, SearchLeadsQuery,                  │
│  │                     GetLeadTimelineQuery                              │
│  └── dto.py          → CreateLeadDTO, LeadResponseDTO, LeadListDTO      │
│                                                                           │
│  domain/                                                                  │
│  ├── models.py       → Lead( AggregateRoot), Contact(AggregateRoot),    │
│  │                     Account(AggregateRoot)                            │
│  ├── value_objects.py→ LeadSource, LeadScore, LeadStatus,               │
│  │                     ContactPreference                                 │
│  ├── events.py       → LeadCreated, LeadUpdated, LeadConverted,         │
│  │                     LeadAssigned, LeadScored                          │
│  ├── exceptions.py   → LeadNotFoundError, InvalidTransitionError,       │
│  │                     DuplicateLeadError                                │
│  └── services.py     → LeadDeduplicationService, LeadScoringService     │
│                                                                           │
│  infrastructure/                                                          │
│  ├── models.py       → LeadModel, ContactModel, AccountModel            │
│  ├── repositories.py → DjangoLeadRepository, DjangoContactRepository    │
│  ├── selectors.py    → LeadSearchSelector, LeadTimelineSelector         │
│  ├── admin.py        → LeadModelAdmin, ContactModelAdmin                │
│  └── migrations/     → 0001_initial.py, ...                             │
│                                                                           │
│  adapters/                                                                │
│  └── event_handlers.py → handle_workflow_execution_on_lead_created      │
│                                                                           │
│  tests/                                                                   │
│  ├── domain/         → test_lead.py, test_value_objects.py              │
│  ├── application/    → test_services.py, test_commands.py               │
│  ├── infrastructure/ → test_repositories.py, test_selectors.py          │
│  └── api/            → test_lead_api.py, test_contact_api.py            │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Deployment Diagram

### 4.1 AWS Multi-Region Architecture

```
                                  ┌─────────────────────────────────────┐
                                  │           AWS Route 53              │
                                  │   (DNS: *.tzahu.com, api.tzahu.com) │
                                  │   • Latency-based routing           │
                                  │   • Health check → failover         │
                                  └────────────────┬────────────────────┘
                                                   │
                     ┌─────────────────────────────┼─────────────────────────────┐
                     │                             │                             │
                     ▼                             ▼                             ▼
          ┌────────────────────┐        ┌────────────────────┐       ┌────────────────────┐
          │    AWS CloudFront   │        │    AWS CloudFront   │       │   AWS CloudFront    │
          │   (Global)          │        │   (Global)          │       │   (Global)          │
          │   Static assets     │        │   API caching       │       │   CDN fallback      │
          └────────────────────┘        └────────────────────┘       └────────────────────┘
                     │                             │                             │
                     ▼                             ▼                             ▼
          ┌──────────────────────────────────────────────────────────────────────┐
          │                       AWS WAF (Web Application Firewall)              │
          │        • SQL injection prevention  • XSS blocking  • Rate-based rules │
          └──────────────────────────────────────────────────────────────────────┘
                                          │
                     ┌────────────────────┼────────────────────┐
                     │                    │                    │
                     ▼                    ▼                    ▼
          ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐
          │ Region: us-east-1  │  │ Region: eu-west-1 │  │ Region: ap-south-1│
          │ (Primary)          │  │ (Active-Active)   │  │ (Active-Active)   │
          └────────────────────┘  └────────────────────┘  └────────────────────┘
                     │                    │                    │
          ┌──────────┴──────────┐  ┌──────┴───────┐  ┌───────┴───────┐
          ▼                     ▼  ▼              ▼  ▼               ▼
   ┌──────────────┐     ┌─────────────────────┐  ┌─────────────────────┐
   │  Public      │     │  Private Subnets     │  │  Private Subnets    │
   │  Subnet      │     │                      │  │                     │
   │              │     │  ┌────────────────┐  │  │  ┌────────────────┐ │
   │  ┌────────┐  │     │  │ EKS Cluster    │  │  │  │ EKS Cluster    │ │
   │  │ALB /   │  │────►│  │ (K8s 1.30+)    │  │  │  │ (K8s 1.30+)    │ │
   │  │nigma   │  │     │  │                │  │  │  │                │ │
   │  └────────┘  │     │  │ ┌────────────┐ │  │  │  │ ┌────────────┐ │ │
   └──────────────┘     │  │ │Django Pods │ │  │  │  │ │Django Pods │ │ │
                        │  │ │(HPA 4-12)  │ │  │  │  │ │(HPA 4-12)  │ │ │
                        │  │ └────────────┘ │  │  │  │ └────────────┘ │ │
                        │  │ ┌────────────┐ │  │  │  │ ┌────────────┐ │ │
                        │  │ │Celery Pods │ │  │  │  │ │Celery Pods │ │ │
                        │  │ │(per queue) │ │  │  │  │ │(per queue) │ │ │
                        │  │ └────────────┘ │  │  │  │ └────────────┘ │ │
                        │  │ ┌────────────┐ │  │  │  │ ┌────────────┐ │ │
                        │  │ │AI Gateway  │ │  │  │  │ │AI Gateway  │ │ │
                        │  │ │Pods (HPA)  │ │  │  │  │ │Pods (HPA)  │ │ │
                        │  │ └────────────┘ │  │  │  │ └────────────┘ │ │
                        │  │ ┌────────────┐ │  │  │  │ ┌────────────┐ │ │
                        │  │ │Pgbouncer   │ │  │  │  │ │Pgbouncer   │ │ │
                        │  │ │Deployment  │ │  │  │  │ │Deployment  │ │ │
                        │  │ └────────────┘ │  │  │  │ └────────────┘ │ │
                        │  └────────────────┘  │  │  └────────────────┘ │
                        │                      │  │                     │
                        │  ┌────────────────┐  │  │  ┌────────────────┐ │
                        │  │ Data Subnets   │  │  │  │ Data Subnets   │ │
                        │  │                │  │  │  │                │ │
                        │  │ ┌────────────┐ │  │  │  │ ┌────────────┐ │ │
                        │  │ │PostgreSQL  │ │  │  │  │ │PostgreSQL  │ │ │
                        │  │ │Primary     │ │  │  │  │ │Read Replica│ │ │
                        │  │ │(StatefulSet)│ │  │  │  │ │(StatefulSet)│ │
                        │  │ └────────────┘ │  │  │  │ └────────────┘ │ │
                        │  │ ┌────────────┐ │  │  │  │ ┌────────────┐ │ │
                        │  │ │Redis       │ │  │  │  │ │Redis       │ │ │
                        │  │ │Cluster     │ │  │  │  │ │Cluster     │ │ │
                        │  │ │(3 nodes)   │ │  │  │  │ │(3 nodes)   │ │ │
                        │  │ └────────────┘ │  │  │  │ └────────────┘ │ │
                        │  │ ┌────────────┐ │  │  │  │ ┌────────────┐ │ │
                        │  │ │RabbitMQ    │ │  │  │  │ │RabbitMQ    │ │ │
                        │  │ │Cluster     │ │  │  │  │ │Cluster     │ │ │
                        │  │ │(3 nodes)   │ │  │  │  │ │(3 nodes)   │ │ │
                        │  │ └────────────┘ │  │  │  │ └────────────┘ │ │
                        │  │ ┌────────────┐ │  │  │  │ ┌────────────┐ │ │
                        │  │ │MinIO       │ │  │  │  │ │MinIO       │ │ │
                        │  │ │(4 nodes)   │ │  │  │  │ │(4 nodes)   │ │ │
                        │  │ └────────────┘ │  │  │  │ └────────────┘ │ │
                        │  └────────────────┘  │  │  └────────────────┘ │
                        └─────────────────────┘  └─────────────────────┘
```

### 4.2 K8s Namespace Layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Cluster: tzahu-prod                                                      │
│                                                                           │
│  Namespace: tzahu-backend                                                 │
│  ├── Deployment: django-app (4-12 replicas, HPA)                        │
│  ├── Deployment: celery-worker-workflow (2-8 replicas, HPA)             │
│  ├── Deployment: celery-worker-notification (2-4 replicas, HPA)         │
│  ├── Deployment: celery-worker-reports (1-4 replicas, HPA)              │
│  ├── Deployment: celery-worker-integrations (1-4 replicas, HPA)         │
│  ├── Deployment: celery-beat (1 replica)                                │
│  ├── Deployment: pgbouncer (2-4 replicas, HPA)                          │
│  └── ConfigMap: django-config, celery-config                             │
│                                                                           │
│  Namespace: tzahu-ai                                                      │
│  ├── Deployment: ai-gateway (2-6 replicas, HPA)                         │
│  └── ConfigMap: ai-config, prompt-templates                              │
│                                                                           │
│  Namespace: tzahu-data                                                    │
│  ├── StatefulSet: postgresql (1 primary, 0-2 replicas)                  │
│  ├── StatefulSet: redis-cluster (3 nodes, 3 replicas)                   │
│  ├── StatefulSet: rabbitmq (3 nodes)                                    │
│  ├── StatefulSet: minio (4 nodes)                                       │
│  └── PVCs: postgresql-data, minio-data, rabbitmq-data                   │
│                                                                           │
│  Namespace: tzahu-integrations                                            │
│  ├── Deployment: webhook-receiver (2-4 replicas)                        │
│  └── ConfigMap: webhook-config                                           │
│                                                                           │
│  Namespace: tzahu-observability                                          │
│  ├── Prometheus Operator                                                 │
│  ├── Grafana (with dashboards)                                           │
│  ├── OpenTelemetry Collector                                             │
│  ├── Loki (log aggregation)                                              │
│  └── Tempo (trace storage)                                               │
│                                                                           │
│  Namespace: tzahu-ingress                                                 │
│  └── Ingress Controller (nginx-ingress)                                  │
└──────────────────────────────────────────────────────────────────────────┘
```

### 4.3 K8s Resource Specifications

| Component | CPU Request | CPU Limit | Memory Request | Memory Limit | Storage |
|-----------|-------------|-----------|----------------|--------------|---------|
| Django App | 500m | 2 | 512Mi | 2Gi | N/A |
| Celery Worker (Workflow) | 500m | 2 | 512Mi | 2Gi | N/A |
| Celery Worker (Reports) | 1 | 4 | 1Gi | 4Gi | N/A |
| AI Gateway | 1 | 4 | 1Gi | 4Gi | N/A |
| Pgbouncer | 200m | 500m | 256Mi | 512Mi | N/A |
| PostgreSQL | 2 | 8 | 4Gi | 16Gi | 100Gi (gp3) |
| Redis | 1 | 4 | 2Gi | 8Gi | 50Gi (gp3) |
| RabbitMQ | 500m | 2 | 1Gi | 4Gi | 20Gi (gp3) |
| MinIO | 1 | 4 | 2Gi | 8Gi | 500Gi (gp3) |

---

## 5. Request Flow

### 5.1 Full Request Lifecycle

```
User Browser / Mobile App / API Client
        │
        │ HTTPS (TLS 1.3)
        ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ 1. DNS Resolution                                                         │
│    Route53 → CloudFront (closest edge) | Route53 → ALB (direct API)     │
└──────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ 2. CloudFront (CDN)                                                       │
│    • Static assets: /assets/* → served from edge cache                  │
│    • API requests: /api/* → forward to ALB                              │
│    • Cache hit → return cached response (304)                           │
│    • Cache miss → forward to origin (ALB)                               │
└──────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ 3. AWS ALB (Application Load Balancer)                                   │
│    • TLS termination (SSL certificate from ACM)                         │
│    • Path-based routing: /api/* → Django target group                   │
│    • WebSocket upgrade: /ws/* → Django target group                     │
│    • Health check: /health/ → skip middleware                           │
│    • X-Forwarded-For, X-Forwarded-Proto headers added                   │
└──────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ 4. nginx (Sidecar Container in Django Pod)                               │
│    • Rate limiting (per IP, per path)                                   │
│    • Request size limit enforcement (10MB default)                      │
│    • Static file serving (/static/ → Django collectstatic)              │
│    • Proxy pass to Gunicorn socket (for WSGI)                          │
│    • Proxy pass to Uvicorn (for ASGI/WebSocket)                         │
│    • Add security headers: X-Content-Type-Options, HSTS, CSP           │
└──────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ 5. Gunicorn / Uvicorn (WSGI/ASGI Server)                                 │
│    • Gunicorn: synchronous HTTP requests (4-8 workers per pod)          │
│    • Uvicorn: ASGI for WebSocket connections (Django Channels)          │
│    • Connection pooling to PostgreSQL via Pgbouncer                     │
└──────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ 6. Django Middleware Stack (order matters)                                │
│                                                                           │
│    a) SecurityMiddleware                                                  │
│       • HSTS header → Strict-Transport-Security: max-age=31536000      │
│       • XSS protection → X-XSS-Protection: 1; mode=block               │
│       • Content-Type sniffing → X-Content-Type-Options: nosniff        │
│       • Content Security Policy → Content-Security-Policy header       │
│                                                                           │
│    b) CorsMiddleware                                                     │
│       • Check Origin against allowed origins list                       │
│       • Add CORS headers: Access-Control-Allow-Origin, etc.            │
│       • Preflight (OPTIONS) → return 200 with CORS headers             │
│                                                                           │
│    c) AuthMiddleware (JWT)                                               │
│       • Extract Authorization: Bearer <token>                           │
│       • Verify JWT signature (RS256, public key from memory)            │
│       • Check expiry (iat, exp), check jti in Redis revocation list    │
│       • Decode payload → user_id, org_id, permissions                  │
│       • Set request.user, request.auth                                 │
│       • Skip for: /auth/login, /auth/register, /public/*, /health/*    │
│                                                                           │
│    d) TenantMiddleware (RLS Context)                                     │
│       • Extract org_id from JWT (or from X-Organization-Id header)     │
│       • Validate user is member of that organization                    │
│       • Validate tenant is not suspended                                │
│       • Execute: SET app.current_organization_id = '<org_id>'::uuid    │
│       • Set request.organization_id for downstream use                 │
│       • Skip for: public endpoints, admin console                       │
│                                                                           │
│    e) LoggingMiddleware                                                  │
│       • Generate request_id (UUID v7)                                   │
│       • Initialize structlog context: request_id, org_id, user_id      │
│       • Record start_time                                              │
│       • After response: log method, path, status_code, duration_ms     │
│                                                                           │
│    f) RateLimitMiddleware                                                │
│       • Check Redis for rate limit counters                             │
│       • Apply tiered limits (per plan: FREE=100rpm, GROWTH=1000rpm...) │
│       • Return 429 Too Many Requests if exceeded                        │
│       • Add X-RateLimit-* headers to response                          │
│                                                                           │
│    g) OpenTelemetryMiddleware                                            │
│       • Create OpenTelemetry span for this request                      │
│       • Inject trace context into request for downstream propagation    │
│       • Record HTTP attributes: method, path, status_code              │
│       • Close span after response                                       │
└──────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ 7. URL Router (config/urls/)                                              │
│    • Match request path to URL pattern                                  │
│    • /auth/* → identity.urls (auth views)                               │
│    • /api/v1/leads/* → lead_management.urls                             │
│    • /api/v1/opportunities/* → pipeline_management.urls                 │
│    • /api/v1/workflows/* → workflow.urls                                │
│    • /admin/* → django.contrib.admin.urls                               │
│    • /ws/* → channels routing (WebSocket)                               │
│    • /health/ → health_check_view                                       │
│    • /api/v1/public/* → public_api.urls                                 │
│    • No match → 404 JSON response                                       │
└──────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ 8. DRF ViewSet (API Layer)                                               │
│    • Throttling check (per-user, per-endpoint)                          │
│    • Permission check (RBAC)                                            │
│       - Check user.has_perm('lead.create', org_id)                     │
│       - Custom permission classes for ownership/team scoping           │
│    • Request parsing                                                    │
│       - Input validation via DRF Serializer                             │
│       - Deserialize JSON → CreateLeadDTO                               │
│       - Fail fast: invalid input returns 422                           │
│    • Call Application Service                                           │
│       - service.create_lead(dto, user=request.user, org=request.org)   │
│    • Response serialization                                             │
│       - Serialize result → JSON                                       │
│       - Return Response(data, status=201)                              │
│    • Exception handling                                                  │
│       - Domain exceptions → 400/404/409 with error code                │
│       - Unexpected exceptions → 500 with error_id (not details)        │
└──────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ 9. Application Service Layer                                             │
│    • CreateLeadService.execute(command)                                  │
│                                                                           │
│     a) Validate business rules                                           │
│        • LeadSource is valid                                            │
│        • Owner is assigned (or assign to default queue)                 │
│        • No duplicate lead exists (email/phone/company match check)     │
│                                                                           │
│     b) Create domain entity                                              │
│        • Lead.create(first_name, last_name, email, source, ...)         │
│        • Lead aggregate records events: LeadCreated(...)                │
│        • Apply domain invariants                                        │
│                                                                           │
│     c) Persist via Repository                                            │
│        • repository.save(lead) → INSERT INTO lead_management_leads     │
│        • RLS automatically scopes by organization_id                   │
│        • Returns saved entity with generated UUID v7 id                │
│                                                                           │
│     d) Collect domain events                                             │
│        • events = lead.collect_events()                                 │
│        • LeadCreated, LeadAssigned (if auto-assigned)                   │
│                                                                           │
│     e) Publish events (after successful DB commit)                       │
│        • event_publisher.publish(events, organization_id=org.id)        │
│        • RabbitMQ exchange: domain_events.topic                         │
│        • Routing key: lead_management.lead.created                      │
│        • Headers: tenant_id, user_id, correlation_id, event_type        │
│                                                                           │
│     f) Return Result                                                     │
│        • Return Result.ok(lead_dto) or Result.fail(error)               │
│        • Never throw exceptions for expected failures                   │
└──────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ 10. Domain Layer (pure Python, no I/O)                                   │
│     • Lead entity validates its own invariants                          │
│     • Updates internal state                                            │
│     • Records domain events                                              │
│     • No database access, no network calls, no Django imports           │
│     • Pure functions only — trivially testable                          │
└──────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ 11. Infrastructure Layer                                                 │
│     • ORM Model: LeadModel (Django Model)                               │
│     • Repository: DjangoLeadRepository converts LeadModel ↔ Lead entity │
│     • Event Publisher: RabbitMQEventPublisher sends to RabbitMQ         │
│     • Cache: CacheService invalidates lead cache keys                  │
│     • Search: SearchIndexService updates full-text search vector        │
│     • Embeddings: AI Gateway client enqueues embedding generation       │
└──────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ 12. Response Path (reverse)                                              │
│     • Infrastructure → Domain → Application → ViewSet → Middleware      │
│     • TenantMiddleware: RESET app.current_organization_id = NULL        │
│     • LoggingMiddleware: Log duration, add response headers             │
│     • OpenTelemetryMiddleware: Close span, record attributes            │
│     • nginx: Add response headers, log access                           │
│     • ALB: Forward response to client                                   │
│     • CloudFront: Cache response (if cacheable), serve to client        │
└──────────────────────────────────────────────────────────────────────────┘
        │
        ▼
User receives JSON Response (201 Created with Lead data)
```

---

## 6. Event Flow

### 6.1 Domain Event Lifecycle

```
┌──────────────────────────────────────────────────────────────────────────┐
│ DOMAIN EVENT FLOW                                                         │
│                                                                           │
│  ┌─────────┐    ┌──────────────┐    ┌───────────────┐    ┌───────────┐  │
│  │ Service  │───►│   Aggregate  │───►│ EventPublisher│───►│ RabbitMQ  │  │
│  │ executes │    │   records    │    │ (port)        │    │ Exchange  │  │
│  │ command  │    │   event(s)   │    │               │    │           │  │
│  └─────────┘    └──────────────┘    └───────┬───────┘    └─────┬─────┘  │
│                                              │                   │        │
│                                              │ publish_confirm() │        │
│                                              │ (sync, waits for  │        │
│                                              │  broker ack)      │        │
│                                              ▼                   │        │
│                                     ┌──────────────┐             │        │
│                                     │  Outbox      │             │        │
│                                     │  Pattern     │             │        │
│                                     │  (optional)  │             │        │
│                                     └──────────────┘             │        │
│                                                                   │        │
│                                                                   │        │
│  ┌────────────────────────────────────────────────────────────────┘        │
│  │                                                                          │
│  ▼                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐      │
│  │  RabbitMQ Topic Exchange: domain_events.topic                      │      │
│  │                                                                    │      │
│  │  Message Envelope:                                                  │      │
│  │  {                                                                  │      │
│  │    "event_type": "lead_management.lead.created",                   │      │
│  │    "event_id": "01900000-...",          // UUID v7                  │      │
│  │    "occurred_at": "2026-07-27T10:30:00Z",                          │      │
│  │    "organization_id": "org-uuid",                                  │      │
│  │    "actor_id": "user-uuid",                                        │      │
│  │    "aggregate_type": "lead",                                       │      │
│  │    "aggregate_id": "lead-uuid",                                    │      │
│  │    "version": 1,                                                   │      │
│  │    "data": { first_name, last_name, email, source, ... },           │      │
│  │    "metadata": {                                                   │      │
│  │      "correlation_id": "req-uuid",                                 │      │
│  │      "causation_id": "parent-event-id",                            │      │
│  │      "trace_id": "otel-trace-id"                                   │      │
│  │    }                                                               │      │
│  │  }                                                                  │      │
│  └──────────────────────────────────────────────────────────────────┘      │
│                              │                                              │
│                              │                                              │
│              ┌───────────────┼───────────────────┐                        │
│              │               │                   │                        │
│              ▼               ▼                   ▼                        │
│    ┌─────────────────┐ ┌──────────────┐ ┌──────────────┐                 │
│    │ Queue: workflow │ │ Queue:       │ │ Queue:       │                 │
│    │ Routing key:    │ │ notification │ │ integrations │                 │
│    │ lead_management │ │ Routing key: │ │ Routing key: │                 │
│    │ .lead.created   │ │ lead_manage │ │ *.lead.*     │                 │
│    └────────┬────────┘ │ .lead.create│ └──────────────┘                 │
│             │          └──────┬───────┘                                  │
│             │                 │                                           │
│             ▼                 ▼                                           │
│    ┌─────────────────┐ ┌─────────────────┐                               │
│    │ Celery Worker   │ │ Celery Worker    │                               │
│    │ (Workflow Queue)│ │ (Notify Queue)   │                               │
│    └────────┬────────┘ └────────┬────────┘                               │
│             │                   │                                         │
│     ┌───────┴───────┐   ┌──────┴───────┐                                │
│     │ Idempotency    │   │ Idempotency  │                                │
│     │ Check (Redis)  │   │ Check (Redis)│                                │
│     │ SETNX event_id │   │ SETNX        │                                │
│     └───────┬───────┘   └──────┬───────┘                                │
│             │                  │                                          │
│     ┌───────┴───────┐   ┌──────┴───────┐                                │
│     │ Validate      │   │ Validate     │                                │
│     │ tenant active │   │ tenant active │                                │
│     └───────┬───────┘   └──────┬───────┘                                │
│             │                  │                                          │
│     ┌───────┴───────┐   ┌──────┴───────┐                                │
│     │ Event Handler │   │ Event Handler│                                │
│     │ (module)      │   │ (module)     │                                │
│     └───────┬───────┘   └──────┬───────┘                                │
│             │                  │                                          │
│     ┌───────┴───────┐   ┌──────┴───────┐                                │
│     │ Success?      │   │ Success?     │                                │
│     │ YES → ACK     │   │ YES → ACK    │                                │
│     │ NO  → RETRY   │   │ NO  → RETRY  │                                │
│     │       (3x)    │   │       (3x)   │                                │
│     │       → DLX   │   │       → DLX  │                                │
│     └───────────────┘   └──────────────┘                                │
└──────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Event Catalog

| Event | Publisher | Routing Key | Subscribers |
|-------|-----------|-------------|-------------|
| `UserRegistered` | identity | `identity.user.registered` | Organization, Notification |
| `EmailVerified` | identity | `identity.user.email_verified` | Identity |
| `UserLoggedIn` | identity | `identity.user.logged_in` | Audit, Security |
| `OrganizationProvisioned` | organization | `organization.org.provisioned` | Tenant |
| `OrganizationSuspended` | organization | `organization.org.suspended` | Tenant, Notification |
| `OrganizationTierChanged` | organization | `organization.org.tier_changed` | Billing, Workflow |
| `LeadCreated` | lead_management | `lead_management.lead.created` | Workflow, Notification, AI, Search |
| `LeadUpdated` | lead_management | `lead_management.lead.updated` | Workflow, AI, Search |
| `LeadConverted` | lead_management | `lead_management.lead.converted` | Pipeline, Activity, Workflow |
| `LeadAssigned` | lead_management | `lead_management.lead.assigned` | Notification, Workflow |
| `ContactCreated` | lead_management | `lead_management.contact.created` | Workflow, Search |
| `OpportunityCreated` | pipeline_management | `pipeline.opportunity.created` | Workflow, Notification |
| `OpportunityStageChanged` | pipeline_management | `pipeline.opportunity.stage_changed` | Workflow, Notification, Reports |
| `OpportunityWon` | pipeline_management | `pipeline.opportunity.won` | Workflow, Notification, Reports |
| `OpportunityLost` | pipeline_management | `pipeline.opportunity.lost` | Workflow, Reports |
| `TaskCreated` | activity | `activity.task.created` | Workflow, Notification |
| `TaskCompleted` | activity | `activity.task.completed` | Workflow, Notification |
| `ActivityLogged` | activity | `activity.activity.logged` | Workflow, Reports |
| `WorkflowTriggered` | workflow | `workflow.workflow.triggered` | Audit |
| `WorkflowCompleted` | workflow | `workflow.workflow.completed` | Audit, Notification |
| `NotificationSent` | notification | `notification.notification.sent` | Audit |
| `ReportGenerated` | reports | `reports.report.generated` | Notification |
| `IntegrationSynced` | integrations | `integrations.sync.completed` | Audit |
| `WebhookDelivered` | integrations | `integrations.webhook.delivered` | Audit |
| `VoiceCallCompleted` | voice_ai | `voice_ai.call.completed` | Activity, AI, Notification |

### 6.3 Event Publishing & Consumer Guarantees

| Concern | Implementation |
|---------|---------------|
| **At-least-once delivery** | Publisher confirms + consumer acknowledgements |
| **Idempotency** | Redis SETNX on event_id; TTL = 24h |
| **Ordering** | Per-aggregate ordering via partition key (aggregate_id) |
| **Dead letter** | 3 retries with exponential backoff → DLX queue |
| **Poison message** | DLX message TTL = 7 days; manual replay via admin UI |
| **Schema evolution** | AVRO or JSON Schema; backward-compatible changes only |
| **Tenant context** | organization_id in every event envelope |
| **Trace propagation** | W3C Trace Context in event metadata |

---

## 7. AI Flow

### 7.1 AI Query Flow (User asks a question)

```
User types question in CRM (e.g., "Show me all leads from the Website source in the last 30 days")
        │
        │ POST /api/v1/ai/query { "query": "Show me all leads from Website source in last 30 days" }
        ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ 1. Django Application                                                     │
│    • AuthMiddleware: Verify JWT, extract org_id, user_id                 │
│    • TenantMiddleware: Set RLS context                                   │
│    • AIQueryView: Validate input, check rate limit                       │
│    • Forward to AI Gateway: POST /v1/chat/completions                    │
│    • Headers: X-Organization-Id, X-User-Id, Authorization (JWT)         │
└──────────────────────────────────────────────────────────────────────────┘
        │
        │ HTTP (internal, mTLS)
        ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ 2. AI Gateway (FastAPI Sidecar)                                          │
│    • Authenticate internal request (mTLS or shared secret)               │
│    • Extract org_id, user_id from headers                                │
│    • Query Understanding Phase                                           │
│       a) Classify intent:                                                │
│          - "list leads by source" → query intent                        │
│          - "send email to John" → action intent                         │
│          - "summarize this deal" → analysis intent                      │
│       b) Extract entities:                                               │
│          - Entity: lead, source_filter=Website, date_range=last_30_days │
│       c) Identify required tools/data sources                           │
└──────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ 3. LangChain Orchestration                                               │
│                                                                           │
│    ┌──────────────────────────────────────────────────────────────────┐  │
│    │ Chain: Intent Classification → Entity Extraction → Tool Select   │  │
│    │                                                                  │  │
│    │ a) Intent Classification Prompt:                                  │  │
│    │    System: "Classify user intent as QUERY, ACTION, or ANALYSIS"  │  │
│    │    → Response: "QUERY"                                           │  │
│    │                                                                  │  │
│    │ b) Entity Extraction Prompt:                                      │  │
│    │    System: "Extract CRM entities from the query"                 │  │
│    │    → Response: {"entity": "lead", "filters": {"source": "Website"│  │
│    │                , "created_at_gte": "2026-06-27"}}               │  │
│    │                                                                  │  │
│    │ c) Tool Selection (MCP):                                          │  │
│    │    Available tools from MCP server:                               │  │
│    │    - search_leads(filters) → returns matching leads               │  │
│    │    - get_pipeline_summary() → returns pipeline overview          │  │
│    │    - get_opportunity(id) → returns opportunity details            │  │
│    │    → Selected: search_leads(filters=...)                         │  │
│    └──────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ 4. MCP Tool Execution                                                    │
│                                                                           │
│    ┌──────────────────────────────────────────────────────────────────┐  │
│    │ MCP Server (within AI Gateway)                                    │  │
│    │                                                                  │  │
│    │ Tool: search_leads                                                │  │
│    │ Input: {"filters": {"source": "Website",                         │  │
│    │                    "created_at_gte": "2026-06-27"}}              │  │
│    │                                                                  │  │
│    │ a) MCP Server validates input against tool schema                 │  │
│    │ b) MCP Server calls Django API internally:                       │  │
│    │    GET /api/v1/leads/?source=Website&created_at_gte=2026-06-27   │  │
│    │    Headers: X-Organization-Id (from JWT)                         │  │
│    │    → Django processes this as a normal API request               │  │
│    │    → RLS scopes to tenant data                                    │  │
│    │    → Returns paginated lead results                               │  │
│    │ c) MCP Server formats results for LLM consumption                 │  │
│    │                                                                  │  │
│    │ Output: {"total": 47, "leads": [...]}                            │  │
│    └──────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ 5. Response Generation (LLM)                                             │
│                                                                           │
│    ┌──────────────────────────────────────────────────────────────────┐  │
│    │ Prompt:                                                            │  │
│    │ System: "You are a CRM assistant. Answer the user's question      │  │
│    │          based on the retrieved data. Be concise and accurate."   │  │
│    │ User: "Show me all leads from the Website source in the last 30  │  │
│    │        days."                                                     │  │
│    │ Context: "Found 47 leads from Website source in the last 30 days. │  │
│    │           Top 5: John Doe (Acme Corp), Jane Smith (Beta Inc)..."  │  │
│    │                                                                  │  │
│    │ LLM Response: "Here are the 47 leads from the Website source in   │  │
│    │ the last 30 days. The most recent is John Doe from Acme Corp      │  │
│    │ (created 2 hours ago). Top 5 by score: ..."                       │  │
│    └──────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
        │
        │ SSE stream (if enabled) or JSON response
        ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ 6. Response to User                                                      │
│    • AI Gateway returns JSON:                                           │
│      {                                                                  │
│        "response": "Here are the 47 leads from the Website source...", │
│        "data_source": "CRM Database",                                  │
│        "tool_used": "search_leads",                                     │
│        "total_results": 47,                                             │
│        "token_usage": {"prompt": 450, "completion": 120, "total": 570} │
│      }                                                                  │
│    • Django logs query to audit trail                                   │
│    • Token usage recorded for cost tracking                             │
│    • Response streamed via SSE to frontend (if streaming)               │
└──────────────────────────────────────────────────────────────────────────┘
        │
        ▼
User sees AI response in CRM UI
```

### 7.2 Embedding Generation Flow

```
Entity Created/Updated (e.g., Lead created)
        │
        │ Domain event: LeadCreated → Celery task
        ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ Celery Worker: embedding_generation_queue                                │
│                                                                           │
│ 1. Receive LeadCreated event                                             │
│ 2. Restore tenant context from event.organization_id                     │
│ 3. Fetch entity text content:                                            │
│    "John Doe | Acme Corp | john@acme.com | Website Lead | Notes: ..."   │
│ 4. Call AI Gateway: POST /v1/embeddings                                 │
│    { "input": "John Doe | Acme Corp | john@acme.com | ..." }           │
│ 5. AI Gateway calls OpenAI Embeddings API (model: text-embedding-3-small)│
│ 6. Receive vector[1536]                                                 │
│ 7. Update entity in PostgreSQL:                                         │
│    UPDATE lead_management_leads SET embedding = <vector> WHERE id = ... │
│ 8. Update search index: update search_vector, reindex                   │
└──────────────────────────────────────────────────────────────────────────┘
```

### 7.3 RAG Query Flow

```
User asks: "What do we know about Acme Corp?"
        │
        ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ AI Gateway: RAG Service                                                  │
│                                                                           │
│ 1. Embed user query: "What do we know about Acme Corp?"                  │
│    → query_vector[1536]                                                  │
│                                                                           │
│ 2. Hybrid Search (pgvector + full-text):                                 │
│    a) Vector similarity:                                                  │
│       SELECT id, content, 1 - (embedding <=> query_vector) AS similarity │
│       FROM lead_management_leads                                         │
│       WHERE organization_id = current_setting('app.current_org_id')::uuid│
│       ORDER BY similarity DESC LIMIT 5                                   │
│                                                                           │
│    b) Full-text search:                                                   │
│       SELECT id, content, ts_rank(search_vector, query) AS rank          │
│       FROM lead_management_leads                                         │
│       WHERE search_vector @@ plainto_tsquery('english', 'Acme Corp')    │
│       AND organization_id = current_setting('app.current_org_id')::uuid  │
│       ORDER BY rank DESC LIMIT 5                                         │
│                                                                           │
│    c) Combine & re-rank (Reciprocal Rank Fusion):                        │
│       RRF score = 1/(60 + vector_rank) + 1/(60 + fts_rank)              │
│       → Top 3 results                                                    │
│                                                                           │
│ 3. Context assembly:                                                     │
│    "Lead: John Doe, Company: Acme Corp, Source: Website, Created: ...  │
│     Contact: jane@acmecorp.com, Phone: +1-555-0100                      │
│     Opportunity: Enterprise Deal ($50k), Stage: Negotiation             │
│     Recent Activity: Email sent 2 days ago, Meeting scheduled for..."   │
│                                                                           │
│ 4. LLM Generation:                                                       │
│    System: "You are a CRM assistant. Answer based on the context."      │
│    Context: <hybrid search results>                                      │
│    User: "What do we know about Acme Corp?"                             │
│    → Generated response with data summary                               │
└──────────────────────────────────────────────────────────────────────────┘
```

### 7.4 MCP Tool Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│ MCP (Model Context Protocol) Server                                      │
│ Gate: Standardized AI tool exposure                                      │
│                                                                           │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │ Tool Registration                                                   │    │
│  │                                                                     │    │
│  │  @mcp.tool                                                         │    │
│  │  async def search_leads(                                           │    │
│  │      filters: LeadFilters,        # Pydantic model                 │    │
│  │      org_id: UUID = Depends(get_org_id)                            │    │
│  │  ) -> list[LeadResult]:                                             │    │
│  │      """Search leads by filters. Returns matching leads."""        │    │
│  │      return await django_client.get_leads(filters, org_id)          │    │
│  │                                                                     │    │
│  │  @mcp.tool                                                         │    │
│  │  async def get_pipeline_summary(                                   │    │
│  │      pipeline_id: UUID | None = None,                              │    │
│  │      org_id: UUID = Depends(get_org_id)                            │    │
│  │  ) -> PipelineSummary:                                              │    │
│  │      """Get pipeline stage summary with counts and amounts."""     │    │
│  │      return await django_client.get_pipeline_summary(pipeline_id)   │    │
│  │                                                                     │    │
│  │  @mcp.tool                                                         │    │
│  │  async def send_email(                                             │    │
│  │      to: str, subject: str, body: str,                             │    │
│  │      org_id: UUID = Depends(get_org_id)                            │    │
│  │  ) -> EmailResult:                                                  │    │
│  │      """Send an email via CRM email system."""                     │    │
│  │      return await django_client.send_email(to, subject, body)       │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                                                                           │
│  Discovery Endpoint: GET /v1/tools                                        │
│  Returns JSON schema of all registered tools:                            │
│  {                                                                       │
│    "tools": [                                                            │
│      {                                                                   │
│        "name": "search_leads",                                          │
│        "description": "Search leads by filters",                        │
│        "input_schema": { ... }  // JSON Schema                          │
│      },                                                                  │
│      ...                                                                │
│    ]                                                                     │
│  }                                                                       │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Celery Task Flow

### 8.1 Task Lifecycle

```
Service publishes domain event
        │
        ▼
RabbitMQ Exchange: domain_events.topic
        │
        │ Routing key matched → queue bound
        ▼
Queue: {module}_queue (e.g., workflow_queue)
        │
        │ Consumer prefetch = 1
        ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ Celery Worker                                                             │
│                                                                           │
│ 1. Receive message from queue                                            │
│    • message.ack() → remove from queue (at-least-once guarantee)         │
│                                                                           │
│ 2. TenantAwareTask.__call__                                               │
│    a) Extract organization_id from event envelope                        │
│    b) Set thread-local: set_current_organization_id(org_id)              │
│    c) Set PostgreSQL session variable: SET app.current_organization_id   │
│    d) Validate tenant is active (not suspended/disabled)                 │
│    e) Proceed to task execution                                          │
│                                                                           │
│ 3. Idempotency Check                                                      │
│    • Redis: SETNX event_id → if already exists, return (duplicate)      │
│    • TTL: 24 hours (events expire after idempotency window)             │
│                                                                           │
│ 4. Task Execution                                                         │
│    • Deserialize event payload                                           │
│    • Call event handler: handle_lead_created(event)                      │
│    • Handler executes business logic:                                    │
│      - Query workflows matching this event type                          │
│      - Evaluate conditions                                               │
│      - Execute actions (send email, update field, trigger webhook)       │
│                                                                           │
│ 5. Result Handling                                                        │
│    • Success → log, emit metrics, return                                 │
│    • Expected failure (e.g., validation error) → log warning, return     │
│    • Unexpected failure (exception) →                                     │
│      - Retry count < 3 → retry with exponential backoff                  │
│      - Retry count = 3 → publish to DLX, log critical, alert            │
│                                                                           │
│ 6. Cleanup                                                                │
│    a) Reset thread-local: set_current_organization_id(None)              │
│    b) Reset PostgreSQL: SET app.current_organization_id = NULL           │
│    c) Close DB connection (return to pool)                               │
└──────────────────────────────────────────────────────────────────────────┘
```

### 8.2 Task Queues

| Queue | Workers | Priority | Timeout | Max Retries | Purpose |
|-------|---------|----------|---------|-------------|---------|
| `workflow` | 4-8 | High | 30s | 3 | Workflow condition evaluation + action execution |
| `notification` | 2-4 | High | 60s | 3 | Email, SMS, push, Slack delivery |
| `reports` | 1-4 | Low | 300s | 2 | Report generation, CSV export |
| `integrations` | 2-4 | Medium | 120s | 3 | External API calls, webhook delivery, sync |
| `imports` | 1-2 | Low | 600s | 2 | CSV/Excel import processing |
| `default` | 2-4 | Low | 30s | 3 | Everything else (cache warmup, housekeeping) |

### 8.3 Retry Policy

```
Attempt 1: Execute
    │ Success → ACK, done
    │ Failure → retry in 1s
    ▼
Attempt 2: Execute
    │ Success → ACK, done
    │ Failure → retry in 4s
    ▼
Attempt 3: Execute
    │ Success → ACK, done
    │ Failure → retry in 16s
    ▼
Attempt 4: Execute
    │ Success → ACK, done
    │ Failure → publish to Dead Letter Exchange
    ▼
DLX Queue: dlq.{original_queue_name}
    │ Message routed to DLX with original headers preserved
    │ TTL: 7 days (manual replay or discard)
    │ Alert: critical severity notification to engineering
```

---

> **Version:** 0.1.0-draft | **Last Updated:** 2026-07-27
> **Cross-reference:** [10_ArchitectureOverview.md](./10_ArchitectureOverview.md),
> [12_HighLevelDesign.md](./12_HighLevelDesign.md),
> [13_LowLevelDesign.md](./13_LowLevelDesign.md)
