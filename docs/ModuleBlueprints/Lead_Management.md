# Module Blueprint: Lead Management

- **Module:** `modules.lead`
- **Bounded Context:** Lead Acquisition & Qualification
- **Status:** Draft v1.0

## Business Purpose

The Lead Management module is the entry point for all potential customer data. It captures leads from multiple sources (web forms, manual entry, import, API, email parsing), qualifies them through scoring and enrichment, and transitions them into Contacts (with Accounts) when qualified. This module owns the lead-to-contact conversion workflow.

## Bounded Context

This module owns everything related to a "Lead" — a person or organization that has shown interest but is not yet qualified as a customer. It does NOT own Contacts, Accounts, or Opportunities (those belong to Pipeline module), but it emits events that those modules consume.

## Aggregates, Entities, Value Objects

### Aggregate: Lead
- **Lead** (Aggregate Root)
  - `id: UUID v7`
  - `tenant_id: UUID v7`
  - `first_name, last_name: str`
  - `email: EmailStr (unique per tenant)`
  - `phone: PhoneStr | None`
  - `company_name: str | None`
  - `job_title: str | None`
  - `lead_source: LeadSource (enum)`
  - `lead_status: LeadStatus (enum)`
  - `score: int (0-100)`
  - `rating: LeadRating (Hot/Warm/Cold)`
  - `owner_id: UUID v7 (FK to User) — nullable`
  - `assigned_team_id: UUID v7 (FK to Team) — nullable`
  - `converted_contact_id: UUID v7 — nullable (set on conversion)`
  - `converted_account_id: UUID v7 — nullable`
  - `converted_opportunity_id: UUID v7 — nullable`
  - `custom_fields: JSONB`
  - `tags: Array[str]`
  - `notes: Text`
  - `timestamps: created_at, updated_at, converted_at, last_contacted_at`

### Value Objects
- **LeadSource:** `enum(WEBSITE, REFERRAL, COLD_CALL, EVENT, PARTNER, ONLINE_AD, EMAIL_MARKETING, IMPORT, API, OTHER)`
- **LeadStatus:** `enum(NEW, CONTACTED, QUALIFIED, DISQUALIFIED, CONVERTED, JUNK)`
- **LeadRating:** `enum(HOT, WARM, COLD)`
- **ContactMethod:** `enum(EMAIL, PHONE, SMS, WHATSAPP, LINKEDIN, MAIL)`

### Entities
- **LeadActivity:** Log of interactions with a lead (calls, emails, meetings)
- **LeadAssignmentHistory:** Record of ownership changes
- **LeadDuplicate:** Record of potential duplicates (auto-detected)

## Domain Events

- `LeadCreated` — Lead captured from any source
- `LeadStatusChanged` — Status transition (e.g., NEW → CONTACTED)
- `LeadScored` — Score updated (manual or AI-driven)
- `LeadAssigned` — Owner or team assigned
- `LeadConverted` — Lead → Contact + Account conversion
- `LeadDisqualified` — Lead marked as disqualified (with reason)
- `LeadDuplicatesDetected` — Potential duplicates found

## Commands & Queries

### Commands (Commands change state)
- `CreateLead(source, data, owner?) → LeadId`
- `UpdateLead(lead_id, data) → Lead`
- `ChangeLeadStatus(lead_id, new_status, reason) → Lead`
- `AssignLead(lead_id, user_id) → Lead`
- `BulkAssignLeads(lead_ids, user_id) → int`
- `ScoreLead(lead_id, score, rating) → Lead`
- `ConvertLead(lead_id, target_data) → (Contact, Account, Opportunity)`
- `DisqualifyLead(lead_id, reason) → Lead`
- `MergeLeads(primary_id, duplicate_ids) → Lead`
- `ImportLeads(file, format, mapping) → ImportResult`
- `ExportLeads(filters, format) → File`

