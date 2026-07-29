# Implementation Plan: Module Build Order (2 Days Per Module)

> **Cadence:** 1 module = 2 days (Day 1: Backend models+APIs, Day 2: Frontend components+integration)  
> **Total:** 24 modules x 2 days = 48 days (~10 weeks)  
> **Goal:** Each module is demo-able at the end of its 2-day window

---

## Phase 0 — Foundation (Modules 1–4, Days 1–8)

Build the platform bedrock. After this phase, you have a login system with orgs and permissions.

### Module 1: shared_kernel (Day 1–2)

**Why first:** Every module imports from here. Cannot build anything else without it.

**Day 1 — Backend:**
- Implement `aggregate_root.py` — `AggregateRoot` base class with `id`, `domain_events`, `__eq__`
- Implement `value_objects.py` — `ValueObject` base, `Email`, `Phone`, `Address`, `Money`
- Implement `result.py` — `Result[T, E]`, `Ok`, `Err`, `PaginatedResult`
- Implement `domain_event.py` — `DomainEvent` base with `event_id`, `aggregate_id`, `occurred_at`
- Implement `base_model.py` — `UUIDModel`, `TimestampedModel`, `SoftDeleteModel`, `TenantScopedModel`
- Implement `uuid7.py` — UUID v7 generation function
- Implement `repository.py` — `Repository[T, ID]` protocol/ABC
- Implement `event_bus.py` — InProcess event publisher + RabbitMQ publisher stub

