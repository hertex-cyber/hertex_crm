# Gap Analysis: Planned CRM Modules vs TZAHU Implementation

> **Status:** Foundational Design Phase (Phase 0)  
> **Date:** 2026-07-27  
> **Scope:** Cross-references the 32-module enterprise CRM feature list against TZAHU's registered apps, on-disk directory stubs, and documented module blueprints.

---

## 1. TZAHU Architecture (4-Layer Modular Monolith)

```
┌──────────────────────────────────────────────────────────┐
│                    API Layer (DRF ViewSets)               │
│  views.py · serializers.py · permissions.py · urls.py    │
│  filters.py · throttling.py                              │
├──────────────────────────────────────────────────────────┤
│               Application Layer (Use Cases)              │
│  services.py · commands.py · queries.py · unit_of_work   │
│  Adapters: event_handlers.py                             │
├──────────────────────────────────────────────────────────┤
│                Domain Layer (Business Logic)              │
│  models.py · value_objects.py · events.py · exceptions   │
├──────────────────────────────────────────────────────────┤
│             Infrastructure Layer (Persistence/IO)         │
│  models.py · repositories.py · tasks.py · admin.py       │
│  selectors.py · external_clients.py · channels/          │
└──────────────────────────────────────────────────────────┘
```

---

## 2. Coverage Matrix: 32 Modules × TZAHU Assets

### Legend
| Icon | Meaning |
|------|---------|
| ✅ | Covered — app exists with documented structure |
| ◐ | Partial — app exists but scope is narrower than needed |
| ❌ | Missing — no app, no blueprint |
| 📄 | Blueprint document exists in docs/ModuleBlueprints/ |

### Row Key
- **App Dir** = on-disk directory under `backend/apps/`
- **INSTALLED_APPS** = registered in `base.py`
- **Blueprint** = `.md` file in `docs/ModuleBlueprints/`
- **Phase** = recommended implementation priority

