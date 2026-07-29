# TZAHU CRM — Disaster Recovery

> **Version:** 0.1.0-draft
> **Last Updated:** 2026-07-27
> **Status:** Foundational Design Phase
> **Owner:** Platform Architecture Team

---

## Table of Contents

1. [Overview](#1-overview)
2. [DR Strategy](#2-dr-strategy)
3. [Regional Failure](#3-regional-failure)
4. [Multi-Region Architecture](#4-multi-region-architecture)
5. [Data Replication](#5-data-replication)
6. [Failover Procedure](#6-failover-procedure)
7. [Failback Procedure](#7-failback-procedure)
8. [DR Drill](#8-dr-drill)
9. [RTO and RPO](#9-rto-and-rpo)

---

## 1. Overview

The Disaster Recovery strategy ensures that TZAHU CRM can survive a regional outage, catastrophic infrastructure failure, or data corruption event. The strategy follows an active-passive model with warm standby, designed to meet the RTO of 30 minutes and RPO of 5 minutes.

### 1.1 DR Scope

| Component | Primary | DR | DR Type |
|-----------|---------|----|---------|
| Django API | us-east-1 | us-west-2 | Active-Passive (warm standby) |
| Celery Workers | us-east-1 | us-west-2 | Active-Passive (cold) |
| AI Gateway | us-east-1 | us-west-2 | Active-Passive (warm standby) |
| PostgreSQL | us-east-1 (primary) | us-west-2 (async replica) | Warm standby |
| Redis | us-east-1 (cluster) | us-west-2 (standby) | Backup restore |
| RabbitMQ | us-east-1 (HA cluster) | us-west-2 (new cluster) | Rebuild from definitions |
| MinIO | us-east-1 (distributed) | us-west-2 (replica) | Active replica |

### 1.2 DR Deployment Diagram

```
Normal Operations:
  us-east-1 (Active)
  ├── Django (4-12 pods)
  ├── Celery (2-8 per queue)
  ├── AI Gateway (2-6 pods)
  ├── PostgreSQL (Primary)
  ├── Redis (Cluster)
  ├── RabbitMQ (3-node HA)
  └── MinIO (4-node distributed)
       │
       │ Async Replication
       ▼
  us-west-2 (Standby)
  ├── Django (2 pods, minimum)
  ├── AI Gateway (1 pod)
  ├── PostgreSQL (Async replica)
  ├── Redis (Backup only)
  └── MinIO (Replica)

During Failover:
  us-west-2 (Active)
  ├── Django (scaled to 4-12)
  ├── Celery (scaled to 2-8 per queue)
  ├── AI Gateway (scaled to 2-6)
  ├── PostgreSQL (Promoted to primary)
  ├── Redis (Rebuilt from backup)
  ├── RabbitMQ (New cluster)
  └── MinIO (Promoted to active)
```

---

## 2. DR Strategy

### 2.1 Active-Passive Model

The primary region (us-east-1) handles all production traffic. The DR region (us-west-2) runs a minimal set of services in standby mode, ready to be scaled up on failover.

| Service | Primary | DR (Normal) | DR (Failover) |
|---------|---------|-------------|---------------|
| Django API | 4-12 pods | 2 pods (warm) | Scale to 4-12 |
| Celery | 2-8 per queue | 0 pods (cold) | Start workers |
| AI Gateway | 2-6 pods | 1 pod (warm) | Scale to 2-6 |
| PostgreSQL | Primary | Async replica | Promote to primary |
| Redis | 3-node cluster | AOF backup | Restore from backup |
| RabbitMQ | 3-node HA | None | Deploy new cluster |
| MinIO | 4-node | Replica | Promote to active |
| Route53 | Alias to primary | Passive | Switch to DR |

### 2.2 Warm Standby for Critical Services

```yaml
# DR region runs minimum viable infrastructure:
# Django API: 2 pods (low resource, just keeping the pods warm)
# AI Gateway: 1 pod (for reduced functionality if needed)
# PostgreSQL: Async replica (fully synced, not accepting writes)
# MinIO: Replica (fully synced via S3 replication)

# Cost optimization: RDS replica in DR region, reserved instances
# Scale-to-zero for non-critical: Celery workers, batch jobs
```

---

## 3. Regional Failure

### 3.1 Regional Failure Scenarios

| Scenario | Detection | Impact | Response |
|----------|-----------|--------|----------|
| AWS availability zone failure | Route53 health check fails | Partial service degradation | K8s spreads pods across AZs automatically |
| us-east-1 region failure | All AZs in region fail | Complete service outage | Full DR failover to us-west-2 |
| Network partition | Replication lag spikes | Writes succeed, reads stale | No failover (wait for recovery) |
| Data corruption | Application errors | Data integrity risk | PITR from backup (not DR) |

### 3.2 DNS Switch to Secondary Region

```terraform
# Route53 DNS configuration for failover
resource "aws_route53_record" "api_tzahu" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "api.tzahu.com"
  type    = "A"

  failover_routing_policy {
    type = "PRIMARY"
  }
  set_identifier = "api-us-east-1"
  alias {
    name                   = aws_lb.us_east_1.dns_name
    zone_id                = aws_lb.us_east_1.zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "api_tzahu_dr" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "api.tzahu.com"
  type    = "A"

  failover_routing_policy {
    type = "SECONDARY"
  }
  set_identifier = "api-us-west-2"
  alias {
    name                   = aws_lb.us_west_2.dns_name
    zone_id                = aws_lb.us_west_2.zone_id
    evaluate_target_health = true
  }
}
```

### 3.3 Promote Read Replicas to Primary

```sql
-- On DR region PostgreSQL replica:

-- 1. Stop replication
SELECT pg_promote();

-- 2. Verify promotion
SELECT pg_is_in_recovery();  -- false

-- 3. Enable connections (was in hot standby mode)
ALTER SYSTEM SET max_connections = 400;
SELECT pg_reload_conf();

-- 4. Enable WAL archiving for new primary
ALTER SYSTEM SET archive_mode = on;
SELECT pg_reload_conf();
```

### 3.4 Update Connection Strings

The failover automation updates Kubernetes secrets and environment variables:

```bash
# Update Django connection strings for DR region
kubectl patch secret db-credentials \
    -n tzahu-prod \
    --patch='{"data":{"DATABASE_URL":"'$(echo -n "postgres://tzahu:pass@dr-db:5432/tzahu_crm" | base64)'"}}'

# Update Redis connection
kubectl patch secret redis-credentials \
    -n tzahu-prod \
    --patch='{"data":{"REDIS_URL":"'$(echo -n "redis://:pass@dr-redis:6379/0" | base64)'"}}'

# Roll pods to pick up new secrets
kubectl rollout restart deployment django-api -n tzahu-prod
```

---

## 4. Multi-Region Architecture

### 4.1 Primary in us-east-1, DR in us-west-2

```
┌──────────────────────────────────────────────┐
│              Route53 (DNS)                    │
│  api.tzahu.com → us-east-1 (primary)         │
│  api.tzahu.com → us-west-2 (failover)        │
└────────────┬───────────────────────┬─────────┘
             │                       │
             ▼                       ▼
┌──────────────────────┐  ┌──────────────────────┐
│   us-east-1 (PRIMARY) │  │  us-west-2 (DR)      │
│                      │  │                      │
│  ┌────────────────┐  │  │  ┌────────────────┐  │
│  │ EKS Cluster    │  │  │  │ EKS Cluster    │  │
│  │ • Django 4-12  │  │  │  │ • Django 2     │  │
│  │ • Celery 2-8   │  │  │  │ • Celery 0     │  │
│  │ • AI Gateway   │  │  │  │ • AI Gateway 1 │  │
│  │ • RabbitMQ 3   │  │  │  │ • RabbitMQ 0   │  │
│  └────────────────┘  │  │  └────────────────┘  │
│                      │  │                      │
│  ┌────────────────┐  │  │  ┌────────────────┐  │
│  │ RDS PostgreSQL │  │  │  │ RDS PostgreSQL │  │
│  │ (Primary)      │──┼──┼──│ (Async Replica)│  │
│  └────────────────┘  │  │  └────────────────┘  │
│                      │  │                      │
│  ┌────────────────┐  │  │  ┌────────────────┐  │
│  │ ElastiCache    │  │  │  │ S3 Bucket      │  │
│  │ Redis Cluster  │  │  │  │ (Backups only) │  │
│  └────────────────┘  │  │  └────────────────┘  │
│                      │  │                      │
│  ┌────────────────┐  │  │  ┌────────────────┐  │
│  │ S3 (MinIO)     │──┼──┼──│ S3 (DR Replica)│  │
│  │ tzahu-media    │  │  │  │ tzahu-media-dr │  │
│  └────────────────┘  │  │  └────────────────┘  │
└──────────────────────┘  └──────────────────────┘
```

### 4.2 Route53 Health Checks

```terraform
resource "aws_route53_health_check" "api_health" {
  fqdn              = "api.tzahu.com"
  port              = 443
  type              = "HTTPS"
  resource_path     = "/health/"
  failure_threshold = 5           # 5 consecutive failures = unhealthy
  request_interval  = 30          # Check every 30 seconds

  tags = {
    Name = "tzahu-api-health-check"
  }
}

# Alarm on health check failure
resource "aws_cloudwatch_metric_alarm" "api_down" {
  alarm_name          = "tzahu-api-down"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "HealthCheckStatus"
  namespace           = "AWS/Route53"
  period              = "60"
  statistic           = "Minimum"
  threshold           = "1.0"
  alarm_description   = "API health check failed"
  alarm_actions       = [aws_sns_topic.pagerduty.arn]
}
```

### 4.3 Automated Failover

```yaml
# Failover automation (AWS Lambda or Step Functions)
steps:
  - name: CheckHealth
    description: "Verify that primary region is actually down"
    action: Route53 health check status + application health probe
    timeout: 60s

  - name: PromoteDatabase
    description: "Promote DR PostgreSQL replica to primary"
    action: rds promote-read-replica --db-instance-identifier tzahu-dr
    timeout: 300s  # Up to 5 minutes for promotion

  - name: UpdateSecrets
    description: "Update connection strings for DR region"
    action: kubectl patch secrets + rollout restart
    timeout: 120s

  - name: ScaleUpDR
    description: "Scale DR application services"
    action: kubectl scale deployment django-api --replicas=8
    timeout: 120s

  - name: SwitchDNS
    description: "Update Route53 to point to DR region"
    action: Route53 failover routing update
    timeout: 60s

  - name: Verify
    description: "Verify DR region is serving traffic"
    action: curl https://api.tzahu.com/health/ + status check
    timeout: 30s
```

---

## 5. Data Replication

### 5.1 PostgreSQL Streaming Replication to DR

```sql
-- On DR PostgreSQL instance:
-- Configure as streaming replica

-- postgresql.conf (DR replica):
primary_conninfo = 'host=primary.tzahu.internal port=5432 user=replicator password=*** sslmode=require'
primary_slot_name = 'dr_replica'
hot_standby = on
hot_standby_feedback = on

-- Monitoring replication lag:
SELECT
    application_name,
    state,
    pg_size_pretty(
        pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn)
    ) AS lag,
    EXTRACT(EPOCH FROM NOW() - pg_last_xact_replay_timestamp()) AS lag_seconds
FROM pg_stat_replication
WHERE application_name = 'dr_replica';
```

### 5.2 S3 Cross-Region Replication

```yaml
# S3 replication configuration
ReplicationConfiguration:
  Role: arn:aws:iam::account:role/s3-replication-role
  Rules:
    - Id: "tzahu-media-replication"
      Status: Enabled
      Priority: 1
      Filter:
        Prefix: ""  # All objects
      Destination:
        Bucket: arn:aws:s3:::tzahu-media-dr
        StorageClass: STANDARD
      SourceSelectionCriteria:
        SseKmsEncryptedObjects:
          Status: Enabled
      DeleteMarkerReplication:
        Status: Disabled  # Don't replicate deletes
```

### 5.3 Redis Backup Restore in DR

```bash
# Redis is NOT replicated in real-time to DR.
# Instead, we restore from the most recent backup.

# 1. Download latest backup
aws s3 cp s3://tzahu-redis-backups/redis_dump_latest.rdb /data/dump.rdb

# 2. Start Redis with the backup
redis-server --dbfilename dump.rdb --dir /data

# 3. For AOF-based DBs (sessions, idempotency):
aws s3 cp s3://tzahu-redis-backups/redis_aof_latest.aof /data/appendonly.aof
redis-server --appendonly yes --appendfilename appendonly.aof --dir /data

# RPO for Redis: maximum 1 hour (backup frequency)
# RTO for Redis: approximately 10 minutes (download + AOF replay)
```

---

## 6. Failover Procedure

### 6.1 Automated Failover

```yaml
# Failover is triggered when:
# 1. Route53 health check fails for 5 consecutive checks (150 seconds)
# 2. CloudWatch alarm "api-down" fires
# 3. PagerDuty incident acknowledged but not resolved within 10 minutes

# Automated failover steps (AWS Step Functions):
```

```json
{
  "Comment": "TZAHU CRM Failover to DR Region",
  "StartAt": "ValidatePrimaryFailure",
  "States": {
    "ValidatePrimaryFailure": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:validate-primary-failure",
      "Next": "PromoteDatabase",
      "TimeoutSeconds": 60
    },
    "PromoteDatabase": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:promote-dr-database",
      "Next": "UpdateSecrets",
      "TimeoutSeconds": 300,
      "Retry": [
        { "ErrorEquals": ["PromotionFailed"], "IntervalSeconds": 30, "MaxAttempts": 3 }
      ]
    },
    "UpdateSecrets": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:update-dr-secrets",
      "Next": "ScaleUpDR",
      "TimeoutSeconds": 120
    },
    "ScaleUpDR": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:scale-dr-services",
      "Next": "SwitchDNS",
      "TimeoutSeconds": 180
    },
    "SwitchDNS": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:switch-dns-to-dr",
      "Next": "VerifyDR",
      "TimeoutSeconds": 60
    },
    "VerifyDR": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:verify-dr-health",
      "End": true,
      "TimeoutSeconds": 30
    }
  }
}
```

### 6.2 Manual Failover (for Planned Maintenance)

```bash
#!/bin/bash
# Manual failover procedure for planned maintenance

set -euo pipefail

echo "=== Phase 1: Pre-Failover Checks ==="
# 1. Verify DR resources are ready
kubectl --context=us-west-2 get nodes
kubectl --context=us-west-2 get pods -n tzahu-prod

# 2. Verify DR database lag is acceptable
psql -h dr-db -c "SELECT EXTRACT(EPOCH FROM NOW() - pg_last_xact_replay_timestamp()) AS lag_seconds;"

# 3. Notify users (maintenance window)
./scripts/send-maintenance-notification.sh

echo "=== Phase 2: Failover ==="
# 4. Set application to read-only mode
kubectl exec deployment/django-api -- python manage.py maintenance_mode on

# 5. Wait for in-flight requests to complete
sleep 30

# 6. Promote DR database
aws rds promote-read-replica --db-instance-identifier tzahu-dr
echo "Waiting for database promotion..."
sleep 120

# 7. Update DNS
aws route53 change-resource-record-sets --hosted-zone-id ZONEID \
    --change-batch '{"Changes":[{"Action":"UPSERT","ResourceRecordSet":{...}}]}'

echo "=== Phase 3: Verify ==="
# 8. Verify DR is serving traffic
curl -f https://api.tzahu.com/health/

# 9. Scale up DR services
kubectl scale deployment/django-api --replicas=8
kubectl scale deployment/celery-workflow --replicas=4

echo "=== Failover Complete ==="
```

---

## 7. Failback Procedure

### 7.1 Reverse Replication

```sql
-- After primary region recovers, set up reverse replication:

-- On recovered primary (us-east-1):
-- 1. Set up as replica of DR (now primary)
ALTER SYSTEM SET primary_conninfo = 'host=dr-db.internal port=5432 user=replicator password=***';
SELECT pg_reload_conf();

-- 2. Start replication
SELECT pg_start_backup('failback');

-- On DR (us-west-2, current primary):
-- 3. Create replication slot for failback
SELECT pg_create_physical_replication_slot('failback_replica');

-- 4. Verify replication is catching up
SELECT pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn) AS lag
FROM pg_stat_replication WHERE application_name = 'failback_replica';
```

### 7.2 Test Data Consistency

```sql
-- Before switching back, verify data consistency between regions:

-- Compare row counts for critical tables
SELECT 'leads' AS table_name, count(*) FROM lead_management_leads
UNION ALL
SELECT 'contacts', count(*) FROM lead_management_contacts
UNION ALL
SELECT 'opportunities', count(*) FROM pipeline_management_opportunities;

-- Check for any write conflicts during DR period
SELECT count(*) FROM audit_log
WHERE event_type LIKE 'conflict.%'
  AND created_at > '2026-07-27T14:00:00Z';
```

### 7.3 DNS Switch Back

```bash
#!/bin/bash
# Failback procedure (reverse of failover)

echo "=== Phase 1: Prepare Primary ==="
# 1. Verify primary region is healthy
curl -f https://internal-api.us-east-1.tzahu.com/health/

# 2. Verify replication is caught up
psql -h recovered-primary -c "
    SELECT pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn) < 1000000 AS caught_up
    FROM pg_stat_replication WHERE application_name = 'dr_replica';
"

echo "=== Phase 2: Switch DNS ==="
# 3. Update Route53 to point back to primary
aws route53 change-resource-record-sets --hosted-zone-id ZONEID \
    --change-batch '{"Changes":[{"Action":"UPSERT","ResourceRecordSet":{...}}]}'

echo "=== Phase 3: Restore Services ==="
# 4. Set up primary as the primary database
# (Reverse the promotion)

echo "=== Phase 4: Verify ==="
# 5. Verify primary is serving traffic
curl -f https://api.tzahu.com/health/

echo "=== Failback Complete ==="
```

---

## 8. DR Drill

### 8.1 Quarterly Automated Drill

```yaml
# Chaos Engineering / DR Drill Schedule
# Frequency: Quarterly (every 3 months)
# Duration: 2 hours
# Scope: Full failover + failback (non-production hours)

drill:
  name: "Q3 2026 DR Drill"
  date: "2026-09-15 02:00 UTC"
  duration: 2h
  scope:
    - Full failover to us-west-2
    - Verify all services operational
    - Run business transactions
    - Failback to us-east-1
  success_criteria:
    - RTO: failover < 30 minutes
    - RPO: data loss < 5 minutes
    - All critical services operational in DR
    - No data corruption after failback

  scenarios:
    - name: "Regional outage simulation"
      action: "Block network traffic to us-east-1"
      expected: "Automatic failover within 5 minutes"
    - name: "Database corruption"
      action: "Corrupt random rows in production table"
      expected: "PITR restore within 30 minutes"
    - name: "Cache failure"
      action: "Flush all Redis data"
      expected: "Cache self-heals within 10 minutes"
```

### 8.2 Documented Runbook

```markdown
# DR Drill Runbook — Q3 2026

## Pre-Drill Checklist
- [ ] Notify all stakeholders (ops@, #engineering)
- [ ] Verify DR resources are provisioned
- [ ] Take pre-drill database snapshot
- [ ] Verify monitoring and alerting in DR region
- [ ] Assign drill roles (Commander, Operator, Verifier, Scribe)

## Drill Execution
- [ ] 02:00 UTC: Start failover automation
- [ ] 02:05 UTC: Verify database promotion
- [ ] 02:10 UTC: DNS switch to DR
- [ ] 02:15 UTC: Verify API health
- [ ] 02:20 UTC: Run business transaction tests
- [ ] 02:30 UTC: Start failback
- [ ] 02:45 UTC: DNS switch to primary
- [ ] 02:50 UTC: Verify primary health
- [ ] 03:00 UTC: Post-drill review

## Post-Drill Retrospective
- [ ] Review metrics (failover time, data loss, error rate)
- [ ] Identify improvement areas
- [ ] Update runbook with lessons learned
- [ ] Schedule action items
```

### 8.3 Post-Drill Retrospective Template

```markdown
# DR Drill Retrospective — Q3 2026

## Summary
- Date: 2026-09-15
- Duration: 1h 45m (within 2h budget)
- Result: ✅ PASSED (all success criteria met)

## Metrics
| Criterion | Target | Actual | Status |
|-----------|--------|--------|--------|
| Failover RTO | < 30 min | 12 min | ✅ |
| Data Loss (RPO) | < 5 min | 2 min | ✅ |
| API Availability | 100% | 100% | ✅ |
| Transaction Success | 100% | 100% | ✅ |

## Issues Found
1. DNS propagation took 5 minutes (TTL was 300s)
   - Fix: Reduce Route53 TTL to 60s before failover
2. Cache warmup took 8 minutes (target: 5 min)
   - Fix: Pre-compute cache warming list

## Action Items
| Action | Owner | Due Date |
|--------|-------|----------|
| Reduce DNS TTL to 60s | Platform Team | 2026-09-20 |
| Optimize cache warming order | Backend Team | 2026-09-25 |
| Add DR status dashboard | DevOps | 2026-10-01 |
```

---

## 9. RTO and RPO

### 9.1 Recovery Objectives Summary

| Scenario | RTO | RPO | Procedure |
|----------|-----|-----|-----------|
| Single pod failure | 0s | 0 | K8s auto-restart |
| K8s node failure | 60s | 0 | K8s reschedule on healthy node |
| AZ failure | 5 min | 0 | Pods in other AZs handle traffic |
| Region failure (full) | 30 min | 5 min | Full DR failover |
| Data corruption | 60 min | 5 min | PITR from backup |
| Accidental data deletion | 30 min | 5 min | PITR or table-level restore |
| Ransomware (files) | 60 min | 15 min | Restore from versioned S3 |

### 9.2 DR Compliance

| Requirement | Target | Measurement | Evidence |
|-------------|--------|-------------|----------|
| RTO ≤ 30 min | 12 min verified | Quarterly drill | Drill report |
| RPO ≤ 5 min | 2 min verified | WAL archive lag | pg_stat_replication |
| Testing frequency | Quarterly | Calendar | Drill runbook |
| Documentation | Current | Review quarterly | This document |
| Encryption | AES-256 | Backup config | Backup verification |
