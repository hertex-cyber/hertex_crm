# TZAHU CRM — Functional Requirements

> **Version:** 1.0.0
> **Last Updated:** 2026-07-27
> **Status:** Final
> **Owner:** Product Management

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Shared Kernel](#2-shared-kernel)
3. [Identity](#3-identity)
4. [Authentication](#4-authentication)
5. [Organization](#5-organization)
6. [Tenant](#6-tenant)
7. [RBAC](#7-rbac)
8. [Users, Teams, Departments](#8-users-teams-departments)
9. [Settings](#9-settings)
10. [Dashboard](#10-dashboard)
11. [Accounts](#11-accounts)
12. [Contacts](#12-contacts)
13. [Leads](#13-leads)
14. [Lead Assignment](#14-lead-assignment)
15. [Lead Scoring](#15-lead-scoring)
16. [Opportunity](#16-opportunity)
17. [Pipeline](#17-pipeline)
18. [Activities](#18-activities)
19. [Tasks](#19-tasks)
20. [Calendar & Meetings](#20-calendar--meetings)
21. [Products & Price Books](#21-products--price-books)
22. [Quotes, Orders, Invoices, Contracts, Payments](#22-quotes-orders-invoices-contracts-payments)
23. [Support Tickets & Knowledge Base](#23-support-tickets--knowledge-base)
24. [Campaigns & Marketing Automation](#24-campaigns--marketing-automation)
25. [Workflow Engine](#25-workflow-engine)
26. [Approval Engine](#26-approval-engine)
27. [Notification Center](#27-notification-center)
28. [Email, WhatsApp, SMS](#28-email-whatsapp-sms)
29. [Document & File Management](#29-document--file-management)
30. [Global Search & Semantic Search](#30-global-search--semantic-search)
31. [Reports & Analytics](#31-reports--analytics)
32. [Custom Fields & Custom Modules](#32-custom-fields--custom-modules)
33. [Audit](#33-audit)
34. [AI Assistant & AI Prompt Management](#34-ai-assistant--ai-prompt-management)
35. [AI Memory, RAG & Vector Search](#35-ai-memory-rag--vector-search)
36. [Voice AI](#36-voice-ai)
37. [Integration Hub](#37-integration-hub)
38. [Billing & Subscription](#38-billing--subscription)
39. [Feature Flags](#39-feature-flags)
40. [API Keys, Webhook Management & Developer Portal](#40-api-keys-webhook-management--developer-portal)
41. [Marketplace](#41-marketplace)

---

## 1. Introduction

This document defines the detailed functional requirements for every module in TZAHU CRM. Each module includes features with descriptions, user stories, inputs/outputs, validation rules, and required permissions.

**Conventions:**
- Permission format: `{entity}.{action}` — e.g., `lead.create`
- Priority: P0 (must-have for R1), P1 (R2), P2 (R3), P3 (R4)
- Module names match `backend/apps/{module_name}/` directory structure

---

## 2. Shared Kernel

### Description
Cross-cutting primitives used by every module. Zero Django imports. Pure Python domain constructs.

### Features

| Feature | Description | Priority |
|---------|-------------|----------|
| SK-01 | **ValueObject** base class — immutable, value-based equality, validation on init | P0 |
| SK-02 | **Entity** base class — identity-based equality, mutable | P0 |
| SK-03 | **AggregateRoot** base class — entity with domain event collection | P0 |
| SK-04 | **DomainEvent** base class — event_id (UUID v7), occurred_at, organization_id | P0 |
| SK-05 | **Result[T, E]** type — success/failure with typed error, chaining | P0 |
| SK-06 | **PaginatedResult[T]** — data + pagination metadata | P0 |
| SK-07 | **Repository[T]** port — abstract interface for data access | P0 |
| SK-08 | **EventPublisher** port — abstract interface for event publishing | P0 |
| SK-09 | **Value Objects:** Email, PhoneNumber, Address, PersonName, Money, Currency, Percentage, TimeZone, URL, Slug | P0 |
| SK-10 | **DomainError** hierarchy — NotFoundError, ValidationError, ConflictError, UnauthorizedError, ForbiddenError | P0 |
| SK-11 | **UUID7 utility** — time-ordered UUID generation | P0 |

### Validation Rules

| VO | Validation | Error |
|----|-----------|-------|
| Email | Regex: `^[^@]+@[^@]+\.[^@]+$`; max 320 chars | InvalidEmailError |
| PhoneNumber | E.164 format: `+<country><number>`; 8–15 digits | InvalidPhoneError |
| Money | Amount > 0; currency valid ISO 4217 | InvalidAmountError |
| Slug | 3–63 chars; lowercase alphanumeric + hyphens | InvalidSlugError |

---

## 3. Identity

### Description
User identity management — registration, profiles, password management.

### Features

| Feature | Description | User Story | Input | Output | Permissions |
|---------|-------------|------------|-------|--------|-------------|
| ID-01 | User Registration | As a visitor, I want to register with email + password | email, password, firstName, lastName | UserRegistered event, verification email sent | Public |
| ID-02 | Email Verification | As a user, I want to verify my email with a token | userId, token | EmailVerified event, user activated | Public |
| ID-03 | User Profile CRUD | As a user, I want to view/edit my profile | Profile fields | ProfileUpdated event | user.read, user.update |
| ID-04 | Password Change | As a user, I want to change my password | oldPassword, newPassword | PasswordChanged event | user.update |
| ID-05 | Forgot Password | As a user, I want to reset my password via email | email | Password reset email | Public |
| ID-06 | Reset Password | As a user, I want to complete password reset | token, newPassword | PasswordChanged event | Public |
| ID-07 | User Preferences | As a user, I want to set timezone, locale, notification prefs | preferences map | PreferencesUpdated | user.update |

### Validation Rules

| Field | Rule | Error |
|-------|------|-------|
| email | Unique across all orgs; valid format | EmailAlreadyExistsError, InvalidEmailError |
| password | Min 12 chars, 3/4 complexity (upper, lower, digit, special) | WeakPasswordError |
| password history | Cannot reuse last 5 passwords | PasswordReuseError |
| display_name | 1–100 chars | InvalidNameError |

---

## 4. Authentication

### Description
JWT-based authentication with refresh token rotation, session management, optional MFA.

### Features

| Feature | Description | User Story | Input | Output | Permissions |
|---------|-------------|------------|-------|--------|-------------|
| AUTH-01 | Login | As a user, I want to log in with email + password | email, password, deviceInfo | AccessToken + RefreshToken | Public |
| AUTH-02 | Token Refresh | As a user, I want to refresh my access token | refreshToken | New AccessToken + rotated RefreshToken | Public (with valid refresh) |
| AUTH-03 | Logout | As a user, I want to log out | refreshToken (optional) | SessionRevoked | user.auth |
| AUTH-04 | Session List | As a user, I want to see my active sessions | none | List of Session objects | user.read |
| AUTH-05 | Session Revoke | As a user, I want to revoke a specific session | sessionId | SessionRevoked | user.auth |
| AUTH-06 | Session Revoke All | As a user, I want to revoke all sessions | none (excludes current) | SessionsRevoked | user.auth |
| AUTH-07 | MFA Enable | As a user, I want to enable TOTP MFA | totpCode | MFAEnabled | user.update |
| AUTH-08 | MFA Verify | As a user, I want to verify MFA code during login | totpCode | AccessToken | Public |
| AUTH-09 | MFA Disable | As a user, I want to disable MFA | password, totpCode | MFADisabled | user.update |

### Validation Rules

| Rule | Implementation |
|------|---------------|
| Login rate limit | 5 attempts per 15 minutes per IP + per email |
| Token expiry | Access: 15 min; Refresh: 7 days |
| Refresh rotation | Old refresh token invalidated when new one issued |
| Session limit | Max 50 sessions per user |
| MFA backup codes | 10 codes generated on enable; each usable once |

---

## 5. Organization

### Description
Organization (tenant) profile, settings, subscription tier management.

### Features

| Feature | Description | User Story | Input | Output | Permissions |
|---------|-------------|------------|-------|--------|-------------|
| ORG-01 | Organization Create | As a user, I want to create an org | name, slug | OrganizationProvisioned | user.auth |
| ORG-02 | Organization Read | As a user, I want to see org details | orgId | Organization | organization.read |
| ORG-03 | Organization Update | As an admin, I want to update org settings | orgId, fields | OrganizationUpdated | organization.update |
| ORG-04 | Organization Delete | As an admin, I want to delete/disable org | orgId | OrganizationDisabled | organization.delete |
| ORG-05 | Member Invite | As an admin, I want to invite a user | orgId, email, roleId | UserInvited | user.invite |
| ORG-06 | Member Accept | As a user, I want to accept invitation | orgId, token | MembershipActivated | user.auth |
| ORG-07 | Member List | As an admin, I want to list members | orgId | PaginatedResult[Membership] | organization.read |
| ORG-08 | Member Remove | As an admin, I want to remove a member | orgId, userId | MembershipDisabled | organization.update |

### Validation Rules

| Rule | Enforcement |
|------|-------------|
| Org name uniqueness | Unique across platform (case-insensitive) |
| Slug uniqueness | Unique across platform; 3–63 chars |
| Last admin removal | Cannot remove last ADMIN role assignment |
| Invitation expiry | 7 days; expired token rejected |

---

## 6. Tenant

### Description
Infrastructure-level tenant management — RLS policies, isolation model, lifecycle.

### Features

| Feature | Description | User Story | Input | Output | Permissions |
|---------|-------------|------------|-------|--------|-------------|
| TEN-01 | Tenant Provision | System: auto-provision on org creation | orgId | TenantProvisioned | System |
| TEN-02 | RLS Apply | System: apply RLS policies to all tenant tables | tenantId | PoliciesApplied | System |
| TEN-03 | Tenant Suspend | As a system admin, I want to suspend a tenant | tenantId | TenantSuspended | tenant.suspend |
| TEN-04 | Tenant Reactivate | As a system admin, I want to reactivate a tenant | tenantId | TenantReactivated | tenant.update |
| TEN-05 | Tenant Delete | As a system admin, I want to schedule tenant deletion | tenantId, retentionDays | TenantDeletionScheduled | tenant.delete |
| TEN-06 | Silo Migrate | As a system admin, I want to migrate tenant to dedicated DB | tenantId, dbConfig | TenantMigratedToSilo | tenant.update |

### Validation Rules

| Rule | Enforcement |
|------|-------------|
| Tenant status | TRIAL → ACTIVE → SUSPENDED → DISABLED → DELETED |
| Suspended tenant | All API requests return 403; Celery tasks rejected |
| Deletion retention | 30 days default; configurable per compliance need |
| Silo migration | Requires maintenance window; data integrity verified post-migration |

---

## 7. RBAC

### Description
Role-based access control — role definitions, permission assignment, role-resolution engine.

### Features

| Feature | Description | User Story | Input | Output | Permissions |
|---------|-------------|------------|-------|--------|-------------|
| RBAC-01 | Role Create | As an admin, I want to create a role | name, permissions, orgId | RoleCreated | role.create |
| RBAC-02 | Role Read | As a user, I want to see role details | roleId | Role | role.read |
| RBAC-03 | Role Update | As an admin, I want to update a role | roleId, fields | RoleUpdated | role.update |
| RBAC-04 | Role Delete | As an admin, I want to delete a role (not system) | roleId | RoleDeleted | role.delete |
| RBAC-05 | Permission List | As a user, I want to see available permissions | orgId | List of Permission | role.read |
| RBAC-06 | Role Assignment | As an admin, I want to assign role to user | userId, roleId, orgId | RoleAssigned | role.assign |
| RBAC-07 | Role Unassignment | As an admin, I want to remove role from user | assignmentId | RoleUnassigned | role.unassign |
| RBAC-08 | Permission Check | System: check user permissions on API request | user, action | boolean | System |

### Validation Rules

| Rule | Enforcement |
|------|-------------|
| System roles | Admin, Read-only are system roles; cannot be deleted or renamed |
| Role name | Unique within an org; 2–128 chars |
| Permission format | `{entity}.{action}` — validated against catalog |
| Additive permissions | Permissions are union of all assigned roles (no deny in Phase 1) |

---

## 8. Users, Teams, Departments

### Description
User directory, team groupings, department hierarchies within an organization.

### Features

| Feature | Description | User Story | Permissions |
|---------|-------------|------------|-------------|
| USR-01 | User Directory | As a user, I want to see all org members | organization.read |
| USR-02 | User Profile (admin) | As an admin, I want to edit any user's profile | user.update |
| USR-03 | Disable User | As an admin, I want to disable a user | user.delete |
| USR-04 | Create Team | As an admin, I want to create a sales team | role.create |
| USR-05 | Team Membership | As an admin, I want to add users to teams | role.assign |
| USR-06 | Create Department | As an admin, I want to create org departments | role.create |
| USR-07 | Department Hierarchy | As an admin, I want to set department structure | role.update |

### Validation Rules

| Rule | Enforcement |
|------|-------------|
| Team name | Unique within org |
| Department parent | Cannot create circular hierarchy |
| Team lead | User must be member of the team |

---

## 9. Settings

### Description
Organization-level and user-level settings configuration.

### Features

| Feature | Description | Permissions |
|---------|-------------|-------------|
| SET-01 | Org General Settings | Timezone, date/number format, currency, fiscal year | settings.update |
| SET-02 | Org Security Settings | Password policy, session timeout, MFA enforcement | settings.update |
| SET-03 | Org Feature Settings | Enable/disable features per plan | settings.update |
| SET-04 | Org Email Settings | SMTP config, sending name/address, DKIM | settings.update |
| SET-05 | User Preferences | Theme, locale, notification preferences, timezone | user.update |

---

## 10. Dashboard

### Description
User home screen with customizable widgets and KPIs.

### Features

| Feature | Description | Permissions |
|---------|-------------|-------------|
| DSH-01 | Default Dashboard | Pre-built dashboard: pipeline summary, tasks, recent activity | dashboard.read |
| DSH-02 | Custom Dashboard | Create custom dashboard with widgets | dashboard.create |
| DSH-03 | Widget Library | Available widgets: pipeline chart, KPI, activity feed, forecast | dashboard.read |
| DSH-04 | Dashboard Sharing | Share dashboard with team/org | dashboard.update |
| DSH-05 | Dashboard Auto-Refresh | Auto-refresh widgets on configurable interval | dashboard.read |

---

## 11. Accounts

### Description
Account/company management with hierarchy and territory.

### Features

| Feature | Description | User Story | Input | Output | Permissions |
|---------|-------------|------------|-------|--------|-------------|
| ACC-01 | Account CRUD | As a user, I want to manage accounts | Account fields | Account CRUD events | account.* |
| ACC-02 | Account Hierarchy | As a user, I want to set parent/child accounts | parentId | HierarchyUpdated | account.update |
| ACC-03 | Territory Assignment | As an admin, I want to assign territory | territoryId | TerritoryAssigned | account.update |
| ACC-04 | Account Team | As a user, I want to add team members to account | userId, role | TeamMemberAdded | account.update |
| ACC-05 | Account Merge | As a user, I want to merge duplicate accounts | sourceId, targetId | AccountMerged | account.update |

### Validation Rules

- Account name required
- Email/domain uniqueness (configurable)
- Hierarchy max depth: 5 levels
- Merge is reversible for 7 days

---

## 12. Contacts

### Description
Individual contact management with communication preferences and GDPR compliance.

### Features

| Feature | Description | User Story | Permissions |
|---------|-------------|------------|-------------|
| CON-01 | Contact CRUD | As a user, I want to manage contacts | contact.* |
| CON-02 | Contact Merge | As a user, I want to merge duplicates | contact.update |
| CON-03 | GDPR Export | As a contact, I want to export my data | Public (contact token) |
| CON-04 | GDPR Forget | As a contact, I want to be forgotten | Public (contact token) |
| CON-05 | Communication Preferences | As a contact, I want to set email/SMS opt-in/opt-out | Public (contact token) |
| CON-06 | Consent Tracking | As an admin, I want to track consent (purpose, date, source) | contact.read |
| CON-07 | Bulk Contact Operations | As a user, I want to bulk update/delete/export contacts | contact.* |

### Validation Rules

- Email or phone required
- Email unique within org (configurable)
- GDPR forget: anonymizes all PII, preserves relationships
- Consent: must record purpose, timestamp, source

---

## 13. Leads

### Description
Lead management with status lifecycle, source tracking, and conversion.

### Features

| Feature | Description | User Story | Input | Output | Permissions |
|---------|-------------|------------|-------|--------|-------------|
| LEA-01 | Lead CRUD | As a user, I want to manage leads | Lead fields | Lead CRUD events | lead.* |
| LEA-02 | Lead Status Transition | As a user, I want to change lead status | status, reason | Lead status events | lead.update |
| LEA-03 | Lead Conversion | As a user, I want to convert lead to contact/account/opportunity | convertConfig | LeadConverted | lead.convert |
| LEA-04 | Lead Import | As a user, I want to import leads from CSV | file, options | ImportCompleted | lead.import |
| LEA-05 | Lead Dedup | As a user, I want deduplication on create/import | leadData | MatchFound or Created | lead.create |
| LEA-06 | Lead Source Tracking | As a user, I want to track lead source | source | sourceTracked | lead.create |
| LEA-07 | Lead Assignment | As a user, I want to assign/reassign leads | userId, leadId | LeadAssigned | lead.assign |
| LEA-08 | Lead Export | As a user, I want to export leads | format, filters | ExportCompleted | lead.export |

### Lead Status Lifecycle

```
New → Contacted → Qualified → Converted (terminal)
                  → Disqualified (terminal)
                  → Recycled (back to New)
```

### Validation Rules

- Lead conversion: creates Contact + Account (if company provided) + Opportunity (optional)
- Duplicate detection on email, phone, or name+company match
- Required fields: first name, last name, email or phone
- Source is required on create

---

## 14. Lead Assignment

### Description
Automatic and manual lead assignment to users/teams with distribution rules.

### Features

| Feature | Description | Permissions |
|---------|-------------|-------------|
| LAS-01 | Manual Assignment | Assign lead to specific user | lead.assign |
| LAS-02 | Round-Robin Assignment | Distribute leads evenly across team | lead.assign |
| LAS-03 | Load-Balanced Assignment | Assign to user with fewest open leads | lead.assign |
| LAS-04 | Territory-Based Assignment | Assign based on lead location → territory → user | lead.assign |
| LAS-05 | Assignment Rules Config | Configure rules: priority, fallback, exclusion | lead.assign |

### Validation Rules

- User must be active member of org
- Assignment rule applies on create (after workflow evaluation)
- Manual override always available
- Round-robin resets on team membership change

---

## 15. Lead Scoring

### Description
ML-based and rules-based lead scoring.

### Features

| Feature | Description | Permissions |
|---------|-------------|-------------|
| LSC-01 | ML Scoring | AI-based score based on demographic + behavioral signals | lead.read |
| LSC-02 | Rules-Based Scoring | Configurable score based on field values | lead.update |
| LSC-03 | Score Factors Display | Show which factors contributed to score | lead.read |
| LSC-04 | Score Recalculation | Auto-recalculate on field update or schedule | lead.update |
| LSC-05 | Score-Based Actions | Trigger workflow based on score thresholds | workflow.execute |

### Validation Rules

- Score range: 0–100
- Score calculation < 500ms
- Explainable: top 3 factors shown with contribution %

---

## 16. Opportunity

### Description
Deal/opportunity management with amounts, products, competitors, and team selling.

### Features

| Feature | Description | User Story | Permissions |
|---------|-------------|------------|-------------|
| OPP-01 | Opportunity CRUD | As a user, I want to manage opportunities | opportunity.* |
| OPP-02 | Stage Transitions | As a user, I want to move opportunity through stages | opportunity.update |
| OPP-03 | Product Association | As a user, I want to add products to opportunity | opportunity.update |
| OPP-04 | Team Selling | As a user, I want to add team members to deal | opportunity.update |
| OPP-05 | Competitive Tracking | As a user, I want to track competitors | opportunity.update |
| OPP-06 | Win/Loss Reasons | As a user, I want to record win/loss reason | opportunity.update |
| OPP-07 | Forecast Category | As a user, I want to set forecast category (Pipeline/Best Case/Commit) | opportunity.update |
| OPP-08 | Opportunity Export | As a user, I want to export opportunities | opportunity.export |

### Validation Rules

- Amount > 0
- Close date in future (warning, not error)
- Win/loss reason required on terminal stages
- Stage transitions follow pipeline rules (skip, retrograde)
- Forecast category "Commit" requires probability > 50%

---

## 17. Pipeline

### Description
Configurable sales pipeline — stages, probabilities, default pipelines.

### Features

| Feature | Description | Permissions |
|---------|-------------|-------------|
| PIP-01 | Pipeline CRUD | Create/edit/delete pipelines | pipeline.* |
| PIP-02 | Stage Management | Add/reorder/remove stages | pipeline.update |
| PIP-03 | Stage Configuration | Name, probability, rules (skip, required fields) | pipeline.update |
| PIP-04 | Default Pipeline | Set default pipeline for org/team/user | pipeline.update |
| PIP-05 | Forecast Rollup | Aggregated forecast by pipeline | pipeline.read |

### Validation Rules

- Pipeline must have at least 3 stages
- Stage names unique within pipeline
- First stage = default entry stage
- Last stage = "Closed Won" or "Closed Lost"
- Probability range: 0–100%

---

## 18. Activities

### Description
Polymorphic activity logging — calls, emails, meetings, notes.

### Features

| Feature | Description | User Story | Permissions |
|---------|-------------|------------|-------------|
| ACT-01 | Log Call | Log outbound/inbound call with duration, outcome | activity.create |
| ACT-02 | Log Email | Log sent/received email with subject, body | activity.create |
| ACT-03 | Log Meeting | Log meeting with attendees, notes, outcome | activity.create |
| ACT-04 | Add Note | Add note to any entity | activity.create |
| ACT-05 | Activity Timeline | Chronological view per entity | activity.read |
| ACT-06 | Activity Filtering | Filter by type, date range, user | activity.read |
| ACT-07 | Activity Export | Export activity history | activity.export |

### Validation Rules

- Duration: 0–1440 minutes (max 24h)
- At least one linked entity (lead, contact, account, opportunity)
- Meeting requires at least one attendee
- Note minimum length: 1 character

---

## 19. Tasks

### Description
Task management with assignments, due dates, priorities, and statuses.

### Features

| Feature | Description | User Story | Permissions |
|---------|-------------|------------|-------------|
| TSK-01 | Task CRUD | As a user, I want to create/read/update/delete tasks | task.* |
| TSK-02 | Task Assignment | As a user, I want to assign tasks | task.assign |
| TSK-03 | Task Status Updates | As a user, I want to update task status | task.update |
| TSK-04 | Task Dashboard | As a user, I want to see My Tasks, Overdue, Today | task.read |
| TSK-05 | Task Reminders | As a user, I want reminders before due date | task.update |
| TSK-06 | Task Dependencies | As a user, I want to link tasks as blocking/blocked | task.update |

### Validation Rules

| Field | Rule |
|-------|------|
| title | Required, 1–500 chars |
| due_date | Must be in future (warning if past) |
| priority | LOW, MEDIUM, HIGH, URGENT |
| status | NOT_STARTED, IN_PROGRESS, COMPLETED, CANCELLED |
| assignee | Must be active org member |

---

## 20. Calendar & Meetings

### Description
Calendar integration (Google, Outlook) and meeting scheduling.

### Features

| Feature | Description | Permissions |
|---------|-------------|-------------|
| CAL-01 | Calendar Sync (Read) | Read events from Google/Outlook calendar | calendar.read |
| CAL-02 | Calendar Sync (Write) | Create CRM events in external calendar | calendar.update |
| CAL-03 | Meeting Creation | Create meeting from CRM; auto-log activity | calendar.create |
| CAL-04 | Availability Sharing | Share available time slots via link | calendar.read |
| CAL-05 | Conflict Detection | Detect overlapping meetings | calendar.read |
| CAL-06 | OAuth Flow | OAuth 2.0 for Google/Microsoft calendar access | calendar.update |

### Validation Rules

- OAuth tokens encrypted at rest
- Meeting duration: 15–480 minutes
- Attendees notified via email

---

## 21. Products & Price Books

### Description
Product catalog and price book management.

### Features

| Feature | Description | Permissions |
|---------|-------------|-------------|
| PRD-01 | Product CRUD | Create/edit/delete products | product.* |
| PRD-02 | Product Categories | Categorize products | product.update |
| PRD-03 | Price Book CRUD | Create price books with product pricing | pricebook.* |
| PRD-04 | Standard vs Custom Price | Default list price + per-customer pricing | pricebook.update |

### Validation Rules

- Product name required; SKU optional but unique per org
- Price > 0
- Currency required

---

## 22. Quotes, Orders, Invoices, Contracts, Payments

### Description
Quote-to-cash pipeline — proposals, orders, billing documents.

### Features

| Module | Features | Permissions |
|--------|----------|-------------|
| **Quotes** | CRUD, template-based generation, approval workflow, send to customer, versioning | quote.* |
| **Orders** | CRUD, quote conversion, fulfillment tracking | order.* |
| **Invoices** | CRUD, payment tracking, credit notes, dunning | invoice.* |
| **Contracts** | CRUD, renewal tracking, auto-renewal, terms | contract.* |
| **Payments** | Record payment, Stripe integration, receipt generation | payment.* |

### Validation Rules

- Quote: line items required; total calculation; discount max 100%
- Order: must reference quote or products; delivery date tracking
- Invoice: payment terms (NET 15/30/60); overdue detection
- Contract: start < end date; renewal reminder N days before expiry

---

## 23. Support Tickets & Knowledge Base

### Description
Customer support case management and self-service knowledge base.

### Features

| Module | Features | Permissions |
|--------|----------|-------------|
| **Tickets** | CRUD, status lifecycle, assignment, priority, SLA tracking, customer portal | ticket.* |
| **Knowledge Base** | Article CRUD, categories, search, publish/draft, versioning, feedback | kb.* |

### Ticket Status Lifecycle

```
New → Assigned → In Progress → Waiting on Customer → Resolved → Closed
                                                                    → Reopened
```

### Validation Rules

- Ticket: subject required; priority set on create; SLA based on priority
- KB: at least one category; published articles reviewed; rich text body

---

## 24. Campaigns & Marketing Automation

### Description
Marketing campaign management and automation.

### Features

| Module | Features | Permissions |
|--------|----------|-------------|
| **Campaigns** | CRUD, type (Email, Event, Webinar, Ad), target list, budget, ROI tracking | campaign.* |
| **Marketing Automation** | Email sequences, drip campaigns, lead nurturing, A/B testing | marketing.* |

### Validation Rules

- Campaign name required; type required
- Target audience via saved list or segment query
- Unsubscribe link required in marketing emails
- CAN-SPAM compliance: opt-in required

---

## 25. Workflow Engine

### Description
Visual workflow automation — triggers, conditions, actions.

### Features

| Feature | Description | Permissions |
|---------|-------------|-------------|
| WFE-01 | Visual Workflow Builder | Drag-and-drop node-based workflow editor | workflow.create |
| WFE-02 | Event Triggers | Lead created, opportunity stage changed, cron schedule | workflow.create |
| WFE-03 | Condition Nodes | Field comparison, date math, AND/OR trees, sub-queries | workflow.create |
| WFE-04 | Action Nodes | Update field, assign, notify, webhook, create task, API call | workflow.create |
| WFE-05 | AI Decision Node | LLM-based decision (classify, score, route) | workflow.create |
| WFE-06 | Loop Prevention | Max depth 10; cycle detection | System |
| WFE-07 | Workflow Testing | Test-run without side effects | workflow.test |
| WFE-08 | Workflow Templates | Pre-built templates library | workflow.create |
| WFE-09 | Workflow Audit | Every execution logged | audit.read |

### Validation Rules

- Trigger required; at least one action
- Condition references valid fields
- No infinite loop (cycle detection)
- Max 50 workflows per org (configurable)
- Execution timeout: 30s

---

## 26. Approval Engine

### Description
Multi-step approval workflows for deals, discounts, quotes, etc.

### Features

| Feature | Description | Permissions |
|---------|-------------|-------------|
| APV-01 | Approval Request | Submit entity for approval | approval.create |
| APV-02 | Approval Chain | Sequential or parallel approvers | approval.update |
| APV-03 | Approve/Reject | Approver decision with comment | approval.update |
| APV-04 | Escalation | Auto-escalate after timeout | approval.update |
| APV-05 | Approval Rules | Condition-based: amount > $100K → VP approval | approval.update |

### Validation Rules

- Approver must not be the requester (configurable)
- Escalation timeout: configurable per step (default 24h)
- Rejection reason required

---

## 27. Notification Center

### Description
Central notification hub — in-app, digest, preferences.

### Features

| Feature | Description | Permissions |
|---------|-------------|-------------|
| NTC-01 | In-App Notifications | Real-time via WebSocket; persistent history | notification.read |
| NTC-02 | Notification List | List with read/unread, filtering, pagination | notification.read |
| NTC-03 | Mark Read | Mark single or all as read | notification.update |
| NTC-04 | Notification Preferences | Per-channel opt-in/out, quiet hours, digest | notification.update |
| NTC-05 | Email Digest | Daily/weekly digest of unread notifications | notification.update |

### Validation Rules

- Max 500 notifications stored per user (older auto-archived)
- Digest frequency: never, daily, weekly
- Quiet hours: notifications suppressed but stored

---

## 28. Email, WhatsApp, SMS

### Description
Multi-channel messaging capabilities.

### Features

| Module | Features | Permissions |
|--------|----------|-------------|
| **Email** | Send via SendGrid/SES, template rendering, attachments, tracking, bounce handling | notification.update |
| **SMS** | Twilio integration, opt-out, delivery status | notification.update |
| **WhatsApp** | WhatsApp Business API, template messages, opt-in | notification.update |

### Validation Rules

- Email: valid recipient; attachment max 25MB; rate limited
- SMS: opt-out list checked before send; max 1600 chars (10 segments)
- WhatsApp: opt-in required; template pre-approved by Meta

---

## 29. Unified Inbox (Social Inbox)

### Description
Multi-channel messaging inbox that connects WhatsApp, Instagram DM, and Facebook Messenger through a single Meta Business Account. Agents read and reply to all messages in one place without switching platforms. A live chat widget for the website also feeds into the same inbox.

### Features

| Feature | Description | Permissions |
|---------|-------------|-------------|
| UIB-01 | Meta Account Connection | Connect Meta Business Account via OAuth; auto-discovers connected WhatsApp, Instagram, Facebook pages | conversations.manage |
| UIB-02 | Unified Conversation List | All messages from WhatsApp, Instagram DM, Facebook Messenger in a single inbox; filter by channel | conversations.read |
| UIB-03 | Conversation View | Thread view with message history, timestamps, sender info, channel badge | conversations.read |
| UIB-04 | Reply & Send | Reply to any message from the CRM; supports text, images, files per channel capabilities | conversations.reply |
| UIB-05 | Assign Conversation | Assign conversation to a team member for follow-up | conversations.assign |
| UIB-06 | Close / Reopen | Mark conversation as resolved; reopen if customer replies | conversations.update |
| UIB-07 | Contact Auto-Linking | Automatically link conversation sender to existing contact/lead in CRM; create new contact if not found | conversations.read |
| UIB-08 | Conversation Notes | Internal notes visible only to the team, not sent to customer | conversations.update |
| UIB-09 | Channel Badge | Visual indicator showing which platform a message came from (WhatsApp, Instagram, Messenger) | conversations.read |
| UIB-10 | Unread Count | Unread message count per conversation and per channel | conversations.read |
| UIB-11 | Search Conversations | Search across all conversations by contact name, message content, channel | conversations.read |
| UIB-12 | Live Chat Widget | Embeddable JavaScript widget for website; messages appear in unified inbox; visitor info captured | conversations.manage |
| UIB-13 | Auto-Reply / Away Message | Set automated replies for after-hours or when an agent is unavailable | conversations.update |
| UIB-14 | Conversation Tags | Tag conversations for categorization (support, sales, billing) | conversations.update |
| UIB-15 | Response Time SLA | Track and display time to first response per conversation; alert on SLA breach | conversations.read |
| UIB-16 | Canned Responses | Pre-saved message templates for quick replies | conversations.update |

### Validation Rules

- Meta Business Account connection requires Admin role
- Each channel (WhatsApp, Instagram, Messenger) must be individually connected after Meta login
- Reply length limits per channel: WhatsApp 4096 chars, Instagram 2000 chars, Messenger 2000 chars
- File attachments: images up to 10MB, supported formats per channel
- Conversation auto-closes after 7 days of inactivity (configurable)
- Live chat widget can be styled with org brand colors
- Rate limits per Meta API: WhatsApp 80 msg/sec, Instagram/Messenger based on page tier

### Integration Points

- WhatsApp: WhatsApp Cloud API (Meta)
- Instagram DM: Instagram Messaging API (Meta Graph API)
- Facebook Messenger: Messenger Platform (Meta Graph API)
- All three connected through a single Meta Business Account with one OAuth flow
- Conversations create/update linked contacts in the CRM
- Activities logged on contact timeline for each message sent/received

---

### Description
Document generation, file storage, versioning.

### Features

| Module | Features | Permissions |
|--------|----------|-------------|
| **Documents** | Template-based generation (PDF/Word), merge fields, version history | document.* |
| **Files** | Upload, download, preview, organize in folders, versioning, MinIO storage | file.* |

### Validation Rules

- Max file size per plan: Growth 25MB, Pro 100MB, Enterprise 500MB
- Storage quota per org: configurable by plan
- Supported preview: images, PDF, text, Office docs (via conversion)

---

## 30. Global Search & Semantic Search

### Description
Unified search across all entities with full-text and semantic capabilities.

### Features

| Feature | Description | Permissions |
|---------|-------------|-------------|
| SRH-01 | Global Search | Search across all entities from single search bar | search.read |
| SRH-02 | Full-Text Search | PostgreSQL GIN-indexed full-text with ranking | search.read |
| SRH-03 | Semantic Search | pgvector cosine similarity on entity embeddings | search.read |
| SRH-04 | Hybrid Search | Weighted combination of FTS + semantic (0.7 semantic / 0.3 keyword) | search.read |
| SRH-05 | Faceted Filters | Filter results by entity type, date, owner | search.read |
| SRH-06 | Search Suggestions | Auto-complete as user types | search.read |

### Validation Rules

- Search scope: all entities user has permission to read
- Results: max 100 per query; pagination for more
- Search timeout: < 500ms
- Tenant-scoped: results limited to user's org

---

## 31. Reports & Analytics

### Description
Configurable report builder, dashboards, and analytics.

### Features

| Feature | Description | Permissions |
|---------|-------------|-------------|
| RPT-01 | Report Builder | Dimensions, measures, filters, sorting, grouping, charts | report.create |
| RPT-02 | Data Sources | Register reportable models + field metadata | report.create |
| RPT-03 | Pre-built Reports | Pipeline by stage, lead by source, activity by type, win rate | report.read |
| RPT-04 | Report Execution | Sync (fast) + async (large dataset) execution | report.read |
| RPT-05 | Report Export | CSV, PDF, XLSX; async for large datasets | report.export |
| RPT-06 | Report Scheduling | Schedule on cron; deliver via email/Slack | report.schedule |
| RPT-07 | Dashboards | Grid of widgets (chart, KPI, table); sharing; auto-refresh | dashboard.* |
| RPT-08 | Sales Forecasting | Weighted forecast, commit vs forecast, trend | report.read |
| RPT-09 | Usage Analytics | Feature adoption, user activity, login frequency | report.read |

### Validation Rules

- Report execution timeout: 30s sync, 300s async
- Max data export: 500k rows per export
- Dashboard widgets: max 10 per dashboard
- Scheduled reports: max 20 per org (configurable)

---

## 32. Custom Fields & Custom Modules

### Description
Dynamic field and entity definitions — build your own data model.

### Features

| Module | Features | Permissions |
|--------|----------|-------------|
| **Custom Fields** | Add field to existing entities; types: text, number, date, picklist, lookup, checkbox, formula | custom_fields.* |
| **Custom Modules** | Define new entity types; fields, relationships, views, permissions | custom_modules.* |

### Field Types

| Type | Properties | Validation |
|------|-----------|------------|
| Text | maxLength, defaultValue | Length check |
| Number | min, max, precision, currency | Range check |
| Date/DateTime | min, max | Date range |
| Picklist (Single) | options [], defaultValue | Must be in list |
| Picklist (Multi) | options [] | Must be subset |
| Lookup | targetModule, targetField | Reference exists |
| Checkbox | defaultValue | Boolean |
| Formula | expression, returnType | Syntax validation |
| Email | none | Format validation |
| Phone | none | Format validation |
| URL | none | Format validation |

### Custom Module Rules

- Module name: PascalCase, unique within org
- Max fields per module: 100 (configurable)
- Built-in fields: id, organization_id, created_at, updated_at, created_by, owner
- Custom modules support custom fields, relationships, search, permissions, audit

---

## 33. Audit

### Description
Event-sourced audit log — immutable record of all data changes.

### Features

| Feature | Description | Permissions |
|---------|-------------|-------------|
| AUD-01 | Event Capture | Every domain event recorded: actor, action, entity, changes, timestamp | System |
| AUD-02 | Audit Query | Search audit by user, entity, action, date range | audit.read |
| AUD-03 | Audit Export | Export audit log to CSV/JSON | audit.export |
| AUD-04 | Retention Policy | Configurable retention period; auto-purge with legal hold | audit.update |
| AUD-05 | Immutability | Audit entries immutable after 5 min (write-once-read-many) | System |

### Validation Rules

- All CREATE, UPDATE, DELETE operations audited
- READ operations audited only for sensitive entities (configurable)
- Retention: default 1 year; enterprise configurable up to 7 years
- Legal hold overrides retention purge

---

## 34. AI Assistant & AI Prompt Management

### Description
AI-powered conversational assistant and prompt template management.

### Features

| Feature | Description | Permissions |
|---------|-------------|-------------|
| AIA-01 | AI Chat | Natural language query; returns data or performs actions | ai.read |
| AIA-02 | Context-Aware Answers | Answers based on user's current screen + permissions | ai.read |
| AIA-03 | Action Execution | "Create a follow-up task for this lead" → executes | ai.execute |
| AIA-04 | Prompt Template CRUD | Create/version prompts; A/B testing | ai.update |
| AIA-05 | Prompt Registry | List/activate/deactivate prompt templates | ai.update |
| AIA-06 | AI Response Audit | All AI interactions logged: prompt, response, tokens, latency | audit.read |

### Validation Rules

- AI responses tagged "AI-generated" where appropriate
- User confirms before AI executes write actions
- Token budget per org per month
- Prompt versions immutable once used

---

## 35. AI Memory, RAG & Vector Search

### Description
Long-term AI memory, retrieval-augmented generation, and vector storage.

### Features

| Feature | Description | Permissions |
|---------|-------------|-------------|
| AIM-01 | Entity Embedding | Auto-embed entities on create/update; batch re-embedding | System |
| AIM-02 | Document RAG | Upload → chunk → embed → index → Q&A over org docs | ai.read |
| AIM-03 | AI Memory | Conversation history stored; context maintained across sessions | ai.read |
| AIM-04 | Hybrid Vector Search | pgvector + FTS hybrid with weighted ranking | search.read |
| AIM-05 | Re-ranking | Cross-encoder re-ranker on top-20 results | search.read |

### Technical Details

| Component | Choice |
|-----------|--------|
| Embedding model | text-embedding-3-small (1536 dim) |
| Chunk strategy | RecursiveCharacterTextSplitter, 512 tokens, 128 overlap |
| Vector index | IVFFlat with 100 lists |
| Hybrid weighting | 0.7 semantic + 0.3 keyword |
| Re-ranker | BAAI/bge-reranker-v2-m3 |

---

## 36. Voice AI

### Description
Call logging, transcription, analysis, and AI coaching.

### Features

| Feature | Description | Permissions |
|---------|-------------|-------------|
| VAI-01 | Call Logging | Log inbound/outbound calls; link to entity | voice.create |
| VAI-02 | Call Recording | Record calls; secure storage; playback | voice.read |
| VAI-03 | Real-Time Transcription | WebSocket → ASR → text stream during call | voice.read |
| VAI-04 | Post-Call Analysis | Sentiment, talk ratio, objection detection, action items | voice.read |
| VAI-05 | AI Coaching | Real-time whisper suggestions; post-call scorecard | voice.read |

### Validation Rules

- Call recording consent: two-party consent detection
- Recording retention: hot 30 days, warm 1 year, cold archive
- Transcription: latency < 1s for real-time
- ASR provider: Deepgram (primary) or Whisper (fallback)

---

## 37. Integration Hub

### Description
Third-party integration framework — connectors, OAuth, sync.

### Features

| Feature | Description | Permissions |
|---------|-------------|-------------|
| INT-01 | Connector SDK | Python SDK; auth (OAuth, API Key, Basic), sync, webhook | integration.create |
| INT-02 | OAuth Management | OAuth flow; encrypted token storage; auto-refresh | integration.update |
| INT-03 | Sync Engine | Bidirectional incremental sync; conflict resolution | integration.update |
| INT-04 | Built-in Connectors | Google, Microsoft, Mailchimp, HubSpot (import), Slack, Zoom | integration.* |
| INT-05 | Custom Connectors | User-defined via SDK | integration.create |

### Connector Lifecycle

```
Disconnected → Connected → Syncing → Synced → Error
```

### Validation Rules

- OAuth tokens encrypted AES-256-GCM
- Sync interval: 5 min minimum; adaptive rate limiting
- Conflict resolution: source wins, target wins, manual

---

## 38. Billing & Subscription

### Description
Subscription management, usage metering, invoicing via Stripe.

### Features

| Feature | Description | Permissions |
|---------|-------------|-------------|
| BIL-01 | Plan Management | Define plans; features, limits, pricing | billing.update |
| BIL-02 | Subscription CRUD | Create/change/cancel subscription | billing.update |
| BIL-03 | Usage Metering | Track API calls, storage, users; bill overage | billing.read |
| BIL-04 | Invoice Generation | Auto-generate invoices; Stripe sync | billing.read |
| BIL-05 | Payment Processing | Stripe integration; cards, ACH, wire | billing.update |

### Validation Rules

- Plan downgrade: data preserved but features disabled
- Cancellation: end of billing period; data retained 30 days
- Overage: configurable threshold; notification before charge

---

## 39. Feature Flags

### Description
Per-tenant feature enable/disable with gradual rollout.

### Features

| Feature | Description | Permissions |
|---------|-------------|-------------|
| FFL-01 | Feature Definition | Register feature with dependencies | System |
| FFL-02 | Per-Tenant Enable | Enable/disable feature for specific org | feature_flags.update |
| FFL-03 | Gradual Rollout | Percentage-based rollout; A/B testing | feature_flags.update |
| FFL-04 | Kill Switch | Immediate disable for all orgs | feature_flags.update |
| FFL-05 | Feature Audit | Log of feature enable/disable events | audit.read |

### Features Catalog

| Feature | Phase | Default | Dependencies |
|---------|-------|---------|-------------|
| workflow_engine | R1 | Growth+ | identity |
| ai_assistant | R3 | Pro+ | ai_gateway |
| voice_ai | R3 | Enterprise | ai_assistant |
| custom_objects | R4 | Enterprise | custom_fields |
| saml_sso | R4 | Enterprise | identity |
| marketplace | R4 | Enterprise | integration_hub |

---

## 40. API Keys, Webhook Management & Developer Portal

### Description
Developer tools — API keys, webhook delivery, developer documentation.

### Features

| Module | Features | Permissions |
|--------|----------|-------------|
| **API Keys** | Generate/revoke key; scope to permissions; rate limit; usage tracking | api_keys.* |
| **Webhooks** | Subscribe to events; retry with backoff; HMAC signing; delivery logs | webhooks.* |
| **Developer Portal** | API reference; interactive playground; SDK download; app registration | developer_portal.* |

### Validation Rules

- API key format: `tzahu_` prefix + 32 char alphanumeric
- Key permissions: subset of user's permissions
- Webhook retry: 3 attempts (1s, 4s, 16s) → dead letter
- Webhook HMAC: SHA-256; secret per webhook

---

## 41. Marketplace

### Description
App marketplace for third-party integrations and extensions.

### Features

| Feature | Description | Permissions |
|---------|-------------|-------------|
| MKT-01 | App Listing | Browse available apps; details, pricing, reviews | marketplace.read |
| MKT-02 | App Install | Install app; grant permissions; configure | marketplace.install |
| MKT-03 | App Uninstall | Uninstall; revoke permissions; cleanup | marketplace.uninstall |
| MKT-04 | App Developer | Submit app for review; update; analytics | marketplace.developer |

### Validation Rules

- App permissions scoped; user must approve
- App review required before listing
- Security scan required for each version

---

> **This document defines every feature TZAHU CRM must deliver.**
> Each feature maps to at least one business requirement in `02_BusinessRequirements.md`.
> Features are prioritized P0–P3 and phased across R1–R4 per `05_ProductRoadmap.md`.
