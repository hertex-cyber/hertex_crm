# ADR-010: Background Tasks — Celery + RabbitMQ

- **Status:** Accepted
- **Date:** 2025-07-27
- **Authors:** Chief Architect, Backend Lead

## Context

TZAHU CRM requires background task processing for: email sending, report generation, data import/export, AI model inference, workflow execution, webhook delivery, scheduled jobs, and maintenance tasks. Tasks must support retries, rate limiting, priority queuing, and scheduled execution.

## Options Considered

### 1. Celery + RabbitMQ (Selected)
- **Pros:** Most mature Python task queue (2009+), reliable with RabbitMQ broker, rich feature set: task routing, priority queues, rate limiting, retries with backoff, task expiration, task ETA/countdown, periodic tasks (celery beat), workflow (chord, chain, group, canvas), result backends, task monitoring (Flower), excellent Django integration (django-celery-beat), massive community.
- **Cons:** Requires broker (RabbitMQ) and result backend (Redis), configuration complexity, task monitoring requires additional tooling (Flower), not as performant as simpler queues for trivial tasks, somewhat heavyweight for simple async execution.

### 2. Dramatiq
- **Pros:** Modern Python task queue, simpler than Celery, built-in retries, rate limiting, delays, Redis/RabbitMQ brokers, process-level concurrency (no fork issues), message visibility timeout.
- **Cons:** Smaller community, fewer integrations, no periodic task scheduler built-in (requires separate library), less battle-tested for enterprise, fewer monitoring tools.

### 3. Temporal.io
- **Pros:** Enterprise-grade workflow engine, durable execution (even through outages), unlimited workflow history, replay for determinism, SDK for multiple languages, built-in retries, timers, signals, query capabilities.
- **Cons:** Requires Temporal Server (separate infrastructure), heavier operational footprint, Python SDK is newer (less mature), over-engineering for simple background tasks, significantly steeper learning curve.

### 4. Huey
- **Pros:** Lightweight, simple, Redis/SQLite broker, no configuration needed, built-in periodic tasks, retries, delays.
- **Cons:** Single-process concurrency model, limited monitoring, no advanced workflow patterns (no chord/chain), not suitable for high-throughput or complex workflows.

### 5. Simple RQ (Redis Queue)
- **Pros:** Very simple, Redis-backed, minimal configuration, no broker complexity.
- **Cons:** No advanced routing, no rate limiting, no periodic scheduler built-in, no workflow patterns, no priority queues, limited retry configuration.

## Decision

**Use Celery as the background task framework** with RabbitMQ as the broker.

Task categorization:
- **Immediate tasks** (low latency, <1s): Synchronous in request-response or FastAPI async
- **Short-lived tasks** (<5 min): Celery with auto-scaling pool, priority queues
- **Long-running tasks** (5 min+): Celery with dedicated queues, timeout monitoring
- **Scheduled tasks**: Celery Beat with django-celery-beat for dynamic schedule management
- **Workflow tasks**: Celery canvas (chains, chords, groups) for multi-step operations

## Consequences

- **Positive:** Mature, feature-rich, excellent Django integration, large community.
- **Positive:** Celery Beat provides admin-managed periodic tasks.
- **Negative:** Configuration complexity (broker, result backend, concurrency settings).
- **Negative:** Task monitoring requires Flower or custom dashboards.
- **Negative:** Celery worker memory management (long-running workers may leak).
- **Mitigation:** Task timeouts, soft/hard time limits, worker max-tasks-per-child, sentry integration for task errors.

## Compliance

- All Celery tasks defined in `tasks.py` within each module.
- Task routing: `default` queue for general tasks, `high` for priority, `slow` for long-running, `scheduled` for beat tasks.
- All tasks must have `soft_time_limit` and `time_limit`.
- CI test: `python -m celery inspect ping` for broker connectivity.
- Production: All task failures sent to Sentry, task metrics scraped by Prometheus.
