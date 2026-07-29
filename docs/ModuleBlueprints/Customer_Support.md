# Module Blueprint: Customer Support

- **Module:** `apps.support_ticket`
- **Bounded Context:** Customer Support & Helpdesk
- **Status:** Draft v1.0

## Business Purpose

The Customer Support module provides a ticketing system for managing customer inquiries, issues, and requests. It includes ticket lifecycle management, SLA tracking, ticket routing, and self-service knowledge base integration.

## Bounded Context

This module owns Support Tickets and their associated data (replies, attachments, satisfaction). It integrates with Contact/Account to identify customers, with Knowledge Base for suggested solutions, and with Notification for alerts.

## Aggregates, Entities, Value Objects

### Aggregate: Ticket
- **Ticket** (Aggregate Root)
  - `id: UUID v7`
  - `tenant_id: UUID v7`
  - `ticket_number: str (auto-generated)`
  - `subject: str`
  - `description: Text`
  - `status: TicketStatus`
  - `priority: TicketPriority`
  - `severity: TicketSeverity | None`
  - `category: str | None`
  - `subcategory: str | None`
  - `source: TicketSource`
  - `contact_id: UUID v7 | None`
  - `account_id: UUID v7 | None`
  - `assigned_to: UUID v7 | None`
  - `assigned_team: UUID v7 | None`
  - `created_by: UUID v7`
  - `sla_policy_id: UUID v7 | None`
  - `first_response_at: DateTime | None`
  - `resolved_at: DateTime | None`
  - `closed_at: DateTime | None`
  - `sla_due_at: DateTime | None`
  - `sla_breached: bool`
  - `tags: Array[str]`
  - `custom_fields: JSONB`
  - `timestamps: created_at, updated_at`

### Value Objects
- **TicketStatus:** `enum(NEW, OPEN, PENDING_CUSTOMER, PENDING_VENDOR, ON_HOLD, RESOLVED, CLOSED, REOPENED)`
- **TicketPriority:** `enum(LOW, MEDIUM, HIGH, URGENT)`
- **TicketSeverity:** `enum(CRITICAL, MAJOR, MINOR, TRIVIAL)`
- **TicketSource:** `enum(EMAIL, PORTAL, CHAT, PHONE, SOCIAL, API, INTERNAL)`

### Entities
- **TicketReply** — Internal and public replies
  - `id, ticket_id, author_id, body, is_public, attachments, created_at`
- **TicketAttachment** — File attachments on tickets
- **TicketSLA** — SLA policy definition
  - `id, tenant_id, name, first_response_minutes, resolution_minutes, priority, severity, escalation_rule`
- **TicketEscalation** — Escalation history
- **TicketSatisfaction** — CSAT/NPS survey
  - `id, ticket_id, score, feedback, submitted_at`

## Domain Events

- `TicketCreated`, `TicketAssigned`, `TicketPriorityChanged`
- `TicketReplied`, `TicketResolved`, `TicketClosed`, `TicketReopened`
- `TicketEscalated`, `TicketSLAWarning`, `TicketSLABreached`
- `SatisfactionSubmitted`

## Commands & Queries

### Commands
- `CreateTicket`, `UpdateTicket`, `DeleteTicket`
- `AssignTicket(ticket_id, user_id)`, `AssignTeam(ticket_id, team_id)`
- `AddReply(ticket_id, body, is_public, attachments)`
- `ChangePriority(ticket_id, priority, reason)`
- `ResolveTicket(ticket_id, resolution)`, `CloseTicket(ticket_id)`
- `ReopenTicket(ticket_id, reason)`
- `EscalateTicket(ticket_id, reason)`
- `CreateSLAPolicy`, `ApplySLAPolicy(ticket_id, policy_id)`
- `SubmitSatisfaction(ticket_id, score, feedback)`