**Day 2 — Frontend:**
- No UI for shared_kernel (it's infrastructure)
- Set up frontend project scaffolding: Vite + React + TypeScript + MUI + TanStack Query + Zustand
- Create `src/shared/` folder with `api.ts` (Axios instance), `types/`, `utils/`
- Create app shell: `Shell.tsx` (sidebar + topbar + content area), theme config

**Files to create:**
```
backend/apps/shared_kernel/domain/
├── __init__.py
├── aggregate_root.py
├── value_objects.py
├── result.py
├── domain_event.py
└── errors.py

backend/apps/shared_kernel/infrastructure/
├── __init__.py
├── base_model.py         # (renamed from models.py to avoid confusion)
├── uuid7.py
├── repository.py
├── event_bus.py
├── cache.py
└── clock.py

backend/apps/shared_kernel/api/
├── __init__.py
├── pagination.py
└── exception_handlers.py

frontend/src/
├── App.tsx
├── main.tsx
├── shared/
│   ├── api/
│   │   ├── client.ts          # Axios with interceptors
│   │   └── types.ts           # PaginatedResponse, ApiError
│   ├── components/
│   │   ├── Layout/
│   │   │   ├── Shell.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── Topbar.tsx
│   │   └── ui/
│   │       ├── Button.tsx
│   │       ├── Card.tsx
│   │       ├── Table.tsx
│   │       ├── Modal.tsx
│   │       ├── FormField.tsx
│   │       └── Badge.tsx
│   └── theme.ts
```

---

### Module 2: identity (Day 3–4)

**Why second:** Need users and auth before anything else.

**Day 3 — Backend:**
- `User` aggregate: User model (email, password, name, is_active, is_verified)
- `Session` entity: JWT refresh token tracking
- `AuthService`: register, login, logout, refresh_token, forgot_password, reset_password
- `JWTService`: encode/decode access + refresh tokens
- `UserService`: CRUD for users
- API: `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`
- API: `GET/PUT /users/me`, `GET /users`, `GET /users/{id}`
- Middleware: `JWTAuthenticationMiddleware`

**Day 4 — Frontend:**
- `features/auth/` — LoginPage, RegisterPage, ForgotPasswordPage, ResetPasswordPage
- `features/auth/stores/authStore.ts` — Zustand store (user, token, isAuthenticated)
- `features/auth/api/` — login(), register(), refresh(), logout()
- Protected route wrapper, redirect if not authenticated
- `features/users/` — User list page (admin), profile page

---

### Module 3: tenant + organization (Day 5–6)

**Why third:** Need org context before leads/contacts can exist.

**Day 5 — Backend:**
- `Tenant` aggregate: tenant_id, name, slug, tier, is_active, settings
- `Organization` aggregate: org details, subscription_tier, settings
- `Membership` entity: user ↔ organization with role
- `TenantService`: provision, suspend, activate tenant
- `OrgService`: create org, invite member, accept invite
- `RLSPolicyService`: generate PostgreSQL RLS policies per tenant
- Middleware: `TenantResolutionMiddleware` (extract tenant from subdomain/header)
- API: `POST /orgs`, `GET /orgs/{id}`, `POST /orgs/{id}/invite`, `POST /orgs/accept-invite`

**Day 6 — Frontend:**
- `features/org/` — OrgSetupWizard (first-run flow), OrgSettings page
- `features/org/stores/orgStore.ts` — current org state
- Tenant switcher in sidebar (if multi-tenant user)
- Invite member dialog, accept invite page

---

### Module 4: rbac (Day 7–8)

**Why fourth:** Permissions gate every action. Build after orgs exist.

**Day 7 — Backend:**
- `Role` aggregate: name, description, is_system_role
- `Permission` value object: codename (e.g., "lead.view_lead"), label, module
- `RoleAssignment` entity: user + role + scope (org-wide or entity-level)
- `RbacService`: create/assign/unassign roles, check permission
- Permission check middleware/decorator for ViewSets
- API: `GET/POST /roles`, `GET/POST /roles/{id}/assignments`, `GET /permissions`

**Day 8 — Frontend:**
- `features/rbac/` — Role management page, Permission matrix grid
- Role assignment dialog (select user + role)
- `hooks/usePermissions.ts` — check permission in components (hide/show UI)
- Sidebar menu items filtered by permissions

---

## Phase 1 — Core CRM (Modules 5–8, Days 9–16)

After this phase, you have a functional CRM: leads → contacts → pipeline → tasks.

### Module 5: lead_management (Day 9–10)

**Day 9 — Backend:**
- `Lead` aggregate: first_name, last_name, email, phone, company, source, status, score, owner
- `LeadSource`, `LeadStatus`, `LeadRating` value objects
- Status state machine (NEW→CONTACTED→QUALIFIED→CONVERTED)
- `LeadService`: CRUD, status change, assign, score, convert
- `LeadConversionService`: convert lead → contact + account + opportunity
- `LeadDeduplicationService`: detect duplicates by email/phone
- API: full REST for leads + /convert, /assign, /merge, /import, /export endpoints

**Day 10 — Frontend:**
- `features/leads/` — LeadListPage (table with filters), LeadDetailPage, LeadForm
- LeadKanban component (simple column view by status)
- LeadScoreBadge, LeadStatusBadge, LeadTimeline component
- Import dialog (CSV upload with field mapping)

---

### Module 6: contact_account (Day 11–12)

**Day 11 — Backend:**
- `Contact` aggregate: name, email, phone, job_title, lifecycle_stage, primary_account
- `Account` aggregate: name, website, industry, type, tier, parent_account, billing_address
- `ContactAccountRelation` entity: M2M with role
- `ContactService`, `AccountService`: CRUD, merge, hierarchy
- API: full REST for contacts + accounts + /merge, /hierarchy

**Day 12 — Frontend:**
- `features/contacts/` — ContactListPage, ContactDetailPage, ContactForm
- `features/accounts/` — AccountListPage, AccountDetailPage, AccountForm
- Account hierarchy tree view
- Contact-account association picker
- Merge dialog (select primary + duplicates, conflict resolution)

---

### Module 7: pipeline_management + opportunity (Day 13–14)

**Day 13 — Backend:**
- `Pipeline` aggregate: name, stages (ordered list)
- `Stage` entity: name, probability, order, is_won, is_lost
- `Opportunity` aggregate: name, amount, stage_id, pipeline_id, contact_id, account_id, close_date
- `PipelineService`, `ForecastService`: CRUD, stage progression, win/loss, forecasting
- API: full REST for pipelines + opportunities + /move-stage, /forecast

**Day 14 — Frontend:**
- `features/pipeline/` — PipelineKanban (drag cards between columns)
- PipelineColumn, OpportunityCard components
- `features/opportunities/` — OpportunityListPage, OpportunityDetailPage, OpportunityForm
- ForecastPage (summary by stage + expected revenue)

---

### Module 8: activity + task (Day 15–16)

**Day 15 — Backend:**
- `Activity` aggregate (immutable): entity_type, entity_id, type, subject, description, created_by
- `Task` aggregate: subject, description, priority, status, assigned_to, due_date
- `ActivityService`: log activity, get entity timeline
- `TaskService`: CRUD, assign, complete, defer, recurring tasks
- Auto-log activities on domain events (lead created, stage changed, etc.)
- Celery task: overdue task detection and notification
- API: full REST for activities + tasks + /timeline

**Day 16 — Frontend:**
- `features/activity/` — EntityTimeline component (reusable on any detail page)
- `features/tasks/` — TaskListPage, TaskForm, MyTasks widget
- Task status badge, priority indicator, overdue highlighting
- Quick-add task button in sidebar

---

## Phase 2 — Revenue (Modules 9–13, Days 17–26)

After this phase, you can sell: products → quotes → orders → invoices → contracts.

### Module 9: product (Day 17–18)

**Day 17 — Backend:**
- `Product` aggregate: name, sku, description, unit_price, cost_price, product_type, category, is_active
- `ProductCategory` entity: hierarchical categories
- `PriceBook` entity: named price lists
- `ProductService`: CRUD, category management
- API: full REST for products + categories + price books

**Day 18 — Frontend:**
- `features/products/` — ProductCatalogPage (grid view), ProductForm
- Category tree browser, price list editor
- Quick product lookup modal (for use in quote builder)

---

### Module 10: quote (Day 19–20)

**Day 19 — Backend:**
- `Quote` aggregate: quote_number, status, opportunity_id, contact_id, valid_until, subtotal, total
- `QuoteLineItem` entity: product_id, quantity, unit_price, discount, total
- `QuoteService`: CRUD, send, accept, reject, versioning
- `PricingService`: calculate totals, apply discounts
- API: full REST for quotes + /send, /accept, /reject, versions

**Day 20 — Frontend:**
- `features/quotes/` — QuoteListPage, QuoteBuilderPage (line item editor)
- Quote PDF preview, send dialog, accept/reject buttons
- Version history viewer

---

### Module 11: order + invoice (Day 21–22)

**Day 21 — Backend:**
- `Order` aggregate: order_number, status, quote_id, order_date, fulfillment tracking
- `Invoice` aggregate: invoice_number, status, order_id, due_date, amount_paid, balance_due
- `Payment` entity: amount, method, reference, date
- `OrderService`, `InvoiceService`: CRUD, fulfillment, payment recording
- API: full REST for orders + invoices + payments

**Day 22 — Frontend:**
- `features/orders/` — OrderListPage, OrderDetailPage
- `features/invoices/` — InvoiceListPage, InvoiceDetailPage, PaymentForm
- Invoice PDF download, aging report view

---

### Module 12: contract (Day 23–24)

**Day 23 — Backend:**
- `Contract` aggregate: contract_number, title, type, status, start_date, end_date, value, auto_renew
- `ContractMilestone` entity: title, due_date, completion_date, value
- `ContractVersion`, `ContractAmendment` entities
- `ContractService`: CRUD, renew, terminate, milestone management
- API: full REST for contracts + milestones + /renew, /terminate

**Day 24 — Frontend:**
- `features/contracts/` — ContractListPage, ContractDetailPage, ContractForm
- Milestone tracker (progress bar + timeline)
- Renewal/termination dialogs

---

### Module 13: approval (Day 25–26)

**Day 25 — Backend:**
- `ApprovalRequest` aggregate: entity_type, entity_id, status, priority, current_step
- `ApprovalStep` entity: step_number, approver_id, status, comments, decided_at
- `ApprovalChain` entity: reusable chain templates (e.g., "Quote > $10k")
- `ApprovalService`: submit, approve, reject, escalate, delegate
- API: full REST for requests + chains + delegations

**Day 26 — Frontend:**
- `features/approvals/` — PendingApprovalsPage, MyRequestsPage
- Approve/reject dialog with comment field
- Approval chain designer (visual step builder)

---

## Phase 3 — Communication (Modules 14–16, Days 27–32)

### Module 14: notification + calendar (Day 27–28)

**Day 27 — Backend:**
- `Notification` aggregate: recipient, type, channel, title, body, status, read_at
- `NotificationTemplate` entity: templates per type+channel
- `UserNotificationPreference` entity: channel opt-in/out, quiet hours
- `CalendarEvent` aggregate: title, start/end, organizer, attendees, recurrence
- `NotificationService`: dispatch via Email/SMS/InApp channels
- `CalendarService`: event CRUD, conflict detection
- Celery tasks: send notification, reminder dispatch
- API: full REST for notifications + preferences + events

**Day 28 — Frontend:**
- Notification bell in topbar with unread count + dropdown
- `features/notifications/` — NotificationListPage, PreferencesPage
- `features/calendar/` — CalendarPage (month/week/day views)
- Event create/edit dialog, attendee picker

---

### Module 15: document (Day 29–30)

**Day 29 — Backend:**
- `Document` aggregate: filename, mime_type, file_size, storage_path, checksum, version
- `DocumentVersion` entity: version history
- `Folder` entity: hierarchical folders
- `DocumentShare` entity: share links with expiry
- `StorageService`: abstract S3/MinIO/local backend
- `DocumentService`: upload, version, move, copy, share
- API: full REST for documents + folders + shares + /upload, /download, /preview

**Day 30 — Frontend:**
- `features/documents/` — DocumentListPage (file explorer), FolderTree
- Upload dialog (drag-and-drop), version history panel
- Share link dialog (generate + copy), download button

---

### Module 16: support_ticket + knowledge_base (Day 31–32)

**Day 31 — Backend:**
- `Ticket` aggregate: subject, description, status, priority, contact_id, assigned_to, sla_due
- `TicketReply` entity: author, body, is_public, attachments
- `TicketSLA` entity: first_response_minutes, resolution_minutes
- `Article` aggregate: title, slug, content, status, category, tags, view_count
- `Category` entity: hierarchical article categories
- `TicketService`, `ArticleService`: CRUD, SLA tracking, search
- API: full REST for tickets + replies + articles + categories + search

**Day 32 — Frontend:**
- `features/support/` — TicketListPage, TicketDetailPage (with reply thread)
- Ticket status badges, SLA timer display, CSAT survey form
- `features/knowledge-base/` — ArticleListPage, ArticleReaderPage
- Category tree, search bar, article feedback (helpful/not helpful)

---

## Phase 4 — Intelligence (Modules 17–20, Days 33–40)

### Module 17: workflow (Day 33–34)

**Day 33 — Backend:**
- `WorkflowDefinition` aggregate: name, module, trigger_type, trigger_config, conditions, actions
- `WorkflowCondition`, `WorkflowAction` entities
- `WorkflowExecution` entity: status, result, error, execution_context
- `ConditionEvaluator`: evaluate conditions against entity state
- `ActionExecutor`: execute actions (send email, update field, assign owner)
- `EventRouter`: subscribe to domain events → match workflows → execute
- Celery task: execute_workflow with retry
- API: full REST for workflows + executions

**Day 34 — Frontend:**
- `features/workflows/` — WorkflowListPage, WorkflowBuilderPage
- Trigger config picker (event dropdown / cron input)
- Condition builder (field + operator + value rows)
- Action config forms per action type
- Execution history table with status badges

---

### Module 18: reports + dashboard (Day 35–36)

**Day 35 — Backend:**
- `Report` aggregate: name, source_module, config (fields, filters, groupings), visualization
- `ReportExecution` entity: started_at, completed_at, status, row_count
- `ReportSchedule` entity: frequency, format, recipients
- `Dashboard` aggregate: name, layout, widgets
- `Widget` entity: widget_type, config, position, refresh_interval
- `ReportExecutionEngine`: dynamic SQL generation, aggregation, export (CSV/XLSX/PDF)
- `DashboardService`: CRUD, widget data fetching
- API: full REST for reports + dashboards + widgets + /run, /export, /data

**Day 36 — Frontend:**
- `features/reports/` — ReportListPage, ReportBuilderPage (drag fields)
- Report view page (table + chart), export buttons, schedule dialog
- `features/dashboards/` — DashboardPage with widget grid
- Widget types: KPI card, Chart (bar/line/pie), Table, ActivityFeed
- Add/remove/move widgets, refresh interval picker

---

### Module 19: campaign (Day 37–38)

**Day 37 — Backend:**
- `Campaign` aggregate: name, type, status, goal, budget, start/end dates, channel_config
- `Segment` aggregate: name, criteria (filter expression tree), is_dynamic
- `EmailTemplate` entity: subject, html_body, variables_schema
- `CampaignMetric` entity: sends, opens, clicks, conversions, revenue
- `SegmentEvaluator`: execute segment criteria against DB
- `CampaignExecutionService`: send campaign via notification channels
- API: full REST for campaigns + segments + templates + metrics

**Day 38 — Frontend:**
- `features/campaigns/` — CampaignListPage, CampaignForm, CampaignDetailPage
- Segment builder (filter builder UI with AND/OR groups)
- Email template editor with variable insertion
- Campaign analytics page (opens, clicks, conversions chart)

---

### Module 20: custom_fields + custom_modules (Day 39–40)

**Day 39 — Backend:**
- `CustomFieldDefinition` aggregate: entity_type, field_name, field_label, field_type, options, validation
- `FieldGroup` entity: logical grouping of fields
- `EntityCustomData` entity: JSONB storage per entity instance
- `CustomModule` aggregate: name, label, icon, feature flags (enable_activities, etc.)
- `CustomModuleRecord` entity: JSONB data row per module instance
- `CustomFieldService`: manage field definitions, get/set values on entities
- `CustomModuleService`: module CRUD, dynamic record CRUD
- API: full REST for custom fields + custom modules + dynamic record endpoints

**Day 40 — Frontend:**
- `features/custom-fields/` — FieldManagerPage (add/edit/reorder fields per entity)
- Field form (type selector, option editor, validation rules)
- Dynamic form rendering (read field definitions → render form inputs)
- Custom field values appear on entity detail/edit pages
- `features/custom-modules/` — ModuleBuilderPage, ModuleDataPage
- Dynamic table/list view for custom module records

---

## Phase 5 — Platform (Modules 21–24, Days 41–48)

### Module 21: ai + voice_ai (Day 41–42)

**Day 41 — Backend:**
- FastAPI sidecar: `ai_gateway/` with LLM proxy, embeddings, RAG endpoints
- Django `ai/` app: AiQuery, AiResponse models, gateway_client.py
- `AiService`: query LLM, generate embeddings, sentiment analysis
- `voice_ai/` app: Call, Transcription, CallAnalysis models
- Twilio integration for voice calls
- API: `POST /ai/query`, `POST /ai/embeddings`, `POST /ai/analyze/sentiment`
- WebSocket: streaming AI responses via Django Channels

**Day 42 — Frontend:**
- `features/ai/` — AiChatWidget (floating chat bubble), AiQueryInput
- AI suggestion cards on lead/opportunity detail pages
- Voice call log viewer, transcription display

---

### Module 22: integrations (Day 43–44)

**Day 43 — Backend:**
- `Connector` aggregate: name, provider, auth_method, config, sync_direction
- `OAuthToken` entity: encrypted token storage, refresh logic
- `WebhookSubscription` entity: events, target_url, secret, retry config
- `ConnectorService`: CRUD, OAuth flow, sync execution
- Built-in connectors: Google Contacts, Google Calendar, HubSpot, Mailchimp
- `WebhookService`: deliver events, retry with backoff, signing
- API: full REST for integrations + connectors + webhooks

**Day 44 — Frontend:**
- `features/integrations/` — IntegrationMarketplacePage (list available connectors)
- OAuth connect flow (redirect → callback → success)
- Webhook management page (create/edit subscriptions, view delivery logs)
- Connector settings page per provider

---

### Module 23: settings + audit + search (Day 45–46)

**Day 45 — Backend:**
- `AppSetting` aggregate: key, value, type, scope (org/user)
- `FeatureFlag` aggregate: key, enabled, scope
- `AuditEvent` aggregate (append-only): actor, action, entity_type, entity_id, changes, timestamp
- `GdprRequest` entity: data export/deletion requests
- `SearchIndex` entity: indexed entities for FTS + vector search
- `AuditService`: log events, search audit trail, GDPR data portability
- `SearchService`: full-text search across all entities, vector search for AI
- API: settings CRUD, audit log search, global search endpoint

**Day 46 — Frontend:**
- `features/settings/` — SettingsPage (tabs by category), FeatureFlag toggles
- `features/audit/` — AuditLogPage (searchable, filterable event log)
- Global search bar in topbar (search across leads, contacts, accounts, etc.)
- Search results dropdown with entity type icons

---

### Module 24: import_export (Day 47–48)

**Day 47 — Backend:**
- Extend django-import-export for all entity types
- Import templates (field mapping presets per entity)
- Import validation with error reporting
- Export with filtered queries and format selection
- Celery task: async bulk import processing
- API: `POST /import/{entity_type}`, `GET /import/{entity_type}/template`
- API: `GET /export/{entity_type}?format=csv&filters=...`

**Day 48 — Frontend:**
- Import dialog on each entity list page (upload → map fields → validate → execute)
- Import preview with row-level error highlighting
- Export button with format picker and filter summary
- Import/export history page

---

## Summary Timeline

```
Week 1-2:  shared_kernel → identity → tenant/org → rbac
Week 3-4:  lead_management → contact_account → pipeline/opportunity → activity/task
Week 5-7:  product → quote → order/invoice → contract → approval
Week 8-9:  notification/calendar → document → support_ticket/knowledge_base
Week 10-12: workflow → reports/dashboard → campaign → custom_fields/modules
Week 13-14: ai/voice_ai → integrations → settings/audit/search → import_export
```

**Milestone checkpoints:**
- **Day 8:** Working platform (auth, orgs, permissions) — can add users
- **Day 16:** Core CRM (leads, contacts, pipeline, tasks) — can demo to sales team
- **Day 26:** Revenue engine (products, quotes, orders, invoices, contracts) — can transact
- **Day 32:** Communication (notifications, documents, support, KB) — can serve customers
- **Day 40:** Intelligence (workflows, reports, campaigns, customization) — can automate
- **Day 48:** Full platform (AI, integrations, audit, search, import/export) — can scale