### Queries (Queries return data, no side effects)
- `GetLead(id) → Lead`
- `ListLeads(filters, sort, page) → PaginatedResult[Lead]`
- `SearchLeads(query, filters) → PaginatedResult[Lead]`
- `GetLeadTimeline(id) → List[Activity]`
- `GetLeadScoreDistribution() → Aggregation`
- `GetLeadConversionRate(start_date, end_date) → Decimal`
- `CheckDuplicateLeads(email, phone, company) → List[Lead]`

## Application Services

- `LeadService` — Orchestrates lead CRUD, status changes, assignment
- `LeadConversionService` — Handles lead → contact/account/opportunity conversion
- `LeadDeduplicationService` — Auto-detects and resolves duplicates (via pg_trgm)
- `LeadImportService` — CSV/XLSX import with validation and mapping
- `LeadExportService` — CSV/XLSX export with filtered queries
- `LeadScoringService` — Computes lead score (rule-based + AI signals)
- `LeadAssignmentService` — Auto-assigns leads via round-robin or skill-based

## API Endpoints

| Method | URL | Description | Permissions |
|--------|-----|-------------|-------------|
| GET | `/api/v1/leads/` | List leads (paginated, filterable) | `lead.view_lead` |
| POST | `/api/v1/leads/` | Create a new lead | `lead.add_lead` |
| GET | `/api/v1/leads/{id}/` | Get lead details | `lead.view_lead` |
| PUT | `/api/v1/leads/{id}/` | Update lead | `lead.change_lead` |
| PATCH | `/api/v1/leads/{id}/` | Partial update lead | `lead.change_lead` |
| DELETE | `/api/v1/leads/{id}/` | Soft-delete lead | `lead.delete_lead` |
| POST | `/api/v1/leads/{id}/assign/` | Assign lead to user | `lead.assign_lead` |
| POST | `/api/v1/leads/{id}/status/` | Change lead status | `lead.change_leadstatus` |
| POST | `/api/v1/leads/{id}/score/` | Update lead score | `lead.score_lead` |
| POST | `/api/v1/leads/{id}/convert/` | Convert lead to contact | `lead.convert_lead` |
| POST | `/api/v1/leads/{id}/merge/` | Merge duplicate leads | `lead.merge_lead` |
| GET | `/api/v1/leads/{id}/timeline/` | Get lead activity timeline | `lead.view_lead` |
| GET | `/api/v1/leads/{id}/duplicates/` | Get potential duplicates | `lead.view_lead` |
| POST | `/api/v1/leads/bulk-assign/` | Bulk assign leads | `lead.assign_lead` |
| POST | `/api/v1/leads/bulk-delete/` | Bulk soft-delete leads | `lead.delete_lead` |
| POST | `/api/v1/leads/import/` | Import leads from file | `lead.import_lead` |
| GET | `/api/v1/leads/export/` | Export leads to file | `lead.export_lead` |
| GET | `/api/v1/leads/stats/` | Lead statistics summary | `lead.view_lead` |

## Database Tables

See also: `CRM_Schema.md` for full DDL.

- `leads_lead` — Core lead table with all fields
- `leads_leadactivity` — Interaction log per lead
- `leads_leadassignmenthistory` — Ownership changes
- `leads_leadduplicate` — Potential duplicate records
- `leads_leadcustomfield` — Custom field definitions (per tenant)

### Key Indexes
- `(tenant_id, email)` — Unique per tenant (dedup)
- `(tenant_id, status)` — Status-based filtering
- `(tenant_id, owner_id)` — My leads query
- `(tenant_id, created_at)` — Time-based queries
- `(tenant_id, score)` — Scoring-based queries
- `_search_vector` GIN index for FTS

## Validation Rules

| Field | Rule |
|-------|------|
| email | Valid email format; unique per tenant (including in contacts) |
| phone | E.164 format preferred |
| lead_source | Must be valid enum |
| status | Transitions must follow state machine (NEW→CONTACTED→QUALIFIED→CONVERTED; NEW→DISQUALIFIED) |
| score | Integer 0-100 |
| rating | Derived from score: 0-30=Cold, 31-60=Warm, 61-100=Hot |
| owner_id | Must be active user in same tenant |
| custom_fields | Must match schema defined in custom field definitions |

