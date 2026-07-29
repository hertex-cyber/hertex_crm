# TZAHU CRM — Module Dependency Map

> **Version:** 0.1.0-draft
> **Last Updated:** 2026-07-27
> **Status:** Foundational Design Phase
> **Owner:** Platform Architecture Team

---

## Table of Contents

1. [Allowed Dependency Graph](#1-allowed-dependency-graph)
2. [Forbidden Dependency Rules](#2-forbidden-dependency-rules)
3. [import-linter Configuration](#3-import-linter-configuration)
4. [Shared Kernel Exception Rules](#4-shared-kernel-exception-rules)
5. [Module Ownership Matrix](#5-module-ownership-matrix)
6. [API Surface per Module](#6-api-surface-per-module)
7. [Event Subscription Map](#7-event-subscription-map)
8. [Governance](#8-governance)

---

## 1. Allowed Dependency Graph

### 1.1 Module Dependency Hierarchy

```
                                 ┌────────────────┐
                                 │  Shared Kernel  │
                                 │  (Foundation)   │
                                 └────────────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    ▼                  ▼                  ▼
             ┌────────────┐   ┌────────────┐   ┌────────────┐
             │  identity   │   │  settings   │   │  common    │
             └──────┬─────┘   └────────────┘   └────────────┘
                    │
                    ▼
             ┌────────────┐
             │organization│
             └──────┬─────┘
                    │
                    ▼
             ┌────────────┐
             │   rbac     │
             └──────┬─────┘
                    │
                    ▼
             ┌────────────┐
             │   tenant   │
             └──────┬─────┘
                    │
        ┌───────────┼───────────┐
        ▼           ▼           ▼
 ┌────────────┐ ┌────────┐ ┌────────┐
 │ lead_mgmt  │ │ search │ │ audit  │
 └──────┬─────┘ └────────┘ └────────┘
        │
        ▼
 ┌────────────┐
 │ pipeline   │
 │  _mgmt     │
 └──────┬─────┘
        │
        ▼
 ┌────────────┐
 │  activity  │
 └──────┬─────┘
        │
        ▼
 ┌────────────┐
 │  calendar  │
 └──────┬─────┘
        │
        ▼
 ┌────────────┐
 │  workflow  │
 └──────┬─────┘
        │
        ▼
 ┌────────────┐
 │notification│
 └──────┬─────┘
        │
        ▼
 ┌────────────┐
 │  reports   │◄──── dashboard
 └──────┬─────┘
        │
        ▼
 ┌────────────┐
 │    ai      │
 └──────┬─────┘
        │
        ▼
 ┌────────────┐
 │ voice_ai   │
 └──────┬─────┘
        │
        ▼
 ┌────────────┐
 │integrations│
 └────────────┘
```

### 1.2 Text Dependency Table

| Module | Directly Depends On | Transitive Exemptions |
|--------|-------------------|----------------------|
| `shared_kernel` | None | N/A |
| `identity` | shared_kernel | None |
| `organization` | identity, shared_kernel | None |
| `rbac` | identity, organization, shared_kernel | None |
| `tenant` | identity, organization, rbac, shared_kernel | None |
| `lead_management` | tenant, shared_kernel | identity (for user FK refs) |
| `pipeline_management` | lead_management, tenant, shared_kernel | identity |
| `activity` | lead_management, pipeline_management, tenant, shared_kernel | identity |
| `calendar` | activity, identity, shared_kernel | tenant, organization |
| `workflow` | activity, lead_management, pipeline_management, notification, tenant, shared_kernel | identity, organization |
| `notification` | identity, shared_kernel | tenant, organization |
| `reports` | lead_management, pipeline_management, activity, workflow, notification, tenant, shared_kernel | identity, organization |
| `dashboard` | reports, shared_kernel | tenant, organization |
| `ai` | lead_management, pipeline_management, activity, tenant, shared_kernel | identity, organization |
| `voice_ai` | ai, activity, tenant, shared_kernel | identity, organization |
| `integrations` | all modules (via events), shared_kernel | identity, organization |
| `settings` | shared_kernel | None |
| `audit` | shared_kernel | identity, organization (for enrichment) |
| `search` | lead_management, pipeline_management, tenant, shared_kernel | identity |

### 1.3 Layer Dependency Rules (Within a Module)

```
api/  ──────────►  application/  ──────────►  domain/
  │                      │                       │
  │                      │                       │
  └──────────────────────┴───────────────────────┘
                         │
                         ▼
                  infrastructure/
                  (implements ports from domain & application)

Rules:
  domain/         → imports shared_kernel only
  application/    → imports domain/, shared_kernel, and abstract ports
  infrastructure/ → imports anything in module + shared_kernel
  api/            → imports application/, infrastructure/, shared_kernel
  No layer imports another module's internals
  Cross-module: adapters/event_handlers.py subscribes to events
```

---

## 2. Forbidden Dependency Rules

### 2.1 Absolute Forbidden Patterns

```
Rule F1: CYCLE — No circular dependencies between modules
  Violation: module_a → module_b → module_a
  Enforcement: import-linter forbids; CI fails on detection

Rule F2: SKIP_LAYER — API layer must not skip application layer
  Violation: api/views.py → domain/models.py (bypasses application)
  Enforcement: import-linter layer rules

Rule F3: DOMAIN_IMPORTS_DJANGO — Domain layer must not import Django
  Violation: domain/models.py → from django.db import models
  Enforcement: import-linter; mypy strict; code review

Rule F4: CROSS_MODULE_DOMAIN — No module domain imports another module's domain
  Violation: lead_management/domain/ → pipeline_management/domain/
  Correction: Use events, not direct imports
  Enforcement: import-linter

Rule F5: CROSS_MODULE_DB — No module reads another module's DB tables directly
  Violation: workflow/infrastructure/models.py → LeadModel
  Correction: Use API call or domain event
  Enforcement: import-linter; code review

Rule F6: UPSTREAM_DOWNSTREAM — No downstream module imports upstream module
  Violation: shared_kernel → identity (shared_kernel is foundation)
  Violation: identity → organization (organization depends on identity)
  Enforcement: import-linter

Rule F7: API_IMPORTS_INFRA — API layer must not depend on infrastructure directly
  Violation: api/views.py → infrastructure/repositories.py
  Correction: api → application → infrastructure
  Enforcement: import-linter

Rule F8: NO_RAW_SQL — Raw SQL prohibited in application code
  Exceptions: Infrastructure selectors (with review)
  Enforcement: ruff custom rule; code review

Rule F9: NO_IMPORT_BEYOND_API — No module imports another module's API layer
  Violation: workflow/application/ → lead_management/api/views.py
  Correction: Use internal HTTP client or domain events
  Enforcement: import-linter

Rule F10: ADAPTERS_ONLY — Event handlers for other modules live only in adapters/
  Violation: workflow/infrastructure/ → handles lead_created event directly
  Correction: workflow/adapters/event_handlers.py
  Enforcement: code review
```

### 2.2 Violation Severity

| Violation | Severity | CI Action | Review Action |
|-----------|---------|-----------|---------------|
| Cycle (F1) | Critical | Fail build | Block merge |
| Layer skip (F2) | Critical | Fail build | Block merge |
| Django in domain (F3) | Critical | Warn | Block merge |
| Cross-module domain import (F4) | High | Warn | Block merge |
| Cross-module DB access (F5) | Critical | Warn | Block merge |
| Reverse dependency (F6) | High | Fail build | Block merge |
| API imports infra (F7) | Medium | Warn | Request change |
| Raw SQL (F8) | Medium | Warn | Request change |
| Cross-module API import (F9) | High | Warn | Block merge |
| Handler in wrong place (F10) | Low | None | Request change |

---

## 3. import-linter Configuration

### 3.1 Base Configuration (`pyproject.toml`)

```toml
[tool.import-linter]
root_package = "apps"
include_local = true

# =============================================================================
# LAYER CONTRACTS (per module)
# =============================================================================
[[tool.import-linter.contracts]]
name = "Shared Kernel — No Dependencies"
type = "independence_contract"
modules = ["apps.shared_kernel"]
forbidden_modules = [
    "apps.identity",
    "apps.organization",
    "apps.rbac",
    "apps.tenant",
    "apps.lead_management",
    "apps.pipeline_management",
    "apps.activity",
    "apps.calendar",
    "apps.workflow",
    "apps.notification",
    "apps.dashboard",
    "apps.reports",
    "apps.ai",
    "apps.voice_ai",
    "apps.integrations",
    "apps.settings",
    "apps.audit",
    "apps.search",
]

[[tool.import-linter.contracts]]
name = "Identity — Layer Rules"
type = "layers_contract"
layers = [
    "apps.identity.api",
    "apps.identity.application",
    "apps.identity.domain",
    "apps.identity.infrastructure",
]
containers = ["apps.identity"]
can_import = {"apps.identity.domain" = ["apps.shared_kernel"]}

# =============================================================================
# MODULE DEPENDENCY CONTRACTS
# =============================================================================
[[tool.import-linter.contracts]]
name = "Identity — may depend on shared_kernel only"
type = "depend_contract"
modules = ["apps.identity"]
dependencies = ["apps.shared_kernel"]
forbidden_modules = [
    "apps.organization",
    "apps.rbac",
    "apps.tenant",
    "apps.lead_management",
    "apps.pipeline_management",
    "apps.activity",
    "apps.calendar",
    "apps.workflow",
    "apps.notification",
    "apps.dashboard",
    "apps.reports",
    "apps.ai",
    "apps.voice_ai",
    "apps.integrations",
    "apps.settings",
    "apps.audit",
    "apps.search",
]

[[tool.import-linter.contracts]]
name = "Organization — may depend on identity + shared_kernel"
type = "depend_contract"
modules = ["apps.organization"]
dependencies = ["apps.identity", "apps.shared_kernel"]
forbidden_modules = [
    "apps.rbac",
    "apps.tenant",
    "apps.lead_management",
    "apps.pipeline_management",
    "apps.activity",
    "apps.calendar",
    "apps.workflow",
    "apps.notification",
    "apps.dashboard",
    "apps.reports",
    "apps.ai",
    "apps.voice_ai",
    "apps.integrations",
    "apps.settings",
    "apps.audit",
    "apps.search",
]

[[tool.import-linter.contracts]]
name = "RBAC — may depend on identity + organization + shared_kernel"
type = "depend_contract"
modules = ["apps.rbac"]
dependencies = ["apps.identity", "apps.organization", "apps.shared_kernel"]
forbidden_modules = [
    "apps.tenant",
    "apps.lead_management",
    "apps.pipeline_management",
    "apps.activity",
    "apps.calendar",
    "apps.workflow",
    "apps.notification",
    "apps.dashboard",
    "apps.reports",
    "apps.ai",
    "apps.voice_ai",
    "apps.integrations",
    "apps.settings",
    "apps.audit",
    "apps.search",
]

[[tool.import-linter.contracts]]
name = "Tenant — may depend on identity + organization + rbac + shared_kernel"
type = "depend_contract"
modules = ["apps.tenant"]
dependencies = ["apps.identity", "apps.organization", "apps.rbac", "apps.shared_kernel"]
forbidden_modules = [
    "apps.lead_management",
    "apps.pipeline_management",
    "apps.activity",
    "apps.calendar",
    "apps.workflow",
    "apps.notification",
    "apps.dashboard",
    "apps.reports",
    "apps.ai",
    "apps.voice_ai",
    "apps.integrations",
    "apps.settings",
    "apps.audit",
    "apps.search",
]

[[tool.import-linter.contracts]]
name = "Lead Management — may depend on tenant + shared_kernel"
type = "depend_contract"
modules = ["apps.lead_management"]
dependencies = ["apps.tenant", "apps.shared_kernel"]
forbidden_modules = [
    "apps.identity",
    "apps.organization",
    "apps.rbac",
    "apps.pipeline_management",
    "apps.activity",
    "apps.calendar",
    "apps.workflow",
    "apps.notification",
    "apps.dashboard",
    "apps.reports",
    "apps.ai",
    "apps.voice_ai",
    "apps.integrations",
    "apps.settings",
    "apps.audit",
    "apps.search",
]
# Note: FK references to identity_users use settings.AUTH_USER_MODEL string,
# not a direct Python import. This is exempted.

[[tool.import-linter.contracts]]
name = "Pipeline Management — may depend on lead_management + tenant + shared_kernel"
type = "depend_contract"
modules = ["apps.pipeline_management"]
dependencies = ["apps.lead_management", "apps.tenant", "apps.shared_kernel"]
forbidden_modules = [
    "apps.identity",
    "apps.organization",
    "apps.rbac",
    "apps.activity",
    "apps.calendar",
    "apps.workflow",
    "apps.notification",
    "apps.dashboard",
    "apps.reports",
    "apps.ai",
    "apps.voice_ai",
    "apps.integrations",
    "apps.settings",
    "apps.audit",
    "apps.search",
]

[[tool.import-linter.contracts]]
name = "Activity — may depend on lead_management + pipeline_management + tenant + shared_kernel"
type = "depend_contract"
modules = ["apps.activity"]
dependencies = [
    "apps.lead_management",
    "apps.pipeline_management",
    "apps.tenant",
    "apps.shared_kernel",
]
forbidden_modules = [
    "apps.identity",
    "apps.organization",
    "apps.rbac",
    "apps.calendar",
    "apps.workflow",
    "apps.notification",
    "apps.dashboard",
    "apps.reports",
    "apps.ai",
    "apps.voice_ai",
    "apps.integrations",
    "apps.settings",
    "apps.audit",
    "apps.search",
]

[[tool.import-linter.contracts]]
name = "Workflow — may depend on activity + lead_management + pipeline_management + notification + tenant + shared_kernel"
type = "depend_contract"
modules = ["apps.workflow"]
dependencies = [
    "apps.activity",
    "apps.lead_management",
    "apps.pipeline_management",
    "apps.notification",
    "apps.tenant",
    "apps.shared_kernel",
]
forbidden_modules = [
    "apps.identity",
    "apps.organization",
    "apps.rbac",
    "apps.calendar",
    "apps.dashboard",
    "apps.reports",
    "apps.ai",
    "apps.voice_ai",
    "apps.integrations",
    "apps.settings",
    "apps.audit",
    "apps.search",
]

[[tool.import-linter.contracts]]
name = "Notification — may depend on identity + shared_kernel"
type = "depend_contract"
modules = ["apps.notification"]
dependencies = ["apps.identity", "apps.shared_kernel"]
forbidden_modules = [
    "apps.organization",
    "apps.rbac",
    "apps.tenant",
    "apps.lead_management",
    "apps.pipeline_management",
    "apps.activity",
    "apps.calendar",
    "apps.workflow",
    "apps.dashboard",
    "apps.reports",
    "apps.ai",
    "apps.voice_ai",
    "apps.integrations",
    "apps.settings",
    "apps.audit",
    "apps.search",
]

[[tool.import-linter.contracts]]
name = "Reports — may depend on core modules + tenant + shared_kernel"
type = "depend_contract"
modules = ["apps.reports"]
dependencies = [
    "apps.lead_management",
    "apps.pipeline_management",
    "apps.activity",
    "apps.workflow",
    "apps.notification",
    "apps.tenant",
    "apps.shared_kernel",
]
forbidden_modules = [
    "apps.identity",
    "apps.organization",
    "apps.rbac",
    "apps.calendar",
    "apps.dashboard",
    "apps.ai",
    "apps.voice_ai",
    "apps.integrations",
    "apps.settings",
    "apps.audit",
    "apps.search",
]

[[tool.import-linter.contracts]]
name = "Dashboard — may depend on reports + shared_kernel"
type = "depend_contract"
modules = ["apps.dashboard"]
dependencies = ["apps.reports", "apps.shared_kernel"]
forbidden_modules = [
    "apps.identity",
    "apps.organization",
    "apps.rbac",
    "apps.tenant",
    "apps.lead_management",
    "apps.pipeline_management",
    "apps.activity",
    "apps.calendar",
    "apps.workflow",
    "apps.notification",
    "apps.ai",
    "apps.voice_ai",
    "apps.integrations",
    "apps.settings",
    "apps.audit",
    "apps.search",
]

[[tool.import-linter.contracts]]
name = "AI — may depend on core modules + tenant + shared_kernel"
type = "depend_contract"
modules = ["apps.ai"]
dependencies = [
    "apps.lead_management",
    "apps.pipeline_management",
    "apps.activity",
    "apps.tenant",
    "apps.shared_kernel",
]
forbidden_modules = [
    "apps.identity",
    "apps.organization",
    "apps.rbac",
    "apps.calendar",
    "apps.workflow",
    "apps.notification",
    "apps.dashboard",
    "apps.reports",
    "apps.voice_ai",
    "apps.integrations",
    "apps.settings",
    "apps.audit",
    "apps.search",
]

[[tool.import-linter.contracts]]
name = "Voice AI — may depend on ai + activity + tenant + shared_kernel"
type = "depend_contract"
modules = ["apps.voice_ai"]
dependencies = ["apps.ai", "apps.activity", "apps.tenant", "apps.shared_kernel"]
forbidden_modules = [
    "apps.identity",
    "apps.organization",
    "apps.rbac",
    "apps.lead_management",
    "apps.pipeline_management",
    "apps.calendar",
    "apps.workflow",
    "apps.notification",
    "apps.dashboard",
    "apps.reports",
    "apps.integrations",
    "apps.settings",
    "apps.audit",
    "apps.search",
]

[[tool.import-linter.contracts]]
name = "Integrations — may depend on shared_kernel only (uses events for coupling)"
type = "depend_contract"
modules = ["apps.integrations"]
dependencies = ["apps.shared_kernel"]
# Integrations communicates with all modules via domain events, not imports
forbidden_modules = [
    "apps.identity",
    "apps.organization",
    "apps.rbac",
    "apps.tenant",
    "apps.lead_management",
    "apps.pipeline_management",
    "apps.activity",
    "apps.calendar",
    "apps.workflow",
    "apps.notification",
    "apps.dashboard",
    "apps.reports",
    "apps.ai",
    "apps.voice_ai",
    "apps.settings",
    "apps.audit",
    "apps.search",
]

[[tool.import-linter.contracts]]
name = "Settings — may depend on shared_kernel only"
type = "depend_contract"
modules = ["apps.settings"]
dependencies = ["apps.shared_kernel"]
forbidden_modules = [
    "apps.identity",
    "apps.organization",
    "apps.rbac",
    "apps.tenant",
    "apps.lead_management",
    "apps.pipeline_management",
    "apps.activity",
    "apps.calendar",
    "apps.workflow",
    "apps.notification",
    "apps.dashboard",
    "apps.reports",
    "apps.ai",
    "apps.voice_ai",
    "apps.integrations",
    "apps.audit",
    "apps.search",
]

[[tool.import-linter.contracts]]
name = "Audit — may depend on shared_kernel only (events are consumed via message broker)"
type = "depend_contract"
modules = ["apps.audit"]
dependencies = ["apps.shared_kernel"]
forbidden_modules = [
    "apps.identity",
    "apps.organization",
    "apps.rbac",
    "apps.tenant",
    "apps.lead_management",
    "apps.pipeline_management",
    "apps.activity",
    "apps.calendar",
    "apps.workflow",
    "apps.notification",
    "apps.dashboard",
    "apps.reports",
    "apps.ai",
    "apps.voice_ai",
    "apps.integrations",
    "apps.settings",
    "apps.search",
]

[[tool.import-linter.contracts]]
name = "Search — may depend on lead_management + pipeline_management + tenant + shared_kernel"
type = "depend_contract"
modules = ["apps.search"]
dependencies = ["apps.lead_management", "apps.pipeline_management", "apps.tenant", "apps.shared_kernel"]
forbidden_modules = [
    "apps.identity",
    "apps.organization",
    "apps.rbac",
    "apps.activity",
    "apps.calendar",
    "apps.workflow",
    "apps.notification",
    "apps.dashboard",
    "apps.reports",
    "apps.ai",
    "apps.voice_ai",
    "apps.integrations",
    "apps.settings",
    "apps.audit",
]

# =============================================================================
# CROSS-CUTTING EXEMPTIONS
# =============================================================================
[[tool.import-linter.contracts]]
name = "All modules may import common utilities"
type = "depend_contract"
modules = ["apps.*"]
dependencies = ["apps.common", "apps.shared_kernel"]

[[tool.import-linter.contracts]]
name = "No module may import the AI Gateway directly (use HTTP or events)"
type = "independence_contract"
modules = ["apps.ai_gateway"]  # If exists as a Django app reference
forbidden_modules = ["apps.*"]
```

### 3.2 CI Enforcement

```yaml
# .github/workflows/lint.yml (excerpt)
- name: Check module dependencies
  run: |
    poetry run lint-imports
  # Fails build if any dependency rule is violated

- name: Check layer rules
  run: |
    poetry run lint-imports --contract layered_architecture
  # Fails build if API skips to domain, or domain imports Django
```

---

## 4. Shared Kernel Exception Rules

### 4.1 What Shared Kernel Contains

```
apps/shared_kernel/
├── domain/
│   ├── base.py           → AggregateRoot, Entity, ValueObject
│   ├── events.py         → DomainEvent base class
│   ├── exceptions.py     → DomainException base class
│   ├── result.py         → Result[T, E], PaginatedResult[T]
│   └── value_objects.py  → Email, PhoneNumber, Address, PersonName, Money, Currency
├── application/
│   └── ports.py          → Repository[T], EventPublisher interfaces
├── infrastructure/
│   ├── models.py         → UUIDModel, TimestampedModel, SoftDeleteModel, TenantScopedModel
│   ├── repository.py     → TenantScopedRepository base
│   └── event_publisher.py→ RabbitMQEventPublisher, InProcessEventPublisher
└── utils/
    ├── serializers.py    → DRF base serializers
    └── validators.py     → Shared validation functions
```

### 4.2 Exception: Referencing Identity User Model

Django requires `settings.AUTH_USER_MODEL` for ForeignKey definitions. All modules that reference `identity_users` use the string reference, not a direct Python import:

```python
# Correct (allowed exception):
from django.conf import settings

class LeadModel(TenantScopedModel):
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,  # String reference to "identity.User"
        on_delete=models.SET_NULL,
        null=True,
    )

# Forbidden:
from apps.identity.infrastructure.models import UserModel

class LeadModel(TenantScopedModel):
    assigned_to = models.ForeignKey(UserModel, ...)  # F4 violation
```

### 4.3 Exception: Domain Layer UUID Reference

Domain entities reference User IDs as `UUID` type, not as `User` objects:

```python
# Correct (allowed exception in domain layer):
@dataclass
class Lead:
    assigned_to: UUID | None  # User ID as UUID, no import of User
```

### 4.4 Exception: Event Handler Payloads

Event handlers process serialized data (dicts), not domain entities:

```python
# Correct (allowed exception):
# workflow/adapters/event_handlers.py
def handle_lead_created(event_data: dict):
    lead_id = event_data["aggregate_id"]
    org_id = event_data["organization_id"]
    # Load via API or repository, not direct import of Lead model
    lead = requests.get(f"http://django/api/v1/leads/{lead_id}",
                        headers={"X-Organization-Id": org_id})
```

### 4.5 Exception: Selector Cross-Module Reads

Selectors may read from other module's tables only via the public API layer or via shared infrastructure views:

```python
# Correct:
# reports/infrastructure/selectors.py
class LeadAnalyticsSelector:
    def get_lead_count_by_source(self, org_id: UUID) -> dict:
        # Uses shared DB connection to query lead_management_leads
        # via a database view or raw SQL (with review)
        ...

# Forbidden:
# reports/infrastructure/selectors.py
from apps.lead_management.infrastructure.models import LeadModel  # F5 violation
```

### 4.6 Exception Summary Table

| Exception | Module | Justification | Review Required |
|-----------|--------|---------------|----------------|
| `settings.AUTH_USER_MODEL` string | All | Django FK requirement | No |
| `UUID` for user IDs | Domain layer | No coupling to User entity | No |
| Event data as dict | All handlers | Loose coupling | No |
| Raw SQL to shared views | Reports, Search | Performance; reviewed by 2 engineers | Yes |
| `get_user_model()` in infrastructure | All | Django requirement | No |
| `override_settings` in tests | All | Test isolation | No |

---

## 5. Module Ownership Matrix

### 5.1 Team Ownership

| Module | Primary Owner | Secondary Owner | Reviewers |
|--------|--------------|----------------|-----------|
| `shared_kernel` | Platform Architecture | All teams | All |
| `identity` | Platform Architecture | Security | Platform + Security |
| `organization` | Platform Architecture | Domain | Platform |
| `rbac` | Platform Architecture | Security | Platform + Security |
| `tenant` | Platform Architecture | Security | Platform + Security |
| `lead_management` | Domain Team | Platform | Domain + Platform |
| `pipeline_management` | Domain Team | Platform | Domain + Platform |
| `activity` | Domain Team | Platform | Domain |
| `calendar` | Domain Team | Integrations | Domain |
| `workflow` | Platform Architecture | Domain | Platform + Domain |
| `notification` | Platform Architecture | Domain | Platform |
| `reports` | Domain Team | Platform | Domain + Platform |
| `dashboard` | Frontend Team | Domain | Frontend + Domain |
| `ai` | AI Team | Platform | AI + Platform |
| `voice_ai` | AI Team | Platform | AI + Platform |
| `integrations` | Integrations Team | Platform | Integrations |
| `settings` | Platform Architecture | All | Platform |
| `audit` | Platform Architecture | Security | Platform + Security |
| `search` | Platform Architecture | Domain | Platform + Domain |

### 5.2 Responsibility per Module Owner

```
Module Owner Responsibilities:
  1. Architecture: Maintain module boundaries, dependency contracts, API surface
  2. Code Quality: Test coverage ≥ 90%, no lint violations, no type errors
  3. Documentation: Keep module blueprint up to date
  4. Events: Define and maintain domain events the module publishes
  5. API: Maintain OpenAPI spec for the module's endpoints
  6. Performance: Monitor and optimize query patterns for the module's tables
  7. Security: Ensure RLS policies, RBAC permissions, and input validation are correct
  8. Review: Review changes to the module from other teams
  9. Migration: Review and approve database migrations for the module
```

---

## 6. API Surface per Module

### 6.1 Public API (External-Facing)

| Module | Base URL | Auth | Rate Limit | Stability |
|--------|----------|------|------------|-----------|
| identity | `/api/v1/auth/` | None (register, login) / JWT | 5/15min (login) | Stable |
| organization | `/api/v1/orgs/` | JWT | 100/min | Stable |
| rbac | `/api/v1/roles/` | JWT + Admin | 100/min | Stable |
| tenant | `/api/v1/admin/tenants/` | JWT + System Admin | 30/min | Internal |
| lead_management | `/api/v1/leads/` | JWT | Tiered | Stable |
| lead_management | `/api/v1/contacts/` | JWT | Tiered | Stable |
| lead_management | `/api/v1/accounts/` | JWT | Tiered | Stable |
| pipeline_management | `/api/v1/pipelines/` | JWT | Tiered | Stable |
| pipeline_management | `/api/v1/opportunities/` | JWT | Tiered | Stable |
| activity | `/api/v1/activities/` | JWT | Tiered | Stable |
| activity | `/api/v1/tasks/` | JWT | Tiered | Stable |
| calendar | `/api/v1/calendar/` | JWT | 60/min | Beta |
| workflow | `/api/v1/workflows/` | JWT + Admin | 30/min | Beta |
| notification | `/api/v1/notifications/` | JWT | 60/min | Stable |
| dashboard | `/api/v1/dashboards/` | JWT | 30/min | Beta |
| reports | `/api/v1/reports/` | JWT | 10/min (sync) | Beta |
| ai | `/api/v1/ai/` | JWT | 20/min | Beta |
| voice_ai | `/api/v1/calls/` | JWT | 30/min | Alpha |
| integrations | `/api/v1/integrations/` | JWT + Admin | 30/min | Alpha |
| integrations | `/api/v1/public/webhook/` | Signature | 100/min | Stable |
| settings | `/api/v1/settings/` | JWT + Admin | 30/min | Stable |
| audit | `/api/v1/audit/` | JWT + Admin | 30/min | Beta |
| search | `/api/v1/search/` | JWT | 60/min | Beta |

### 6.2 Internal API (Module-to-Module)

Modules communicate via internal HTTP when synchronous reads are required. Internal endpoints are prefixed with `/internal/` and are not exposed externally.

| Endpoint | Provider | Consumer | Purpose |
|----------|----------|----------|---------|
| `GET /internal/users/{id}` | identity | All | Get user basic info by ID |
| `GET /internal/orgs/{id}` | organization | All | Get org settings, tier, features |
| `GET /internal/roles/{user_id}/permissions` | rbac | All | Get effective permissions for user |
| `GET /internal/leads/search` | lead_management | workflow, ai | Search leads for workflow conditions |
| `GET /internal/pipelines/{id}/stages` | pipeline | workflow | Get stage list for condition eval |

### 6.3 Internal vs External Marking

```python
# api/urls.py — Public API
router = DefaultRouter()
router.register("leads", LeadViewSet, basename="lead")

# api/internal_urls.py — Internal API (not in public schema)
internal_router = DefaultRouter()
internal_router.register("leads", InternalLeadViewSet, basename="internal-lead")

# config/urls.py
urlpatterns = [
    path("api/v1/", include(public_router.urls)),
    path("internal/", include(internal_router.urls)),  # Not in OpenAPI spec
]
```

---

## 7. Event Subscription Map

### 7.1 Publisher → Event → Subscriber

```
PUBLISHER              EVENT                           SUBSCRIBERS                                       QUEUE
──────────             ─────                           ───────────                                       ─────
identity               UserRegistered                  organization (create membership placeholder)       default
                                                       notification (send welcome email)                 notification
identity               EmailVerified                   Identity (activate user)                         default
identity               UserLoggedIn                    audit (log login event)                           audit
                                                       security (detect anomalous login)                default
identity               PasswordChanged                 notification (send confirmation)                  notification
                                                       audit                                            audit
identity               AccountLocked                   notification (send alert)                         notification
                                                       audit                                            audit

organization           OrganizationProvisioned         tenant (create tenant record, apply RLS)          default
organization           OrganizationSuspended           tenant (suspend tenant)                           default
                                                       notification (notify admin)                       notification
organization           OrganizationTierChanged         billing (update limits)                           default
                                                       workflow (enable/disable features)                workflow

lead_management        LeadCreated                     workflow (evaluate workflows)                     workflow
                                                       notification (notify assignee)                    notification
                                                       ai (generate embedding, score)                    default
                                                       search (index for search)                         default
                                                       integrations (sync to external)                   integrations
lead_management        LeadUpdated                     workflow (evaluate workflows)                     workflow
                                                       ai (re-embed, rescore)                           default
                                                       search (reindex)                                  default
lead_management        LeadConverted                   pipeline (create opportunity)                     default
                                                       activity (log conversion activity)               default
                                                       workflow (evaluate post-conversion workflows)    workflow
                                                       notification (notify owner)                       notification
lead_management        LeadAssigned                    notification (notify new owner)                   notification
                                                       activity (log assignment activity)                default
lead_management        ContactCreated                  workflow (evaluate workflows)                     workflow
                                                       search (index)                                    default
lead_management        ContactUpdated                  search (reindex)                                  default
lead_management        AccountCreated                  workflow (evaluate workflows)                     workflow
lead_management        LeadScored                      AI (update scoring model)                         default

pipeline_management    OpportunityCreated              workflow (evaluate workflows)                     workflow
                                                       notification (notify team)                        notification
                                                       reports (update forecast)                         reports
pipeline_management    OpportunityStageChanged         workflow (evaluate stage-change workflows)        workflow
                                                       notification (notify on specific stages)          notification
                                                       reports (update forecast)                         reports
                                                       ai (update next-best-action)                     default
pipeline_management    OpportunityWon                  workflow (evaluate post-win workflows)            workflow
                                                       notification (celebrate!)                         notification
                                                       reports (update win metrics)                      reports
                                                       activity (log win activity)                       default
pipeline_management    OpportunityLost                 workflow (evaluate post-loss workflows)           workflow
                                                       reports (update loss metrics)                     reports
                                                       ai (update learning model)                        default

activity               TaskCreated                     workflow (evaluate workflows)                     workflow
                                                       notification (notify assignee)                    notification
activity               TaskCompleted                  workflow (evaluate workflows)                     workflow
                                                       notification (notify creator)                     notification
activity               TaskOverdue                     notification (remind assignee)                    notification
activity               ActivityLogged                  workflow (evaluate post-activity workflows)       workflow
                                                       reports (update activity metrics)                 reports

workflow               WorkflowTriggered               audit (log execution)                             audit
workflow               WorkflowCompleted               notification (notify workflow creator)            notification
workflow               WorkflowFailed                  notification (alert admin)                        notification
                                                       audit (log failure)                               audit

notification           NotificationSent                audit (log delivery)                              audit

reports                ReportGenerated                 notification (notify report owner)                notification
reports                ReportScheduled                 notification (deliver report)                     notification

integrations           IntegrationSynced               audit (log sync)                                  audit
integrations           WebhookDelivered                audit (log delivery)                              audit
integrations           WebhookFailed                   notification (alert admin)                        notification

voice_ai               VoiceCallCompleted              activity (log call activity)                      default
                                                       ai (analyze transcript, sentiment)               default
                                                       notification (notify participants)               notification
```

### 7.2 Queue Binding Summary

```
Queue: workflow
  Bindings:  *.lead.*, *.contact.*, *.opportunity.*, *.task.*,
             *.activity.*, *.workflow.*
  Workers:   4-8
  Priority:  High

Queue: notification
  Bindings: *.created, *.assigned, *.won, *.completed, *.failed,
            *.overdue
  Workers:   2-4
  Priority:  High

Queue: reports
  Bindings: reports.*
  Workers:   1-4
  Priority:  Low

Queue: integrations
  Bindings: integrations.*, *.webhook.*
  Workers:   2-4
  Priority:  Medium

Queue: audit
  Bindings: # (all events — fanout)
  Workers:   1-2
  Priority:  Low

Queue: default
  Bindings: everything not matched above
  Workers:   2-4
  Priority:  Low
```

---

## 8. Governance

### 8.1 How to Add a New Module

```
Step 1: Create Module Blueprint
  File: docs/ModuleBlueprints/{ModuleName}.md
  Contents:
    - Business purpose and scope
    - Bounded context analysis (ubiquitous language)
    - Aggregates, entities, value objects
    - Domain events
    - Commands and queries
    - API endpoints
    - Database schema
    - State machines
    - Dependencies
    - Security considerations

Step 2: Open Architecture Decision Record
  File: docs/ArchitectureDecisionRecords/{ADR-NNN}-{title}.md
  Decision:
    - Why this module exists
    - Why it's in the monolith (not a service)
    - Why it depends on these modules
    - What alternatives were considered

Step 3: Create Module Scaffold
  Run: python manage.py startapp {module_name} apps/{module_name}
  Add: Standard directory structure (domain/, application/, etc.)

Step 4: Register in import-linter
  Add: Dependency contract for the new module in pyproject.toml
  Add: Update forbidden_modules lists for existing modules

Step 5: Register in config
  Add: apps/{module_name} to INSTALLED_APPS
  Add: Module URL patterns to config/urls.py

Step 6: Update Documentation
  - This document: dependency graph, API surface, ownership, event map
  - 12_HighLevelDesign.md: bounded context map
  - 15_ProjectStructure.md: directory tree

Step 7: Create Base Migrations
  Run: python manage.py makemigrations {module_name}
  Review: Migration for correctness, RLS policies

Step 8: Add Permissions
  - rbac module: add default permissions for new entities
  - Default role templates: update if needed

Step 9: Define Domain Events
  - Register events in the event catalog
  - Add queue bindings in RabbitMQ
  - Document subscribers

Step 10: CI Validation
  - Update CI to run import-linter with new contracts
  - Add module tests to CI pipeline
```

### 8.2 How to Add a New Dependency

```
If Module A needs a dependency on Module B (not currently allowed):

Step 1: Justify the Dependency
  Document:
    - What functionality from B does A need?
    - Why can't this be done via events?
    - Why can't this be done via shared kernel?
    - What is the cost of adding this dependency?

Step 2: Check Dependency Direction
  Is A downstream of B in the allowed graph?
    YES → Add dependency (go to Step 4)
    NO  → This would create a reverse dependency (forbidden)

Step 3: Resolve Reverse Dependency
  Options (in order of preference):
    1. Move shared logic to shared_kernel
    2. Use domain events instead of direct import
    3. Add an abstraction in B that A implements
    4. Restructure module boundaries
  Only if none of the above work:
    5. Add the dependency with justification (requires ADR)

Step 4: Update import-linter
  - Add B to A's allowed dependencies
  - Update forbidden_modules lists

Step 5: Update Documentation
  - This document: dependency graph, dependency table
  - Module blueprint: dependencies section

Step 6: Code Review
  - Two reviewers required
  - One must be the owner of Module B
```

### 8.3 Dependency Review Checklist

```
□ Does the dependency create a cycle?
□ Is there a shared_kernel alternative?
□ Can this be done via events instead?
□ Is the dependency in the allowed direction?
□ Has the import-linter config been updated?
□ Has the module blueprint been updated?
□ Has the dependency graph been updated?
□ Are the owners of both modules aware and in agreement?
□ Has an ADR been created (for non-trivial dependencies)?
```

### 8.4 Breaking Changes Policy

```
Breaking Change Types:
  1. Removing or renaming a public API endpoint
  2. Removing or renaming a domain event
  3. Changing event payload schema
  4. Removing or renaming a published interface/port
  5. Changing database schema without backward-compatible migration

Process for Breaking Changes:
  1. Announce on #engineering channel, 2 weeks minimum notice
  2. Deprecate old version with warning header or log message
  3. Keep old version operational for 1 release cycle
  4. Remove old version in next major release
  5. Update all subscribers before removal
  6. Document in CHANGELOG.md

Event Schema Changes:
  - Additive changes (new optional fields): backward-compatible
  - Removals or renames: new event version ({event_name}_v2)
  - Old version published for 1 release cycle alongside new
```

---

> **Version:** 0.1.0-draft | **Last Updated:** 2026-07-27
> **Cross-reference:** [10_ArchitectureOverview.md](./10_ArchitectureOverview.md),
> [12_HighLevelDesign.md](./12_HighLevelDesign.md),
> [13_LowLevelDesign.md](./13_LowLevelDesign.md),
> [15_ProjectStructure.md](./15_ProjectStructure.md)
