# Module Blueprint: Notification Engine

- **Module:** `apps.notification`, `apps.calendar`
- **Bounded Context:** Multi-Channel Notification Delivery & Calendar
- **Status:** Draft v1.0

## Business Purpose

The Notification Engine delivers timely, multi-channel notifications (in-app, email, SMS, WhatsApp, push, Slack) to users based on system events, reminders, and manual triggers. The Calendar module manages events, meetings, and syncs with external calendar providers.

## Bounded Context

This module owns Notifications, Notification Templates, Delivery Channels, User Preferences, and Calendar Events. It does NOT own Activities (Activity module) or Tasks (Task module), though it reacts to their events.

## Aggregates, Entities, Value Objects

### Aggregate: Notification
- **Notification** (Aggregate Root)
  - `id: UUID v7`
  - `tenant_id: UUID v7`
  - `recipient_id: UUID v7 (FK to User)`
  - `notification_type: NotificationType`
  - `channel: DeliveryChannel`
  - `title: str`
  - `body: Text`
  - `data: JSONB` (action payload: entity_type, entity_id, action_url)
  - `status: DeliveryStatus`
  - `read_at: DateTime | None`
  - `delivered_at: DateTime | None`
  - `failure_reason: Text | None`
  - `created_at: DateTime`

### Value Objects
- **NotificationType:** `enum(TASK_ASSIGNED, TASK_DUE, TASK_OVERDUE, LEAD_ASSIGNED, STAGE_CHANGED, DEAL_WON, DEAL_LOST, MENTION, COMMENT, APPROVAL_REQUEST, APPROVED, REJECTED, SYSTEM_ALERT, WEEKLY_DIGEST)`
- **DeliveryChannel:** `enum(IN_APP, EMAIL, SMS, WHATSAPP, PUSH, SLACK)`
- **DeliveryStatus:** `enum(PENDING, DELIVERED, READ, FAILED, OPTED_OUT)`

### Entities
- **NotificationTemplate** — Reusable template per type+channel combination
  - `id, tenant_id, notification_type, channel, subject_template, body_template, variables_schema`
- **UserNotificationPreference** — Per-user channel opt-in/out
  - `user_id, channel, notification_type, enabled, quiet_hours_start, quiet_hours_end`
- **NotificationBatch** — Grouped notifications (weekly digest, bulk)
  - `id, user_id, period_start, period_end, notification_count, sent_at`

### Aggregate: CalendarEvent
- **CalendarEvent** (Aggregate Root)
  - `id: UUID v7`
  - `tenant_id: UUID v7`
  - `title: str`
  - `description: Text`
  - `event_type: EventType`
  - `start_time: DateTime`
  - `end_time: DateTime`
  - `all_day: bool`
  - `timezone: str`
  - `location: str | None`
  - `virtual_meeting_url: URL | None`
  - `organizer_id: UUID v7 (FK to User)`
  - `entity_type: str | None` (related CRM entity)
  - `entity_id: UUID v7 | None`
  - `recurrence_rule: RecurrenceRule | None`
  - `status: EventStatus`
  - `external_provider: ExternalProvider | None`
  - `external_event_id: str | None`
  - `custom_fields: JSONB`
  - `timestamps: created_at, updated_at`

### Value Objects
- **EventType:** `enum(MEETING, CALL, DEMO, TRAINING, LUNCH, OUT_OF_OFFICE, REMINDER, OTHER)`
- **EventStatus:** `enum(SCHEDULED, CONFIRMED, CANCELLED, COMPLETED)`
- **ExternalProvider:** `enum(GOOGLE, MICROSOFT, NONE)`
- **RecurrenceRule:** `{frequency: DAILY|WEEKLY|MONTHLY|YEARLY, interval: int, by_day: List[str], end_date: DateTime | None, occurrences: int}`

### Entities
- **EventAttendee** — Participant in an event
  - `id, event_id, user_id, response_status, required_optional`

## Domain Events

- `NotificationSent` — Notification delivered via channel
- `NotificationRead` — User read notification
- `NotificationFailed` — Delivery failed
- `NotificationBatchSent` — Digest delivered
- `EventCreated` — Calendar event created
- `EventUpdated` — Event modified
- `EventCancelled` — Event cancelled
- `EventAttendeeResponded` — RSVP received
- `EventSyncRequested` — Trigger external calendar sync
- `PreferenceChanged` — User notification prefs updated

