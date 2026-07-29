# Module Blueprint: Contract Management

- **Module:** `apps.contract`
- **Bounded Context:** Contract Lifecycle Management
- **Status:** Draft v1.0

## Business Purpose

The Contract Management module handles the full lifecycle of customer, partner, and vendor contracts from creation through signature, amendment, renewal, and termination. It integrates with the Quote and Approval modules for contract generation and with Notifications for milestone alerts.

## Bounded Context

This module owns Contracts, Contract Templates, Contract Versions, and Milestones. It does not own Quotes or Orders but consumes them as contract sources.

## Aggregates, Entities, Value Objects

### Aggregate: Contract
- **Contract** (Aggregate Root)
  - `id: UUID v7`
  - `tenant_id: UUID v7`
  - `contract_number: str (auto-generated)`
  - `title: str`
  - `description: Text`
  - `contract_type: ContractType`
  - `status: ContractStatus`
  - `account_id: UUID v7`
  - `contact_id: UUID v7 | None`
  - `owner_id: UUID v7`
  - `quote_id: UUID v7 | None`
  - `order_id: UUID v7 | None`
  - `start_date: Date`
  - `end_date: Date | None`
  - `renewal_date: Date | None`
  - `value: Decimal`
  - `currency: str`
  - `auto_renew: bool`
  - `renewal_notice_days: int`
  - `terms: Text`
  - `signed_by_customer: bool`
  - `signed_by_company: bool`
  - `signed_date: Date | None`
  - `document_url: str | None`
  - `custom_fields: JSONB`
  - `timestamps: created_at, updated_at, signed_at, terminated_at`

### Value Objects
- **ContractType:** `enum(SALES, SERVICE, PARTNERSHIP, NDA, LICENSE, LEASE, EMPLOYMENT, MAINTENANCE, OTHER)`
- **ContractStatus:** `enum(DRAFT, PENDING_APPROVAL, APPROVED, SENT, NEGOTIATION, SIGNED, ACTIVE, EXPIRED, TERMINATED, RENEWED, CANCELLED)`

### Entities
- **ContractVersion** — Versioned contract documents
  - `id, contract_id, version_number, content, change_summary, created_by, created_at`
- **ContractMilestone** — Key dates and deliverables
  - `id, contract_id, title, due_date, completion_date, status, value`
- **ContractAmendment** — Amendments and addenda
  - `id, contract_id, amendment_number, description, effective_date, changes_json, signed`
- **ContractApproval** — Approval chain records
  - `id, contract_id, approver_id, status, comments, decided_at`
- **ContractRenewalHistory** — Past renewal records

## Domain Events

- `ContractCreated`, `ContractSent`, `ContractSigned`, `ContractActivated`
- `ContractExpiring`, `ContractExpired`, `ContractRenewed`, `ContractTerminated`
- `MilestoneDue`, `MilestoneCompleted`, `MilestoneOverdue`
- `ContractApproved`, `ContractRejected`, `ContractAmended`

## Commands & Queries

### Commands
- `CreateContract`, `UpdateContract`, `DeleteContract`
- `GenerateFromQuote(quote_id) -> ContractId`
- `SendForSignature(contract_id, signing_method)`
- `RecordSignature(contract_id, party, date, document_url)`
- `ApproveContract(contract_id, approver_id, comments)`
- `RejectContract(contract_id, approver_id, reason)`
- `RenewContract(contract_id, new_end_date, terms)`
- `TerminateContract(contract_id, reason, effective_date)`
- `CreateAmendment(contract_id, changes, description)`
- `CompleteMilestone(milestone_id)`
- `UpdateRenewalSettings(contract_id, auto_renew, notice_days)`

### Queries
- `GetContract`, `ListContracts(filters, sort, page)`
- `GetContractVersions(contract_id)`
- `GetContractMilestones(contract_id)`
- `GetContractsExpiringSoon(days)`
- `GetContractAmendments(contract_id)`
- `GetContractValuePipeline(tenant_id)` (upcoming renewals)
- `SearchContracts(query, filters)`

## Application Services

- `ContractService` — CRUD, status management, document generation
- `ContractSignatureService` — eSignature integration (DocuSign, HelloSign)
- `ContractRenewalService` — Auto-renewal processing, notice generation
- `ContractMilestoneService` — Milestone tracking and alerts
- `ContractApprovalService` — Approval workflow integration

## API Endpoints

| Method | URL | Description |
|--------|-----|-------------|
| GET/POST | `/api/v1/contracts/` | List/Create |
| GET/PUT/DELETE | `/api/v1/contracts/{id}/` | CRUD |
| POST | `/api/v1/contracts/{id}/send/` | Send for signature |
| POST | `/api/v1/contracts/{id}/sign/` | Record signature |
| POST | `/api/v1/contracts/{id}/approve/` | Approve |
| POST | `/api/v1/contracts/{id}/reject/` | Reject |
| POST | `/api/v1/contracts/{id}/renew/` | Renew contract |
| POST | `/api/v1/contracts/{id}/terminate/` | Terminate |
| POST | `/api/v1/contracts/{id}/amend/` | Add amendment |
| GET | `/api/v1/contracts/{id}/versions/` | Version history |
| GET | `/api/v1/contracts/{id}/milestones/` | Milestones |
| POST | `/api/v1/contracts/{id}/milestones/{mid}/complete/` | Complete milestone |
| GET | `/api/v1/contracts/expiring/` | Expiring soon |

## Database Tables

- `contract_contract` — Core contract table
- `contract_version` — Versioned documents
- `contract_milestone` — Key deliverables
- `contract_amendment` — Amendments and addenda
- `contract_approval` — Approval chain records
- `contract_renewalhistory` — Past renewals

## Validation Rules

| Field | Rule |
|-------|------|
| start_date | Must be before end_date |
| end_date | Required for non-perpetual contracts |
| renewal_notice_days | Positive integer |
| value | Non-negative decimal |
| status | Transitions follow state machine |

## Security & Permissions

| Permission | Codename |
|------------|----------|
| View | `contract.view_contract` |
| Add | `contract.add_contract` |
| Change | `contract.change_contract` |
| Delete | `contract.delete_contract` |
| Approve | `contract.approve_contract` |
| Sign | `contract.sign_contract` |
| Renew | `contract.renew_contract` |
| Terminate | `contract.terminate_contract` |

## Testing Strategy

| Layer | Focus |
|-------|-------|
| Unit | Status state machine, Renewal date calculation, Milestone overdue detection |
| Integration | Quote->Contract generation flow, Signature recording, Amendment chain |
| API | Full contract lifecycle CRUD, Approval workflow, Expiry alerts |

## Future Enhancements

- **AI Contract Review:** Clause extraction, risk scoring
- **Template Library:** Pre-approved contract templates with merge fields
- **CPQ Integration:** Configure-Price-Quote sync to contract
- **Obligation Tracking:** Track and alert on contract obligations
- **Audit Trail:** Full history with GDPR compliance export
