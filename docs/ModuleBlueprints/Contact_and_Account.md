# Module Blueprint: Contact & Account

- **Module:** `apps.contact_account`
- **Bounded Context:** Contact & Account Management
- **Status:** Draft v1.0

## Business Purpose

The Contact & Account module manages the core CRM entities that represent people (Contacts) and organizations (Accounts). Contacts are individuals associated with one or more Accounts. Accounts represent companies, organizations, or other business entities. This module handles the complete lifecycle from creation through merge, enrichment, and segmentation.

## Bounded Context

This module owns Contacts and Accounts. It does NOT own Leads (which belong to Lead Management) or Opportunities (Pipeline Management). It emits events consumed by Activity, Pipeline, and Notification modules.

## Aggregates, Entities, Value Objects

### Aggregate: Contact
- **Contact** (Aggregate Root)
  - `id: UUID v7`
  - `tenant_id: UUID v7`
  - `salutation: str | None`
  - `first_name: str`
  - `last_name: str`
  - `email: EmailStr (unique per tenant)`
  - `phone: PhoneStr | None`
  - `mobile_phone: PhoneStr | None`
  - `job_title: str | None`
  - `department: str | None`
  - `primary_account_id: UUID v7 (FK to Account) — nullable`
  - `reports_to_id: UUID v7 (FK to Contact) — nullable`
  - `owner_id: UUID v7 (FK to User) — nullable`
  - `source: ContactSource`
  - `lifecycle_stage: LifecycleStage`
  - `preferred_contact_method: ContactMethod`
  - `preferred_language: str`
  - `custom_fields: JSONB`
  - `tags: Array[str]`
  - `notes: Text`
  - `timestamps: created_at, updated_at, last_contacted_at`

### Value Objects
- **ContactSource:** `enum(LEAD_CONVERSION, MANUAL, IMPORT, API, WEB_FORM, PARTNER_REFERRAL, SOCIAL_MEDIA)`
- **LifecycleStage:** `enum(SUBSCRIBER, LEAD, MARKETING_QUALIFIED, SALES_QUALIFIED, OPPORTUNITY, CUSTOMER, EVANGELIST, INACTIVE, LOST)`
- **ContactMethod:** `enum(EMAIL, PHONE, SMS, WHATSAPP, MAIL)`

### Aggregate: Account
- **Account** (Aggregate Root)
  - `id: UUID v7`
  - `tenant_id: UUID v7`
  - `name: str`
  - `legal_name: str | None`
  - `website: URL | None`
  - `phone: PhoneStr | None`
  - `email: EmailStr | None`
  - `industry: Industry | None`
  - `account_type: AccountType`
  - `account_tier: AccountTier`
  - `annual_revenue: Decimal | None`
  - `employee_count: int | None`
  - `parent_account_id: UUID v7 (FK to Account) — nullable`
  - `owner_id: UUID v7 (FK to User) — nullable`
  - `billing_address: Address`
  - `shipping_address: Address | None`
  - `description: Text`
  - `custom_fields: JSONB`
  - `tags: Array[str]`
  - `timestamps: created_at, updated_at, last_activity_at`

### Value Objects
- **Industry:** `enum(TECHNOLOGY, FINANCE, HEALTHCARE, EDUCATION, MANUFACTURING, RETAIL, REAL_ESTATE, MEDIA, ENERGY, TRANSPORTATION, HOSPITALITY, NONPROFIT, GOVERNMENT, OTHER)`
- **AccountType:** `enum(CUSTOMER, PARTNER, VENDOR, COMPETITOR, INVESTOR, OTHER)`
- **AccountTier:** `enum(PLATINUM, GOLD, SILVER, BRONZE, STANDARD)`
- **Address:** `{street, city, state, postal_code, country, lat, lng}`

### Entities
- **ContactAccountRelation:** Many-to-many relationship (contact can work for multiple accounts)
- **AccountHierarchy:** Parent-child account relationships
- **ContactEmailHistory:** Email address changes over time

## Domain Events

