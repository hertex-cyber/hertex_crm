# Module Blueprint: Approval Workflow

- **Module:** `apps.approval`
- **Bounded Context:** Multi-Step Approval Orchestration
- **Status:** Draft v1.0

## Business Purpose

The Approval Workflow module provides configurable multi-step approval processes for business documents (quotes, contracts, invoices, purchase orders, etc.). It supports sequential and parallel approval chains, delegation, escalation, and deadline enforcement.

## Bounded Context

This module owns Approval Requests, Approval Chains, Approver Assignments, and Approval History. It works alongside the Workflow Engine (which triggers approval steps) and integrates with all modules that require approvals. It does NOT own the documents being approved.

## Aggregates, Entities, Value Objects

### Aggregate: ApprovalRequest
- **ApprovalRequest** (Aggregate Root)
  - `id: UUID v7`
  - `tenant_id: UUID v7`
  - `request_number: str (auto-generated)`
  - `title: str`
  - `description: Text`
  - `status: ApprovalStatus`
  - `priority: ApprovalPriority`
  - `entity_type: str` (e.g., "quote", "contract", "invoice", "purchase_order")
  - `entity_id: UUID v7` (the document being approved)
  - `entity_summary: JSONB` (snapshot of key fields for context)
  - `requested_by: UUID v7`
  - `chain_id: UUID v7 (FK to ApprovalChain)`
  - `current_step: int`
  - `total_steps: int`
  - `submitted_at: DateTime`
  - `completed_at: DateTime | None`
  - `deadline: DateTime | None`
  - `escalation_count: int`
  - `timestamps: created_at, updated_at`

### Value Objects
- **ApprovalStatus:** `enum(PENDING, IN_PROGRESS, APPROVED, CONDITIONALLY_APPROVED, REJECTED, WITHDRAWN, EXPIRED, ESCALATED)`
- **ApprovalPriority:** `enum(LOW, MEDIUM, HIGH, CRITICAL)`

### Entities
- **ApprovalStep** — Individual step in the chain
  - `id, request_id, step_number, step_type: SEQUENTIAL|PARALLEL, status, approver_id, approver_role, comments, decided_at, timeout_minutes`
- **ApprovalChain** — Reusable approval chain template
  - `id, tenant_id, name, entity_type, description, is_active, steps_config (JSONB), timestamps`
- **ApprovalDelegate** — Temporary approval authority delegation
  - `id, tenant_id, approver_id, delegate_id, entity_type, start_date, end_date, is_active`
- **ApprovalHistory** — Full audit trail
  - `id, request_id, action, actor_id, comment, timestamp, step_number`

## Domain Events

- `ApprovalRequestCreated`, `ApprovalRequestSubmitted`
- `ApprovalStepCompleted` (approved/rejected at step level)
- `ApprovalGranted` (all steps approved)
- `ApprovalRejected` (any step rejected)
- `ApprovalEscalated` (deadline passed without action)
- `ApprovalDelegated` (approver delegated authority)
- `ApprovalWithdrawn` (requester cancelled)
- `ApprovalDeadlineApproaching` (warning)

## Commands & Queries

### Commands
- `CreateApprovalRequest(entity_type, entity_id, chain_id) -> RequestId`
- `SubmitForApproval(request_id)` -> change status to PENDING
- `ApproveStep(request_id, step_number, comment, conditions?)`
- `RejectStep(request_id, step_number, reason)`
- `ConditionallyApprove(request_id, conditions, reviewer_id)`
- `WithdrawRequest(request_id, reason)`
- `EscalateRequest(request_id, reason)`
- `DelegateApproval(approver_id, delegate_id, entity_type, date_range)`
- `RevokeDelegation(delegation_id)`
- `CreateApprovalChain(name, entity_type, steps) -> ChainId`
- `UpdateApprovalChain(chain_id, steps)`
- `AssignApprover(request_id, step_number, user_id)`
- `ReassignApprover(request_id, step_number, from_user, to_user)`
- `RemindApprover(request_id, step_number) -> send notification`

### Queries
- `GetApprovalRequest(id) -> full detail with steps`
- `ListApprovalRequests(filters, sort, page)`
- `GetPendingApprovals(user_id) -> requests awaiting my action`
- `GetMyRequests(user_id) -> requests I submitted`
- `GetApprovalHistory(request_id) -> full timeline`
- `GetApprovalChains(entity_type?) -> list of chain templates`
- `GetApprovalChain(id)`
- `GetApprovalDelegations(approver_id?)`
- `GetApprovalStats(tenant_id, period) -> volume, avg time, approval rate`
- `GetApprovalMatrix(entity_type, value) -> who needs to approve`

## Application Services

