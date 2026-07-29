# TZAHU CRM — Integration Architecture

> **Version:** 0.1.0-draft
> **Last Updated:** 2026-07-27
> **Status:** Foundational Design Phase
> **Owner:** Platform Architecture Team

---

## Table of Contents

1. [Overview](#1-overview)
2. [Integration Hub Design](#2-integration-hub-design)
3. [Connector SDK](#3-connector-sdk)
4. [OAuth Token Vault](#4-oauth-token-vault)
5. [Sync Engine](#5-sync-engine)
6. [Webhook Delivery](#6-webhook-delivery)
7. [Built-in Connectors](#7-built-in-connectors)
8. [Rate Limit Management](#8-rate-limit-management)
9. [Integration Lifecycle](#9-integration-lifecycle)

---

## 1. Overview

The Integration Hub is the central nervous system connecting TZAHU CRM to external services. It provides a unified framework for building, deploying, and managing integrations with third-party platforms such as Google Workspace, Microsoft 365, Slack, HubSpot, Mailchimp, Twilio, SendGrid, and Zoom.

### 1.1 Design Principles

- **Connector SDK**: Standardized Python SDK for building any integration
- **OAuth-first**: All integrations use OAuth 2.0 where possible
- **Incremental sync**: Only changed data is synced, not full datasets
- **Resilient**: Automatic retry, circuit breakers, and dead-letter queues
- **Observable**: Every sync, webhook, and API call is logged and metered

### 1.2 Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                        Integration Hub                                 │
│                                                                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐ │
│  │ Connector    │  │ OAuth Token │  │ Sync Engine  │  │ Webhook      │ │
│  │ SDK          │  │ Vault       │  │              │  │ Delivery     │ │
│  └──────┬───────┘  └──────┬──────┘  └──────┬──────┘  └──────┬───────┘ │
│         │                 │                │                 │          │
│         ▼                 ▼                ▼                 ▼          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                      Connector Instances                          │  │
│  │  Google  │  MS 365  │  Slack  │  HubSpot  │  Mailchimp  │  ...   │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 2. Integration Hub Design

### 2.1 Domain Model

```python
@dataclass
class ConnectorDefinition:
    """Definition of a connector type (Google, Slack, etc.)."""
    id: UUID
    name: str
    provider: str  # google, microsoft, slack, hubspot, etc.
    category: str  # communication, crm, email, calendar, storage
    auth_type: str  # oauth2, api_key, basic
    config_schema: dict  # JSON Schema for connector configuration
    supported_actions: list[str]  # sync, webhook, api_call
    is_builtin: bool
    version: str

@dataclass
class ConnectorInstance:
    """An organization's configured connector instance."""
    id: UUID
    organization_id: UUID
    connector_definition_id: UUID
    name: str
    config: dict  # Provider-specific configuration
    auth_data_id: UUID  # Reference to encrypted OAuth tokens
    status: str  # active, error, paused, pending
    last_sync_at: datetime | None
    error_message: str | None
    rate_limit_status: dict  # Current rate limit state
    created_at: datetime
    updated_at: datetime

@dataclass
class SyncJob:
    """A synchronization job between TZAHU and an external system."""
    id: UUID
    connector_instance_id: UUID
    direction: str  # inbound (external → TZAHU) or outbound (TZAHU → external)
    entity_type: str  # contact, event, email, etc.
    sync_type: str  # incremental or full
    status: str  # pending, running, completed, failed
    started_at: datetime | None
    completed_at: datetime | None
    records_processed: int
    records_created: int
    records_updated: int
    records_deleted: int
    records_failed: int
    error: str | None
```

### 2.2 Integration Hub Service

```python
class IntegrationHub:
    """Central service managing connector lifecycle and execution."""

    async def configure(self, org_id: UUID, connector_def_id: UUID, config: dict) -> ConnectorInstance:
        """Configure a new connector instance for an organization."""
        connector_def = await self.definitions.get(connector_def_id)
        validate_json_schema(connector_def.config_schema, config)
        instance = ConnectorInstance(
            id=uuid7(),
            organization_id=org_id,
            connector_definition_id=connector_def_id,
            config=config,
            auth_data_id=None,
            status="pending",
        )
        await self.instances.save(instance)
        return instance

    async def authorize(self, instance_id: UUID, auth_code: str | None = None) -> str:
        """Start or complete OAuth authorization flow."""
        instance = await self.instances.get(instance_id)
        connector = await self._get_connector(instance)
        if instance.auth_data_id is None:
            # First time: start OAuth flow
            auth_url = await connector.get_authorization_url(instance.config)
            return auth_url
        else:
            # Exchange code for tokens
            tokens = await connector.exchange_code(auth_code)
            await self.token_vault.store(
                instance.organization_id,
                instance.id,
                tokens,
            )
            instance.status = "active"
            await self.instances.save(instance)
            return "authorized"

    async def sync(self, instance_id: UUID, entity_type: str, sync_type: str = "incremental") -> SyncJob:
        """Execute a sync operation."""
        instance = await self.instances.get(instance_id)
        connector = await self._get_connector(instance)
        tokens = await self.token_vault.retrieve(instance.organization_id, instance.id)

        sync_job = SyncJob(
            id=uuid7(),
            connector_instance_id=instance_id,
            direction="inbound",
            entity_type=entity_type,
            sync_type=sync_type,
            status="pending",
        )
        await self.sync_jobs.save(sync_job)

        # Dispatch to Celery
        sync_task.delay(sync_job.id, tokens)
        return sync_job

    async def _get_connector(self, instance: ConnectorInstance) -> BaseConnector:
        connector_class = CONNECTOR_MAP.get(instance.connector_definition_id)
        if not connector_class:
            raise ValueError(f"No connector for {instance.connector_definition_id}")
        return connector_class(instance.config)
```

---

## 3. Connector SDK

### 3.1 Base Connector Interface

```python
class BaseConnector(ABC):
    """Abstract base class for all connectors."""

    def __init__(self, config: dict):
        self.config = config
        self.http = httpx.AsyncClient(timeout=30)

    @abstractmethod
    async def get_authorization_url(self, config: dict) -> str:
        """Get the OAuth authorization URL."""
        ...

    @abstractmethod
    async def exchange_code(self, code: str) -> TokenSet:
        """Exchange authorization code for tokens."""
        ...

    @abstractmethod
    async def refresh_token(self, token: TokenSet) -> TokenSet:
        """Refresh an expired token."""
        ...

    @abstractmethod
    async def fetch_records(self, entity: str, since: datetime | None = None, page_token: str | None = None) -> SyncResult:
        """Fetch records from external system for sync."""
        ...

    @abstractmethod
    async def push_record(self, entity: str, data: dict) -> PushResult:
        """Push a record to the external system."""
        ...

    @abstractmethod
    async def handle_webhook(self, payload: dict, headers: dict) -> WebhookResult:
        """Process an incoming webhook from the external system."""
        ...

    async def health_check(self) -> bool:
        """Check if the external service is reachable."""
        try:
            await self.http.get(self._health_endpoint(), timeout=5)
            return True
        except Exception:
            return False

    async def close(self):
        await self.http.aclose()
```

### 3.2 Google Connector Example

```python
class GoogleConnector(BaseConnector):
    """Connector for Google Workspace (Gmail, Calendar, Contacts)."""

    SCOPES = {
        "email": ["https://www.googleapis.com/auth/gmail.modify"],
        "calendar": ["https://www.googleapis.com/auth/calendar"],
        "contacts": ["https://www.googleapis.com/auth/contacts.readonly"],
    }

    async def get_authorization_url(self, config: dict) -> str:
        scopes = self.SCOPES.get(config.get("features", ["email"]))
        return f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode({
            'client_id': config['client_id'],
            'redirect_uri': config['redirect_uri'],
            'response_type': 'code',
            'scope': ' '.join(scopes),
            'access_type': 'offline',
            'prompt': 'consent',
        })}"

    async def exchange_code(self, code: str) -> TokenSet:
        response = await self.http.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": self.config["client_id"],
                "client_secret": self.config["client_secret"],
                "redirect_uri": self.config["redirect_uri"],
                "grant_type": "authorization_code",
            },
        )
        data = response.json()
        return TokenSet(
            access_token=data["access_token"],
            refresh_token=data.get("refresh_token"),
            expires_at=time.time() + data["expires_in"],
            token_type=data["token_type"],
            scope=data["scope"],
        )

    async def refresh_token(self, token: TokenSet) -> TokenSet:
        response = await self.http.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": self.config["client_id"],
                "client_secret": self.config["client_secret"],
                "refresh_token": token.refresh_token,
                "grant_type": "refresh_token",
            },
        )
        data = response.json()
        token.access_token = data["access_token"]
        token.expires_at = time.time() + data.get("expires_in", 3600)
        return token

    async def fetch_records(self, entity: str, since: datetime | None = None, page_token: str | None = None) -> SyncResult:
        if entity == "contacts":
            return await self._fetch_contacts(since, page_token)
        elif entity == "events":
            return await self._fetch_events(since, page_token)
        raise ValueError(f"Unknown entity: {entity}")

    async def _fetch_contacts(self, since: datetime | None, page_token: str | None) -> SyncResult:
        headers = {"Authorization": f"Bearer {self.token.access_token}"}
        params = {"pageSize": 100}
        if page_token:
            params["pageToken"] = page_token
        if since:
            params["syncToken"] = since.isoformat()

        response = await self.http.get(
            "https://people.googleapis.com/v1/people/me/connections",
            headers=headers,
            params=params,
        )
        data = response.json()
        return SyncResult(
            records=data.get("connections", []),
            next_page_token=data.get("nextPageToken"),
            has_more="nextPageToken" in data,
        )
```

### 3.3 Auth Type Implementations

| Auth Type | Implementation | Example Connector |
|-----------|---------------|-------------------|
| `oauth2` | OAuth 2.0 Authorization Code Flow with PKCE | Google, Microsoft, Slack |
| `api_key` | Static API key in header or query param | SendGrid, Twilio |
| `basic` | HTTP Basic Auth (username + password) | Legacy systems |
| `jwt` | Service account JWT bearer token | Google Service Account |

---

## 4. OAuth Token Vault

### 4.1 Encrypted Token Storage

```sql
CREATE TABLE integration_oauth_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    organization_id UUID NOT NULL,
    connector_instance_id UUID NOT NULL,
    provider VARCHAR(100) NOT NULL,
    encrypted_access_token BYTEA NOT NULL,
    encrypted_refresh_token BYTEA,
    expires_at TIMESTAMPTZ,
    scope VARCHAR(500),
    token_type VARCHAR(50),
    metadata JSONB DEFAULT '{}',
    last_refreshed_at TIMESTAMPTZ,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(connector_instance_id, provider)
);
```

### 4.2 Encryption Implementation

```python
class TokenVault:
    """Encrypted storage for OAuth tokens with auto-refresh."""

    ALGORITHM = "aes-256-gcm"

    def __init__(self):
        self.encryption_key = base64.b64decode(settings.OAUTH_ENCRYPTION_KEY)

    def encrypt(self, data: str) -> bytes:
        iv = os.urandom(12)
        cipher = Cipher(algorithms.AES(self.encryption_key), modes.GCM(iv))
        encryptor = cipher.encryptor()
        ciphertext = encryptor.update(data.encode()) + encryptor.finalize()
        return iv + encryptor.tag + ciphertext  # iv(12) + tag(16) + ciphertext

    def decrypt(self, encrypted: bytes) -> str:
        iv = encrypted[:12]
        tag = encrypted[12:28]
        ciphertext = encrypted[28:]
        cipher = Cipher(algorithms.AES(self.encryption_key), modes.GCM(iv, tag))
        decryptor = cipher.decryptor()
        return (decryptor.update(ciphertext) + decryptor.finalize()).decode()

    async def store(self, org_id: UUID, instance_id: UUID, tokens: TokenSet):
        encrypted = self.encrypt(json.dumps({
            "access_token": tokens.access_token,
            "refresh_token": tokens.refresh_token,
            "expires_at": tokens.expires_at,
        }))
        await self.model.update_or_create(
            connector_instance_id=instance_id,
            defaults={
                "organization_id": org_id,
                "encrypted_access_token": encrypted,
                "expires_at": datetime.fromtimestamp(tokens.expires_at, tz=timezone.utc),
            },
        )

    async def retrieve(self, org_id: UUID, instance_id: UUID) -> TokenSet:
        record = await self.model.get(connector_instance_id=instance_id)
        data = json.loads(self.decrypt(record.encrypted_access_token))
        tokens = TokenSet(
            access_token=data["access_token"],
            refresh_token=data.get("refresh_token"),
            expires_at=data["expires_at"],
        )
        # Auto-refresh if expiring within 5 minutes
        if tokens.expires_at - time.time() < 300:
            tokens = await self.refresh(org_id, instance_id, tokens, record)
        return tokens

    async def refresh(self, org_id: UUID, instance_id: UUID, tokens: TokenSet, record) -> TokenSet:
        connector = await self._get_connector(record)
        tokens = await connector.refresh_token(tokens)
        await self.store(org_id, instance_id, tokens)
        return tokens
```

### 4.3 Token Lifecycle

```
1. Authorize: Exchange code for access + refresh tokens
2. Store: Encrypt and persist in database
3. Use: Decrypt on read, inject into API calls
4. Auto-refresh: If token expires within 5 minutes, refresh automatically
5. Revocation: If refresh fails with 401, mark connector as error
6. Re-authorization: Notify admin to re-authorize
```

---

## 5. Sync Engine

### 5.1 Incremental Sync

```python
class IncrementalSync:
    """Incremental sync using since-timestamp or page token."""

    async def run(self, connector: BaseConnector, entity: str, org_id: UUID) -> SyncJob:
        # 1. Get last sync state
        last_sync = await self.get_last_sync_state(connector.instance_id, entity)

        # 2. Fetch records since last sync
        all_records = []
        page_token = None
        while True:
            result = await connector.fetch_records(
                entity=entity,
                since=last_sync.completed_at,
                page_token=page_token,
            )
            all_records.extend(result.records)
            if not result.has_more:
                break
            page_token = result.next_page_token

        # 3. Process records (create/update/delete)
        stats = await self.process_records(entity, all_records, org_id)

        # 4. Update sync state
        await self.record_sync_state(connector.instance_id, entity, stats)

        return stats
```

### 5.2 Full Sync

```python
class FullSync:
    """Full sync with pagination through all records."""

    MAX_RECORDS = 50000  # Max records per full sync

    async def run(self, connector: BaseConnector, entity: str, org_id: UUID) -> SyncJob:
        all_records = []
        page_token = None
        page_count = 0

        while len(all_records) < self.MAX_RECORDS:
            result = await connector.fetch_records(
                entity=entity,
                since=None,
                page_token=page_token,
            )
            all_records.extend(result.records)
            page_count += 1
            if not result.has_more:
                break
            page_token = result.next_page_token

        return await self.process_records(entity, all_records, org_id)
```

### 5.3 Conflict Resolution

```python
class ConflictResolver:
    """Resolves conflicts between TZAHU and external system data."""

    STRATEGIES = {
        "source_wins": "External system data overrides CRM data",
        "target_wins": "CRM data overrides external system data",
        "manual": "Flag for manual review",
        "newest_wins": "Most recently modified version wins",
        "merge": "Merge fields from both sources",
    }

    async def resolve(
        self,
        entity: str,
        local_record: dict,
        remote_record: dict,
        strategy: str,
    ) -> dict:
        if strategy == "source_wins":
            return remote_record
        elif strategy == "target_wins":
            return local_record
        elif strategy == "newest_wins":
            local_updated = local_record.get("updated_at")
            remote_updated = remote_record.get("updated_at")
            return remote_record if remote_updated > local_updated else local_record
        elif strategy == "merge":
            return {**local_record, **remote_record}
        elif strategy == "manual":
            await self.create_conflict_flag(entity, local_record, remote_record)
            return local_record  # Keep local until manual resolution
```

### 5.4 Data Mapping

```python
class DataMapper:
    """Maps fields between TZAHU and external system schemas."""

    DEFAULT_MAPPINGS = {
        "google_contacts": {
            "name": "names.displayName",
            "email": "emailAddresses.value",
            "phone": "phoneNumbers.value",
            "company": "organizations.name",
            "title": "organizations.title",
        },
        "hubspot_contacts": {
            "first_name": "properties.firstname",
            "last_name": "properties.lastname",
            "email": "properties.email",
            "phone": "properties.phone",
            "company": "properties.company",
        },
        "slack_users": {
            "name": "real_name",
            "email": "profile.email",
            "display_name": "profile.display_name",
            "title": "profile.title",
        },
    }

    def map_to_external(self, entity: str, connector: str, data: dict) -> dict:
        """Map CRM data to external system format."""
        mapping = self.DEFAULT_MAPPINGS.get(f"{connector}_{entity}", {})
        result = {}
        for crm_field, ext_path in mapping.items():
            value = self._get_nested(data, crm_field)
            if value is not None:
                self._set_nested(result, ext_path, value)
        return result

    def map_to_crm(self, entity: str, connector: str, data: dict) -> dict:
        """Map external system data to CRM format."""
        mapping = self.DEFAULT_MAPPINGS.get(f"{connector}_{entity}", {})
        result = {}
        for crm_field, ext_path in mapping.items():
            value = self._get_nested(data, ext_path)
            if value is not None:
                result[crm_field] = value
        return result
```

---

## 6. Webhook Delivery

### 6.1 Outbound Webhook Delivery

```python
class OutboundWebhookDelivery:
    """Delivers webhook events to external systems with retry and HMAC signing."""

    async def deliver(
        self,
        webhook_id: UUID,
        event: DomainEvent,
        subscriber_url: str,
        secret: str,
    ) -> bool:
        # 1. Build payload
        payload = json.dumps(self._build_payload(event), separators=(",", ":"))

        # 2. Compute HMAC signature
        signature = hmac.new(
            secret.encode(), payload.encode(), hashlib.sha256
        ).hexdigest()

        # 3. Send with retries
        for attempt in range(3):
            try:
                response = await self.http_client.post(
                    subscriber_url,
                    data=payload,
                    headers={
                        "Content-Type": "application/json",
                        "X-Tzahu-Webhook-ID": str(webhook_id),
                        "X-Tzahu-Signature": f"sha256={signature}",
                        "X-Tzahu-Event-Type": event.event_type,
                        "X-Tzahu-Delivery-Attempt": str(attempt + 1),
                        "X-Tzahu-Timestamp": str(int(time.time())),
                    },
                    timeout=15,
                )
                if response.status_code == 200:
                    return True
                # 4xx errors are permanent (don't retry)
                if 400 <= response.status_code < 500:
                    logger.warning("webhook_rejected", url=subscriber_url, status=response.status_code)
                    return False
            except (TimeoutError, ConnectionError) as e:
                if attempt < 2:
                    await asyncio.sleep(2 ** attempt)  # 1s, 2s, 4s

        # All retries exhausted → send to DLQ
        await self.send_to_dlq(webhook_id, event, subscriber_url)
        return False
```

### 6.2 Inbound Webhook Handling

```python
class InboundWebhookHandler:
    """Handles incoming webhooks from external systems."""

    async def handle(
        self,
        provider: str,
        payload: bytes,
        headers: dict,
    ) -> WebhookResult:
        # 1. Verify signature
        connector = await self._get_connector(provider)
        if not await self._verify_signature(connector, payload, headers):
            raise WebhookSignatureError("Invalid webhook signature")

        # 2. Replay protection (idempotency key)
        idempotency_key = headers.get("X-Idempotency-Key") or headers.get("X-Slack-Request-Timestamp")
        if idempotency_key and await self._is_duplicate(idempotency_key):
            return WebhookResult(status="duplicate", message="Already processed")

        # 3. Parse event type and data
        event = await connector.parse_webhook(payload, headers)

        # 4. Route to handler
        result = await self._route_event(provider, event)

        # 5. Store idempotency key
        if idempotency_key:
            await self._store_idempotency_key(idempotency_key, ttl=3600)

        return result
```

### 6.3 Webhook Retry Schedule

| Attempt | Delay | Total Time |
|---------|-------|------------|
| 1 | Immediate | 0s |
| 2 | 10 seconds | 10s |
| 3 | 1 minute | 70s |
| 4 | 5 minutes | 370s |
| 5 | 30 minutes | 2170s |
| 6 | 2 hours | 9370s |
| 7 | 6 hours | 31570s |
| 8 | 24 hours | 117970s (dead letter after) |

---

## 7. Built-in Connectors

### 7.1 Connector Catalog

| Connector | Features | Auth Type | Sync Entities | Webhook Support |
|-----------|----------|-----------|---------------|-----------------|
| Google Workspace | Gmail, Calendar, Contacts | OAuth 2.0 | Emails, Events, Contacts | Push (Pub/Sub) |
| Microsoft 365 | Outlook, Calendar, Contacts | OAuth 2.0 | Emails, Events, Contacts | Graph API webhooks |
| Mailchimp | Audience, Campaigns | OAuth 2.0 | Contacts, Lists | Outbound only |
| HubSpot | Contacts, Deals, Companies | OAuth 2.0 | Contacts, Deals | Inbound + Outbound |
| Slack | Messages, Channels, Users | OAuth 2.0 | Users, Channels | Event API |
| Twilio | SMS, Voice | API Key | Messages, Calls | Status callbacks |
| SendGrid | Email delivery | API Key | None (outbound only) | Event webhooks |
| Zoom | Meetings, Recordings | OAuth 2.0 | Meetings, Recordings | Outbound only |

### 7.2 Connector Configuration Templates

```json
{
  "google_workspace": {
    "client_id": "",
    "client_secret": "",
    "redirect_uri": "https://api.tzahu.com/integrations/oauth/callback/google",
    "features": ["email", "calendar", "contacts"],
    "sync_interval_minutes": 15
  },
  "slack": {
    "client_id": "",
    "client_secret": "",
    "signing_secret": "",
    "bot_token": "",
    "channels": ["general", "sales-team"],
    "notify_on": ["lead_created", "opportunity_won"]
  },
  "hubspot": {
    "client_id": "",
    "client_secret": "",
    "redirect_uri": "https://api.tzahu.com/integrations/oauth/callback/hubspot",
    "sync_contacts": true,
    "sync_deals": true
  }
}
```

---

## 8. Rate Limit Management

### 8.1 Per-Connector Rate Limit Adapter

```python
class RateLimitAdapter:
    """Adapts to each provider's rate limits dynamically."""

    PROVIDER_LIMITS = {
        "google": {"requests": 10000, "per": "day", "concurrent": 100},
        "microsoft": {"requests": 10000, "per": "hour", "concurrent": 50},
        "hubspot": {"requests": 100, "per": "10s", "concurrent": 10},
        "slack": {"requests": 1, "per": "1s", "concurrent": 5},
        "mailchimp": {"requests": 10, "per": "1s", "concurrent": 10},
        "sendgrid": {"requests": 100, "per": "1s", "concurrent": 50},
    }

    def __init__(self, provider: str):
        limits = self.PROVIDER_LIMITS[provider]
        self.token_bucket = TokenBucket(
            rate=limits["requests"],
            period=limits["per"],
            concurrency=limits["concurrent"],
        )

    async def acquire(self):
        await self.token_bucket.acquire()

    async def release(self):
        self.token_bucket.release()

    def on_rate_limited(self, retry_after: int):
        """Handle 429 response by backing off."""
        logger.info(f"Rate limited, backing off for {retry_after}s")
        self.token_bucket.backoff(retry_after)
```

### 8.2 Automatic Backoff

```python
class ExponentialBackoff:
    """Exponential backoff with jitter for rate-limited requests."""

    def __init__(self, base_delay: float = 1.0, max_delay: float = 300.0):
        self.base_delay = base_delay
        self.max_delay = max_delay

    async def wait(self, attempt: int):
        delay = min(self.base_delay * (2 ** attempt), self.max_delay)
        jitter = random.uniform(0, 0.1 * delay)
        await asyncio.sleep(delay + jitter)
```

---

## 9. Integration Lifecycle

### 9.1 Lifecycle Stages

```
Configure → Authorize → Test → Enable → Sync → Monitor → Update → Disable
    │           │         │       │       │        │        │         │
    ▼           ▼         ▼       ▼       ▼        ▼        ▼         ▼
  Select     OAuth     Test     Start    Periodic  Dashboard  Config   Stop
  connector  flow      sync     sync     sync      & alerts   update   sync
```

### 9.2 Lifecycle Management

```python
async def manage_lifecycle(instance_id: UUID, action: str) -> ConnectorInstance:
    instance = await ConnectorInstance.get(id=instance_id)

    if action == "configure":
        # Validate config and save
        validate_json_schema(instance.config_schema, instance.config)
        instance.status = "pending"

    elif action == "authorize":
        # Start OAuth flow or exchange code
        url = await integration_hub.authorize(instance_id)
        return url  # Redirect user to OAuth URL

    elif action == "test":
        # Test connection
        connector = await integration_hub._get_connector(instance)
        healthy = await connector.health_check()
        if not healthy:
            raise IntegrationError("Connection test failed")
        instance.status = "active"

    elif action == "enable":
        # Start periodic sync
        instance.status = "active"
        await schedule_periodic_sync(instance_id)

    elif action == "sync":
        # Trigger immediate sync
        await integration_hub.sync(instance_id, "contacts", "incremental")

    elif action == "disable":
        # Stop sync and webhooks
        instance.status = "paused"
        await cancel_periodic_sync(instance_id)

    elif action == "delete":
        # Remove connector and revoke tokens
        instance.status = "deleted"
        await token_vault.revoke(instance.organization_id, instance_id)
        await cancel_periodic_sync(instance_id)

    await instance.save()
    return instance
```

### 9.3 Monitoring Per Connector

| Metric | Description | Alert Threshold |
|--------|-------------|----------------|
| Sync duration | Time to complete sync | > 30 min |
| Records synced | Count per sync | Unexpected 0 |
| Error rate | % of failed operations | > 5% |
| Rate limit hits | 429 responses | > 10/hour |
| Token expiry | Days until token expires | < 7 days |
| Webhook latency | Time to deliver | > 60s |
| DLQ size | Dead letter queue count | > 100 |
