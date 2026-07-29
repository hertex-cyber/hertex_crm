# Module Blueprint: Workflow Engine

- **Module:** `modules.workflow`
- **Bounded Context:** Automation & Business Process Orchestration
- **Status:** Draft v1.0

## Business Purpose

The Workflow Engine enables no-code and low-code automation of business processes. Users define triggers (event, schedule, webhook), conditions, and actions to automate repetitive tasks, enforce business rules, and orchestrate multi-step processes. Examples: auto-assign leads, send follow-up emails, update stage probabilities, notify managers on large deals.

## Bounded Context

This module owns Workflow Definitions, Workflow Executions, Conditions, Actions, and Schedules. It observes domain events from all other modules and executes actions within the tenant's context. It does NOT own the domain logic itself—it orchestrates calls to other modules' services.

## Aggregates, Entities, Value Objects

### Aggregate: WorkflowDefinition
- **WorkflowDefinition** (Aggregate Root)
  - `id: UUID v7`
  - `tenant_id: UUID v7`
  - `name: str`
  - `description: Text`
  - `module: str` (which module this workflow operates on: lead, opportunity, etc.)
  - `is_active: bool`
  - `version: int` (incremented on each publish)
  - `trigger_type: TriggerType`
  - `trigger_config: JSONB` (e.g., event name, cron expression)
  - `conditions: List[Condition]`
  - `actions: List[Action]` (ordered)
  - `error_handling: ErrorHandlingConfig`
  - `execution_timeout: int` (seconds)
  - `max_executions: int | null` (per day/entity)
  - `timestamps: created_at, updated_at, published_at, last_executed_at`

### Entities
- **WorkflowCondition** (child of WorkflowDefinition)
  - `id: UUID v7`
  - `workflow_id: FK`
  - `field: str` (e.g., "lead.amount", "opportunity.stage")
  - `operator: ConditionOperator`
  - `value: JSONB`
  - `logic_group: str` ("AND" / "OR" group name)

- **WorkflowAction** (child of WorkflowDefinition)
  - `id: UUID v7`
  - `workflow_id: FK`
  - `order: int`
  - `action_type: ActionType`
  - `config: JSONB` (type-specific configuration)
  - `delay_minutes: int | None`

- **WorkflowExecution** (Execution Record)
  - `id: UUID v7`
  - `tenant_id: UUID v7`
  - `workflow_id: FK`
  - `trigger_entity_id: UUID` (the entity that triggered execution)
  - `trigger_entity_type: str`
  - `status: ExecutionStatus`
  - `result: JSONB | null`
  - `error_message: Text | null`
  - `started_at: DateTime`
  - `completed_at: DateTime | null`
  - `retry_count: int`
  - `execution_context: JSONB` (snapshot of entity state at trigger time)

### Value Objects
- **TriggerType:** `enum(EVENT, SCHEDULE, WEBHOOK, MANUAL)`
- **ConditionOperator:** `enum(EQUALS, NOT_EQUALS, GREATER_THAN, LESS_THAN, CONTAINS, NOT_CONTAINS, IN, NOT_IN, IS_SET, IS_NOT_SET, CHANGED, CHANGED_TO, MATCHES_REGEX, BEFORE, AFTER)`
- **ActionType:** `enum(SEND_EMAIL, SEND_NOTIFICATION, ASSIGN_OWNER, UPDATE_FIELD, CREATE_RECORD, CALL_WEBHOOK, CALL_AI_ACTION, ADD_TAG, REMOVE_TAG, ESCALATE, ENTER_WORKFLOW)`
- **ExecutionStatus:** `enum(PENDING, RUNNING, SUCCESS, FAILED, TIMEOUT, SKIPPED)`
- **ErrorHandlingConfig:** `{retry_count: int, retry_delay: int, on_failure: FAIL | CONTINUE | NOTIFY }`

### Aggregate: WorkflowTemplate
- **WorkflowTemplate** (Pre-built workflow blueprints)
  - `id: UUID v7`
  - `name, description, category`
  - `trigger_type, conditions, actions` (same structure as WorkflowDefinition)

## Domain Events

