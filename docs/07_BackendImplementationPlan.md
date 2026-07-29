# TZAHU CRM — Backend Implementation Plan

> **Version:** 0.1.0
> **Last Updated:** 2026-07-27
> **Status:** Foundational Design Phase
> **Owner:** Platform Architecture Team

---

## Table of Contents

1. [Backend Architecture Overview](#1-backend-architecture-overview)
2. [Module Implementation Sequence](#2-module-implementation-sequence)
3. [Shared Kernel](#3-shared-kernel)
4. [Identity Module](#4-identity-module)
5. [Organization Module](#5-organization-module)
6. [RBAC Module](#6-rbac-module)
7. [Tenant Module](#7-tenant-module)
8. [Lead Management Module](#8-lead-management-module)
9. [Contact Management Module](#9-contact-management-module)
10. [Account Management Module](#10-account-management-module)
11. [Pipeline Management Module](#11-pipeline-management-module)
12. [Opportunity Module](#12-opportunity-module)
13. [Activity Module](#13-activity-module)
14. [Task Module](#14-task-module)
15. [Calendar Module](#15-calendar-module)
16. [Workflow Module](#16-workflow-module)
17. [Notification Module](#17-notification-module)
18. [Reports & Dashboard Module](#18-reports--dashboard-module)
19. [Search Module](#19-search-module)
20. [Audit Module](#20-audit-module)
21. [AI Module](#21-ai-module)
22. [Voice AI Module](#22-voice-ai-module)
23. [Integration Module](#23-integration-module)
24. [Settings Module](#24-settings-module)
25. [Dependency Graph Between Modules](#25-dependency-graph-between-modules)
26. [Shared Kernel Implementation Sequence](#26-shared-kernel-implementation-sequence)

---

## 1. Backend Architecture Overview

### 1.1 Module Directory Pattern

Every module follows this exact directory structure:

```
apps/{module_name}/
├── domain/
│   ├── entities.py          # Domain entities and aggregates
│   ├── value_objects.py     # Immutable value objects
│   ├── events.py            # Domain events
│   ├── exceptions.py        # Domain exceptions
│   └── specifications.py    # Specification pattern implementations
├── application/
│   ├── commands.py          # Command definitions (dataclasses)
│   ├── queries.py           # Query definitions
│   ├── services.py          # Application service classes
│   └── interfaces.py        # Port interfaces (repository, publisher, etc.)
├── infrastructure/
│   ├── models.py            # Django ORM models
│   ├── migrations/          # Django migrations
│   ├── repositories.py      # Repository implementations
│   ├── selectors.py         # Complex read models (DTOs)
│   ├── admin.py             # Django admin config
│   └── tasks.py             # Celery task definitions
├── api/
│   ├── views.py             # DRF ViewSets
│   ├── serializers.py       # DRF serializers
│   ├── permissions.py       # DRF permission classes
│   ├── filters.py           # DRF filter backends
│   └── urls.py              # URL routing
├── adapters/
│   ├── event_handlers.py    # Domain event subscribers
│   └── integrations.py      # External service adapters
└── tests/
    ├── test_domain.py
    ├── test_application.py
    └── test_api.py
```

### 1.2 Layer Dependency Rules

```
api/ ──────────────────► application/ ────────────────► domain/
  │                            │                            │
  │   ┌────────────────────────┘                            │
  │   ▼                                                     │
  └──► infrastructure/                                      │
        │                                                   │
        └───────────────────────────────────────────────────┘
                           │
                           ▼
                    shared_kernel/
```

- `domain/` imports only from `shared_kernel` and Python stdlib
- `application/` imports from `domain/`, `shared_kernel`, and abstract interfaces
- `infrastructure/` imports from `domain/`, `application/`, `shared_kernel`, and Django
- `api/` imports from `application/`, `infrastructure/`, `shared_kernel`
- No layer imports another module's internals
- Cross-module: subscribe via `adapters/event_handlers.py`

### 1.3 Package Conventions

```
backend/apps/{module_name}/
backend/config/settings/base.py
backend/config/settings/dev.py
backend/config/settings/staging.py
backend/config/settings/prod.py
backend/config/urls/v1.py          # API v1 URL configuration
backend/config/celery.py           # Celery app configuration
backend/infrastructure/             # Cross-cutting infrastructure
  event_bus.py                      # RabbitMQ event publisher
  cache.py                          # Redis cache abstraction
  rate_limiter.py                   # Rate limiting
  circuit_breaker.py                # Circuit breaker pattern
```

---

## 2. Module Implementation Sequence

### Implementation Order

```
Order 1:  shared_kernel (Phase 1) — Prerequisite for everything
Order 2:  identity (Phase 1) — No module deps
Order 3:  organization (Phase 1) — Depends on identity
Order 4:  rbac (Phase 1) — Depends on identity, organization
Order 5:  tenant (Phase 2) — Depends on identity, organization, rbac
Order 6:  audit (Phase 2+) — Consumes events, no domain deps
Order 7:  search (Phase 3) — Consumes events from entity modules
Order 8:  lead (Phase 3) — Depends on tenant, organization
Order 9:  contact (Phase 3) — Depends on lead, tenant
Order 10: account (Phase 3) — Depends on lead, contact, tenant
Order 11: pipeline (Phase 4) — Depends on lead, contact, account
Order 12: opportunity (Phase 4) — Depends on pipeline, contact, lead
Order 13: activity (Phase 4) — Depends on opportunity, lead, contact
Order 14: task (Phase 4) — Depends on activity
Order 15: calendar (Phase 4) — Depends on activity, task
Order 16: workflow (Phase 5) — Depends on entities, events
Order 17: notification (Phase 6) — Depends on workflow, identity
Order 18: reports (Phase 7) — Depends on analytics data (read-only)
Order 19: dashboard (Phase 7) — Depends on reports
Order 20: ai (Phase 8) — Depends on reports, workflow, search
Order 21: voice_ai (Phase 9) — Depends on ai
Order 22: integrations (Phase 10) — Depends on identity, lead, opportunity, activity
Order 23: settings (Phase 3+) — Depends on identity, organization, tenant
Order 24: sso (Phase 11) — Depends on identity
Order 25: advanced_rbac (Phase 11) — Depends on rbac
```

### Estimated Effort Summary

| Module | Domain | App | Infra | API | Tests | Total (person-days) |
|--------|--------|-----|-------|-----|-------|---------------------|
| shared_kernel | 5 | — | 3 | — | 3 | 11 |
| identity | 3 | 4 | 3 | 3 | 4 | 17 |
| organization | 2 | 2 | 2 | 2 | 3 | 11 |
| rbac | 3 | 2 | 2 | 2 | 3 | 12 |
| tenant | 3 | 3 | 5 | 2 | 5 | 18 |
| lead | 4 | 3 | 3 | 3 | 5 | 18 |
| contact | 3 | 3 | 3 | 3 | 4 | 16 |
| account | 3 | 2 | 2 | 2 | 3 | 12 |
| pipeline | 3 | 2 | 2 | 2 | 3 | 12 |
| opportunity | 4 | 3 | 3 | 3 | 4 | 17 |
| activity | 3 | 3 | 3 | 3 | 4 | 16 |
| task | 2 | 2 | 2 | 2 | 3 | 11 |
| calendar | 2 | 3 | 3 | 2 | 4 | 14 |
| workflow | 8 | 6 | 5 | 3 | 8 | 30 |
| notification | 3 | 4 | 5 | 3 | 4 | 19 |
| reports | 4 | 5 | 4 | 3 | 5 | 21 |
| dashboard | 3 | 3 | 2 | 2 | 3 | 13 |
| search | 2 | 2 | 3 | 2 | 3 | 12 |
| audit | 2 | 2 | 3 | 1 | 3 | 11 |
| ai | 5 | 5 | 5 | 4 | 5 | 24 |
| voice_ai | 4 | 4 | 4 | 3 | 4 | 19 |
| integrations | 5 | 5 | 5 | 3 | 5 | 23 |
| settings | 2 | 1 | 1 | 1 | 2 | 7 |
| sso | 3 | 3 | 2 | 2 | 4 | 14 |
| **Total** | | | | | | **~390** |

---

## 3. Shared Kernel

**Business Purpose:** Provide foundational primitives shared by all modules. Zero business logic, zero Django imports.

**Bounded Context:** Cross-cutting. No business rules — pure structure.

### Domain

**Base Classes:**
- `ValueObject` — Immutable, equality by value, provides `__eq__`, `__hash__`, `__repr__`
- `Entity` — Mutable, identity-based equality
- `AggregateRoot(Entity)` — Entity with event collection, consistency boundary
- `DomainEvent` — `event_id` (UUID7), `occurred_at`, `organization_id`

**Value Objects:**
| VO | Fields | Validation |
|----|--------|------------|
| `Email` | address: str | Regex validation, normalization to lowercase |
| `PhoneNumber` | number: str, country_code: str | E.164 format, country code required |
| `Address` | line1, line2, city, state, postal_code, country | Country ISO 3166-1 alpha-2 |
| `PersonName` | first_name: str, last_name: str | Non-empty, sanitized |
| `Money` | amount: Decimal, currency: Currency | Amount >= 0, currency ISO 4217 |
| `Currency` | code: str | ISO 4217, 3 uppercase letters |
| `Percentage` | value: Decimal | 0 <= value <= 100 |
| `TimeZone` | name: str | Valid IANA timezone |
| `URL` | url: str | Valid URL format |
| `Slug` | value: str | 3-63 chars, lowercase + hyphens |
| `Color` | hex: str | Valid hex color (#RRGGBB) |

**Result Types:**
```python
Result[T, E]          # Success(value) | Failure(error)
PaginatedResult[T]    # items, total_count, page, page_size, has_next, has_previous
DomainError           # Base for all domain errors
  NotFoundError       # Entity not found
  ValidationError     # Business rule violation
  PermissionDenied    # Access denied
  ConflictError       # Duplicate/conflict
```

### Application

- `Repository[T]` — Generic interface: `get_by_id`, `save`, `delete`, `list`, `count`
- `EventPublisher` — Interface: `publish(event: DomainEvent)`
- `UnitOfWork` — Interface: `begin()`, `commit()`, `rollback()`

### Infrastructure

| Model | Purpose |
|-------|---------|
| `UUIDModel` | UUID v7 primary key |
| `TimestampedModel` | created_at, updated_at |
| `SoftDeleteModel` | deleted_at, active filter manager |
| `TenantScopedModel` | organization_id FK, RLS marker |

**Base Repository:**
```python
class BaseRepository(Repository[T]):
    def __init__(self, model_class: type[Model]):
        self.model_class = model_class
    def get_by_id(self, id: UUID) -> T | None:
        return self.model_class.objects.filter(id=id).first()
    def save(self, entity: T) -> T:
        # Map entity to ORM, save, return entity with updated ID
```

### Testing

- Unit tests: equality, hashing, immutability for every Value Object
- Unit tests: Result chaining, error propagation
- Unit tests: DomainEvent collection, timestamps
- Migration tests: table creation, indexes, constraints

### Implementation Order

1. ValueObject base class and all VOs
2. Entity, AggregateRoot, DomainEvent base classes
3. Result types and DomainError hierarchy
4. Repository port interface
5. Base ORM models (UUIDModel, TimestampedModel, etc.)
6. Base repository implementation

---

## 4. Identity Module

**Business Purpose:** User authentication, registration, JWT management, password policies, session tracking.

**Bounded Context:** Authentication & Identity. User is a global entity (not tenant-scoped).

### Aggregates & Entities

**Aggregate: User**
```
User {
    id: UUID (PK)
    email: Email (VO, unique)
    display_name: PersonName (VO)
    status: UserStatus (PENDING_VERIFICATION | ACTIVE | LOCKED | DISABLED)
    email_verified_at: datetime | None
    last_login_at: datetime | None
    password_changed_at: datetime
    failed_login_attempts: int
    timezone: str
    locale: str
    created_at: datetime
    updated_at: datetime
}
```
- Behaviors: `register()`, `verify_email()`, `login()`, `change_password()`, `lock()`, `disable()`

**Entity: Session**
```
Session {
    id: UUID (PK)
    user_id: UUID (FK -> User)
    refresh_token_hash: str
    device_info: DeviceInfo (VO)
    ip_address: str
    last_used_at: datetime
    expires_at: datetime
    revoked_at: datetime | None
}
```
- Behaviors: `rotate_refresh_token()`, `revoke()`, `is_expired()`

### Value Objects

| VO | Fields | Validation |
|----|--------|------------|
| `UserStatus` | enum | Defined transitions only |
| `PasswordPolicy` | min_length, require_uppercase, require_lowercase, require_digit, require_special, history_count, max_age_days | Global config |
| `DeviceInfo` | name, type, os, browser, os_version, browser_version | Sanitized |
| `AuthTokens` | access_token, refresh_token, expires_in, token_type | Generated by service |

### Commands

| Command | Input | Output |
|---------|-------|--------|
| `RegisterUserCommand` | email, password, first_name, last_name, timezone | User |
| `VerifyEmailCommand` | user_id, token | None |
| `LoginCommand` | email, password, device_info, ip_address | AuthTokens |
| `RefreshTokenCommand` | refresh_token | AuthTokens |
| `ChangePasswordCommand` | user_id, old_password, new_password | None |
| `InitiatePasswordResetCommand` | email | None |
| `CompletePasswordResetCommand` | token, new_password | None |
| `LogoutCommand` | user_id, session_id | None |
| `LockUserCommand` | user_id, reason | None |
| `DisableUserCommand` | user_id, reason | None |

### Queries

| Query | Returns |
|-------|---------|
| `GetUserByIdQuery` | User |
| `GetUserByEmailQuery` | User |
| `GetUserPermissionsQuery` | set[Permission] |
| `GetActiveSessionsQuery` | list[Session] |
| `ListUsersByOrganizationQuery` | PaginatedResult[User] |

### Domain Services

| Service | Purpose |
|---------|---------|
| `PasswordHasher` | Hash and verify passwords (bcrypt, cost 12) |
| `TokenService` | Generate and verify JWT access/refresh tokens (RS256) |
| `EmailVerificationService` | Generate, send, and verify email tokens |

### Domain Events

| Event | Payload | Subscribers |
|-------|---------|-------------|
| `UserRegistered` | user_id, email, registered_at | Organization, Notification |
| `EmailVerified` | user_id, email, verified_at | Identity |
| `UserLoggedIn` | user_id, login_method, ip_address | Audit, Security |
| `PasswordChanged` | user_id, changed_at | Notification, Audit |
| `AccountLocked` | user_id, reason, locked_at | Notification, Audit |
| `AccountDisabled` | user_id, reason, disabled_at | Notification, Audit |

### Infrastructure

**Models:**
```python
class UserModel(TimestampedModel):  # NOT TenantScoped — global identity
    email = models.EmailField(unique=True)
    password_hash = models.CharField(max_length=256)
    # ... other fields
class SessionModel(models.Model):
    user = models.ForeignKey(UserModel, on_delete=models.CASCADE)
    refresh_token_hash = models.CharField(max_length=256)
    # ...
class PasswordHistoryModel(models.Model):
    user = models.ForeignKey(UserModel, on_delete=models.CASCADE)
    password_hash = models.CharField(max_length=256)
class EmailVerificationTokenModel(models.Model):
    user = models.ForeignKey(UserModel, on_delete=models.CASCADE)
    token_hash = models.CharField(max_length=256)
    expires_at = models.DateTimeField()
class PasswordResetTokenModel(models.Model):
    user = models.ForeignKey(UserModel, on_delete=models.CASCADE)
    token_hash = models.CharField(max_length=256)
    expires_at = models.DateTimeField()
```

**Repositories:**
- `UserRepository` (implements Repository[User])
- `SessionRepository` (implements Repository[Session])

**Celery Tasks:**
- `cleanup_expired_sessions` (daily)
- `cleanup_expired_tokens` (daily)
- `send_verification_email` (on UserRegistered event)
- `send_password_reset_email` (on InitiatePasswordReset)

### Permissions

| Permission | Description |
|------------|-------------|
| `user.create` | Create new users |
| `user.read` | View user profiles |
| `user.update` | Update user profiles |
| `user.delete` | Disable/delete users |
| `user.invite` | Invite users to organization |
| `user.impersonate` | Impersonate users (admin only) |

### REST Endpoints

| Method | URL | Permission | Notes |
|--------|-----|------------|-------|
| POST | /auth/register | Public | Rate limited: 5/min per IP |
| POST | /auth/verify-email | Public | |
| POST | /auth/login | Public | Rate limited: 5/15min per IP |
| POST | /auth/refresh | Refresh Token | |
| POST | /auth/logout | Authenticated | |
| POST | /auth/forgot-password | Public | Always returns 200 |
| POST | /auth/reset-password | Public | |
| GET | /auth/me | Authenticated | |
| PATCH | /auth/me | Authenticated | |
| PATCH | /auth/me/password | Authenticated | |
| GET | /auth/sessions | Authenticated | |
| DELETE | /auth/sessions/{id} | Authenticated | |
| DELETE | /auth/sessions | Authenticated | Revoke all except current |
| GET | /users/ | user.read | List org users |
| GET | /users/{id} | user.read | |
| PATCH | /users/{id} | user.update | |
| DELETE | /users/{id} | user.delete | |

### Caching Strategy

| Key Pattern | TTL | Invalidation |
|-------------|-----|--------------|
| `v1:user:{id}` | 5 min | On user update |
| `v1:user:{id}:permissions` | 15 min | On role assignment change |
| `v1:user:{email}` | 5 min | On email change |

### RLS

Identity tables are NOT tenant-scoped (users are global). No RLS on identity tables.

### Testing Requirements

- Unit: User registration, login, password change, status transitions
- Unit: Session refresh rotation, expiry
- Integration: Full auth flow (register -> verify -> login -> refresh -> logout)
- Integration: Rate limiting on auth endpoints
- Security: Token expiry, refresh rotation theft protection
- Security: Password policy enforcement

---

## 5. Organization Module

**Business Purpose:** Organization (tenant) profiles, member management, subscription tier, settings.

**Bounded Context:** Organization Management. Tenant-scoped.

### Aggregates & Entities

**Aggregate: Organization**
```
Organization {
    id: UUID (PK)
    name: str
    slug: Slug (VO, unique)
    status: OrganizationStatus (TRIAL | ACTIVE | SUSPENDED | DISABLED)
    tier: SubscriptionTier (FREE | GROWTH | ENTERPRISE)
    features: set[str]
    settings: OrganizationSettings (VO)
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None
}
```

**Aggregate: Membership**
```
Membership {
    id: UUID (PK)
    user_id: UUID (FK)
    organization_id: UUID (FK)
    status: MembershipStatus (INVITED | ACTIVE | DISABLED)
    invited_by: UUID
    invitation_accepted_at: datetime | None
    joined_at: datetime | None
}
```

### Value Objects

| VO | Fields | Validation |
|----|--------|------------|
| `OrganizationSettings` | default_timezone, date_format, number_format, currency, fiscal_year_start, logo_url | Valid IANA, ISO, locale |
| `OrganizationSlug` | value: str | 3-63 chars, unique, alphanumeric + hyphens |
| `SubscriptionTier` | name, max_users, max_storage_gb, features, rate_limit_rpm | Enum |

### Commands

| Command | Input | Output |
|---------|-------|--------|
| `CreateOrganizationCommand` | name, slug, tier, owner_user_id | Organization |
| `UpdateOrganizationCommand` | org_id, name, settings | Organization |
| `SuspendOrganizationCommand` | org_id, reason | None |
| `ReactivateOrganizationCommand` | org_id | None |
| `DisableOrganizationCommand` | org_id, reason | None |
| `InviteMemberCommand` | org_id, user_email, invited_by | Membership |
| `AcceptInvitationCommand` | membership_id | None |
| `RejectInvitationCommand` | membership_id | None |
| `RemoveMemberCommand` | org_id, user_id | None |

### Domain Events

| Event | Subscribers |
|-------|-------------|
| `OrganizationCreated` | Tenant (provision tenant), Audit |
| `OrganizationUpdated` | Audit |
| `OrganizationSuspended` | Tenant, Notification |
| `OrganizationReactivated` | Tenant, Notification |
| `OrganizationDisabled` | Tenant, Notification |
| `UserInvited` | Notification (send email) |
| `MembershipActivated` | RBAC (assign default role), Notification |
| `MembershipDisabled` | RBAC (remove role assignments) |

### REST Endpoints

| Method | URL | Permission |
|--------|-----|------------|
| POST | /orgs/ | Authenticated |
| GET | /orgs/ | Authenticated |
| GET | /orgs/{id} | organization.read |
| PATCH | /orgs/{id} | organization.update |
| DELETE | /orgs/{id} | organization.delete |
| GET | /orgs/{id}/settings | settings.read |
| PUT | /orgs/{id}/settings | settings.update |
| GET | /orgs/{id}/members | user.read |
| POST | /orgs/{id}/members/invite | user.invite |
| POST | /orgs/{id}/members/accept | Authenticated |
| DELETE | /orgs/{id}/members/{user_id} | user.delete |

---

## 6. RBAC Module

**Business Purpose:** Role definitions, permission assignment, permission resolution.

**Bounded Context:** Authorization. Tenant-scoped.

### Aggregates & Entities

**Aggregate: Role**
```
Role {
    id: UUID (PK)
    organization_id: UUID (FK)
    name: str
    description: str
    permissions: set[Permission]
    is_system_role: bool
    is_assignable: bool
    created_at: datetime
}
```

**Aggregate: RoleAssignment**
```
RoleAssignment {
    id: UUID (PK)
    user_id: UUID (FK)
    organization_id: UUID (FK)
    role_id: UUID (FK)
    assigned_by: UUID
    assigned_at: datetime
}
```

### Value Objects

| VO | Fields |
|----|--------|
| `Permission` | entity: str, action: str (e.g., "lead.create") |
| `PermissionSet` | set[Permission] with union/intersection operations |

### Commands

| Command | Input | Output |
|---------|-------|--------|
| `CreateRoleCommand` | org_id, name, permissions | Role |
| `UpdateRoleCommand` | role_id, name, permissions | Role |
| `DeleteRoleCommand` | role_id | None |
| `AssignRoleCommand` | user_id, org_id, role_id, assigned_by | RoleAssignment |
| `UnassignRoleCommand` | user_id, org_id, role_id | None |
| `SeedDefaultRolesCommand` | org_id | None |

### Domain Events

| Event | Subscribers |
|-------|-------------|
| `RoleCreated` | Audit |
| `RoleUpdated` | Audit |
| `RoleDeleted` | Audit, Notification (if role in use) |
| `RoleAssigned` | Audit, Cache (invalidate perm cache) |
| `RoleUnassigned` | Audit, Cache (invalidate perm cache) |

### REST Endpoints

| Method | URL | Permission |
|--------|-----|------------|
| GET | /roles/ | role.read |
| POST | /roles/ | role.create |
| GET | /roles/{id} | role.read |
| PATCH | /roles/{id} | role.update |
| DELETE | /roles/{id} | role.delete |
| GET | /roles/{id}/assignments | role.read |
| POST | /roles/{id}/assignments | role.assign |
| DELETE | /roles/{id}/assignments/{user_id} | role.unassign |
| GET | /permissions/ | role.read |
| GET | /users/{id}/permissions | role.read |

### Caching Strategy

| Key Pattern | TTL | Invalidation |
|-------------|-----|--------------|
| `v1:{org_id}:user:{user_id}:permissions` | 15 min | On RoleAssigned/Unassigned |
| `v1:{org_id}:role:{role_id}` | 30 min | On RoleUpdated |
| `v1:{org_id}:roles` | 30 min | On RoleCreated/Deleted |

---

## 7. Tenant Module

**Business Purpose:** Infrastructure-level enforcement of multi-tenant isolation. Manages RLS, tenant lifecycle, Pool/Silo model.

**Bounded Context:** Infrastructure. System admin only.

### Aggregates

**Aggregate: Tenant**
```
Tenant {
    id: UUID (PK)
    organization_id: UUID (FK, unique)
    status: TenantStatus (ACTIVE | SUSPENDED | DISABLED | DELETED)
    isolation_model: IsolationModel (POOL | SILO)
    silo_config: SiloConfig | None
    rls_policies_applied: bool
    provisioned_at: datetime
    suspended_at: datetime | None
    deleted_at: datetime | None
    retention_until: datetime | None
}
```

### Domain Services

| Service | Purpose |
|---------|---------|
| `RLSPolicyManager` | Generate and apply RLS policies for all TenantScopedModel tables |
| `TenantProvisioningService` | Provision tenant, apply RLS, configure isolation |
| `TenantLifecycleService` | Suspend, reactivate, delete tenants |
| `SiloMigrationService` | Migrate tenant from Pool to dedicated database |

### Celery Tasks

- `apply_rls_policies_for_new_table(table_name)` — On migration post-migrate signal
- `verify_rls_policies` — Hourly check that all tenant-scoped tables have RLS
- `schedule_tenant_deletion` — Delete soft-deleted tenants after retention period
- `migrate_tenant_to_silo(tenant_id)` — Async Pool -> Silo migration

### REST Endpoints

| Method | URL | Permission |
|--------|-----|------------|
| GET | /admin/tenants/ | tenant.read (system admin) |
| GET | /admin/tenants/{id} | tenant.read |
| POST | /admin/tenants/{id}/suspend | tenant.suspend |
| POST | /admin/tenants/{id}/reactivate | tenant.update |
| POST | /admin/tenants/{id}/delete | tenant.delete |
| POST | /admin/tenants/{id}/migrate-to-silo | tenant.update |
| POST | /admin/tenants/{id}/reapply-rls | tenant.update |

### RLS

Tenant table itself is NOT tenant-scoped (it's the reference table for all tenant isolation). All other tenant-scoped tables have RLS applied.

---

## 8. Lead Management Module

**Business Purpose:** Lead capture, qualification, scoring, conversion, and management.

**Bounded Context:** Lead Management. Tenant-scoped.

### Aggregates

**Aggregate: Lead**
```
Lead {
    id: UUID (PK)
    organization_id: UUID (FK)
    first_name: str
    last_name: str
    email: Email (VO)
    phone: PhoneNumber (VO) | None
    company: str | None
    title: str | None
    source: LeadSource (enum)
    status: LeadStatus (NEW | CONTACTED | QUALIFIED | CONVERTED | DISQUALIFIED | RECYCLED)
    score: int (0-100)
    owner_id: UUID | None
    converted_contact_id: UUID | None
    converted_account_id: UUID | None
    converted_opportunity_id: UUID | None
    notes: str | None
    tags: list[str]
    custom_fields: dict
    created_at, updated_at, created_by, updated_by, deleted_at
}
```

### Value Objects

| VO | Fields |
|----|--------|
| `LeadSource` | enum: WEBSITE, REFERRAL, COLD_CALL, EMAIL, EVENT, PARTNER, OTHER |
| `LeadStatus` | enum: NEW, CONTACTED, QUALIFIED, CONVERTED, DISQUALIFIED, RECYCLED |
| `LeadScore` | value: int (0-100), factors: dict |

### Commands

| Command | Description |
|---------|-------------|
| `CreateLeadCommand` | Create lead from form, API, or import |
| `UpdateLeadCommand` | Update lead fields |
| `QualifyLeadCommand` | Move lead to QUALIFIED status |
| `DisqualifyLeadCommand` | Move lead to DISQUALIFIED with reason |
| `ConvertLeadCommand` | Convert lead to Contact + Account + Opportunity |
| `RecycleLeadCommand` | Move lead back to NEW from DISQUALIFIED |
| `AssignLeadCommand` | Assign lead to user |
| `MergeLeadsCommand` | Merge duplicate leads |
| `ScoreLeadCommand` | Recalculate lead score |
| `BulkCreateLeadsCommand` | Bulk create from import |

### Domain Events

| Event | Subscribers |
|-------|-------------|
| `LeadCreated` | Workflow, Search, Notification, Audit |
| `LeadUpdated` | Workflow, Search, Audit |
| `LeadQualified` | Workflow, Notification, Audit |
| `LeadConverted` | Contact (create contact), Account (create account), Opportunity (create opp), Workflow, Audit |
| `LeadDisqualified` | Workflow, Audit |
| `LeadAssigned` | Notification, Audit |
| `LeadScoreChanged` | Workflow, Audit |
| `LeadMerged` | Search, Audit |

### REST Endpoints

| Method | URL | Permission |
|--------|-----|------------|
| GET | /leads/ | lead.read |
| POST | /leads/ | lead.create |
| GET | /leads/{id} | lead.read |
| PATCH | /leads/{id} | lead.update |
| DELETE | /leads/{id} | lead.delete |
| POST | /leads/{id}/qualify | lead.update |
| POST | /leads/{id}/disqualify | lead.update |
| POST | /leads/{id}/convert | lead.convert |
| POST | /leads/{id}/recycle | lead.update |
| POST | /leads/{id}/assign | lead.assign |
| POST | /leads/bulk | lead.import |
| POST | /leads/merge | lead.update |
| GET | /leads/export | lead.export |

### Caching Strategy

| Key | TTL | Invalidation |
|-----|-----|-------------|
| `v1:{org_id}:lead:{id}` | 5 min | On lead update |
| `v1:{org_id}:leads:list:{page}` | 2 min | On lead create/update/delete |
| `v1:{org_id}:leads:search:{query}` | 1 min | On relevant change |

### RLS

`organization_id` column with RLS policy. All queries scoped via repository.

### Testing Requirements

- Unit: Lead status transition validation (every path)
- Unit: Lead scoring calculation
- Unit: Duplicate detection rules
- Integration: Full lead lifecycle (create -> qualify -> convert)
- Integration: Bulk import with 10k rows
- Integration: Export filtered leads
- Performance: Bulk create 10k leads < 30s

---

## 9. Contact Management Module

**Business Purpose:** Contact management, GDPR compliance, communication preferences.

**Bounded Context:** Contact Management. Tenant-scoped.

### Aggregates

**Aggregate: Contact**
```
Contact {
    id: UUID (PK)
    organization_id: UUID (FK)
    first_name, last_name, email, phone: Email/PhoneNumber (VO)
    title, company, department
    address: Address (VO) | None
    lifecycle_stage: ContactLifecycleStage
    preferences: CommunicationPreferences (VO)
    gdpr_consent: GDPRConsent (VO)
    owner_id: UUID | None
    tags: list[str]
    custom_fields: dict
    created_at, updated_at, created_by, updated_by, deleted_at
}
```

### Commands

| Command | Description |
|---------|-------------|
| `CreateContactCommand` | Create contact |
| `UpdateContactCommand` | Update contact |
| `DeleteContactCommand` | Soft delete |
| `MergeContactsCommand` | Merge duplicate contacts |
| `ExportContactGDPRCommand` | Export all data for GDPR |
| `ForgetContactGDPRCommand` | Anonymize data for GDPR right to erasure |
| `UpdateContactPreferencesCommand` | Update communication preferences |

### Domain Events

| Event | Subscribers |
|-------|-------------|
| `ContactCreated` | Workflow, Search, Audit |
| `ContactUpdated` | Workflow, Search, Audit |
| `ContactDeleted` | Search, Audit |
| `ContactMerged` | Search, Audit |
| `ContactsExported` | Audit |
| `ContactForgotten` | Audit |

### REST Endpoints

| Method | URL | Permission |
|--------|-----|------------|
| GET | /contacts/ | contact.read |
| POST | /contacts/ | contact.create |
| GET | /contacts/{id} | contact.read |
| PATCH | /contacts/{id} | contact.update |
| DELETE | /contacts/{id} | contact.delete |
| POST | /contacts/merge | contact.merge |
| GET | /contacts/{id}/export-gdpr | contact.read |
| POST | /contacts/{id}/forget | contact.delete (GDPR) |
| PATCH | /contacts/{id}/preferences | contact.update |

---

## 10. Account Management Module

**Business Purpose:** Account/company management, hierarchy, territory assignment.

**Bounded Context:** Account Management. Tenant-scoped.

### Aggregates

**Aggregate: Account**
```
Account {
    id: UUID (PK)
    organization_id: UUID (FK)
    name: str
    domain: str | None
    industry: str | None
    size: AccountSize (enum) | None
    territory: str | None
    parent_account_id: UUID | None (self-referential FK)
    owner_id: UUID | None
    phone: PhoneNumber (VO) | None
    address: Address (VO) | None
    tags: list[str]
    custom_fields: dict
    created_at, updated_at, created_by, updated_by, deleted_at
}
```

### Commands

| Command | Description |
|---------|-------------|
| `CreateAccountCommand` | Create account |
| `UpdateAccountCommand` | Update account |
| `DeleteAccountCommand` | Soft delete |
| `SetParentAccountCommand` | Set hierarchy parent |
| `AssignTerritoryCommand` | Assign territory |
| `MergeAccountsCommand` | Merge duplicate accounts |

### Domain Events

| Event | Subscribers |
|-------|-------------|
| `AccountCreated` | Workflow, Search, Audit |
| `AccountUpdated` | Workflow, Search, Audit |
| `AccountDeleted` | Search, Audit |
| `AccountHierarchyChanged` | Audit |

### REST Endpoints

| Method | URL | Permission |
|--------|-----|------------|
| GET | /accounts/ | account.read |
| POST | /accounts/ | account.create |
| GET | /accounts/{id} | account.read |
| PATCH | /accounts/{id} | account.update |
| DELETE | /accounts/{id} | account.delete |
| PATCH | /accounts/{id}/parent | account.update |
| POST | /accounts/merge | account.update |

---

## 11. Pipeline Management Module

**Business Purpose:** Configurable sales pipeline stages.

**Bounded Context:** Pipeline Management. Tenant-scoped.

### Aggregates

**Aggregate: Pipeline**
```
Pipeline {
    id: UUID (PK)
    organization_id: UUID (FK)
    name: str
    description: str | None
    is_default: bool
    stages: list[PipelineStage] (ordered)
    created_at, updated_at, deleted_at
}

PipelineStage {
    id: UUID (PK)
    pipeline_id: UUID (FK)
    name: str
    order: int
    probability: Percentage (VO)  # Default probability for opportunities in this stage
    is_won_stage: bool
    is_lost_stage: bool
    rules: StageRules | None  # Transition rules
}
```

### Commands

| Command | Description |
|---------|-------------|
| `CreatePipelineCommand` | Create pipeline with stages |
| `UpdatePipelineCommand` | Update pipeline |
| `DeletePipelineCommand` | Delete pipeline (not if opportunities exist) |
| `ReorderStagesCommand` | Reorder stages |
| `SetDefaultPipelineCommand` | Set as default |

### Domain Events

| Event | Subscribers |
|-------|-------------|
| `PipelineCreated` | Audit |
| `PipelineUpdated` | Audit |
| `PipelineDeleted` | Audit |
| `PipelineStageChanged` | Opportunity (recalculate forecast) |

### REST Endpoints

| Method | URL | Permission |
|--------|-----|------------|
| GET | /pipelines/ | pipeline.read |
| POST | /pipelines/ | pipeline.create |
| GET | /pipelines/{id} | pipeline.read |
| PATCH | /pipelines/{id} | pipeline.update |
| DELETE | /pipelines/{id} | pipeline.delete |
| POST | /pipelines/{id}/set-default | pipeline.update |
| POST | /pipelines/{id}/reorder-stages | pipeline.update |

---

## 12. Opportunity Module

**Business Purpose:** Deal/opportunity tracking, sales forecasting, win/loss analysis.

**Bounded Context:** Opportunity Management. Tenant-scoped.

### Aggregates

**Aggregate: Opportunity**
```
Opportunity {
    id: UUID (PK)
    organization_id: UUID (FK)
    name: str
    amount: Money (VO)
    currency: Currency (VO)
    pipeline_id: UUID (FK)
    stage_id: UUID (FK)
    probability: Percentage (VO)
    close_date: date
    expected_revenue: Money (VO, computed: amount * probability)
    lead_id: UUID | None (FK)
    contact_id: UUID | None (FK)
    account_id: UUID | None (FK)
    owner_id: UUID | None
    primary_competitor: str | None
    win_reason: str | None
    loss_reason: str | None
    loss_reason_category: str | None
    stage_history: list[StageChange]
    tags: list[str]
    custom_fields: dict
    created_at, updated_at, created_by, updated_by, deleted_at
}
```

### Commands

| Command | Description |
|---------|-------------|
| `CreateOpportunityCommand` | Create opportunity |
| `UpdateOpportunityCommand` | Update opportunity |
| `DeleteOpportunityCommand` | Soft delete |
| `ChangeStageCommand` | Move to next/previous stage with timestamp |
| `WinOpportunityCommand` | Mark as won with reason |
| `LoseOpportunityCommand` | Mark as lost with reason category |
| `AssignOpportunityCommand` | Assign owner |
| `GetForecastCommand` | Calculate forecast by pipeline/owner/territory |

### Domain Events

| Event | Subscribers |
|-------|-------------|
| `OpportunityCreated` | Workflow, Search, Audit |
| `OpportunityUpdated` | Workflow, Search, Audit |
| `OpportunityStageChanged` | Workflow, Notification, Audit |
| `OpportunityWon` | Workflow, Notification, Reports, Audit |
| `OpportunityLost` | Workflow, Notification, Reports, Audit |
| `OpportunityAssigned` | Notification, Audit |

### REST Endpoints

| Method | URL | Permission |
|--------|-----|------------|
| GET | /opportunities/ | opportunity.read |
| POST | /opportunities/ | opportunity.create |
| GET | /opportunities/{id} | opportunity.read |
| PATCH | /opportunities/{id} | opportunity.update |
| DELETE | /opportunities/{id} | opportunity.delete |
| POST | /opportunities/{id}/change-stage | opportunity.update |
| POST | /opportunities/{id}/win | opportunity.update |
| POST | /opportunities/{id}/lose | opportunity.update |
| POST | /opportunities/{id}/assign | opportunity.update |
| GET | /opportunities/forecast | opportunity.read |

---

## 13. Activity Module

**Business Purpose:** Log calls, emails, meetings, notes against any entity.

**Bounded Context:** Activity Logging. Tenant-scoped.

### Aggregates

**Aggregate: Activity**
```
Activity {
    id: UUID (PK)
    organization_id: UUID (FK)
    type: ActivityType (CALL | EMAIL | MEETING | NOTE | TASK | SMS)
    subject: str
    description: str | None
    duration_minutes: int | None
    outcome: ActivityOutcome | None
    related_to_type: str | None  # Polymorphic: contact, lead, opportunity, account
    related_to_id: UUID | None
    created_by: UUID
    owner_id: UUID | None
    activity_date: datetime
    created_at, updated_at, deleted_at
}
```

### Commands

| Command | Description |
|---------|-------------|
| `LogActivityCommand` | Log any activity type |
| `UpdateActivityCommand` | Update activity |
| `DeleteActivityCommand` | Soft delete |
| `GetTimelineQuery` | Get activity timeline for entity |

### Domain Events

| Event | Subscribers |
|-------|-------------|
| `ActivityLogged` | Workflow, Search, Audit |
| `ActivityUpdated` | Audit |
| `ActivityDeleted` | Audit |

### REST Endpoints

| Method | URL | Permission |
|--------|-----|------------|
| GET | /activities/ | activity.read |
| POST | /activities/ | activity.create |
| GET | /activities/{id} | activity.read |
| PATCH | /activities/{id} | activity.update |
| DELETE | /activities/{id} | activity.delete |
| GET | /activities/timeline | activity.read (filtered by entity) |

---

## 14. Task Module

**Business Purpose:** Task management, assignments, reminders.

**Bounded Context:** Task Management. Tenant-scoped.

### Aggregates

**Aggregate: Task**
```
Task {
    id: UUID (PK)
    organization_id: UUID (FK)
    subject: str
    description: str | None
    status: TaskStatus (NOT_STARTED | IN_PROGRESS | COMPLETED | DEFERRED | CANCELLED)
    priority: TaskPriority (LOW | MEDIUM | HIGH | URGENT)
    due_date: datetime | None
    completed_at: datetime | None
    assignee_id: UUID | None
    related_to_type: str | None
    related_to_id: UUID | None
    reminder_at: datetime | None
    created_by: UUID
    created_at, updated_at, deleted_at
}
```

### Commands

| Command | Description |
|---------|-------------|
| `CreateTaskCommand` | Create task |
| `UpdateTaskCommand` | Update task |
| `CompleteTaskCommand` | Mark as completed |
| `ReopenTaskCommand` | Reopen completed task |
| `AssignTaskCommand` | Assign to user |
| `DeleteTaskCommand` | Soft delete |

### Domain Events

| Event | Subscribers |
|-------|-------------|
| `TaskCreated` | Workflow, Notification, Audit |
| `TaskUpdated` | Audit |
| `TaskCompleted` | Workflow, Notification, Audit |
| `TaskAssigned` | Notification, Audit |

---

## 15. Calendar Module

**Business Purpose:** Calendar sync with Google Calendar and Outlook.

**Bounded Context:** Calendar Integration. Tenant-scoped.

### Key Components

**Domain:**
- `CalendarEvent` value object
- `CalendarProvider` interface (Google, Outlook)
- `Meeting` entity (CRM meeting linked to activity)

**Infrastructure:**
- `GoogleCalendarAdapter` — OAuth + Google Calendar API
- `OutlookCalendarAdapter` — OAuth + Microsoft Graph API
- `CalendarSyncService` — Bi-directional sync engine

**Celery Tasks:**
- `sync_calendar_events(integration_id)` — Periodic sync
- `watch_calendar_changes(integration_id)` — Webhook subscription

### REST Endpoints

| Method | URL | Permission |
|--------|-----|------------|
| GET | /calendar/events | activity.read |
| POST | /calendar/events | activity.create |
| POST | /calendar/sync | activity.create (trigger sync) |
| GET | /calendar/availability | activity.read |

---

## 16. Workflow Module

**Business Purpose:** Automation engine that evaluates conditions and executes actions when domain events fire.

**Bounded Context:** Workflow Automation. Tenant-scoped.

### Aggregates

**Aggregate: Workflow**
```
Workflow {
    id: UUID (PK)
    organization_id: UUID (FK)
    name: str
    description: str | None
    event_trigger: str  # e.g., "LeadCreated"
    conditions: ConditionNode (AND/OR tree)
    actions: list[WorkflowAction] (ordered)
    is_enabled: bool
    priority: int
    max_executions: int | None
    execution_count: int
    created_by: UUID
    created_at, updated_at, deleted_at
}
```

**Value Objects:**
- `ConditionNode` — AND/OR tree of individual conditions
- `FieldCondition` — field, operator, value
- `WorkflowAction` — type, params (dict)
- `ExecutionResult` — success, actions_executed, error

### Domain Services

| Service | Purpose |
|---------|---------|
| `ConditionEvaluator` | Evaluate condition tree against entity state |
| `ActionExecutor` | Execute ordered actions with rollback |
| `WorkflowMatcher` | Match incoming event to enabled workflows |
| `WorkflowScheduler` | Cron/time-based workflow triggering |
| `LoopDetector` | Detect and prevent infinite workflow chains |

### Celery Tasks

- `execute_workflow(workflow_id, event_data)` — Main execution task
- `evaluate_scheduled_workflows` — Periodic evaluation of time-based workflows
- `cleanup_workflow_execution_history` — Archive old execution logs

### REST Endpoints

| Method | URL | Permission |
|--------|-----|------------|
| GET | /workflows/ | workflow.read |
| POST | /workflows/ | workflow.create |
| GET | /workflows/{id} | workflow.read |
| PATCH | /workflows/{id} | workflow.update |
| DELETE | /workflows/{id} | workflow.delete |
| POST | /workflows/{id}/enable | workflow.update |
| POST | /workflows/{id}/disable | workflow.update |
| POST | /workflows/{id}/test-run | workflow.test |
| GET | /workflows/{id}/executions | workflow.read |
| GET | /workflows/executions/{exec_id} | workflow.read |
| GET | /workflows/templates | workflow.read |
| POST | /workflows/templates/{id}/install | workflow.create |

---

## 17. Notification Module

**Business Purpose:** Multi-channel notification delivery (email, SMS, in-app, push, Slack).

**Bounded Context:** Notification Delivery. Tenant-scoped.

### Key Components

**Domain:**
- `NotificationChannel` interface (abstract)
- `NotificationTemplate` — Jinja2 template with variables
- `NotificationPreference` — Per-user, per-channel opt-in/out
- `Notification` — Delivery record

**Channels:**
| Channel | Provider | Protocol |
|---------|----------|----------|
| Email | SendGrid / AWS SES | SMTP / HTTP API |
| SMS | Twilio | REST API |
| In-App | Django Channels + Redis | WebSocket |
| Push | Firebase Cloud Messaging | HTTP API |
| Slack | Slack Webhook | HTTP POST |
| Teams | Microsoft Teams Webhook | HTTP POST |

### Application Services

| Service | Purpose |
|---------|---------|
| `NotificationDeliveryService` | Route notification to appropriate channel |
| `TemplateRenderingService` | Render Jinja2 template with context |
| `PreferenceFilterService` | Apply user preferences, quiet hours, digests |
| `RateLimitService` | Enforce per-user, per-channel, per-tenant rate limits |

### Celery Tasks

- `send_email_notification(notification_id)` — Email delivery with retry
- `send_sms_notification(notification_id)` — SMS delivery
- `send_push_notification(notification_id)` — Push delivery
- `deliver_webhook(webhook_id)` — Slack/Teams webhook
- `process_digest(org_id, user_id, frequency)` — Digest email generation
- `retry_failed_notifications` — Retry dead-letter notifications

### REST Endpoints

| Method | URL | Permission |
|--------|-----|------------|
| GET | /notifications/ | notification.read |
| PATCH | /notifications/{id}/read | notification.update |
| POST | /notifications/read-all | notification.update |
| GET | /notifications/preferences | notification.read |
| PUT | /notifications/preferences | notification.update |
| GET | /notifications/templates | notification.read |
| POST | /notifications/templates | notification.create |
| PATCH | /notifications/templates/{id} | notification.update |
| DELETE | /notifications/templates/{id} | notification.delete |

---

## 18. Reports & Dashboard Module

**Business Purpose:** Ad-hoc report builder, pre-built dashboards, sales forecasting.

**Bounded Context:** Reporting & Analytics. Tenant-scoped (read-only).

### Aggregates

**Aggregate: Report**
```
Report {
    id: UUID (PK)
    organization_id: UUID (FK)
    name: str
    data_source: str  # Model/table reference
    dimensions: list[Field]
    measures: list[AggregateField]
    filters: list[ReportFilter]
    sorting: list[SortField]
    grouping: list[GroupField]
    chart_type: ChartType | None
    created_by: UUID
    created_at, updated_at, deleted_at
}
```

**Aggregate: Dashboard**
```
Dashboard {
    id: UUID (PK)
    organization_id: UUID (FK)
    name: str
    layout: GridLayout  # Widget positions
    widgets: list[DashboardWidget]
    is_shared: bool
    created_by: UUID
    created_at, updated_at, deleted_at
}

DashboardWidget {
    id: UUID
    dashboard_id: UUID (FK)
    report_id: UUID (FK) | None
    widget_type: WidgetType (CHART | KPI | TABLE | METRIC)
    config: WidgetConfig  # Size, position, visual settings
}
```

### Application Services

| Service | Purpose |
|---------|---------|
| `ReportExecutionService` | Execute report query (sync or async) |
| `ReportExportService` | Export report to CSV, PDF, XLSX |
| `DashboardRenderService` | Aggregate dashboard widget data |
| `ForecastCalculationService` | Probability-weighted forecast rollup |
| `ScheduledReportService` | Schedule and deliver reports |

### Celery Tasks

- `execute_report(report_id, filters)` — Async report execution for large datasets
- `export_report(report_id, format, user_id)` — Export generation
- `deliver_scheduled_report(schedule_id)` — Scheduled report delivery
- `refresh_materialized_views` — Periodic refresh of aggregation views

### REST Endpoints

| Method | URL | Permission |
|--------|-----|------------|
| GET | /reports/ | report.read |
| POST | /reports/ | report.create |
| GET | /reports/{id} | report.read |
| PATCH | /reports/{id} | report.update |
| DELETE | /reports/{id} | report.delete |
| POST | /reports/{id}/execute | report.read |
| POST | /reports/{id}/export | report.export |
| GET | /dashboards/ | report.read |
| POST | /dashboards/ | report.create |
| GET | /dashboards/{id} | report.read |
| PATCH | /dashboards/{id} | report.update |
| DELETE | /dashboards/{id} | report.delete |
| GET | /analytics/forecast | report.read |
| GET | /analytics/pipeline | report.read |
| GET | /analytics/activity | report.read |

---

## 19. Search Module

**Business Purpose:** Full-text search across leads, contacts, accounts, and opportunities.

**Bounded Context:** Search Index. Consumes events (no domain deps).

### Key Components

**Infrastructure:**
- PostgreSQL full-text search with `tsvector` and GIN indexes
- Weighted field ranking (title > description > notes)
- Search query builder with relevance scoring

**Celery Tasks:**
- `index_entity(entity_type, entity_id)` — On create/update
- `remove_from_index(entity_type, entity_id)` — On delete
- `reindex_all(org_id)` — Full reindex for tenant

### REST Endpoints

| Method | URL | Permission |
|--------|-----|------------|
| GET | /search?q={query}&type={types} | search.read |

---

## 20. Audit Module

**Business Purpose:** Event-sourced audit log for compliance and debugging.

**Bounded Context:** Audit. NOT tenant-scoped (audit is cross-tenant for system admins).

### Key Components

**Domain:**
- `AuditEntry` — event_id, organization_id, user_id, event_type, payload, occurred_at
- `AuditPolicy` — retention period, export format

**Infrastructure:**
- Append-only audit log table (partitioned by month)
- Event-driven consumption via event handler
- Retention enforcement via scheduled task

**Celery Tasks:**
- `record_audit_event(event_type, payload)` — Store audit entry
- `enforce_retention_policy` — Archive/delete expired entries
- `export_audit_log(org_id, date_range)` — Compliance export

### REST Endpoints

| Method | URL | Permission |
|--------|-----|------------|
| GET | /audit/log | audit.read |
| GET | /audit/log/{id} | audit.read |
| GET | /audit/export | audit.export |

---

## 21. AI Module

**Business Purpose:** AI features: lead scoring, next-best-action, sentiment analysis, conversation summary, RAG.

**Bounded Context:** AI Platform. FastAPI sidecar + Django integration.

### Key Components

**AI Gateway (FastAPI Sidecar):**
```
ai_gateway/
├── app/
│   ├── main.py                 # FastAPI app
│   ├── config.py               # Settings
│   ├── api/
│   │   ├── chat.py             # /v1/chat/completions
│   │   ├── embeddings.py       # /v1/embeddings
│   │   ├── rag.py              # /v1/rag/query
│   │   ├── analyze.py          # /v1/analyze/*
│   │   └── prompts.py          # /v1/prompts
│   ├── services/
│   │   ├── llm_service.py      # LLM provider abstraction
│   │   ├── embedding_service.py # Embedding generation
│   │   ├── rag_service.py      # RAG pipeline
│   │   ├── scoring_service.py  # ML-based scoring
│   │   └── sentiment_service.py # Sentiment analysis
│   ├── domain/
│   │   ├── prompts.py          # Prompt template VO
│   │   ├── models.py           # AIModel config
│   │   └── cost.py             # Cost tracking
│   └── infrastructure/
│       ├── openai_adapter.py
│       ├── anthropic_adapter.py
│       ├── pgvector_client.py
│       └── redis_cache.py
├── Dockerfile
└── pyproject.toml
```

### Application Services

| Service | Purpose |
|---------|---------|
| `LLMService` | Unified LLM API with provider routing, retry, fallback |
| `EmbeddingService` | Generate embeddings for entity text |
| `RAGService` | Document ingestion, chunking, retrieval, generation |
| `ScoringService` | ML-based lead scoring with feature importance |
| `NextBestActionService` | Recommend next actions based on lead stage |
| `SentimentService` | Analyze text sentiment with drift detection |
| `SummaryService` | Generate conversation summaries |
| `CostTrackingService` | Track token usage per feature per org |

### Celery Tasks (Django side)

- `generate_embedding(entity_type, entity_id)` — On entity create/update
- `batch_reindex_embeddings(org_id)` — Full re-embedding
- `process_rag_document(document_id)` — Chunk, embed, index
- `calculate_lead_scores(org_id)` — Batch score recalculation
- `refresh_next_best_actions(lead_id)` — Periodic NBA refresh

### REST Endpoints (Django — management)

| Method | URL | Permission |
|--------|-----|------------|
| GET | /ai/leads/{id}/score | lead.read |
| GET | /ai/leads/{id}/next-best-action | lead.read |
| POST | /ai/analyze/sentiment | activity.read |
| POST | /ai/analyze/summarize | activity.read |
| GET | /ai/usage | ai.read (cost tracking) |
| GET | /ai/usage/{org_id} | ai.read |
| GET | /ai/prompts | ai.read |
| POST | /ai/prompts | ai.create |

### REST Endpoints (FastAPI — internal)

| Method | URL | Description |
|--------|-----|-------------|
| POST | /v1/chat/completions | LLM proxy with prompt injection |
| POST | /v1/embeddings | Generate embeddings |
| POST | /v1/rag/query | RAG query over org documents |
| POST | /v1/analyze/sentiment | Sentiment analysis |
| POST | /v1/analyze/summarize | Text summarization |
| GET | /v1/prompts | List prompt templates |
| GET | /health | Health check |

### Caching Strategy

| Key | TTL | Notes |
|-----|-----|-------|
| `v1:ai:embedding:{entity_type}:{id}` | Until re-embedding | Embedding cache |
| `v1:ai:score:{lead_id}` | 1 hour | Lead score cache |
| `v1:ai:nba:{lead_id}` | 30 min | NBA recommendation cache |
| `v1:ai:llm:{prompt_hash}:{input_hash}` | 24 hours | LLM response cache (exact match) |

### RLS

pgvector embedding table includes `organization_id` with RLS.

---

## 22. Voice AI Module

**Business Purpose:** Voice call logging, transcription, analysis, AI coaching.

**Bounded Context:** Voice AI. Tenant-scoped.

### Key Components

**Domain:**
- `Call` — id, org_id, from_number, to_number, direction, duration, status, recording_url
- `CallTranscription` — segments with speaker, text, timestamp, confidence
- `CallAnalysis` — sentiment, talk_ratio, objections, action_items
- `CallCoachingTip` — real-time/call suggestions

**Infrastructure:**
- `TwilioVoiceAdapter` — Twilio Voice SDK integration
- `DeepgramASRAdapter` — Real-time speech-to-text
- `WhisperASRAdapter` — Post-call transcription

### Celery Tasks

- `process_call_recording(call_id)` — Post-call transcription and analysis
- `generate_call_scorecard(call_id)` — Coaching scorecard
- `detect_call_anomalies(call_id)` — Compliance/consent issues

### REST Endpoints

| Method | URL | Permission |
|--------|-----|------------|
| GET | /calls/ | activity.read |
| POST | /calls/ | activity.create |
| GET | /calls/{id} | activity.read |
| GET | /calls/{id}/transcription | activity.read |
| GET | /calls/{id}/analysis | activity.read |
| GET | /calls/{id}/coaching | activity.read |
| GET | /calls/{id}/recording | activity.read |

---

## 23. Integration Module

**Business Purpose:** Third-party connector framework with SDK, OAuth, webhooks, sync engine.

**Bounded Context:** Integration Hub. Tenant-scoped.

### Key Components

**Domain:**
- `Integration` — id, org_id, provider, auth_config, status, last_sync_at
- `OAuthToken` — encrypted access/refresh tokens with expiry
- `WebhookSubscription` — event_type, target_url, signing_secret, filters
- `SyncJob` — status, progress, error_log, started/completed timestamps

**Infrastructure:**
- `ConnectorBase` — Abstract base class for connectors
- `OAuthVault` — AES-256-GCM encrypted token storage
- `WebhookDeliveryService` — HTTP POST with retry + HMAC signing
- `SyncEngine` — Incremental sync with conflict resolution

### Celery Tasks

- `execute_sync_job(job_id)` — Full sync execution
- `process_webhook_delivery(webhook_id)` — Outbound delivery
- `receive_inbound_webhook(provider, payload)` — Inbound processing
- `refresh_oauth_tokens` — Proactive OAuth token refresh
- `retry_failed_syncs` — Retry failed sync jobs

### REST Endpoints

| Method | URL | Permission |
|--------|-----|------------|
| GET | /integrations/ | integration.read |
| POST | /integrations/ | integration.create |
| GET | /integrations/{id} | integration.read |
| PATCH | /integrations/{id} | integration.update |
| DELETE | /integrations/{id} | integration.delete |
| POST | /integrations/{id}/auth | integration.update |
| POST | /integrations/{id}/sync | integration.create |
| GET | /integrations/{id}/sync/{job_id} | integration.read |
| GET | /integrations/{id}/logs | integration.read |
| GET | /webhooks/ | integration.read |
| POST | /webhooks/ | integration.create |
| DELETE | /webhooks/{id} | integration.delete |
| POST | /public/webhook/{provider} | Public (signature verified) |

---

## 24. Settings Module

**Business Purpose:** Tenant and user settings management.

**Bounded Context:** Settings. Tenant-scoped.

### Domain

- `TenantSettings` — All configurable org-level settings
- `UserSettings` — Per-user preferences

### REST Endpoints

| Method | URL | Permission |
|--------|-----|------------|
| GET | /settings/org | settings.read |
| PUT | /settings/org | settings.update |
| GET | /settings/user | Authenticated |
| PUT | /settings/user | Authenticated |
| GET | /settings/features | settings.read |

---

## 25. Dependency Graph Between Modules

### Strict Dependency Graph

```
shared_kernel (no deps)
    ↑
identity (needs: shared_kernel)
    ↑
organization (needs: identity, shared_kernel)
    ↑
rbac (needs: identity, organization, shared_kernel)
    ↑
tenant (needs: identity, organization, rbac, shared_kernel)
    ↑
lead (needs: tenant, shared_kernel)
    ↑
contact (needs: lead, tenant, shared_kernel)
    ↑
account (needs: lead, contact, tenant, shared_kernel)
    ↑
pipeline (needs: lead, contact, account, tenant, shared_kernel)
    ↑
opportunity (needs: pipeline, lead, contact, account, tenant, shared_kernel)
    ↑
activity (needs: opportunity, lead, contact, account, tenant, shared_kernel)
    ↑
task (needs: activity, shared_kernel)
    ↑
calendar (needs: activity, task, shared_kernel)
    ↑
workflow (needs: events from leads, contacts, opportunities, tasks; tenant, shared_kernel)
    ↑
notification (needs: workflow, identity, shared_kernel)
    ↑
reports (needs: read-only access to leads, contacts, accounts, opportunities, activities; shared_kernel)
    ↑
dashboard (needs: reports, shared_kernel)
    ↑
search (needs: events from leads, contacts, accounts, opportunities; shared_kernel)
    ↑
audit (needs: events from all modules; shared_kernel)
    ↑
ai (needs: reports, workflow, search, lead, contact; shared_kernel)
    ↑
voice_ai (needs: ai, activity, shared_kernel)
    ↑
integrations (needs: identity, lead, contact, account, opportunity, activity; shared_kernel)
    ↑
settings (needs: identity, organization, tenant, shared_kernel)
```

### Event-Based Dependencies (Looser Coupling)

| Subscriber Module | Consumes Events From |
|-------------------|---------------------|
| workflow | lead, contact, account, opportunity, activity, task |
| notification | workflow (via action), lead (assignment) |
| search | lead, contact, account, opportunity |
| audit | ALL modules |
| ai | lead, contact, opportunity |
| reports | Reads directly from entity tables |

---

## 26. Shared Kernel Implementation Sequence

### Order of Implementation

| Step | Component | Details | Effort |
|------|-----------|---------|--------|
| 1 | `ValueObject` base | `__eq__`, `__hash__`, `__repr__`, `__setattr__` immutability | 4h |
| 2 | `Entity` base | Identity-based equality, `__eq__`, `__hash__` | 2h |
| 3 | `AggregateRoot` base | Entity + event collection, `collect_events()`, `clear_events()` | 3h |
| 4 | `DomainEvent` base | `event_id` (UUID7), `occurred_at`, `organization_id` | 2h |
| 5 | `Email` VO | Regex validation, normalization, equality | 2h |
| 6 | `PhoneNumber` VO | E.164 format, country code validation | 2h |
| 7 | `Address` VO | Multi-field VO with country validation | 3h |
| 8 | `PersonName` VO | First/last name, sanitization | 1h |
| 9 | `Money` VO | Decimal amount, currency validation | 2h |
| 10 | `Currency` VO | ISO 4217 enum | 1h |
| 11 | `Percentage` VO | 0-100 range validation | 1h |
| 12 | `TimeZone` VO | IANA timezone validation | 1h |
| 13 | `URL` VO | URL format validation | 1h |
| 14 | `Result[T, E]` | Success/Failure with chaining | 3h |
| 15 | `PaginatedResult[T]` | Pagination math | 2h |
| 16 | `DomainError` hierarchy | NotFound, Validation, Permission, Conflict | 1h |
| 17 | `Repository[T]` port | Interface definition | 1h |
| 18 | `EventPublisher` port | Interface definition | 1h |
| 19 | `UUIDModel` mixin | UUID v7 primary key | 2h |
| 20 | `TimestampedModel` mixin | created_at, updated_at auto-set | 1h |
| 21 | `SoftDeleteModel` mixin | deleted_at, default filter | 2h |
| 22 | `TenantScopedModel` mixin | organization_id FK + RLS marker | 2h |
| 23 | `Specification` base | AndSpecification, OrSpecification, NotSpecification | 3h |
| 24 | `UnitOfWork` pattern | Context manager for transaction boundary | 2h |
| 25 | UUID v7 generator | Time-ordered UUID generation | 2h |
| 26 | import-linter rules | Layer enforcement configuration | 2h |
| 27 | All tests | Unit + integration for all shared kernel components | 8h |

**Total estimated effort: ~11 person-days**

### Key Design Decisions

1. **UUID v7 over UUID v4** — Time-ordered UUIDs are B-tree index friendly, sortable by creation time, safe for multi-region generation without coordination.

2. **`organization_id` on DomainEvent** — Every event carries tenant context for Celery propagation and audit logging. This is set automatically by the `DomainEvent` base class from thread-local storage.

3. **`TenantScopedModel` as a marker** — The RLS policy engine discovers which tables need policies by finding all models that inherit this mixin. This is a compile-time check — if a model doesn't inherit it, no RLS policy is generated.

4. **Repository pattern vs QuerySet** — Services depend on `Repository[T]` interface, not on `Model.objects`. This allows testing services without database, and swapping ORM implementations. Complex read queries use `Selector` objects for DTO projection.

5. **Result type over exceptions** — Application services return `Result[T, E]` for expected failures (entity not found, validation error) and reserve exceptions for unexpected failures (DB down, network error). This makes error handling explicit in the type system.
