# TZAHU CRM — Workflow Engine

> **Version:** 0.1.0-draft
> **Last Updated:** 2026-07-27
> **Status:** Foundational Design Phase
> **Owner:** Platform Architecture Team

---

## Table of Contents

1. [Overview](#1-overview)
2. [Trigger Types](#2-trigger-types)
3. [Condition Engine](#3-condition-engine)
4. [Action Types](#4-action-types)
5. [Execution Model](#5-execution-model)
6. [Retry Policy](#6-retry-policy)
7. [Scheduling](#7-scheduling)
8. [Loop Prevention](#8-loop-prevention)
9. [Audit](#9-audit)
10. [Versioning](#10-versioning)
11. [API](#11-api)

---

## 1. Overview

The Workflow Engine enables users to automate CRM processes without writing code. It follows an ECA (Event-Condition-Action) pattern: when a **trigger** fires, **conditions** are evaluated, and matching **actions** are executed.

The engine powers lead assignment, pipeline automation, notification routing, and integration triggers. It is defined in the `workflow` bounded context.

### 1.1 Architecture Integration

```
Domain Events      Workflow Engine       Action Workers
(RabbitMQ) ──────► (Condition Eval) ───► (Celery)
                        │
                        ▼
                  Audit Log
                  (Execution History)
```

The workflow module subscribes to domain events from all CRM modules via the `workflow_queue` in RabbitMQ. Scheduled workflows are triggered by Celery Beat. Actions are dispatched to the `workflow` Celery queue for asynchronous execution with retry logic.

### 1.2 Core Domain Model

```
WorkflowDefinition:
  id: UUID (PK)
  organization_id: UUID (tenant)
  name: str
  description: str | None
  trigger_type: entity_event | scheduled | manual | webhook | api
  trigger_config: dict (type-specific config)
  conditions: ConditionNode (tree of conditions)
  actions: list[ActionDefinition]
  execution_mode: sequential | parallel | conditional
  enabled: bool
  version: int
  created_at: datetime
  updated_at: datetime
  active_version_id: UUID | None

ExecutionRecord:
  id: UUID (PK)
  workflow_id: UUID (FK)
  workflow_version: int
  trigger_event: str
  conditions_evaluated: int
  conditions_matched: bool
  actions_executed: int
  status: pending | running | completed | failed | cancelled
  duration_ms: int
  error: str | None
  started_at: datetime
  completed_at: datetime | None
  organization_id: UUID
  actor_id: UUID | None

ActionExecution:
  id: UUID (PK)
  execution_id: UUID (FK)
  action_type: str
  action_config: dict
  status: pending | running | completed | failed | skipped
  result: dict | None
  error: str | None
  retry_count: int
  duration_ms: int
  started_at: datetime | None
  completed_at: datetime | None
```

---

## 2. Trigger Types

### 2.1 Entity Event Triggers

Fires when a domain event occurs for a specific entity type.

```json
{
  "trigger_type": "entity_event",
  "trigger_config": {
    "entity_type": "lead",
    "events": ["created", "updated"],
    "filters": {
      "status": "new",
      "source_type": ["website", "referral"]
    },
    "debounce_seconds": 300
  }
}
```

| Entity | Trigger Events | Common Use Case |
|--------|---------------|-----------------|
| `lead` | created, updated, converted, assigned, scored | Auto-assign lead to rep |
| `contact` | created, updated, merged | Sync to Mailchimp |
| `opportunity` | created, updated, won, lost, stage_changed | Notify manager on won |
| `task` | created, updated, completed, overdue | Escalate overdue tasks |
| `activity` | created (email, call, meeting) | Log call to timeline |
| `account` | created, updated | Create Slack channel |

### 2.2 Scheduled Triggers (Cron)

Fires on a schedule using cron expressions.

```json
{
  "trigger_type": "scheduled",
  "trigger_config": {
    "schedule_type": "cron",
    "cron_expression": "0 9 * * 1",
    "timezone": "America/New_York",
    "missed_execution_policy": "catch_up",
    "start_date": "2026-01-01T00:00:00Z",
    "end_date": null,
    "interval_seconds": null
  }
}
```

Missed execution policies:

| Policy | Behavior | Use Case |
|--------|----------|----------|
| `catch_up` | Execute all missed runs | Weekly digest |
| `skip` | Skip missed, run next scheduled | Cleanup (no catch-up needed) |
| `run_last` | Only run the most recent | Report generation |

### 2.3 Manual Triggers

Fired when a user clicks "Run Workflow" in the UI.

```json
{
  "trigger_type": "manual",
  "trigger_config": {
    "requires_confirmation": true,
    "allowed_roles": ["admin", "manager"],
    "input_schema": {
      "type": "object",
      "properties": {
        "pipeline_id": {"type": "string", "format": "uuid"}
      }
    }
  }
}
```

### 2.4 Webhook Triggers (Inbound)

Fires when an external system sends an HTTP POST to the webhook URL.

```json
{
  "trigger_type": "webhook",
  "trigger_config": {
    "webhook_url": "https://api.tzahu.com/webhooks/wf_abc123",
    "secret": "whsec_xxx",
    "method": "POST",
    "signature_header": "X-Tzahu-Signature",
    "signature_algorithm": "sha256",
    "content_type": "application/json",
    "ip_allowlist": ["203.0.113.0/24"]
  }
}
```

### 2.5 API Trigger (Programmatic)

Fires when any system calls the workflow execution API endpoint.

```json
{
  "trigger_type": "api",
  "trigger_config": {
    "allowed_roles": ["admin", "api_client"],
    "rate_limit": "1000/hour"
  }
}
```

---

## 3. Condition Engine

### 3.1 Condition Tree Structure

Conditions are a tree of logical nodes (AND, OR, NOT) with comparison leaves.

```json
{
  "condition_tree": {
    "type": "and",
    "conditions": [
      {
        "type": "comparison",
        "field": "lead.score",
        "operator": ">=",
        "value": 80
      },
      {
        "type": "or",
        "conditions": [
          {
            "type": "comparison",
            "field": "lead.source_type",
            "operator": "in",
            "value": ["website", "referral"]
          },
          {
            "type": "not",
            "condition": {
              "type": "comparison",
              "field": "lead.owner_id",
              "operator": "is_set",
              "value": null
            }
          }
        ]
      }
    ]
  }
}
```

### 3.2 Field Comparison Operators

| Operator | Operand Types | Description |
|----------|--------------|-------------|
| `=` | All | Equal to value |
| `!=` | All | Not equal to value |
| `>` | Number, Date | Greater than |
| `<` | Number, Date | Less than |
| `>=` | Number, Date | Greater than or equal |
| `<=` | Number, Date | Less than or equal |
| `contains` | String | Substring match |
| `in` | List | Member of set |
| `not_in` | List | Not member of set |
| `between` | Range | Within inclusive range |
| `is_set` | All | Value is not null |
| `is_not_set` | All | Value is null |
| `starts_with` | String | Prefix match |
| `ends_with` | String | Suffix match |
| `matches` | String | Regex match |

### 3.3 Date Math

| Expression | Description |
|------------|-------------|
| `now` | Current UTC time |
| `now - Nd` | N days ago |
| `now + Nd` | N days from now |
| `now - Nh` | N hours ago |
| `now + Nh` | N hours from now |
| `today()` | Start of current UTC day |
| `today() + Nd` | N days from start of day |
| `field + Nd` | Add N days to a datetime field |
| `field - Nd` | Subtract N days from a datetime field |

### 3.4 Node Types

```python
@dataclass
class ComparisonNode(ConditionNode):
    field: str
    operator: str
    value: Any

@dataclass
class AndNode(ConditionNode):
    conditions: list[ConditionNode]

@dataclass
class OrNode(ConditionNode):
    conditions: list[ConditionNode]

@dataclass
class NotNode(ConditionNode):
    condition: ConditionNode

@dataclass
class SubQueryNode(ConditionNode):
    entity: str
    filter: ComparisonNode
    aggregation: str  # count, sum, avg, max, min
    operator: str
    value: Any
```

---

## 4. Action Types

### 4.1 Action Catalog

| Action Type | Description | Configuration |
|-------------|-------------|---------------|
| `update_field` | Update a field on the trigger entity | field, value |
| `assign_owner` | Assign entity to user/team | user_id, team_id, round_robin_group |
| `send_notification` | Send notification via channel | channel (email/sms/in-app/push), template, recipients |
| `trigger_webhook` | POST data to external URL | url, headers, body_template, method |
| `create_task` | Create a follow-up task | title, description, assignee, due_date, priority |
| `update_pipeline_stage` | Move opportunity to new stage | pipeline_id, stage_id |
| `call_api` | Call internal/external API | url, method, headers, body |
| `execute_workflow` | Run another workflow | workflow_id, input_mapping |
| `create_record` | Create a new entity record | entity_type, field_values |
| `send_email` | Send transactional email | to, from, subject, body, template_id |
| `add_tag` | Add tag to entity | tag_name |
| `log_activity` | Log activity to timeline | activity_type, description |

### 4.2 Action Definition Schema

```python
@dataclass
class ActionDefinition:
    action_type: str
    config: dict
    name: str
    description: str | None = None
    condition: ConditionNode | None = None  # Per-action condition
    continue_on_error: bool = False
    timeout_seconds: int = 30
```

### 4.3 Dynamic Field Values

Action config values can reference trigger data using template syntax:

```json
{
  "action_type": "update_field",
  "config": {
    "field": "lead.status",
    "value": "{{ 'qualified' if trigger.lead.score >= 80 else 'nurturing' }}"
  }
}
```

Available template variables:

| Variable | Description |
|----------|-------------|
| `trigger.entity.field` | The triggering entity's field value |
| `actor.id` | ID of the user who triggered the event |
| `actor.name` | Name of the triggering user |
| `org.id` | Current organization ID |
| `now` | Current timestamp (ISO 8601) |
| `random.int(min, max)` | Random integer for round-robin |
| `env.VARIABLE` | Environment variable (admin-defined) |

---

## 5. Execution Model

### 5.1 Sequential Execution

Actions run one after another. If an action fails, subsequent actions can either stop or continue based on `continue_on_error`.

```
Action 1 ──► Action 2 ──► Action 3
  (success)   (success)   (success)
```

### 5.2 Parallel Execution (Fan-Out)

Actions run concurrently. All must complete (or fail) before the workflow completes.

```
        ┌── Action 1 ──┐
Trigger ──┤  Action 2    ├──► Complete
        └── Action 3 ──┘
```

### 5.3 Conditional Branching

Actions have per-action conditions. Only actions whose conditions match are executed.

```
        ┌── condition? ── Action 1
Trigger ──┤
        └── condition? ── Action 2
```

### 5.4 Action Timeout

Each action has a configurable timeout (default 30s). If an action exceeds the timeout, it is marked as failed and the retry policy applies.

---

## 6. Retry Policy

### 6.1 Retry Configuration

```json
{
  "retry_policy": {
    "max_retries": 3,
    "initial_delay_seconds": 1,
    "backoff_multiplier": 4,
    "max_delay_seconds": 60,
    "retryable_errors": [
      "timeout",
      "rate_limit_exceeded",
      "service_unavailable",
      "internal_error"
    ]
  }
}
```

### 6.2 Retry Schedule

| Attempt | Delay | Cumulative |
|---------|-------|------------|
| 1 | 1s | 1s |
| 2 | 4s | 5s |
| 3 | 16s | 21s |

After 3 retries exhausted, the action is sent to the dead-letter queue.

### 6.3 Dead-Letter Queue (DLQ)

```json
{
  "dlq_message": {
    "execution_id": "uuid",
    "action_id": "uuid",
    "action_type": "send_email",
    "error": "SendGrid 503 Service Unavailable",
    "retry_count": 3,
    "failed_at": "2026-07-27T10:30:00Z",
    "payload": { ... }
  }
}
```

DLQ actions are:
1. Logged with full context
2. Alert sent to admin (if threshold > 100 DLQ messages)
3. Available for manual retry via admin UI
4. Automatically re-queued after root cause resolution

---

## 7. Scheduling

### 7.1 Cron Expression Support

Standard 5-field cron with optional seconds field:

```
┌───────── minute (0-59)
│ ┌───────── hour (0-23)
│ │ ┌───────── day of month (1-31)
│ │ │ ┌───────── month (1-12)
│ │ │ │ ┌───────── day of week (0-6, 0=Sunday)
│ │ │ │ │
* * * * *
```

Special expressions:

| Expression | Meaning |
|------------|---------|
| `@daily` | 0 0 * * * |
| `@weekly` | 0 0 * * 0 |
| `@monthly` | 0 0 1 * * |
| `@hourly` | 0 * * * * |
| `every N minutes` | */N * * * * |

### 7.2 Timezone Handling

All cron expressions are timezone-aware. The engine uses `pytz` for timezone conversion:

1. Store workflow timezone (e.g., `America/New_York`)
2. Convert cron expression to UTC for scheduling
3. Handle DST transitions: if a scheduled time falls in a DST gap, execute at the nearest valid time
4. If a scheduled time falls in a DST overlap (fall-back), execute once

### 7.3 Missed Execution Catch-Up

When Celery Beat misses a scheduled execution (e.g., worker was down), the `missed_execution_policy` determines behavior:

- **catch_up**: Backfill all missed executions immediately
  - Limit: max 10 missed executions per catch-up to prevent thundering herd
- **skip**: Log the miss and continue with next schedule
- **run_last**: Only execute the most recent missed schedule

---

## 8. Loop Prevention

### 8.1 Max Depth

A workflow cannot trigger more than 10 nested workflow executions. The `x-depth` header or event metadata tracks the current depth:

```json
{
  "workflow_metadata": {
    "depth": 1,
    "max_depth": 10,
    "workflow_chain": ["wf_a", "wf_b"]
  }
}
```

### 8.2 Recursion Detection

The engine detects potential infinite loops by tracking workflow execution chains:

- **Workflow ID in chain**: If a workflow is already in the execution chain, execution is blocked
- **Entity recursion**: If more than 5 workflows execute on the same entity within 60 seconds, further execution is blocked
- **Anti-flapping**: If a workflow toggles a field back-and-forth (A→B→A→B) within 5 iterations, suspension is triggered

### 8.3 Self-Terminating Workflow Flag

Workflows can be marked as `self_terminating = True` to explicitly allow recursion (for workflows that converge). A self-terminating workflow must have at least one condition that will eventually evaluate to false.

### 8.4 Circuit Breaker

If a workflow execution fails more than 10 times in a row, the workflow is automatically disabled and an alert is sent to the org admin.

---

## 9. Audit

### 9.1 Execution Log Schema

```sql
CREATE TABLE workflow_execution_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    workflow_id UUID NOT NULL REFERENCES workflow_definitions(id),
    workflow_version INT NOT NULL,
    trigger_event VARCHAR(255) NOT NULL,
    conditions_evaluated INT NOT NULL DEFAULT 0,
    conditions_matched BOOLEAN NOT NULL DEFAULT FALSE,
    actions_executed INT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL,  -- pending, running, completed, failed, cancelled
    duration_ms INT,
    error TEXT,
    input_data JSONB,
    output_data JSONB,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    organization_id UUID NOT NULL,
    actor_id UUID,
    trace_id VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workflow_exec_org_status ON workflow_execution_records(organization_id, status);
CREATE INDEX idx_workflow_exec_workflow ON workflow_execution_records(workflow_id, started_at DESC);
CREATE INDEX idx_workflow_exec_trigger ON workflow_execution_records(trigger_event);

CREATE TABLE workflow_action_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    execution_id UUID NOT NULL REFERENCES workflow_execution_records(id),
    action_type VARCHAR(100) NOT NULL,
    action_config JSONB NOT NULL,
    status VARCHAR(20) NOT NULL,
    result JSONB,
    error TEXT,
    retry_count INT NOT NULL DEFAULT 0,
    duration_ms INT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    organization_id UUID NOT NULL
);

CREATE INDEX idx_action_exec_execution ON workflow_action_executions(execution_id);
CREATE INDEX idx_action_exec_status ON workflow_action_executions(status);
```

### 9.2 Audit Log Entry

Each execution log includes:

| Field | Description |
|-------|-------------|
| workflow_id | Workflow definition ID |
| workflow_version | Version used for this execution |
| trigger_event | The event that triggered execution |
| conditions_evaluated | Number of condition nodes evaluated |
| conditions_matched | Whether the overall condition tree matched |
| actions_executed | Count of actions that were executed |
| status | Final execution status |
| duration_ms | Total execution time |
| error | Error message (if failed) |
| input_data | The event data that triggered the workflow |
| output_data | Results from each action |
| organization_id | Tenant context |
| actor_id | User who triggered (if manual/user-initiated) |
| trace_id | OpenTelemetry trace ID |

---

## 10. Versioning

### 10.1 Workflow Versioning Model

Each workflow definition has a version history. When a workflow is edited, a new version is created.

```sql
CREATE TABLE workflow_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    workflow_id UUID NOT NULL REFERENCES workflow_definitions(id),
    version INT NOT NULL,
    definition JSONB NOT NULL,  -- Full snapshot of the workflow definition
    change_summary VARCHAR(500),
    created_by_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(workflow_id, version)
);

CREATE TABLE workflow_definitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    organization_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    active_version_id UUID REFERENCES workflow_versions(id),
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 10.2 Version Lifecycle

1. **Draft**: Workflow is being edited (no active version)
2. **Published**: A version is set as active; new executions use this version
3. **Superceded**: A new version is published; old versions are preserved for historical executions
4. **Rollback**: Admin can set a previous version as active

### 10.3 Active Version for New Executions

When a workflow is enabled, the active version is used for all new executions:
- In-progress executions continue using the version they started with
- Scheduled executions use the active version at the time of execution
- If a workflow has no active version, it cannot be executed

### 10.4 Rollback Support

To rollback to a previous version:
1. Admin navigates to workflow version history
2. Selects the desired version
3. System creates a new version that is an exact copy of the selected version
4. The new version becomes active, and a rollback event is logged

---

## 11. API

### 11.1 Workflow CRUD Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/workflows` | List workflows (paginated, filterable) |
| POST | `/api/v1/workflows` | Create workflow definition |
| GET | `/api/v1/workflows/{id}` | Get workflow details |
| PUT | `/api/v1/workflows/{id}` | Update workflow (creates new version) |
| DELETE | `/api/v1/workflows/{id}` | Delete workflow (soft delete) |
| POST | `/api/v1/workflows/{id}/enable` | Enable workflow |
| POST | `/api/v1/workflows/{id}/disable` | Disable workflow |

### 11.2 Version Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/workflows/{id}/versions` | List version history |
| GET | `/api/v1/workflows/{id}/versions/{version}` | Get version definition |
| POST | `/api/v1/workflows/{id}/versions/{version}/activate` | Set version as active |
| POST | `/api/v1/workflows/{id}/versions/{version}/rollback` | Rollback to version |

### 11.3 Execution Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/workflows/{id}/execute` | Manual trigger execution |
| GET | `/api/v1/workflows/{id}/executions` | List execution history |
| GET | `/api/v1/executions/{id}` | Get execution details |
| GET | `/api/v1/executions/{id}/actions` | Get action execution details |
| POST | `/api/v1/executions/{id}/retry` | Retry a failed execution |
| POST | `/api/v1/executions/{id}/cancel` | Cancel a running execution |

### 11.4 Test Run

```json
POST /api/v1/workflows/{id}/test-run
{
  "test_data": {
    "entity_type": "lead",
    "entity_id": "test-uuid",
    "event": "created",
    "data": {
      "lead": {
        "score": 85,
        "status": "new",
        "source_type": "website",
        "email": "test@example.com"
      }
    }
  }
}

Response:
{
  "conditions_matched": true,
  "actions_to_execute": 3,
  "actions": [
    {"type": "update_field", "config": {...}},
    {"type": "assign_owner", "config": {...}},
    {"type": "send_notification", "config": {...}}
  ],
  "warnings": []
}
```

### 11.5 Execution History Query

```json
GET /api/v1/workflows/{id}/executions?status=failed&from=2026-06-01&to=2026-07-01&page=1&page_size=20

{
  "items": [
    {
      "id": "uuid",
      "workflow_id": "uuid",
      "trigger_event": "lead.created",
      "status": "failed",
      "duration_ms": 4500,
      "error": "SendGrid API timeout after 3 retries",
      "started_at": "2026-06-15T10:30:00Z",
      "completed_at": "2026-06-15T10:30:05Z"
    }
  ],
  "total_count": 42,
  "page": 1,
  "page_size": 20,
  "has_next": true,
  "has_previous": false
}
```

### 11.6 Validation Rules

When creating/updating a workflow, the API validates:

1. At least one trigger type is configured
2. Trigger config is valid for the chosen trigger type
3. Condition tree has at least one condition
4. At least one action is defined
5. Action config is valid for the chosen action type
6. Maximum recursion depth is not exceeded in `execute_workflow` actions
7. Referenced workflows, pipelines, and users exist
8. Webhook URL is unique per organization
9. Cron expression is valid if trigger is `scheduled`
10. Template variables reference valid field paths