- `WorkflowPublished` — Workflow version published
- `WorkflowDeactivated` — Workflow paused
- `WorkflowExecutionStarted` — Execution triggered
- `WorkflowExecutionCompleted` — Execution finished successfully
- `WorkflowExecutionFailed` — Execution failed (retries exhausted)
- `WorkflowExecutionSkipped` — Conditions not met
- `WorkflowQuotaExceeded` — Daily/monthly execution limit hit

## Commands & Queries

### Commands
- `CreateWorkflow(name, module, trigger, conditions, actions) → WorkflowId`
- `UpdateWorkflow(id, data) → Workflow`
- `PublishWorkflow(id) → Workflow` (create new version, activate)
- `DeactivateWorkflow(id) → Workflow`
- `DeleteWorkflow(id) → void`
- `TriggerWorkflow(workflow_id, entity_id, entity_type) → ExecutionId`
- `RetryExecution(execution_id) → Execution`
- `ValidateWorkflow(workflow_data) → ValidationResult`
- `ApplyTemplate(template_id, tenant_id, config) → WorkflowId`

### Queries
- `GetWorkflow(id) → WorkflowDefinition`
- `ListWorkflows(module?, is_active?) → List[WorkflowDefinition]`
- `GetWorkflowExecutions(workflow_id, status?, date_range?) → PaginatedResult[Execution]`
- `GetExecution(id) → WorkflowExecution`
- `GetExecutionLogs(id) → List[ExecutionLog]`
- `GetWorkflowStats(workflow_id, period) → Stats`
- `ListTemplates(category?) → List[WorkflowTemplate]`
- `ValidateExpression(expression, context) → ValidationResult`

## Application Services

- `WorkflowDefinitionService` — CRUD, versioning, publish/deactivate
- `WorkflowExecutionService` — Trigger, execute, retry, handle timeouts
- `ConditionEvaluator` — Evaluate conditions against entity state
- `ActionExecutor` — Execute actions (send email, update field, call webhook)
- `EventRouter` — Subscribe to domain events and route to matching workflows
- `WorkflowTemplateService` — Pre-built workflows, apply templates
- `WorkflowScheduler` — Cron/schedule-based workflow triggering

## API Endpoints

| Method | URL | Description | Permissions |
|--------|-----|-------------|-------------|
| GET | `/api/v1/workflows/` | List workflows | `workflow.view_workflow` |
| POST | `/api/v1/workflows/` | Create workflow | `workflow.add_workflow` |
| GET | `/api/v1/workflows/{id}/` | Get workflow details | `workflow.view_workflow` |
| PUT | `/api/v1/workflows/{id}/` | Update workflow | `workflow.change_workflow` |
| DELETE | `/api/v1/workflows/{id}/` | Delete workflow | `workflow.delete_workflow` |
| POST | `/api/v1/workflows/{id}/publish/` | Publish workflow | `workflow.publish_workflow` |
| POST | `/api/v1/workflows/{id}/deactivate/` | Deactivate | `workflow.change_workflow` |
| POST | `/api/v1/workflows/{id}/test/` | Test with sample data | `workflow.test_workflow` |
| GET | `/api/v1/workflows/{id}/executions/` | List executions | `workflow.view_workflow` |
| GET | `/api/v1/workflows/{id}/executions/{eid}/` | Get execution details | `workflow.view_workflow` |
| POST | `/api/v1/workflows/{id}/executions/{eid}/retry/` | Retry execution | `workflow.retry_execution` |
| GET | `/api/v1/workflows/{id}/stats/` | Workflow statistics | `workflow.view_workflow` |
| GET | `/api/v1/workflows/templates/` | List templates | `workflow.view_workflow` |
| POST | `/api/v1/workflows/templates/{id}/apply/` | Apply template | `workflow.add_workflow` |
| GET | `/api/v1/workflows/audit-log/` | Workflow audit log | `workflow.view_audit` |

## Database Tables

- `workflow_definition` — Core workflow definitions
- `workflow_condition` — Conditions for workflow triggering
- `workflow_action` — Actions to execute
- `workflow_execution` — Execution records
- `workflow_execution_log` — Step-by-step execution logs
- `workflow_template` — Pre-built templates
- `workflow_schedule` — Cron schedule definitions

