# Module Blueprint: Identity & Multi-Tenancy

> **Version:** 0.1.0-draft
> **Last Updated:** 2026-07-27
> **Status:** Foundational Design Phase
> **Owner:** Platform Architecture Team
> **Depends On:** Shared Kernel
> **Modules Covered:** `identity`, `organization`, `rbac`, `tenant`

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Business Purpose & Scope](#2-business-purpose--scope)
3. [Bounded Context Analysis](#3-bounded-context-analysis)
4. [Identity Module](#4-identity-module)
5. [Organization Module](#5-organization-module)
6. [RBAC Module](#6-rbac-module)
7. [Tenant Module](#7-tenant-module)
8. [Cross-Cutting Concerns](#8-cross-cutting-concerns)
9. [API Reference](#9-api-reference)
10. [Database Schema](#10-database-schema)
11. [Workflows & State Machines](#11-workflows--state-machines)
12. [Security Architecture](#12-security-architecture)
13. [Testing Strategy](#13-testing-strategy)
14. [Failure Scenarios & Mitigations](#14-failure-scenarios--mitigations)
15. [Future Enhancements](#15-future-enhancements)

---

## 1. Executive Summary

### What This Blueprint Covers

The Identity & Multi-Tenancy foundation is the base layer of the TZAHU CRM platform. Every user, every organization, every permission check, and every data isolation boundary depends on these four modules working correctly. A defect here is not a bug in a feature — it is a systemic vulnerability that affects every single customer interaction.

### Modules at a Glance

| Module | Responsibility | Depends On |
|--------|---------------|------------|
| `identity` | User authentication, registration, JWT management, password policies, session tracking | Shared Kernel |
| `organization` | Organization (tenant) profile, settings, subscription tier, member management | identity |
| `rbac` | Role definitions, permission assignment, role-resolution engine | identity, organization |
| `tenant` | Multi-tenant infrastructure: RLS policy management, tenant lifecycle, provisioning, isolation enforcement | identity, organization, rbac |

### Design Philosophy

1. **Authentication before authorization.** A user must prove who they are (identity) before the system determines what they can do (rbac) and what data they can see (tenant/RLS). Each layer is independently testable.

2. **Tenant isolation is not optional.** Every query, every Celery task, every API response must be tenant-scoped. The `tenant` module enforces this at the database level (RLS) so that application-level mistakes don't become data leaks.

3. **RBAC is flat and explicit.** No role hierarchy in Phase 1 — roles are flat sets of permissions. Hierarchy (manager can do everything their reports can) comes in Phase 11 only if evidence supports it. Flat RBAC is simpler to reason about, simpler to test, and simpler to audit.

4. **JWT is the identity token, not the authorization token.** The JWT contains user identity and tenant membership. Permissions are resolved at request time from the database (with cache), not embedded in the token. This avoids token revocation complexity — a permission change takes effect immediately, not when the token expires.

---

## 2. Business Purpose & Scope

### Business Capabilities

| Capability | Priority | Description |
|-----------|----------|-------------|
| User Registration | P0 | Users register with email + password; email verification before first login |
| User Authentication | P0 | Login with email + password; JWT issuance; refresh token rotation |
| Password Management | P0 | Password policy enforcement; forgot/reset password flow; password history |
| User Profile | P0 | Name, avatar, timezone, language preferences, notification preferences |
| Organization Creation | P0 | Create organization on first user registration; org profile setup |
| Organization Member Management | P0 | Invite users; accept/reject invitation; remove members |
| Role Management | P0 | Create roles; assign permissions to roles; assign roles to users |
| Permission Enforcement | P0 | API-level permission checks on every request |
| Tenant Provisioning | P0 | Automatic tenant creation on org signup; RLS policy application |
| Tenant Isolation | P0 | Row-level security on all tenant-scoped tables |
| Tenant Lifecycle | P0 | Activate, suspend, reactivate, delete tenant |
| Multi-Factor Authentication | P1 | TOTP-based MFA; backup codes; recovery flow |
| SAML/SSO | P1 | Enterprise SAML 2.0 / OIDC integration |
| SCIM Provisioning | P2 | Automatic user provisioning from identity providers |

### Out of Scope (Phase 1)

- Field-level permissions (Phase 11)
- Role hierarchy / role inheritance (Phase 11)
- Organization hierarchy (parent/child organizations) (Phase 11)
- Billing & subscription management (Integration Hub)
- Audit logging (separate `audit` module)

---

## 3. Bounded Context Analysis

### Context Map

```
┌────────────────┐     ┌──────────────────┐     ┌────────────────┐
│   IDENTITY     │     │   ORGANIZATION    │     │     RBAC       │
│                │     │                   │     │                │
│  • User        │────►│  • Organization   │◄────│  • Role        │
│  • Credential  │     │  • Membership     │     │  • Permission  │
│  • Session     │     │  • Invitation     │     │  • Assignment  │
│  • MFA Device  │     │  • OrgSettings    │     │                │
└────────┬───────┘     └────────┬──────────┘     └────────┬───────┘
         │                      │                         │
         │                      │                         │
         └──────────────────────┼─────────────────────────┘
                                │
                                ▼
                       ┌────────────────┐
                       │    TENANT      │
                       │                │
                       │  • RLS Policy  │
                       │  • Tenant Ctx  │
                       │  • Lifecycle   │
                       └────────────────┘
```

### Ubiquitous Language

| Term | Definition | Notes |
|------|-----------|-------|
| **User** | A human or service account that authenticates to the system | Has a single identity across all organizations |
| **Organization** | A tenant — a company using TZAHU CRM | Has its own data, users, settings, subscription |
| **Membership** | A user's association with an organization | User can belong to multiple organizations |
| **Role** | A named set of permissions | e.g., "Sales Rep", "Manager", "Admin" |
| **Permission** | An action on an entity | Named as `{entity}.{action}` — e.g., `lead.create` |
| **RoleAssignment** | The link between user + role + organization | Scoped to an organization |
| **Tenant** | The infrastructure representation of an organization | Manages RLS, lifecycle, isolation |
| **Session** | An authenticated device/session | Tracked for security and refresh token management |
| **Credential** | A user's password hash | Separate from User entity for security boundary |

---

## 4. Identity Module

### 4.1 Aggregates

#### Aggregate: User

```python
class User(AggregateRoot):
    """
    A person or service account that authenticates to the system.
    
    Invariants:
    - Email must be unique (across all organizations — user identity is global)
    - Email must be verified before first login
    - Password must meet policy requirements
    - Account can be active, locked, or disabled
    """
    id: UUID
    email: Email                    # Shared Kernel Value Object
    display_name: PersonName         # Shared Kernel Value Object
    status: UserStatus               # ACTIVE | LOCKED | DISABLED | PENDING_VERIFICATION
    email_verified_at: datetime | None
    last_login_at: datetime | None
    password_changed_at: datetime
    preferences: UserPreferences     # Value Object
    
    # Behaviors
    def register(self, password: str, password_hasher: PasswordHasher) -> list[DomainEvent]:
        """Register a new user. Publishes UserRegistered event."""
    
    def verify_email(self, token: str, token_service: TokenService) -> list[DomainEvent]:
        """Verify email address. Publishes EmailVerified event."""
    
    def login(self, password: str, password_hasher: PasswordHasher) -> list[DomainEvent]:
        """Authenticate user. Publishes UserLoggedIn event."""
    
    def change_password(self, old: str, new: str, hasher: PasswordHasher) -> list[DomainEvent]:
        """Change password. Enforces password history. Publishes PasswordChanged event."""
    
    def lock(self, reason: str) -> list[DomainEvent]:
        """Lock account after too many failed attempts."""
    
    def disable(self, reason: str) -> list[DomainEvent]:
        """Disable account (admin action)."""
    
    # Events
    # - UserRegistered(user_id, email, registered_at)
    # - EmailVerified(user_id, verified_at)
    # - UserLoggedIn(user_id, login_method, ip_address, user_agent)
    # - PasswordChanged(user_id, changed_at)
    # - AccountLocked(user_id, reason, locked_at)
    # - AccountDisabled(user_id, reason, disabled_at)
```

#### Aggregate: Session

```python
class Session(Entity):
    """
    An authenticated device/session with refresh token.
    
    Invariants:
    - One user can have multiple active sessions (different devices)
    - Refresh token is rotated on use (old token invalidated)
    - Session expires after configured TTL (default: 7 days)
    - Session can be revoked individually or all at once
    """
    id: UUID
    user_id: UUID
    refresh_token_hash: str     # Hashed refresh token (never store plaintext)
    device_info: DeviceInfo      # Value Object: name, type, os, browser
    ip_address: str
    last_used_at: datetime
    expires_at: datetime
    revoked_at: datetime | None
    
    # Behaviors
    def rotate_refresh_token(self, old_token: str, new_token: str, hasher: PasswordHasher) -> None:
        """Rotate refresh token. Old token must match stored hash."""
    
    def revoke(self) -> None:
        """Revoke this session (logout)."""
    
    def is_expired(self) -> bool:
        """Check if session has expired."""
```

### 4.2 Value Objects

| Value Object | Fields | Validation |
|-------------|--------|------------|
| `UserPreferences` | timezone, locale, date_format, number_format, notification_preferences | Timezone must be valid IANA; locale must be supported |
| `DeviceInfo` | name, type, os, browser, os_version, browser_version | Free-form but sanitized (no HTML/script) |
| `PasswordPolicy` | min_length=12, require_uppercase=True, require_lowercase=True, require_digit=True, require_special=True, history_count=5, max_age_days=90 | Global policy enforced at registration and password change |

### 4.3 Domain Events

| Event | Payload | Trigger | Subscribers |
|-------|---------|---------|-------------|
| `UserRegistered` | user_id, email, registered_at | User.register() | Organization (create membership if invited), Notification (send welcome email) |
| `EmailVerified` | user_id, email, verified_at | User.verify_email() | Identity (activate user) |
| `UserLoggedIn` | user_id, login_method, ip_address, user_agent, logged_in_at | User.login() | Audit, Security (detect anomalous login) |
| `PasswordChanged` | user_id, changed_at | User.change_password() | Notification (send confirmation email), Audit |
| `AccountLocked` | user_id, reason, locked_at | User.lock() | Notification (send alert email), Audit |
| `AccountDisabled` | user_id, reason, disabled_at, disabled_by | User.disable() | Notification (send notice), Audit |

### 4.4 Commands

| Command | Input | Output | Description |
|---------|-------|--------|-------------|
| `RegisterUser` | email, password, first_name, last_name, timezone | UserRegistered event + User | Create new user account |
| `VerifyEmail` | user_id, token | EmailVerified event | Verify email with token from email |
| `LoginUser` | email, password, device_info, ip_address | AuthTokens (access + refresh) | Authenticate and return JWT pair |
| `RefreshToken` | refresh_token, device_info | AuthTokens | Rotate refresh token and issue new access token |
| `ChangePassword` | user_id, old_password, new_password | PasswordChanged event | Change password with history check |
| `InitiatePasswordReset` | email | None (always returns success to prevent email enumeration) | Send password reset email |
| `CompletePasswordReset` | token, new_password | PasswordChanged event | Reset forgotten password |
| `Logout` | user_id, session_id (optional) | SessionRevoked event | Revoke session(s) |
| `LockUser` | user_id, reason, locked_by | AccountLocked event | Admin-initiated account lock |
| `DisableUser` | user_id, reason, disabled_by | AccountDisabled event | Admin-initiated account disable |

### 4.5 Queries

| Query | Returns | Description |
|-------|---------|-------------|
| `GetUserById` | User | Get user by UUID |
| `GetUserByEmail` | User | Get user by email (lookup) |
| `ListUsersByOrganization` | PaginatedResult[User] | List users belonging to an organization |
| `GetActiveSessions` | list[Session] | Get all active sessions for a user |
| `GetUserPermissions` | set[Permission] | Get all permissions for a user in an organization |

---

## 5. Organization Module

### 5.1 Aggregates

#### Aggregate: Organization

```python
class Organization(AggregateRoot):
    """
    A tenant organization using TZAHU CRM.
    
    Invariants:
    - Name must be unique within the platform
    - Slug (subdomain) must be unique within the platform
    - Must have at least one admin user (enforced by Membership aggregate)
    - Status lifecycle: TRIAL → ACTIVE → SUSPENDED → DISABLED (can reactivate)
    """
    id: UUID
    name: str
    slug: str                       # Subdomain for tenant URL
    status: OrganizationStatus       # TRIAL | ACTIVE | SUSPENDED | DISABLED
    tier: SubscriptionTier           # FREE | GROWTH | ENTERPRISE
    features: set[str]              # Feature flags: ["workflow", "ai", "voice_ai", ...]
    settings: OrganizationSettings   # Value Object
    created_at: datetime
    updated_at: datetime
    
    # Behaviors
    def provision(self, owner_user_id: UUID) -> list[DomainEvent]:
        """Provision a new organization. Publishes OrganizationProvisioned event."""
    
    def suspend(self, reason: str) -> list[DomainEvent]:
        """Suspend organization (payment failure, policy violation)."""
    
    def reactivate(self) -> list[DomainEvent]:
        """Reactivate suspended organization."""
    
    def disable(self, reason: str) -> list[DomainEvent]:
        """Permanently disable organization (data retained for retention period)."""
    
    def update_subscription(self, new_tier: SubscriptionTier) -> list[DomainEvent]:
        """Change subscription tier. Updates enabled features."""
    
    def enable_feature(self, feature: str) -> None:
        """Enable a feature flag for this organization."""
    
    def disable_feature(self, feature: str) -> None:
        """Disable a feature flag for this organization."""
    
    # Events
    # - OrganizationProvisioned(org_id, name, tier, provisioned_at)
    # - OrganizationSuspended(org_id, reason, suspended_at)
    # - OrganizationReactivated(org_id, reactivated_at)
    # - OrganizationDisabled(org_id, reason, disabled_at)
    # - OrganizationTierChanged(org_id, old_tier, new_tier, changed_at)
```

#### Aggregate: Membership

```python
class Membership(AggregateRoot):
    """
    A user's membership in an organization.
    
    Invariants:
    - A user can have multiple memberships (different orgs)
    - An organization must have at least one ADMIN member (last admin cannot be removed)
    - Membership status: INVITED → ACTIVE → DISABLED
    """
    id: UUID
    user_id: UUID
    organization_id: UUID
    status: MembershipStatus        # INVITED | ACTIVE | DISABLED
    joined_at: datetime | None
    invited_by: UUID
    invitation_accepted_at: datetime | None
    
    # Behaviors
    def invite(self, invited_by_user_id: UUID) -> list[DomainEvent]:
        """Invite user to organization. Publishes UserInvited event."""
    
    def accept_invitation(self) -> list[DomainEvent]:
        """Accept invitation. Publishes MembershipActivated event."""
    
    def reject_invitation(self) -> list[DomainEvent]:
        """Reject invitation. Publishes InvitationRejected event."""
    
    def disable(self) -> list[DomainEvent]:
        """Remove/disable membership."""
    
    # Events
    # - UserInvited(membership_id, user_id, org_id, invited_by, invited_at)
    # - MembershipActivated(membership_id, user_id, org_id, activated_at)
    # - InvitationRejected(membership_id, user_id, org_id, rejected_at)
    # - MembershipDisabled(membership_id, user_id, org_id, disabled_at)
```

### 5.2 Value Objects

| Value Object | Fields | Validation |
|-------------|--------|------------|
| `OrganizationSettings` | default_timezone, date_format, number_format, currency, fiscal_year_start, logo_url | Timezone IANA valid; currency valid ISO 4217; fiscal year start 1–365 |
| `SubscriptionTier` | name, max_users, max_storage_gb, features, rate_limit_rpm, price_cents | Enum: FREE, GROWTH, ENTERPRISE |
| `OrganizationSlug` | value: str | 3–63 chars, lowercase alphanumeric + hyphens, unique |

---

## 6. RBAC Module

### 6.1 Aggregates

#### Aggregate: Role

```python
class Role(AggregateRoot):
    """
    A named set of permissions within an organization.
    
    Invariants:
    - Role name must be unique within an organization
    - System roles (Admin, Read-only) are seeded by default and cannot be deleted
    - Permissions are additive only (no deny rules in Phase 1)
    """
    id: UUID
    organization_id: UUID
    name: str
    description: str
    permissions: set[Permission]
    is_system_role: bool             # Cannot be deleted or renamed
    is_assignable: bool              # Can be assigned to users
    created_at: datetime
    
    # Behaviors
    def add_permission(self, permission: Permission) -> None:
        """Add a permission to the role."""
    
    def remove_permission(self, permission: Permission) -> None:
        """Remove a permission from the role."""
    
    def rename(self, new_name: str) -> None:
        """Rename role (not allowed for system roles)."""
    
    # Events
    # - RoleCreated(role_id, org_id, name, created_at)
    # - RoleUpdated(role_id, name, permissions_changed, updated_at)
    # - RoleDeleted(role_id, org_id, deleted_at)
```

#### Aggregate: RoleAssignment

```python
class RoleAssignment(AggregateRoot):
    """
    The assignment of a role to a user within an organization.
    
    Invariants:
    - A user can have multiple roles within an organization
    - Permissions are the union of all assigned roles' permissions
    - Admin role assignments can only be managed by other admins
    """
    id: UUID
    user_id: UUID
    organization_id: UUID
    role_id: UUID
    assigned_by: UUID
    assigned_at: datetime
    
    # Behaviors
    def assign(self, assigned_by_user_id: UUID) -> list[DomainEvent]:
        """Assign role to user. Publishes RoleAssigned event."""
    
    def unassign(self) -> list[DomainEvent]:
        """Remove role assignment. Publishes RoleUnassigned event."""
    
    # Events
    # - RoleAssigned(assignment_id, user_id, org_id, role_id, assigned_by, assigned_at)
    # - RoleUnassigned(assignment_id, user_id, org_id, role_id, unassigned_at)
```

### 6.2 Permission Catalog (Phase 1)

Permission names follow the `{entity}.{action}` convention:

```
# Identity
user.create, user.read, user.update, user.delete
user.invite, user.impersonate

# Organization
organization.read, organization.update, organization.delete

# RBAC
role.create, role.read, role.update, role.delete
role.assign, role.unassign

# Tenant (admin operations)
tenant.read, tenant.update, tenant.suspend, tenant.delete
tenant.provision

# Leads
lead.create, lead.read, lead.update, lead.delete
lead.assign, lead.export, lead.import, lead.convert

# Contacts
contact.create, contact.read, contact.update, contact.delete
contact.merge, contact.export

# Accounts
account.create, account.read, account.update, account.delete

# Pipeline & Opportunity
pipeline.create, pipeline.read, pipeline.update, pipeline.delete
opportunity.create, opportunity.read, opportunity.update, opportunity.delete
opportunity.export

# Activities & Tasks
activity.create, activity.read, activity.update, activity.delete
task.create, task.read, task.update, task.delete
task.assign

# Workflow
workflow.create, workflow.read, workflow.update, workflow.delete
workflow.execute, workflow.test

# Reports
report.create, report.read, report.update, report.delete
report.export, report.schedule

# Settings
settings.read, settings.update

# Audit
audit.read
audit.export
```

### 6.3 Default Role Templates

| Role | Permissions | Notes |
|------|-------------|-------|
| **Org Admin** | All permissions | Full access; manages roles, billing, settings |
| **Sales Manager** | All read + most write except: user.delete, role.manage, tenant.manage | Can view team data, manage pipeline, view reports |
| **Sales Rep** | Lead/contact/account CRUD, opportunity CRUD, activity CRUD, task CRUD, lead import | Own records only (unless shared) |
| **Read-Only** | All read permissions | Cannot create, update, or delete anything |
| **Integration** | Specific entity.create, entity.read, entity.update (no delete) | For API integrations |
| **Custom** | Configurable | User-defined |

---

## 7. Tenant Module

### 7.1 The Tenant Module's Purpose

The Tenant module is unique — it has almost no user-facing features. Its job is **infrastructure-level enforcement of multi-tenant isolation**. It ensures that:

1. Every tenant-scoped query goes through RLS
2. Every new table has RLS policies applied
3. Every Celery task runs in the correct tenant context
4. Tenant lifecycle actions (suspend, delete) actually isolate data
5. The Pool → Silo migration path is executable

### 7.2 Aggregates

#### Aggregate: Tenant (Infrastructure Representation)

```python
class Tenant(AggregateRoot):
    """
    Infrastructure representation of an organization.
    
    This is a system-level aggregate. Most users will never interact with it.
    It exists to manage RLS policies, tenant lifecycle, and the Pool→Silo migration.
    
    Invariants:
    - Every organization has exactly one Tenant record
    - Tenant status mirrors Organization status
    - Isolation model can be POOL or SILO
    - SILO tenants have a database_host and database_port
    """
    id: UUID
    organization_id: UUID
    status: TenantStatus                   # ACTIVE | SUSPENDED | DISABLED | DELETED
    isolation_model: IsolationModel        # POOL | SILO
    silo_config: SiloConfig | None         # Only for SILO tenants
    rls_policies_applied: bool
    provisioned_at: datetime
    suspended_at: datetime | None
    deleted_at: datetime | None
    
    # Behaviors
    def provision(self) -> list[DomainEvent]:
        """
        Provision tenant:
        1. Create RLS policies for all existing tenant-scoped tables
        2. Set rls_policies_applied = True
        Publishes TenantProvisioned.
        """
    
    def apply_rls_policies(self) -> None:
        """Apply (or re-apply) RLS policies for all tenant-scoped tables."""
    
    def suspend(self) -> list[DomainEvent]:
        """
        Suspend tenant:
        1. Set status = SUSPENDED
        2. All queries via middleware will now return 403
        Publishes TenantSuspended.
        """
    
    def reactivate(self) -> list[DomainEvent]:
        """Reactivate tenant. Publishes TenantReactivated."""
    
    def migrate_to_silo(self, db_config: SiloConfig) -> list[DomainEvent]:
        """
        Migrate from POOL to SILO:
        1. Create new database
        2. Copy all data
        3. Verify data integrity
        4. Update isolation_model and silo_config
        5. Update connection routing
        Publishes TenantMigratedToSilo.
        """
    
    def schedule_deletion(self, retention_days: int = 30) -> list[DomainEvent]:
        """
        Schedule tenant for deletion:
        1. Set status = DELETED
        2. Data is soft-deleted immediately (invisible to queries)
        3. Hard deletion scheduled after retention period
        Publishes TenantDeletionScheduled.
        """
    
    # Events
    # - TenantProvisioned(tenant_id, org_id, isolation_model, provisioned_at)
    # - TenantSuspended(tenant_id, org_id, reason, suspended_at)
    # - TenantReactivated(tenant_id, org_id, reactivated_at)
    # - TenantMigratedToSilo(tenant_id, org_id, new_db_host, migrated_at)
    # - TenantDeletionScheduled(tenant_id, org_id, scheduled_at, retention_until)
    # - TenantDeleted(tenant_id, org_id, deleted_at)
```

### 7.3 RLS Policy Engine

This is the core infrastructure component of the Tenant module.

#### Policy Generation Algorithm

```
For every Django model that inherits TenantScopedModel (has organization_id):
    1. Generate: CREATE POLICY tenant_isolation_{table_name}
       ON {table_name}
       FOR ALL
       USING (organization_id = current_setting('app.current_organization_id')::uuid);

    2. Generate: ALTER TABLE {table_name} ENABLE ROW LEVEL SECURITY;

    3. Generate: ALTER TABLE {table_name} FORCE ROW LEVEL SECURITY;
       (This ensures RLS applies to the table owner too — critical for Celery workers)

    4. If table exists in multiple partitions, apply to each partition
```

#### RLS Migration Management

```python
# apps/tenant/infrastructure/rls.py

class RLSPolicyManager:
    """Manages RLS policies for all tenant-scoped tables."""

    def __init__(self, connection: DatabaseConnection):
        self.connection = connection

    def discover_tenant_scoped_tables(self) -> list[str]:
        """Discover all tables whose models inherit TenantScopedModel."""
        # Reads app config, finds TenantScopedModel subclasses, returns table names

    def generate_policy_sql(self, table_name: str) -> str:
        """Generate RLS policy SQL for a table."""
        return f"""
        CREATE POLICY tenant_isolation_{table_name}
            ON {table_name}
            FOR ALL
            USING (organization_id = current_setting('app.current_organization_id')::uuid);
        
        ALTER TABLE {table_name} ENABLE ROW LEVEL SECURITY;
        ALTER TABLE {table_name} FORCE ROW LEVEL SECURITY;
        """

    def apply_all_policies(self) -> None:
        """Apply RLS policies to all tenant-scoped tables."""
        tables = self.discover_tenant_scoped_tables()
        for table in tables:
            sql = self.generate_policy_sql(table)
            self.connection.execute(sql)

    def verify_policies(self) -> list[VerificationResult]:
        """Verify that all tenant-scoped tables have RLS policies."""
        # Runs: SELECT tablename FROM pg_tables WHERE rowsecurity = true
        # Compares against expected list
```

### 7.4 Tenant Resolution Middleware

```python
# apps/tenant/infrastructure/middleware.py

class TenantResolutionMiddleware:
    """
    Middleware that:
    1. Extracts organization_id from authenticated JWT
    2. Validates user is a member of that organization
    3. Sets app.current_organization_id in PostgreSQL session
    4. Attaches tenant context to the request for Celery propagation
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # 1. If unauthenticated, skip (public endpoints only)
        if not request.user or not request.user.is_authenticated:
            return self.get_response(request)

        # 2. Extract org_id from JWT (or from header for API keys)
        org_id = self._resolve_tenant(request)

        # 3. Validate membership
        if org_id and not self._is_member(request.user.id, org_id):
            return JsonResponse({"error": "NOT_ORG_MEMBER"}, status=403)

        # 4. Check tenant status
        if org_id and self._is_tenant_suspended(org_id):
            return JsonResponse({"error": "ORG_SUSPENDED"}, status=403)

        # 5. Set PostgreSQL session variable
        if org_id:
            with connection.cursor() as cursor:
                cursor.execute(
                    "SET app.current_organization_id = %s",
                    [str(org_id)]
                )

        # 6. Attach to request for downstream use
        request.organization_id = org_id

        response = self.get_response(request)

        # 7. Clean up — reset to NULL to prevent cross-request leakage
        if org_id:
            with connection.cursor() as cursor:
                cursor.execute("SET app.current_organization_id = NULL")

        return response
```

### 7.5 Celery Tenant Propagation

```python
# apps/tenant/infrastructure/celery_middleware.py

import threading
from celery import Task

# Thread-local storage for tenant context
_tenant_local = threading.local()

def get_current_organization_id() -> UUID | None:
    """Get the current tenant's organization_id from thread-local storage."""
    return getattr(_tenant_local, 'organization_id', None)

def set_current_organization_id(org_id: UUID | None) -> None:
    """Set the current tenant's organization_id in thread-local storage."""
    _tenant_local.organization_id = org_id


class TenantAwareTask(Task):
    """
    Celery task base class that:
    1. Restores tenant context from the event envelope
    2. Sets app.current_organization_id in PostgreSQL session
    3. Verifies tenant is active before processing
    4. Cleans up after completion
    """

    abstract = True

    def __call__(self, *args, **kwargs):
        org_id = kwargs.pop('_organization_id', None)
        
        if org_id:
            # Restore tenant context
            set_current_organization_id(org_id)
            
            # Set session variable
            from django.db import connection
            with connection.cursor() as cursor:
                cursor.execute(
                    "SET app.current_organization_id = %s",
                    [str(org_id)]
                )
            
            # Verify tenant is active
            if self._is_tenant_suspended(org_id):
                raise TenantSuspendedError(f"Tenant {org_id} is suspended")

        try:
            return super().__call__(*args, **kwargs)
        finally:
            # Clean up
            set_current_organization_id(None)
            if org_id:
                from django.db import connection
                with connection.cursor() as cursor:
                    cursor.execute("SET app.current_organization_id = NULL")

    def _is_tenant_suspended(self, org_id: UUID) -> bool:
        """Check if tenant is suspended."""
        from apps.tenant.infrastructure.models import TenantModel
        return TenantModel.objects.filter(
            id=org_id, status='SUSPENDED'
        ).exists()
```

### 7.6 Event Enrichment

Every domain event published by any module must carry `organization_id`:

```python
# shared_kernel/domain/base.py

class DomainEvent:
    def __init__(self, **kwargs):
        self.event_id = uuid7()
        self.occurred_at = utcnow()
        self.organization_id = get_current_organization_id()  # From thread-local
        # ... other fields from subclasses
```

This ensures that:
1. Celery tasks can restore tenant context from the event
2. Audit log entries carry tenant information
3. Workflow engine evaluates conditions in the correct tenant context

---

## 8. Cross-Cutting Concerns

### 8.1 Repository Enforcement

Every module's repository base class must enforce tenant scoping:

```python
# apps/shared_kernel/infrastructure/repository.py

class TenantScopedRepository(Repository[T]):
    """Repository that automatically scopes all queries by organization_id."""

    def __init__(self, model_class: type[Model], organization_id: UUID | None = None):
        self.model_class = model_class
        self._org_id = organization_id or get_current_organization_id()

    def get_by_id(self, id: UUID) -> T | None:
        qs = self.model_class.objects.filter(id=id)
        if self._org_id:
            qs = qs.filter(organization_id=self._org_id)
        return qs.first()

    def save(self, entity: T) -> T:
        # Ensure entity carries current org_id
        if hasattr(entity, 'organization_id') and not entity.organization_id:
            entity.organization_id = self._org_id
        # ... ORM save logic

    def list(self, **filters) -> PaginatedResult[T]:
        qs = self.model_class.objects.filter(**filters)
        if self._org_id:
            qs = qs.filter(organization_id=self._org_id)
        # ... pagination logic
```

### 8.2 Cache Key Scoping

All cache keys must include `organization_id`:

```python
CACHE_KEY_PATTERNS = {
    "user_permissions": "v1:{org_id}:user:{user_id}:permissions",
    "role": "v1:{org_id}:role:{role_id}",
    "tenant_config": "v1:{org_id}:config",
    "org_settings": "v1:{org_id}:settings",
}
```

### 8.3 File Storage Isolation

Files in MinIO are stored under tenant-prefixed paths:

```
/media/{org_id}/{entity_type}/{entity_id}/{filename}
```

The `ai_gateway` and file-serving endpoints enforce that users can only access files within their own `org_id` prefix.

### 8.4 AI / Vector Store Isolation

The `pgvector` embedding table includes `organization_id` and has RLS policies applied just like any other tenant-scoped table. The AI Gateway receives `organization_id` in the JWT claims and includes it in all embedding and RAG queries.

---

## 9. API Reference

### 9.1 Identity Endpoints

| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| POST | `/api/v1/auth/register` | Public | Register new user |
| POST | `/api/v1/auth/verify-email` | Public | Verify email with token |
| POST | `/api/v1/auth/login` | Public | Login, returns JWT pair |
| POST | `/api/v1/auth/refresh` | Refresh Token | Refresh JWT pair |
| POST | `/api/v1/auth/logout` | Access Token | Revoke session |
| POST | `/api/v1/auth/forgot-password` | Public | Initiate password reset |
| POST | `/api/v1/auth/reset-password` | Public | Complete password reset |
| GET | `/api/v1/auth/me` | Access Token | Get current user profile |
| PATCH | `/api/v1/auth/me` | Access Token | Update profile |
| PATCH | `/api/v1/auth/me/password` | Access Token | Change password |
| GET | `/api/v1/auth/sessions` | Access Token | List active sessions |
| DELETE | `/api/v1/auth/sessions/{id}` | Access Token | Revoke specific session |
| DELETE | `/api/v1/auth/sessions` | Access Token | Revoke all sessions (except current) |
| GET | `/api/v1/users/` | Access Token + Admin | List users in organization |
| GET | `/api/v1/users/{id}` | Access Token | Get user details |
| PATCH | `/api/v1/users/{id}` | Access Token + Admin | Update user |
| DELETE | `/api/v1/users/{id}` | Access Token + Admin | Disable user |

### 9.2 Organization Endpoints

| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| POST | `/api/v1/orgs/` | Access Token | Create organization |
| GET | `/api/v1/orgs/` | Access Token | List user's organizations |
| GET | `/api/v1/orgs/{id}` | Access Token + Member | Get organization details |
| PATCH | `/api/v1/orgs/{id}` | Access Token + Admin | Update organization |
| DELETE | `/api/v1/orgs/{id}` | Access Token + Admin | Disable organization |
| GET | `/api/v1/orgs/{id}/settings` | Access Token + Admin | Get org settings |
| PUT | `/api/v1/orgs/{id}/settings` | Access Token + Admin | Update org settings |
| GET | `/api/v1/orgs/{id}/members` | Access Token + Admin | List members |
| POST | `/api/v1/orgs/{id}/members/invite` | Access Token + Admin | Invite user |
| POST | `/api/v1/orgs/{id}/members/accept` | Access Token | Accept invitation |
| DELETE | `/api/v1/orgs/{id}/members/{user_id}` | Access Token + Admin | Remove member |

### 9.3 RBAC Endpoints

| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| GET | `/api/v1/roles/` | Access Token | List roles in organization |
| POST | `/api/v1/roles/` | Access Token + Admin | Create role |
| GET | `/api/v1/roles/{id}` | Access Token | Get role details |
| PATCH | `/api/v1/roles/{id}` | Access Token + Admin | Update role |
| DELETE | `/api/v1/roles/{id}` | Access Token + Admin | Delete role (not system roles) |
| GET | `/api/v1/roles/{id}/assignments` | Access Token + Admin | List users assigned to role |
| POST | `/api/v1/roles/{id}/assignments` | Access Token + Admin | Assign role to user |
| DELETE | `/api/v1/roles/{id}/assignments/{user_id}` | Access Token + Admin | Remove role assignment |
| GET | `/api/v1/permissions/` | Access Token | List available permissions |
| GET | `/api/v1/users/{id}/permissions` | Access Token | Get user's effective permissions |

### 9.4 Tenant Endpoints (Admin Console Only)

| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| GET | `/api/v1/admin/tenants/` | System Admin | List all tenants |
| GET | `/api/v1/admin/tenants/{id}` | System Admin | Get tenant details |
| POST | `/api/v1/admin/tenants/{id}/suspend` | System Admin | Suspend tenant |
| POST | `/api/v1/admin/tenants/{id}/reactivate` | System Admin | Reactivate tenant |
| POST | `/api/v1/admin/tenants/{id}/delete` | System Admin | Schedule tenant deletion |
| POST | `/api/v1/admin/tenants/{id}/migrate-to-silo` | System Admin | Migrate to dedicated DB |
| POST | `/api/v1/admin/tenants/{id}/reapply-rls` | System Admin | Re-apply RLS policies |

### 9.5 Public Endpoints (No Auth)

| Method | URL | Rate Limit | Description |
|--------|-----|-----------|-------------|
| GET | `/api/v1/public/health` | 100/min | Health check |
| GET | `/api/v1/public/version` | 100/min | API version info |
| POST | `/api/v1/public/lead-form` | 10/min per IP | Public lead capture form |
| POST | `/api/v1/public/webhook/{provider}` | 100/min per IP | Inbound webhook receiver |

---

## 10. Database Schema

### 10.1 Identity Tables

```sql
-- users
CREATE TABLE identity_users (
    id UUID PRIMARY KEY DEFAULT uuid7(),
    email VARCHAR(320) NOT NULL UNIQUE,
    email_verified_at TIMESTAMPTZ,
    password_hash VARCHAR(256) NOT NULL,
    password_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    display_name VARCHAR(201) NOT NULL GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED,
    timezone VARCHAR(64) NOT NULL DEFAULT 'UTC',
    locale VARCHAR(10) NOT NULL DEFAULT 'en',
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING_VERIFICATION'
        CHECK (status IN ('PENDING_VERIFICATION', 'ACTIVE', 'LOCKED', 'DISABLED')),
    failed_login_attempts INT NOT NULL DEFAULT 0,
    last_login_at TIMESTAMPTZ,
    last_login_ip INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON identity_users(email);
CREATE INDEX idx_users_status ON identity_users(status);

-- sessions
CREATE TABLE identity_sessions (
    id UUID PRIMARY KEY DEFAULT uuid7(),
    user_id UUID NOT NULL REFERENCES identity_users(id) ON DELETE CASCADE,
    refresh_token_hash VARCHAR(256) NOT NULL,
    device_name VARCHAR(256),
    device_type VARCHAR(32),
    os VARCHAR(64),
    browser VARCHAR(64),
    ip_address INET NOT NULL,
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_user_id ON identity_sessions(user_id);
CREATE INDEX idx_sessions_expires ON identity_sessions(expires_at) WHERE revoked_at IS NULL;

-- password_history
CREATE TABLE identity_password_history (
    id UUID PRIMARY KEY DEFAULT uuid7(),
    user_id UUID NOT NULL REFERENCES identity_users(id) ON DELETE CASCADE,
    password_hash VARCHAR(256) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_password_history_user ON identity_password_history(user_id);

-- email_verification_tokens
CREATE TABLE identity_email_verification_tokens (
    id UUID PRIMARY KEY DEFAULT uuid7(),
    user_id UUID NOT NULL REFERENCES identity_users(id) ON DELETE CASCADE,
    token_hash VARCHAR(256) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_verification_tokens_user ON identity_email_verification_tokens(user_id);

-- password_reset_tokens
CREATE TABLE identity_password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT uuid7(),
    user_id UUID NOT NULL REFERENCES identity_users(id) ON DELETE CASCADE,
    token_hash VARCHAR(256) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reset_tokens_user ON identity_password_reset_tokens(user_id);
```

### 10.2 Organization Tables

```sql
-- organizations
CREATE TABLE organization_organizations (
    id UUID PRIMARY KEY DEFAULT uuid7(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(63) NOT NULL UNIQUE,
    status VARCHAR(32) NOT NULL DEFAULT 'TRIAL'
        CHECK (status IN ('TRIAL', 'ACTIVE', 'SUSPENDED', 'DISABLED')),
    tier VARCHAR(32) NOT NULL DEFAULT 'FREE'
        CHECK (tier IN ('FREE', 'GROWTH', 'ENTERPRISE')),
    features JSONB NOT NULL DEFAULT '[]',
    default_timezone VARCHAR(64) NOT NULL DEFAULT 'UTC',
    date_format VARCHAR(16) NOT NULL DEFAULT 'YYYY-MM-DD',
    number_format VARCHAR(4) NOT NULL DEFAULT 'en-US',
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    fiscal_year_start INT NOT NULL DEFAULT 1 CHECK (fiscal_year_start BETWEEN 1 AND 365),
    logo_url VARCHAR(1024),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_orgs_slug ON organization_organizations(slug);
CREATE INDEX idx_orgs_status ON organization_organizations(status);
CREATE INDEX idx_orgs_tier ON organization_organizations(tier);

-- memberships
CREATE TABLE organization_memberships (
    id UUID PRIMARY KEY DEFAULT uuid7(),
    user_id UUID NOT NULL REFERENCES identity_users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organization_organizations(id) ON DELETE CASCADE,
    status VARCHAR(32) NOT NULL DEFAULT 'INVITED'
        CHECK (status IN ('INVITED', 'ACTIVE', 'DISABLED')),
    invited_by UUID REFERENCES identity_users(id),
    invitation_accepted_at TIMESTAMPTZ,
    joined_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, organization_id)
);

CREATE INDEX idx_memberships_user ON organization_memberships(user_id);
CREATE INDEX idx_memberships_org ON organization_memberships(organization_id);
CREATE INDEX idx_memberships_status ON organization_memberships(status);
```

### 10.3 RBAC Tables

```sql
-- roles
CREATE TABLE rbac_roles (
    id UUID PRIMARY KEY DEFAULT uuid7(),
    organization_id UUID NOT NULL REFERENCES organization_organizations(id) ON DELETE CASCADE,
    name VARCHAR(128) NOT NULL,
    description VARCHAR(512),
    permissions JSONB NOT NULL DEFAULT '[]',
    is_system_role BOOLEAN NOT NULL DEFAULT FALSE,
    is_assignable BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(organization_id, name)
);

CREATE INDEX idx_roles_org ON rbac_roles(organization_id);

-- role_assignments
CREATE TABLE rbac_role_assignments (
    id UUID PRIMARY KEY DEFAULT uuid7(),
    user_id UUID NOT NULL REFERENCES identity_users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organization_organizations(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES rbac_roles(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES identity_users(id),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, organization_id, role_id)
);

CREATE INDEX idx_role_assignments_user ON rbac_role_assignments(user_id);
CREATE INDEX idx_role_assignments_org ON rbac_role_assignments(organization_id);
CREATE INDEX idx_role_assignments_role ON rbac_role_assignments(role_id);
```

### 10.4 Tenant Tables

```sql
-- tenants (infrastructure, not tenant-scoped — this is the tenant reference table)
CREATE TABLE tenant_tenants (
    id UUID PRIMARY KEY DEFAULT uuid7(),
    organization_id UUID NOT NULL REFERENCES organization_organizations(id) ON DELETE CASCADE,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'SUSPENDED', 'DISABLED', 'DELETED')),
    isolation_model VARCHAR(8) NOT NULL DEFAULT 'POOL'
        CHECK (isolation_model IN ('POOL', 'SILO')),
    silo_db_host VARCHAR(256),
    silo_db_port INT,
    silo_db_name VARCHAR(128),
    rls_policies_applied BOOLEAN NOT NULL DEFAULT FALSE,
    provisioned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    suspended_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    retention_until TIMESTAMPTZ,  -- For soft-deleted tenants
    UNIQUE(organization_id)
);

CREATE INDEX idx_tenants_org ON tenant_tenants(organization_id);
CREATE INDEX idx_tenants_status ON tenant_tenants(status);
CREATE INDEX idx_tenants_isolation ON tenant_tenants(isolation_model);
```

### 10.5 Tenant-Scoped Table Template

Every table that contains tenant data follows this template:

```sql
CREATE TABLE {module}_{entity} (
    id UUID PRIMARY KEY DEFAULT uuid7(),
    organization_id UUID NOT NULL REFERENCES organization_organizations(id) ON DELETE CASCADE,
    -- entity-specific columns
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_id UUID REFERENCES identity_users(id),
    updated_by_id UUID REFERENCES identity_users(id),
    deleted_at TIMESTAMPTZ
);

-- RLS (applied by Tenant module)
ALTER TABLE {module}_{entity} ENABLE ROW LEVEL SECURITY;
ALTER TABLE {module}_{entity} FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_{module}_{entity}
    ON {module}_{entity}
    FOR ALL
    USING (organization_id = current_setting('app.current_organization_id')::uuid);
```

---

## 11. Workflows & State Machines

### 11.1 User Status Lifecycle

```
                    ┌──────────────────┐
                    │  PENDING_VERIFY  │
                    └────────┬─────────┘
                             │ email verified
                             ▼
                    ┌──────────────────┐
        ┌──────────│     ACTIVE       │◄──────────┐
        │          └────────┬─────────┘           │
        │                   │                     │
        │  N failed         │ admin action        │  reactivate
        │  logins           │                     │
        ▼                   ▼                     │
┌──────────────┐   ┌──────────────────┐          │
│   LOCKED     │   │    DISABLED      ├──────────┘
└──────────────┘   └──────────────────┘
     │                    │
     └────────────────────┘
     admin unlocks → ACTIVE
```

### 11.2 Organization Status Lifecycle

```
         ┌──────────────────┐
         │      TRIAL       │
         └────────┬─────────┘
                  │
                  │ trial ends / upgrade
                  ▼
         ┌──────────────────┐
 ┌───────│     ACTIVE       │◄──────────┐
 │       └────────┬─────────┘           │
 │                │                     │
 │  payment       │ admin /             │  admin
 │  failure       │ policy violation    │  action
 │                │                     │
 ▼                ▼                     │
┌──────────┐  ┌──────────────────┐      │
│ SUSPENDED├──►  REACTIVATE      ├──────┘
└──────────┘  └──────────────────┘
     │
     │ 30 days → DISABLED
     ▼
┌──────────┐
│ DISABLED │
└──────────┘
     │
     │ retention period → hard delete
     ▼
┌──────────┐
│  DELETED │
└──────────┘
```

### 11.3 Membership Invitation Flow

```
User A (Admin)                              User B (Invited)
     │                                           │
     │ POST /orgs/{id}/members/invite            │
     │──────────────────────────────────────────►│ (send email with accept link)
     │                                           │
     │                                           │ POST /orgs/{id}/members/accept
     │                                           │◄───────────────────────────── (click link)
     │                                           │
     │                                           │ JWT contains org_id claim
     │                                           │
     │                                           │ Role assigned (default: Sales Rep)
     │                                           │
     │              MembershipActivated event     │
     │◄──────────────────────────────────────────│
```

### 11.4 Tenant Suspension Flow

```
Admin Request                         Tenant Module
     │                                     │
     │ POST /admin/tenants/{id}/suspend    │
     │────────────────────────────────────►│
     │                                     │
     │  1. Set TenantStatus = SUSPENDED    │
     │  2. Publish TenantSuspended event   │
     │  3. Celery tasks for this org       │
     │     are rejected at start (check    │
     │     in TenantAwareTask.__call__)    │
     │  4. All API requests return 403     │
     │     (via TenantResolutionMiddleware) │
     │  5. Active WebSocket connections    │
     │     are disconnected                │
     │  6. Scheduled tasks for this org    │
     │     are skipped                     │
     │                                     │
     │◄────────────────────────────────────│ success
```

---

## 12. Security Architecture

### 12.1 JWT Implementation

```python
# Access Token
{
    "sub": "user_uuid",
    "org": "organization_uuid",
    "scp": ["lead.read", "lead.write"],  # rare — only for integration tokens
    "typ": "access",
    "exp": 1700000000,      # 15 minutes
    "iat": 1699999100,
    "jti": "unique_id",     # stored in Redis until expiry for revocation
    "sid": "session_uuid"   # links to session for refresh tracking
}

# Refresh Token
{
    "sub": "user_uuid",
    "typ": "refresh",
    "exp": 1700600000,      # 7 days
    "iat": 1699999100,
    "jti": "unique_id",
    "sid": "session_uuid"
}
```

**Signing:** RS256 (asymmetric RSA key pair). Private key in Vault/Secrets Manager. Public key exposed via `GET /api/v1/auth/.well-known/jwks.json` for third-party verification.

**Revocation:** `jti` stored in Redis with TTL matching token expiry. On logout/revoke, `jti` is added to a deny list. Middleware checks deny list before accepting token.

### 12.2 Password Policy

| Rule | Value | Rationale |
|------|-------|-----------|
| Minimum length | 12 characters | NIST SP 800-63B recommendation |
| Maximum length | 128 characters | Prevents hash DoS |
| Complexity | 3 of 4: uppercase, lowercase, digit, special | Common enterprise requirement |
| History | 5 passwords | Prevents password reuse |
| Max age | 90 days | Enterprise compliance |
| Failed attempts | 5 within 15 minutes → lock | Brute force protection |
| Lock duration | 15 minutes (auto-unlock) or admin unlock | Balance security + usability |

### 12.3 Rate Limiting (Identity Endpoints)

| Endpoint | Rate Limit | Rationale |
|----------|-----------|-----------|
| `POST /auth/login` | 5/min per IP + 5/min per email | Brute force prevention |
| `POST /auth/register` | 3/min per IP | Bot registration prevention |
| `POST /auth/forgot-password` | 3/min per email | Email flood prevention |
| `POST /auth/refresh` | 10/min per user | Token abuse prevention |
| `POST /auth/verify-email` | 10/min per IP | Generic rate limit |

### 12.4 Tenant Isolation Guarantee

```
┌─────────────────────────────────────────────────────────────────┐
│  Layer 1: Authentication (JWT verification)                     │
│    Ensures user is who they claim to be                         │
├─────────────────────────────────────────────────────────────────┤
│  Layer 2: Tenant Resolution Middleware                          │
│    Validates user is member of claimed organization             │
│    Sets app.current_organization_id in PostgreSQL session       │
├─────────────────────────────────────────────────────────────────┤
│  Layer 3: Repository Enforced Scoping                           │
│    Repository.list() automatically adds organization_id filter  │
│    Repository.save() automatically sets organization_id         │
├─────────────────────────────────────────────────────────────────┤
│  Layer 4: PostgreSQL Row-Level Security                         │
│    SELECT/INSERT/UPDATE/DELETE restricted to organization_id    │
│    FORCE RLS prevents table owner bypass                        │
├─────────────────────────────────────────────────────────────────┤
│  Layer 5: Celery Task Tenant Propagation                       │
│    TenantAwareTask restores org context before processing        │
│    Rejects tasks for suspended/disabled tenants                 │
├─────────────────────────────────────────────────────────────────┤
│  Layer 6: Automated Test Suite                                  │
│    Every CI run validates 100% isolation across 50+ endpoints   │
│    Cross-tenant data access attempt = test failure              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 13. Testing Strategy

### 13.1 Unit Tests (Domain Layer)

| Test Class | Tests | Example |
|-----------|-------|---------|
| `UserTest` | Registration, email verification, login, password change, locking | `test_user_register_publishes_event()` |
| `SessionTest` | Token rotation, expiry, revocation | `test_rotate_token_invalidates_old()` |
| `OrganizationTest` | Provision, suspend, reactivate, disable | `test_cannot_suspend_already_suspended()` |
| `RoleTest` | Add/remove permissions, rename, system role immutability | `test_system_role_cannot_be_deleted()` |
| `PermissionTest` | Permission format validation | `test_permission_format_entity_dot_action()` |
| `TenantTest` | Provision RLS, migrate to silo, schedule deletion | `test_migrate_to_silo_updates_isolation_model()` |

**Coverage target:** 100% of domain public methods, 100% of value object validation rules, 100% of state transitions.

### 13.2 Integration Tests (Application Layer)

| Test Class | Tests | Example |
|-----------|-------|---------|
| `RegisterUserServiceTest` | Happy path, duplicate email, weak password | `test_register_with_existing_email_returns_conflict()` |
| `LoginUserServiceTest` | Valid credentials, locked account, wrong password | `test_login_locked_account_returns_failure()` |
| `InviteUserServiceTest` | Invite existing user, invite non-existent user | `test_invite_sends_email_with_accept_link()` |
| `AssignRoleServiceTest` | Assign, unassign, last admin removal prevention | `test_cannot_remove_last_admin_role()` |
| `TenantProvisionServiceTest` | Provision applies RLS, provision with suspended tenant | `test_provision_creates_rls_policies()` |

### 13.3 Tenant Isolation Tests (Critical)

```python
# apps/tenant/tests/test_isolation.py

class TenantIsolationTest(TestCase):
    """
    CRITICAL TEST SUITE.
    
    These tests MUST pass before any deployment.
    A failure here is a cross-tenant data leak — P0 incident.
    """
    
    def setUp(self):
        self.org_a = OrganizationFactory()
        self.org_b = OrganizationFactory()
        self.user_a = UserFactory(organization=self.org_a)
        self.user_b = UserFactory(organization=self.org_b)
        
        # Create test data for Org A
        with tenant_context(self.org_a.id):
            self.lead_a = LeadFactory(organization=self.org_a)
            self.contact_a = ContactFactory(organization=self.org_a)
            self.opp_a = OpportunityFactory(organization=self.org_a)
        
        # Create test data for Org B
        with tenant_context(self.org_b.id):
            self.lead_b = LeadFactory(organization=self.org_b)
            self.contact_b = ContactFactory(organization=self.org_b)
            self.opp_b = OpportunityFactory(organization=self.org_b)
    
    def test_org_a_cannot_read_org_b_leads(self):
        """User from Org A cannot list leads from Org B."""
        leads_in_org_a = LeadRepository(organization_id=self.org_a.id).list()
        lead_ids_in_org_a = {l.id for l in leads_in_org_a}
        self.assertNotIn(self.lead_b.id, lead_ids_in_org_a,
            "Org A can see Org B's lead — RLS failure!")
    
    def test_org_a_cannot_read_org_b_leads_via_api(self):
        """API endpoint enforces tenant isolation for leads."""
        self.client.force_login(self.user_a)
        response = self.client.get(f'/api/v1/leads/{self.lead_b.id}/')
        self.assertEqual(response.status_code, 404, 
            "Org A can read Org B's lead via API — isolation failure!")
    
    def test_cross_tenant_leads_are_invisible(self):
        """No API endpoint exposes cross-tenant data."""
        endpoints = [
            ('GET', '/api/v1/leads/'),
            ('GET', '/api/v1/contacts/'),
            ('GET', '/api/v1/opportunities/'),
            ('GET', '/api/v1/accounts/'),
            ('GET', '/api/v1/tasks/'),
            ('GET', '/api/v1/activities/'),
        ]
        for method, url in endpoints:
            response = self._make_request(method, url, self.user_a)
            results = response.json()['data']
            org_b_ids = self._get_org_b_ids(url)
            for result in results:
                self.assertNotIn(result['id'], org_b_ids,
                    f"{url}: cross-tenant data leak! Org A sees Org B's data.")
    
    def test_celery_task_respects_tenant_isolation(self):
        """Celery task processing event for Org A cannot access Org B data."""
        with tenant_context(self.org_a.id):
            # Simulate a Celery task processing an event
            result = process_lead_created_event(self.lead_a.id)
            self.assertTrue(result.is_success)
            
            # Ensure task cannot see Org B's data
            with self.assertRaises(PermissionError):
                process_lead_created_event(self.lead_b.id)
    
    def test_rls_bypass_via_raw_sql_fails(self):
        """Direct SQL without tenant context should fail."""
        from django.db import connection
        with connection.cursor() as cursor:
            cursor.execute("SET app.current_organization_id = NULL")
            with self.assertRaises(Exception):
                cursor.execute("SELECT * FROM lead_management_leads LIMIT 1")
    
    def test_suspended_tenant_returns_403(self):
        """API requests for suspended tenants return 403."""
        self.org_a.status = 'SUSPENDED'
        self.org_a.save()
        self.client.force_login(self.user_a)
        response = self.client.get('/api/v1/leads/')
        self.assertEqual(response.status_code, 403)
```

### 13.4 Security Tests

| Test | Description |
|------|-------------|
| `test_jwt_with_invalid_signature_rejected` | Modified JWT rejected |
| `test_expired_jwt_rejected` | Past-expiry token rejected |
| `test_refresh_token_rotation` | Old refresh token invalid after use |
| `test_password_history_prevents_reuse` | Last 5 passwords cannot be reused |
| `test_rate_limiting_blocks_brute_force` | 6th login attempt in 15 min blocked |
| `test_cannot_register_with_existing_email` | Duplicate email rejected |
| `test_session_revocation` | Revoked token cannot refresh |
| `test_org_invitation_expiry` | Expired invitation token rejected |
| `test_system_role_cannot_be_deleted` | Admin role deletion returns error |
| `test_last_admin_cannot_be_demoted` | Cannot remove last Admin role assignment |

### 13.5 Performance Tests

| Test | Target | Description |
|------|--------|-------------|
| `test_login_latency` | < 200ms p95 | Login + JWT generation |
| `test_permission_resolution` | < 50ms p95 | Resolve permissions for user with 3 roles |
| `test_rls_policy_overhead` | < 5ms per query | RLS policy evaluation overhead |
| `test_tenant_provisioning` | < 5s for 50 tables | Provision tenant with RLS for all tables |
| `test_isolation_test_suite` | < 60s | Entire isolation test suite (10k+ assertions) |

---

## 14. Failure Scenarios & Mitigations

### 14.1 RLS Policy Missing on New Table

**Scenario:** Developer creates a new model that inherits `TenantScopedModel` but forgets to create an RLS migration. The table exists without RLS, meaning any query returns data from all tenants.

**Detection:**
- Migration linter in CI: scans all new migration files; if a new table inherits `TenantScopedModel`, verifies companion RLS migration exists
- Weekly scheduled job (`check_missing_rls_policies`) queries `pg_tables` and compares against expected policy list
- Alert if any tenant-scoped table lacks RLS

**Recovery:**
```bash
python manage_tzahu apply_rls --dry-run  # Show what's missing
python manage_tzahu apply_rls             # Apply missing policies
```

### 14.2 Tenant Context Lost in Async Path

**Scenario:** A Celery task is scheduled without `organization_id`. When it runs, `app.current_organization_id` is NULL, so RLS blocks all queries. The task fails with an opaque error.

**Prevention:**
- Event envelope always includes `organization_id` (enforced by `DomainEvent.__init__`)
- `TenantAwareTask.__call__` raises clear error if `organization_id` is missing
- Structured logging includes `org_id` field; monitoring alerts if > 1% of tasks have missing tenant context

### 14.3 Middleware Bypass on Public Endpoints

**Scenario:** A developer creates a new public endpoint (no auth required) that accidentally exposes tenant data.

**Prevention:**
- Public endpoints are explicitly registered in a `PUBLIC_URLS` whitelist
- `TenantResolutionMiddleware` only skips tenant resolution for these exact URL patterns
- All other endpoints return `403` if tenant context cannot be resolved
- Test: "Every public endpoint returns minimal, non-tenant data"

### 14.4 Database Connection Leak Across Tenants

**Scenario:** PostgreSQL connection pooling in Pgbouncer reuses a connection that had `app.current_organization_id` set from a previous request. The next request on that connection inherits the wrong tenant context.

**Prevention:**
- `TenantResolutionMiddleware` explicitly resets `app.current_organization_id = NULL` in the `__call__` finally block
- Pgbouncer configured in transaction mode (not session mode) — connection is reset after each transaction
- Defense in depth: RLS is still enforced — even if the session variable leaks, the user's JWT scopes prevent cross-tenant access at the application layer

### 14.5 Bulk Operation Bypasses Repository

**Scenario:** A bulk update or import operation uses `Model.objects.bulk_create()` or raw SQL, bypassing the tenant-scoped repository.

**Prevention:**
- All bulk operations go through a `BulkRepository` that automatically injects `organization_id`
- Raw SQL is prohibited in application code (enforced by linter)
- Even if an operation bypasses the repository, RLS at the database level is the final guard

### 14.6 Tenant Suspension Race Condition

**Scenario:** While a tenant is being suspended, an in-flight request or Celery task is still processing. The data modification completes even though the tenant should be read-only.

**Mitigation:**
- Tenant suspension first sets `status = SUSPENDED` in the DB (committed immediately)
- RLS policy is updated to block writes for suspended tenants (in addition to the middleware check)
- In-flight transactions complete (they started before suspension); no new transactions are allowed
- Any data modified during the suspension window is flagged for review by the audit log

### 14.7 Silo Migration Data Integrity Failure

**Scenario:** During a Pool → Silo migration, some data is not copied, or referential integrity is broken.

**Mitigation:**
- Migration uses `pg_dump` + `pg_restore` with `--data-only`
- Pre-migration verification: count rows in every table, checksum sample
- Post-migration verification: compare row counts, checksums, and foreign key integrity
- Rollback plan: switch DNS/connection routing back to original Pool database
- Migration is performed under a maintenance window; application is read-only during migration

---

## 15. Future Enhancements

| Enhancement | Phase | Description |
|------------|-------|-------------|
| **Field-Level Permissions** | Phase 11 | Restrict access to specific fields (e.g., "budget" field visible to managers only) |
| **Role Hierarchy** | Phase 11 | Manager role inherits permissions of all subordinate roles |
| **Organization Hierarchy** | Phase 11 | Parent/child organizations (e.g., HQ + regional offices) |
| **SCIM Provisioning** | Phase 11 | Automatic user provisioning/deprovisioning via SCIM 2.0 |
| **SAML SSO** | Phase 11 | Enterprise single sign-on with SAML 2.0 / OIDC |
| **MFA Enforcement Policy** | Phase 11 | Org-level policy requiring MFA for all users or specific roles |
| **Session Policies** | Phase 11 | Per-org session timeout, concurrent session limits, IP allowlisting |
| **Audit-Driven Anomaly Detection** | Phase 11 | Detect unusual login patterns, permission changes, data access bursts |
| **Just-In-Time Access** | Phase 11 | Temporary elevated privileges with approval workflow |
| **Separate Identity Provider** | Phase 11 | Support for external IdP (Okta, Azure AD) as the identity source of truth |
| **Geo-Fencing** | Phase 11 | Restrict access to specific geographic regions |
| **Device Trust** | Phase 11 | Require device compliance (MDM) for access |

---

> **This blueprint defines the foundation of the TZAHU CRM platform.**
> The Identity & Multi-Tenancy modules are the most security-critical components
> in the entire system. Every other module depends on them for authentication,
> authorization, and data isolation. A defect here is a defect everywhere.
> 
> **Build with caution. Test with paranoia. Deploy with confidence.**