| # | CRM Module | App Dir | INSTALLED_APPS | Blueprint | Coverage | Phase | Notes |
|---|-----------|---------|---------------|-----------|----------|-------|-------|
| 1 | User & Org Management | identity/ organization/ tenant/ rbac/ | ✅ | ✅ Identity_and_MultiTenancy | ✅ Full | 0 | Auth, JWT, org hierarchy, RBAC, multi-tenant provisioning |
| 2 | Customer Management | lead_management/ contact_account/ | ✅ | ✅ Lead_Management, Contact_and_Account | ✅ Full | 0 | Leads + Contacts + Accounts combined |
| 3 | Lead Management | lead_management/ | ✅ | ✅ Lead_Management | ✅ Full | 0 | Scoring, sources, lifecycle, dedup |
| 4 | Opportunity / Pipeline | pipeline_management/ opportunity/ | ✅ | ✅ Pipeline_and_Opportunity | ✅ Full | 0 | Kanban stages, forecasting, win/loss |
| 5 | Contact Management | contact_account/ | ✅ | ✅ Contact_and_Account | ✅ Full | 0 | Lives alongside accounts in same app |
| 6 | Account / Company | contact_account/ | ✅ | ✅ Contact_and_Account | ✅ Full | 0 | B2B org profiles, hierarchy |
| 7 | Activity Management | activity/ | ✅ | ✅ Activity_and_Task | ✅ Full | 0 | Entity timeline, logging |
| 8 | Task Management | task/ | ✅ | ✅ Activity_and_Task | ✅ Full | 0 | Assignments, due dates, priorities |
| 9 | Calendar | calendar/ | ✅ | ✅ Notification_Engine | ✅ Full | 0 | Events, Google/MS sync |
| 10 | Email Module | notification/ | ✅ | ✅ Notification_Engine | ◐ Partial | 0 | Has email channel; no dedicated compose/inbox UI |
| 11 | Communication Center | notification/ voice_ai/ | ✅ | ✅ Notification_Engine | ◐ Partial | 1 | SMS, WhatsApp, voice calls exist; Live Chat + Social Inbox missing |
| 33 | Unified Inbox / Social Inbox | conversations/ | ❌ | ❌ Missing | ❌ Missing | 2 | WhatsApp, Instagram DM, Facebook Messenger, Live Chat — no module exists |
| 12 | Sales Module (Quotes/Orders/Invoices) | product/ quote/ order/ invoice/ | ✅ New | ✅ Product_and_Sales | ✅ Full | 1 | Directories + apps.py + blueprint created, no code yet |
| 13 | Product Catalog | product/ | ✅ New | ✅ Product_and_Sales | ✅ Full | 1 | Blueprint created, no code yet |
| 14 | Quotation Module | quote/ | ✅ New | ✅ Product_and_Sales | ✅ Full | 1 | Blueprint created, no code yet |
| 15 | Invoice Module | invoice/ | ✅ New | ✅ Product_and_Sales | ✅ Full | 1 | Blueprint created, no code yet |
| 16 | Contract Management | contract/ | ✅ New | ✅ Contract_Management | ✅ Full | 1 | Blueprint created, no code yet |
| 17 | Customer Support | support_ticket/ | ✅ New | ✅ Customer_Support | ✅ Full | 2 | Blueprint created, no code yet |
| 18 | Knowledge Base | knowledge_base/ | ✅ New | ✅ Knowledge_Base | ✅ Full | 2 | Blueprint created, no code yet |
| 19 | Marketing Module | campaign/ | ✅ New | ✅ Marketing_Campaigns | ✅ Full | 2 | Blueprint created, no code yet |
| 20 | Workflow Automation | workflow/ | ✅ | ✅ Workflow_Engine | ✅ Full | 0 | Condition/action engine, Celery execution |
| 21 | Approval Workflow | approval/ | ✅ New | ✅ Approval_Workflow | ✅ Full | 1 | Blueprint created, no code yet; extends workflow engine |
| 22 | Reports & Analytics | reports/ | ✅ | ✅ Reports_and_Dashboards | ✅ Full | 0 | Report builder, SQL engine, CSV/XLSX/PDF export |
| 23 | Dashboard | dashboard/ | ✅ | ✅ Reports_and_Dashboards | ✅ Full | 0 | Widgets, layouts, sharing |
| 24 | Notification Center | notification/ | ✅ | ✅ Notification_Engine | ✅ Full | 0 | Multi-channel delivery, templates, preferences |
| 25 | Document Management | document/ | ✅ New | ✅ Document_Management | ✅ Full | 1 | Blueprint created, no code yet |
| 26 | Custom Module Builder | custom_modules/ | ✅ New | ✅ Custom_Fields_and_Modules | ✅ Full | 2 | Blueprint created, no code yet |
| 27 | Custom Fields | custom_fields/ | ✅ New | ✅ Custom_Fields_and_Modules | ✅ Full | 2 | Blueprint created, no code yet |
| 28 | Import & Export | — | import_export (3rd-party) | ❌ Missing | ✅ Full | 0 | Covered by django-import-export library |
| 29 | API & Integrations | integrations/ | ✅ | ✅ Integration_Hub | ✅ Full | 0 | Connector SDK, OAuth vault, webhooks, sync engine |
| 30 | Security & Access Control | rbac/ audit/ identity/ | ✅ | ✅ Identity_and_MultiTenancy | ✅ Full | 0 | RBAC, JWT, audit log, GDPR, RLS |
| 31 | AI Features | ai/ voice_ai/ | ✅ | ✅ AI_Platform | ✅ Full | 1 | LLM proxy, RAG, embeddings, sentiment, voice AI, MCP |
| 32 | Multi-Tenant Architecture | tenant/ | ✅ | ✅ Identity_and_MultiTenancy | ✅ Full | 0 | Pool/Silo hybrid, RLS, tenant lifecycle |

---

## 3. Summary Statistics

| Metric | Count |
|--------|-------|
| Total CRM modules evaluated | 33 |
| ✅ Fully covered | **32** — all have app directories + INSTALLED_APPS + blueprints |
| ◐ Partially covered (needs UI/feature expansion) | **2** — Email Module, Communication Center |
| ❌ Missing (no app dir or blueprint) | **1** — Unified Inbox / Social Inbox |
| Apps with directories + INSTALLED_APPS | 34 (22 original + 12 new) |
| Directories with `__init__.py` (functional packages) | 2 of 34 (shared_kernel, identity) |
| Module Blueprints existing | **18 of 34** (6 original + 12 new) |
| Blueprints still missing | 2 — Import & Export (covered by 3rd-party library), Unified Inbox / Social Inbox |

---

## 4. End-to-End Workflow Map

### 4a Core Sales Flow
```
Lead Capture (lead_management)
  → Lead Scoring & Qualification (lead_management, ai/)
  → Lead Conversion to Contact/Account/Opportunity (lead_management, contact_account, opportunity)
  → Pipeline Stage Progression (pipeline_management)
  → Win/Loss & Forecasting (pipeline_management, reports/)
  → Post-Sale Activity Logging (activity/)
  → Follow-up Tasks (task/)
```

### 4b Quote-to-Order-to-Invoice Flow
```
Opportunity Won (pipeline_management)
  → Generate Quote (quote/)
  → Quote Approval (approval/, workflow/)
  → Convert to Order (order/)
  → Order Fulfillment
  → Generate Invoice (invoice/)
  → Payment Tracking
  → Contract Creation (contract/) [for subscription/service deals]
```