## Commands & Queries

### Commands
- `SendNotification(user_id, type, data, channels?) → NotificationId`
- `SendBulkNotification(user_ids, type, data) → int`
- `MarkAsRead(notification_id) → void`
- `MarkAllAsRead(user_id) → void`
- `CreateTemplate(notification_type, channel, template) → TemplateId`
- `UpdateTemplate(template_id, data) → Template`
- `SetUserPreference(user_id, channel, type, enabled) → void`
- `SendDigest(user_id, period) → BatchId`
- `CreateEvent(data) → EventId`
- `UpdateEvent(event_id, data) → Event`
- `CancelEvent(event_id, reason) → void`
- `RSVPEvent(event_id, user_id, response) → void`
- `SyncEventToProvider(event_id, provider) → void`
- `ResolveEventConflicts(event_id) → void`

### Queries
- `GetNotifications(user_id, status?, type?, page) → PaginatedResult[Notification]`
- `GetUnreadCount(user_id) → int`
- `GetNotificationPreferences(user_id) → List[Preference]`
- `GetTemplates(notification_type?, channel?) → List[Template]`
- `GetEvent(id) → CalendarEvent`
- `ListEvents(calendar_id, start_date, end_date) → List[CalendarEvent]`
- `GetUserEvents(user_id, date_range) → List[CalendarEvent]`
- `GetEventAttendees(event_id) → List[Attendee]`
- `GetCalendarSyncStatus(user_id) → Dict`
- `GetUpcomingReminders(user_id, window_minutes) → List[Event]`

## Application Services

- `NotificationService` — Dispatch notifications through appropriate channels
- `TemplateService` — Template rendering with variable substitution
- `PreferenceService` — User preference management and opt-out checks
- `DigestService` — Aggregate and send periodic digests
- `ChannelRouter` — Select best channel based on urgency and user prefs
- `CalendarService` — Event CRUD and conflict detection
- `CalendarSyncService` — Two-way sync with Google/MS calendars
- `ReminderService` — Generate reminders for upcoming events/tasks

### Channel Implementations
- `EmailChannel` — SendGrid / SES integration with HTML templates
- `SMSChannel` — Twilio SMS integration
- `WhatsAppChannel` — Twilio WhatsApp Business API
- `InAppChannel` — WebSocket push via Django Channels
- `PushChannel` — Firebase Cloud Messaging (FCM)
- `SlackChannel` — Slack webhook integration

## API Endpoints

### Notifications
| Method | URL | Description | Permissions |
|--------|-----|-------------|-------------|
| GET | `/api/v1/notifications/` | List notifications | `notification.view_notification` |
| POST | `/api/v1/notifications/send/` | Send notification | `notification.send_notification` |
| POST | `/api/v1/notifications/{id}/read/` | Mark as read | `notification.view_notification` |
| POST | `/api/v1/notifications/read-all/` | Mark all read | `notification.view_notification` |
| GET | `/api/v1/notifications/unread-count/` | Unread count | `notification.view_notification` |
| GET | `/api/v1/notifications/preferences/` | Get preferences | `notification.view_preference` |
| PUT | `/api/v1/notifications/preferences/` | Update preferences | `notification.change_preference` |
| GET | `/api/v1/notifications/templates/` | List templates | `notification.view_template` |
| POST | `/api/v1/notifications/templates/` | Create template | `notification.add_template` |
| PUT | `/api/v1/notifications/templates/{id}/` | Update template | `notification.change_template` |

### Calendar
| Method | URL | Description | Permissions |
|--------|-----|-------------|-------------|
| GET | `/api/v1/calendar/events/` | List events | `calendar.view_event` |
| POST | `/api/v1/calendar/events/` | Create event | `calendar.add_event` |
| GET | `/api/v1/calendar/events/{id}/` | Get event | `calendar.view_event` |
| PUT | `/api/v1/calendar/events/{id}/` | Update event | `calendar.change_event` |
| DELETE | `/api/v1/calendar/events/{id}/` | Cancel event | `calendar.delete_event` |
| POST | `/api/v1/calendar/events/{id}/rsvp/` | RSVP | `calendar.view_event` |
| POST | `/api/v1/calendar/events/{id}/sync/` | Sync to provider | `calendar.sync_event` |
| GET | `/api/v1/calendar/sync-status/` | Sync status | `calendar.view_event` |
| GET | `/api/v1/calendar/availability/` | User availability | `calendar.view_event` |

