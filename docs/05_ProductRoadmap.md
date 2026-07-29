# TZAHU CRM — Product Roadmap

> **Version:** 1.0.0
> **Last Updated:** 2026-07-27
> **Status:** Final
> **Owner:** Product Management

---

## Table of Contents

1. [Roadmap Overview](#1-roadmap-overview)
2. [R1 — MVP (Months 1-6)](#2-r1--mvp-months-1-6)
3. [R2 — Growth (Months 7-12)](#3-r2--growth-months-7-12)
4. [R3 — Scale (Months 13-18)](#4-r3--scale-months-13-18)
5. [R4 — Enterprise (Months 19-24)](#5-r4--enterprise-months-19-24)
6. [Dependency Graph](#6-dependency-graph)
7. [Risk Register](#7-risk-register)
8. [Success Metrics Dashboard](#8-success-metrics-dashboard)

---

## 1. Roadmap Overview

### Strategic Phases

```
R1: MVP (Months 1-6)              R2: Growth (Months 7-12)
┌──────────────────────────┐      ┌──────────────────────────┐
│ Foundation + Core CRM    │ ──►  │ Advanced Workflow +      │
│ Identity, RBAC, Tenant   │      │ Reports, Calendar,       │
│ Leads, Contacts, Accts   │      │ Search, Integrations,    │
│ Pipeline, Opportunity    │      │ SOC 2, GDPR Ready        │
│ Activities, Tasks        │      │                          │
│ Basic Workflow           │      │                          │
│ Email Notifications      │      │                          │
│ REST API v1              │      │                          │
└──────────────────────────┘      └──────────────────────────┘
         │                                   │
         ▼                                   ▼
R3: Scale (Months 13-18)           R4: Enterprise (Months 19-24)
┌──────────────────────────┐      ┌──────────────────────────┐
│ AI Platform + Voice AI   │ ──►  │ Enterprise Features +    │
│ AI Assistant, RAG,       │      │ Ecosystem                │
│ Semantic Search,         │      │ SSO, Field Permissions,  │
│ Voice AI, Call Analysis  │      │ Data Residency,          │
│ K8s Production,          │      │ Custom Objects,          │
│ Multi-Region,            │      │ 50+ Integrations,        │
│ Webhook System,          │      │ Billing, Marketplace     │
│ 1,000+ Org Performance   │      │ 100k+ Users              │
└──────────────────────────┘      └──────────────────────────┘
```

### Team Allocation

| Phase | Backend | Frontend | AI/ML | DevOps | Total |
|-------|---------|----------|-------|--------|-------|
| R1 | 2 | 2 | 0 | 1 | 5 |
| R2 | 2 | 2 | 0 | 1 | 5 |
| R3 | 2 | 1 | 1 | 1 | 5 |
| R4 | 2 | 1 | 1 | 1 | 5 |

### Key Milestones

| Milestone | Date | Deliverable |
|-----------|------|-------------|
| M0: Foundation Complete | Month 1 | Django project, Docker, CI/CD, shared kernel |
| M1: Auth & Tenancy | Month 2 | Registration, login, JWT, RBAC, org creation, RLS |
| M2: Core CRM | Month 4 | Leads, contacts, accounts, pipeline, opportunities |
| M3: Workflow & Notifications | Month 5 | Basic workflow engine, email notifications, activities/tasks |
| M4: R1 Launch | Month 6 | 50 orgs, REST API v1, basic dashboards |
| M5: Advanced Automation | Month 8 | Advanced workflow, approval engine, report builder |
| M6: Calendar & Search | Month 10 | Calendar sync, full-text search, file attachments |
| M7: R2 Launch | Month 12 | 200 orgs, SOC 2 ready, integration SDK |
| M8: AI Platform | Month 15 | AI Gateway, semantic search, lead scoring, AI assistant |
| M9: Voice AI | Month 17 | Call logging, transcription, analysis |
| M10: R3 Launch | Month 18 | 1,000 orgs, K8s production, multi-region |
| M11: Enterprise | Month 22 | SSO, field permissions, custom objects, billing |
| M12: R4 Launch | Month 24 | 5,000 orgs, 50+ integrations, marketplace |

---

## 2. R1 — MVP (Months 1-6)

### Theme: Foundation & Core CRM

R1 delivers a functional CRM that replaces spreadsheets for small sales teams. The focus is on the core sales workflow: capture leads, manage contacts, track deals through a pipeline, log activities, and assign tasks. Everything is built with tenant isolation from day one.

### Timeline

```
Month 1      Month 2      Month 3      Month 4      Month 5      Month 6
├────────────┼────────────┼────────────┼────────────┼────────────┼────────────┤
│ Phase 0-1  │ Phase 2    │ Phase 3    │ Phase 3-4  │ Phase 5-6  │ Polish     │
│ Foundation │ Multi-     │ Lead/      │ Pipeline/  │ Workflow/  │ Launch     │
│ + Identity │ Tenancy    │ Contact/   │ Opp/       │ Notif/     │ + 50 Orgs  │
│ + RBAC     │            │ Account    │ Activity   │ Dashboard  │            │
└────────────┴────────────┴────────────┴────────────┴────────────┴────────────┘
```

### Features by Module

| Module | Features | Priority |
|--------|----------|----------|
| Shared Kernel | ValueObjects, Result type, Repository port, EventPublisher, UUID7, DomainError hierarchy | P0 |
| Identity | User registration, email verification, login, JWT access+refresh, password management, forgot/reset password, user profile, session management | P0 |
| Organization | Org creation, org profile, member invite/accept/remove, org settings | P0 |
| RBAC | Role CRUD, permission catalog, role assignment/unassignment, permission check, default roles (Admin, Manager, Rep, Read-Only) | P0 |
| Tenant | Auto-provision on org creation, RLS policy engine, tenant resolution middleware, Celery tenant propagation, tenant lifecycle (suspend/reactivate) | P0 |
| Lead Management | Lead CRUD, status lifecycle, source tracking, lead import (CSV), lead dedup (email/phone), lead conversion (-> Contact + Account + Opp), manual lead assignment | P0 |
| Contact Management | Contact CRUD, communication preferences, GDPR consent tracking, contact merge | P0 |
| Account Management | Account CRUD, account hierarchy (parent/child), territory assignment | P0 |
| Pipeline Management | Pipeline CRUD, stage management, stage ordering, default pipeline | P0 |
| Opportunity Management | Opportunity CRUD, stage transitions, win/loss reasons, amount/probability, competitive tracking, team selling | P0 |
| Activity Management | Log call/email/meeting/note, activity timeline per entity, activity filtering | P0 |
| Task Management | Task CRUD, assignment, status updates, due date, priority, task dashboard (my tasks, overdue, today) | P0 |
| Basic Workflow | Event triggers (entity created/updated/stage changed), condition engine (field comparison, AND/OR), action engine (update field, assign, create task, notify), loop prevention | P0 |
| Email Notification | SendGrid/SES integration, template rendering, in-app notifications via WebSocket, notification preferences (opt-in/out) | P0 |
| Dashboard | Pre-built dashboard: pipeline summary, tasks, recent activity, KPI widgets | P0 |
| Audit | Event capture on all mutations, audit query, audit export | P0 |
| Search | PostgreSQL full-text search on leads/contacts/accounts | P0 |
| REST API v1 | All entities via DRF viewsets, pagination, filtering, sorting, OpenAPI docs (drf-spectacular), API key auth | P0 |

### Dependencies

- Phase 0 (Foundation): Must complete before any module work
- Phase 1 (Identity/RBAC): Foundation for all user-facing features
- Phase 2 (Tenancy): Required before any customer data
- Phase 3 (Lead/Contact/Account): Foundation for Phase 4
- Phase 4 (Pipeline/Opportunity): Depends on Phase 3 entities
- Phase 5 (Workflow): Depends on Phase 3-4 domain events
- Phase 6 (Notification): Depends on Workflow actions

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| RLS implementation gaps cause data leak | Low | Critical | Isolation test suite in CI; pair review on RLS migrations |
| Workflow engine scope too large for R1 | High | Medium | Limit to basic triggers/conditions/actions; defer advanced features to R2 |
| CSV import performance on 10k+ rows | Medium | Medium | Stream parsing; batch inserts; async for >5k rows |
| JWT secret management in CI | Medium | Medium | GitHub Actions secrets; ephemeral keys for tests |
| Team unfamiliar with Django's modular pattern | Medium | Low | Pair programming; import-linter from day 1; documentation |

### Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Paying organizations | 50 | Stripe subscription count |
| Active users | 2,500 | DAU tracking |
| Leads created | 50,000 | Entity counter |
| API p95 latency | < 200ms | Prometheus histogram |
| API availability | 99.9% | Blackbox monitoring |
| Test coverage | > 90% | pytest-cov |
| Time to first value | < 15 min | Onboarding funnel |
| NPS | > 30 | Quarterly survey |

### Exit Criteria

- [x] User can register, verify email, login, and manage profile
- [x] Organization can be created; members invited with role assignments
- [x] RLS enforced on all tenant-scoped tables; isolation test suite passes
- [x] Full lead lifecycle: create -> qualify -> convert -> contact + account + opportunity
- [x] Configurable pipeline with stage transitions and win/loss tracking
- [x] Activity logging and task management with dashboard
- [x] Basic workflow: event trigger, condition, action (assign, notify, update field)
- [x] Email notifications delivered via SendGrid/SES
- [x] 50 paying organizations onboarded
- [x] REST API v1 documented and accessible
- [x] All non-functional requirements for R1 met (security, performance, observability)

---

## 3. R2 — Growth (Months 7-12)

### Theme: Advanced Automation & Productivity

R2 transforms the CRM from a data store into an automation platform. Advanced workflows, reporting, calendar sync, file management, and integrations make TZAHU a daily driver for sales teams. SOC 2 Type II readiness and GDPR compliance open the door to mid-market customers.

### Timeline

```
Month 7      Month 8      Month 9      Month 10     Month 11     Month 12
├────────────┼────────────┼────────────┼────────────┼────────────┼────────────┤
│ Phase 5    │ Phase 5-7  │ Phase 7    │ Phase 10   │ SOC 2/GDPR │ R2 Launch   │
│ Advanced   │ Reports/   │ Calendar   │ Integration│ Readiness  │ + 200 Orgs  │
│ Workflow   │ Analytics  │ Sync/Files │ Hub (SDK)  │ + Mobile   │             │
│ Approval   │ Dashboards │ Search     │ Webhooks   │ API        │             │
└────────────┴────────────┴────────────┴────────────┴────────────┴────────────┘
```

### Features by Module

| Module | Features | Priority |
|--------|----------|----------|
| Advanced Workflow | Cron/time-based triggers, approval workflows (single/sequential/parallel), workflow templates, workflow testing (test-run), advanced branching, wait-for-condition, time delays | P1 |
| Report Builder | Ad-hoc report builder (dimensions, measures, filters, grouping), data source abstraction, report CRUD, sync + async execution, report export (CSV, PDF, XLSX), report scheduling (daily/weekly/monthly), pre-built reports | P1 |
| Dashboards | Custom dashboards (grid layout, widgets), widget library (chart, KPI, table, activity feed), dashboard sharing, auto-refresh | P1 |
| Sales Forecasting | Weighted forecast (probability * amount), commit vs forecast, by owner/territory/pipeline, trend lines | P1 |
| Calendar Sync | Google Calendar OAuth, Outlook Calendar OAuth, read/write sync, meeting creation from CRM, conflict detection | P1 |
| File Attachments | MinIO integration, file upload/download/preview, folder organization, file versioning, storage quota enforcement | P1 |
| Full-Text Search | Enhanced PostgreSQL FTS with weighted fields, faceted filters, search suggestions, tenant-scoped results | P1 |
| Integration Hub | Connector SDK (Python), OAuth 2.0 management, encrypted token storage, auto-refresh, sync engine (bidirectional, incremental, conflict resolution) | P1 |
| Built-in Connectors | Google Workspace (Contacts, Calendar), Microsoft 365 (Contacts, Calendar), Mailchimp, HubSpot (import), Slack notifications | P1 |
| Webhook System | Outbound webhooks on entity events, retry with backoff (3s, 9s, 27s), HMAC SHA-256 signing, delivery logs, webhook management UI | P1 |
| Mobile API | Mobile-optimized API endpoints, reduced payload, offline capability stubs | P1 |
| Custom Fields | Per-entity custom fields: text, number, date, picklist, lookup, checkbox, formula | P1 |
| Approval Engine | Multi-step approval workflows, approval chains (sequential/parallel), escalation on timeout, approval rules (amount > $100K needs VP) | P1 |
| SMS Notifications | Twilio integration, opt-out handling, delivery status | P1 |
| Slack/Teams Notifications | Webhook integration, message formatting, interactive buttons | P1 |
| Notification Templates | Template engine (Jinja2), per-channel templates, variables, conditional blocks | P1 |
| Email Sync (Read) | IMAP integration, inbound email linking to contacts/leads/opportunities | P2 |
| Unified Inbox | Multi-channel messaging inbox: WhatsApp (Cloud API), Instagram DM (Graph API), Facebook Messenger (Graph API). Connect once via Meta Business Account. Unified conversation view, reply, assign, close. Contact auto-linking. | P1 |
| Live Chat Widget | Embeddable website chat widget, messages appear in Unified Inbox, visitor tracking, proactive chat triggers | P2 |
| GDPR Compliance | Consent tracking, right to access (export), right to erasure (anonymize), DPA, breach notification workflow | P1 |
| SOC 2 Readiness | Access control evidence, encryption documentation, incident response plan, vulnerability management, vendor management | P1 |
| Session Policies | Per-org session timeout, concurrent session limits | P1 |

### Dependencies

- Advanced Workflow builds on R1 basic workflow engine
- Reports/Analytics depend on R1 Phase 3-4 entity data
- Calendar sync depends on OAuth infrastructure (Integration Hub)
- File attachments depend on MinIO setup from Phase 0
- Connector SDK depends on REST API v1
- SOC 2 readiness depends on audit module from R1

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Report query performance on large datasets | High | High | Materialized views; query timeout (30s); result caching |
| OAuth token expiry disrupts sync | High | High | Proactive refresh; notification on failure; manual re-auth |
| Email deliverability (spam, blacklisting) | Medium | High | SPF/DKIM/DMARC; dedicated IPs; warm-up process |
| Calendar sync complexity (conflict resolution) | Medium | Medium | Last-write-wins initially; add conflict UI later |
| SOC 2 evidence collection scope creep | Medium | Medium | Use compliance automation tool (Vanta/Drata); dedicated security engineer |

### Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Paying organizations | 200 | Stripe subscription count |
| Active users | 20,000 | DAU tracking |
| Workflow adoption | > 40% of orgs have active workflows | Feature flag |
| Report builder usage | > 30% of orgs have created custom reports | Entity counter |
| Integration connections | > 100 total connections | Integration counter |
| Net revenue retention | > 110% | Monthly billing |
| API p95 latency | < 200ms | Prometheus histogram |
| SOC 2 audit result | No critical findings | Audit report |

### Exit Criteria

- [x] Advanced workflow: cron triggers, approval flows, test-run mode, template library
- [x] Report builder: custom reports, pre-built reports, scheduled delivery, export
- [x] Calendar sync: Google + Outlook bidirectional; meeting creation from CRM
- [x] File attachments: upload, preview, organize, version, quota enforcement
- [x] Full-text search: weighted fields, faceted filters, suggestions
- [x] Integration Hub: connector SDK, OAuth management, sync engine
- [x] Built-in connectors: Google, Microsoft, Mailchimp, HubSpot, Slack
- [x] Outbound webhooks: event subscriptions, HMAC signing, retry, logs
- [x] Custom fields: add to any entity, multiple types, searchable
- [x] SOC 2 Type II readiness evidence collected
- [x] GDPR compliance: consent, access, erasure, breach notification
- [x] Unified Inbox: WhatsApp Cloud API + Instagram DM + Facebook Messenger connected via Meta Business Account; unified conversation view with reply, assign, close, and contact auto-linking
- [x] 200 paying organizations onboarded

---

## 4. R3 — Scale (Months 13-18)

### Theme: AI Platform & Infrastructure Scale

R3 transforms TZAHU into an AI-native CRM. The AI Gateway, semantic search, lead scoring, AI assistant, and voice AI create the intelligence layer. Simultaneously, the infrastructure scales to 1,000+ orgs with K8s production, multi-region deployment, and performance optimization.

### Timeline

```
Month 13     Month 14     Month 15     Month 16     Month 17     Month 18
├────────────┼────────────┼────────────┼────────────┼────────────┼────────────┤
│ Phase 8    │ Phase 8    │ Phase 8-9  │ Phase 9    │ Infra      │ R3 Launch   │
│ AI Gateway │ Semantic   │ Lead       │ Voice AI   │ K8s Prod   │ + 1,000     │
│ Embeddings │ Search     │ Scoring    │ Call       │ Multi-     │ Orgs        │
│ RAG        │ AI Assist  │ NBA        │ Analysis   │ Region     │             │
│            │            │ Sentiment  │ Coaching   │ Perf Opt   │             │
└────────────┴────────────┴────────────┴────────────┴────────────┴────────────┘
```

### Features by Module

| Module | Features | Priority |
|--------|----------|----------|
| AI Gateway | FastAPI sidecar: LLM proxy (OpenAI + Anthropic), provider routing, retry, fallback, usage tracking | P1 |
| Embedding Pipeline | Entity embedding on create/update, batch re-embedding, model versioning, tenant-scoped vectors | P1 |
| Semantic Search | Hybrid search (pgvector cosine + PostgreSQL FTS), weighted ranking (0.7 semantic / 0.3 keyword), faceted filters, re-ranking (cross-encoder) | P1 |
| Prompt Management | Versioned prompt templates, A/B testing, prompt registry API, immutable prompt versions | P2 |
| AI Lead Scoring | ML-based scoring (demographic + behavioral), explainable factors (SHAP), cold-start handling, score recalculation | P2 |
| Next-Best-Action | Recommendation engine: based on lead stage, engagement, historical patterns, business rule override | P2 |
| Sentiment Analysis | Email/call transcript sentiment, trend detection, negative sentiment alert | P2 |
| AI Assistant | Natural language query -> data response, context-aware answers, action execution (create task, update field) | P2 |
| Conversation Summary | AI-generated email thread summary, call transcript summary, entity extraction | P2 |
| RAG Pipeline | Document upload -> chunk -> embed -> index -> retrieval for Q&A over org documents | P2 |
| AI Cost Tracking | Per-feature, per-org token usage, budget alerts, cost dashboard | P2 |
| Voice AI | Twilio Voice integration, call logging, call recording, real-time transcription (Deepgram), post-call analysis (sentiment, talk ratio, objection detection, action items) | P2 |
| AI Call Coaching | Real-time whisper suggestions, post-call scorecard, coaching tips | P3 |
| K8s Production | Production K8s cluster, HPA autoscaling, pod resource limits, rolling updates, blue/green deploy | P1 |
| Multi-Region | Read replicas in secondary regions, read/write splitting, < 50ms replication lag, failover < 30s | P1 |
| Connection Pooling | Pgbouncer optimization, max connections per tenant, idle timeout tuning | P1 |
| Caching Strategy | Redis cache optimization: user sessions, permissions, tenant config, report results, entity lookups | P1 |
| Webhook Delivery System | Enhanced webhook: event filtering, delivery guarantees, idempotency, DLQ monitoring | P1 |
| Performance Optimization | k6 load tests: 10k concurrent users, 1M leads per org, complex report queries; p95 < 200ms target | P1 |
| Celery Queue Optimization | Named queues per workload, priority queues, worker autoscaling, queue depth monitoring | P1 |
| Inbound Webhooks | Receive webhooks from external systems, signature validation, replay protection, event routing | P2 |

### Dependencies

- AI Gateway depends on FastAPI sidecar architecture (established in Phase 0)
- Embedding pipeline depends on entity models from R1
- Semantic search depends on pgvector extension + embedding pipeline
- AI features depend on AI Gateway + embedding pipeline
- Voice AI depends on Twilio integration + AI Gateway + transcription service
- Multi-region depends on K8s production cluster
- Performance optimization depends on monitoring data from R1-R2

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| LLM hallucination in generated content | High | High | AI content tagged; user confirmation required; fact-checking layer |
| Embedding model deprecation | Medium | Medium | Model abstraction layer; re-embedding pipeline |
| AI latency impacts user experience | Medium | High | Async AI features; streaming for generation; caching |
| Prompt injection via CRM data fields | Medium | Critical | Input sanitization; output filtering; rate limits |
| Multi-region PostgreSQL complexity | High | High | Consider Citus for distributed PG; or shard to dedicated instances |
| Audio streaming infrastructure complexity | High | High | Start with recorded analysis; add real-time streaming later |
| Speech-to-text accuracy in domain terminology | Medium | Medium | Custom vocabulary in ASR; domain fine-tuning |
| AI LLM costs exceed budget | High | Medium | Per-org budget caps; model tiering; caching |

### Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Paying organizations | 1,000 | Stripe subscription count |
| Active users | 100,000 | DAU tracking |
| AI feature adoption | > 40% of users interact with AI weekly | Feature analytics |
| Semantic search usage | > 50% of searches use semantic mode | Search analytics |
| AI lead scoring accuracy | > 85% agreement with human scoring | A/B test |
| Voice AI adoption | > 20% of calls logged in CRM | Call counter |
| API p95 latency | < 200ms at 1,000 orgs | Prometheus histogram |
| API availability | 99.95% | Blackbox monitoring |
| Multi-region replication lag | < 50ms | Prometheus monitoring |
| DB query p99 | < 100ms | Prometheus histogram |

### Exit Criteria

- [x] AI Gateway operational: LLM proxy, provider fallback, usage tracking
- [x] Entity embedding: auto-embed on create/update; batch re-embedding
- [x] Semantic search: hybrid (vector + FTS); weighted ranking; re-ranking
- [x] AI lead scoring: score with explainable factors; cold-start handling
- [x] AI Assistant: natural language query; context-aware; action execution
- [x] Voice AI: call logging, recording, transcription, analysis, coaching
- [x] RAG pipeline: document upload -> chunk -> embed -> retrieval -> answer
- [x] Prompt management: versioned templates, A/B testing, API
- [x] AI cost tracking: per-feature, per-org; budget alerts
- [x] K8s production: HPA, rolling updates, resource limits, monitoring
- [x] Multi-region: read replicas, read/write splitting, failover < 30s
- [x] Performance: p95 < 200ms at 1,000 orgs with 100k leads each
- [x] 1,000 paying organizations onboarded

---

## 5. R4 — Enterprise (Months 19-24)

### Theme: Enterprise Features & Ecosystem

R4 delivers the enterprise capabilities required for large organizations: SSO, field-level permissions, custom objects, data residency, and the marketplace ecosystem. The platform scales to 5,000+ orgs and 100k+ users with enterprise SLAs.

### Timeline

```
Month 19     Month 20     Month 21     Month 22     Month 23     Month 24
├────────────┼────────────┼────────────┼────────────┼────────────┼────────────┤
│ Phase 11   │ Phase 11   │ Phase 10-11│ Phase 11   │ Marketplace│ R4 Launch   │
│ SAML SSO  │ Field      │ 50+        │ Custom     │ Billing/   │ + 5,000     │
│ OIDC      │ Permissions│ Integrations│ Objects   │ Subscription│ Orgs        │
│ SCIM      │ Data       │ Advanced   │ Dev Portal│ ISO 27001  │             │
│           │ Residency  │ Connectors │            │ Readiness  │             │
└────────────┴────────────┴────────────┴────────────┴────────────┴────────────┘
```

### Features by Module

| Module | Features | Priority |
|--------|----------|----------|
| Enterprise SSO | SAML 2.0, OIDC, Azure AD, Okta, Google Workspace, Just-In-Time provisioning, group sync, SCIM 2.0 | P2 |
| Field-Level Permissions | Per-role field read/write restrictions, field-level audit, dynamic field filtering in API | P2 |
| Data Residency (Silo) | Dedicated database per tenant, Pool -> Silo migration tool, data integrity verification, zero-downtime migration | P2 |
| Custom Objects | User-defined entity types, custom fields, relationships, views, permissions, API, search | P3 |
| Billing & Subscription | Stripe integration, plan management, subscription CRUD, usage metering, invoice generation, overage billing, proration | P3 |
| Marketplace | App listing, install/uninstall, permission scoping, billing integration, developer submission, app review | P3 |
| Developer Portal | API reference, interactive playground, SDK downloads, app registration, API key management, webhook console | P3 |
| Advanced RBAC | Role hierarchy (inheritance), record-level sharing rules, team-based permissions | P2 |
| 50+ Integrations | HubSpot (full sync), Salesforce (import), Zapier, Make, Zoom, LinkedIn, Mailchimp (full), Constant Contact, Pipedrive (import), QuickBooks, Xero, Shopify, WooCommerce, WordPress, Typeform, JotForm, Calendly, ZoomInfo, Clearbit, Lusha, Gong, Chorus, Outreach, SalesLoft, and 25+ more | P2 |
| ISO 27001 Readiness | ISMS documentation, risk management, continuous improvement, internal audit | P3 |
| HIPAA Readiness | BA agreement, PHI controls, audit, access logs, encryption | P3 |
| Advanced Audit | Retention policies, legal hold, compliance exports, anomaly detection | P2 |
| Organization Hierarchy | Parent/child orgs, data sharing policies, consolidated reporting | P3 |
| MFA Enforcement Policy | Org-level MFA requirement for all users or specific roles | P2 |
| Geo-Fencing | Restrict access to specific geographic regions | P3 |
| Device Trust | Require device compliance (MDM) for access | P3 |
| Identity Provider Mode | Support for external IdP as identity source of truth | P3 |

### Dependencies

- SSO depends on Identity module (R1) + OAuth infrastructure (R2)
- Field-level permissions depend on RBAC (R1) + custom fields (R2)
- Data residency depends on Tenant module (R1) + multi-region (R3)
- Custom objects depend on custom fields (R2) + search (R3)
- Billing depends on Stripe integration (new) + tenant lifecycle (R1)
- Marketplace depends on developer portal + webhooks + billing
- 50+ integrations depend on Integration Hub (R2) + connector SDK
- ISO 27001 depends on SOC 2 readiness (R2) + security program

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Integration connector breakage (API changes) | High | Medium | Daily health checks; versioned connectors; deprecation policy |
| SAML SSO integration complexity | Medium | Medium | Use mature library (python3-saml); thorough testing with major IdPs |
| Custom objects performance at scale | Medium | High | EAV pattern with caching; materialized views; query optimization |
| Silo migration data integrity | Medium | Critical | Pre/post migration verification; rollback plan; maintenance window |
| Marketplace legal/compliance complexity | Medium | Medium | Legal review; app review process; terms of service; indemnification |
| ISO 27001 certification timeline | Medium | Medium | Engage certification body early; gap analysis at R3 end |

### Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Paying organizations | 5,000 | Stripe subscription count |
| Active users | 500,000 | DAU tracking |
| Enterprise customers (> 1,000 users) | 20 | Account tier tracking |
| Integrations | 50+ | Integration Hub counter |
| Marketplace apps | 20+ | Marketplace counter |
| Net revenue retention | > 130% | Monthly billing |
| Annual churn (enterprise) | < 5% | Account tracking |
| API p95 latency | < 200ms at 5,000 orgs | Prometheus histogram |
| API availability | 99.99% | Blackbox monitoring |
| ISO 27001 certification | Certified | External audit |

### Exit Criteria

- [x] Enterprise SSO: SAML 2.0, OIDC, Okta, Azure AD, Google, JIT provisioning, SCIM
- [x] Field-level permissions: read/write restriction per role per field
- [x] Data residency: Pool -> Silo migration, dedicated EU/US/APAC databases
- [x] Custom objects: user-defined entities, fields, relationships, API, search
- [x] Billing & subscription: Stripe integration, metering, invoicing, proration
- [x] Marketplace: app listing, install/uninstall, billing, developer submission
- [x] Developer portal: API reference, playground, SDK, app registration
- [x] 50+ integrations: major platforms and niche tools
- [x] ISO 27001 certification ready (or in progress)
- [x] HIPAA BA readiness for healthcare customers
- [x] 5,000 paying organizations onboarded
- [x] All non-functional requirements for R4 met (performance, security, availability)

---

## 6. Dependency Graph

### Inter-Phase Dependencies

```
R1 ─────────────────────────────────────────────────────────────► R2
 ├── Foundation (Phase 0)                               ├── Advanced Workflow (depends on R1 Workflow)
 ├── Identity + RBAC + Tenant (Phases 1-2)              ├── Reports + Dashboards (depends on R1 entities)
 ├── Lead/Contact/Account (Phase 3)                     ├── Calendar Sync (depends on OAuth infra)
 ├── Pipeline/Opportunity (Phase 4)                     ├── Integration Hub (depends on REST API v1)
 ├── Activities/Tasks (Phase 4)                         ├── Custom Fields (depends on entity models)
 ├── Basic Workflow (Phase 5)                           ├── SOC 2 + GDPR (depends on Audit module)
 ├── Email Notifications (Phase 6)                      └── Webhook System (depends on event system)
 └── REST API v1 (Phase 1-4)
                                                              │
                                                              ▼
R2 ─────────────────────────────────────────────────────────────► R3
 ├── AI Gateway (new service, independent)              ├── Multi-Region (depends on K8s)
 ├── Embedding Pipeline (depends on entity models)      ├── Performance Optimization (depends on metrics)
 ├── Semantic Search (depends on pgvector)              ├── Voice AI (depends on AI Gateway)
 ├── AI Assistant (depends on AI Gateway + Prompts)     └── Inbound Webhooks (depends on webhook infra)
 ├── Lead Scoring (depends on entity data)
 └── RAG Pipeline (depends on document storage)
                                                              │
                                                              ▼
R3 ─────────────────────────────────────────────────────────────► R4
 ├── SSO (depends on Identity module)                   ├── 50+ Integrations (depends on Integration Hub)
 ├── Field Permissions (depends on RBAC + Custom Fields)├── Marketplace (depends on Billing + Dev Portal)
 ├── Data Residency (depends on Tenant + Multi-Region)  └── ISO 27001 (depends on SOC 2 program)
 ├── Custom Objects (depends on Custom Fields)
 ├── Billing (depends on Tenant lifecycle)
 └── Developer Portal (depends on REST API)
```

### Parallelization Opportunities

| Parallel Tracks | When | Benefit |
|----------------|------|---------|
| R1 Phase 3 (Lead/Contact) + Phase 4 (Pipeline/Opportunity) | Month 3-4 | Phase 4 models designed in parallel with Phase 3 API design |
| R1 Phase 5 (Workflow) + R2 Phase 6 (Notifications) | Month 5-6 | Notifications implement Workflow Action interface |
| R2 Reports + R2 Calendar Sync | Month 8-9 | Independent feature tracks |
| R3 Multi-Region Infra + R3 AI Features | Month 13-15 | Infrastructure team and AI team work independently |
| R4 SSO + R4 Field Permissions | Month 19-20 | Independent enterprise features |
| R4 Custom Objects + R4 Billing | Month 21-22 | Custom Objects needs billing for marketplace |

---

## 7. Risk Register

### Consolidated Risk Register (All Phases)

| Risk | Phases | Likelihood | Impact | Mitigation |
|------|--------|-----------|--------|------------|
| Cross-tenant data leak due to RLS gap | 2-11 | Low | Critical | RLS test suite in CI; migration linter; pair review on RLS changes |
| Workflow engine creates infinite loops | 5 | Medium | Critical | Depth limit (10); cycle detection; self-terminating flag |
| AI LLM costs exceed budget | 8-9 | High | Medium | Per-org budget caps; model tiering; caching; cost dashboards |
| Multi-region DB replication latency | 11 | High | High | Read-from-replica; write-to-primary; monitor replication lag |
| Integration connector breakage | 10 | High | Medium | Daily health checks; versioned connectors; deprecation policy |
| Team cannot sustain migration pace | 1-11 | Medium | Medium | Automated migration generation; review checklist; squash regularly |
| PostgreSQL connection exhaustion | 3-11 | Medium | High | Pgbouncer mandatory; connection pooling; monitoring at 80% |
| Celery worker OOM from long tasks | 5-11 | Medium | High | Task timeouts (30s); separate queues; concurrency limits |
| GDPR deletion compliance failure | 3-11 | Low | Critical | Anonymization + retention audit; GDPR test suite; legal review |
| AI hallucination in generated content | 8-9 | High | High | AI content tagged; user confirmation; fact-checking layer |
| Prompt injection via CRM data fields | 8 | Medium | Critical | Input sanitization; output filtering; rate limits |
| Single person bus factor | 0-11 | Medium | Medium | Documentation; pair programming; code review required |
| Django Admin exposes too much data | 1 | Low | Medium | Admin restricted; tenant-scoped admin; audit on admin actions |
| Async queue backlog during traffic spike | 5-11 | Medium | Medium | Named queues; autoscaling workers; queue depth alerts |
| SSO integration complexity (SAML) | 11 | Medium | Medium | Mature library (python3-saml); thorough IdP testing |
| Report query performance on large data | 7 | High | High | Materialized views; query timeout (30s); result caching |
| OAuth token expiry disrupts sync | 10 | High | High | Proactive refresh; notification; manual re-auth flow |
| Email deliverability (spam) | 6 | Medium | High | SPF/DKIM/DMARC; dedicated IPs; warm-up process |
| Audio streaming complexity | 9 | High | High | Start with recorded analysis; add real-time streaming later |
| Custom objects performance at scale | 11 | Medium | High | EAV with caching; materialized views; query optimization |

---

## 8. Success Metrics Dashboard

### North Star Metrics

| Metric | R1 | R2 | R3 | R4 | Ultimate Target |
|--------|-----|-----|-----|-----|-----------------|
| Paying organizations | 50 | 200 | 1,000 | 5,000 | 50,000 |
| Active users | 2,500 | 20,000 | 100,000 | 500,000 | 5M |
| Annual Recurring Revenue | $200K | $1.5M | $8M | $25M | $250M |
| Net Revenue Retention | — | > 110% | > 120% | > 130% | > 130% |
| NPS | > 30 | > 40 | > 45 | > 50 | > 60 |

### Leading Indicators

| Indicator | R1 | R2 | R3 | R4 |
|-----------|-----|-----|-----|-----|
| Daily active users / monthly active users | > 20% | > 25% | > 30% | > 35% |
| Time to first value (minutes) | < 15 | < 10 | < 5 | < 5 |
| Workflow adoption (% of orgs) | > 20% | > 40% | > 60% | > 70% |
| AI feature adoption (% of users) | — | — | > 30% | > 50% |
| Integration connections per org (avg) | — | 2 | 3 | 5 |
| API requests/day | 100K | 5M | 50M | 500M |
| API p95 latency (ms) | < 200 | < 200 | < 200 | < 200 |
| Platform uptime (%) | 99.9% | 99.95% | 99.95% | 99.99% |
| Support ticket volume (per user/month) | < 1 | < 0.5 | < 0.3 | < 0.2 |
| Test coverage (%) | > 90 | > 90 | > 90 | > 90 |

### Revenue Model Projections

| Tier | R1 Price | R1 Orgs | R4 Price | R4 Orgs |
|------|---------|---------|---------|---------|
| Free | $0 | Unlimited | $0 | Unlimited |
| Growth | $29/user/mo | 30 | $29/user/mo | 2,500 |
| Pro | $59/user/mo | 15 | $59/user/mo | 1,500 |
| Enterprise | $79/user/mo | 5 | $79/user/mo | 1,000 |

### Growth Targets

```
Orgs:  50 ──► 200 ──► 1,000 ──► 5,000
ARR:  $200K ──► $1.5M ──► $8M ──► $25M
Users: 2.5K ──► 20K ──► 100K ──► 500K
        R1        R2        R3        R4
```

---

> **This roadmap is a living document, updated quarterly.**
> Dates and feature scope are targets, not guarantees. Priorities shift based on customer feedback,
> market conditions, and engineering velocity. The dependency graph, risk register, and success
> metrics are the binding elements — features within a phase may be re-prioritized as long as
> dependencies and exit criteria are respected.
>
> **Last Updated:** 2026-07-27
> **Owner:** Product Management
