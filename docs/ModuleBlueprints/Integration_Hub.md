# Module Blueprint: Integration Hub

- **Module:** `modules.integration`
- **Bounded Context:** External API Integrations, Webhooks, Sync, Data Transformation
- **Status:** Draft v1.0

## Business Purpose

The Integration Hub enables TZAHU CRM to connect with external systems: email providers (Gmail, Outlook), calendar (Google, Office 365), marketing automation (HubSpot, Mailchimp), accounting (QuickBooks, Xero), communication (Twilio, Slack), and custom APIs. It provides a unified webhook system, data sync engine, and connector SDK.

## Bounded Context

This module owns: Integration definitions, connectors, webhook endpoints, data sync configurations, credential storage, transformation mappings, and sync audit logs. It does NOT own the domain data being synced — it only transports and transforms it.

## Aggregates, Entities, Value Objects

### Aggregate: Integration
- **Integration** (Aggregate Root)
  - `id: UUID v7`
  - `tenant_id: UUID v7`
  - `name: str`
  - `provider: IntegrationProvider`
  - `connector_type: ConnectorType`
  - `config: JSONB` (provider-specific: API URLs, scopes, etc.)
  - `credentials_id: FK(Credential)`
  - `sync_config: JSONB` (sync direction, frequency, field mapping)
  - `is_active: bool`
  - `last_sync_at: DateTime | None`
  - `last_sync_status: SyncStatus | None`
  - `error_count: int`
  - `timestamps: created_at, updated_at`

### Value Objects
- **IntegrationProvider:** `enum(GOOGLE, MICROSOFT, HUBSPOT, SALESFORCE, MAILCHIMP, QUICKBOOKS, XERO, TWILIO, SLACK, ZAPIER, CUSTOM)`
- **ConnectorType:** `enum(OAUTH2, API_KEY, BASIC_AUTH, JWT, CUSTOM)`
- **SyncDirection:** `enum(IMPORT, EXPORT, BIDIRECTIONAL)`
- **SyncStatus:** `enum(SUCCESS, PARTIAL, FAILED, SYNCING, PENDING)`
- **WebhookEventStatus:** `enum(RECEIVED, PROCESSING, PROCESSED, FAILED)`
- **CredentialType:** `enum(OAUTH2, API_KEY, BASIC_AUTH, BEARER_TOKEN)`

### Aggregate: WebhookEndpoint
- **WebhookEndpoint** (Inbound webhook receiver)
  - `id: UUID v7`
  - `tenant_id: UUID v7`
  - `name: str`
  - `url_path: str` (unique slug for webhook URL)
  - `provider: str`
  - `secret: EncryptedField` (for signature verification)
  - `events: Array[str]` (which events to accept)
  - `transform_template: JSONB | None` (mapping from webhook format to internal)
  - `target_module: str` (which module receives transformed data)
  - `target_action: str` (create lead, update opportunity, etc.)
  - `is_active: bool`
  - `timestamps: created_at, updated_at`

### Aggregate: WebhookSubscription (Outbound)
- **WebhookSubscription** (Send events to external systems)
  - `id: UUID v7`
  - `tenant_id: UUID v7`
  - `name: str`
  - `target_url: URL`
  - `events: Array[str]` (which domain events to forward)
  - `secret: EncryptedField` (for HMAC signature)
  - `headers: JSONB` (custom HTTP headers)
  - `retry_config: JSONB` (max_retries, backoff strategy)
  - `filter_condition: JSONB | None` (only send if condition met)
  - `is_active: bool`
  - `last_sent_at: DateTime | None`
  - `last_response_status: int | None`

### Entities
- **Credential** (Encrypted credential storage)
  - `id: UUID v7`
  - `tenant_id: UUID v7`
  - `name: str`
  - `credential_type: CredentialType`
  - `encrypted_data: EncryptedField` (AES-256-GCM encrypted JSON)
  - `expires_at: DateTime | None`
  - `is_expired: bool`

- **SyncJob** (Data synchronization execution record)
  - `id: UUID v7`
  - `integration_id: FK`
  - `status: SyncStatus`
  - `started_at: DateTime`
  - `completed_at: DateTime | None`
  - `records_processed: int`
  - `records_created: int`
  - `records_updated: int`
  - `records_failed: int`
  - `error_log: JSONB`
  - `sync_metadata: JSONB` (cursor, pagination, etc.)

- **WebhookEventLog** (Inbound webhook request log)
  - `id: UUID v7`
  - `webhook_id: FK`
  - `headers: JSONB`
  - `raw_body: Text`
  - `status: WebhookEventStatus`
  - `processed_at: DateTime | None`
  - `error_message: Text | None`

- **FieldMapping** (Data transformation mapping)
  - `id: UUID v7`
  - `integration_id: FK`
  - `source_field: str` (path in external data)
  - `target_field: str` (path in internal model)
  - `transform: str | None` (expression or function name)
  - `default_value: JSONB | None`
  - `is_required: bool`