## Database Tables

- `notification_notification` — Notification records
- `notification_template` — Channel-specific templates
- `notification_preference` — User notification preferences
- `notification_batch` — Digest batch records
- `notification_webhook_subscription` — External webhook subscriptions
- `calendar_event` — Calendar events
- `calendar_eventattendee` — Event participants
- `calendar_recurrenceexception` — Modified/deleted recurring instances
- `calendar_synctoken` — External provider sync state

### Key Indexes
- `(tenant_id, recipient_id, created_at)` — User notification inbox
- `(tenant_id, recipient_id, read_at IS NULL)` — Unread count
- `(tenant_id, notification_type, status)` — Type-based queries
- `(tenant_id, event.start_time, event.end_time)` — Date range queries
- `(tenant_id, organizer_id)` — User's events
- `(event_id, attendee_id)` — RSVP queries
- `(user_id, external_provider)` — Sync state

## Validation Rules

| Field | Rule |
|-------|------|
| notification.body | Required, max 5000 chars (SMS: 160, WhatsApp: 4096) |
| channel | Must match user's enabled channels, respect quiet hours |
| event.start_time < end_time | Validation |
| recurrence.end_date | Must be after start |
| attendee.user_id | Must be valid user in tenant |
| external_event_id | Must be unique per provider |

## Workflows & State Machine

### Notification Delivery Flow
1. `SendNotification` command received
2. Load user preferences → filter enabled channels
3. Check quiet hours → skip if applicable
4. Load template → render with variables
5. Dispatch via each channel in parallel
6. Record delivery status
7. On failure → retry 3x, then mark FAILED
8. `NotificationSent` / `NotificationFailed` event

### Calendar Sync Flow
1. Event created/updated in CRM
2. If external provider linked, queue sync
3. Celery task calls provider API (Google/MS Graph)
4. Store external_event_id and sync token
5. Handle conflicts: last-write-wins with audit

## Security & Permissions

| Permission | Codename | Description |
|------------|----------|-------------|
| View Notification | `notification.view_notification` | View own notifications |
| Send Notification | `notification.send_notification` | Send notifications |
| View Preference | `notification.view_preference` | View own preferences |
| Change Preference | `notification.change_preference` | Update preferences |
| View Template | `notification.view_template` | View templates |
| Add Template | `notification.add_template` | Create templates |
| Change Template | `notification.change_template` | Edit templates |
| View Event | `calendar.view_event` | View events |
| Add Event | `calendar.add_event` | Create events |
| Change Event | `calendar.change_event` | Edit events |
| Delete Event | `calendar.delete_event` | Cancel events |
| Sync Event | `calendar.sync_event` | Trigger external sync |

## Testing Strategy

| Layer | Tool | Focus |
|-------|------|-------|
| Unit | pytest | Template rendering, Preference filtering, Quiet hours logic, Recurrence calculation |
| Integration | pytest-django | Channel delivery (mock external), Calendar sync (mock API), Digest aggregation |
| API | DRF APIClient | Notification CRUD, Preference management, Event CRUD, RSVP flow |
| E2E | Playwright | Notification delivery → read flow, Event creation → sync → external verification |

## Future Enhancements

- **Smart Notification Routing:** ML-based channel selection for optimal engagement
- **Custom Notification Types:** Tenant-defined notification types
- **Push Notification Web:** Browser push via service workers
- **SMS Two-Way:** Respond to SMS to update CRM records
- **Calendar Resource Booking:** Room/equipment booking alongside events
- **Meeting Recording Integration:** Auto-link Zoom/Meet recordings to events
- **Email Threading:** Group notifications by conversation thread
- **Digest Customization:** User-configurable digest frequency and content
- **Notification Analytics:** Open rates, click rates, channel effectiveness