- `ApprovalRequestService` — Request lifecycle management
- `ApprovalChainService` — Chain template CRUD and assignment
- `ApprovalStepService` — Step processing, approval/rejection logic
- `ApprovalRoutingService` — Determine approvers based on chain config, value, territory
- `ApprovalEscalationService` — Deadline monitoring and escalation
- `ApprovalDelegationService` — Delegate management and resolution
- `ApprovalNotificationService` — Notify approvers, send reminders
- `ApprovalAnalyticsService` — Metrics and reporting

## Approval Chain Configuration

Each ApprovalChain has a list of steps. Each step has:
- `step_number`: Order in sequence
- `step_type`: SEQUENTIAL (all must approve in order) or PARALLEL (any/all must approve)
- `approver_type`: USER, ROLE, TEAM, MANAGER_OF_REQUESTER, FIELD_VALUE (dynamic)
- `approver_id`: Specific user (if USER type)
- `approver_role`: Role name (if ROLE type)
- `condition`: Optional criteria for when this step applies (e.g., "amount > 10000")
- `timeout_minutes`: Auto-escalation if not acted upon
- `escalation_action`: ESCALATE_TO_MANAGER, NOTIFY_ADMIN, AUTO_APPROVE

Example chain for Quote Approval:
```
Step 1: Manager of requester (if amount < 5000)
  → Step 2: Sales Director (if amount 5000-25000)
  → [PARALLEL] Step 3a: VP Sales + Step 3b: Finance Director (if amount > 25000)
```

## API Endpoints

| Method | URL | Description |
|--------|-----|-------------|
| GET/POST | `/api/v1/approval/requests/` | List/Create requests |
| GET/PUT | `/api/v1/approval/requests/{id}/` | Request detail |
| POST | `/api/v1/approval/requests/{id}/submit/` | Submit |
| POST | `/api/v1/approval/requests/{id}/approve/` | Approve current step |
| POST | `/api/v1/approval/requests/{id}/reject/` | Reject |
| POST | `/api/v1/approval/requests/{id}/withdraw/` | Withdraw |
| POST | `/api/v1/approval/requests/{id}/escalate/` | Escalate |
| GET | `/api/v1/approval/requests/{id}/history/` | Full audit |
| GET | `/api/v1/approval/pending/` | My pending approvals |
| GET | `/api/v1/approval/my-requests/` | My submitted requests |
| GET/POST | `/api/v1/approval/chains/` | Chain template CRUD |
| GET/PUT/DELETE | `/api/v1/approval/chains/{id}/` | Chain CRUD |
| GET/POST | `/api/v1/approval/delegations/` | Delegation management |
| DELETE | `/api/v1/approval/delegations/{id}/` | Revoke delegation |
| GET | `/api/v1/approval/stats/` | Approval metrics |

## Database Tables

- `approval_request` — Core approval requests
- `approval_step` — Individual approval steps
- `approval_chain` — Reusable chain templates
- `approval_delegate` — Delegation records
- `approval_history` — Full audit trail
- `approval_reminderlog` — Reminder send history

## Validation Rules

| Field | Rule |
|-------|------|
| entity_type | Must be a registered approval-enabled entity type |
| chain_id | Chain must be active and compatible with entity_type |
| step_number | Must be sequential |
| parallel steps | All parallel steps must complete before moving on |
| deadline | Must be after submitted_at |
| delegation.approver != delegate | Cannot delegate to self |
| rejection | Terminal state (no further steps process) |

## Security & Permissions

| Permission | Codename |
|------------|----------|
| View Requests | `approval.view_request` |
| Create Request | `approval.create_request` |
| Approve Step | `approval.approve_step` |
| Reject Step | `approval.reject_step` |
| Withdraw Request | `approval.withdraw_request` |
| Escalate Request | `approval.escalate_request` |
| Manage Chains | `approval.manage_chain` |
| Manage Delegations | `approval.manage_delegation` |
| View Analytics | `approval.view_analytics` |

## Testing Strategy

| Layer | Focus |
|-------|-------|
| Unit | Approval chain step resolution, Escalation timer logic, Delegation resolution, Condition evaluation |
| Integration | Multi-step approval flow (sequential + parallel), Escalation workflow, Delegation during approval |
| API | Full request lifecycle, Chain template CRUD, Delegation management |

## Future Enhancements

- **Approval Matrix UI:** Visual chain designer (drag-and-drop)
- **Mobile Approvals:** Approve/reject from mobile push notification
- **Slack/MS Teams Approvals:** Approve directly from chat
- **Batch Approvals:** Approve multiple requests at once
- **AI Approval Suggestions:** Recommend approval/rejection based on history
- **Approval SLAs:** Per-chain SLA tracking with breach alerts
- **Audit Reports:** Compliance reports for regulatory requirements
- **Conditional Approval Chains:** Dynamic chain selection based on entity attributes
