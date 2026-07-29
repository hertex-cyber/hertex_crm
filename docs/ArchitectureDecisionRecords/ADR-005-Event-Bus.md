# ADR-005: Event Bus — RabbitMQ

- **Status:** Accepted
- **Date:** 2025-07-27
- **Authors:** Chief Architect, Backend Lead

## Context

TZAHU CRM is an event-driven system. Domain events (LeadCreated, OpportunityStageChanged, WorkflowTriggered) must be reliably published and consumed across modules. The event bus must support at-least-once delivery, dead-letter queues, delayed retries, and future event sourcing.

## Options Considered

### 1. RabbitMQ (Selected)
- **Pros:** Mature (2007+), AMQP 0-9-1 standard, rich routing (direct, topic, fanout, headers), dead-letter exchanges, delayed message exchange plugin, quorum queues for HA, reliable delivery (publisher confirms + consumer acks), well-integrated with Celery, good operational tooling (Management UI), AGPLv3 (commercial license available).
- **Cons:** Not as high-throughput as Kafka (150K msg/s vs 1M+), messages are consumed and deleted (no replay by default unless using stream queues), stream support is newer (RabbitMQ 3.9+), disk-space management required.

### 2. Redis Streams
- **Pros:** Simple (same Redis infrastructure), consumer groups, at-least-once delivery, no additional ops overhead, good for moderate throughput.
- **Cons:** No dead-letter queues (requires application logic), no delayed messages (requires workaround), no routing (single stream), messages are limited by Redis memory, stream lag monitoring less mature, persistence model (RDB/AOF) not designed for long-term message storage.

### 3. Apache Kafka
- **Pros:** Highest throughput (millions msg/s), log-based storage (replayable), long-term retention, exactly-once semantics, strong partitioning, Kafka Connect ecosystem, stream processing (Kafka Streams, ksqlDB).
- **Cons:** Operational complexity (requires Zookeeper/KRaft, broker management), heavier resource footprint, over-engineering for current scale, Java/JVM dependency (or need for non-JVM clients), higher latency than RabbitMQ for simple pub/sub, learning curve for team.

### 4. Google Pub/Sub / AWS SQS/SNS (Managed)
- **Pros:** Zero operations, auto-scaling, fully managed.
- **Cons:** Cloud vendor lock-in, higher latency, not available for local development (requires emulator), cost at scale, limited routing features, compliance/data residency concerns.

## Decision

**Use RabbitMQ** as the primary event bus, with Celery for background task distribution.

- All cross-module domain events are published to RabbitMQ topics.
- Each consuming module declares its own queue bound to relevant topics.
- Dead-letter queues (DLQ) for failed messages after 3 retries.
- Delayed retry via `rabbitmq-delayed-message-exchange` plugin.
- Publisher confirms enabled for reliable publishing.
- Stream queues for events requiring replay (audit, rebuild).

For high-throughput event streams in the future (e.g., analytics ingestion), consider Kafka as an additional pipeline.

## Consequences

- **Positive:** Mature, reliable, well-understood by team, excellent Celery integration.
- **Positive:** Rich routing enables domain event topology (event per aggregate action).
- **Negative:** Requires RabbitMQ cluster management (HA, monitoring).
- **Negative:** Events are consumed and deleted; for replayability, archive to PostgreSQL or S3.
- **Negative:** At high scale, may need to add Kafka for analytics streams.
- **Negative:** Must implement Outbox Pattern (ADR-010 concept) to ensure reliable publishing.

## Compliance

- All cross-module events: defined in `shared_kernel/events.py` as typed dataclasses.
- Every event consumer must handle `retry` and `dlq` processing.
- CI check: `python manage.py check_event_definitions` verifies event docs.
- Production: RabbitMQ monitoring via Prometheus exporter.