- `ContactCreated` — New contact added
- `ContactUpdated` — Contact details changed
- `ContactMerged` — Duplicate contacts merged
- `ContactDeleted` — Contact soft-deleted
- `AccountCreated` — New account created
- `AccountUpdated` — Account details changed
- `AccountMerged` — Duplicate accounts merged
- `AccountHierarchyChanged` — Parent account changed
- `ContactAssociatedWithAccount` — Contact linked to account
- `ContactLifecycleStageChanged` — Stage transition
- `ContactOwnerChanged` — Ownership reassigned

## Commands & Queries

### Commands
- `CreateContact(data) → ContactId`
- `UpdateContact(contact_id, data) → Contact`
- `DeleteContact(contact_id) → void`
- `MergeContacts(primary_id, duplicate_ids) → Contact`
- `AssociateContactWithAccount(contact_id, account_id, role) → Contact`
- `DisassociateContactFromAccount(contact_id, account_id) → void`
- `ChangeContactStage(contact_id, new_stage) → Contact`
- `CreateAccount(data) → AccountId`
- `UpdateAccount(account_id, data) → Account`
- `DeleteAccount(account_id) → void`
- `MergeAccounts(primary_id, duplicate_ids) → Account`
- `SetAccountParent(account_id, parent_id) → Account`

### Queries
- `GetContact(id) → Contact`
- `ListContacts(filters, sort, page) → PaginatedResult[Contact]`
- `SearchContacts(query, filters) → PaginatedResult[Contact]`
- `GetContactTimeline(id) → List[Activity]`
- `GetContactAccounts(id) → List[Account]`
- `GetAccount(id) → Account`
- `ListAccounts(filters, sort, page) → PaginatedResult[Account]`
- `SearchAccounts(query, filters) → PaginatedResult[Account]`
- `GetAccountHierarchy(id) → Tree[Account]`
- `GetAccountContacts(id) → List[Contact]`
- `GetAccountRevenueForecast(id) → Dict`
- `CheckDuplicateContacts(email, phone) → List[Contact]`
- `CheckDuplicateAccounts(name, domain) → List[Account]`

## Application Services

- `ContactService` — CRUD, stage management, ownership
- `AccountService` — CRUD, hierarchy management, tier management
- `ContactMergeService` — Dedup and merge contacts with conflict resolution
- `AccountMergeService` — Dedup and merge accounts
- `RelationshipService` — Manage contact-account associations
- `AccountHierarchyService` — Parent-child tree management

## API Endpoints

### Contacts
| Method | URL | Description | Permissions |
|--------|-----|-------------|-------------|
| GET | `/api/v1/contacts/` | List contacts | `contact.view_contact` |
| POST | `/api/v1/contacts/` | Create contact | `contact.add_contact` |
| GET | `/api/v1/contacts/{id}/` | Get contact details | `contact.view_contact` |
| PUT | `/api/v1/contacts/{id}/` | Update contact | `contact.change_contact` |
| PATCH | `/api/v1/contacts/{id}/` | Partial update | `contact.change_contact` |
| DELETE | `/api/v1/contacts/{id}/` | Soft-delete | `contact.delete_contact` |
| POST | `/api/v1/contacts/{id}/merge/` | Merge duplicates | `contact.merge_contact` |
| GET | `/api/v1/contacts/{id}/timeline/` | Activity timeline | `contact.view_contact` |
| GET | `/api/v1/contacts/{id}/accounts/` | Related accounts | `contact.view_contact` |
| POST | `/api/v1/contacts/import/` | Import contacts | `contact.import_contact` |
| GET | `/api/v1/contacts/export/` | Export contacts | `contact.export_contact` |

