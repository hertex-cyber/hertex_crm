# TZAHU CRM — Event Catalog

> **Version:** 0.1.0-draft
> **Last Updated:** 2026-07-27
> **Status:** Approved
> **Owner:** Platform Architecture Team

---

## Table of Contents

1. [Event-Driven Architecture Overview](#1-event-driven-architecture-overview)
2. [Event Schema Standard](#2-event-schema-standard)
3. [Delivery Guarantees](#3-delivery-guarantees)
4. [Event Catalog: Identity Module](#4-event-catalog-identity-module)
5. [Event Catalog: Organization Module](#5-event-catalog-organization-module)
6. [Event Catalog: RBAC Module](#6-event-catalog-rbac-module)
7. [Event Catalog: Tenant Module](#7-event-catalog-tenant-module)
8. [Event Catalog: Lead Management Module](#8-event-catalog-lead-management-module)
9. [Event Catalog: Pipeline Management Module](#9-event-catalog-pipeline-management-module)
10. [Event Catalog: Activity Module](#10-event-catalog-activity-module)
11. [Event Catalog: Workflow Module](#11-event-catalog-workflow-module)
12. [Event Catalog: Notification Module](#12-event-catalog-notification-module)
13. [Event Catalog: AI Module](#13-event-catalog-ai-module)
14. [Event Catalog: Integration Module](#14-event-catalog-integration-module)
15. [Event Schema Evolution](#15-event-schema-evolution)
16. [Complex Event Flows](#16-complex-event-flows)

---

## 1. Event-Driven Architecture Overview

TZAHU CRM uses an event-driven architecture for decoupling modules. Events are published to RabbitMQ (AMQP 0-9-1) and consumed by interested subscribers.

### Core Principles

1. **At-least-once delivery.** Events may be delivered more than once; handlers must be idempotent.
2. **Ordering per partition.** Events for the same aggregate are delivered in order via routing key.
3. **Eventual consistency.** Cross-module state is eventually consistent. The outbox pattern ensures reliability.
4. **Backward-compatible schemas.** New fields are optional. Breaking changes require a new event version.
5. **Dead-letter after 3 retries.** Failed events go to DLQ for manual inspection.

### Event Flow

```
Publisher Module
    |
    |-- Publish to Domain Event Bus (in-process)
    |-- Outbox Pattern (DB → Celery → RabbitMQ)
    |
    v
RabbitMQ Exchange (topic: "tzahu.events")
    |
    |-- Queue per subscriber
    |-- Bind via routing key pattern
    |
    v
Subscriber Module
    |
    |-- Deserialize event
    |-- Check idempotency key
    |-- Execute handler
    |-- Ack or retry
```

### Outbox Pattern

```python
# Every transaction that publishes events does so via the outbox
class OutboxMessage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid7)
    event_name = models.CharField(max_length=255)
    payload = models.JSONField()
    headers = models.JSONField(default=dict)
    status = models.CharField(
        max_length=20,
        choices=[("pending", "Pending"), ("published", "Published"), ("failed", "Failed")],
        default="pending",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    published_at = models.DateTimeField(null=True)
    retry_count = models.IntegerField(default=0)

    class Meta:
        db_table = "outbox_messages"
        indexes = [
            models.Index(fields=["status", "created_at"]),
        ]


# Celery task publishes outbox messages
@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def publish_outbox_messages(self):
    messages = OutboxMessage.objects.filter(status="pending").order_by("created_at")[:100]
    for msg in messages:
        try:
            publish_to_rabbitmq(msg.event_name, msg.payload, msg.headers)
            msg.status = "published"
            msg.published_at = timezone.now()
            msg.save(update_fields=["status", "published_at"])
        except Exception as exc:
            msg.retry_count += 1
            if msg.retry_count >= 3:
                msg.status = "failed"
            msg.save(update_fields=["retry_count", "status"])
            logger.error(f"Failed to publish event {msg.event_name}: {exc}")
```

---

## 2. Event Schema Standard

### Base Event Schema

```json
{
  "eventId": "0190a3b2-8c7d-7e00-9b1a-deadbeef1234",
  "eventName": "lead.created",
  "eventVersion": 1,
  "occurredAt": "2026-07-27T10:30:00.123Z",
  "publishedAt": "2026-07-27T10:30:00.456Z",
  "publisher": "lead_management",
  "aggregateId": "0190a3b2-8c7d-7e00-9b1a-123456789abc",
  "aggregateType": "lead",
  "organizationId": "0190a3b2-8c7d-7e00-9b1a-org12345678",
  "correlationId": "0190a3b2-8c7d-7e00-9b1a-corr12345678",
  "idempotencyKey": "0190a3b2-8c7d-7e00-9b1a-idem12345678",
  "data": {
    "companyName": "Acme Corp",
    "email": "contact@acme.com",
    "source": "website",
    "status": "new"
  }
}
```

### Python Domain Event Base

```python
@dataclass(frozen=True)
class DomainEvent:
    event_id: UUID
    event_name: str
    event_version: int = 1
    occurred_at: datetime = field(default_factory=lambda: datetime.now(tz=timezone.utc))
    aggregate_id: UUID | None = None
    aggregate_type: str | None = None
    organization_id: UUID | None = None
    correlation_id: UUID | None = None
    idempotency_key: UUID | None = None

    def to_dict(self) -> dict:
        return {
            "eventId": str(self.event_id),
            "eventName": self.event_name,
            "eventVersion": self.event_version,
            "occurredAt": self.occurred_at.isoformat(),
            "aggregateId": str(self.aggregate_id) if self.aggregate_id else None,
            "aggregateType": self.aggregate_type,
            "organizationId": str(self.organization_id) if self.organization_id else None,
            "correlationId": str(self.correlation_id) if self.correlation_id else None,
            "idempotencyKey": str(self.idempotency_key) if self.idempotency_key else None,
            "data": self._data_dict(),
        }

    def _data_dict(self) -> dict:
        raise NotImplementedError
```

### RabbitMQ Exchange & Queue Naming

| Component | Naming Convention | Example |
|-----------|------------------|---------|
| Exchange | `tzahu.events.{type}` | `tzahu.events.domain` |
| Queue | `tzahu.{subscriber}.{event}` | `tzahu.workflow.lead.created` |
| Routing Key | `{event_name}` | `lead.created` |
| DLQ | `tzahu.dlq.{queue}` | `tzahu.dlq.workflow.lead.created` |
| Retry Queue | `tzahu.retry.{queue}` | `tzahu.retry.workflow.lead.created` |

### Idempotency Key

- Every event carries an `idempotencyKey` (UUID v4).
- Subscribers store processed keys in Redis with 7-day TTL.
- If a key is already processed, the event is silently acked.

---

## 3. Delivery Guarantees

### At-Least-Once Delivery

| Layer | Guarantee | Mechanism |
|-------|-----------|-----------|
| Publisher → Outbox | Exactly-once | Same DB transaction |
| Outbox → RabbitMQ | At-least-once | Celery task with retry |
| RabbitMQ → Subscriber | At-least-once | Manual ack, prefetch=1 |
| Subscriber → Handler | At-least-once | Idempotency check |

### Retry Policy

| Retry Count | Delay | Action |
|-------------|-------|--------|
| 0 | Immediate | First attempt |
| 1 | 30 seconds | Short delay |
| 2 | 5 minutes | Medium delay |
| 3 | 30 minutes | Long delay |
| 4+ | — | Dead-letter queue |

### Dead-Letter Queue

- Failed events (after 3 retries) are routed to `tzahu.dlq.{queue}`.
- DLQ monitored via CloudWatch / Prometheus.
- Manual reprocess via admin panel.
- Auto-reprocess via cron: `./manage.py reprocess_dlq --queue workflow.lead.created`.

### Subscriber Implementation

```python
@shared_task(bind=True, max_retries=3, default_retry_delay=30, acks_late=True)
def handle_lead_created(self, event: dict) -> None:
    idempotency_key = event["idempotencyKey"]

    # Deduplication
    if cache.get(f"processed_event:{idempotency_key}"):
        logger.info(f"Event {idempotency_key} already processed, skipping")
        return

    try:
        # Process the event
        handler = LeadCreatedHandler()
        handler.handle(event["data"])
        
        # Mark as processed
        cache.set(f"processed_event:{idempotency_key}", "1", timeout=86400 * 7)
        
    except RetryableError as exc:
        logger.warning(f"Retryable error processing lead.created: {exc}")
        raise self.retry(exc=exc)
        
    except NonRetryableError as exc:
        logger.error(f"Non-retryable error processing lead.created: {exc}")
        # Route to DLQ
        raise
```

---

## 4. Event Catalog: Identity Module

### Events Published by Identity Module

| Event | Version | Description | Key Payload Fields | Subscribers |
|-------|---------|-------------|-------------------|-------------|
| `user.registered` | 1 | New user registered | userId, email, fullName, organizationId | Organization, Notification, Audit |
| `user.email.verified` | 1 | Email verified | userId, email | Identity, Audit |
| `user.logged.in` | 1 | User logged in | userId, email, ipAddress, deviceInfo | Audit, Analytics |
| `user.logged.out` | 1 | User logged out | userId, sessionId | Identity, Audit |
| `user.password.changed` | 1 | Password changed | userId | Identity, Notification, Audit |
| `user.password.reset` | 1 | Password reset requested | userId, email | Identity, Notification |
| `user.mfa.enabled` | 1 | MFA enabled | userId, method (totp) | Identity, Audit |
| `user.mfa.disabled` | 1 | MFA disabled | userId | Identity, Audit |
| `user.suspended` | 1 | User account suspended | userId, reason | Identity, Organization, Notification, Audit |
| `user.reactivated` | 1 | User account reactivated | userId | Identity, Organization, Audit |
| `user.deleted` | 1 | User account deleted | userId, anonymizedEmail | Identity, Organization, Audit |

### Sample Event: user.registered

```json
{
  "eventId": "0190a3b2-8c7d-7e00-9b1a-deadbeef1234",
  "eventName": "user.registered",
  "eventVersion": 1,
  "occurredAt": "2026-07-27T10:30:00.123Z",
  "publisher": "identity",
  "aggregateId": "0190a3b2-8c7d-7e00-9b1a-user12345678",
  "aggregateType": "user",
  "organizationId": "0190a3b2-8c7d-7e00-9b1a-org12345678",
  "correlationId": "0190a3b2-8c7d-7e00-9b1a-corr12345678",
  "idempotencyKey": "0190a3b2-8c7d-7e00-9b1a-idem12345678",
  "data": {
    "userId": "0190a3b2-8c7d-7e00-9b1a-user12345678",
    "email": "john@acme.com",
    "fullName": "John Doe",
    "organizationId": "0190a3b2-8c7d-7e00-9b1a-org12345678",
    "role": "sales_rep",
    "registeredAt": "2026-07-27T10:30:00.123Z",
    "signupSource": "email_invitation"
  },
  "retryPolicy": {
    "maxRetries": 3,
    "backoffMs": [0, 30000, 300000]
  }
}
```

---

## 5. Event Catalog: Organization Module

### Events Published by Organization Module

| Event | Version | Description | Key Payload Fields | Subscribers |
|-------|---------|-------------|-------------------|-------------|
| `organization.created` | 1 | New organization created | orgId, name, tier, ownerId | Tenant, RBAC, Settings, Audit |
| `organization.updated` | 1 | Organization details changed | orgId, changedFields | Organization, Audit |
| `organization.suspended` | 1 | Organization suspended | orgId, reason | All modules, Notification, Audit |
| `organization.reactivated` | 1 | Organization reactivated | orgId | All modules, Notification, Audit |
| `organization.deleted` | 1 | Organization deleted (scheduled) | orgId, scheduledDeletionAt | Tenant, Audit |
| `organization.tier.changed` | 1 | Subscription tier changed | orgId, oldTier, newTier | RBAC, Settings, AI, Notification |
| `organization.settings.updated` | 1 | Org-level settings changed | orgId, settings | Organization, Notification |
| `member.invited` | 1 | User invited to organization | invitationId, email, orgId, role | Notification, Audit |
| `member.accepted` | 1 | Invitation accepted | userId, orgId, role | Organization, RBAC, Audit |
| `member.removed` | 1 | Member removed from org | userId, orgId | Organization, RBAC, Audit |
| `member.role.changed` | 1 | Member role changed | userId, orgId, oldRole, newRole | Organization, RBAC, Audit |

---

## 6. Event Catalog: RBAC Module

### Events Published by RBAC Module

| Event | Version | Description | Key Payload Fields | Subscribers |
|-------|---------|-------------|-------------------|-------------|
| `role.created` | 1 | New role created | roleId, orgId, name, permissions | Audit |
| `role.updated` | 1 | Role permissions changed | roleId, orgId, permissionsAdded, permissionsRemoved | Audit |
| `role.deleted` | 1 | Role deleted | roleId, orgId | Organization, Audit |
| `permission.granted` | 1 | Permission granted to user | userId, orgId, permission | Audit |
| `permission.revoked` | 1 | Permission revoked from user | userId, orgId, permission | Audit |

---

## 7. Event Catalog: Tenant Module

### Events Published by Tenant Module

| Event | Version | Description | Key Payload Fields | Subscribers |
|-------|---------|-------------|-------------------|-------------|
| `tenant.provisioned` | 1 | New tenant provisioned | orgId, isolationModel, databaseUrl | Organization, Audit |
| `tenant.suspended` | 1 | Tenant access suspended | orgId, reason | All modules, Audit |
| `tenant.migrated` | 1 | Tenant migrated (pool to silo) | orgId, oldIsolation, newIsolation | All modules, Audit |
| `tenant.rls.policies.generated` | 1 | RLS policies created for new table | orgId, tableName | Audit |

---

## 8. Event Catalog: Lead Management Module

### Events Published by Lead Management Module

| Event | Version | Description | Key Payload Fields | Subscribers |
|-------|---------|-------------|-------------------|-------------|
| `lead.created` | 1 | New lead created | leadId, orgId, companyName, email, source, status, createdBy | Workflow, Notification, AI, Activity, Search, Audit |
| `lead.updated` | 1 | Lead details changed | leadId, orgId, changedFields | Workflow, Activity, Search, Audit |
| `lead.assigned` | 1 | Lead assigned to user | leadId, orgId, assignedTo, assignedBy | Notification, Activity, Audit |
| `lead.status.changed` | 1 | Lead status changed | leadId, orgId, oldStatus, newStatus | Workflow, Activity, Audit |
| `lead.scored` | 1 | Lead score recalculated | leadId, orgId, oldScore, newScore, scoringFactors | Activity, AI |
| `lead.converted` | 1 | Lead converted to opportunity | leadId, orgId, opportunityId, contactId | Pipeline, Workflow, Activity, Notification, Audit |
| `lead.merged` | 1 | Duplicate leads merged | leadId, orgId, mergedIntoLeadId | Activity, Search, Audit |
| `lead.deleted` | 1 | Lead soft-deleted | leadId, orgId, deletedBy | Activity, Search, Audit |
| `contact.created` | 1 | New contact created | contactId, orgId, email, fullName, company | Workflow, Activity, Search, Integration, Audit |
| `contact.updated` | 1 | Contact details changed | contactId, orgId, changedFields | Integration, Activity, Search, Audit |
| `contact.merged` | 1 | Duplicate contacts merged | contactId, orgId, mergedIntoContactId | Activity, Search, Integration, Audit |
| `contact.deleted` | 1 | Contact soft-deleted | contactId, orgId | Activity, Search, Integration, Audit |
| `account.created` | 1 | New account created | accountId, orgId, name, domain | Workflow, Activity, Search, Audit |
| `account.updated` | 1 | Account details changed | accountId, orgId, changedFields | Activity, Search, Audit |
| `account.deleted` | 1 | Account soft-deleted | accountId, orgId | Activity, Search, Audit |

### Sample Event: lead.created (Critical Event)

```json
{
  "eventId": "0190a3b2-8c7d-7e00-9b1a-deadbeef1234",
  "eventName": "lead.created",
  "eventVersion": 1,
  "occurredAt": "2026-07-27T10:30:00.123Z",
  "publisher": "lead_management",
  "aggregateId": "0190a3b2-8c7d-7e00-9b1a-lead12345678",
  "aggregateType": "lead",
  "organizationId": "0190a3b2-8c7d-7e00-9b1a-org12345678",
  "correlationId": "0190a3b2-8c7d-7e00-9b1a-corr12345678",
  "idempotencyKey": "0190a3b2-8c7d-7e00-9b1a-idem12345678",
  "data": {
    "leadId": "0190a3b2-8c7d-7e00-9b1a-lead12345678",
    "companyName": "Acme Corp",
    "email": "contact@acme.com",
    "phone": "+1-555-123-4567",
    "website": "https://acme.com",
    "source": "website",
    "sourceUrl": "https://acme.com/contact",
    "status": "new",
    "score": 0,
    "createdBy": "0190a3b2-8c7d-7e00-9b1a-user12345678",
    "assignedTo": null,
    "tags": ["enterprise", "saas"],
    "customFields": {
      "companySize": "50-200",
      "industry": "technology"
    },
    "createdAt": "2026-07-27T10:30:00.123Z"
  },
  "retryPolicy": {
    "maxRetries": 3,
    "backoffMs": [0, 30000, 300000]
  }
}
```

---

## 9. Event Catalog: Pipeline Management Module

### Events Published by Pipeline Management Module

| Event | Version | Description | Key Payload Fields | Subscribers |
|-------|---------|-------------|-------------------|-------------|
| `pipeline.created` | 1 | New pipeline created | pipelineId, orgId, name, stages | Audit |
| `pipeline.updated` | 1 | Pipeline configuration changed | pipelineId, orgId, changedFields | Audit |
| `opportunity.created` | 1 | New opportunity created | opportunityId, orgId, pipelineId, leadId, title, value, stage | Workflow, Notification, Activity, AI, Search, Audit |
| `opportunity.updated` | 1 | Opportunity details changed | opportunityId, orgId, changedFields | Activity, Search, Audit |
| `opportunity.stage.changed` | 1 | Opportunity moved to new stage | opportunityId, orgId, pipelineId, oldStage, newStage, probability | Workflow, Notification, Activity, AI, Forecast, Audit |
| `opportunity.assigned` | 1 | Opportunity assigned to user | opportunityId, orgId, assignedTo, assignedBy | Notification, Activity, Audit |
| `opportunity.won` | 1 | Opportunity closed won | opportunityId, orgId, value, wonAmount, closeDate, winReason | Workflow, Notification, Activity, AI, Report, Audit |
| `opportunity.lost` | 1 | Opportunity closed lost | opportunityId, orgId, value, lostReason, competitor | Workflow, Activity, Report, Audit |
| `opportunity.deleted` | 1 | Opportunity soft-deleted | opportunityId, orgId | Activity, Search, Audit |
| `forecast.calculated` | 1 | Forecast recalculated | orgId, period, totalValue, weightedValue, categories | Report, Dashboard |

### Sample Event: opportunity.won (Critical Event)

```json
{
  "eventId": "0190a3b2-8c7d-7e00-9b1a-deadbeef5678",
  "eventName": "opportunity.won",
  "eventVersion": 1,
  "occurredAt": "2026-07-27T10:30:00.123Z",
  "publisher": "pipeline_management",
  "aggregateId": "0190a3b2-8c7d-7e00-9b1a-oppty12345678",
  "aggregateType": "opportunity",
  "organizationId": "0190a3b2-8c7d-7e00-9b1a-org12345678",
  "correlationId": "0190a3b2-8c7d-7e00-9b1a-corr12345678",
  "idempotencyKey": "0190a3b2-8c7d-7e00-9b1a-idem12345678",
  "data": {
    "opportunityId": "0190a3b2-8c7d-7e00-9b1a-oppty12345678",
    "leadId": "0190a3b2-8c7d-7e00-9b1a-lead12345678",
    "contactId": "0190a3b2-8c7d-7e00-9b1a-contact12345678",
    "title": "Acme Corp - Enterprise License",
    "value": 150000.00,
    "wonAmount": 135000.00,
    "currency": "USD",
    "probability": 100,
    "stageId": "0190a3b2-8c7d-7e00-9b1a-stage12345678",
    "stageName": "Closed Won",
    "pipelineId": "0190a3b2-8c7d-7e00-9b1a-pipeline12345678",
    "pipelineName": "Sales Pipeline",
    "assignedTo": "0190a3b2-8c7d-7e00-9b1a-user12345678",
    "winReason": "product_fit",
    "winReasonDetail": "Superior integration capabilities and competitive pricing",
    "closeDate": "2026-07-27",
    "salesCycleDays": 45,
    "competitors": ["CompetitorX"],
    "discountPercent": 10,
    "createdAt": "2026-06-12T08:00:00.000Z",
    "wonAt": "2026-07-27T10:30:00.123Z"
  },
  "retryPolicy": {
    "maxRetries": 3,
    "backoffMs": [0, 30000, 300000]
  }
}
```

---

## 10. Event Catalog: Activity Module

### Events Published by Activity Module

| Event | Version | Description | Key Payload Fields | Subscribers |
|-------|---------|-------------|-------------------|-------------|
| `activity.logged` | 1 | Activity recorded for entity | activityId, orgId, entityType, entityId, action, actorId | Activity, Audit |
| `task.created` | 1 | New task created | taskId, orgId, title, assignee, dueDate, priority, relatedEntity | Notification, Activity, Audit |
| `task.updated` | 1 | Task details changed | taskId, orgId, changedFields | Activity, Audit |
| `task.assigned` | 1 | Task assigned to user | taskId, orgId, assignedTo, assignedBy | Notification, Activity, Audit |
| `task.completed` | 1 | Task marked complete | taskId, orgId, completedBy | Workflow, Notification, Activity, Audit |
| `task.deleted` | 1 | Task soft-deleted | taskId, orgId | Activity, Audit |

---

## 11. Event Catalog: Workflow Module

### Events Published by Workflow Module

| Event | Version | Description | Key Payload Fields | Subscribers |
|-------|---------|-------------|-------------------|-------------|
| `workflow.created` | 1 | New workflow definition created | workflowId, orgId, name, triggerType | Audit |
| `workflow.updated` | 1 | Workflow definition updated | workflowId, orgId, changedFields | Audit |
| `workflow.enabled` | 1 | Workflow enabled | workflowId, orgId | Audit |
| `workflow.disabled` | 1 | Workflow disabled | workflowId, orgId | Audit |
| `workflow.triggered` | 1 | Workflow triggered by event | executionId, workflowId, orgId, triggerEvent, inputData | Activity, Audit |
| `workflow.executed` | 1 | Workflow execution completed | executionId, workflowId, orgId, status, outputData, durationMs | Activity, AI, Audit |
| `workflow.failed` | 1 | Workflow execution failed | executionId, workflowId, orgId, error, retryCount | Notification, Audit |
| `workflow.loop.detected` | 1 | Infinite loop detected and broken | workflowId, orgId, executionId, depth | Audit |

---

## 12. Event Catalog: Notification Module

### Events Published by Notification Module

| Event | Version | Description | Key Payload Fields | Subscribers |
|-------|---------|-------------|-------------------|-------------|
| `notification.sent` | 1 | Notification delivered via channel | notificationId, orgId, userId, channel, notificationType | Activity, Audit |
| `notification.opened` | 1 | Notification opened/read | notificationId, userId, openedAt | Analytics |
| `notification.clicked` | 1 | Notification action clicked | notificationId, userId, actionUrl | Analytics |
| `notification.failed` | 1 | Notification delivery failed | notificationId, userId, channel, error | Audit |
| `notification.preferences.updated` | 1 | User notification preferences changed | userId, orgId, preferences | Notification |

---

## 13. Event Catalog: AI Module

### Events Published by AI Module

| Event | Version | Description | Key Payload Fields | Subscribers |
|-------|---------|-------------|-------------------|-------------|
| `ai.query.processed` | 1 | AI query completed | queryId, orgId, userId, provider, model, tokensUsed, durationMs | Audit, Analytics |
| `ai.embedding.generated` | 1 | Embedding generated for entity | entityType, entityId, orgId, model, dimensions | Search, Audit |
| `ai.lead.scored` | 1 | AI lead scoring completed | leadId, orgId, oldScore, newScore, modelVersion, factors | Activity, Lead |
| `ai.suggestion.generated` | 1 | AI suggestion created | suggestionId, orgId, entityType, entityId, suggestionType, content | Activity |
| `ai.provider.failed` | 1 | AI provider returned error | provider, model, errorType, orgId | AI |

---

## 14. Event Catalog: Integration Module

### Events Published by Integration Module

| Event | Version | Description | Key Payload Fields | Subscribers |
|-------|---------|-------------|-------------------|-------------|
| `integration.connected` | 1 | External integration connected | integrationId, orgId, provider, authType | Audit |
| `integration.disconnected` | 1 | External integration disconnected | integrationId, orgId, provider | Audit |
| `integration.sync.started` | 1 | Data sync initiated | syncId, orgId, provider, direction, entityTypes | Activity, Audit |
| `integration.sync.completed` | 1 | Data sync completed | syncId, orgId, provider, itemsProcessed, itemsFailed, durationMs | Activity, Audit |
| `integration.sync.failed` | 1 | Data sync failed | syncId, orgId, provider, error | Notification, Audit |
| `webhook.received` | 1 | Incoming webhook received | webhookId, orgId, provider, eventType | Integration, Audit |
| `webhook.delivered` | 1 | Outgoing webhook delivered | webhookId, orgId, url, statusCode, durationMs | Integration, Audit |
| `webhook.failed` | 1 | Outgoing webhook delivery failed | webhookId, orgId, url, error | Notification, Audit |
| `oauth.token.refreshed` | 1 | OAuth token refreshed | integrationId, orgId, provider | Integration, Audit |
| `oauth.token.expired` | 1 | OAuth token expired and cannot refresh | integrationId, orgId, provider | Notification, Audit |

---

## 15. Event Schema Evolution

### Backward-Compatible Changes (Allowed within Version)

- Adding new optional fields to `data`.
- Adding new metadata fields at the top level.
- Extending enum values (consumers must handle unknown values gracefully).

### Breaking Changes (Require New Event Version)

- Removing or renaming fields.
- Changing field types.
- Making optional fields required.
- Changing the semantic meaning of a field.

### Versioning Strategy

- Event version in `eventVersion` field.
- New version = new event name: `lead.created.v2`.
- Both versions coexist for the deprecation period.
- Deprecation period: minimum 6 months.

### Consumer Guidelines

```python
class LeadCreatedHandler:
    def handle(self, event: dict) -> None:
        version = event.get("eventVersion", 1)
        data = event["data"]
        
        if version == 1:
            email = data["email"]
            company_name = data["companyName"]
        elif version == 2:
            email = data.get("email", "")
            company_name = data.get("companyName", "")
            # v2 also has companySize field
        else:
            raise UnsupportedEventVersion(f"Version {version} not supported")
```

---

## 16. Complex Event Flows

### Flow 1: Lead Created → Workflow → Notification

```
Lead Management                     Workflow Engine                     Notification
     |                                   |                                   |
     |-- lead.created ------------------>|                                   |
     |                                   |-- Evaluate conditions            |
     |                                   |-- Matches workflow trigger        |
     |                                   |-- Execute actions                 |
     |                                   |                                   |
     |                                   |-- workflow.triggered              |
     |                                   |                                   |
     |                                   |-- (action: send welcome email)    |
     |                                   |      |                            |
     |                                   |      |-- notification.sent ---->  |
     |                                   |                                   |
     |                                   |-- workflow.executed               |
     |                                   |                                   |
```

### Flow 2: Lead Converted → Opportunity → Forecast Update

```
Lead Management         Pipeline Management        Forecast         Notification
     |                        |                        |                 |
     |-- lead.converted ----> |                        |                 |
     |                        |-- Create opportunity   |                 |
     |                        |-- opportunity.created  |                 |
     |                        |                        |                 |
     |                        |-- (stage: qualification)                  |
     |                        |                        |                 |
     |                        |-- opportunity.stage.changed               |
     |                        |                        |                 |
     |                        |                        |-- forecast.calc |
     |                        |                        |                 |
     |                        |-- (won after 45 days)                     |
     |                        |                        |                 |
     |                        |-- opportunity.won ---->|                 |
     |                        |                        |-- forecast.calc |
     |                        |                        |                 |
     |                        |-- notification.sent -------------------> |
```

### Flow 3: Tenant Provisioned → RLS → Organization Setup

```
Organization        Tenant              RBAC            Settings        Notification
     |                 |                   |                |                |
     |-- org.created ->|                   |                |                |
     |                 |-- Provision DB    |                |                |
     |                 |-- Generate RLS    |                |                |
     |                 |-- tenant.prov --->|                |                |
     |                 |                   |-- Create roles |                |
     |                 |                   |-- Assign admin |                |
     |                 |                   |                |                |
     |                 |                   |-- role.created |                |
     |                 |                   |                |                |
     |                 |                   |                |-- Create def.  |
     |                 |                   |                |-- settings     |
     |                 |                   |                |                |
     |                 |                   |                |-- notification |
     |                 |                   |                |---- sent ----> |
```

### Flow 4: AI Lead Scoring Pipeline

```
Lead Management          AI Module           AI Gateway         Search
     |                      |                    |                |
     |-- lead.created ----> |                    |                |
     |                      |-- Get embedding    |                |
     |                      |------ req -------->|                |
     |                      |<----- resp --------|                |
     |                      |                    |                |
     |                      |-- ai.embedding.gen |--------------> |
     |                      |                    |                |
     |                      |-- Score lead       |                |
     |                      |------ req -------->|                |
     |                      |<----- resp --------|                |
     |                      |                    |                |
     |                      |-- ai.lead.scored   |                |
     |<-- lead.scored ------|                    |                |
     |-- Update score in DB |                    |                |
     |-- lead.updated ----->|                    |                |
```

### Flow 5: Workflow Execution with Actions

```
Workflow Engine          Notification        Lead Management       Activity
     |                       |                     |                  |
     |-- (triggered by lead.created)               |                  |
     |                       |                     |                  |
     |-- Evaluate conditions |                     |                  |
     |-- (condition: source=website AND status=new)|                  |
     |                       |                     |                  |
     |-- Execute action 1: Assign lead             |                  |
     |-- (auto-assign to round-robin rep)          |                  |
     |                       |                     |                  |
     |                       |               <---- lead.assigned      |
     |                       |                     |                  |
     |-- Execute action 2: Send email              |                  |
     |-- notification.sent -->|                     |                  |
     |                       |                     |                  |
     |-- Execute action 3: Create task             |                  |
     |-- task.created ---------------------------->|                  |
     |                       |                     |                  |
     |-- workflow.executed   |                     |                  |
     |-- activity.logged ------------------------------------------> |
```
