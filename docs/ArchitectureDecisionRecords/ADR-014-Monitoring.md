# ADR-014: Monitoring — OpenTelemetry + Prometheus + Grafana + Sentry

- **Status:** Accepted
- **Date:** 2025-07-27
- **Authors:** Chief Architect, DevOps Lead

## Context

TZAHU CRM requires observability across all services: metrics (performance, errors, throughput), tracing (request lifecycle across services), logging (structured, searchable), and alerting. The platform must be observable in development, staging, and production.

## Options Considered

### 1. OpenTelemetry + Prometheus + Grafana + Sentry (Selected)
- **Pros:** OpenTelemetry is the CNCF standard for observability (metrics, traces, logs), Prometheus is the standard metrics collector (pull model, TSDB), Grafana provides dashboards and alerting, Sentry for error tracking with context (breadcrumbs, user, environment). OpenTelemetry auto-instrumentation for Django, Celery, Redis, PostgreSQL, HTTP. Prometheus AlertManager for alert routing.
- **All open-source, self-hostable, CNCF ecosystem.**
- **Cons:** Higher setup complexity (OTel collector, Prometheus, Grafana, AlertManager), storage requirements (Prometheus TSDB, Sentry event store), requires operational expertise for scaling.

### 2. Datadog (Managed)
- **Pros:** Single solution for metrics, traces, logs, dashboards, alerting, APM. Zero-config auto-instrumentation for Django. Built-in AI insights. Excellent UX.
- **Cons:** Extremely expensive at scale (per-host + per-event pricing), cloud vendor lock-in, data residency concerns, cannot self-host for compliance.

### 3. New Relic
- **Pros:** Similar to Datadog, APM-focused, good Django support, one-click instrumentation.
- **Cons:** Expensive, vendor lock-in, data residency, less flexible than open-source stack.

### 4. ELK Stack (Elasticsearch + Logstash + Kibana)
- **Pros:** Excellent log management and search, Kibana dashboards, Elastic APM for tracing, beats for log shipping.
- **Cons:** Elasticsearch operational overhead (JVM, cluster management), log-centric (metrics are secondary), APM is a paid feature, not CNCF standard.

### 5. Grafana Cloud (Managed)
- **Pros:** Managed Grafana + Prometheus + Loki + Tempo, single vendor for all signals, reasonable free tier.
- **Cons:** Cost at scale (data ingress fees), fewer customization options than self-hosted, vendor lock-in.

## Decision

**Use OpenTelemetry for instrumentation**, Prometheus for metrics collection, Grafana for dashboards and alerting, Sentry for error tracking.

Stack:
- **Tracing:** OpenTelemetry auto-instrumentation for Django, Celery, Redis, PostgreSQL, HTTP/gRPC. OTel Collector for batching, sampling, and exporting. Tempo (or Jaeger) for trace storage.
- **Metrics:** Prometheus metrics exposed via `django-prometheus` middleware, Celery metrics, custom business metrics (leads created, deals won). Prometheus scrapes every 15s.
- **Dashboards:** Grafana dashboards per domain (Application, Database, Infrastructure, Business).
- **Alerting:** Grafana Alerting + AlertManager for pager/email/Slack integration.
- **Errors:** Sentry for exception tracking with full context (request, user, trace ID, breadcrumbs).
- **Logging:** Structured JSON logging via structlog, shipped to ELK or Loki.

Key metrics:
- Request latency (p50, p95, p99), error rate, throughput
- Celery queue depth, task latency, task failures
- Database query time, connection pool usage, cache hit ratio
- Business metrics: lead conversion rate, pipeline velocity

## Consequences

- **Positive:** CNCF standard observability, open-source, self-hostable, flexible.
- **Positive:** OTel auto-instrumentation reduces manual instrumentation.
- **Positive:** Sentry provides rich error context beyond stack traces.
- **Negative:** Must manage Prometheus storage (retention, compaction), Grafana HA for production.
- **Negative:** OTel collector adds latency (mitigated by sampling).
- **Negative:** Learning curve for OTel configuration and custom instrumentation.

## Compliance

- All services must expose Prometheus metrics endpoint (`/metrics`).
- All Django views instrumented via `django-prometheus`.
- All Celery tasks instrumented via `opentelemetry-instrumentation-celery`.
- Structured logging (JSON) for all environments.
- PR review: New features must include at least one business metric.
- SLA: P95 request latency <500ms, error rate <0.1%, uptime 99.9%.