### Accounts
| Method | URL | Description | Permissions |
|--------|-----|-------------|-------------|
| GET | `/api/v1/accounts/` | List accounts | `account.view_account` |
| POST | `/api/v1/accounts/` | Create account | `account.add_account` |
| GET | `/api/v1/accounts/{id}/` | Get account details | `account.view_account` |
| PUT | `/api/v1/accounts/{id}/` | Update account | `account.change_account` |
| PATCH | `/api/v1/accounts/{id}/` | Partial update | `account.change_account` |
| DELETE | `/api/v1/accounts/{id}/` | Soft-delete | `account.delete_account` |
| POST | `/api/v1/accounts/{id}/merge/` | Merge duplicates | `account.merge_account` |
| GET | `/api/v1/accounts/{id}/contacts/` | Account contacts | `account.view_account` |
| GET | `/api/v1/accounts/{id}/hierarchy/` | Account hierarchy | `account.view_account` |
| POST | `/api/v1/accounts/{id}/parent/` | Set parent account | `account.change_account` |
| POST | `/api/v1/accounts/import/` | Import accounts | `account.import_account` |
| GET | `/api/v1/accounts/export/` | Export accounts | `account.export_account` |

## Database Tables

- `contact_account_contact` — Core contact table
- `contact_account_account` — Core account table
- `contact_account_contactaccountrelation` — M2M contact-account
- `contact_account_contactemailhistory` — Email change log
- `contact_account_contactmergehistory` — Merge audit trail
- `contact_account_accountmergehistory` — Merge audit trail

### Key Indexes
- `(tenant_id, email)` — Unique per tenant (contacts)
- `(tenant_id, name)` — Account name search
- `(tenant_id, owner_id)` — My contacts/accounts queries
- `(tenant_id, lifecycle_stage)` — Stage-based filtering
- `(tenant_id, primary_account_id)` — Contact-by-account query
- `(tenant_id, account_type, tier)` — Account segmentation
- `_search_vector` GIN index for FTS

## Validation Rules

| Field | Rule |
|-------|------|
| email | Valid format; unique per tenant (including leads) |
| phone | E.164 format preferred |
| lifecycle_stage | Transitions follow state machine |
| account.name | Required, unique per tenant |
| account.website | Valid URL format |
| annual_revenue | Non-negative decimal |
| employee_count | Positive integer |

## Workflows & State Machine

### Contact Lifecycle
```
SUBSCRIBER → MARKETING_QUALIFIED → SALES_QUALIFIED → OPPORTUNITY → CUSTOMER → EVANGELIST
Any state → INACTIVE or LOST
```

### Notification Events
- Contact milestone reached (e.g., stage change to CUSTOMER)
- Account owner changed
- Duplicate contact/account detected

## Security & Permissions

| Permission | Codename | Description |
|------------|----------|-------------|
| View Contact | `contact.view_contact` | View contacts assigned to user/team |
| Add Contact | `contact.add_contact` | Create contacts |
| Change Contact | `contact.change_contact` | Update contacts |
| Delete Contact | `contact.delete_contact` | Soft-delete contacts |
| Merge Contact | `contact.merge_contact` | Merge duplicate contacts |
| Import Contact | `contact.import_contact` | Import contacts |
| Export Contact | `contact.export_contact` | Export contacts |
| View Account | `account.view_account` | View accounts |
| Add Account | `account.add_account` | Create accounts |
| Change Account | `account.change_account` | Update accounts |
| Delete Account | `account.delete_account` | Delete accounts |
| Merge Account | `account.merge_account` | Merge accounts |

## Testing Strategy

| Layer | Tool | Focus |
|-------|------|-------|
| Unit | pytest | Value objects, Stage transitions, Merge conflict resolution, Validation rules |
| Integration | pytest-django | Contact-account association, Hierarchy queries, Duplicate detection |
| API | DRF APIClient | All endpoints, Permission enforcement, Merge workflow, Import/export |
| E2E | Playwright | Contact creation → account association → stage progression |

## Future Enhancements

- **Social Media Links:** LinkedIn, Twitter, Facebook profiles per contact
- **Account Health Score:** Automated scoring based on engagement, support tickets, payment history
- **Territory Management:** Geographic assignment and routing
- **Contact Role Hierarchy:** org chart visualization within accounts
- **Enrichment Service:** Auto-enrich from Clearbit, Zoominfo, LinkedIn API
- **GDPR Data Portability:** Export all data for a contact across all modules
- **Bulk Update Workflows:** Update lifecycle stages in bulk via workflow rules