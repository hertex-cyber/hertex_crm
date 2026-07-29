# Module Blueprint: Activity & Task

- **Module:** `apps.activity`, `apps.task`
- **Bounded Context:** Activity Logging & Task Management
- **Status:** Draft v1.0

## Business Purpose

The Activity & Task module records all interactions with CRM entities (calls, emails, meetings, notes) and manages task assignments, deadlines, and completion workflows. Activities form the timeline for every entity. Tasks are actionable items assigned to users with due dates and priorities.

## Bounded Context

This module owns Activity records (immutable event log for any entity) and Tasks (actionable work items). It does NOT own Calendar events (those belong to Calendar module) or Notifications (Notification module), though it emits events that trigger them.

## Aggregates, Entities, Value Objects

### Aggregate: Activity
- **Activity** (Aggregate Root — immutable after creation)
  - `id: UUID v7`
  - `tenant_id: UUID v7`
  - `entity_type: str` (e.g., "lead", "contact", "opportunity", "account")
  - `entity_id: UUID v7`
  - `activity_type: ActivityType`
  - `subject: str`
  - `description: Text`
  - `participants: List[UUID]` (user IDs involved)
  - `metadata: JSONB` (type-specific data: call duration, email body, meeting link)
  - `is_private: bool`
  - `created_by: UUID v7 (FK to User)`
  - `created_at: DateTime` (immutable)

### Value Objects
- **ActivityType:** `enum(CALL, EMAIL, MEETING, NOTE, TASK_COMPLETED, STATUS_CHANGE, STAGE_CHANGE, EMAIL_OPENED, LINK_CLICKED, FORM_SUBMISSION, CHAT_MESSAGE, SYSTEM_EVENT)`

### Aggregate: Task
- **Task** (Aggregate Root)
  - `id: UUID v7`
  - `tenant_id: UUID v7`
  - `subject: str`
  - `description: Text`
  - `priority: Priority`
  - `status: TaskStatus`
  - `entity_type: str | None` (related CRM entity)
  - `entity_id: UUID v7 | None`
  - `assigned_to: UUID v7 (FK to User) — nullable`
  - `assigned_by: UUID v7 (FK to User)`
  - `due_date: DateTime | None`
  - `completed_at: DateTime | None`
  - `reminder_at: DateTime | None`
  - `parent_task_id: UUID v7 (FK to Task) — nullable`
  - `recurrence_rule: RecurrenceRule | None`
  - `custom_fields: JSONB`
  - `timestamps: created_at, updated_at`

### Value Objects
- **Priority:** `enum(HIGH, MEDIUM, LOW)`
- **TaskStatus:** `enum(NOT_STARTED, IN_PROGRESS, COMPLETED, DEFERRED, CANCELLED)`
- **RecurrenceRule:** `{frequency: DAILY|WEEKLY|MONTHLY, interval: int, end_date: DateTime | None, occurrences: int | None}`

### Entities
- **TaskComment:** Comments/discussion on a task
- **TaskAttachment:** File attachments on a task
- **TaskDependency:** Task depends on another task

## Domain Events

- `ActivityLogged` — Activity recorded for entity
- `TaskCreated` — New task assigned
- `TaskUpdated` — Task details changed
- `TaskCompleted` — Task marked done
- `TaskDeferred` — Task postponed
- `TaskOverdue` — Past due date without completion
- `TaskReassigned` — Owner changed
- `TaskCommentAdded` — Discussion on task

## Commands & Queries

### Commands
- `LogActivity(entity_type, entity_id, type, data) → ActivityId`
- `LogBulkActivities(entities, type, data) → int`
- `CreateTask(subject, assigned_to, due_date, priority) → TaskId`
- `UpdateTask(task_id, data) → Task`
- `CompleteTask(task_id) → Task`
- `DeferTask(task_id, new_due_date) → Task`
- `CancelTask(task_id, reason) → Task`
- `ReassignTask(task_id, user_id) → Task`
- `AddTaskComment(task_id, comment) → TaskComment`
- `CreateRecurringTask(template, schedule) → TaskId`

### Queries
- `GetActivity(id) → Activity`
- `GetEntityTimeline(entity_type, entity_id) → PaginatedResult[Activity]`
- `GetRecentActivities(tenant_id, limit) → List[Activity]`
- `GetTask(id) → Task`
- `ListTasks(filters, sort, page) → PaginatedResult[Task]`
- `GetMyTasks(user_id, status?, priority?) → PaginatedResult[Task]`
- `GetOverdueTasks(user_id) → List[Task]`
- `GetTaskComments(task_id) → List[TaskComment]`
- `GetTaskStats(user_id, period) → Stats` (completed, overdue, by priority)

## Application Services

- `ActivityService` — Log activities, query timelines
- `TaskService` — Task CRUD, assignment, status management
- `TaskReminderService` — Send reminders for upcoming/overdue tasks
- `TaskRecurrenceService` — Generate recurring task instances
- `TaskDashboardService` — Aggregated task views and statistics

## API Endpoints

