# TZAHU CRM — Platform Infrastructure

> **Version:** 0.1.0-draft
> **Last Updated:** 2026-07-27
> **Status:** Foundational Design Phase
> **Owner:** Platform Architecture Team

---

## Table of Contents

1. [Overview](#1-overview)
2. [PostgreSQL](#2-postgresql)
3. [Redis](#3-redis)
4. [RabbitMQ](#4-rabbitmq)
5. [Celery](#5-celery)
6. [MinIO](#6-minio)
7. [Django](#7-django)
8. [Nginx](#8-nginx)

---

## 1. Overview

This document specifies the configuration, operation, and best practices for all infrastructure components in the TZAHU CRM platform. Every component is configured for production-grade reliability, performance, and security. Environment-specific overrides are managed through environment variables and deployment configuration, not code changes.

Infrastructure ownership is shared between Platform Engineering (operational concerns) and the Architecture Team (design decisions).

---

## 2. PostgreSQL

### 2.1 Version and Extensions

| Component | Version | Purpose |
|-----------|---------|---------|
| PostgreSQL | 16.x | Primary relational database |
| pgvector | 0.7+ | Vector embeddings storage and similarity search |
| pg_trgm | bundled | Trigram-based fuzzy text search (BM25-style) |
| uuid-ossp | bundled | UUID generation (fallback, primary is Python-side UUID v7) |
| pg_stat_statements | bundled | Query performance analysis |
| pgcrypto | bundled | Cryptographic functions for RLS and encryption |
| postgres_fdw | bundled | Cross-database federation (Silo migration path) |

### 2.2 PostgreSQL Configuration

```ini
# postgresql.conf — Production Configuration

# Memory Configuration
shared_buffers = '4GB'              # 25% of available RAM (16GB instance)
effective_cache_size = '12GB'       # 75% of available RAM
work_mem = '64MB'                   # Per-operation sort/hash memory
maintenance_work_mem = '1GB'        # For VACUUM, CREATE INDEX
wal_buffers = '64MB'                # WAL write buffer

# Connections
max_connections = '200'             # Managed by Pgbouncer (pool maxes at 50)
superuser_reserved_connections = '5'
listen_addresses = '0.0.0.0'        # Bind to all interfaces (firewalled)

# Write-Ahead Log
wal_level = 'replica'               # Required for replication and archiving
wal_log_hints = 'on'                # Required for pg_rewind
wal_buffers = '64MB'
wal_writer_delay = '200ms'
wal_writer_flush_after = '1MB'
max_wal_size = '8GB'
min_wal_size = '2GB'
checkpoint_completion_target = '0.9'
archive_mode = 'on'
archive_command = 'pgbackrest --stanza=main archive-push %p'

# Query Planner
random_page_cost = '1.1'            # SSD/NVMe optimization (default 4.0)
effective_cache_size = '12GB'
default_statistics_target = '500'   # Better query plans (default 100)
geqo = 'off'                        # Genetic optimizer off for consistency
from_collapse_limit = '8'           # Join collapse limit
join_collapse_limit = '8'           # Join collapse limit

# Parallel Query
parallel_setup_cost = '1000'
parallel_tuple_cost = '0.1'
parallel_workers = '4'              # Max parallel workers per query
max_parallel_workers = '16'         # Total parallel workers
max_parallel_workers_per_gather = '4'

# Autovacuum
autovacuum = 'on'
autovacuum_max_workers = '5'        # Increased from default 3
autovacuum_naptime = '30s'
autovacuum_vacuum_threshold = '500'
autovacuum_vacuum_scale_factor = '0.01'     # More aggressive than default 0.2
autovacuum_vacuum_cost_limit = '2000'       # Higher cost limit for faster vacuum
autovacuum_vacuum_cost_delay = '10ms'       # Lower delay for faster vacuum
autovacuum_analyze_threshold = '250'
autovacuum_analyze_scale_factor = '0.005'   # More frequent analyze

# Logging (for pg_stat_statements and slow query log)
log_min_duration_statement = '500ms'        # Log queries > 500ms
log_checkpoints = 'on'
log_connections = 'off'                     # Too noisy for production
log_disconnections = 'off'
log_lock_waits = 'on'                       # Log lock waits > deadlock_timeout
log_temp_files = '0'                        # Log all temp file usage
log_autovacuum_min_duration = '1000ms'      # Log autovacuum taking > 1s

# Statement Timeout
statement_timeout = '30000ms'               # 30s query timeout
idle_in_transaction_session_timeout = '60000ms' # 60s idle tx timeout
lock_timeout = '10000ms'                    # 10s lock wait timeout

# SSL
ssl = 'on'
ssl_cert_file = '/etc/ssl/certs/server.crt'
ssl_key_file = '/etc/ssl/private/server.key'
ssl_ca_file = '/etc/ssl/certs/ca.crt'
```

### 2.3 Pgbouncer Configuration

```ini
# pgbouncer.ini — Transaction Mode Pooling

[databases]
tzahu_crm = host=localhost port=5432 dbname=tzahu_crm

[pgbouncer]
listen_addr = 0.0.0.0
listen_port = 6432
auth_type = scram-sha-256
auth_file = /etc/pgbouncer/userlist.txt

# Pool Configuration
pool_mode = transaction              # Transaction pooling (recommended for Django)
default_pool_size = 25               # Active connections per pool
max_client_conn = 1000               # Max client connections (incoming)
max_db_connections = 50              # Max connections to PostgreSQL (critical!)
max_user_connections = 0             # Per-user limit (0 = disabled)
server_idle_timeout = 300            # Close backend conns after 300s idle
client_idle_timeout = 600            # Close client conns after 600s idle
query_timeout = 30                   # Max query execution time
query_wait_timeout = 30              # Max time a client waits for a connection
idle_transaction_timeout = 60        # Max idle time within a transaction

# TLS
client_tls_sslmode = require
server_tls_sslmode = require

# Logging
log_connections = 1
log_disconnections = 1
stats_period = 60                    # Reset stats every 60s
verbose = 0

# Timeouts
server_lifetime = 3600               # Restart server conn after 1 hour
server_connect_timeout = 10          # Connection timeout
pkt_buf = 4096
listen_backlog = 128
sbuf_loopcnt = 5
suspend_timeout = 10
```

### 2.4 Connection Pooling Strategy

```
Client (Django) → Pgbouncer → PostgreSQL

Layer 1: Django ORM Connection Pool
- CONN_MAX_AGE = 60 (keep connections alive for 60 seconds)
- Thread-safe: each thread reuses same connection

Layer 2: Pgbouncer Transaction Pool
- pool_mode = transaction
- Connections are returned to pool after each transaction
- Max 50 connections to PostgreSQL for 1000 concurrent HTTP requests
- Effectively a 20:1 connection ratio (1000 HTTP : 50 DB)

Layer 3: PostgreSQL native
- max_connections = 200 (includes Pgbouncer + admin connections)
- superuser_reserved_connections = 5

Connection flow:
1. Django handler creates DB cursor (opens transaction)
2. Pgbouncer assigns a pooled connection (or queues)
3. Transaction completes, Pgbouncer returns connection to pool
4. Next request reuses the same backend connection
```

### 2.5 Read Replica Setup

```sql
-- Primary: tzahu-crm-db-primary (us-east-1a)
-- Replica: tzahu-crm-db-replica-1 (us-east-1b)
-- Replica: tzahu-crm-db-replica-2 (us-east-1c)
-- DR Replica: tzahu-crm-db-dr (us-west-2)

-- Streaming replication configuration (replica)
-- primary_conninfo = 'host=primary.tzahu.internal port=5432 user=replicator password=**** sslmode=require'
-- primary_slot_name = 'replica_1'

-- Application routing:
-- WRITE: primary.tzahu.internal:6432 (Pgbouncer → primary)
-- READ: replica.tzahu.internal:6432 (Pgbouncer → replicas, round-robin)
-- REPORTS: replica.tzahu.internal:6432
-- CELERY: replica.tzahu.internal:6432 (read-only tasks)

-- Django database routers:
class PrimaryRouter:
    def db_for_read(self, model, **hints):
        return 'default'  # Read from primary by default

class ReplicaRouter:
    def db_for_read(self, model, **hints):
        return 'replica'  # Read from replica

# Usage: apply routers to specific models or viewsets
# For reporting/analytics endpoints: replica
# For transactional endpoints: primary
```

### 2.6 WAL Archiving

```bash
# pgBackRest configuration (/etc/pgbackrest/pgbackrest.conf)
[main]
pg1-path=/var/lib/postgresql/16/main
pg1-port=5432

[global]
repo1-path=/backups/postgresql
repo1-retention-full=30           # 30 daily full backups
repo1-retention-diff=14           # 14 differential backups
repo1-s3-bucket=tzahu-db-backups
repo1-s3-region=us-east-1
repo1-s3-endpoint=s3.amazonaws.com
repo1-type=s3
compress-type=zst                 # Zstandard compression
compress-level=6

# Schedule (via cron/systemd timer):
# 00:00 UTC — Full backup daily
# 06:00, 12:00, 18:00 UTC — Differential backup
# Continuous — WAL archiving (every 5 minutes or on segment switch)

# Archive command (in postgresql.conf):
# archive_command = 'pgbackrest --stanza=main archive-push %p'
```

### 2.7 Vacuum Strategy

```sql
-- Custom vacuum configuration per table based on workload
-- Heavy-write tables (activity, audit, workflow_execution):
ALTER TABLE activity_activity SET (autovacuum_vacuum_scale_factor = 0.005);
ALTER TABLE activity_activity SET (autovacuum_analyze_scale_factor = 0.0025);

-- Large append-only tables (audit_log):
ALTER TABLE audit_auditlog SET (autovacuum_vacuum_scale_factor = 0.001);
ALTER TABLE audit_auditlog SET (autovacuum_vacuum_threshold = 10000);

-- Small read-heavy tables (rbac_role, workflow_definition):
-- Default settings are fine

-- Manual vacuum schedule:
-- Every 1h: VACUUM on high-churn tables
-- Every 24h: VACUUM ANALYZE on all tables
-- Weekly: REINDEX (concurrently) on high-churn indexes

-- Monitoring queries:
-- Table bloat:
SELECT schemaname, tablename, round(bloat_size/1024/1024, 2) AS bloat_mb
FROM pg_settings
CROSS JOIN LATERAL (
    SELECT nspname, relname,
           (pg_total_relation_size(c.oid) - pg_relation_size(c.oid)) AS bloat_size
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE nspname NOT IN ('pg_catalog', 'information_schema')
) AS t
WHERE bloat_size > 100 * 1024 * 1024;  -- Bloat > 100MB
```

---

## 3. Redis

### 3.1 Redis Configuration

```conf
# redis.conf — Production Configuration

# Memory
maxmemory 8gb
maxmemory-policy allkeys-lru      # For cache DB (DB 0)

# Persistence
save ""                           # No RDB snapshots (cache only DBs)
appendonly no                     # No AOF (cache only DBs)
# Note: If using Redis for durable queuing or session storage,
# enable AOF per DB where needed

# Network
bind 0.0.0.0                      # Bind to all interfaces (firewalled)
port 6379
tls-port 6380                     # TLS port
tls-cert-file /etc/redis/tls/redis.crt
tls-key-file /etc/redis/tls/redis.key
tls-ca-cert-file /etc/redis/tls/ca.crt
tls-auth-clients yes

# Security
requirepass '{{ REDIS_PASSWORD }}'
rename-command FLUSHALL ""        # Disable destructive commands
rename-command FLUSHDB ""
rename-command CONFIG ""
rename-command DEBUG ""
rename-command SHUTDOWN ""
rename-command SLAVEOF ""

# Performance
timeout 300
tcp-keepalive 300
tcp-backlog 511
maxclients 10000

# Slow log
slowlog-log-slower-than 10000     # 10ms threshold
slowlog-max-len 128

# AOF (for session/idempotency DBs)
# Set per-DB using ACL or separate instances
appendfsync everysec
auto-aof-rewrite-percentage 100
auto-aof-rewrite-min-size 64mb
```

### 3.2 Key Naming Convention

```
{env}:{db}:{module}:{entity}:{id}

Examples:
prod:0:lead:lead:abc123           # Cache: lead entity
prod:1:ratelimit:api:user_xyz     # Rate limiter
prod:2:session:user_abc           # User session
prod:3:websocket:channel:def      # WebSocket channel
prod:4:idempotency:req_ghi        # Idempotency key
prod:0:report:hash:abc            # Cached report result
prod:0:feat:flags:org_123         # Feature flags for org

Environment prefix:
- dev:{env-var}                    # Development
- staging:{env-var}                # Staging
- prod:{env-var}                   # Production

Redis DB assignment:
DB 0: Cache (allkeys-lru)
DB 1: Rate limiter (noeviction — keys have TTL)
DB 2: Sessions (noeviction — must not evict active sessions)
DB 3: WebSocket channels (noeviction)
DB 4: Idempotency (noeviction — keys have TTL)
DB 5: AI conversation memory (allkeys-lru)
DB 6-15: Reserved for future use
```

### 3.3 Eviction Policies per DB

| DB | Purpose | Eviction Policy | Max Memory | Persistence |
|----|---------|----------------|------------|-------------|
| 0 | Cache | `allkeys-lru` | 6 GB | None |
| 1 | Rate Limiter | `noeviction` | 512 MB | None |
| 2 | Sessions | `noeviction` | 512 MB | AOF everysec |
| 3 | WebSocket | `noeviction` | 256 MB | None |
| 4 | Idempotency | `noeviction` | 256 MB | AOF everysec |
| 5 | AI Memory | `allkeys-lru` | 512 MB | AOF everysec |

Note: DBs with `noeviction` return errors on OOM — keys must have TTLs configured at the application level.

### 3.4 Cluster Mode

For production deployments exceeding single-node capacity (8GB+), deploy Redis in cluster mode:

```
Topology: 3 master nodes (shards), 3 replica nodes
Node 1 (master): 10.0.1.10:6379
Node 1 (replica): 10.0.1.11:6379
Node 2 (master): 10.0.1.12:6379
Node 2 (replica): 10.0.1.13:6379
Node 3 (master): 10.0.1.14:6379
Node 3 (replica): 10.0.1.15:6379

Sharding: 16384 hash slots distributed across 3 master nodes
Replication: Each master has 1 replica (async replication)
Failover: Automatic via Redis Cluster bus (gossip protocol, 30s timeout)
```

**Cluster limitations and workarounds:**

| Limitation | Workaround |
|-----------|------------|
| Multi-key operations only on same slot | Use hash tags `{org_id}:entity:{id}` |
| No multi-DB in cluster (only DB 0) | Use key prefix to separate namespaces |
| Transactional limitations | Lua scripts for atomic operations |
| Client must support cluster | Redis cluster mode enabled in Django/Redis client config |

### 3.5 TLS Encryption

All Redis traffic is encrypted with TLS 1.3:

```
Client (Django/Python) → TLS 1.3 → Redis (port 6380)
Redis Cluster bus → TLS → Redis peers (port 16379)

Certificate management:
- Redis server cert: /etc/redis/tls/redis.crt
- Redis server key: /etc/redis/tls/redis.key
- CA cert: /etc/redis/tls/ca.crt
- Renewal: Automatic via cert-manager (K8s) or Let's Encrypt
```

---

## 4. RabbitMQ

### 4.1 RabbitMQ Configuration

```ini
# rabbitmq.conf — Production Configuration

# Listeners
listeners.tcp.default = 5672
listeners.ssl.default = 5671

# TLS
ssl.options.cacertfile = /etc/rabbitmq/tls/ca.crt
ssl.options.certfile = /etc/rabbitmq/tls/server.crt
ssl.options.keyfile = /etc/rabbitmq/tls/server.key
ssl.options.verify = verify_peer
ssl.options.fail_if_no_peer_cert = false
ssl.options.depth = 2

# Memory
vm_memory_high_watermark.absolute = 4GB
vm_memory_high_watermark_paging_ratio = 0.8

# Disk
disk_free_limit.absolute = 2GB

# Connections
channel_max = 2048
connection_max = 1000
heartbeat = 60

# Queue mirroring (HA)
cluster_partition_handling = pause_minority
queue_master_locator = min-masters

# Management
management.listener.tcp = 15672
management.listener.ssl = 15671
management.load_definitions = /etc/rabbitmq/definitions.json

# Logging
log.level = info
log.file = /var/log/rabbitmq/rabbitmq.log
log.rotate = 7
log.file.size = 100MB

# Authentication
auth_mechanisms = PLAIN SCRAM-SHA-256 SCRAM-SHA-512
```

### 4.2 Vhost and User Permissions

```json
// definitions.json
{
  "vhosts": [
    {"name": "tzahu_prod"},
    {"name": "tzahu_staging"},
    {"name": "tzahu_dev"}
  ],
  "users": [
    {
      "name": "tzahu_app",
      "password_hash": "{{ RABBIT_PASSWORD_HASH }}",
      "tags": ""
    },
    {
      "name": "tzahu_admin",
      "password_hash": "{{ ADMIN_PASSWORD_HASH }}",
      "tags": "administrator"
    },
    {
      "name": "tzahu_monitor",
      "password_hash": "{{ MONITOR_PASSWORD_HASH }}",
      "tags": "monitoring"
    }
  ],
  "permissions": [
    {
      "user": "tzahu_app",
      "vhost": "tzahu_prod",
      "configure": "^$",
      "write": ".*",
      "read": ".*"
    },
    {
      "user": "tzahu_monitor",
      "vhost": "tzahu_prod",
      "configure": "^$",
      "write": "^$",
      "read": ".*"
    }
  ],
  "policies": [
    {
      "vhost": "tzahu_prod",
      "name": "ha-all",
      "pattern": ".*",
      "apply-to": "queues",
      "definition": {
        "ha-mode": "all",
        "ha-sync-mode": "automatic"
      },
      "priority": 0
    },
    {
      "vhost": "tzahu_prod",
      "name": "dlx-config",
      "pattern": ".*",
      "apply-to": "queues",
      "definition": {
        "dead-letter-exchange": "dlx.topic",
        "dead-letter-routing-key": "dlq.{queue_name}"
      },
      "priority": 1
    }
  ]
}
```

### 4.3 Queue Durable Configuration

All Celery task queues are declared as **durable** (survive broker restart), **with DLX** (dead-letter on failure), and **with TTL** for message expiry:

```
Queue: workflow_queue
  Durable: true
  Auto-delete: false
  Exclusive: false
  Arguments:
    x-dead-letter-exchange: dlx.topic
    x-dead-letter-routing-key: dlq.workflow
    x-message-ttl: 3600000       # 1 hour message TTL
    x-max-priority: 10           # Priority queue
    x-queue-mode: lazy           # Lazy queues for large backlogs

Queue: notification_queue
  Durable: true
  Arguments:
    x-dead-letter-exchange: dlx.topic
    x-dead-letter-routing-key: dlq.notification
    x-message-ttl: 86400000      # 24 hour message TTL

Queue: reports_queue
  Durable: true
  Arguments:
    x-dead-letter-exchange: dlx.topic
    x-dead-letter-routing-key: dlq.reports
    x-message-ttl: 86400000

Queue: integrations_queue
  Durable: true
  Arguments:
    x-dead-letter-exchange: dlx.topic
    x-dead-letter-routing-key: dlq.integrations
    x-message-ttl: 86400000

Queue: imports_queue
  Durable: true
  Arguments:
    x-dead-letter-exchange: dlx.topic
    x-dead-letter-routing-key: dlq.imports
    x-message-ttl: 86400000

Queue: default_queue
  Durable: true
  Arguments:
    x-dead-letter-exchange: dlx.topic
    x-dead-letter-routing-key: dlq.default
    x-message-ttl: 3600000

Queue: celery (beat scheduler)
  Durable: true
  Arguments:
    x-dead-letter-exchange: dlx.topic
    x-dead-letter-routing-key: dlq.celery
```

### 4.4 DLX Setup

```
Exchange: dlx.topic (topic type)
  Type: topic
  Durable: true
  Auto-delete: false

DLQ Routing:
  dlq.workflow         → DLQ: dlq_workflow
  dlq.notification     → DLQ: dlq_notification
  dlq.reports          → DLQ: dlq_reports
  dlq.integrations     → DLQ: dlq_integrations
  dlq.imports          → DLQ: dlq_imports
  dlq.default          → DLQ: dlq_default
  dlq.celery           → DLQ: dlq_celery

DLQ Consumer:
  - Dedicated Celery worker monitoring DLQs
  - DLQ messages are logged, alerted, and re-queued manually after investigation
  - DLQ queue depth alert threshold: > 100 messages
  - DLQ message age alert threshold: > 1 hour

DLQ Message Format:
  {
    "original_queue": "workflow_queue",
    "original_routing_key": "lead_management.lead.created",
    "error": "ValueError: invalid status transition",
    "traceback": "...",
    "retry_count": 3,
    "failed_at": "2026-07-27T10:30:00Z",
    "payload": { ... }
  }
```

### 4.5 Queue Mirroring (HA)

```ini
# HA Policy (applied via definitions.json):
# Policy name: ha-all
# Pattern: .*
# Apply to: queues
# Definition:
#   ha-mode: all               # Mirror to all nodes in cluster
#   ha-sync-mode: automatic    # Auto-sync on new node join

# Node topology:
# rabbitmq-0 (master for: workflow, notification)
# rabbitmq-1 (master for: reports, integrations)
# rabbitmq-2 (master for: imports, default)

# Cluster formation:
# rabbitmq-0: discovers rabbitmq-1, rabbitmq-2 via peer discovery (DNS)
# Auto-clustering: rabbitmq-autocluster plugin or K8s StatefulSet DNS

# Failure handling:
# If master node fails, a mirrored slave is promoted (automatic)
# Promotion time: < 1 second (no data loss for durable queues)
# Split-brain: pause_minority partition handling strategy

# Monitoring:
# ha_queue_count: number of HA queues
# ha_slave_count: number of slaves per queue
# ha_sync_status: synchronized/unsynchronized
```

### 4.6 Publisher Confirms and Consumer Prefetch

```python
# Publisher confirms (enable in Celery configuration):
broker_connection_retry_on_startup = True
broker_transport_options = {
    "confirm_publish": True,
    "confirm_timeout": 30.0,       # Wait 30s for broker confirmation
}

# Consumer prefetch (fair dispatch):
worker_prefetch_multiplier = 1     # One message at a time per worker

# Why prefetch = 1:
# - Fair dispatch: workers don't buffer messages
# - Even distribution: busy workers don't hoard messages
# - Reduced memory: no in-memory message buffer
# - Graceful shutdown: no messages lost on worker termination
```

### 4.7 Monitoring (Prometheus + RabbitMQ Management)

```yaml
# RabbitMQ Prometheus metrics (via rabbitmq_prometheus plugin)
# Endpoint: /api/metrics (Prometheus format)
# Scrape interval: 15s

# Key metrics:
rabbitmq_queue_messages_ready{queue="workflow_queue"}      # Queue depth
rabbitmq_queue_messages_unacked{queue="workflow_queue"}    # In-flight
rabbitmq_connections
rabbitmq_channels
rabbitmq_consumers
rabbitmq_queue_messages_published_total
rabbitmq_queue_messages_delivered_total
rabbitmq_queue_messages_dropped_total

# Alerts:
# - queue_messages_ready > 10000    : Queue backlog critical
# - queue_messages_unacked > 1000   : Consumer lag
# - rabbitmq_node_disk_free < 1GB   : Disk space critical
# - rabbitmq_node_mem_used > 80%    : Memory high
# - consumer_count = 0              : No consumers on queue
```

### 4.8 RabbitMQ Topology Summary

```
Domain Events Exchange:  domain_events.topic (topic)
  ├── workflow_queue       — routing: *.lead.*, *.opportunity.*
  ├── notification_queue   — routing: *.lead.created, *.opportunity.won, *.task.assigned
  └── integration_queue    — routing: *.webhook.*, *.sync.*

Celery Task Exchange:     celery (direct) — auto-generated by Celery
  ├── workflow_queue       — Celery tasks: execute_workflow, evaluate_conditions
  ├── notification_queue   — Celery tasks: send_email, send_sms, send_push
  ├── reports_queue        — Celery tasks: generate_report, export_data
  ├── integrations_queue   — Celery tasks: sync_contacts, sync_events
  ├── imports_queue        — Celery tasks: import_csv, import_xlsx
  └── default_queue        — Celery tasks: misc, cleanup, maintenance

DLX Exchange:             dlx.topic (topic)
  ├── dlq_workflow        — Dead-lettered workflow messages
  ├── dlq_notification    — Dead-lettered notification messages
  ├── dlq_reports         — Dead-lettered report messages
  ├── dlq_integrations    — Dead-lettered integration messages
  ├── dlq_imports         — Dead-lettered import messages
  └── dlq_default         — Dead-lettered default messages
```

---

## 5. Celery

### 5.1 Celery Configuration

```python
# config/celery.py

from celery import Celery
from kombu import Exchange, Queue

app = Celery("tzahu_crm")
app.config_from_object("django.conf:settings", namespace="CELERY")

# Settings (in Django settings):
CELERY_BROKER_URL = "amqps://tzahu_app:****@rabbitmq.tzahu.internal:5671/tzahu_prod"
CELERY_RESULT_BACKEND = "redis://:****@redis.tzahu.internal:6380/0"
CELERY_RESULT_EXTENDED = True          # Include task name, args, kwargs in result

CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_COMPRESSION = "gzip"       # Compress task payloads
CELERY_MESSAGE_COMPRESSION = "gzip"    # Compress messages on wire

CELERY_TASK_TRACK_STARTED = True       # Track started tasks
CELERY_TASK_SOFT_TIME_LIMIT = 30       # Soft timeout: 30 seconds for most tasks
CELERY_TASK_TIME_LIMIT = 35            # Hard timeout: 35 seconds
CELERY_TASK_ACKS_LATE = True           # Ack after task completes (at-least-once)
CELERY_TASK_REJECT_ON_WORKER_LOST = True  # Reject if worker dies

CELERY_WORKER_PREFETCH_MULTIPLIER = 1  # Fair dispatch
CELERY_WORKER_MAX_TASKS_PER_CHILD = 1000  # Restart after 1000 tasks (memory leak prevention)
CELERY_WORKER_MAX_MEMORY_PER_CHILD = 200000  # 200MB memory limit per child
CELERY_WORKER_CONCURRENCY = 4          # Default concurrency

CELERY_WORKER_SEND_TASK_EVENTS = True  # Enable task events (for Flower)
CELERY_TASK_SEND_SENT_EVENT = True     # Send sent event

# Result backend settings
CELERY_RESULT_BACKEND_TRANSPORT_OPTIONS = {
    "max_connections": 20,
    "socket_timeout": 5,
}
CELERY_TASK_RESULT_EXPIRES = 86400     # Keep results for 24 hours

# Beat schedule
CELERY_BEAT_SCHEDULER = "django_celery_beat.schedulers:DatabaseScheduler"
```

### 5.2 Queue Definitions

```python
# Queue definitions
CELERY_TASK_QUEUES = [
    Queue(
        "workflow",
        Exchange("workflow", type="direct"),
        routing_key="workflow",
        queue_arguments={
            "x-queue-type": "classic",
            "x-dead-letter-exchange": "dlx.topic",
            "x-dead-letter-routing-key": "dlq.workflow",
        },
    ),
    Queue(
        "notification",
        Exchange("notification", type="direct"),
        routing_key="notification",
        queue_arguments={
            "x-dead-letter-exchange": "dlx.topic",
            "x-dead-letter-routing-key": "dlq.notification",
        },
    ),
    Queue(
        "reports",
        Exchange("reports", type="direct"),
        routing_key="reports",
        queue_arguments={
            "x-dead-letter-exchange": "dlx.topic",
            "x-dead-letter-routing-key": "dlq.reports",
        },
    ),
    Queue(
        "integrations",
        Exchange("integrations", type="direct"),
        routing_key="integrations",
        queue_arguments={
            "x-dead-letter-exchange": "dlx.topic",
            "x-dead-letter-routing-key": "dlq.integrations",
        },
    ),
    Queue(
        "imports",
        Exchange("imports", type="direct"),
        routing_key="imports",
        queue_arguments={
            "x-dead-letter-exchange": "dlx.topic",
            "x-dead-letter-routing-key": "dlq.imports",
        },
    ),
    Queue(
        "default",
        Exchange("default", type="direct"),
        routing_key="default",
        queue_arguments={
            "x-dead-letter-exchange": "dlx.topic",
            "x-dead-letter-routing-key": "dlq.default",
        },
    ),
]

CELERY_TASK_ROUTES = {
    "workflow.tasks.*": {"queue": "workflow"},
    "notification.tasks.*": {"queue": "notification"},
    "reports.tasks.*": {"queue": "reports"},
    "integrations.tasks.*": {"queue": "integrations"},
    "imports.tasks.*": {"queue": "imports"},
    "*.tasks.*": {"queue": "default"},
}

CELERY_TASK_DEFAULT_QUEUE = "default"
CELERY_TASK_DEFAULT_EXCHANGE = "default"
CELERY_TASK_DEFAULT_ROUTING_KEY = "default"
```

### 5.3 Worker Configuration per Queue

```yaml
# Docker Compose / K8s Deployment

workflow-worker:
  command: celery -A config worker -Q workflow -c 4 --loglevel=info
  resources:
    requests: { cpu: "500m", memory: "512Mi" }
    limits: { cpu: "1000m", memory: "1Gi" }
  env:
    CELERY_WORKER_PREFETCH_MULTIPLIER: 1
    CELERY_WORKER_MAX_TASKS_PER_CHILD: 1000

notification-worker:
  command: celery -A config worker -Q notification -c 8 -P gevent --loglevel=info
  resources:
    requests: { cpu: "500m", memory: "512Mi" }
    limits: { cpu: "1000m", memory: "1Gi" }
  # -P gevent: I/O-bound tasks (email, SMS, push)
  # Concurrency 8: 8 greenlets per worker

reports-worker:
  command: celery -A config worker -Q reports -c 2 --loglevel=info
  resources:
    requests: { cpu: "1000m", memory: "1Gi" }
    limits: { cpu: "2000m", memory: "2Gi" }
  # CPU-bound: report generation, data aggregation
  # Lower concurrency, higher memory

integrations-worker:
  command: celery -A config worker -Q integrations -c 4 -P gevent --loglevel=info
  resources:
    requests: { cpu: "500m", memory: "512Mi" }
    limits: { cpu: "1000m", memory: "1Gi" }
  # I/O-bound: API calls to external services
  # Gevent for concurrent HTTP requests

imports-worker:
  command: celery -A config worker -Q imports -c 2 --loglevel=info
  resources:
    requests: { cpu: "500m", memory: "1Gi" }
    limits: { cpu: "1000m", memory: "2Gi" }
  # I/O + CPU: file parsing, validation, bulk insert
  # Higher memory for file processing

default-worker:
  command: celery -A config worker -Q default -c 4 --loglevel=info
  resources:
    requests: { cpu: "250m", memory: "256Mi" }
    limits: { cpu: "500m", memory: "512Mi" }
  # General purpose: cleanup, maintenance, misc
```

### 5.4 Concurrency Model

| Queue | Concurrency Pool | Concurrency | Rationale |
|-------|-----------------|-------------|-----------|
| workflow | `prefork` (processes) | 4 | CPU + I/O mix: condition evaluation + DB writes |
| notification | `gevent` (greenlets) | 8 | I/O-bound: HTTP/STMP calls to SendGrid, Twilio |
| reports | `prefork` (processes) | 2 | CPU-bound: data aggregation, CSV/PDF generation |
| integrations | `gevent` (greenlets) | 4 | I/O-bound: HTTP API calls, OAuth token refresh |
| imports | `prefork` (processes) | 2 | CPU + I/O: file parsing + DB bulk inserts |
| default | `prefork` (processes) | 4 | General purpose |

### 5.5 Task Serialization

```python
# JSON serialization with custom serializer for complex types
from celery import serializer
from shared_kernel.identifiers.uuid7 import uuid7

class UUIDSerializer:
    """Custom JSON serializer for UUID types."""

    def __init__(self):
        self._json = serializer.registry.get("json")

    def dumps(self, data):
        def encode(obj):
            if isinstance(obj, UUID):
                return {"__uuid__": str(obj)}
            if isinstance(obj, datetime):
                return {"__datetime__": obj.isoformat()}
            if isinstance(obj, Decimal):
                return {"__decimal__": str(obj)}
            return obj
        return self._json.dumps(data, default=encode)

    def loads(self, data):
        def decode(obj):
            if "__uuid__" in obj:
                return UUID(obj["__uuid__"])
            if "__datetime__" in obj:
                from django.utils import timezone
                return timezone.datetime.fromisoformat(obj["__datetime__"])
            if "__decimal__" in obj:
                return Decimal(obj["__decimal__"])
            return obj
        return self._json.loads(data, object_hook=decode)
```

### 5.6 Rate Limits per Queue

```python
# Rate limits for task execution
CELERY_TASK_RATE_LIMITS = {
    "notification.tasks.send_email": "10/m",       # 10 emails per minute per worker
    "notification.tasks.send_sms": "5/m",          # 5 SMS per minute per worker
    "integrations.tasks.sync_contacts": "2/m",     # 2 syncs per minute per connector
    "workflow.tasks.execute_workflow": "50/m",     # 50 workflow executions per minute
    "integrations.tasks.send_webhook": "30/m",     # 30 webhook calls per minute
    "imports.tasks.process_csv": "5/m",            # 5 imports per minute
}

# These are enforced by Celery's built-in rate limiting mechanism.
# For per-tenant rate limits, use Redis-backed token bucket in the task itself.
```

### 5.7 Beat Schedule

```python
# Periodic tasks (managed via django-celery-beat database scheduler)
# Default tasks created in data migrations:

CELERY_BEAT_SCHEDULE = {
    "cleanup_expired_sessions": {
        "task": "identity.tasks.cleanup_expired_sessions",
        "schedule": crontab(hour=2, minute=0),  # Daily at 2 AM UTC
    },
    "process_dead_letter_queue": {
        "task": "infrastructure.tasks.process_dead_letter_queue",
        "schedule": crontab(hour="*/2", minute=0),  # Every 2 hours
    },
    "refresh_materialized_views": {
        "task": "reports.tasks.refresh_materialized_views",
        "schedule": crontab(hour=3, minute=0),  # Daily at 3 AM UTC
    },
    "sync_pending_integrations": {
        "task": "integrations.tasks.sync_pending_integrations",
        "schedule": crontab(minute="*/15"),  # Every 15 minutes
    },
    "update_lead_scores": {
        "task": "ai.tasks.update_lead_scores",
        "schedule": crontab(hour=4, minute=0),  # Daily at 4 AM UTC
    },
    "cleanup_old_audit_logs": {
        "task": "audit.tasks.cleanup_old_audit_logs",
        "schedule": crontab(hour=1, minute=0, day_of_month=1),  # Monthly
    },
}
```

### 5.8 Flower Monitoring

```yaml
# Flower deployment (K8s)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: flower
spec:
  replicas: 1
  selector:
    matchLabels:
      app: flower
  template:
    spec:
      containers:
      - name: flower
        image: mher/flower:2.0
        args:
          - --broker=amqps://tzahu_app:****@rabbitmq.tzahu.internal:5671/tzahu_prod
          - --broker_api=https://tzahu_monitor:****@rabbitmq.tzahu.internal:15671/api/
          - --url_prefix=/flower
          - --port=5555
          - --auth_provider=flower.views.auth.GithubLoginHandler
          - --oauth2_key={{ GITHUB_CLIENT_ID }}
          - --oauth2_secret={{ GITHUB_CLIENT_SECRET }}
          - --oauth2_redirect_uri=https://flower.tzahu.com/flower/login
        resources:
          requests: { cpu: "100m", memory: "128Mi" }
          limits: { cpu: "250m", memory: "256Mi" }
        livenessProbe:
          httpGet:
            path: /flower/healthcheck
            port: 5555
```

---

## 6. MinIO

### 6.1 MinIO Architecture

```yaml
# Distributed MinIO deployment (4 nodes, erasure coding)
# Node topology:
# minio-0: us-east-1a
# minio-1: us-east-1b
# minio-2: us-east-1c
# minio-3: us-east-1a (2nd drive)

# Erasure coding: Reed-Solomon (8 data + 4 parity)
# Storage tolerance: up to 4 drives/node failures
# Data durability: 99.999999999% (11 nines)

# Endpoint: https://minio.tzahu.internal:9000
# Console: https://minio-console.tzahu.internal:9001
```

### 6.2 Bucket Layout

```
tzahu-media/          # User-uploaded files (public/authenticated access)
  /{org_id}/
    avatars/
    attachments/
    documents/
    reports/
    recordings/        # Voice AI call recordings
    imports/           # Bulk import files

tzahu-static/         # Static assets (public)
  /css/
  /js/
  /images/
  /fonts/

tzahu-backups/        # Database and file backups (internal access only)
  /postgresql/
  /redis/
  /rabbitmq/

tzahu-data-exports/   # GDPR/compliance exports (internal access only)
  /{org_id}/
```

### 6.3 Tenant Isolation Strategy

**No bucket-per-tenant** — all tenants share `tzahu-media` bucket with folder prefix:

```
Rationale:
- S3 bucket limits: 100 buckets per account by default (soft limit 1000)
- Cannot scale to thousands of tenants with per-tenant buckets
- Folder prefix provides logical isolation with minimal overhead
- RLS-equivalent enforcement at the application level + IAM path restriction

Storage path pattern:
/media/{org_id}/{entity_type}/{entity_id}/{filename}

Example:
/media/org_abc123/lead_attachments/lead_uuid_v7/proposal.pdf

Access enforcement:
1. File upload middleware validates org_id from JWT
2. File download middleware validates org_id from URL path
3. MinIO IAM policy restricts access to /media/{org_id}/* per credential
4. Presigned URLs scoped to specific object paths
```

### 6.4 Encryption

```yaml
# Encryption at rest
# Method: SSE-S3 (AES-256) — MinIO manages encryption keys
# All buckets: enabled by default
# Additional envelope encryption for PII content

# Encryption in transit
# TLS 1.3 required for all MinIO endpoints
# mTLS for inter-node communication (MinIO internal)

# KMS integration (optional, for HIPAA compliance)
# MinIO + HashiCorp Vault KMS
# Vault transit engine: AES-256-GCM
# Auto-unseal: Vault
```

### 6.5 Retention Policies

```yaml
# Object Lock / Retention
# Bucket: tzahu-audit-logs
#   Retention mode: GOVERNANCE
#   Retention period: 7 years (regulatory compliance)
#   Cannot be deleted or overwritten during retention period

# Bucket: tzahu-media
#   Retention mode: NONE (standard)
#   No retention lock for user-uploaded files

# Legal hold:
# - Applied per-object for litigation/discovery
# - Overrides retention period
# - Only removed by compliance admin
```

### 6.6 Lifecycle Policies

```yaml
# Lifecycle rules per bucket prefix

tzahu-media/imports/:
  - Expire after 7 days (clean up old import files)

tzahu-media/recordings/:
  - Transition to S3 Glacier (or MinIO cold) after 90 days
  - Expire after 7 years

tzahu-media/reports/:
  - Expire after 30 days (reports can be regenerated)

tzahu-backups/:
  - Transition to S3 Glacier Deep Archive after 30 days
  - Expire after 1 year

tzahu-data-exports/:
  - Expire after 14 days
  - Notify user before expiry
```

### 6.7 Gateway Mode (S3 Compatibility)

```yaml
# MinIO runs in distributed mode (not gateway mode)
# S3 compatibility is native — MinIO implements the S3 API natively
# All S3 SDK clients work with MinIO without modification

# For AWS S3 as backend (Hybrid scenario):
# Use MinIO gateway mode only when:
# - Need S3-compatible caching layer in front of AWS S3
# - Need local storage for edge locations
# - Transitioning from on-prem to cloud

# Default: Standalone distributed MinIO cluster
```

---

## 7. Django

### 7.1 Settings Split (Base/Dev/Staging/Prod)

```
config/
├── settings/
│   ├── __init__.py          # Points to base or environment-specific
│   ├── base.py              # Shared settings (all environments)
│   ├── dev.py               # Development overrides
│   ├── staging.py           # Staging overrides
│   └── prod.py              # Production overrides
├── urls.py
├── wsgi.py
├── asgi.py
└── celery.py
```

**Base settings (base.py):**
```python
# config/settings/base.py
from pathlib import Path
import environ

env = environ.Env()
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Security
SECRET_KEY = env("SECRET_KEY")
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=["*"])
CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS", default=[])

# Databases
DATABASES = {
    "default": env.db_url(
        "DATABASE_URL",
        default="postgres://tzahu:password@localhost:6432/tzahu_crm",
    ),
    "replica": env.db_url(
        "DATABASE_REPLICA_URL",
        default=None,
    ),
}
DATABASES["default"]["CONN_MAX_AGE"] = env.int("DB_CONN_MAX_AGE", default=60)
DATABASES["default"]["OPTIONS"] = {
    "options": "-c statement_timeout=30000",
}

# Redis
REDIS_URL = env("REDIS_URL", default="redis://:password@localhost:6380/0")
CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": REDIS_URL,
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
            "PASSWORD": env("REDIS_PASSWORD", default=""),
            "SOCKET_CONNECT_TIMEOUT": 5,
            "SOCKET_TIMEOUT": 5,
            "COMPRESSOR": "django_redis.compressors.zlib.ZlibCompressor",
        },
        "KEY_PREFIX": env("CACHE_KEY_PREFIX", default="tzahu"),
        "TIMEOUT": 300,
    },
    "sessions": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": env("REDIS_SESSION_URL", default="redis://:password@localhost:6380/2"),
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
        },
    },
}

# Celery
CELERY_BROKER_URL = env("RABBITMQ_URL", default="amqp://tzahu:password@localhost:5672/tzahu_dev")
CELERY_RESULT_BACKEND = env("REDIS_RESULT_URL", default="redis://:password@localhost:6380/0")

# MinIO / S3
AWS_ACCESS_KEY_ID = env("MINIO_ACCESS_KEY", default="")
AWS_SECRET_ACCESS_KEY = env("MINIO_SECRET_KEY", default="")
AWS_STORAGE_BUCKET_NAME = env("MINIO_BUCKET", default="tzahu-media")
AWS_S3_ENDPOINT_URL = env("MINIO_ENDPOINT", default="http://localhost:9000")
AWS_S3_REGION_NAME = env("AWS_REGION", default="us-east-1")
AWS_S3_SIGNATURE_VERSION = "s3v4"
AWS_DEFAULT_ACL = "private"
AWS_QUERYSTRING_AUTH = True
AWS_QUERYSTRING_EXPIRE = 3600  # 1 hour presigned URL

# Storage
STORAGES = {
    "default": {"BACKEND": "storages.backends.s3.S3Storage"},
    "staticfiles": {"BACKEND": "storages.backends.s3.S3Storage"},
}

# Middleware
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    # Custom middleware
    "infrastructure.middleware.RequestLoggingMiddleware",
    "infrastructure.middleware.TenantMiddleware",
    "infrastructure.middleware.RateLimitMiddleware",
    "infrastructure.middleware.OpenTelemetryMiddleware",
]

# REST Framework
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "infrastructure.auth.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "infrastructure.auth.TenantAwarePermission",
    ],
    "DEFAULT_PAGINATION_CLASS": "infrastructure.pagination.CursorPagination",
    "DEFAULT_PAGE_SIZE": 20,
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_THROTTLE_CLASSES": [
        "infrastructure.throttling.TenantRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "100/hour",
        "user": "1000/hour",
        "tenant": "10000/hour",
    },
    "EXCEPTION_HANDLER": "infrastructure.exceptions.custom_exception_handler",
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],
}
```

**Production overrides (prod.py):**
```python
# config/settings/prod.py
from .base import *

DEBUG = False
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31536000  # 1 year
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_BROWSER_XSS_FILTER = True
X_FRAME_OPTIONS = "DENY"

# Security headers via Gunicorn/Nginx, but also Django-level
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
USE_X_FORWARDED_HOST = True
USE_X_FORWARDED_PORT = True

STATIC_ROOT = None  # S3-backed
MEDIA_ROOT = None   # S3-backed

# Logging
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "json": {
            "()": "structlog.stdlib.JSONRenderer",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "json",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO",
    },
    "loggers": {
        "django": {"handlers": ["console"], "level": "INFO", "propagate": False},
        "django.security": {"handlers": ["console"], "level": "WARNING"},
        "celery": {"handlers": ["console"], "level": "INFO"},
    },
}

# Rate limiting
CACHES["rate_limit"] = {
    "BACKEND": "django_redis.cache.RedisCache",
    "LOCATION": env("REDIS_RATE_LIMIT_URL", default="redis://:password@localhost:6380/1"),
    "OPTIONS": {"CLIENT_CLASS": "django_redis.client.DefaultClient"},
}

# Session
SESSION_ENGINE = "django.contrib.sessions.backends.cache"
SESSION_CACHE_ALIAS = "sessions"
SESSION_COOKIE_AGE = 86400 * 7  # 7 days
SESSION_COOKIE_HTTPONLY = True
```

### 7.2 Environment Variables

```bash
# Required environment variables (production):

# Django
SECRET_KEY=xxx                          # 50+ random characters
ALLOWED_HOSTS=.tzahu.com,api.tzahu.com
CORS_ALLOWED_ORIGINS=https://app.tzahu.com,https://*.tzahu.com
DJANGO_SETTINGS_MODULE=config.settings.prod

# Database
DATABASE_URL=postgres://tzahu:xxx@pgbouncer:6432/tzahu_crm
DATABASE_REPLICA_URL=postgres://tzahu:xxx@pgbouncer-replica:6432/tzahu_crm

# Redis
REDIS_URL=redis://:xxx@redis:6380/0
REDIS_SESSION_URL=redis://:xxx@redis:6380/2
REDIS_RATE_LIMIT_URL=redis://:xxx@redis:6380/1
REDIS_RESULT_URL=redis://:xxx@redis:6380/0

# RabbitMQ
RABBITMQ_URL=amqps://tzahu_app:xxx@rabbitmq:5671/tzahu_prod

# MinIO/S3
MINIO_ENDPOINT=https://minio.tzahu.internal:9000
MINIO_ACCESS_KEY=xxx
MINIO_SECRET_KEY=xxx
MINIO_BUCKET=tzahu-media
AWS_REGION=us-east-1

# AI Gateway
AI_GATEWAY_URL=http://ai-gateway:8000
OPENAI_API_KEY=xxx
ANTHROPIC_API_KEY=xxx

# Email
EMAIL_BACKEND=anymail.backends.sendgrid.EmailBackend
SENDGRID_API_KEY=xxx
DEFAULT_FROM_EMAIL=noreply@tzahu.com

# Sentry
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx

# External services
TWILIO_ACCOUNT_SID=xxx
TWILIO_AUTH_TOKEN=xxx
SLACK_CLIENT_ID=xxx
SLACK_CLIENT_SECRET=xxx
STRIPE_SECRET_KEY=xxx
STRIPE_WEBHOOK_SECRET=xxx
```

### 7.3 Caching Framework

```python
# Caching service abstraction (in infrastructure/)
from django.core.cache import cache as default_cache
from django.core.cache import caches


class CacheService:
    """Unified caching interface with tenant-scoped keys."""

    def __init__(self, alias: str = "default"):
        self._cache = caches[alias]

    def _key(self, key: str, tenant_id: str | None = None) -> str:
        """Build tenant-scoped cache key."""
        if tenant_id:
            return f"{tenant_id}:{key}"
        return key

    def get(self, key: str, default=None, tenant_id: str | None = None):
        actual_key = self._key(key, tenant_id)
        return self._cache.get(actual_key, default)

    def set(self, key: str, value, timeout: int = 300, tenant_id: str | None = None):
        actual_key = self._key(key, tenant_id)
        self._cache.set(actual_key, value, timeout)

    def delete(self, key: str, tenant_id: str | None = None):
        actual_key = self._key(key, tenant_id)
        self._cache.delete(actual_key)

    def get_or_set(self, key: str, get_value_func, timeout: int = 300, tenant_id: str | None = None):
        actual_key = self._key(key, tenant_id)
        value = self._cache.get(actual_key)
        if value is None:
            value = get_value_func()
            if value is not None:
                self._cache.set(actual_key, value, timeout)
        return value

    def delete_pattern(self, pattern: str, tenant_id: str | None = None):
        """Delete all keys matching a pattern (use with caution in production)."""
        import redis
        client = self._cache.client.get_client()
        actual_pattern = self._key(pattern, tenant_id)
        cursor = 0
        while True:
            cursor, keys = client.scan(cursor=cursor, match=actual_pattern, count=100)
            if keys:
                client.delete(*keys)
            if cursor == 0:
                break
```

### 7.4 Session Backend

```python
# Session configuration (in settings):
SESSION_ENGINE = "django.contrib.sessions.backends.cache"
SESSION_CACHE_ALIAS = "sessions"  # Uses Redis DB 2
SESSION_COOKIE_AGE = 604800       # 7 days
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SECURE = True
SESSION_COOKIE_SAMESITE = "Lax"
SESSION_SAVE_EVERY_REQUEST = False  # Only save when modified
SESSION_EXPIRE_AT_BROWSER_CLOSE = False
```

### 7.5 Static/Media File Handling

```python
# Static files (served via CDN → MinIO)
STATIC_URL = f"{AWS_S3_ENDPOINT_URL}/{AWS_STORAGE_BUCKET_NAME}/static/"
STATICFILES_STORAGE = "storages.backends.s3.S3Storage"
STATICFILES_DIRS = [BASE_DIR / "static"]
STATIC_ROOT = None  # Not used (S3 backend)

# Media files (served via presigned URLs)
MEDIA_URL = f"{AWS_S3_ENDPOINT_URL}/{AWS_STORAGE_BUCKET_NAME}/media/"
DEFAULT_FILE_STORAGE = "storages.backends.s3.S3Storage"

# File upload validation
FILE_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024  # 10MB
DATA_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024   # 10MB
DATA_UPLOAD_MAX_NUMBER_FIELDS = 1000

# Allowed file extensions (per entity type)
ALLOWED_FILE_EXTENSIONS = {
    "lead_attachments": [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".jpg", ".png", ".txt"],
    "contact_avatars": [".jpg", ".jpeg", ".png", ".gif", ".webp"],
    "report_exports": [".pdf", ".csv", ".xlsx"],
    "import_files": [".csv", ".xlsx", ".json"],
}

# File size limits per plan tier
FILE_SIZE_LIMITS = {
    "free": 5 * 1024 * 1024,        # 5MB
    "growth": 25 * 1024 * 1024,     # 25MB
    "enterprise": 100 * 1024 * 1024, # 100MB
}
```

### 7.6 Logging Configuration

```python
# config/settings/base.py

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
        structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
    ],
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "json": {
            "()": structlog.stdlib.ProcessorFormatter,
            "processor": structlog.processors.JSONRenderer(),
        },
        "console": {
            "()": structlog.stdlib.ProcessorFormatter,
            "processor": structlog.dev.ConsoleRenderer(),
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "console" if DEBUG else "json",
        },
    },
    "loggers": {
        "django": {"handlers": ["console"], "level": "INFO"},
        "django.request": {"handlers": ["console"], "level": "WARNING"},
        "django.db.backends": {"handlers": ["console"], "level": "WARNING"},
        "celery": {"handlers": ["console"], "level": "INFO"},
        "celery.worker.strategy": {"handlers": ["console"], "level": "WARNING"},
        "": {"handlers": ["console"], "level": "INFO"},
    },
}
```

---

## 8. Nginx

### 8.1 Reverse Proxy Configuration

```nginx
# /etc/nginx/nginx.conf — Main configuration

user nginx;
worker_processes auto;
pid /var/run/nginx.pid;
worker_rlimit_nofile 65535;

events {
    worker_connections 8192;
    use epoll;
    multi_accept on;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Basic settings
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    keepalive_requests 1000;
    server_tokens off;
    types_hash_max_size 2048;

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_min_length 256;
    gzip_types
        text/plain
        text/css
        text/javascript
        application/javascript
        application/json
        application/xml
        image/svg+xml
        font/woff
        font/woff2;

    # Client max body size
    client_max_body_size 50M;
    client_body_buffer_size 128k;

    # Timeouts
    proxy_connect_timeout 30;
    proxy_send_timeout 60;
    proxy_read_timeout 60;

    # Rate limiting zones
    limit_req_zone $binary_remote_addr zone=api_rate:10m rate=100r/s;
    limit_req_zone $http_x_tenant_id zone=tenant_rate:10m rate=500r/s;
    limit_conn_zone $binary_remote_addr zone=addr:10m;

    # Upstreams
    upstream django_backend {
        least_conn;
        server django:8000 max_fails=3 fail_timeout=10s;
        keepalive 32;
    }

    upstream ai_gateway {
        least_conn;
        server ai-gateway:8000 max_fails=3 fail_timeout=10s;
        keepalive 16;
    }

    # Server blocks
    include /etc/nginx/conf.d/*.conf;
}
```

### 8.2 Server Block (TLS Termination)

```nginx
# /etc/nginx/conf.d/tzahu.conf

# HTTP → HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    server_name *.tzahu.com api.tzahu.com;
    return 301 https://$host$request_uri;
}

# Main HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name api.tzahu.com;

    # TLS
    ssl_certificate /etc/nginx/ssl/tzahu.crt;
    ssl_certificate_key /etc/nginx/ssl/tzahu.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:50m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;
    ssl_stapling on;
    ssl_stapling_verify on;
    resolver 8.8.8.8 8.8.4.4 valid=300s;
    resolver_timeout 5s;

    # HSTS
    add_header Strict-Transport-Security "max-age=63072000" always;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy strict-origin-when-cross-origin;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://api.tzahu.com wss://api.tzahu.com;";

    # Rate limiting
    limit_req zone=api_rate burst=200 nodelay;
    limit_req zone=tenant_rate burst=500 nodelay;
    limit_conn addr 10;

    # Location: API
    location /api/ {
        proxy_pass http://django_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        proxy_buffering off;

        # CORS preflight
        if ($request_method = OPTIONS) {
            add_header Access-Control-Allow-Origin $http_origin;
            add_header Access-Control-Allow-Methods "GET, POST, PUT, PATCH, DELETE, OPTIONS";
            add_header Access-Control-Allow-Headers "Authorization, Content-Type, X-Tenant-ID";
            add_header Access-Control-Allow-Credentials true;
            add_header Content-Length 0;
            add_header Content-Type text/plain;
            return 204;
        }
    }

    # Location: Admin
    location /admin/ {
        proxy_pass http://django_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Location: AI Gateway
    location /ai/ {
        rewrite ^/ai/(.*) /$1 break;
        proxy_pass http://ai_gateway;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_cache off;

        # Streaming support (SSE)
        proxy_set_header Connection '';
        chunked_transfer_encoding on;
        proxy_read_timeout 120s;
    }

    # Location: WebSocket
    location /ws/ {
        proxy_pass http://django_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }

    # Location: Health check
    location /health/ {
        proxy_pass http://django_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache off;
    }

    # Static files (served via MinIO/S3, cached by CloudFront)
    location /static/ {
        proxy_pass https://minio.tzahu.internal:9000/tzahu-media/static/;
        proxy_http_version 1.1;
        proxy_set_header Host minio.tzahu.internal;
        proxy_set_header X-Real-IP $remote_addr;

        # Long cache for immutable assets
        location ~* \.(css|js|jpg|jpeg|png|gif|ico|woff2?|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
            access_log off;
        }
    }

    # Media files (authenticated, presigned URLs)
    location /media/ {
        # This is just a fallback — media files are served via presigned URLs
        # directly from MinIO. This location handles legacy direct URLs.
        return 301 https://minio.tzahu.internal:9000/tzahu-media$request_uri;
    }

    # Flower (Celery monitoring)
    location /flower/ {
        proxy_pass http://flower:5555;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        auth_basic "Flower Monitoring";
        auth_basic_user_file /etc/nginx/.htpasswd;
    }

    # Access and error logs
    access_log /var/log/nginx/tzahu_access.log combined buffer=512k flush=1m;
    error_log /var/log/nginx/tzahu_error.log warn;
}
```

### 8.3 Rate Limiting Configuration

```nginx
# Rate limiting zones (defined in nginx.conf):
# limit_req_zone $binary_remote_addr zone=api_rate:10m rate=100r/s;
# limit_req_zone $http_x_tenant_id zone=tenant_rate:10m rate=500r/s;

# Per-endpoint rate limits:
location /api/v1/auth/ {
    limit_req zone=api_rate burst=50 nodelay;
    # Auth endpoints: 100 req/s burst 50
}

location /api/v1/leads/ {
    limit_req zone=api_rate burst=200 nodelay;
    limit_req zone=tenant_rate burst=500 nodelay;
}

location /api/v1/search/ {
    limit_req zone=api_rate burst=50 nodelay;
    # Search is heavier — lower burst
}

location /ai/v1/chat/ {
    limit_req zone=api_rate burst=20 nodelay;
    # AI chat is expensive — conservative rate limit
}

# 429 response:
# error_page 429 /429.html;
# location = /429.html {
#     internal;
#     return 429 '{"error":"rate_limit_exceeded","message":"Too many requests"}';
# }
```

### 8.4 Security Headers

```nginx
# Security headers (applied to all responses):
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;

# Content Security Policy (relaxed for React dev, strict for prod):
# Production:
add_header Content-Security-Policy "
    default-src 'self';
    script-src 'self' 'unsafe-inline' https://js.stripe.com https://cdn.sentry.io;
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    img-src 'self' data: blob: https:;
    font-src 'self' https://fonts.gstatic.com;
    connect-src 'self' https://api.tzahu.com wss://api.tzahu.com https://o*.ingest.sentry.io https://api.stripe.com;
    frame-src https://js.stripe.com;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
" always;
```