### 4c Communication Flow
```
Inbound Email/SMS/WhatsApp (notification/)
  → Webhook Delivery (integrations/)
  → Notification Dispatch (notification/)
  → Voice Call Logging (voice_ai/)
  → In-App Notification (notification/ via WebSocket)

MISSING: Live Chat widget, Social Media Inbox (see row 33 — Unified Inbox / Social Inbox)
```

### 4d Support Flow
```
Customer Ticket Created (support_ticket/)
  → Ticket Routing & Assignment
  → SLA Tracking
  → Knowledge Base Suggestions (knowledge_base/, ai/)
  → Ticket Resolution
  → Satisfaction Survey
```

### 4e Automation Flow
```
Domain Event (any app)
  → Workflow Trigger (workflow/ via event bus)
  → Condition Evaluation (workflow/)
  → Action Execution (workflow/ via Celery)
  → Approval Request (approval/) [if multi-step approval needed]
  → Notification / Pipeline Update / Task Creation
```

### 4f Cross-Cutting Concerns
```
Multi-Tenant Resolution (tenant/ middleware)
  → Auth & JWT Validation (identity/)
  → Permission Check (rbac/)
  → Audit Logging (audit/)
  → Search Indexing (search/)
  → AI Query Processing (ai/ → ai_gateway/)
```

---

## 5. Recommended Implementation Phases

### Phase 0 — Foundation (NEXT)
- ✅ All 34 app directories created
- ✅ All 12 new apps registered in INSTALLED_APPS
- ✅ All 12 missing blueprints written (18 total)
- ⏳ **Build shared_kernel DDD bases** (AggregateRoot, ValueObject, Repository, Result[T])
- ⏳ **Build identity APIs** (auth, JWT, user CRUD, registration)
- ⏳ **Build tenant APIs** (org provisioning, RLS setup, membership)

### Phase 1 — Revenue Modules (HIGH PRIORITY)
| Module | Effort | Depends On |
|--------|--------|------------|
| Shared Kernel DDD Bases | 1 week | — |
| Product Catalog | 1 week | shared_kernel |
| Quotation Engine | 2 weeks | contact_account, product |
| Order Management | 2 weeks | quote, product |
| Invoice & Billing | 2 weeks | order |
| Contract Management | 1 week | contact_account, workflow |
| Approval Workflow | 1 week | workflow |
| Document Management | 2 weeks | shared_kernel, S3/MinIO |

### Phase 2 — Engagement Modules (MEDIUM PRIORITY)
| Module | Effort | Depends On |
|--------|--------|------------|
| Customer Support / Helpdesk | 3 weeks | contact_account, activity, notification |
| Knowledge Base | 2 weeks | search, document |
| Marketing Campaigns | 3 weeks | contact_account, notification, integrations |
| Custom Fields (EAV) | 2 weeks | shared_kernel |
| Custom Module Builder | 3 weeks | settings, custom_fields, rbac |
| Live Chat | 1 week | notification, integrations (WebSocket) |

### Phase 3 — Communication & Conversations (NEW)
| Module | Effort | Depends On |
|--------|--------|------------|
| Unified Inbox / Social Inbox | 4 weeks | contact_account, notification, integrations (Meta APIs, WhatsApp Cloud API) |
| Conversations API | 2 weeks | shared_kernel, integrations |
| Live Chat Widget | 1 week | conversations, notification (WebSocket) |

---

## 6. Technology Stack Alignment

| Layer | Technology | Status |
|-------|-----------|--------|
| Backend Framework | Django 5.x + DRF | Configured |
| Async | Channels + Redis | Configured |
| Task Queue | Celery + RabbitMQ | Configured |
| Database | PostgreSQL 16 (pgvector) | Configured |
| AI Backend | FastAPI sidecar (ai_gateway/) | Directory exists, not built |
| Frontend | React + TypeScript + Vite | Directory exists, not built |
| Mobile | React Native (Expo) | Placeholder only |
| Infra | Terraform + Kubernetes | Placeholder only |

---

## 7. Key Risks

1. **34 empty apps** — only 2 of 34 apps have `__init__.py`. The entire codebase is scaffolding with no runnable code.
2. **No shared_kernel migration** — DDD base classes exist in blueprints but are NOT importable from any app.
3. **No tests exist** — Not a single test file has been written across any app.
4. **AI Gateway not built** — ai/ app depends on FastAPI sidecar with no code yet.
5. **Frontend/Mobile not started** — all docs assume React frontend but no code exists.
6. **Infrastructure not provisioned** — Terraform/K8s configs are placeholders only.