## Domain Events

- `IntegrationConnected` — New integration established
- `IntegrationDisconnected` — Integration removed or expired
- `IntegrationSyncStarted` — Data sync initiated
- `IntegrationSyncCompleted` — Data sync finished (with stats)
- `IntegrationSyncFailed` — Sync failed (with error)
- `WebhookReceived` — Webhook event received
- `WebhookProcessed` — Webhook event processed and action taken
- `WebhookFailed` — Webhook processing failed
- `WebhookSent` — Outbound webhook delivered
- `WebhookDeliveryFailed` — Outbound webhook failed
- `CredentialExpired` — OAuth token or API key expired

## Commands & Queries

### Commands
- `CreateIntegration(provider, config, credentials) → IntegrationId`
- `UpdateIntegration(id, config) → Integration`
- `DeleteIntegration(id) → void`
- `TestConnection(id) → ConnectionResult`
- `TriggerSync(id, full_sync?) → SyncJobId`
- `CancelSync(job_id) → void`
- `ProcessWebhook(webhook_id, headers, body) → ProcessResult`
- `RegisterWebhookSubscription(target_url, events, config) → SubscriptionId`
- `UnregisterWebhook(id) → void`
- `RefreshOAuthToken(integration_id) → void`
- `RotateCredentials(id) → void`

### Queries
- `GetIntegration(id) → Integration`
- `ListIntegrations(provider?, status?) → List[Integration]`
- `GetSyncHistory(integration_id, page) → PaginatedResult[SyncJob]`
- `GetWebhookLogs(webhook_id, status?, date_range?) → PaginatedResult[EventLog]`
- `GetFieldMappings(integration_id) → List[FieldMapping]`
- `GetCredential(id) → Credential (masked)`
- `ListWebhookSubscriptions() → List[Subscription]`
- `GetIntegrationStatus(id) → StatusReport`

## Application Services

- `IntegrationService` — CRUD, connection testing, lifecycle
- `SyncOrchestrator` — Full/incremental sync execution with batch processing
- `WebhookReceiver` — Validate signatures, deserialize, route to processors
- `WebhookDispatcher` — Forward domain events to external URLs with retries
- `CredentialVault` — Encrypted credential storage, rotation, expiration alerts
- `FieldTransformer` — Apply field mappings with transformation functions
- `ConnectorRegistry` — Provider-specific connector implementations
- `OAuthFlowService` — OAuth 2.0 authorization code flow management

## API Endpoints

| Method | URL | Description | Permissions |
|--------|-----|-------------|-------------|
| GET | `/api/v1/integrations/` | List integrations | `integration.view_integration` |
| POST | `/api/v1/integrations/` | Create integration | `integration.add_integration` |
| GET | `/api/v1/integrations/{id}/` | Get integration details | `integration.view_integration` |
| PUT | `/api/v1/integrations/{id}/` | Update integration | `integration.change_integration` |
| DELETE | `/api/v1/integrations/{id}/` | Delete integration | `integration.delete_integration` |
| POST | `/api/v1/integrations/{id}/test/` | Test connection | `integration.test_integration` |
| POST | `/api/v1/integrations/{id}/sync/` | Trigger sync | `integration.sync_integration` |
| GET | `/api/v1/integrations/{id}/syncs/` | Sync history | `integration.view_integration` |
| POST | `/api/v1/integrations/{id}/refresh/` | Refresh OAuth | `integration.change_integration` |
| GET | `/api/v1/integrations/providers/` | List available providers | `integration.view_integration` |
| GET | `/api/v1/webhooks/inbound/` | List inbound webhooks | `integration.view_webhook` |
| POST | `/api/v1/webhooks/inbound/` | Register inbound webhook | `integration.add_webhook` |
| POST | `/api/v1/webhooks/inbound/{slug}/` | Receive webhook (public) | None (signature-based) |
| GET | `/api/v1/webhooks/inbound/{id}/logs/` | Webhook event logs | `integration.view_webhook` |
| GET | `/api/v1/webhooks/outbound/` | List outbound subscriptions | `integration.view_webhook` |
| POST | `/api/v1/webhooks/outbound/` | Register outbound webhook | `integration.add_webhook` |
| PUT | `/api/v1/webhooks/outbound/{id}/` | Update subscription | `integration.change_webhook` |
| DELETE | `/api/v1/webhooks/outbound/{id}/` | Delete subscription | `integration.delete_webhook` |
| GET | `/api/v1/integrations/{id}/mappings/` | Get field mappings | `integration.view_integration` |
| PUT | `/api/v1/integrations/{id}/mappings/` | Update field mappings | `integration.change_integration` |
| GET | `/api/v1/credentials/` | List credentials (masked) | `integration.view_credential` |
| POST | `/api/v1/credentials/` | Add credential | `integration.add_credential` |
| DELETE | `/api/v1/credentials/{id}/` | Delete credential | `integration.delete_credential` |

## Database Tables

