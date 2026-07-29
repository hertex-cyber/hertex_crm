# TZAHU CRM — Monitoring Strategy

> **Version:** 0.1.0-draft
> **Last Updated:** 2026-07-27
> **Status:** Foundational Design Phase
> **Owner:** Platform Architecture Team

---

## Table of Contents

1. [Overview](#1-overview)
2. [Pillars](#2-pillars)
3. [Key Dashboards](#3-key-dashboards)
4. [Key Alerts](#4-key-alerts)
5. [SLOs](#5-slos)
6. [Burn Rate Alerts](#6-burn-rate-alerts)
7. [On-Call](#7-on-call)
8. [Cost Monitoring](#8-cost-monitoring)

---

## 1. Overview

The Monitoring Strategy provides end-to-end observability across the TZAHU CRM platform. Every request, background job, domain event, and external API call is traced, logged, and metered by default. The strategy follows the three pillars of observability — logging, metrics, and tracing — with alerting and dashboards providing actionable insights.

### 1.1 Observability Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          OBSERVABILITY STACK                               │
│                                                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   structlog   │  │  Prometheus  │  │ OpenTelemetry │  │    Sentry    │ │
│  │  (JSON logs)  │  │  (Metrics)   │  │   (Tracing)   │  │ (Errors)     │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘ │
│         │                 │                 │                 │          │
│         ▼                 ▼                 ▼                 ▼          │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │                        Grafana + Alertmanager                     │    │
│  │  Dashboards │ Alerts │ SLO Tracking │ Burn Rate │ On-Call         │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                                                                           │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │                       PagerDuty (On-Call)                         │    │
│  └──────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Pillars

### 2.1 Logging (structlog JSON)

All application logs are structured JSON emitted via `structlog`. Every log entry includes:

```json
{
  "timestamp": "2026-07-27T10:30:00.123Z",
  "level": "info",
  "event": "lead_created",
  "logger": "lead_management.application.services",
  "request_id": "req_abc123",
  "tenant_id": "org_uuid",
  "user_id": "user_uuid",
  "lead_id": "lead_uuid",
  "duration_ms": 45,
  "correlation_id": "corr_uuid",
  "trace_id": "otel_trace_id",
  "span_id": "otel_span_id",
  "exception": null
}
```

**Log Levels:**

| Level | Usage | Examples |
|-------|-------|----------|
| `debug` | Development only, never in production | SQL queries, variable dumps |
| `info` | Normal business events | Lead created, email sent, workflow executed |
| `warning` | Degraded but recoverable states | Retry attempt, rate limit nearing, slow query |
| `error` | Recoverable failures | API timeout, task failure, sync error |
| `critical` | Unrecoverable system failures | DB connection lost, RLS config error, out of disk |

**Log Aggregation:** Loki (Grafana) or Elasticsearch for log storage and querying. Logs retained for 30 days (active) + 12 months (cold storage).

### 2.2 Metrics (Prometheus)

**RED Method (Rate, Errors, Duration):**

| Metric | Type | Description | Labels |
|--------|------|-------------|--------|
| `http_requests_total` | Counter | Total HTTP requests | method, endpoint, status_code, tenant_id |
| `http_request_duration_seconds` | Histogram | Request latency | method, endpoint, tenant_id |
| `http_request_in_flight` | Gauge | Concurrent requests | method, endpoint |
| `celery_tasks_total` | Counter | Celery task executions | queue, task_name, status |
| `celery_task_duration_seconds` | Histogram | Task duration | queue, task_name |
| `celery_queue_depth` | Gauge | Messages waiting in queue | queue |
| `db_queries_total` | Counter | Database queries | module, operation |
| `db_query_duration_seconds` | Histogram | Query latency | module, operation |
| `db_connections_active` | Gauge | Active DB connections | database |
| `cache_hit_ratio` | Gauge | Cache hit rate | cache_name |
| `cache_operations_total` | Counter | Cache operations | cache_name, operation |
| `ai_tokens_total` | Counter | LLM token usage | model, feature, org_id |
| `ai_request_duration_seconds` | Histogram | AI request latency | model, feature |
| `ai_costs_total` | Counter | AI cost in USD | feature, org_id |
| `rls_checks_total` | Counter | RLS policy evaluations | table, result |
| `rabbitmq_queue_depth` | Gauge | Messages in queue | queue |
| `rabbitmq_consumer_count` | Gauge | Active consumers | queue |
| `workflow_executions_total` | Counter | Workflow executions | workflow_id, status |
| `email_sent_total` | Counter | Emails sent | provider, status |
| `integration_sync_total` | Counter | Integration syncs | connector, status |

**Metric Collection:**

- Scrape interval: 15 seconds
- Retention: 30 days (Prometheus), 12 months (Thanos/Cortex for long-term)
- Cardinality limit: Alert if label cardinality exceeds 100,000

### 2.3 Tracing (OpenTelemetry)

**Traced Operations:**

| Span Name | Service | Attributes |
|-----------|---------|------------|
| `HTTP {method} {path}` | Django | http.method, http.url, http.status_code |
| `Celery {task_name}` | Celery | celery.queue, celery.routing_key |
| `DB query` | Django | db.system, db.name, db.statement (sanitized) |
| `Redis command` | Django | redis.command, redis.key (sanitized) |
| `RabbitMQ publish` | Django/Worker | messaging.system, messaging.destination |
| `AI chat completion` | AI Gateway | ai.model, ai.feature, ai.provider |

**Trace Propagation:**

- W3C Trace Context (`traceparent` / `tracestate` headers)
- Propagated across: HTTP → Celery → RabbitMQ → AI Gateway
- Sampling: 100% for error traces, 10% for successful traces (head-based)
- Storage: Jaeger or Tempo (30 day retention)

### 2.4 Alerting (Alertmanager)

Alertmanager receives alerts from Prometheus and routes them based on severity and service:

```yaml
# Alertmanager configuration
route:
  receiver: 'default'
  group_by: ['alertname', 'severity', 'service']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
  routes:
    - match:
        severity: critical
      receiver: 'pagerduty-critical'
      repeat_interval: 10m
    - match:
        severity: high
      receiver: 'pagerduty-high'
    - match:
        severity: medium
      receiver: 'slack-alerts'

receivers:
  - name: 'pagerduty-critical'
    pagerduty_configs:
      - routing_key: '{{ PAGERDUTY_ROUTING_KEY }}'
        severity: critical
  - name: 'pagerduty-high'
    pagerduty_configs:
      - routing_key: '{{ PAGERDUTY_ROUTING_KEY }}'
        severity: error
  - name: 'slack-alerts'
    slack_configs:
      - api_url: '{{ SLACK_WEBHOOK_URL }}'
        channel: '#tzahu-alerts'
```

### 2.5 Dashboards (Grafana)

Grafana serves as the unified visualization layer, with dashboards organized by domain:

- **Executive Overview**: High-level business + system health
- **API Overview**: Request rate, latency, error rate by endpoint
- **Celery Queues**: Queue depth, task duration, worker count
- **PostgreSQL Performance**: Query latency, connections, cache hit ratio, bloat
- **Redis Cache**: Hit ratio, memory usage, eviction rate
- **RabbitMQ**: Queue depth, consumer lag, publish rate
- **AI Usage**: Token count, cost, latency by feature and model
- **Tenant Health**: Per-org request rate, error rate, latency
- **Business Metrics**: Leads created, opportunities won, emails sent

### 2.6 Error Tracking (Sentry)

Sentry captures and aggregates exceptions:

```python
import sentry_sdk
from sentry_sdk.integrations.django import DjangoIntegration
from sentry_sdk.integrations.celery import CeleryIntegration
from sentry_sdk.integrations.redis import RedisIntegration

sentry_sdk.init(
    dsn=settings.SENTRY_DSN,
    environment=settings.ENVIRONMENT,
    traces_sample_rate=0.1,          # 10% of transactions
    profiles_sample_rate=0.05,       # 5% of profiles
    send_default_pii=False,          # GDPR compliance
    integrations=[
        DjangoIntegration(),
        CeleryIntegration(),
        RedisIntegration(),
    ],
    before_send=strip_pii_from_event,  # Strip PII before sending
    release=settings.VERSION,
)
```

**Sentry Configuration:**

| Setting | Value | Rationale |
|---------|-------|-----------|
| `traces_sample_rate` | 0.1 | 10% sampling keeps cost reasonable |
| `send_default_pii` | False | GDPR compliance |
| `environment` | Environment name | Separate dev/staging/prod issues |
| `release` | Git commit SHA | Correlate errors with deployments |
| `in_app_include` | `['tzahu', 'apps']` | Focus on application code |

---

## 3. Key Dashboards

### 3.1 API Overview Dashboard

```
┌─────────────────────────────────────────────────────────────────────────┐
│ API Overview — Last 24h                                                 │
├──────────────────────────┬──────────────────────────┬───────────────────┤
│ Requests: 1,234,567      │ Error Rate: 0.08%        │ p95 Latency: 180ms│
│ (▲ 12% vs yesterday)    │ (▼ 0.02% vs yesterday)   │ (▼ 5% vs yesterday)│
├──────────────────────────┴──────────────────────────┴───────────────────┤
│                                                                         │
│ Requests per Endpoint (Top 10)    │ Latency Heatmap (24h x endpoint)   │
│ Bar chart:                        │ Heatmap:                           │
│ /api/v1/leads/    ████████ 45%    │                                     │
│ /api/v1/contacts/ ██████   30%    │ Endpoint    00:00  06:00  12:00    │
│ /api/v1/auth/     ███      15%    │ ─────────────────────────────────── │
│ /api/v1/search/   ██       10%    │ /api/v1/leads/  ██    ██    ████   │
│                                   │ /api/v1/auth/   █    ██    ██      │
├───────────────────────────────────┴─────────────────────────────────────┤
│ Status Code Distribution          │ Top Error Messages                  │
│ 2xx: 95.2%                        │ 1. ValidationError (field: email)  │
│ 4xx: 4.5%                         │ 2. Not Found: lead not found       │
│ 5xx: 0.3%                         │ 3. Rate limit exceeded (4,532x)    │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Celery Queues Dashboard

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Celery Queues — Last 6h                                                 │
├──────────────┬──────────┬──────────┬──────────┬──────────┬─────────────┤
│ Queue        │ Depth    │ Active   │ Rate     │ p95      │ Errors      │
│──────────────│──────────│──────────│──────────│──────────│─────────────│
│ workflow     │ 234      │ 12       │ 45/s     │ 1.2s     │ 0.5%        │
│ notification │ 1,234    │ 8        │ 120/s    │ 0.8s     │ 0.1%        │
│ reports      │ 12       │ 2        │ 2/s      │ 30.5s    │ 0.0%        │
│ integrations │ 567      │ 6        │ 15/s     │ 5.2s     │ 2.1%        │
│ imports      │ 89       │ 3        │ 3/s      │ 45.1s    │ 1.5%        │
│ default      │ 45       │ 4        │ 10/s     │ 0.5s     │ 0.3%        │
├──────────────┴──────────┴──────────┴──────────┴──────────┴─────────────┤
│                                                                         │
│ Queue Depth Timeline               │ Worker Count per Queue            │
│ ┌──────────────────────────────┐   │ ┌──────────────────────────────┐  │
│ │ Depth ▲                      │   │ │ Workers ▲                    │  │
│ │ 2000  │    /\    /\          │   │ │ 12     │ ██ ██ ██           │  │
│ │ 1000  │   /  \  /  \    /\  │   │ │ 8      │ ██ ██ ██ ██ ██     │  │
│ │ 0     │──/────\/────\──/──\─│   │ │ 4      │ ██ ██ ██ ██ ██ ██  │  │
│ │       │ 12:00  15:00  18:00 │   │ │        │ w  n  r  i  m  d    │  │
│ └──────────────────────────────┘   │ └──────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.3 PostgreSQL Performance Dashboard

```
┌─────────────────────────────────────────────────────────────────────────┐
│ PostgreSQL Performance — Last 24h                                       │
├───────────────────────┬───────────────────────┬────────────────────────┤
│ Connections: 45/200   │ Cache Hit Ratio: 99.2%│ Active Queries: 12     │
│ (22.5% utilization)   │ (▼ 0.3% vs yesterday)│ TX/sec: 1,234          │
├───────────────────────┴───────────────────────┴────────────────────────┤
│                                                                         │
│ Slow Queries (>500ms)          │ Index Usage                           │
│ 1. 1.2s - SELECT ... leads...  │ lead_management_leads_pkey: 99.9%     │
│ 2. 0.8s - SELECT ... activ...  │ idx_leads_search: 98.5%               │
│ 3. 0.6s - UPDATE ... workfl... │ idx_rag_vectors_embedding: 97.2%      │
│                                                                         │
│ Top Tables by Size             │ Bloat Analysis                        │
│ activity_activity: 45GB        │ activity_activity: 1.2GB (2.7%)       │
│ audit_auditlog: 32GB           │ audit_auditlog: 0.8GB (2.5%)          │
│ rag_vectors: 18GB              │ rag_vectors: 0.3GB (1.7%)             │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Key Alerts

### 4.1 Alert Definitions

| Alert Name | Condition | Severity | Response |
|------------|-----------|----------|----------|
| **RLSPolicyFailure** | RLS check fails (app.current_organization_id not set) | Critical | Immediate investigation; potential data leak |
| **DBConnectionLoss** | Cannot connect to PostgreSQL for > 30s | Critical | Failover to replica; check Pgbouncer |
| **High5xxRate** | 5xx responses > 5% over 5 min | Critical | Check deployment, rollback if needed |
| **HighP95Latency** | p95 > 1s over 5 min | High | Investigate slow queries, scale workers |
| **QueueBacklog** | Queue depth > 10,000 for > 5 min | High | Scale Celery workers for that queue |
| **DeadLetterQueue** | DLQ messages > 100 | High | Investigate root cause of failures |
| **CacheHitRatioLow** | Cache hit ratio < 50% over 10 min | Medium | Check cache warming, TTL config |
| **DiskUsage** | Disk > 80% on any node | Medium | Clean up, add storage |
| **CertificateExpiry** | TLS cert expires in < 30 days | Medium | Renew certificate |
| **TokenRefreshFailure** | OAuth token refresh fails | Medium | Re-authorize connector |
| **AIErrorRate** | AI request error rate > 10% | High | Check provider status, fallback |
| **ReplicationLag** | Replica lag > 60s | High | Check replication, network |

### 4.2 Alert Severity Matrix

| Severity | Response Time | Notification | Escalation |
|----------|--------------|-------------|------------|
| **Critical** | 5 minutes | PagerDuty call + Slack | On-call engineer |
| **High** | 15 minutes | Slack + PagerDuty push | On-call engineer |
| **Medium** | 1 hour | Slack notification | Team lead (business hours) |
| **Low** | 24 hours | Email / dashboard | Team member (next sprint) |

---

## 5. SLOs

### 5.1 Service Level Objectives

| Service | SLO | Measurement Window | Burn Rate Window |
|---------|-----|-------------------|------------------|
| API Latency (p95) | < 500ms (99.9% of requests) | 30 days | 1h / 5min |
| API Error Rate | < 0.1% (excluding 4xx) | 30 days | 1h / 5min |
| API Uptime | 99.95% | 30 days | 1h / 5min |
| Celery Task Duration | < 5s (p95) | 7 days | 1h |
| Email Delivery | < 60s (p95) | 7 days | 1h |
| Report Execution | < 30s (p95) | 7 days | 1h |
| AI Inference | < 2s (p95) | 30 days | 1h |
| Search Response | < 500ms (p95) | 30 days | 1h |
| RAG Query | < 2s (p95) | 30 days | 1h |
| Workflow Execution | < 5s (p95) | 7 days | 1h |

### 5.2 Error Budgets

Each SLO has an associated error budget:

```
Error Budget = (1 - SLO) × Total Requests

Example: API SLO = 99.9%
Monthly requests = 10,000,000
Error budget = (1 - 0.999) × 10,000,000 = 10,000 errors/month
Remaining budget = Error budget - Actual errors
```

**Error Budget Policy:**

| Budget Remaining | Action |
|------------------|--------|
| > 50% | Normal operations, deploy freely |
| 25-50% | Reduce deployment frequency, increase test coverage |
| 10-25% | Freeze non-critical deployments, focus on reliability |
| < 10% | Emergency: all deployments blocked, full incident response |

---

## 6. Burn Rate Alerts

### 6.1 Multi-Window Multi-Burn-Rate Approach

Burn rate alerts detect if SLO compliance is at risk. A burn rate of 1 means the error budget will last the full month. A burn rate of 2 means it will be exhausted in half the time.

```yaml
# Burn rate alert configuration for API latency SLO (99.9%)
groups:
  - name: slo_alerts
    rules:
      # Fast burn detection: 5 min window, 14.4x burn rate
      # If error rate > 1.44% for 5 min, error budget at risk
      - alert: HighErrorRateFastBurn
        expr: |
          (
            sum(rate(http_requests_total{status_code=~"5.."}[5m]))
            /
            sum(rate(http_requests_total[5m]))
          ) > 0.0144
        labels:
          severity: critical
        annotations:
          summary: "Error rate is 14.4x the SLO budget"
          
      # Slow burn detection: 1h window, 6x burn rate
      # If error rate > 0.6% for 1h, error budget at risk
      - alert: HighErrorRateSlowBurn
        expr: |
          (
            sum(rate(http_requests_total{status_code=~"5.."}[1h]))
            /
            sum(rate(http_requests_total[1h]))
          ) > 0.006
        labels:
          severity: high
```

### 6.2 Burn Rate Parameters

| SLO | Fast Burn (5 min) | Slow Burn (1h) |
|-----|-------------------|----------------|
| 99.9% | > 1.44% (14.4x) | > 0.6% (6x) |
| 99.95% | > 0.75% (15x) | > 0.3% (6x) |
| 99.99% | > 0.3% (30x) | > 0.06% (6x) |

### 6.3 Alert Fatigue Prevention

- No repeat alerts within 4 hours for same SLO (Alertmanager `repeat_interval`)
- Group alerts by service + SLO (Alertmanager `group_by`)
- Muted during planned maintenance windows
- Auto-resolve when error rate returns to normal for 2x the window

---

## 7. On-Call

### 7.1 PagerDuty Integration

```yaml
# PagerDuty service configuration
service:
  name: "TZAHU CRM - Production"
  escalation_policy: "Primary On-Call → Senior Engineer → Engineering Manager"
  acknowledgement_timeout: 10 minutes
  auto_resolve_timeout: 30 minutes
  
  schedules:
    - name: "Primary"
      rotation: "7 days"
      handoff: "Monday 09:00 UTC"
    - name: "Secondary"
      rotation: "7 days"
      handoff: "Monday 09:00 UTC"
```

### 7.2 Escalation Policy

```
Level 1: Primary On-Call Engineer
  Response time: 5 minutes (critical), 15 minutes (high)
  Responsibilities: Acknowledge, triage, resolve or escalate
  Channels: PagerDuty (call + push), Slack

Level 2: Senior Engineer
  Response time: 15 minutes
  Responsibilities: Complex issue resolution, coordinate team response
  Channels: PagerDuty (push), Slack

Level 3: Engineering Manager
  Response time: 30 minutes
  Responsibilities: Incident management, stakeholder communication
  Channels: PagerDuty (push), Slack, Phone
```

### 7.3 Incident Response Runbook Template

```markdown
# Incident Response Runbook

## 1. Acknowledge
- [ ] Acknowledge alert in PagerDuty
- [ ] Join #incident-{id} Slack channel
- [ ] Update incident status in PagerDuty

## 2. Triage
- [ ] Check Grafana dashboards (API Overview, relevant service)
- [ ] Check Sentry for error spikes
- [ ] Check recent deployments (GitHub Actions)
- [ ] Determine severity (SEV1, SEV2, SEV3)

## 3. Mitigate
- [ ] Rollback recent deployment (if applicable)
- [ ] Scale affected service (kubectl scale deployment)
- [ ] Restart affected service (if stuck state)
- [ ] Enable feature flag / kill switch (if available)

## 4. Resolve
- [ ] Verify system health in Grafana
- [ ] Confirm alert resolves
- [ ] Update PagerDuty with resolution notes

## 5. Post-Mortem
- [ ] Create incident report within 48h
- [ ] Identify root cause
- [ ] Define action items with owners and due dates
- [ ] Schedule post-mortem review
```

### 7.4 On-Call Rotation

- **Schedule**: 7-day rotations, Monday 09:00 UTC handoff
- **Coverage**: 24/7 for critical alerts, business hours for high/medium
- **Shadow**: Junior engineer shadows primary for training
- **Overrides**: Pre-approved swaps in PagerDuty; no ad-hoc changes
- **Holidays**: Adjust rotation to avoid on-call during public holidays

---

## 8. Cost Monitoring

### 8.1 AI Token Usage Per Org

```sql
-- Daily AI cost aggregation
SELECT
    organization_id,
    feature,
    model,
    SUM(prompt_tokens) AS total_prompt_tokens,
    SUM(completion_tokens) AS total_completion_tokens,
    SUM(cost_usd) AS total_cost_usd
FROM ai_usage_records
WHERE timestamp >= NOW() - INTERVAL '1 day'
GROUP BY organization_id, feature, model;
```

### 8.2 Cost Dashboard Metrics

| Metric | Description | Query |
|--------|-------------|-------|
| Daily AI cost by org | Sum of AI costs per org today | `sum(ai_costs_total)` |
| Cost by feature | Cost attribution to each AI feature | `sum by (feature) (ai_costs_total)` |
| Cost by model | Cost per LLM model | `sum by (model) (ai_costs_total)` |
| Budget utilization | % of monthly budget consumed | `month_to_date_cost / monthly_budget` |
| Cost anomaly | Cost spike detection | `current_hour_cost > rolling_avg_24h * 2` |

### 8.3 Budget Alerts

```python
class CostAlertManager:
    async def check_budgets(self):
        orgs = await self.get_active_orgs()
        for org in orgs:
            for feature in ["lead_scoring", "rag", "sentiment", "summary"]:
                budget = org.ai_budgets.get(feature, 0)
                if budget <= 0:
                    continue
                usage = await self.get_monthly_usage(org.id, feature)
                utilization = usage / budget

                if utilization >= 1.0:
                    await self.send_alert(org, feature, utilization, "exceeded")
                elif utilization >= 0.95:
                    await self.send_alert(org, feature, utilization, "critical")
                elif utilization >= 0.80:
                    await self.send_alert(org, feature, utilization, "warning")
```

### 8.4 Infrastructure Cost Attribution

| Resource | Attribution Method | Labels |
|----------|-------------------|--------|
| CPU/Memory (K8s) | Namespace + deployment labels | namespace, app, org_id |
| PostgreSQL | Connection count + query volume | database, org_id |
| Redis | Memory usage by DB | db, org_id |
| RabbitMQ | Queue depth + message volume | queue, vhost |
| MinIO | Storage per prefix | bucket, org_id |
| AI API calls | Exact per-call attribution | org_id, feature, model |

### 8.5 Anomaly Detection

```python
class CostAnomalyDetector:
    """Detect unusual cost patterns using statistical methods."""

    async def detect(self) -> list[Anomaly]:
        anomalies = []

        # 1. Daily cost spike (2x rolling 7-day average)
        for org in await self.get_orgs():
            daily_cost = await self.get_daily_cost(org.id)
            rolling_avg = await self.get_rolling_7d_avg(org.id)
            if daily_cost > rolling_avg * 2:
                anomalies.append(Anomaly(
                    org_id=org.id,
                    metric="daily_cost",
                    value=daily_cost,
                    expected=rolling_avg,
                    severity="warning",
                ))

        # 2. Token count anomaly per feature
        for feature in ["lead_scoring", "rag"]:
            current = await self.get_feature_token_count(feature, window="1h")
            baseline = await self.get_feature_token_count(feature, window="7d")
            if current > baseline.mean() + 3 * baseline.std():
                anomalies.append(Anomaly(...))

        return anomalies
```