### Queries
- `GetTicket`, `ListTickets(filters, sort, page)`
- `GetTicketReplies(ticket_id)`
- `GetTicketTimeline(ticket_id)`
- `GetUnassignedTickets`, `GetMyTickets(user_id)`
- `GetTicketStats(period) -> volume, avg_response, avg_resolution, breach_rate`
- `GetSLAPolicies`, `GetSLABreaches(period)`

## Application Services

- `TicketService` — Ticket CRUD, assignment, status management
- `TicketRoutingService` — Auto-assign based on skills, load, round-robin
- `TicketSLAService` — SLA monitoring, warnings, escalation
- `TicketReplyService` — Reply management, email integration
- `TicketPriorityService` — Priority matrix (impact + urgency)
- `TicketSatisfactionService` — CSAT surveys and reporting

## API Endpoints

| Method | URL | Description |
|--------|-----|-------------|
| GET/POST | `/api/v1/support/tickets/` | List/Create tickets |
| GET/PUT | `/api/v1/support/tickets/{id}/` | Ticket CRUD |
| POST | `/api/v1/support/tickets/{id}/assign/` | Assign to user |
| POST | `/api/v1/support/tickets/{id}/reply/` | Add reply |
| POST | `/api/v1/support/tickets/{id}/resolve/` | Resolve ticket |
| POST | `/api/v1/support/tickets/{id}/close/` | Close ticket |
| POST | `/api/v1/support/tickets/{id}/reopen/` | Reopen |
| POST | `/api/v1/support/tickets/{id}/escalate/` | Escalate |
| GET | `/api/v1/support/tickets/{id}/timeline/` | Activity timeline |
| GET | `/api/v1/support/tickets/unassigned/` | Unassigned tickets |
| GET | `/api/v1/support/tickets/my/` | My tickets |
| GET | `/api/v1/support/tickets/stats/` | Support stats |
| GET/POST | `/api/v1/support/sla-policies/` | SLA policy CRUD |
| POST | `/api/v1/support/tickets/{id}/satisfaction/` | Submit CSAT |
| GET | `/api/v1/support/kb/search/` | KB search |

## Database Tables

- `support_ticket` — Core tickets
- `support_ticketreply` — Replies and comments
- `support_ticketattachment` — File attachments
- `support_ticketescalation` — Escalation history
- `support_ticketsla` — SLA definitions
- `support_ticketsatisfaction` — CSAT scores

## Validation Rules

| Field | Rule |
|-------|------|
| priority | URGENT tickets auto-escalate to management |
| status | CLOSED tickets cannot be modified (only reopened) |
| assigned_to | Must be active support agent |
| first_response | Auto-tracked from first agent reply |
| SLA due | Computed from priority + severity matrix |

## Security & Permissions

| Permission | Codename |
|------------|----------|
| View | `support_ticket.view_ticket` |
| Add | `support_ticket.add_ticket` |
| Change | `support_ticket.change_ticket` |
| Delete | `support_ticket.delete_ticket` |
| Assign | `support_ticket.assign_ticket` |
| Resolve | `support_ticket.resolve_ticket` |
| Escalate | `support_ticket.escalate_ticket` |
| Manage SLA | `support_ticket.manage_sla` |

## Testing Strategy

| Layer | Focus |
|-------|-------|
| Unit | SLA timer calculations, Priority matrix, Status state machine |
| Integration | Auto-assignment routing, Email-to-ticket parsing, Escalation workflow |
| API | Ticket lifecycle CRUD, Reply threads, SLA breach detection |

## Future Enhancements

- **Omnichannel Inbox:** Email, chat, social, phone in unified view
- **AI Ticket Routing:** ML-based categorization and assignment
- **Suggested Responses:** AI-generated reply drafts based on similar tickets
- **Customer Portal:** Self-service ticket creation and tracking
- **Live Chat:** Real-time chat with transcript-to-ticket conversion
- **Macros:** Predefined response templates for agents
- **Time Tracking:** Agent time per ticket for billing
- **Multilingual Support:** Auto-translate tickets and replies
