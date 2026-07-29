# TZAHU CRM — Observability

> **Version:** 0.1.0-draft
> **Last Updated:** 2026-07-27
> **Status:** Approved
> **Owner:** Platform Architecture Team

---

## Table of Contents

1. [Observability Philosophy](#1-observability-philosophy)
2. [Logging](#2-logging)
3. [Metrics](#3-metrics)
4. [Tracing](#4-tracing)
5. [Dashboards (Grafana)](#5-dashboards-grafana)
6. [Alerting](#6-alerting)
7. [SLOs & SLIs](#7-slos--slis)
8. [Sentry Error Tracking](#8-sentry-error-tracking)
9. [Health Checks](#9-health-checks)
10. [On-Call & Incident Response](#10-on-call--incident-response)

---

## 1. Observability Philosophy

1. **Three pillars.** Logging (what happened), Metrics (how many), Tracing (where it went).
2. **Correlation.** Every signal is correlated via `trace_id`, `span_id`, `request_id`, `correlation_id`.
3. **Actionable.** Every alert leads to a runbook. Every dashboard tells a story.
4. **Minimal overhead.** Instrumentation should not affect p95 latency by more than 1%.
5. **PII-safe.** Never log PII. Never expose sensitive data in metrics labels.
6. **Self-service.** Every team can create their own dashboards and alerts.

---

## 2. Logging

### Structured JSON Logging (structlog)

```python
# infrastructure/structlog_setup.py
import structlog

structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.dev.ConsoleRenderer() if DEBUG else structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)
```

### Log Levels

| Level | When | Examples |
|-------|------|---------|
| DEBUG | Development only | SQL queries, variable dumps |
| INFO | Normal operation | Request start/end, background job completion |
| WARNING | Unexpected but handled | Retry attempt, rate limit warning, degraded performance |
| ERROR | Operation failed | External API failure, DB connection error, Celery task failure |
| CRITICAL | System compromised/breaking | Data leak detected, RLS bypass, auth system failure |

### Log Format (Production)

```json
{
  "timestamp": "2026-07-27T10:30:00.123Z",
  "level": "INFO",
  "logger": "apps.lead_management.services.lead_service",
  "message": "Lead created successfully",
  "request_id": "req_abc123",
  "trace_id": "0190a3b2-8c7d-7e00-9b1a-deadbeef1234",
  "span_id": "b1a2c3d4e5f6a7b8",
  "user_id": "0190a3b2-...",
  "org_id": "0190a3b2-...",
  "lead_id": "0190a3b2-...",
  "company_name": "Acme Corp",
  "duration_ms": 45.2,
  "module": "lead_management",
  "environment": "production"
}
```

### Correlation ID Propagation

```python
# Middleware to inject correlation ID
class CorrelationIDMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        correlation_id = request.headers.get(
            "X-Correlation-ID",
            request.headers.get("X-Request-ID", str(uuid7())),
        )
        request.correlation_id = correlation_id
        structlog.contextvars.bind_contextvars(
            request_id=correlation_id,
            user_id=getattr(request.user, "id", None),
            org_id=getattr(request, "org_id", None),
        )
        response = self.get_response(request)
        response["X-Request-ID"] = correlation_id
        return response
```

### PII Redaction

```python
class PIIScrubber:
    PII_PATTERNS = [
        (r'[\w\.-]+@[\w\.-]+\.\w+', '[EMAIL REDACTED]'),
        (r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b', '[PHONE REDACTED]'),
        (r'\b\d{4}[-]\d{4}[-]\d{4}[-]\d{4}\b', '[CC REDACTED]'),
        (r'\b\d{3}[-]\d{2}[-]\d{4}\b', '[SSN REDACTED]'),
    ]

    @classmethod
    def scrub(cls, data: dict) -> dict:
        result = {}
        for key, value in data.items():
            if isinstance(value, str):
                for pattern, replacement in cls.PII_PATTERNS:
                    value = re.sub(pattern, replacement, value)
            result[key] = value
        return result
```

### Centralized Log Aggregation
- Production logs shipped to AWS CloudWatch Logs or Grafana Loki.
- Retention: 30 days hot, 1 year cold (S3/Glacier).
- Log groups: `/tzahu/{environment}/{service}`.

---

## 3. Metrics

### RED Method (Rate, Errors, Duration)

Every service and endpoint is measured by:
- **Rate**: requests per second
- **Errors**: count of failed requests
- **Duration**: latency distribution

### Prometheus Metrics

```python
# Prometheus metrics definitions
from prometheus_client import Counter, Histogram, Gauge

# API metrics
http_requests_total = Counter(
    "http_requests_total",
    "Total HTTP requests",
    ["method", "endpoint", "status", "org_tier"],
)
http_request_duration_ms = Histogram(
    "http_request_duration_ms",
    "HTTP request duration in ms",
    ["method", "endpoint"],
    buckets=[5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
)

# Celery metrics
celery_tasks_total = Counter(
    "celery_tasks_total",
    "Total Celery tasks processed",
    ["task_name", "status"],
)
celery_task_duration_seconds = Histogram(
    "celery_task_duration_seconds",
    "Celery task duration in seconds",
    ["task_name"],
    buckets=[0.1, 0.5, 1, 5, 10, 30, 60, 120],
)

# Database metrics
db_queries_total = Counter(
    "db_queries_total",
    "Total database queries",
    ["query_type", "table"],
)
db_query_duration_ms = Histogram(
    "db_query_duration_ms",
    "Database query duration in ms",
    ["query_type"],
    buckets=[1, 5, 10, 25, 50, 100, 250, 500],
)

# Cache metrics
cache_hit_ratio = Gauge(
    "cache_hit_ratio",
    "Cache hit ratio (0-1)",
    ["cache_name"],
)
cache_operations_total = Counter(
    "cache_operations_total",
    "Total cache operations",
    ["operation", "hit"],
)

# RLS metrics
rls_policy_hits = Counter(
    "rls_policy_hits_total",
    "Total RLS policy evaluations",
    ["table", "policy"],
)

# AI metrics
ai_tokens_total = Counter(
    "ai_tokens_total",
    "Total AI tokens consumed",
    ["provider", "model", "org_tier"],
)
ai_request_duration_ms = Histogram(
    "ai_request_duration_ms",
    "AI request duration in ms",
    ["provider", "model"],
    buckets=[100, 500, 1000, 2500, 5000, 10000, 30000],
)
ai_cost_total = Counter(
    "ai_cost_total_usd",
    "Total AI cost in USD",
    ["provider", "model", "org_id"],
)

# Business metrics
active_users_gauge = Gauge("active_users_total", "Active users per organization", ["org_id"])
leads_created_total = Counter("leads_created_total", "Total leads created", ["source"])
opportunities_won_total = Counter(
    "opportunities_won_total",
    "Total opportunities won",
    ["pipeline_id"],
)
pipeline_value_gauge = Gauge(
    "pipeline_value_total_usd",
    "Total pipeline value in USD",
    ["org_id"],
)
```

### Django Middleware for Metrics

```python
class PrometheusMetricsMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        start_time = time.time()
        response = self.get_response(request)
        duration_ms = (time.time() - start_time) * 1000

        http_requests_total.labels(
            method=request.method,
            endpoint=request.resolver_match.route if request.resolver_match else "unknown",
            status=response.status_code,
            org_tier=getattr(request, "org_tier", "unknown"),
        ).inc()

        http_request_duration_ms.labels(
            method=request.method,
            endpoint=request.resolver_match.route if request.resolver_match else "unknown",
        ).observe(duration_ms)

        return response
```

### Metric Export

```python
# urls.py
from django.urls import path
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
from django.http import HttpResponse

def metrics_view(request):
    return HttpResponse(
        generate_latest(),
        content_type=CONTENT_TYPE_LATEST,
    )

urlpatterns = [
    path("/metrics", metrics_view, name="prometheus-metrics"),
]
```

---

## 4. Tracing

### OpenTelemetry Configuration

```python
# infrastructure/open_telemetry.py
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.grpc.exporter import OTLPSpanExporter
from opentelemetry.instrumentation.django import DjangoInstrumentor
from opentelemetry.instrumentation.celery import CeleryInstrumentor
from opentelemetry.instrumentation.redis import RedisInstrumentor
from opentelemetry.instrumentation.psycopg2 import Psycopg2Instrumentor
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

def setup_opentelemetry():
    provider = TracerProvider()
    exporter = OTLPSpanExporter(endpoint=os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://otel-collector:4317"))
    provider.add_span_processor(BatchSpanProcessor(exporter))
    trace.set_tracer_provider(provider)

    # Auto-instrumentation
    DjangoInstrumentor().instrument()
    CeleryInstrumentor().instrument()
    RedisInstrumentor().instrument()
    Psycopg2Instrumentor().instrument()
```

### Sampling Strategy

| Service | Sampling Rate | Notes |
|---------|--------------|-------|
| API (default) | 10% | Head-based sampling |
| API (errors) | 100% | Always capture errors |
| API (slow) | 100% | Always capture p99+ |
| Celery tasks | 5% | Background jobs |
| AI Gateway | 100% | Cost + quality tracking |
| Auth endpoints | 50% | Security sensitivity |

### Custom Span Context

```python
from opentelemetry import trace

tracer = trace.get_tracer(__name__)

def process_lead_conversion(lead_id: UUID, user_id: UUID) -> Result:
    with tracer.start_as_current_span("process_lead_conversion") as span:
        span.set_attribute("lead_id", str(lead_id))
        span.set_attribute("user_id", str(user_id))
        span.add_event("lead_conversion_started")
        # ... business logic ...
        span.add_event("lead_conversion_completed")
```

### Trace Context Propagation
- W3C Trace Context (`traceparent` / `tracestate` headers).
- Propagated across: HTTP requests, Celery messages, RabbitMQ events, WebSocket connections.
- Service mesh (Istio/Linkerd) adds additional span context.

---

## 5. Dashboards (Grafana)

### API Overview Dashboard
| Panel | Metric | Query |
|-------|--------|-------|
| Request Rate | rate(http_requests_total[5m]) | sum by (endpoint) |
| Error Rate | rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) | |
| p50/p95/p99 Latency | http_request_duration_ms histogram_quantile | by endpoint |
| Top Slow Endpoints | topk(10, avg by(endpoint)(http_request_duration_ms)) | |
| Status Code Breakdown | rate(http_requests_total[5m]) | by status |

### Celery Queues Dashboard
| Panel | Metric |
|-------|--------|
| Queue Depth | celery_queue_depth (RabbitMQ exporter) |
| Task Rate | rate(celery_tasks_total[5m]) by (task_name) |
| Task Duration | celery_task_duration_seconds histogram |
| Failed Tasks | rate(celery_tasks_total{status="failure"}[5m]) |
| Worker Count | celery_workers_active |

### PostgreSQL Performance Dashboard
| Panel | Metric |
|-------|--------|
| Connections | pg_stat_activity_count |
| Cache Hit Ratio | pg_stat_database_blks_hit / (pg_stat_database_blks_hit + pg_stat_database_blks_read) |
| Transaction Rate | rate(pg_stat_database_xact_commit[5m]) |
| Query Duration | pg_stat_activity_max_query_duration |
| Dead Tuples | pg_stat_user_tables_n_dead_tup |
| Replication Lag | pg_stat_replication_lag |

### AI Usage Dashboard
| Panel | Metric |
|-------|--------|
| Token Consumption | rate(ai_tokens_total[5m]) by (model) |
| Cost per Org | sum(ai_cost_total) by (org_id) |
| Request Duration | ai_request_duration_ms histogram |
| Error Rate | rate(ai_request_duration_ms_count{error="true"}[5m]) |
| Provider Distribution | sum(ai_tokens_total) by (provider) |

### Tenant Health Dashboard
| Panel | Metric |
|-------|--------|
| Active Tenants | count(active_users_total > 0) |
| Per-Tenant API Usage | topk(20, sum by(org_id)(rate(http_requests_total[24h]))) |
| Per-Tenant Error Rate | topk(10, sum by(org_id)(rate(http_requests_total{status=~"5.."}[5m]))) |
| Storage per Tenant | pg_table_size by (org_id) |

---

## 6. Alerting

### Alert Severity Levels

| Severity | Response Time | Notification | Example |
|----------|--------------|-------------|---------|
| Critical | < 15 min | PagerDuty + SMS + Slack | RLS bypass, data leak, auth failure, complete API outage |
| High | < 1 hour | Slack + Email | Error rate > 1%, p95 latency > 1s, queue backlog growing |
| Medium | < 1 day | Slack | Cache hit ratio < 80%, DB connections > 80%, certificate expiring |
| Low | < 1 week | Email / Ticket | Disk usage > 70%, old dependencies, minor perf degradation |

### Alert Rules (Prometheus)

```yaml
# prometheus/rules.yaml
groups:
  - name: api
    rules:
      - alert: APIHighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.01
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "API error rate above 1% (current: {{ $value | humanizePercentage }})"

      - alert: APIHighLatency
        expr: histogram_quantile(0.95, rate(http_request_duration_ms_bucket[5m])) > 1000
        for: 5m
        labels:
          severity: high
        annotations:
          summary: "p95 latency above 1s (current: {{ $value }}ms)"

  - name: celery
    rules:
      - alert: CeleryQueueGrowing
        expr: celery_queue_depth > 1000
        for: 10m
        labels:
          severity: high
        annotations:
          summary: "Celery queue depth above 1000 (current: {{ $value }})"

      - alert: CeleryTaskFailureRate
        expr: rate(celery_tasks_total{status="failure"}[5m]) / rate(celery_tasks_total[5m]) > 0.05
        for: 5m
        labels:
          severity: high

  - name: database
    rules:
      - alert: DBConnectionHigh
        expr: pg_stat_activity_count > 150
        for: 5m
        labels:
          severity: high

      - alert: DBCacheHitRatioLow
        expr: rate(pg_stat_database_blks_hit[5m]) / (rate(pg_stat_database_blks_hit[5m]) + rate(pg_stat_database_blks_read[5m])) < 0.95
        for: 15m
        labels:
          severity: medium

  - name: security
    rules:
      - alert: RLSPolicyMissing
        expr: rls_policy_hits_total == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "RLS policy not being evaluated - possible isolation bypass"

      - alert: MultipleLoginFailures
        expr: rate(http_requests_total{endpoint="/api/v1/auth/login", status="401"}[5m]) > 10
        for: 2m
        labels:
          severity: high

  - name: ai
    rules:
      - alert: AIProviderDown
        expr: ai_request_duration_ms_count{error="true"} / ai_request_duration_ms_count > 0.5
        for: 5m
        labels:
          severity: critical

      - alert: AICostSpike
        expr: sum(rate(ai_cost_total[1h])) > 100
        for: 1h
        labels:
          severity: medium

  - name: business
    rules:
      - alert: NoLeadsCreated
        expr: rate(leads_created_total[1h]) == 0
        for: 6h
        labels:
          severity: low
```

### Burn Rate Alerts for SLOs

| SLO | Burn Rate | Alert Duration | Severity |
|-----|-----------|---------------|----------|
| API latency p95 < 500ms | 2x (1% in 30m) | 30 min | High |
| API error rate < 0.1% | 10x (1% in 5m) | 5 min | Critical |
| Workflow execution < 5s | 3x | 15 min | High |
| Email delivery < 60s | 5x | 10 min | High |

---

## 7. SLOs & SLIs

### Service Level Objectives

| Service | SLI | SLO | Measurement |
|---------|-----|-----|-------------|
| API Gateway | p95 latency | < 500ms | Histogram over 30d rolling window |
| API Gateway | Error rate | < 0.1% | (5xx + 429) / total over 30d |
| API Gateway | Availability | 99.95% | Successful responses / total |
| Celery | Task completion | > 99.9% | Success / total over 30d |
| Celery | Workflow execution | < 5s p95 | Duration for event-triggered workflows |
| Email delivery | End-to-end | < 60s p95 | From send to SMTP acceptance |
| Email delivery | Delivery rate | > 99.5% | Delivered / sent |
| AI Gateway | LLM response | < 5s p95 | From request to first token |
| AI Gateway | Provider availability | 99.9% | Successful provider responses |
| Database | Query latency | < 50ms p95 | All DB queries |
| Database | Availability | 99.99% | Connections accepted |
| Search | Full-text search | < 500ms p95 | Query to results |
| WebSocket | Message delivery | < 200ms p95 | Publish to client receive |

### SLO Calculation

```python
class SLOCalculator:
    def calculate_error_budget(
        self,
        total_requests: int,
        error_count: int,
        slo_target: float,
    ) -> dict:
        error_rate = error_count / total_requests if total_requests > 0 else 0
        error_budget = 1 - slo_target
        consumed = error_rate / error_budget if error_budget > 0 else 0
        remaining = max(0, 1 - consumed)
        return {
            "error_rate": error_rate,
            "error_budget": error_budget,
            "consumed": consumed,
            "remaining": remaining,
        }
```

---

## 8. Sentry Error Tracking

### Configuration

```python
# config/settings/prod.py
import sentry_sdk
from sentry_sdk.integrations.django import DjangoIntegration
from sentry_sdk.integrations.celery import CeleryIntegration
from sentry_sdk.integrations.redis import RedisIntegration

sentry_sdk.init(
    dsn=os.environ["SENTRY_DSN"],
    integrations=[
        DjangoIntegration(),
        CeleryIntegration(),
        RedisIntegration(),
    ],
    environment=ENVIRONMENT,
    release=RELEASE_VERSION,
    traces_sample_rate=0.1,
    profiles_sample_rate=0.1,
    send_default_pii=False,
    before_send=_scrub_pii,
)
```

### Error Grouping and Triage

- **Errors**: All unhandled exceptions with full stack traces.
- **Performance**: Traced transactions with spans for slow operations.
- **Releases**: Track which version introduced a regression.
- **User Feedback**: Prompt users to describe what happened.

### Alerting Rules in Sentry
- New issue: Slack notification.
- Issue spikes (> 100% increase in 1h): PagerDuty.
- Critical errors (Security, Auth, Payment): Immediate PagerDuty.

---

## 9. Health Checks

### /health/ Endpoint

```python
from django.http import JsonResponse
from django.db import connection
from django.core.cache import cache
import redis

def health_check(request):
    checks = {
        "status": "ok",
        "version": RELEASE_VERSION,
        "checks": {
            "database": _check_database(),
            "cache": _check_cache(),
            "celery": _check_celery(),
            "ai_gateway": _check_ai_gateway(),
            "storage": _check_storage(),
        },
    }
    status_code = 200 if all(
        c["status"] == "ok" for c in checks["checks"].values()
    ) else 503
    return JsonResponse(checks, status=status_code)

def _check_database() -> dict:
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        return {"status": "ok", "latency_ms": 0}
    except Exception as e:
        return {"status": "error", "message": str(e)}

def _check_cache() -> dict:
    try:
        cache.set("__health__", "ok", 5)
        result = cache.get("__health__")
        return {"status": "ok"} if result == "ok" else {"status": "error"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

def _check_celery() -> dict:
    try:
        from celery.app.control import Inspect
        i = Inspect()
        stats = i.stats()
        return {"status": "ok", "workers": len(stats or {})}
    except Exception as e:
        return {"status": "error", "message": str(e)}
```

### Readiness & Liveness Probes (K8s)

```yaml
# K8s Deployment
readinessProbe:
  httpGet:
    path: /health/
    port: 8000
  initialDelaySeconds: 10
  periodSeconds: 10
  timeoutSeconds: 3
  failureThreshold: 3

livenessProbe:
  httpGet:
    path: /health/
    port: 8000
  initialDelaySeconds: 30
  periodSeconds: 30
  timeoutSeconds: 5
  failureThreshold: 3
```

### Dependency Status

```json
{
  "status": "ok",
  "dependencies": {
    "postgresql": { "status": "ok", "latency_ms": 2 },
    "redis": { "status": "ok", "latency_ms": 1 },
    "rabbitmq": { "status": "ok", "queues": { "celery": 0, "events": 0 } },
    "ai_gateway": { "status": "ok", "latency_ms": 15 },
    "minio": { "status": "ok" }
  }
}
```

---

## 10. On-Call & Incident Response

### On-Call Schedule
- Primary: 1 week rotation (Mon-Mon).
- Secondary: 1 week rotation (escalation only).
- Follow-the-sun: US/EU/APAC coverage.
- Tools: PagerDuty for alerting, Slack for communication.

### Incident Response Process

1. **Detect** — Alert fires (PagerDuty).
2. **Acknowledge** — Within 15 min for critical, 1h for high.
3. **Triage** — Determine severity, assess impact, communicate status.
4. **Mitigate** — Rollback, feature flag disable, scale up, etc.
5. **Resolve** — Confirm fix, verify monitoring, close incident.
6. **Post-mortem** — < 48h for critical, < 1 week for high.

### Post-Mortem Template

```markdown
## Incident Report: #{id}

**Date:** 2026-07-27
**Severity:** Critical | High | Medium | Low
**Duration:** 45 minutes
**Impact:** 5000 users affected, 2000 requests failed

### Timeline
- 10:30 — Alert fired: API error rate > 1%
- 10:32 — Engineer acknowledged
- 10:35 — Identified: DB connection pool exhausted
- 10:40 — Scaled up DB connections, traffic恢复正常
- 11:15 — Full recovery confirmed

### Root Cause
...

### Remediation
- [ ] Increase max_connections
- [ ] Add connection pool monitoring alert
- [ ] Implement query timeout

### Lessons Learned
...
```