### Key Indexes
- `(tenant_id, module, is_active)` — Module-based workflow listing
- `(tenant_id, trigger_type)` — Event vs Schedule workflows
- `(workflow_id, status, started_at)` — Execution queries
- `(tenant_id, trigger_entity_type, trigger_entity_id)` — Entity execution history
- `(scheduled_at)` — Scheduler polling

## Validation Rules

| Field | Rule |
|-------|------|
| name | Required, max 255 chars, unique per tenant |
| trigger_type | Required. If EVENT, trigger_config must include event_name. If SCHEDULE, must include cron expression. |
| conditions | At least one condition required (or leave empty for "always trigger") |
| actions | At least one action required |
| action delay | If set, must be ≥ 0 minutes |
| execution_timeout | 1-3600 seconds |
| max_executions | If set, must be ≥ 1 |
| cron expression | Must be valid 5- or 6-field cron format |
| event_name | Must exist in `shared_kernel.events.EVENT_REGISTRY` |

## Workflows & State Machine

### Workflow Execution State Machine

```
                            ┌──────────┐
                            │  PENDING  │
                            └────┬─────┘
                            ┌────┴─────┐
                       ┌────▼───┐   ┌──▼──────────┐
                       │ RUNNING │   │  SKIPPED    │
                       └────┬───┘   │ (conditions  │
                    ┌───────┼──────┐ │ not met)     │
              ┌─────▼──┐ ┌──▼───┐ ┌▼─────┐        │
              │ SUCCESS │ │FAILED│ │TIMEOUT│      └──────────┘
              └────────┘ └──┬───┘ └──────┘
                     ┌──────▼──────┐
                     │ RETRY (max) │
                     └─────────────┘
```

### Workflow Lifecycle
1. **Draft:** Workflow being edited, not yet active
2. **Published:** Active and listening for triggers
3. **Deactivated:** Manually paused, not responding to triggers
4. **Archived:** Deleted (soft-delete with history preserved)

### Execution Flow
1. Trigger occurs (event published, cron tick, webhook received)
2. Workflow definitions matching trigger are loaded
3. Conditions evaluated against entity state (with context snapshot)
4. If conditions met → Create `WorkflowExecution` (PENDING)
5. Execute actions in order (with optional delays between them)
6. On action failure → Retry according to config, then mark FAILED
7. On success → Mark SUCCESS
8. Logs written to `workflow_execution_log`

## Security & Permissions

| Permission | Description |
|------------|-------------|
| `workflow.view_workflow` | View workflow definitions |
| `workflow.add_workflow` | Create workflows |
| `workflow.change_workflow` | Edit workflows |
| `workflow.delete_workflow` | Delete workflows |
| `workflow.publish_workflow` | Publish/deactivate workflows |
| `workflow.test_workflow` | Test workflows with sample data |
| `workflow.retry_execution` | Retry failed executions |
| `workflow.view_audit` | View execution audit log |
| `workflow.manage_templates` | Manage workflow templates |

All workflow actions execute with the permissions of the workflow creator (elevated privileges for automation). This is tracked in the execution context.

## Testing Strategy

| Layer | Focus |
|-------|-------|
| Unit | Condition evaluation (all operators on all types), Action config validation, State machine transitions, Cron expression validation, Delay computation |
| Integration | Event → workflow matching, Multi-condition evaluation (AND/OR groups), Action executor (email, field update, webhook), Execution with retries |
| API | Workflow CRUD, Publish/deactivate lifecycle, Execution listing and filtering, Template application |
| E2E | Create workflow → trigger via domain event → verify execution, Scheduled workflow triggering |

## Future Enhancements

- **Visual Workflow Editor:** Drag-and-drop workflow builder (frontend)
- **Branching:** Conditional paths in workflow (IF/ELSE, SWITCH)
- **Loops:** Iterate over collections within workflows
- **Sub-Workflows:** Call another workflow as an action
- **Approval Steps:** Human-in-the-loop approval nodes
- **AI Actions:** Call AI model for decision/completion as action step
- **Version Comparison:** Diff between workflow versions
- **A/B Testing:** Run two workflow versions and compare outcomes
- **Rate Limiting:** Per-workflow execution caps per time window
- **Execution Simulation:** Preview workflow behavior before publishing
