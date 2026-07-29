# TZAHU CRM — High-Level Design

> **Version:** 0.1.0-draft
> **Last Updated:** 2026-07-27
> **Status:** Foundational Design Phase
> **Owner:** Platform Architecture Team

---

## Table of Contents

1. [Module Decomposition](#1-module-decomposition)
2. [Modular Monolith Structure](#2-modular-monolith-structure)
3. [Cross-Cutting Concerns](#3-cross-cutting-concerns)
4. [Communication Patterns](#4-communication-patterns)
5. [Data Flow Diagrams](#5-data-flow-diagrams)
6. [Integration Patterns](#6-integration-patterns)
7. [Security Architecture](#7-security-architecture)

---

## 1. Module Decomposition

### 1.1 Bounded Context Map

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        TZAHU CRM — Bounded Context Map                       │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    CORE DOMAIN (CRM Business)                         │   │
│  │                                                                       │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────┐ │   │
│  │  │   Lead        │  │   Contact     │  │   Account    │  │ Pipeline │ │   │
│  │  │   Management  │◄─┤  Management   │◄─┤ Management   │  │ & Oppty  │ │   │
│  │  │               │  │               │  │              │  │          │ │   │
│  │  │ • Lead        │  │ • Contact     │  │ • Account    │  │ • Stage  │ │   │
│  │  │ • Source      │  │ • Merge       │  │ • Hierarchy  │  │ • Oppty  │ │   │
│  │  │ • Score       │  │ • Preference  │  │ • Territory  │  │ • Weight │ │   │
│  │  │ • Convert     │  │ • GDPR        │  │              │  │ • Close  │ │   │
│  │  └───────┬───────┘  └──────┬───────┘  └──────────────┘  └─────┬────┘ │   │
│  │          │                  │                                  │       │   │
│  │          │                  ▼                                  │       │   │
│  │          │          ┌─────────────────────────────┐            │       │   │
│  │          └──────────►        Activity              ◄───────────┘       │   │
│  │                     │  (Call, Email, Meeting, Note) │                  │   │
│  │                     └──────────┬──────────────────┘                   │   │
│  │                                │                                       │   │
│  │                                ▼                                       │   │
│  │                     ┌─────────────────────────────┐                   │   │
│  │                     │           Task               │                   │   │
│  │                     │  (Assignment, Due date,      │                   │   │
│  │                     │   Priority, Status)          │                   │   │
│  │                     └──────────┬──────────────────┘                   │   │
│  │                                │                                       │   │
│  │                                ▼                                       │   │
│  │                     ┌─────────────────────────────┐                   │   │
│  │                     │         Calendar              │                   │   │
│  │                     │  (Event, Meeting, Sync)       │                   │   │
│  │                     └─────────────────────────────┘                   │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                     SUPPORTING DOMAIN                                  │   │
│  │                                                                       │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────┐ │   │
│  │  │   Workflow    │  │  Notification│  │   Reports    │  │Dashboard │ │   │
│  │  │   & Auto      │  │  Engine      │  │ & Analytics  │  │          │ │   │
│  │  │               │  │              │  │              │  │          │ │   │
│  │  │ • Trigger     │  │ • Channel    │  │ • Builder    │  │ • Widget │ │   │
│  │  │ • Condition   │  │ • Template   │  │ • Schedule   │  │ • KPI    │ │   │
│  │  │ • Action      │  │ • Preference │  │ • Export     │  │ • Chart  │ │   │
│  │  │ • Schedule    │  │ • Rate Limit │  │              │  │          │ │   │
│  │  └───────┬───────┘  └──────┬───────┘  └──────────────┘  └──────────┘ │   │
│  └──────────┼─────────────────┼──────────────────────────────────────────┘   │
│             │                 │                                               │
│  ┌──────────┼─────────────────┼──────────────────────────────────────────┐   │
│  │          ▼                 ▼                                           │   │
│  │  ┌──────────────┐  ┌──────────────────┐                               │   │
│  │  │  Voice AI    │  │   Integrations   │                               │   │
│  │  │  (Phase 9)   │  │   (Phase 10)     │                               │   │
│  │  └──────────────┘  └──────────────────┘                               │   │
│  │                                                                       │   │
│  │                   GENERIC SUBDOMAIN                                   │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    GENERIC SUBDOMAIN                                   │   │
│  │                                                                       │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────┐ │   │
│  │  │   Identity    │  │ Organization │  │    RBAC      │  │  Tenant  │ │   │
│  │  │               │  │              │  │              │  │          │ │   │
│  │  │ • Auth       │  │ • Org CRUD   │  │ • Role       │  │ • RLS    │ │   │
│  │  │ • JWT        │  │ • Member     │  │ • Permission │  │ • Pool/  │ │   │
│  │  │ • MFA        │  │ • Settings   │  │ • Assignment │  │   Silo   │ │   │
│  │  │ • Session    │  │ • Tier       │  │              │  │ • Prov.  │ │   │
│  │  └───────┬───────┘  └──────┬───────┘  └──────────────┘  └──────────┘ │   │
│  └──────────┼─────────────────┼──────────────────────────────────────────┘   │
│             │                 │                                               │
│  ┌──────────┴─────────────┐   │                                               │
│  │     Shared Kernel       │◄──┘                                               │
│  │                         │                                                   │
│  │  • UUID v7 / Base VO   │                                                   │
│  │  • ValueObject / Entity │                                                   │
│  │  • AggregateRoot        │                                                   │
│  │  • DomainEvent          │                                                   │
│  │  • Result[T, E]        │                                                   │
│  │  • Repository[T] (port) │                                                   │
│  │  • EventPublisher (port)│                                                   │
│  └─────────────────────────┘                                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Module Dependency Graph

```
                        ┌──────────────────────────────┐
                        │       Shared Kernel           │
                        │  (No dependencies)            │
                        └──────────────┬───────────────┘
                                       │
                  ┌────────────────────┼────────────────────┐
                  ▼                    ▼                    ▼
         ┌────────────────┐  ┌────────────────┐  ┌────────────────┐
         │   Identity      │  │  Organization  │  │      ...        │
         │   (users, auth) │◄─┤  (org, member) │  │  (All modules   │
         │                 │  │                │  │   import SK)    │
         └────────────────┘  └────────────────┘  └────────────────┘
                                       │
                                       ▼
                              ┌────────────────┐
                              │     RBAC        │
                              │  (roles, perms) │
                              └────────────────┘
                                       │
                                       ▼
                              ┌────────────────┐
                              │    Tenant       │
                              │  (RLS, silo)   │
                              └────────────────┘
                                       │
                  ┌────────────────────┼────────────────────┐
                  ▼                    ▼                    ▼
         ┌────────────────┐  ┌────────────────┐  ┌────────────────┐
         │Lead Management │  │  Pipeline &    │  │    Search      │
         │                │  │  Opportunity   │  │                │
         └───────┬────────┘  └────────┬───────┘  └────────────────┘
                 │                    │
                 │                    │
                 ▼                    ▼
         ┌──────────────────────────────────────────────┐
         │              Activity & Task                  │
         │  (Events from Lead, Contact, Opportunity)    │
         └──────────────────────┬───────────────────────┘
                                │
                                ▼
         ┌──────────────────────────────────────────────┐
         │              Workflow Engine                  │
         │  (Subscribes to all domain events)            │
         └──────────────────────┬───────────────────────┘
                                │
         ┌──────────────────────┼──────────────────────┐
         ▼                      ▼                      ▼
  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐
  │ Notification │    │   Reports    │    │      AI          │
  │  Engine      │    │ & Dashboard  │    │  (NLP, Scoring)  │
  └──────────────┘    └──────────────┘    └──────────────────┘
         │                                      │
         │                                      │
         ▼                                      ▼
  ┌──────────────┐                    ┌──────────────────┐
  │ Integrations │                    │    Voice AI      │
  │  (Phase 10)  │                    │    (Phase 9)     │
  └──────────────┘                    └──────────────────┘

Horizontal Modules (all modules depend on these):

  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐
  │     Audit       │  │   Settings     │  │  Common / Infra│
  │  (Event log)    │  │  (App config)  │  │  (Utils, Base) │
  └────────────────┘  └────────────────┘  └────────────────┘
```

---

## 2. Modular Monolith Structure

### 2.1 Module Catalog

| # | Module | Type | Dependencies | Phase | Description |
|---|--------|------|-------------|-------|-------------|
| 1 | `shared_kernel` | Shared | None | 1 | Base classes: ValueObject, Entity, AggregateRoot, DomainEvent, Result, Repository port |
| 2 | `identity` | Generic | shared_kernel | 1 | User registration, auth, JWT, sessions, password management |
| 3 | `organization` | Generic | identity, shared_kernel | 1 | Organization CRUD, membership, settings, subscription tier |
| 4 | `rbac` | Generic | identity, organization, shared_kernel | 1 | Roles, permissions, role assignments |
| 5 | `tenant` | Generic | identity, organization, rbac, shared_kernel | 2 | RLS policy management, tenant lifecycle, isolation enforcement |
| 6 | `lead_management` | Core | tenant, shared_kernel | 3 | Lead, Contact, Account aggregates; dedup; scoring |
| 7 | `pipeline_management` | Core | lead_management, tenant, shared_kernel | 4 | Pipeline stages, opportunities, forecasting |
| 8 | `activity` | Core | lead_management, pipeline_management, tenant, shared_kernel | 4 | Activity logging, tasks |
| 9 | `calendar` | Supporting | activity, identity, shared_kernel | 4 | Calendar events, Google/MS sync |
| 10 | `workflow` | Supporting | all core modules, shared_kernel | 5 | Workflow trigger/condition/action engine |
| 11 | `notification` | Supporting | identity, shared_kernel | 6 | Multi-channel notification delivery |
| 12 | `dashboard` | Supporting | reports, shared_kernel | 7 | Dashboard widgets, layout, sharing |
| 13 | `reports` | Supporting | all core modules, shared_kernel | 7 | Report builder, analytics, forecasting |
| 14 | `ai` | Supporting | all core modules, ai_gateway, shared_kernel | 8 | AI orchestration, NLP features, scoring |
| 15 | `voice_ai` | Supporting | ai, activity, shared_kernel | 9 | Call logging, transcription, analysis |
| 16 | `integrations` | Supporting | all modules, shared_kernel | 10 | Connector SDK, webhooks, OAuth vault |
| 17 | `settings` | Generic | shared_kernel | 1 | Application settings, feature flags |
| 18 | `audit` | Generic | shared_kernel | 2 | Append-only event log, GDPR compliance |
| 19 | `search` | Supporting | lead_management, pipeline_management, shared_kernel | 3 | Full-text search, vector search, hybrid |

### 2.2 Module Directory Structure (Standard)

```
apps/{module_name}/
├── __init__.py
├── apps.py                          # Django AppConfig
├── domain/
│   ├── __init__.py
│   ├── models.py                    # Aggregate roots + entities
│   ├── value_objects.py             # Immutable value objects
│   ├── events.py                    # Domain event classes
│   ├── exceptions.py                # Domain-specific exceptions
│   └── services.py                  # Domain services (stateless)
├── application/
│   ├── __init__.py
│   ├── services.py                  # Application services (orchestration)
│   ├── commands.py                  # Command classes + handlers
│   ├── queries.py                   # Query classes + handlers
│   └── dto.py                       # Data transfer objects
├── infrastructure/
│   ├── __init__.py
│   ├── models.py                    # Django ORM models
│   ├── repositories.py              # Repository implementations
│   ├── selectors.py                 # Complex read queries (DTO projection)
│   ├── admin.py                     # Django admin configuration
│   ├── migrations/
│   │   ├── __init__.py
│   │   └── 0001_initial.py
│   └── management/
│       └── commands/                # Custom management commands
├── api/
│   ├── __init__.py
│   ├── views.py                     # DRF ViewSets
│   ├── serializers.py               # DRF Serializers
│   ├── permissions.py               # DRF Permission classes
│   ├── filters.py                   # DRF FilterSets
│   └── urls.py                      # URL routing
├── adapters/
│   ├── __init__.py
│   ├── event_handlers.py            # Event subscriptions from other modules
│   └── api_clients.py               # External API clients
└── tests/
    ├── __init__.py
    ├── domain/
    ├── application/
    ├── infrastructure/
    └── api/
```

---

## 3. Cross-Cutting Concerns

### 3.1 Tenant Isolation

```
┌──────────────────────────────────────────────────────────────────────────┐
│ TENANT ISOLATION MODEL                                                    │
│                                                                           │
│  Layer 1: URL/Route Isolation                                             │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ • Each org has subdomain: {org_slug}.app.tzahu.com                │  │
│  │ • Or custom domain: crm.{org_custom_domain}                       │  │
│  │ • nginx/ALB routes to Django; domain extracted for org resolution  │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                    │                                      │
│  Layer 2: JWT Claim Isolation                                             │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ • JWT contains org_id claim (org_uuid)                            │  │
│  │ • AuthMiddleware extracts and validates membership                │  │
│  │ • Every API request carries the tenant context                    │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                    │                                      │
│  Layer 3: PostgreSQL Session Variable                                    │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ • TenantMiddleware executes: SET app.current_organization_id      │  │
│  │ • This session variable is used by RLS policies                   │  │
│  │ • Reset after request: SET app.current_organization_id = NULL     │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                    │                                      │
│  Layer 4: Row-Level Security (RLS)                                       │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ • Every tenant-scoped table has RLS policy:                       │  │
│  │   CREATE POLICY tenant_isolation_{table} ON {table}               │  │
│  │   FOR ALL USING (organization_id =                                │  │
│  │     current_setting('app.current_organization_id')::uuid);        │  │
│  │ • FORCE RLS applied (even table owner affected)                   │  │
│  │ • RLS is the LAST LINE OF DEFENSE                                 │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                    │                                      │
│  Layer 5: Repository Scoping                                             │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ • TenantScopedRepository adds .filter(organization_id=org_id)     │  │
│  │ • Even if RLS is bypassed, repository scopes queries              │  │
│  │ • Two layers of protection: application + database                │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                    │                                      │
│  Layer 6: Cache Key Scoping                                              │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ • All cache keys include org_id prefix:                           │  │
│  │   "{env}:{org_id}:{module}:{entity}:{id}"                        │  │
│  │ • Different orgs never collide in cache                           │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                    │                                      │
│  Layer 7: Celery Tenant Propagation                                      │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ • Every domain event carries organization_id                      │  │
│  │ • TenantAwareTask restores RLS context in Celery worker           │  │
│  │ • Thread-local storage: set_current_organization_id(org_id)       │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                    │                                      │
│  Layer 8: File Storage Isolation                                         │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ • MinIO paths prefixed with org_id:                               │  │
│  │   /media/{org_id}/{entity_type}/{entity_id}/{filename}            │  │
│  │ • File-serving endpoints enforce org-scoped access                │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Event Bus

```
┌──────────────────────────────────────────────────────────────────────────┐
│ EVENT BUS ARCHITECTURE                                                    │
│                                                                           │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │ EventPublisher (Port)                                              │    │
│  │                                                                    │    │
│  │ interface EventPublisher:                                         │    │
│  │     def publish(events: list[DomainEvent], metadata: dict)        │    │
│  │                                                                    │    │
│  │ Implementations:                                                   │    │
│  │ • RabbitMQEventPublisher → async, RabbitMQ topic exchange         │    │
│  │ • InProcessEventPublisher → sync, same transaction (signals)      │    │
│  │ • OutboxEventPublisher → transactional outbox pattern             │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                                                                           │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │ Event Envelope                                                     │    │
│  │                                                                    │    │
│  │ {                                                                  │    │
│  │   "event_type": "module.entity.action",     // e.g., "lead.      │    │
│  │                                             //        management  │    │
│  │                                             //        .lead.      │    │
│  │                                             //        created"    │    │
│  │   "event_id": "uuid-v7",                    // Unique, idempotency│    │
│  │   "occurred_at": "2026-07-27T10:30:00Z",    // Timestamp          │    │
│  │   "organization_id": "uuid",                // Always present     │    │
│  │   "actor_id": "uuid",                       // Who triggered it   │    │
│  │   "aggregate_type": "lead",                 // Aggregate type     │    │
│  │   "aggregate_id": "uuid",                   // Aggregate instance │    │
│  │   "version": 1,                              // Aggregate version  │    │
│  │   "data": { ... },                           // Event-specific data│    │
│  │   "metadata": {                              // Cross-cutting      │    │
│  │     "correlation_id": "uuid",               // Trace origin       │    │
│  │     "causation_id": "uuid",                 // Parent event       │    │
│  │     "trace_id": "otel-trace-id"             // OTEL trace         │    │
│  │   }                                                                 │    │
│  │ }                                                                   │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                                                                           │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │ RabbitMQ Topology                                                  │    │
│  │                                                                    │    │
│  │ Exchange: domain_events.topic (topic type)                        │    │
│  │                                                                    │    │
│  │ Routing Key Convention: {module}.{entity}.{action}                │    │
│  │   • lead_management.lead.created                                  │    │
│  │   • lead_management.lead.converted                                │    │
│  │   • pipeline_management.opportunity.stage_changed                 │    │
│  │   • workflow.workflow.completed                                   │    │
│  │                                                                    │    │
│  │ Queue Bindings:                                                    │    │
│  │   Queue: workflow_queue                                            │    │
│  │     Binding: lead_management.lead.*                                │    │
│  │     Binding: pipeline_management.opportunity.*                     │    │
│  │                                                                    │    │
│  │   Queue: notification_queue                                        │    │
│  │     Binding: *.lead.created                                        │    │
│  │     Binding: *.opportunity.won                                     │    │
│  │     Binding: *.task.assigned                                       │    │
│  │                                                                    │    │
│  │   Queue: integration_queue                                         │    │
│  │     Binding: *.webhook.*                                           │    │
│  │     Binding: *.sync.*                                              │    │
│  │                                                                    │    │
│  │ Dead Letter Exchange: dlx.topic                                   │    │
│  │   Messages after 3 failed retries                                  │    │
│  └──────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Caching Strategy

```
┌──────────────────────────────────────────────────────────────────────────┐
│ CACHING STRATEGY                                                          │
│                                                                           │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │ Cache Layers                                                      │    │
│  │                                                                   │    │
│  │  L1: Browser Cache (HTTP)                                         │    │
│  │    • Cache-Control headers on GET endpoints                       │    │
│  │    • ETag for conditional requests                                │    │
│  │    • Static assets: immutable, long max-age                       │    │
│  │                                                                   │    │
│  │  L2: CDN Cache (CloudFront)                                       │    │
│  │    • Static assets: /assets/*, /static/*                         │    │
│  │    • Public API responses: /api/v1/public/*                      │    │
│  │                                                                   │    │
│  │  L3: Application Cache (Redis)                                    │    │
│  │    • Read-through, write-behind                                   │    │
│  │    • TTL per entity type                                          │    │
│  │    • Automatic invalidation on entity update                      │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                                                                           │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │ What We Cache                                                      │    │
│  │                                                                   │    │
│  │  Cache Name     │ Key Pattern                     │ TTL  │ Strategy│
│  │ ─────────────── │ ─────────────────────────────── │ ──── │ ─────── │
│  │ user_permissions│ v1:{org}:user:{id}:permissions  │ 5min │ Write   │
│  │ org_settings    │ v1:{org}:settings               │ 1hr  │ Write   │
│  │ tenant_config   │ v1:{org}:config                 │ 1hr  │ Write   │
│  │ entity_lead     │ v1:{org}:lead:{id}             │ 5min │ Read    │
│  │ entity_contact  │ v1:{org}:contact:{id}          │ 5min │ Read    │
│  │ role            │ v1:{org}:role:{id}              │ 5min │ Write   │
│  │ report_results  │ v1:{org}:report:{hash}         │ 30min│ Read    │
│  │ dashboard_data  │ v1:{org}:dash:{id}             │ 5min │ Read    │
│  │ feature_flags   │ v1:{org}:features              │ 5min │ Write   │
│  └──────────────────────────────────────────────────────────────────┘    │
│                                                                           │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │ Invalidation Strategy                                              │    │
│  │                                                                   │    │
│  │ • Write-through: Update cache when entity is saved               │    │
│  │ • Event-driven: Subscribe to entity updated events to invalidate  │    │
│  │ • TTL expiry: Automatic eviction after configured TTL             │    │
│  │ • Manual: Admin UI allows cache clear per entity or per tenant    │    │
│  └──────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────┘
```

### 3.4 Logging Strategy

```
┌──────────────────────────────────────────────────────────────────────────┐
│ LOGGING STRATEGY                                                          │
│                                                                           │
│  Framework: structlog (structured JSON logging)                          │
│                                                                           │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │ Log Enrichment                                                     │    │
│  │                                                                   │    │
│  │ Every log entry includes:                                          │    │
│  │ • timestamp: ISO 8601 with timezone                               │    │
│  │ • level: debug | info | warning | error | critical                │    │
│  │ • event: machine-readable event name (e.g., "lead_created")       │    │
│  │ • logger: module.path (e.g., "lead_management.application.svc")   │    │
│  │ • request_id: UUID v7 per request                                 │    │
│  │ • tenant_id: organization UUID (always present for tenant ops)    │    │
│  │ • user_id: user UUID (if authenticated)                           │    │
│  │ • trace_id: OpenTelemetry trace ID                                │    │
│  │ • duration_ms: request/task duration (if applicable)              │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                                                                           │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │ Log Levels                                                        │    │
│  │                                                                   │    │
│  │ • debug: Development only — never in production                   │    │
│  │ • info: Business events (entity created, notification sent)      │    │
│  │ • warning: Degraded state (retry, rate limit nearing, cache miss) │    │
│  │ • error: Recoverable failure (API timeout, task failure)          │    │
│  │ • critical: Unrecoverable (DB down, RLS misconfig, disk full)    │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                                                                           │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │ Log Format                                                        │    │
│  │                                                                   │    │
│  │ {"timestamp":"2026-07-27T10:30:00.123Z","level":"info",          │    │
│  │  "event":"lead_created","logger":"lead_management.app.svc",      │    │
│  │  "request_id":"abc123","tenant_id":"org_uuid",                   │    │
│  │  "user_id":"user_uuid","lead_id":"lead_uuid","duration_ms":45}   │    │
│  └──────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────┘
```

### 3.5 Error Handling

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ERROR HANDLING STRATEGY                                                   │
│                                                                           │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │ Error Classification                                               │    │
│  │                                                                   │    │
│  │  DomainException (predictable business rule violations)           │    │
│  │   → HTTP 400/404/409 with error code and message                  │    │
│  │   → e.g., LeadNotFoundError, InvalidTransitionError               │    │
│  │                                                                   │    │
│  │  ApplicationException (infrastructure errors, unexpected)         │    │
│  │   → HTTP 500 with error_id (not details)                         │    │
│  │   → Logged with full stack trace                                 │    │
│  │   → Alert triggered if critical                                  │    │
│  │                                                                   │    │
│  │  ValidationError (input validation failures)                      │    │
│  │   → HTTP 422 with field-level errors                             │    │
│  │   → Caught by DRF serializer validation                          │    │
│  │                                                                   │    │
│  │  SecurityException (auth/authz failures)                          │    │
│  │   → HTTP 401 (unauthorized) or 403 (forbidden)                   │    │
│  │   → Logged with security context                                 │    │
│  │   → Rate limited to prevent enumeration                          │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                                                                           │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │ Result Type (Application Layer)                                   │    │
│  │                                                                   │    │
│  │ @dataclass                                                        │    │
│  │ class Result[T, E]:                                               │    │
│  │     value: T | None                                               │    │
│  │     error: E | None                                               │    │
│  │                                                                   │    │
│  │     @staticmethod                                                 │    │
│  │     def ok(value: T) -> Result[T, E]: ...                        │    │
│  │                                                                   │    │
│  │     @staticmethod                                                 │    │
│  │     def fail(error: E) -> Result[T, E]: ...                      │    │
│  │                                                                   │    │
│  │     def is_ok(self) -> bool: ...                                  │    │
│  │     def unwrap(self) -> T: ...                                    │    │
│  │     def unwrap_or(self, default: T) -> T: ...                     │    │
│  │                                                                   │    │
│  │ Service methods return Result[T, E] — never throw for expected   │    │
│  │ errors. Unexpected errors (infrastructure failures) still throw   │    │
│  │ and are caught by DRF exception handler.                          │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                                                                           │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │ Standard Error Response Body                                       │    │
│  │                                                                   │    │
│  │ // Domain/Validation Error                                        │    │
│  │ {                                                                 │    │
│  │   "error": {                                                      │    │
│  │     "code": "LEAD_NOT_FOUND",                                    │    │
│  │     "message": "Lead with id 'abc-123' not found in this org",   │    │
│  │     "details": { "lead_id": "abc-123" }                          │    │
│  │   },                                                              │    │
│  │   "request_id": "req-abc-123"                                     │    │
│  │ }                                                                 │    │
│  │                                                                   │    │
│  │ // Validation Errors (422)                                        │    │
│  │ {                                                                 │    │
│  │   "error": {                                                      │    │
│  │     "code": "VALIDATION_ERROR",                                  │    │
│  │     "message": "Input validation failed",                         │    │
│  │     "details": {                                                  │    │
│  │       "email": ["Enter a valid email address."],                  │    │
│  │       "phone": ["This field is required."]                        │    │
│  │     }                                                             │    │
│  │   },                                                              │    │
│  │   "request_id": "req-abc-123"                                     │    │
│  │ }                                                                 │    │
│  │                                                                   │    │
│  │ // Server Error (500)                                             │    │
│  │ {                                                                 │    │
│  │   "error": {                                                      │    │
│  │     "code": "INTERNAL_ERROR",                                    │    │
│  │     "message": "An unexpected error occurred",                    │    │
│  │     "error_id": "err-abc-123"    // for support lookup            │    │
│  │   },                                                              │    │
│  │   "request_id": "req-abc-123"                                     │    │
│  │ }                                                                 │    │
│  └──────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Communication Patterns

### 4.1 Synchronous (REST)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ SYNCHRONOUS COMMUNICATION (REST)                                         │
│                                                                           │
│  Use Case: Cross-module reads, querying data owned by another module     │
│  Mechanism: HTTP call to internal API endpoint                           │
│  Guarantee: At-most-once                                                 │
│  Timeout: 5 seconds (internal)                                           │
│                                                                           │
│  ┌──────────┐                    ┌──────────┐                           │
│  │ Module A  │   HTTP GET /api   │ Module B │                           │
│  │ (Service) │──────────────────►│ (API)    │                           │
│  │           │◄──────────────────│          │                           │
│  └──────────┘       JSON         └──────────┘                           │
│                                                                           │
│  Rules:                                                                   │
│  1. Only Application Service → Application Service                       │
│  2. Never ViewSet → ViewSet directly                                     │
│  3. Use internal HTTP client (service-to-service)                        │
│  4. Include tenant_id in headers for RLS scoping                        │
│  5. Timeout must be shorter than caller's timeout                        │
│  6. Circuit breaker on repeated failures                                 │
└──────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Asynchronous (Events)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ASYNCHRONOUS COMMUNICATION (DOMAIN EVENTS)                               │
│                                                                           │
│  Use Case: Side effects after a command executes                         │
│  Mechanism: Domain events → RabbitMQ → Celery worker                     │
│  Guarantee: At-least-once                                                 │
│  Latency: ~100ms to 5s (from publish to handler execution)              │
│                                                                           │
│  ┌──────────┐    ┌──────────────┐    ┌──────────┐    ┌──────────┐      │
│  │ Module A  │───►│  Aggregate   │───►│   Event   │───►│ RabbitMQ │      │
│  │ (Service) │    │  records     │    │Publisher  │    │ Exchange │      │
│  └──────────┘    │  event       │    └──────────┘    └────┬─────┘      │
│                  └──────────────┘                         │              │
│                                                            │              │
│                                                            ▼              │
│                                                   ┌──────────────────┐   │
│                                                   │  Celery Worker    │   │
│                                                   │  (Module B)      │   │
│                                                   │  • Validate      │   │
│                                                   │  • Idempotency   │   │
│                                                   │  • Handle event  │   │
│                                                   │  • ACK / RETRY   │   │
│                                                   └──────────────────┘   │
│                                                                           │
│  Rules:                                                                   │
│  1. Service collects events from aggregate, publishes after commit       │
│  2. Idempotency key = event_id (SETNX in Redis)                         │
│  3. All handlers must be idempotent                                      │
│  4. Events carry full context for the handler (no read-back needed)      │
└──────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Real-Time (WebSocket)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ REAL-TIME COMMUNICATION (WEBSOCKET)                                      │
│                                                                           │
│  Use Case: Real-time UI updates (notifications, activity feed, dashboards)│
│  Mechanism: Django Channels + Redis channel layer                        │
│  Scope: Per-user, per-organization                                       │
│                                                                           │
│  ┌──────────┐    ┌──────────────┐    ┌──────────┐    ┌──────────┐      │
│  │ Browser   │───►│  ALB / nginx │───►│ Uvicorn  │───►│ Channels │      │
│  │ (React)   │◄───│  (WS upgrade)│◄───│ (ASGI)   │◄───│ Consumer │      │
│  └──────────┘    └──────────────┘    └──────────┘    └──────────┘      │
│                                                            │              │
│                                                            │              │
│                                                   ┌────────┴────────┐    │
│                                                   │  Redis Channel  │    │
│                                                   │  Layer          │    │
│                                                   │  • group_send() │    │
│                                                   └─────────────────┘    │
│                                                                           │
│  Channels:                                                                │
│  • user_{user_id} — Personal notifications                              │
│  • org_{org_id} — Organization-wide events                              │
│  • pipeline_{pipeline_id} — Pipeline changes                             │
│                                                                           │
│  Events sent via WebSocket:                                               │
│  • notification.new — New in-app notification                           │
│  • entity.updated — Lead/contact/opportunity updated (for live views)   │
│  • dashboard.refresh — Dashboard data needs refresh                     │
│  • workflow.executed — Workflow execution result                         │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Data Flow Diagrams

### 5.1 Lead Creation Flow

```
User (Sales Rep)                     Frontend (React)              Django API                  Domain Layer            Infrastructure           RabbitMQ              Celery Workers
      │                                     │                         │                            │                       │                    │                      │
      │ 1. Fill lead form                   │                         │                            │                       │                    │                      │
      │────────────────────────────────────►│                         │                            │                       │                    │                      │
      │                                     │                         │                            │                       │                    │                      │
      │                                     │ 2. POST /api/v1/leads/  │                            │                       │                    │                      │
      │                                     │────────────────────────►│                            │                       │                    │                      │
      │                                     │                         │                            │                       │                    │                      │
      │                                     │                         │ 3. Auth + Tenant Middleware │                       │                    │                      │
      │                                     │                         │───────────────────────────►│                       │                    │                      │
      │                                     │                         │◄───────────────────────────│                       │                    │                      │
      │                                     │                         │                            │                       │                    │                      │
      │                                     │                         │ 4. Validate Input          │                       │                    │                      │
      │                                     │                         │ 5. Check Duplicates        │                       │                    │                      │
      │                                     │                         │ 6. Call CreateLeadService  │                       │                    │                      │
      │                                     │                         │───────────────────────────►│                       │                    │                      │
      │                                     │                         │                            │                       │                    │                      │
      │                                     │                         │                            │ 7. Lead.create()     │                    │                      │
      │                                     │                         │                            │ 8. Validate rules    │                    │                      │
      │                                     │                         │                            │ 9. Record events     │                    │                      │
      │                                     │                         │                            │ 10. Return aggregate │                    │                      │
      │                                     │                         │                            ├──────────────────────►│                    │                      │
      │                                     │                         │                            │                       │                    │                      │
      │                                     │                         │                            │                       │ 11. Repo.save(lead) │                      │
      │                                     │                         │                            │                       │ 12. INSERT INTO DB │                      │
      │                                     │                         │                            │                       │ 13. Invalidate cache│                      │
      │                                     │                         │                            │                       ├───────────────────►│                      │
      │                                     │                         │                            │                       │                    │                      │
      │                                     │                         │ 14. Return LeadDTO (201)   │                       │                    │                      │
      │                                     │◄────────────────────────│                            │                       │                    │                      │
      │                                     │                         │                            │                       │                    │                      │
      │ 15. Display new lead                │                         │                            │                       │                    │                      │
      │◄────────────────────────────────────│                         │                            │                       │                    │                      │
      │                                     │                         │                            │                       │                    │                      │
      │                                     │                         │ 16. Publish events         │                       │                    │                      │
      │                                     │                         │───────────────────────────►│                       │                    │                      │
      │                                     │                         │                            │                       │ 17. Pub LeadCreated │                      │
      │                                     │                         │                            │                       │───────────────────►│                      │
      │                                     │                         │                            │                       │                    │                      │
      │                                     │                         │                            │                       │                    │ 18. Workflow eval   │
      │                                     │                         │                            │                       │                    │◄─────────────────────│
      │                                     │                         │                            │                       │                    │ 19. Check conditions│
      │                                     │                         │                            │                       │                    │ 20. Execute actions │
      │                                     │                         │                            │                       │                    │                      │
      │                                     │                         │                            │                       │                    │ 21. Send notif      │
      │                                     │                         │                            │                       │                    │◄─────────────────────│
      │                                     │                         │                            │                       │                    │                      │
      │ 22. Real-time notification          │                         │                            │                       │                    │                      │
      │◄────────────────────────────────────│                         │                            │                       │                    │                      │
```

### 5.2 Opportunity Stage Transition Flow

```
User (Sales Rep)                    Django API                     Domain Layer               Infrastructure             RabbitMQ              Celery Workers
      │                                  │                            │                          │                       │                      │
      │ PATCH /opportunities/{id}       │                            │                          │                       │                      │
      │ { "stage": "negotiation" }      │                            │                          │                       │                      │
      │────────────────────────────────►│                            │                          │                       │                      │
      │                                  │                            │                          │                       │                      │
      │                                  │ 1. Validate permission    │                          │                       │                      │
      │                                  │ 2. Load opportunity       │                          │                       │                      │
      │                                  │──────────────────────────►│                          │                       │                      │
      │                                  │                            │                          │                       │                      │
      │                                  │                            │ 3. Opportunity.change    │                       │                      │
      │                                  │                            │    Stage("negotiation")  │                       │                      │
      │                                  │                            │ 4. Validate transition   │                       │                      │
      │                                  │                            │    (qualified →          │                       │                      │
      │                                  │                            │     negotiation allowed) │                       │                      │
      │                                  │                            │ 5. Update probability    │                       │                      │
      │                                  │                            │    (40% → 70%)          │                       │                      │
      │                                  │                            │ 6. Record event:        │                       │                      │
      │                                  │                            │    StageChangedEvent     │                       │                      │
      │                                  │◄──────────────────────────│                          │                       │                      │
      │                                  │                            │                          │                       │                      │
      │                                  │ 7. Repo.save(oppty)       │                          │                       │                      │
      │                                  │───────────────────────────►│ 8. UPDATE opportunity   │                       │                      │
      │                                  │                            │ 9. INSERT stage_history │                       │                      │
      │                                  │                            │ 10. Invalidate forecast │                       │                      │
      │                                  │◄──────────────────────────│     cache                │                       │                      │
      │                                  │                            │                          │                       │                      │
      │                                  │ 11. Publish events        │                          │                       │                      │
      │                                  │───────────────────────────►│────────────────────────►│ StageChanged          │                      │
      │                                  │                            │                          │                       │                      │
      │                                  │                            │                          │                       │ 12. Update forecast  │
      │                                  │                            │                          │                       │◄─────────────────────│
      │                                  │                            │                          │                       │ 13. Check stage      │
      │                                  │                            │                          │                       │     workflows        │
      │                                  │                            │                          │                       │ 14. Update rollup    │
      │                                  │                            │                          │                       │                      │
      │                                  │                            │                          │                       │ 15. Notify manager   │
      │                                  │                            │                          │                       │◄─────────────────────│
      │                                  │                            │                          │                       │                      │
      │ 200 OK { opportunity updated }   │                            │                          │                       │                      │
      │◄─────────────────────────────────│                            │                          │                       │                      │
```

### 5.3 Workflow Execution Flow

```
Domain Event Published (e.g., LeadCreated)
        │
        ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ Celery Worker: workflow_queue                                             │
│                                                                           │
│ 1. Receive event                                                         │
│ 2. Restore tenant context (SET org_id)                                   │
│ 3. Idempotency check (Redis SETNX)                                       │
│                                                                           │
│ 4. Query active workflows matching trigger:                               │
│    Workflow.objects.filter(                                              │
│        organization_id=org_id,                                            │
│        trigger_event_type="lead_management.lead.created",                │
│        is_enabled=True                                                   │
│    )                                                                     │
│    → Returns list of matching workflow definitions                       │
│                                                                           │
│ 5. For each matching workflow:                                           │
│    a) Evaluate conditions:                                               │
│       Condition Tree:                                                    │
│       AND                                                                │
│       ├── source.equals("Website")         → TRUE                      │
│       ├── score.greater_than(50)           → FALSE                     │
│       └── assigned_to.is_null()            → TRUE                      │
│       → Overall: FALSE (score condition not met)                        │
│       → Skip to next workflow                                            │
│                                                                           │
│    b) If conditions pass, execute actions:                               │
│       Action 1: Assign to round-robin queue                              │
│         → Call LeadService.assign(lead_id, queue_id)                    │
│       Action 2: Send email to assignee                                   │
│         → Call NotificationService.send_email(...)                      │
│       Action 3: Create follow-up task                                    │
│         → Call TaskService.create(...)                                   │
│       Action 4: Post to Slack channel                                    │
│         → Call SlackClient.post_message(...)                            │
│                                                                           │
│ 6. Log execution result:                                                 │
│    WorkflowExecution.create(                                             │
│        workflow=workflow,                                                 │
│        trigger_event=event,                                               │
│        conditions_evaluated=[...],                                        │
│        actions_executed=[...],                                            │
│        status="SUCCESS",                                                  │
│        duration_ms=1234                                                   │
│    )                                                                     │
│                                                                           │
│ 7. Handle failures:                                                      │
│    • Action fails → retry 3 times with backoff                          │
│    • All actions fail → workflow marked as FAILED                        │
│    • Partial success → workflow marked as PARTIAL                        │
│    • After 3 retries → DLQ + alert                                       │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Integration Patterns

### 6.1 REST Outbound

```
┌──────────────────────────────────────────────────────────────────────────┐
│ REST OUTBOUND PATTERN                                                     │
│                                                                           │
│  Technology: httpx (async) / requests (sync) with retry + circuit breaker│
│  Used by: Integrations module, Notification module                       │
│                                                                           │
│  ┌────────────┐    ┌──────────────┐    ┌──────────────┐                  │
│  │ Integration │───►│  Circuit     │───►│  Retry with   │                  │
│  │ Service     │    │  Breaker     │    │  Backoff      │                  │
│  └────────────┘    └──────────────┘    └──────┬───────┘                  │
│                                                │                          │
│                                                ▼                          │
│                                       ┌────────────────┐                │
│                                       │  External API   │                │
│                                       │  (SendGrid,     │                │
│                                       │   Twilio, etc)  │                │
│                                       └────────────────┘                │
│                                                                           │
│  Circuit Breaker States:                                                  │
│  CLOSED (normal) → OPEN (5 failures in 60s) → HALF_OPEN (try after 30s) │
│                                                                           │
│  Retry Policy:                                                            │
│  • HTTP 5xx: retry 3 times (1s, 4s, 16s)                                │
│  • HTTP 429: retry after Retry-After header                              │
│  • HTTP 4xx (excluding 429): no retry (client error)                     │
│  • Timeout: retry 2 times                                                 │
└──────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Webhook (Outbound)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ WEBHOOK OUTBOUND PATTERN                                                  │
│                                                                           │
│  Trigger: Domain event (e.g., LeadCreated) → matched webhook subscription│
│  Delivery: Celery task with retry + HMAC signing                         │
│                                                                           │
│  ┌────────────┐    ┌──────────────┐    ┌─────────────────────┐          │
│  │  Domain     │───►│  Webhook     │───►│  Celery Task:       │          │
│  │  Event Bus  │    │  Matcher     │    │  deliver_webhook()  │          │
│  └────────────┘    └──────────────┘    └──────────┬──────────┘          │
│                                                    │                      │
│                                                    ▼                      │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │ Webhook Delivery Process                                         │    │
│  │                                                                   │    │
│  │ 1. Load webhook subscription (url, secret, headers, retry config)│    │
│  │ 2. Build payload: { event, data, timestamp, delivery_id }        │    │
│  │ 3. Compute HMAC-SHA256 signature: HMAC(secret, payload)          │    │
│  │ 4. POST to target URL:                                           │    │
│  │    Headers:                                                      │    │
│  │      Content-Type: application/json                             │    │
│  │      X-Tzahu-Signature: sha256=<hex>                            │    │
│  │      X-Tzahu-Delivery-Id: <uuid>                                │    │
│  │      X-Tzahu-Timestamp: <unix_ms>                               │    │
│  │ 5. Handle response:                                              │    │
│  │    • 2xx → success, log delivery                                │    │
│  │    • 4xx → failure, no retry (client error)                     │    │
│  │    • 5xx → retry (3 attempts, exponential backoff: 10s, 60s, 5m)│    │
│  │    • Timeout → retry                                             │    │
│  │ 6. After 3 failures → disable subscription, alert admin          │    │
│  └──────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────┘
```

### 6.3 Webhook (Inbound)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ WEBHOOK INBOUND PATTERN                                                   │
│                                                                           │
│  Endpoint: POST /api/v1/public/webhook/{provider}                        │
│  Authentication: Signature verification per provider                     │
│  Rate Limit: 100/min per IP                                              │
│                                                                           │
│  ┌────────────┐    ┌──────────────┐    ┌──────────────────┐            │
│  │ External    │───►│  Django View  │───►│  Signature       │            │
│  │ System      │    │  /webhook/   │    │  Verification    │            │
│  │ (HubSpot,   │    │              │    │                  │            │
│  │  Slack,     │    └──────────────┘    └────────┬─────────┘            │
│  │  GitHub)    │                                 │                       │
│  └────────────┘                                  ▼                       │
│                                          ┌──────────────────┐           │
│                                          │  Provider         │           │
│                                          │  Specific         │           │
│                                          │  Validator        │           │
│                                          └────────┬─────────┘           │
│                                                   │                      │
│                                                   ▼                      │
│                                          ┌──────────────────┐           │
│                                          │  Publish Internal  │           │
│                                          │  Domain Event     │           │
│                                          └──────────────────┘           │
│                                                                           │
│  Provider Signature Verification:                                        │
│  • HubSpot: X-HubSpot-Signature (HMAC-SHA256)                           │
│  • Slack: X-Slack-Signature (HMAC-SHA256, timestamp tolerance 5min)     │
│  • GitHub: X-Hub-Signature-256 (HMAC-SHA256)                            │
│  • Custom: X-Tzahu-Signature (HMAC-SHA256, shared secret)               │
│                                                                           │
│  Idempotency: X-Tzahu-Delivery-Id header (or provider equivalent)       │
└──────────────────────────────────────────────────────────────────────────┘
```

### 6.4 OAuth 2.0

```
┌──────────────────────────────────────────────────────────────────────────┐
│ OAUTH 2.0 PATTERN                                                         │
│                                                                           │
│  Technology: requests-oauthlib                                           │
│  Used by: Google, Microsoft, HubSpot integrations                        │
│  Token Storage: AES-256-GCM encrypted in database                        │
│                                                                           │
│  Initial Auth Flow:                                                       │
│  ┌────────────┐    ┌──────────────┐    ┌──────────────┐                │
│  │  User      │───►│  Django       │───►│  Provider     │                │
│  │  (Frontend)│    │  /auth/start  │    │  (Google)    │                │
│  │            │◄───│              │◄───│              │                │
│  └────────────┘    └──────────────┘    └──────────────┘                │
│       │                    │                                             │
│       │                    │ 3. Receive authorization_code              │
│       │                    │ 4. Exchange for access_token + refresh_token│
│       │                    │ 5. Encrypt tokens (AES-256-GCM)            │
│       │                    │ 6. Store in integrations_oauth_tokens       │
│       │                    │ 7. Return "Connected" to user              │
│       │                    │                                             │
│  Token Refresh (automatic):                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐              │
│  │ Sync Engine   │───►│  Token        │───►│  Provider     │              │
│  │ (needs token)  │    │  Manager      │    │  Token        │              │
│  │               │◄───│              │◄───│  Endpoint    │              │
│  └──────────────┘    └──────────────┘    └──────────────┘              │
│       │                    │                                             │
│       │                    │ 1. Check token expiry                      │
│       │                    │ 2. If expired (or 5min before):            │
│       │                    │ 3. Decrypt refresh_token                   │
│       │                    │ 4. POST refresh_token to provider          │
│       │                    │ 5. Receive new access_token + refresh_token│
│       │                    │ 6. Encrypt and store new tokens            │
│       │                    │ 7. Return valid access_token               │
│       │                    │                                             │
│  Security:                                                               │
│  • Tokens encrypted with AES-256-GCM, key in Vault/Secrets Manager      │
│  • Decrypted only in-memory for the duration of the API call            │
│  • Token refresh proactively (5min before expiry)                       │
│  • Failed refresh → notify admin to re-authenticate                     │
└──────────────────────────────────────────────────────────────────────────┘
```

### 6.5 Pub/Sub (Internal)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ PUB/SUB PATTERN (INTERNAL)                                               │
│                                                                           │
│  Publisher: Any module's Application Service                             │
│  Broker: RabbitMQ topic exchange (domain_events.topic)                   │
│  Subscriber: Any module's Event Handler (via Celery)                     │
│                                                                           │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │ Topic Exchange: domain_events.topic                                │    │
│  │                                                                    │    │
│  │  Publisher 1 (lead_management):                                    │    │
│  │    → lead_management.lead.created                                 │    │
│  │    → lead_management.lead.updated                                 │    │
│  │    → lead_management.lead.converted                               │    │
│  │                                                                    │    │
│  │  Publisher 2 (pipeline_management):                                │    │
│  │    → pipeline_management.opportunity.created                      │    │
│  │    → pipeline_management.opportunity.stage_changed                │    │
│  │    → pipeline_management.opportunity.won                          │    │
│  │    → pipeline_management.opportunity.lost                         │    │
│  │                                                                    │    │
│  │  Publisher 3 (activity):                                           │    │
│  │    → activity.task.created                                        │    │
│  │    → activity.task.completed                                      │    │
│  │    → activity.activity.logged                                     │    │
│  │                                                                    │    │
│  │  ─────────────────────────────────────────────────────────────     │    │
│  │                                                                    │    │
│  │  Queue: workflow_queue                                             │    │
│  │    Bindings:                                                       │    │
│  │    • *.lead.*       → Lead-related events trigger workflows       │    │
│  │    • *.opportunity.*→ Opportunity events trigger workflows         │    │
│  │    • *.task.*       → Task events trigger workflows               │    │
│  │    • *.activity.*   → Activity events trigger workflows           │    │
│  │                                                                    │    │
│  │  Queue: notification_queue                                         │    │
│  │    Bindings:                                                       │    │
│  │    • *.lead.created        → Notify assignee                      │    │
│  │    • *.lead.assigned       → Notify new owner                     │    │
│  │    • *.opportunity.won     → Notify team                          │    │
│  │    • *.task.assigned       → Notify assignee                      │    │
│  │    • *.workflow.completed  → Notify workflow creator              │    │
│  │                                                                    │    │
│  │  Queue: integration_queue                                          │    │
│  │    Bindings:                                                       │    │
│  │    • *.lead.*             → Sync to external systems              │    │
│  │    • *.contact.*          → Sync to external systems              │    │
│  │    • *.opportunity.*      → Sync to external systems              │    │
│  │    • integration.webhook.*→ Deliver outbound webhooks             │    │
│  │                                                                    │    │
│  │  Queue: audit_queue                                                │    │
│  │    Bindings:                                                       │    │
│  │    • #                    → All events (fanout)                   │    │
│  └──────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Security Architecture

### 7.1 Six-Layer Isolation Model

```
┌──────────────────────────────────────────────────────────────────────────┐
│ 6-LAYER SECURITY ISOLATION MODEL                                         │
│                                                                           │
│  LAYER 6: NETWORK ISOLATION                                              │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │ • Private subnets for all application services                   │    │
│  │ • No direct internet access for DB, Redis, RabbitMQ              │    │
│  │ • AI Gateway in separate namespace with restricted egress        │    │
│  │ • mTLS for service-to-service communication                      │    │
│  │ • Security groups: minimal necessary rules                       │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                                    │                                      │
│  LAYER 5: API GATEWAY / WAF                                              │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │ • AWS WAF: SQL injection, XSS, rate-based rules                  │    │
│  │ • API rate limiting (tiered by plan)                              │    │
│  │ • CORS origin validation                                          │    │
│  │ • Request size limiting (10MB)                                    │    │
│  │ • Security headers (HSTS, CSP, X-Frame-Options)                  │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                                    │                                      │
│  LAYER 4: AUTHENTICATION                                                 │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │ • JWT (RS256 signed, 15min expiry)                               │    │
│  │ • Refresh token rotation (7 days, hashed in DB)                  │    │
│  │ • jti revocation via Redis                                       │    │
│  │ • Rate limiting on /auth/login (5/15min per IP)                  │    │
│  │ • Email verification before first login                          │    │
│  │ • bcrypt password hashing (cost 12)                              │    │
│  │ • Password policy: min 12 chars, complexity, history(5)         │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                                    │                                      │
│  LAYER 3: AUTHORIZATION (RBAC)                                          │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │ • Flat RBAC: Role → set of permissions                          │    │
│  │ • Permission check at API layer (DRF Permission classes)        │    │
│  │ • Permission check at Service layer (for background tasks)      │    │
│  │ • Permission naming: {entity}.{action}                          │    │
│  │ • Scope: org-wide, team, own (Phase 1: org-wide)                │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                                    │                                      │
│  LAYER 2: APPLICATION-LEVEL TENANT SCOPE                                │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │ • TenantResolutionMiddleware: SET app.current_organization_id    │    │
│  │ • TenantScopedRepository: .filter(organization_id=org_id)       │    │
│  │ • Cache keys prefixed with org_id                                │    │
│  │ • Celery TenantAwareTask: restores tenant context                │    │
│  │ • File storage paths prefixed with org_id                        │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                                    │                                      │
│  LAYER 1: DATABASE ROW-LEVEL SECURITY                                    │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │ • Every tenant-scoped table: ENABLE ROW LEVEL SECURITY          │    │
│  │ • FORCE ROW LEVEL SECURITY (applies to table owner)              │    │
│  │ • RLS policy: organization_id = current_setting('...')::uuid    │    │
│  │ • LAST LINE OF DEFENSE — catches application-level bugs          │    │
│  │ • RLS test suite: 10,000+ isolation assertions                   │    │
│  │ • Regular RLS policy audit (CI/CD)                              │    │
│  └──────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Threat Model (Key Threats)

| Threat | Layer | Mitigation |
|--------|-------|------------|
| Cross-tenant data leak via SQL injection | L1 (RLS) + L2 (Repository) | Django ORM parameterized queries; RLS as last defense; raw SQL prohibited |
| JWT theft → impersonation | L4 (Auth) | Short-lived (15min); jti revocation; refresh rotation; rate limiting |
| Privilege escalation | L3 (RBAC) | Flat RBAC; permission check on every endpoint; test suite for role boundaries |
| Tenant A reads Tenant B data via API | L2 (Tenant) + L1 (RLS) | Tenant middleware sets RLS context; RLS prevents cross-tenant reads |
| Prompt injection via CRM data fields | AI Gateway | Input sanitization in embedding pipeline; output filtering; rate limits |
| OAuth token theft → external data access | Integration | AES-256-GCM encryption; decrypted in-memory only; short-lived scopes |
| Denial of service (API) | L5 (WAF/Gateway) | Rate limiting; WAF rate-based rules; request size limits; HPA auto-scaling |
| RLS policy gap on new table | L1 (RLS) | Migration linter checks for RLS on TenantScopedModel; CI/CD enforces |

---

> **Version:** 0.1.0-draft | **Last Updated:** 2026-07-27
> **Cross-reference:** [10_ArchitectureOverview.md](./10_ArchitectureOverview.md),
> [11_SystemArchitecture.md](./11_SystemArchitecture.md),
> [13_LowLevelDesign.md](./13_LowLevelDesign.md),
> [14_ModuleDependencyMap.md](./14_ModuleDependencyMap.md)
