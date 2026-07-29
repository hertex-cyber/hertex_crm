# TZAHU CRM — Business Requirements

> **Version:** 1.0.0
> **Last Updated:** 2026-07-27
> **Status:** Final
> **Owner:** Product Management

---

## Table of Contents

1. [Business Capabilities Overview](#1-business-capabilities-overview)
2. [Identity & Authentication](#2-identity--authentication)
3. [Organization & Tenancy](#3-organization--tenancy)
4. [CRM Core (Leads, Contacts, Accounts)](#4-crm-core-leads-contacts-accounts)
5. [Sales Pipeline & Opportunity](#5-sales-pipeline--opportunity)
6. [Activities & Tasks](#6-activities--tasks)
7. [Workflow Automation](#7-workflow-automation)
8. [AI & Intelligence](#8-ai--intelligence)
9. [Communication & Notifications](#9-communication--notifications)
10. [Reporting & Analytics](#10-reporting--analytics)
11. [Integration & Extensibility](#11-integration--extensibility)
12. [Administration & Governance](#12-administration--governance)
13. [Stakeholder Personas](#13-stakeholder-personas)
14. [Business Rules](#14-business-rules)
15. [Compliance & Regulatory](#15-compliance--regulatory)

---

## 1. Business Capabilities Overview

### Capability Map by Domain

| Domain | Capabilities | Priority | R1 | R2 | R3 | R4 |
|--------|-------------|----------|----|----|----|----|
| **Identity & Auth** | Registration, login, MFA, SSO, password management, session management | P0–P1 | ✓ | | ✓ | ✓ |
| **Organization & Tenancy** | Org creation, member management, tenant lifecycle, tier management | P0 | ✓ | | | ✓ |
| **CRM Core** | Lead/contact/account CRUD, dedup, import, merge, conversion, lifecycle | P0 | ✓ | | | |
| **Sales Pipeline** | Pipeline config, opportunity mgmt, stage transitions, forecasting | P0 | ✓ | | | |
| **Activities & Tasks** | Activity logging, task management, calendar sync, email sync | P0–P1 | ✓ | ✓ | | |
| **Workflow Automation** | Visual workflow builder, condition engine, action engine, approval flows | P0–P1 | ✓ | ✓ | | |
| **AI & Intelligence** | Semantic search, lead scoring, next-best-action, RAG, AI assistant | P1–P2 | | | ✓ | |
| **Communication** | Email, SMS, in-app notifications, push, WhatsApp, Slack/Teams | P0–P1 | ✓ | ✓ | | |
| **Reporting & Analytics** | Report builder, dashboards, forecasting, scheduled reports | P1 | | ✓ | | |
| **Integration** | REST API, webhooks, connector SDK, OAuth management, sync engine | P1–P2 | | ✓ | | ✓ |
| **Administration** | RBAC, audit log, custom fields, feature flags, billing, marketplace | P0–P2 | ✓ | ✓ | | ✓ |

---

## 2. Identity & Authentication

### Capabilities

| # | Capability | Priority | Description | Acceptance Criteria |
|---|-----------|----------|-------------|---------------------|
| IAM-01 | User Registration | P0 | Users register with email + password; email verification before first login | User registers → verification email sent → email verified → user can log in |
| IAM-02 | User Authentication | P0 | Login with email + password; JWT issuance; refresh token rotation | Login returns access (15min) + refresh (7d) tokens; refresh rotates old token |
| IAM-03 | Password Management | P0 | Password policy enforcement; forgot/reset password; password history | Password min 12 chars, 3/4 complexity; history prevents reuse of last 5 |
| IAM-04 | User Profile | P0 | Name, avatar, timezone, language preferences, notification preferences | User can view/edit profile; changes reflect immediately |
| IAM-05 | Session Management | P0 | List active sessions; revoke individual or all sessions | User sees all active devices; can revoke sessions; revoked sessions cannot refresh |
| IAM-06 | Multi-Factor Authentication | P1 | TOTP-based MFA; backup codes; recovery flow | User enables MFA → QR code → scan → verify → MFA required on login |
| IAM-07 | Enterprise SSO | P2 | SAML 2.0 / OIDC integration; JIT provisioning | Login via Okta → JIT user → role mapped → access granted |
| IAM-08 | SCIM Provisioning | P3 | Automatic user provisioning/deprovisioning from IdP | User created in Okta → appears in CRM; user disabled in Okta → disabled in CRM |

### User Stories

- **As a** new user, **I want to** register with my work email, **so that** I can start using the CRM
- **As a** user, **I want to** log in with email and password, **so that** I can access my organization's data
- **As a** user, **I want to** enable MFA, **so that** my account is protected from unauthorized access
- **As an** admin, **I want to** configure SSO, **so that** my team can log in with their corporate identity
- **As a** user, **I want to** see all my active sessions, **so that** I can revoke access from lost devices

---

## 3. Organization & Tenancy

### Capabilities

| # | Capability | Priority | Description | Acceptance Criteria |
|---|-----------|----------|-------------|---------------------|
| ORG-01 | Organization Creation | P0 | Create organization; auto-provision tenant; set subscription tier | First user registers → org created → tenant provisioned → RLS applied |
| ORG-02 | Organization Profile | P0 | Name, slug, logo, timezone, date/number format, currency | Admin can update org profile; changes apply globally |
| ORG-03 | Member Management | P0 | Invite users; accept/reject invitation; remove members; role assignment | Invite email sent → user accepts → role assigned → member active |
| ORG-04 | Tenant Lifecycle | P0 | Activate, suspend, reactivate, delete tenant | Suspended tenant returns 403; reactivated tenant resumes normal operation |
| ORG-05 | Tier Management | P1 | Subscription tier changes; feature flag updates per tier | Tier upgrade enables features; downgrade limits access but preserves data |
| ORG-06 | Organization Hierarchy | P3 | Parent/child orgs: HQ + regional offices; data sharing policies | Child org created under parent; data visibility configurable |

### User Stories

- **As an** admin, **I want to** invite team members, **so that** they can collaborate in the CRM
- **As an** admin, **I want to** assign roles to members, **so that** they have appropriate access
- **As a** system admin, **I want to** suspend a non-paying organization, **so that** they cannot access data until payment is resolved
- **As a** user, **I want to** see which organizations I belong to, **so that** I can switch between them

---

## 4. CRM Core (Leads, Contacts, Accounts)

### Capabilities

| # | Capability | Priority | Description | Acceptance Criteria |
|---|-----------|----------|-------------|---------------------|
| CRM-01 | Lead Management | P0 | Create, read, update, delete leads; status lifecycle; source tracking | Full CRUD; status transitions (New→Contacted→Qualified→Converted→Disqualified→Recycled) |
| CRM-02 | Lead Import | P0 | CSV/Excel import; field mapping; dedup; error report | Import 10k leads < 30s; errors produce downloadable report |
| CRM-03 | Lead Deduplication | P0 | Configurable rules: email, phone, name+company match; merge UI | Exact match blocked; fuzzy match suggested; merge preserves history |
| CRM-04 | Lead Conversion | P0 | Lead → Contact + Account + Opportunity creation | Converted lead creates related entities; lead status set to Converted |
| CRM-05 | Lead Assignment | P0 | Manual assignment; round-robin; rules-based auto-assignment | Lead created → assignment rule evaluates → owner assigned → notification sent |
| CRM-06 | Contact Management | P0 | Create, read, update, delete contacts; communication preferences; GDPR consent | Full CRUD; consent tracking; GDPR export/forget |
| CRM-07 | Account Management | P0 | Create, read, update, delete accounts; hierarchy (parent/child); territory | Full CRUD; hierarchy CRUD; territory assignment |
| CRM-08 | Contact/Account Merge | P1 | Merge duplicate contacts/accounts; conflict resolution | Merge preserves all related data; conflict UI for field-level choices |
| CRM-09 | Lead Scoring | P1 | Score based on source, engagement, demographic fit, custom rules | Score calculated on field update; explainable factors shown to user |
| CRM-10 | Bulk Operations | P1 | Bulk update, delete, assign, export leads/contacts/accounts | Bulk select → action → confirmation → background execution → notification |

### User Stories

- **As a** sales rep, **I want to** create a lead from a website inquiry, **so that** I can track the prospect
- **As a** sales rep, **I want to** convert a qualified lead, **so that** it becomes a contact, account, and opportunity
- **As a** sales ops manager, **I want to** set up lead assignment rules, **so that** web leads are automatically assigned to the right rep
- **As a** sales rep, **I want to** import 5,000 leads from a trade show, **so that** I don't have to enter them manually

---

## 5. Sales Pipeline & Opportunity

### Capabilities

| # | Capability | Priority | Description | Acceptance Criteria |
|---|-----------|----------|-------------|---------------------|
| PL-01 | Pipeline Configuration | P0 | Create pipelines; add/reorder stages; set default pipeline per org | Pipeline with stages created; stage reorder persists; default per org |
| PL-02 | Stage Management | P0 | Stage properties: name, probability, order, rules (cannot skip) | Stage transition validates rules; probability auto-updates on stage change |
| PL-03 | Opportunity Management | P0 | Create, read, update, delete opportunities; amount, currency, close date, products | Full CRUD; amount rules enforced; currency conversion if applicable |
| PL-04 | Stage Transitions | P0 | Move opportunity between stages; stage history; win/loss reasons | Stage change logged; win/loss reason required for terminal stages |
| PL-05 | Sales Forecasting | P1 | Forecast by pipeline, by owner, by territory; expected value (weighted) | Forecast calculation matches manual check; time-period filtering |
| PL-06 | Team Selling | P1 | Multiple team members on opportunity; split credit | Team members assigned; credit split configurable; reporting per member |
| PL-07 | Competitive Tracking | P2 | Track competitors per opportunity; win/loss by competitor | Competitor field on opportunity; win/loss report by competitor |
| PL-08 | Product Association | P1 | Associate products/price book items with opportunity; quantity, discount | Products added to opportunity; totals calculated; discounts applied |

### User Stories

- **As a** sales rep, **I want to** create an opportunity from a lead, **so that** I can track the deal through the pipeline
- **As a** sales rep, **I want to** move an opportunity to the next stage, **so that** I can update its progress
- **As a** sales manager, **I want to** see the weighted forecast, **so that** I can predict revenue for the quarter
- **As an** admin, **I want to** create a custom pipeline for our professional services team, **so that** they can track consulting deals differently

---

## 6. Activities & Tasks

### Capabilities

| # | Capability | Priority | Description | Acceptance Criteria |
|---|-----------|----------|-------------|---------------------|
| ACT-01 | Activity Logging | P0 | Log calls, emails, meetings, notes against any entity; duration, outcome | Activity types: Call, Email, Meeting, Note; linked to lead/contact/opportunity |
| ACT-02 | Activity Timeline | P0 | Chronological timeline for any entity; filter by type | Timeline view shows all activities; filters work correctly |
| ACT-03 | Task Management | P0 | Create, assign, update, complete tasks; due date, priority, status, related entity | Full CRUD; assignment; status: Not Started, In Progress, Completed, Cancelled |
| ACT-04 | Task Dashboard | P1 | My tasks, overdue tasks, tasks by due date, team task view | Dashboard shows personalized task list; overdue highlighted |
| ACT-05 | Calendar Sync | P1 | Google Calendar, Outlook Calendar read/write sync; meeting creation | Sync meetings bidirectionally; conflict detection; OAuth flow |
| ACT-06 | Email Sync | P2 | IMAP integration: read inbound emails; link to contacts/leads/opportunities | Inbound emails auto-linked; email timeline on entity |
| ACT-07 | Meeting Scheduling | P2 | Share availability; book meetings; auto-create activity from booking | Availability shared via link; meeting booked → activity created |

### User Stories

- **As a** sales rep, **I want to** log a call with a prospect, **so that** I have a record of the conversation
- **As a** sales rep, **I want to** see the activity timeline for an opportunity, **so that** I know what interactions have happened
- **As a** sales rep, **I want to** create a follow-up task after a call, **so that** I don't forget to send the proposal
- **As a** sales manager, **I want to** see overdue tasks for my team, **so that** I can help them prioritize

---

## 7. Workflow Automation

### Capabilities

| # | Capability | Priority | Description | Acceptance Criteria |
|---|-----------|----------|-------------|---------------------|
| WFL-01 | Visual Workflow Builder | P0 | Drag-and-drop workflow builder: triggers, conditions, actions | Create workflow visually; nodes connect correctly; validations pass |
| WFL-02 | Event Triggers | P0 | Entity events: created, updated, stage changed, deleted; schedule triggers | Trigger fires on matching event; context passed to conditions |
| WFL-03 | Condition Engine | P0 | Field comparison, date math, set membership, AND/OR trees, sub-queries | All operators: eq, neq, gt, lt, contains, in, between, is_set |
| WFL-04 | Action Engine | P0 | Update field, assign owner, create task, send notification, trigger webhook, call API | Actions execute in order; idempotency; timeout handling (30s) |
| WFL-05 | Loop Prevention | P0 | Execution depth limit (10); cycle detection; recursion guard | Infinite loop terminated; max depth exceeded returns error |
| WFL-06 | Workflow Scheduler | P1 | Cron/time-based workflows; timezone handling; daylight saving | Scheduled workflow fires at correct time; DST handled correctly |
| WFL-07 | Approval Workflows | P1 | Multi-step approval: single, sequential, parallel; rejection handling | Approval steps configurable; rejection triggers alternate path |
| WFL-08 | Workflow Templates | P1 | Pre-built templates: auto-assign web leads, warm stale deals, follow-up after demo | Templates import as editable workflows; updates migrate existing |
| WFL-09 | Advanced Branching | P2 | Parallel branches, wait-for-condition, time delays, AI decision nodes | Branch logic executes correctly; delays resolve; AI nodes return decision |
| WFL-10 | Workflow Testing | P1 | Test-run mode: evaluate conditions without executing actions; simulation results | Test-run shows: matched trigger → conditions evaluated → actions listed (not executed) |

### User Stories

- **As a** sales ops manager, **I want to** create a workflow that auto-assigns web leads to the round-robin queue, **so that** leads are distributed fairly
- **As a** sales ops manager, **I want to** create a workflow that sends a Slack notification when a deal > $50K is won, **so that** the team can celebrate
- **As an** admin, **I want to** test a workflow before enabling it, **so that** I don't accidentally notify the wrong people
- **As a** sales manager, **I want to** set up an approval workflow for discounts > 20%, **so that** margin is protected

---

## 8. AI & Intelligence

### Capabilities

| # | Capability | Priority | Description | Acceptance Criteria |
|---|-----------|----------|-------------|---------------------|
| AI-01 | Semantic Search | P1 | Hybrid search across all entities: vector similarity + keyword ranking | Search returns relevant results; tenant-scoped; ranking is accurate |
| AI-02 | AI Lead Scoring | P1 | ML-based scoring: demographic + behavioral features; explainable factors | Score with explanation; feature importance shown; cold-start handled |
| AI-03 | Next-Best-Action | P2 | Recommendation engine: based on lead stage, engagement, historical patterns | Relevant suggestions; business rules override; diversity in suggestions |
| AI-04 | Sentiment Analysis | P2 | Email/call transcript sentiment; trend detection; negative alert | Sentiment score accurate; trend over time; negative sentiment alerts |
| AI-05 | AI Assistant | P2 | Natural language query: "Show me deals closing this month" → data response | Query parsed; correct data returned; fallback to search if ambiguous |
| AI-06 | Conversation Summary | P2 | AI-generated email thread summary; call transcript summary | Summary coherent; entity extraction; token budget management |
| AI-07 | RAG over Org Data | P2 | Document upload → chunk → embed → index → Q&A over org documents | Questions answered from org documents; citations provided |
| AI-08 | AI Workflow Decisions | P2 | AI node in workflow: "Classify this lead as hot/warm/cold based on context" | AI decision matches human judgment > 85% of the time |
| AI-09 | Voice AI (Call Analysis) | P2 | Call recording → transcription → analysis; sentiment, objection detection, action items | Transcription accurate; objections detected; action items extracted |
| AI-10 | AI Call Coaching | P3 | Real-time suggestions during calls; post-call scorecard; coaching tips | Suggestions relevant; scorecard consistent; coaching actionable |
| AI-11 | Prompt Management | P2 | Versioned prompt templates; A/B testing; prompt registry API | Template versions immutable; A/B test measurable; API for CRUD |
| AI-12 | AI Cost Tracking | P2 | Per-feature, per-org token usage; budget alerts; cost dashboard | Usage attributed; budget alerts at 80%; dashboard accurate |

### User Stories

- **As a** sales rep, **I want to** search for "Acme Corp recent deals" and get semantic results, **so that** I find relevant information quickly
- **As a** sales rep, **I want to** see why a lead is scored 85/100, **so that** I know which factors to address
- **As a** sales rep, **I want to** ask "What's my top deal this quarter?" and get an answer, **so that** I don't have to navigate menus
- **As a** sales manager, **I want to** see sentiment trends on customer calls, **so that** I can coach my team on handling objections
- **As an** admin, **I want to** set AI budget limits per org, **so that** we control costs

---

## 9. Communication & Notifications

### Capabilities

| # | Capability | Priority | Description | Acceptance Criteria |
|---|-----------|----------|-------------|---------------------|
| NOT-01 | In-App Notifications | P0 | Real-time notifications via WebSocket; notification center; read/unread | Notification appears in real-time; list shows history; mark read works |
| NOT-02 | Email Notifications | P0 | Transactional email via SendGrid/SES; template rendering; bounce handling | Email delivered; template renders correctly; bounces classified |
| NOT-03 | Notification Preferences | P0 | Per-user, per-channel opt-in/opt-out; quiet hours; digest frequency | Preferences respected; quiet hours suppress; digest summarizes |
| NOT-04 | SMS Notifications | P1 | Twilio integration; short code; opt-out handling | SMS delivered; opt-out list respected; delivery status tracked |
| NOT-05 | Push Notifications | P2 | Firebase Cloud Messaging for mobile push | Push delivered; device token management; click tracking |
| NOT-06 | Slack/Teams Notifications | P1 | Webhook integration; message formatting; interactive buttons | Webhook delivery; formatting correct; buttons functional |
| NOT-07 | WhatsApp Notifications | P2 | WhatsApp Business API integration; template messages | Message delivered; template approved; opt-in required |
| NOT-08 | Notification Templates | P0 | Template engine (Jinja2); per-channel templates; variables; conditional blocks | Template renders; variables substituted; conditionals respected |
| NOT-09 | Rate Limiting & Quotas | P1 | Per-user, per-tenant, per-channel rate limits; daily quotas | Throttling enforced; quotas reset; admin override available |

### User Stories

- **As a** sales rep, **I want to** receive an in-app notification when a lead is assigned to me, **so that** I can follow up immediately
- **As a** sales rep, **I want to** opt out of SMS notifications on weekends, **so that** I'm not disturbed outside work hours
- **As a** sales manager, **I want to** receive a daily email digest of my team's activity, **so that** I can review progress
- **As an** admin, **I want to** configure email templates with company branding, **so that** communications look professional

---

## 10. Reporting & Analytics

### Capabilities

| # | Capability | Priority | Description | Acceptance Criteria |
|---|-----------|----------|-------------|---------------------|
| REP-01 | Report Builder | P1 | Ad-hoc report: dimensions, measures, filters, sorting, grouping; save/share | Report created; filters work; aggregations correct; shareable |
| REP-02 | Pre-built Reports | P1 | Pipeline by stage, lead by source, activity by type, win rate, forecast vs. actual | Pre-built reports match expected numbers; filterable |
| REP-03 | Dashboards | P1 | Grid layout; widgets (chart, KPI, table); time range; sharing; auto-refresh | Widget renders; data refreshes; sharing works |
| REP-04 | Sales Forecasting | P1 | Weighted forecast; commit vs. forecast; by owner/territory/pipeline | Forecast matches manual calculation; period filtering; trend line |
| REP-05 | Report Scheduling | P1 | Schedule delivery (daily, weekly, monthly); email/Slack; CSV/PDF | Scheduled report delivered; format correct; timezone-aware |
| REP-06 | Report Export | P1 | CSV, PDF, XLSX export; async generation for large datasets | Export format correct; 500k rows in < 60s; download link provided |
| REP-07 | Usage Analytics | P2 | Feature adoption metrics; user activity trends; login frequency | Usage data aggregated; trend lines; exportable |
| REP-08 | Custom KPIs | P2 | User-defined KPIs; formulas based on entity fields; dashboard widgets | KPI calculated correctly; formula editor validates; widget displays |

### User Stories

- **As a** sales manager, **I want to** create a report of leads by source for this quarter, **so that** I know which channels perform best
- **As a** sales manager, **I want to** see a dashboard of my team's pipeline, **so that** I can spot deals at risk
- **As a** sales ops manager, **I want to** schedule a weekly pipeline report to be emailed every Monday, **so that** I stay informed
- **As an** executive, **I want to** export the quarterly forecast to Excel, **so that** I can include it in the board deck

---

## 11. Integration & Extensibility

### Capabilities

| # | Capability | Priority | Description | Acceptance Criteria |
|---|-----------|----------|-------------|---------------------|
| INT-01 | REST API v1 | P0 | Full CRUD for all entities; pagination; filtering; sorting; OpenAPI docs | All endpoints documented; pagination works; filtering functional |
| INT-02 | Webhook Delivery | P1 | Outbound webhooks on entity events; retry with backoff; HMAC signing | Webhook delivered; retry logic works; signature verifiable |
| INT-03 | Webhook Receiver | P2 | Inbound webhooks from external systems; signature validation; event routing | Signature validated; event routed; replay protection |
| INT-04 | OAuth 2.0 Management | P1 | OAuth flow for Google, Microsoft, HubSpot; encrypted token storage; auto-refresh | OAuth flow complete; tokens encrypted; auto-refresh functional |
| INT-05 | Connector SDK | P2 | Python SDK for building connectors: auth, sync, webhook; < 100 lines | SDK documented; example connector works; tests pass |
| INT-06 | Built-in Connectors | P2 | Google Workspace, Microsoft 365, Mailchimp, HubSpot import | OAuth flow; data mapping; sync round-trip; error handling |
| INT-07 | Sync Engine | P2 | Bidirectional sync; incremental sync; conflict resolution strategies | Sync creates/updates/deletes; conflict resolved per strategy |
| INT-08 | API Key Management | P1 | Generate, revoke, scope API keys; usage tracking; rate limits | Key generated; scoped to permissions; usage tracked |
| INT-09 | Developer Portal | P3 | API documentation; interactive playground; SDK downloads; app registration | Portal has API ref; playground works; SDK downloadable |
| INT-10 | Custom Objects | P3 | User-defined entity types; custom fields; relationships; API | Custom object created; fields defined; API served; permissions apply |
| INT-11 | Custom Fields | P1 | Per-entity custom fields; types: text, number, date, picklist, lookup | Field added to entity; validates; searchable; exportable |

### User Stories

- **As a** developer, **I want to** use the REST API to sync leads from our website, **so that** web leads are automatically created in CRM
- **As a** developer, **I want to** receive webhooks when opportunities are won, **so that** our billing system is notified
- **As an** admin, **I want to** connect Google Workspace, **so that** contacts and calendar sync automatically
- **As a** sales ops manager, **I want to** create custom fields on opportunities, **so that** we can track additional information

---

## 12. Administration & Governance

### Capabilities

| # | Capability | Priority | Description | Acceptance Criteria |
|---|-----------|----------|-------------|---------------------|
| ADM-01 | Role Management | P0 | Create/edit/delete roles; assign permissions; system role protection | Roles CRUD; system roles protected; permissions additive |
| ADM-02 | User Management | P0 | List users; edit profiles; disable/enable; role assignment | User management CRUD; disable blocks access; role changes effective immediately |
| ADM-03 | Audit Log | P0 | Event-sourced audit: who did what, when, on which entity; immutable | Audit entries created for all mutations; immutable after 5 min; searchable |
| ADM-04 | Feature Flags | P1 | Per-tenant feature enable/disable; gradual rollout; kill switch | Feature toggled per org; rollout percentage; kill switch immediate |
| ADM-05 | API Key Administration | P1 | View all API keys; revoke; rate limit management | API keys listed; revocation immediate; rate limit configurable |
| ADM-06 | Security Settings | P1 | Password policy; session timeout; MFA enforcement; IP allowlisting | Settings saved; enforcement immediate; audit logged |
| ADM-07 | Field-Level Permissions | P2 | Restrict read/write on specific fields per role | Field read/write enforced; manager sees budget, rep does not |
| ADM-08 | Data Retention Policies | P2 | Configurable retention per entity; auto-purge; legal hold | Retention enforced; data purged after period; legal hold prevents purge |
| ADM-09 | Import/Export Tools | P1 | Bulk data import; full org export; migration tools | Import validates; export complete; migration documented |
| ADM-10 | Billing & Subscription | P3 | Stripe integration; invoices; usage metering; plan changes | Subscription created; invoices generated; usage tracked; proration correct |
| ADM-11 | Marketplace | P3 | App listing; install/uninstall; billing integration | App installs; permissions scoped; billing handled |

### User Stories

- **As an** admin, **I want to** create a custom role with specific permissions, **so that** team members have appropriate access
- **As an** admin, **I want to** view the audit log for a specific user, **so that** I can investigate a data change
- **As an** admin, **I want to** enable/disable features for our organization, **so that** we control which capabilities are available
- **As a** security officer, **I want to** configure password policies, **so that** we meet our compliance requirements

---

## 13. Stakeholder Personas

### Persona 1: Sarah — Sales Rep

| Attribute | Detail |
|-----------|--------|
| **Role** | SMB Account Executive |
| **Tech comfort** | Moderate — uses CRM, email, calendar daily |
| **Goals** | Close deals faster, reduce data entry, follow up on time |
| **Pain points** | Manual data entry, forgetting follow-ups, slow search |
| **Key needs** | Quick lead/contact creation, pipeline drag-and-drop, activity logging, task reminders |
| **Success metric** | Deals closed; time spent in CRM < 30 min/day |
| **TZAHU features** | Lead/contact CRUD, pipeline management, activity logging, tasks, AI-assisted data entry |

### Persona 2: Marcus — Sales Manager

| Attribute | Detail |
|-----------|--------|
| **Role** | Sales Director (Mid-Market) |
| **Tech comfort** | High — uses analytics tools, CRM reporting |
| **Goals** | Forecast accuracy, team visibility, coaching |
| **Pain points** | Inaccurate forecasts, no visibility into team activity, manual report building |
| **Key needs** | Dashboards, reports, forecasting, activity overview, AI coaching |
| **Success metric** | Forecast accuracy within 10%; team pipeline visibility |
| **TZAHU features** | Dashboards, reports, forecasting, team activity view, AI sentiment analysis |

### Persona 3: Priya — CRM Admin

| Attribute | Detail |
|-----------|--------|
| **Role** | Sales Operations Manager |
| **Tech comfort** | Very high — configures tools, manages integrations |
| **Goals** | Efficient CRM operations, clean data, automated workflow |
| **Pain points** | Manual user management, complex permission setup, data quality issues |
| **Key needs** | User management, role/permissions, workflow builder, import tools, audit log |
| **Success metric** | < 1 hour/week on CRM admin; data quality score > 95% |
| **TZAHU features** | Admin UI, RBAC, workflow builder, dedup, import tools, audit log, custom fields |

### Persona 4: Alex — System Admin

| Attribute | Detail |
|-----------|--------|
| **Role** | Platform Engineer (TZAHU internal or enterprise IT) |
| **Tech comfort** | Expert — DevOps, infrastructure, security |
| **Goals** | Reliable platform, secure operations, tenant management |
| **Pain points** | Infrastructure complexity, monitoring gaps, compliance requirements |
| **Key needs** | Monitoring, tenant lifecycle, security configuration, API management |
| **Success metric** | 99.95% uptime; SLA compliance; no security incidents |
| **TZAHU features** | Admin console, tenant management, audit log, API keys, webhook admin |

### Persona 5: Dana — API Developer

| Attribute | Detail |
|-----------|--------|
| **Role** | Integration Developer (partner or customer) |
| **Tech comfort** | Expert — builds integrations, consumes APIs |
| **Goals** | Easy integration, clear documentation, reliable webhooks |
| **Pain points** | Poor API docs, breaking changes, no sandbox, rate limit issues |
| **Key needs** | OpenAPI docs, sandbox environment, webhook console, SDK, playground |
| **Success metric** | Integration built in < 1 week; zero breaking changes surprise |
| **TZAHU features** | REST API, webhooks, connector SDK, developer portal, API keys |

### Persona 6: Customer — End Customer

| Attribute | Detail |
|-----------|--------|
| **Role** | Contact/Lead (not a CRM user) |
| **Tech comfort** | Varies |
| **Goals** | Get information, submit inquiry, receive timely responses |
| **Pain points** | Slow responses, impersonal communication, no self-service |
| **Key needs** | Web forms, knowledge base, timely follow-up |
| **Success metric** | Response time < 1 hour; CSAT > 4/5 |
| **TZAHU features** | Public lead capture, knowledge base, portal (future) |

---

## 14. Business Rules

### Lead Conversion Rules

| Rule | Description | Validation |
|------|-------------|------------|
| Lead → Contact | Converted lead creates a contact; email is unique per org | Duplicate email triggers merge suggestion |
| Lead → Account | If lead has company name, create account; else link to existing | Account name fuzzy-matched; user confirms |
| Lead → Opportunity | Optional: create opportunity on conversion with default stage | Opportunity stage = "New" or configurable |
| Required fields | Contact: first name, last name, email or phone | Missing fields blocked with validation error |
| Status transition | Converted leads cannot be unconverted | Status is terminal; new lead created for re-entry |

### Pipeline Stage Rules

| Rule | Description | Enforcement |
|------|-------------|-------------|
| Sequential stages | Stages typically sequential; cannot skip stages unless configured | Configurable flag: `allow_skip` per pipeline |
| Stage probability | Default probability per stage; can override per opportunity | Manual override logged; admin can restrict |
| Win/Loss reasons | Required when moving to Closed Won or Closed Lost | Configured list; custom reason allowed |
| Stage duration limit | Optional: max days in a stage; auto-escalation | Workflow trigger: "opportunity in stage > N days" |
| Forecast category | Pipeline: Best Case, Commit, Closed; Commit requires > 50% probability | Commit requires manager approval (configurable) |

### Assignment Rules

| Rule | Description | Priority |
|------|-------------|----------|
| Round-robin | Leads assigned to next rep in queue | P0 |
| Load-balanced | Assign to rep with fewest open leads | P1 |
| Territory-based | Assign based on lead location/territory | P1 |
| Skill-based | Assign based on lead type/product expertise | P2 |
| Owner-based | Assign to specific user; manual override | P0 |
| Team-based | Assign to team; team lead redistributes | P2 |

### Approval Flow Rules

| Rule | Description | Configuration |
|------|-------------|---------------|
| Discount approval | Discount > 20% requires manager approval | Threshold configurable per org |
| Deal amount approval | Deal > $100K requires VP approval | Threshold configurable per org |
| Sequential approval | Manager → Director → VP | Approval chain configurable |
| Parallel approval | Both Finance and Legal must approve | Configurable per workflow |
| Escalation | No response in 24h → escalated to next approver | Timeout configurable |
| Self-approval | Approver can approve own deals? Default: no | Configurable per org |

---

## 15. Compliance & Regulatory

### GDPR Compliance

| Requirement | Implementation | Phase |
|-------------|---------------|-------|
| Consent tracking | Explicit consent field on contacts; purpose-based consent | R1 |
| Right to access | Export contact data to JSON/CSV | R2 |
| Right to erasure | Anonymize contact data; delete on request; retention policy | R2 |
| Data processing records | Audit log of all data processing activities | R1 |
| Data Protection Impact Assessment | Documentation for high-risk processing | R2 |
| Breach notification | Automated notification workflow for data breaches | R2 |
| Data portability | Export all contact data in standard format | R2 |
| Cookie consent | Cookie banner; consent management | R2 |

### SOC 2 Type II Compliance

| Trust Principle | Implementation | Phase |
|----------------|---------------|-------|
| **Security** | Access control (RBAC + RLS), encryption (at rest + in transit), audit logging, vulnerability management | R1–R2 |
| **Availability** | 99.95% uptime, DR plan, monitoring, incident response | R3 |
| **Processing Integrity** | Data validation, workflow execution guarantees, idempotency | R2 |
| **Confidentiality** | Encryption, access control, data classification, NDA with employees | R2 |
| **Privacy** | GDPR compliance, data retention, consent management | R2 |

### Data Residency

| Requirement | Implementation | Phase |
|-------------|---------------|-------|
| EU data residency | Silo model: dedicated EU database (Frankfurt/Ireland) | R3 |
| US data residency | Primary US region (Virginia/Oregon) | R1 |
| Asia-Pacific data residency | Silo model: dedicated APAC database (Singapore/Tokyo) | R4 |
| Data export controls | Configurable data export restrictions per org | R3 |
| Local laws compliance | Configurable retention, disclosure policies | R3 |

### Other Compliance Requirements

| Requirement | Details | Phase |
|-------------|---------|-------|
| CCPA | California Consumer Privacy Act — similar to GDPR for CA residents | R2 |
| HIPAA | Business Associate Agreement for healthcare customers | R4 |
| PCI DSS | Payment handling via Stripe (Stripe is PCI-compliant; we never touch card data) | R3 |
| ISO 27001 | Information security management certification | R4 |
| Accessibility | WCAG 2.1 AA for all UI components | R2 |

---

> **This document defines what TZAHU CRM must do — the business capabilities that drive value.**
> Every feature in the product roadmap traces back to at least one capability in this document.
> If a feature doesn't serve a documented business requirement, it shouldn't be built.
