# TZAHU CRM — Scaling Strategy

> **Version:** 0.1.0-draft
> **Last Updated:** 2026-07-27
> **Status:** Foundational Design Phase
> **Owner:** Platform Architecture Team

---

## Table of Contents

1. [Overview](#1-overview)
2. [Horizontal Scaling](#2-horizontal-scaling)
3. [Vertical Scaling](#3-vertical-scaling)
4. [Database Scaling](#4-database-scaling)
5. [Caching Scaling](#5-caching-scaling)
6. [Multi-Region](#6-multi-region)
7. [K8s Scaling](#7-k8s-scaling)
8. [Scaling Triggers](#8-scaling-triggers)

---

## 1. Overview

The scaling strategy defines how TZAHU CRM grows from a single-tenant prototype through multi-tenant production to global multi-region deployment. Each scaling phase corresponds to a stage in the product roadmap, with infrastructure investments made just-in-time.

### 1.1 Scaling Phases

```
Phase 1-2  (Launch):   1 PostgreSQL instance, 1 Redis, 1 RabbitMQ, 2-4 Django pods
Phase 3-5  (Growth):   Read replicas, Redis cluster, RabbitMQ HA, HPA, Pgbouncer
Phase 6-8  (Scale):    Database partitioning, sharding prep, multi-region replicas
Phase 9-11 (Global):   Multi-region active-active, CitusDB sharding, global CDN
```

---

## 2. Horizontal Scaling

### 2.1 Django Stateless Replicas (HPA)

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: django-api
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: django-api
  minReplicas: 4
  maxReplicas: 12
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
    - type: Pods
      pods:
        metric:
          name: http_requests_per_second
        target:
          type: AverageValue
          averageValue: 500
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
        - type: Pods
          value: 2
          periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Pods
          value: 1
          periodSeconds: 120
```

**Stateless Design:**
- Session state stored in Redis (not local memory)
- File uploads go directly to MinIO via presigned URLs
- Cache is distributed via Redis (no local cache for production-critical data)
- Celery tasks reference data by ID, not by in-memory reference
- Any pod can handle any request at any time

### 2.2 Celery Worker Pools (HPA)

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: celery-workflow
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: celery-workflow
  minReplicas: 2
  maxReplicas: 8
  metrics:
    - type: External
      external:
        metric:
          name: rabbitmq_queue_messages_ready
          selector:
            matchLabels:
              queue: workflow_queue
        target:
          type: AverageValue
          averageValue: 500  # Scale when >500 messages waiting
```

| Queue | Min | Max | Metric | Target |
|-------|-----|-----|--------|--------|
| workflow | 2 | 8 | Queue depth | 500 |
| notification | 2 | 8 | Queue depth | 1000 |
| reports | 1 | 4 | Queue depth | 100 |
| integrations | 2 | 6 | Queue depth | 500 |
| imports | 1 | 4 | Queue depth | 50 |
| default | 2 | 6 | Queue depth | 500 |

### 2.3 AI Gateway Replicas (HPA)

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: ai-gateway
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ai-gateway
  minReplicas: 2
  maxReplicas: 6
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 60
    - type: External
      external:
        metric:
          name: ai_gateway_requests_in_flight
        target:
          type: AverageValue
          averageValue: 50
```

---

## 3. Vertical Scaling

### 3.1 PostgreSQL Scaling Path

```
1. Single instance (db.r6g.large — 2 vCPU, 16GB)
   ├── 500 orgs, 50M rows, < 100GB
   └── Pgbouncer pools connections

2. Larger instance (db.r6g.xlarge — 4 vCPU, 32GB)
   ├── 2000 orgs, 200M rows, < 500GB
   └── Increase shared_buffers, effective_cache_size

3. Read replicas (db.r6g.large × 2 replicas)
   ├── 5000 orgs, 1B rows, < 1TB
   └── Reporting queries → replicas

4. Partitioning (range partition by created_at)
   ├── 10000 orgs, 5B rows, < 5TB
   └── Audit, activity, vectors partitioned monthly

5. Sharding (CitusDB)
   ├── 50000+ orgs, 50B+ rows, > 10TB
   └── CitusDB distributes data across worker nodes
```

### 3.2 Redis Scaling Path

```
1. Single node (cache.r6g.large — 13GB)
   ├── < 500 orgs, < 10GB cache
   └── maxmemory 8GB, allkeys-lru

2. Larger node (cache.r6g.xlarge — 26GB)
   ├── < 2000 orgs, < 20GB cache
   └── maxmemory 16GB

3. Cluster mode (3 shards × 2 replicas)
   ├── < 10000 orgs, < 50GB cache
   └── 16384 hash slots across shards

4. Cluster scale-out (6 shards × 2 replicas)
   ├── < 50000 orgs, < 200GB cache
   └── Add shards, reshard automatically
```

### 3.3 RabbitMQ Scaling Path

```
1. Single node
   ├── < 1000 orgs
   └── All queues on one node

2. 3-node cluster (HA queue mirroring)
   ├── < 10000 orgs
   └── Queues mirrored across all nodes

3. 5-node cluster
   ├── < 50000 orgs
   └── Higher throughput, better partition tolerance
```

---

## 4. Database Scaling

### 4.1 Read Replicas for Reporting/Analytics

```python
# Database router configuration for read replicas
class DatabaseRouter:
    """Route reads to replicas, writes to primary."""

    # Read-only models (reporting, analytics, dashboards)
    READ_ONLY_APPS = ["reports", "dashboard", "analytics", "audit"]

    def db_for_read(self, model, **hints):
        app_label = model._meta.app_label
        if app_label in self.READ_ONLY_APPS:
            return "replica"
        return "default"

    def db_for_write(self, model, **hints):
        return "default"

    def allow_relation(self, obj1, obj2, **hints):
        return True

    def allow_migrate(self, db, app_label, model_name=None, **hints):
        return db == "default"
```

**Replica lag monitoring:**
```sql
-- Check replica lag
SELECT
    application_name,
    state,
    sync_state,
    pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn) AS lag_bytes,
    EXTRACT(EPOCH FROM NOW() - replay_lag) AS lag_seconds
FROM pg_stat_replication;
```

### 4.2 Connection Pooling (Pgbouncer)

```ini
# Scaling Pgbouncer:
# - Each Django pod runs a local Pgbouncer sidecar OR
# - Deploy Pgbouncer as a standalone service (recommended at scale)

# Standalone Pgbouncer deployment:
# 3 Pgbouncer instances behind a TCP load balancer
# Stateless — any instance can handle any connection
# max_db_connections = 50 per instance → 150 total DB connections

# Connection scaling:
# 4 Django pods × 4 workers = 16 processes
# 16 processes × 1 connection = 16 concurrent DB connections
# Pgbouncer pools 16 → 50 (waits if > 50)
# DB max_connections = 200 (includes admin + monitoring)
```

### 4.3 Partitioning for Large Tables

```sql
-- Partitioning strategy for high-volume tables

-- Audit log: partition by month
CREATE TABLE audit_auditlog (
    id UUID NOT NULL,
    organization_id UUID NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE TABLE audit_auditlog_2026_01 PARTITION OF audit_auditlog
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE audit_auditlog_2026_02 PARTITION OF audit_auditlog
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

-- Activity: partition by month
CREATE TABLE activity_activity (
    id UUID NOT NULL,
    organization_id UUID NOT NULL,
    lead_id UUID,
    activity_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- RAG vectors: partition by org_id hash (if > 10M vectors)
CREATE TABLE rag_vectors_partitioned (
    id UUID NOT NULL,
    organization_id UUID NOT NULL,
    content TEXT,
    embedding vector(1536),
    created_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (id, organization_id)
) PARTITION BY HASH (organization_id);

CREATE TABLE rag_vectors_p0 PARTITION OF rag_vectors_partitioned
    FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE rag_vectors_p1 PARTITION OF rag_vectors_partitioned
    FOR VALUES WITH (MODULUS 4, REMAINDER 1);
CREATE TABLE rag_vectors_p2 PARTITION OF rag_vectors_partitioned
    FOR VALUES WITH (MODULUS 4, REMAINDER 2);
CREATE TABLE rag_vectors_p3 PARTITION OF rag_vectors_partitioned
    FOR VALUES WITH (MODULUS 4, REMAINDER 3);
```

### 4.4 Sharding (CitusDB) for Extreme Scale

```sql
-- CitusDB distributed tables (Phase 11+)
-- Distribution column: organization_id (hash-distributed)

SELECT create_distributed_table('lead_management_leads', 'organization_id');
SELECT create_distributed_table('pipeline_management_opportunities', 'organization_id');
SELECT create_distributed_table('activity_activity', 'organization_id');

-- Reference tables (replicated to all nodes):
SELECT create_reference_table('pipeline_management_pipelines');
SELECT create_reference_table('rbac_roles');
SELECT create_reference_table('organization_organizations');

-- Co-located joins (same distribution column → local joins):
-- leads + opportunities + activity are co-located by organization_id
-- Queries within an org are local (no cross-shard)
```

---

## 5. Caching Scaling

### 5.1 Redis Cluster Mode

```yaml
# Redis Cluster (3 master + 3 replica)
# Deployed as K8s StatefulSet with headless service

apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: redis-cluster
spec:
  serviceName: redis-cluster-headless
  replicas: 6  # 3 masters + 3 replicas
  template:
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        command: ["redis-server"]
        args:
          - "--cluster-enabled yes"
          - "--cluster-config-file nodes.conf"
          - "--cluster-node-timeout 5000"
          - "--appendonly yes"
          - "--appendfsync everysec"
          - "--maxmemory 8gb"
          - "--maxmemory-policy allkeys-lru"

# Client connects to any node; cluster redirects to correct shard
# Django Redis client: RedisCluster client with startup_nodes
```

### 5.2 Cache Sharding per Entity Type

```
Entity sharding ensures that a single cache node failure only affects
a subset of entity types, not all cached data.

Shard 1 (lead, contact, account):     Master: redis-0, Replica: redis-3
Shard 2 (opportunity, pipeline):      Master: redis-1, Replica: redis-4
Shard 3 (activity, task):             Master: redis-2, Replica: redis-5

Key distribution:
- {shard:1}:v1:{org}:lead:{id}        → Redis node 0
- {shard:2}:v1:{org}:opportunity:{id} → Redis node 1
- {shard:3}:v1:{org}:activity:{id}    → Redis node 2
```

### 5.3 Local + Distributed Cache

```python
class TieredCache:
    """L1: Process-local (Django LocMemCache), L2: Distributed (Redis)."""

    def __init__(self):
        self.local_timeout = 10     # 10 seconds local
        self.redis_timeout = 300    # 5 minutes distributed

    def get(self, key: str, default=None):
        # L1: Local memory (nanoseconds if hit)
        value = local_cache.get(key)
        if value is not None:
            return value

        # L2: Redis (milliseconds if hit)
        value = redis_cache.get(key)
        if value is not None:
            local_cache.set(key, value, self.local_timeout)
            return value

        return default

    def set(self, key: str, value, timeout: int | None = None):
        timeout = timeout or self.redis_timeout
        redis_cache.set(key, value, timeout)
        local_cache.set(key, value, self.local_timeout)
```

---

## 6. Multi-Region

### 6.1 Architecture

```
                         Route53 (Latency-based routing)
                              │
              ┌───────────────┼───────────────┐
              │               │               │
              ▼               ▼               ▼
       ┌────────────┐  ┌────────────┐  ┌────────────┐
       │  us-east-1  │  │  eu-west-1 │  │  ap-south-1│
       │ (Primary)   │  │ (Read-only)│  │ (Read-only)│
       └──────┬──────┘  └──────┬─────┘  └──────┬─────┘
              │                │                │
       ┌──────┴──────┐  ┌──────┴──────┐  ┌──────┴──────┐
       │ Django      │  │ Django      │  │ Django      │
       │ Replicas    │  │ Replicas    │  │ Replicas    │
       └──────┬──────┘  └──────┬──────┘  └──────┬──────┘
              │                │                │
       ┌──────┴──────┐  ┌──────┴──────┐  ┌──────┴──────┐
       │ PG Primary  │  │ PG Replica  │  │ PG Replica  │
       │ + pgvector  │◄─┤ (streaming) │◄─┤ (streaming) │
       └──────┬──────┘  └─────────────┘  └─────────────┘
              │
       ┌──────┴──────┐
       │ DR: us-west-2│
       │ PG Replica   │
       │ (async repl) │
       └─────────────┘
```

### 6.2 Read Replicas in Secondary Regions

```sql
-- Primary region: us-east-1 (write)
-- Secondary replicas: eu-west-1, ap-south-1, us-west-2 (DR)

-- Streaming replication chain:
-- us-east-1 (primary) → us-west-2 (sync replica, DR)
-- us-east-1 (primary) → eu-west-1 (async replica)
-- us-east-1 (primary) → ap-south-1 (async replica)

-- Application routing:
-- Writes always go to us-east-1 primary
-- Reads go to nearest replica based on Route53 latency
-- Reporting queries go to local replica
```

### 6.3 Write-to-Primary Pattern

```python
class DatabaseRouter:
    """Route writes to primary region, reads to local replica."""

    def db_for_read(self, model, **hints):
        # Use local replica for reads
        return "local_replica"

    def db_for_write(self, model, **hints):
        # All writes go to primary
        return "default"

    def allow_relation(self, obj1, obj2, **hints):
        return True
```

### 6.4 Replication Lag Monitoring

```sql
-- Critical: Lag > 60 seconds (alert)
-- Warning: Lag > 10 seconds (notify)
-- Normal: Lag < 1 second

SELECT
    application_name,
    state,
    pg_size_pretty(
        pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn)
    ) AS lag,
    EXTRACT(EPOCH FROM NOW() - pg_last_xact_replay_timestamp()) AS lag_seconds
FROM pg_stat_replication;
```

### 6.5 DNS-Based Routing (Route53)

```terraform
# Route53 latency-based routing policy
resource "aws_route53_record" "api" {
  zone_id = aws_route53_zone.tzahu.zone_id
  name    = "api.tzahu.com"
  type    = "A"

  latency_routing_policy {
    region = "us-east-1"
  }
  set_identifier = "us-east-1"
  alias {
    name                   = aws_lb.us_east_1.dns_name
    zone_id                = aws_lb.us_east_1.zone_id
    evaluate_target_health = true
  }
}
```

### 6.6 Cross-Region Failover

```yaml
# Failover procedure:
# 1. Route53 health check detects primary region is down
# 2. DNS TTL 60s → clients switch to next-best region
# 3. Promote DR replica (us-west-2) to primary
# 4. Update application connection strings
# 5. Re-point replicas to new primary
#
# Total failover time: < 5 minutes
# RPO: < 5 minutes (async replication)
# RTO: < 30 minutes (full failover)
```

---

## 7. K8s Scaling

### 7.1 HPA Configurations per Service

```yaml
# Django API
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: django-api
spec:
  minReplicas: 4
  maxReplicas: 12
  metrics:
    - resource: { name: cpu, target: { type: Utilization, averageUtilization: 70 } }
    - resource: { name: memory, target: { type: Utilization, averageUtilization: 80 } }
    - pods: { metric: { name: http_requests_per_second }, target: { type: AverageValue, averageValue: 500 } }

# AI Gateway
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: ai-gateway
spec:
  minReplicas: 2
  maxReplicas: 6
  metrics:
    - resource: { name: cpu, target: { type: Utilization, averageUtilization: 60 } }
    - external: { metric: { name: ai_gateway_queue_depth }, target: { type: AverageValue, averageValue: 50 } }

# Celery Workflow Worker
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: celery-workflow
spec:
  minReplicas: 2
  maxReplicas: 8
  metrics:
    - external: { metric: { name: rabbitmq_queue_messages_ready, selector: { matchLabels: { queue: workflow_queue } } }, target: { type: AverageValue, averageValue: 500 } }
```

### 7.2 PDB for Availability During Rolling Updates

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: django-api-pdb
spec:
  minAvailable: 3       # At least 3 pods always available
  selector:
    matchLabels:
      app: django-api

---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: celery-workflow-pdb
spec:
  maxUnavailable: 1     # At most 1 pod unavailable
  selector:
    matchLabels:
      app: celery-workflow
```

### 7.3 Cluster Autoscaler

```yaml
# Cluster Autoscaler configuration
# Scales K8s node group when pods are pending (unschedulable)

nodeGroups:
  - name: tzahu-ondemand
    minSize: 3
    maxSize: 10
    instanceType: m6i.large     # 2 vCPU, 8GB
    labels:
      node-type: application

  - name: tzahu-spot
    minSize: 0
    maxSize: 20
    instanceType: m6i.large     # 2 vCPU, 8GB
    spot: true
    labels:
      node-type: spot

  - name: tzahu-database
    minSize: 1
    maxSize: 3
    instanceType: r6i.large     # 2 vCPU, 16GB
    labels:
      node-type: database
```

### 7.4 Node Groups (On-Demand + Spot)

```yaml
# Pod scheduling: critical services use on-demand, batch use spot

# Django API: on-demand (must not be preempted)
# Celery workers: on-demand (reliability critical)
# AI Gateway: on-demand (latency-sensitive)
# Celery batch tasks: spot (fault-tolerant, can restart)
# Periodic jobs: spot (fault-tolerant)
# Staging/Dev: 100% spot (cost optimization)

nodeAffinity:
  requiredDuringSchedulingIgnoredDuringExecution:
    nodeSelectorTerms:
    - matchExpressions:
      - key: node-type
        operator: In
        values:
        - ondemand    # or spot
```

---

## 8. Scaling Triggers

### 8.1 Trigger Matrix

| Trigger | Metric | Threshold | Action | Service |
|---------|--------|-----------|--------|---------|
| CPU | cpu_utilization | > 70% | Scale up | Django, AI Gateway |
| Memory | memory_utilization | > 80% | Scale up | Django, AI Gateway |
| Queue depth | rabbitmq_queue_depth | > 1000 | Scale up workers | Celery (all queues) |
| Queue depth | rabbitmq_queue_depth | < 100 | Scale down workers | Celery (all queues) |
| Latency | p95_response_time | > 500ms | Scale up | Django |
| Latency | p95_response_time | > 1000ms | Scale up + investigate | Django |
| Request rate | http_requests_per_second | > 500 per pod | Scale up | Django |
| In-flight requests | http_requests_in_flight | > 100 per pod | Scale up | Django, AI Gateway |

### 8.2 Cooldown Periods

| Direction | Service | Cooldown | Rationale |
|-----------|---------|----------|-----------|
| Scale up | Django | 60s | Quick to handle traffic spikes |
| Scale down | Django | 300s | Avoid thrashing (5 min cooldown) |
| Scale up | Celery | 60s | Quick queue drain |
| Scale down | Celery | 300s | Allow queue to stabilize |
| Scale up | AI Gateway | 60s | Handle LLM request bursts |
| Scale down | AI Gateway | 300s | Avoid frequent scaling |

### 8.3 Predictive Scaling (Future)

```yaml
# Predictive scaling based on historical patterns
# Daily patterns: high 9-5 local time, low overnight
# Weekly patterns: high Tue-Thu, low weekends
# Monthly patterns: high end-of-quarter

# Implementation: Use K8s Vertical Pod Autoscaler (VPA) + custom metrics
# or AWS Predictive Scaling for production
```