### Activities
| Method | URL | Description | Permissions |
|--------|-----|-------------|-------------|
| GET | `/api/v1/activities/` | List activities | `activity.view_activity` |
| POST | `/api/v1/activities/` | Log activity | `activity.add_activity` |
| GET | `/api/v1/activities/{id}/` | Get activity | `activity.view_activity` |
| GET | `/api/v1/activities/entity/{type}/{id}/` | Entity timeline | `activity.view_activity` |
| GET | `/api/v1/activities/recent/` | Recent activities | `activity.view_activity` |

### Tasks
| Method | URL | Description | Permissions |
|--------|-----|-------------|-------------|
| GET | `/api/v1/tasks/` | List tasks | `task.view_task` |
| POST | `/api/v1/tasks/` | Create task | `task.add_task` |
| GET | `/api/v1/tasks/{id}/` | Get task details | `task.view_task` |
| PUT | `/api/v1/tasks/{id}/` | Update task | `task.change_task` |
| PATCH | `/api/v1/tasks/{id}/` | Partial update | `task.change_task` |
| DELETE | `/api/v1/tasks/{id}/` | Delete task | `task.delete_task` |
| POST | `/api/v1/tasks/{id}/complete/` | Mark complete | `task.change_task` |
| POST | `/api/v1/tasks/{id}/defer/` | Defer task | `task.change_task` |
| POST | `/api/v1/tasks/{id}/reassign/` | Reassign | `task.assign_task` |
| GET | `/api/v1/tasks/{id}/comments/` | List comments | `task.view_task` |
| POST | `/api/v1/tasks/{id}/comments/` | Add comment | `task.change_task` |
| GET | `/api/v1/tasks/my/` | My tasks | `task.view_task` |
| GET | `/api/v1/tasks/overdue/` | Overdue tasks | `task.view_task` |
| GET | `/api/v1/tasks/stats/` | Task statistics | `task.view_task` |

## Database Tables

- `activity_activity` — Immutable activity log
- `task_task` — Core task table
- `task_comment` — Task discussion comments
- `task_attachment` — Task file attachments
- `task_dependency` — Task dependency graph
- `task_recurrence_template` — Recurring task definitions

### Key Indexes
- `(tenant_id, entity_type, entity_id, created_at)` — Entity timeline
- `(tenant_id, activity_type, created_at)` — Activity type queries
- `(tenant_id, assigned_to, status)` — User task listing
- `(tenant_id, due_date, status)` — Overdue detection
- `(tenant_id, priority, status)` — Priority queries
- `(tenant_id, created_by)` — Creator queries
- `_search_vector` GIN index for FTS

## Validation Rules

| Field | Rule |
|-------|------|
| activity.entity_type | Must be a valid registered entity type |
| task.due_date | Must be in the future on creation |
| task.priority | Must be valid enum |
| task.status | Transitions: NOT_STARTED→IN_PROGRESS→COMPLETED; any→CANCELLED |
| due_date → priority | Overdue tasks auto-escalate priority |
| reminder_at | Must be before due_date |
| parent_task | Must exist and not be completed |

## Workflows & State Machine

### Task Status Flow
```
NOT_STARTED → IN_PROGRESS → COMPLETED
NOT_STARTED → CANCELLED
IN_PROGRESS → DEFERRED → IN_PROGRESS
IN_PROGRESS → CANCELLED
```

### Activity Auto-Logging Workflow
1. Domain event published by any module (e.g., LeadCreated)
2. ActivityService subscribes and auto-logs activity
3. Activity appears on entity timeline

### Task Overdue Workflow
1. Daily cron checks tasks with due_date < now and status != COMPLETED
2. Task marked overdue → `TaskOverdue` event
3. Notification sent to assignee + manager
4. Priority may auto-escalate

## Security & Permissions

| Permission | Codename | Description |
|------------|----------|-------------|
| View Activity | `activity.view_activity` | View activities |
| Add Activity | `activity.add_activity` | Log activities |
| View Task | `task.view_task` | View tasks |
| Add Task | `task.add_task` | Create tasks |
| Change Task | `task.change_task` | Update own tasks |
| Delete Task | `task.delete_task` | Delete tasks |
| Assign Task | `task.assign_task` | Reassign to others |
| View All Tasks | `task.view_all_tasks` | View any tenant task |

## Testing Strategy

| Layer | Tool | Focus |
|-------|------|-------|
| Unit | pytest | Task status transitions, Priority escalation, Recurrence rule calculation |
| Integration | pytest-django | Activity timeline queries, Task filtering, Overdue detection cron |
| API | DRF APIClient | Activity logging, Task CRUD, Comment threads, Stats aggregation |
| E2E | Playwright | Create task → complete → verify timeline, Recurring task generation |

## Future Enhancements

- **Task Templates:** Reusable task checklists (e.g., "New Customer Onboarding")
- **Time Tracking:** Log hours per task with start/stop
- **Kanban View:** Task board with drag-and-drop status changes
- **Activity Analytics:** Most active users, entity engagement scores
- **Email-to-Task:** Parse forwarded emails into tasks
- **AI Task Suggestions:** Auto-create follow-up tasks based on activity patterns
- **Gantt View:** Timeline visualization for dependent tasks
- **Bulk Operations:** Mass reassign, status change, delete