- `integration_integration` — Integration definitions
- `integration_credential` — Encrypted credentials
- `integration_syncjob` — Sync execution records
- `integration_fieldmapping` — Field transformation mappings
- `integration_webhookendpoint` — Inbound webhook receivers
- `integration_webhooksubscription` — Outbound webhook subscriptions
- `integration_webhookeventlog` — Inbound webhook request log
- `integration_webhookdeliverylog` — Outbound webhook delivery log
- `integration_connectorstate` — Connector-specific state (cursors, pagination)

### Key Indexes
- `(tenant_id, provider, is_active)` — Active integrations
- `(integration_id, status, started_at)` — Sync history
- `(webhook_id, status, created_at)` — Webhook event logs
- `(tenant_id, credential_type)` — Credential listing
- `(url_path)` — Inbound webhook routing (unique)

## Validation Rules

| Field | Rule |
|-------|------|
| provider | Must be supported (in CONNECTOR_REGISTRY) |
| credentials | Valid for connector type (OAuth2 requires client_id, client_secret, scopes) |
| webhook url_path | Unique per tenant, alphanumeric + hyphens |
| webhook target URL | Must be HTTPS (not HTTP) for outbound |
| field mapping source/target | Must reference valid fields in source and target schemas |
| sync frequency | Must be one of: MANUAL, EVERY_15_MIN, EVERY_HOUR, EVERY_DAY, EVERY_WEEK |
| credential expiry | Alerts sent 30, 14, 7, 1 day before expiry |

## Sync Engine Workflow

1. Sync triggered (manual, schedule, or webhook)
2. `SyncJob` created with PENDING status
3. Integration config loaded, credentials retrieved from vault
4. Connector initialized (OAuth token refreshed if needed)
5. Batch loop:
   a. Fetch page from external API (using cursor/pagination)
   b. Transform data using field mappings
   c. Validate data against target schema
   d. Batch upsert into CRM tables
   e. Track created, updated, failed counts
   f. Continue until no more pages
6. `SyncJob` completed with final stats
7. On partial failure: `SyncJob` marked PARTIAL with error details
8. Notification sent to integration owner

### Rate Limiting & Backoff
- Respect external API rate limits (configurable per connector)
- Exponential backoff on 429/503 responses
- Concurrent sync limit: 2 per integration, 5 per tenant

## Security & Permissions

| Permission | Description |
|------------|-------------|
| `integration.view_integration` | View integrations |
| `integration.add_integration` | Create integrations |
| `integration.change_integration` | Edit integrations |
| `integration.delete_integration` | Delete integrations |
| `integration.test_integration` | Test connections |
| `integration.sync_integration` | Trigger syncs |
| `integration.view_webhook` | View webhook configs |
| `integration.add_webhook` | Register webhooks |
| `integration.change_webhook` | Edit webhooks |
| `integration.delete_webhook` | Delete webhooks |
| `integration.view_credential` | View credential metadata (not secrets) |
| `integration.add_credential` | Add credentials |
| `integration.delete_credential` | Delete credentials |
| `integration.admin` | Full integration admin |

Credential encryption: AES-256-GCM with tenant-specific encryption keys stored in HashiCorp Vault or AWS KMS.

## Testing Strategy

| Layer | Focus |
|-------|-------|
| Unit | Field mapping transformation, OAuth token refresh logic, Rate limit calculation, Webhook signature verification, Credential encryption/decryption |
| Integration | Sync with mock API server, Field mapping application, Webhook receiving and processing, OAuth flow (mock authorization server) |
| API | Integration CRUD, Sync trigger and monitoring, Webhook registration and delivery, Credential management |
| E2E | Complete Gmail integration flow: OAuth → sync emails → create leads from emails, Webhook → receive → transform → create lead |

Mock external APIs using `responses` or `mockserver` for deterministic testing.

## Built-in Connectors (MVP)

| Provider | Direction | Entities |
|----------|-----------|----------|
| Google (Gmail) | Import | Emails → Activities |
| Google Calendar | Import | Events → Tasks |
| Microsoft (Outlook) | Import | Emails, Calendar |
| HubSpot | Bidirectional | Contacts, Companies, Deals |
| Mailchimp | Import | Campaigns, Lists, Members |
| Twilio | Import | SMS/WhatsApp → Activities |
| Slack | Bidirectional | Notifications, Messages → Activities |

## Future Enhancements

- **Connector SDK:** Plugin system for building custom connectors
- **Low-Code Mapper:** Visual field mapping UI
- **Real-Time Sync:** Change Data Capture (CDC) for near-real-time sync
- **Data Quality Dashboard:** Monitor sync health, errors, field mapping coverage
- **DLQ (Dead Letter Queue):** Failed sync records with replay capability
- **Schema Discovery:** Auto-discover external API schemas
- **Webhook Retry Dashboard:** Manual retry with payload inspection
- **Rate Limit Forecasting:** Predict and manage API consumption
- **Marketplace:** Community-contributed connectors