## Workflows & State Machine

### Lead Status State Machine

```
                    ┌──────────┐
                    │   NEW    │
                    └────┬─────┘
                    ┌────┴─────┐
               ┌────▼──┐   ┌──▼────────┐
               │CONTACTED│  │DISQUALIFIED│
               └────┬───┘   └───────────┘
                    │
              ┌─────▼──────┐
              │  QUALIFIED  │
              └─────┬──────┘
              ┌─────┴──────┐
              │  CONVERTED  │
              └────────────┘
```

Allowed transitions:
- `NEW → CONTACTED`: Lead has been contacted
- `NEW → DISQUALIFIED`: Lead not a fit (reason required)
- `NEW → JUNK`: Spam or invalid data
- `CONTACTED → QUALIFIED`: Lead meeting criteria met
- `CONTACTED → DISQUALIFIED`: Failed qualification
- `QUALIFIED → CONVERTED`: Lead converted to contact+account+opportunity
- `QUALIFIED → DISQUALIFIED`: Lost during qualification
- Any state → `JUNK`: Admin action

### Auto-Assignment Workflow
1. Lead created → `LeadCreated` event
2. Assignment rules evaluated (territory, skill, round-robin, load balancing)
3. Lead auto-assigned to user/team → `LeadAssigned` event
4. Notification sent to assignee (in-app + email)

### Lead Conversion Workflow
1. User triggers `ConvertLead` command on QUALIFIED lead
2. System creates Contact (copy lead data)
3. System creates Account (if company_name, else creates for contact)
4. System creates Opportunity (default stage: New)
5. Lead marked as CONVERTED with `converted_*` FK references
6. `LeadConverted` domain event published

## Security & Permissions

| Permission | Codename | Description |
|------------|----------|-------------|
| View | `lead.view_lead` | View leads assigned to user or team |
| Add | `lead.add_lead` | Create new leads |
| Change | `lead.change_lead` | Update leads assigned to user |
| Delete | `lead.delete_lead` | Soft-delete leads |
| View All | `lead.view_all_leads` | View any lead in tenant |
| Change All | `lead.change_all_leads` | Change any lead in tenant |
| Assign | `lead.assign_lead` | Reassign leads |
| Change Status | `lead.change_leadstatus` | Change lead status |
| Convert | `lead.convert_lead` | Convert leads |
| Merge | `lead.merge_lead` | Merge duplicates |
| Import | `lead.import_lead` | Import leads |
| Export | `lead.export_lead` | Export leads |

Row-level security via RLS on `tenant_id`. Object-level via owner/team/custom permissions.

## Testing Strategy

| Layer | Tool | Focus |
|-------|------|-------|
| Unit | pytest | Domain models, Value Objects, State machine transitions, Scoring algorithm, Validation rules |
| Integration | pytest-django | Repository queries, Lead conversion workflow, Duplicate detection, Import/Export pipeline |
| API | DRF's APIClient | All endpoints, Permission enforcement, Pagination/filtering, Status transition validation |
| E2E | Playwright | Lead creation → conversion flow, Assignment workflow, Import UI |

Key test cases:
- Lead creation from different sources
- Status transition validation (invalid transitions rejected)
- Lead conversion creates contact+account+opportunity in same transaction
- Duplicate detection on email (exact and fuzzy via pg_trgm)
- Bulk operations (assign, delete) with correct permission checks
- Import with malformed data (rejected with meaningful errors)

## Future Enhancements

- **AI Lead Scoring:** ML model for lead scoring based on historical conversion data (FastAPI sidecar)
- **Web-to-Lead Forms:** Dynamic form generation with embeddable JavaScript snippet
- **Email Parsing:** Parse incoming email to create/update leads
- **Lead Lifecycle Analytics:** Conversion funnel, source attribution, time-to-conversion metrics
- **Enhanced Dedup:** ML-based fuzzy matching across leads, contacts, accounts
- **Lead Marketplace:** Buy/sell leads from partners
- **Lead Routing Rules Engine:** Custom assignment rules (UI-based, not code)
