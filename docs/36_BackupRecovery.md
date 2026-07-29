# TZAHU CRM — Backup and Recovery

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
5. [MinIO](#5-minio)
6. [File Storage](#6-file-storage)
7. [Backup Verification](#7-backup-verification)
8. [Recovery Procedures](#8-recovery-procedures)
9. [RPO and RTO](#9-rpo-and-rto)

---

## 1. Overview

This document defines the backup and recovery strategy for all TZAHU CRM data stores. The strategy ensures data durability (no permanent data loss) and availability (rapid recovery from failures) while balancing cost and operational complexity.

### 1.1 Backup Principles

- **3-2-1 Rule**: 3 copies, 2 different media, 1 off-site
- **Encryption at rest**: All backups encrypted with AES-256
- **Automated verification**: Backups are automatically restored and verified weekly
- **Immutable backups**: Write-once-read-many (WORM) storage for compliance
- **Retention aligned with compliance**: 30-day daily, 12-month monthly, 7-year annual for audit logs

---

## 2. PostgreSQL

### 2.1 Backup Schedule

| Backup Type | Frequency | Retention | Tool | Storage |
|-------------|-----------|-----------|------|---------|
| Full (physical) | Daily at 00:00 UTC | 30 days | pgBackRest | S3 (tzahu-db-backups) |
| Differential | Every 6 hours | 14 days | pgBackRest | S3 |
| WAL archive | Continuous (every 5 min) | 7 days | pgBackRest | S3 |
| Logical (pg_dump) | Daily at 01:00 UTC | 7 days | pg_dump | S3 (tzahu-db-backups) |
| Monthly full | 1st of each month | 12 months | pgBackRest | S3 Glacier |
| Annual | Jan 1 | 7 years | pgBackRest | S3 Glacier Deep Archive |

### 2.2 pgBackRest Configuration

```ini
# /etc/pgbackrest/pgbackrest.conf

[main]
pg1-path=/var/lib/postgresql/16/main
pg1-port=5432
pg1-user=postgres

[global]
repo1-path=/backups/postgresql
repo1-type=s3
repo1-s3-bucket=tzahu-db-backups
repo1-s3-region=us-east-1
repo1-s3-endpoint=s3.amazonaws.com
repo1-s3-key-type=auto
repo1-retention-full=30
repo1-retention-diff=14
repo1-retention-archive=7
repo1-cipher-type=aes-256-cbc
repo1-cipher-pass={{ BACKREST_CIPHER_PASS }}

compress-type=zst
compress-level=6
process-max=4

# Archive async for minimal WAL write latency
archive-async=y
archive-timeout=60
spool-path=/var/spool/pgbackrest
```

### 2.3 Backup Commands

```bash
# Full backup (daily cron: 0 0 * * *)
pgbackrest --stanza=main --type=full backup

# Differential backup (cron: 0 */6 * * *)
pgbackrest --stanza=main --type=diff backup

# WAL archiving (continuous, triggered by PostgreSQL archive_command)
# archive_command = 'pgbackrest --stanza=main archive-push %p'

# List backups
pgbackrest --stanza=main info

# Verify backup integrity
pgbackrest --stanza=main check
```

### 2.4 pg_dump for Logical Backups

```bash
# Logical backup (schema + data, gzip compressed)
pg_dump \
    --host=localhost \
    --port=6432 \
    --username=tzahu \
    --dbname=tzahu_crm \
    --format=custom \
    --compress=9 \
    --no-owner \
    --verbose \
    --file=/backups/tzahu_crm_$(date +%Y%m%d).dump

# Schema-only backup (for migration/DR testing)
pg_dump \
    --schema-only \
    --file=/backups/tzahu_crm_schema_$(date +%Y%m%d).sql

# Upload to S3
aws s3 cp /backups/tzahu_crm_*.dump s3://tzahu-db-backups/logical/
```

### 2.5 WAL Archiving Configuration

```ini
# postgresql.conf (archive-related settings)
wal_level = replica
archive_mode = on
archive_command = 'pgbackrest --stanza=main archive-push %p'
archive_timeout = 300             # Force segment switch every 5 min
max_wal_size = 8GB
min_wal_size = 2GB
wal_keep_size = 2GB               # Keep extra WAL for replica connections
```

### 2.6 Retention Policy

```
Daily backups:  30 days (1 month of point-in-time recovery)
Monthly backups: 12 months (compliance, audit)
Annual backups:  7 years (regulatory requirement for audit logs)

Lifecycle:
  Day 1-30:    Standard S3 (immediate access)
  Month 1-12:  S3 Standard-IA (infrequent access)
  Year 1-7:    S3 Glacier Deep Archive (cold storage)
  After 7 years: Auto-delete (legal hold exempted)
```

---

## 3. Redis

### 3.1 Persistence Configuration per DB

| DB | Purpose | Persistence | Justification |
|----|---------|-------------|---------------|
| DB 0 | Cache | None | Rebuildable from DB |
| DB 1 | Rate limiter | None | Ephemeral, OK to lose |
| DB 2 | Sessions | AOF everysec | User sessions must survive restart |
| DB 3 | WebSocket channels | None | Ephemeral, reconnected on restart |
| DB 4 | Idempotency keys | AOF everysec | Prevents duplicate processing |
| DB 5 | AI conversation memory | AOF everysec | Preserves in-progress conversations |

### 3.2 RDB Snapshots (Cache)

```conf
# redis.conf (for cache DB 0 only)
# Disable RDB for pure cache
save ""  # No automatic RDB saves

# For mixed-use instances:
save 300 100    # Save if 100+ keys changed in 300s
save 60 10000   # Save if 10000+ keys changed in 60s
```

### 3.3 AOF Configuration (Session/Idempotency DBs)

```conf
# redis.conf (for session DB 2, idempotency DB 4)
appendonly yes
appendfilename "appendonly.aof"
appendfsync everysec          # fsync once per second
auto-aof-rewrite-percentage 100
auto-aof-rewrite-min-size 64mb
aof-load-truncated yes        # Load truncated AOF (last incomplete write)
aof-use-rdb-preamble yes      # RDB + AOF hybrid (faster restart)
```

### 3.4 Redis Backup Procedure

```bash
# 1. Trigger BGSAVE (creates dump.rdb)
redis-cli BGSAVE

# 2. Copy dump.rdb and AOF to backup storage
cp /var/lib/redis/dump.rdb /backups/redis/dump_$(date +%Y%m%d_%H%M%S).rdb
cp /var/lib/redis/appendonly.aof /backups/redis/aof_$(date +%Y%m%d_%H%M%S).aof

# 3. Upload to S3
aws s3 sync /backups/redis/ s3://tzahu-redis-backups/

# 4. Retention: 7 days for AOF, 30 days for RDB
# Cleanup: find /backups/redis/ -mtime +7 -delete
```

### 3.5 Redis Cluster Backup

For Redis Cluster, each master node must be backed up individually. The backup procedure is the same per node:

```bash
# Backup each master node
for node in redis-0 redis-1 redis-2; do
    redis-cli -h $node BGSAVE
    sleep 5  # Wait for BGSAVE to complete
    kubectl cp $node:/data/dump.rdb /backups/redis/${node}_dump.rdb
done
```

**Restore note:** When restoring a Redis Cluster, all nodes must be restored to the same point in time (same RDB/AOF) to maintain cluster consistency. This typically means restoring from the latest full backup across all masters.

---

## 4. RabbitMQ

### 4.1 Queue Definitions Export

```bash
# Export RabbitMQ definitions (queues, exchanges, bindings, users, vhosts)
# This is a JSON file that defines the entire topology

# Automated: daily cron at 02:00 UTC
rabbitmqadmin export /backups/rabbitmq/definitions_$(date +%Y%m%d).json

# Alternative via management API:
curl -u tzahu_admin:password \
    https://rabbitmq:15671/api/definitions \
    > /backups/rabbitmq/definitions_$(date +%Y%m%d).json

# Upload to S3
aws s3 sync /backups/rabbitmq/ s3://tzahu-rabbitmq-backups/definitions/

# Retention: 30 days
```

### 4.2 Message Persistence

```python
# All Celery queues are durable:
# queue_arguments = {"x-queue-type": "classic", "durable": True}

# Messages are persisted to disk:
# - Publisher confirms: enabled (broker_confirm_publish)
# - Durable queues: survive broker restart
# - Persistent messages: delivery_mode = 2

# In a cluster with mirrored queues:
# - All queues mirrored to all nodes (ha-mode: all)
# - If a node fails, messages are available on remaining nodes
# - No message loss on single node failure
```

### 4.3 Queue Mirroring for HA

```ini
# HA Policy (applied to all queues):
# ha-mode: all
# ha-sync-mode: automatic

# This means:
# - Every queue exists on all 3 cluster nodes
# - If one node fails, queues on remaining nodes have all messages
# - New node joins: auto-sync from existing nodes
# - No message loss on single or (n-1)/2 node failures
```

### 4.4 RabbitMQ Backup Procedure

```bash
# RabbitMQ backups are less critical than PostgreSQL because:
# 1. Messages are transient (consumed and acknowledged)
# 2. Durable messages survive node failure via HA mirroring
# 3. Queue definitions can be recreated from code

# However, for completeness:
# 1. Export definitions (daily)
# 2. Backup RabbitMQ database (contains definitions + messages)
#   rabbitmqctl stop_app
#   tar czf /backups/rabbitmq/mnesia_$(date +%Y%m%d).tar.gz /var/lib/rabbitmq/mnesia/
#   rabbitmqctl start_app

# 3. Upload to S3
aws s3 sync /backups/rabbitmq/ s3://tzahu-rabbitmq-backups/
```

---

## 5. MinIO

### 5.1 S3 Replication to Secondary Region

```yaml
# MinIO bucket replication configuration
# Source: tzahu-media (us-east-1)
# Destination: tzahu-media-dr (us-west-2)

replication:
  role: arn:aws:iam::account:role/minio-replication
  rules:
    - id: "cross-region-replication"
      status: Enabled
      priority: 1
      filter:
        prefix: ""      # Replicate all objects
      destination:
        bucket: "arn:aws:s3:::tzahu-media-dr"
        storage_class: STANDARD
      delete_marker_replication: Disabled  # Don't replicate deletes
      source_selection_criteria:
        sse_kms_encrypted_objects:
          status: Enabled
```

### 5.2 Versioning

```yaml
# All MinIO buckets have versioning enabled:
# tzahu-media: Versioning enabled, 30-day version retention
# tzahu-backups: Versioning enabled, 90-day version retention
# tzahu-data-exports: Versioning enabled, 7-day version retention

# Versioning protects against:
# - Accidental deletion (object marked as delete marker)
# - Overwrites (previous version preserved)
# - Ransomware (can restore to pre-encryption version)

# Lifecycle: Expire non-current versions after retention period
```

### 5.3 Lifecycle Policies for Archival

```xml
<!-- MinIO lifecycle configuration -->
<LifecycleConfiguration>
  <Rule>
    <ID>Transition-old-recordings</ID>
    <Filter><Prefix>recordings/</Prefix></Filter>
    <Status>Enabled</Status>
    <Transition>
      <Days>90</Days>
      <StorageClass>GLACIER</StorageClass>
    </Transition>
    <Expiration>
      <Days>2555</Days>  <!-- 7 years -->
    </Expiration>
  </Rule>
  <Rule>
    <ID>Expire-imports</ID>
    <Filter><Prefix>imports/</Prefix></Filter>
    <Status>Enabled</Status>
    <Expiration>
      <Days>7</Days>
    </Expiration>
  </Rule>
  <Rule>
    <ID>Expire-reports</ID>
    <Filter><Prefix>reports/</Prefix></Filter>
    <Status>Enabled</Status>
    <Expiration>
      <Days>30</Days>
    </Expiration>
  </Rule>
  <Rule>
    <ID>Delete-old-versions</ID>
    <Status>Enabled</Status>
    <NoncurrentVersionExpiration>
      <NoncurrentDays>30</NoncurrentDays>
    </NoncurrentVersionExpiration>
  </Rule>
</LifecycleConfiguration>
```

---

## 6. File Storage

### 6.1 Bucket Replication

```yaml
# Primary: tzahu-media (us-east-1, MinIO distributed)
# DR:      tzahu-media-dr (us-west-2, MinIO distributed)

# Replication: asynchronous, cross-region
# RPO: < 15 minutes
# Bandwidth: 1 Gbps (dedicated)

# Encryption: Replicated objects remain encrypted (SSE-S3 → SSE-S3)
# Metadata: All metadata preserved during replication
```

### 6.2 Multi-Region Replication

```
us-east-1 (Primary)
  └── tzahu-media (active)
  └── tzahu-backups (active)

us-west-2 (DR)
  └── tzahu-media-dr (replica, promoted on failover)
  └── tzahu-backups-dr (replica)

eu-west-1 (Read-only)
  └── tzahu-media-eu (replica, read-only)
```

### 6.3 File Consistency Guarantees

| Operation | Consistency | Notes |
|-----------|-------------|-------|
| Upload (write) | Read-after-write | Immediate consistency within region |
| Download (read) | Read-after-write | Eventually consistent across regions |
| Delete | Eventually consistent | Versioning prevents permanent loss |
| List | Eventually consistent | May not reflect latest write (5s delay) |

---

## 7. Backup Verification

### 7.1 Automated Restore Test

```bash
#!/bin/bash
# Weekly verification script (cron: 0 2 * * 0)

# 1. Create test database
createdb tzahu_crm_verify

# 2. Restore latest backup to test database
pgbackrest --stanza=main --db-path=/var/lib/postgresql/16/verify restore

# 3. Run integrity checks
psql -d tzahu_crm_verify -c "SELECT count(*) FROM information_schema.tables;"
psql -d tzahu_crm_verify -c "
    SELECT schemaname, tablename, n_live_tup
    FROM pg_stat_user_tables
    ORDER BY n_live_tup DESC;
"

# 4. Run application-level checksum
python manage.py check_data_integrity --database=verify

# 5. Report results
if [ $? -eq 0 ]; then
    echo "Backup verification PASSED: $(date)"
else
    echo "Backup verification FAILED: $(date)" | \
        mail -s "BACKUP VERIFICATION FAILED" ops@tzahu.com
fi

# 6. Cleanup
dropdb tzahu_crm_verify
```

### 7.2 Data Integrity Checksum

```python
class BackupVerification:
    """Verify data integrity of restored backups."""

    def verify(self, database: str) -> VerificationResult:
        issues = []

        # 1. Row count consistency
        tables = {
            "lead_management_leads": 100000,
            "pipeline_management_opportunities": 50000,
            "identity_users": 10000,
        }
        for table, expected_min in tables.items():
            count = self._count_rows(database, table)
            if count < expected_min:
                issues.append(f"{table}: expected >= {expected_min}, got {count}")

        # 2. Referential integrity
        fk_checks = [
            ("lead_management_leads", "organization_id", "organization_organizations"),
            ("pipeline_management_opportunities", "lead_id", "lead_management_leads"),
        ]
        for table, fk_column, ref_table in fk_checks:
            orphans = self._check_orphans(database, table, fk_column, ref_table)
            if orphans > 0:
                issues.append(f"{table}: {orphans} orphaned {fk_column} references")

        # 3. Sequence consistency
        # (UUIDs don't have sequences, but check serial fields)

        # 4. Checksum
        checksum = self._compute_checksum(database)
        expected_checksum = self._get_expected_checksum()

        if checksum != expected_checksum:
            issues.append(f"Data checksum mismatch: {checksum} vs {expected_checksum}")

        return VerificationResult(
            passed=len(issues) == 0,
            issues=issues,
            checksum=checksum,
            verified_at=datetime.now(pytz.UTC),
        )
```

### 7.3 Backup Size Monitoring

```python
class BackupSizeMonitor:
    """Monitor backup sizes and alert on anomalies."""

    def check_backup_sizes(self):
        backups = pgbackrest.info()
        for backup in backups:
            size_gb = backup["size"] / 1024 / 1024 / 1024
            expected_size = self._get_expected_size(backup["type"])

            if size_gb > expected_size * 1.5:
                self._alert(
                    f"Backup size anomaly: {backup['label']} "
                    f"is {size_gb:.1f}GB (expected {expected_size:.1f}GB)"
                )

            if size_gb < expected_size * 0.5:
                self._alert(
                    f"Backup too small: {backup['label']} "
                    f"is {size_gb:.1f}GB (expected {expected_size:.1f}GB)"
                )
```

---

## 8. Recovery Procedures

### 8.1 Point-in-Time Recovery (PITR)

```bash
# Recover database to a specific point in time
# Use case: Recover from accidental data deletion at 14:23 UTC

# 1. Identify target time
TARGET_TIME="2026-07-27 14:23:00 UTC"

# 2. Restore to point in time
pgbackrest --stanza=main \
    --type=time \
    --target="$TARGET_TIME" \
    --target-action=promote \
    --db-path=/var/lib/postgresql/16/restore \
    restore

# 3. Verify data
psql -d tzahu_crm_restore -c "
    SELECT count(*) FROM lead_management_leads
    WHERE created_at > '2026-07-27 14:20:00+00';
"

# 4. Export the recovered data (specific tables if needed)
pg_dump -t lead_management_leads \
    --data-only \
    --file=/tmp/recovered_leads.sql

# 5. Apply to production
psql -d tzahu_crm -f /tmp/recovered_leads.sql
```

### 8.2 Full Restore

```bash
# Full restore of entire database
# Use case: Primary database failure, restore from backup

# 1. Stop application
kubectl scale deployment django-api --replicas=0

# 2. Drop and recreate database
dropdb tzahu_crm
createdb tzahu_crm

# 3. Restore latest full backup
pgbackrest --stanza=main \
    --type=immediate \
    --db-path=/var/lib/postgresql/16/main \
    --force \
    restore

# 4. Apply WAL to latest point
pgbackrest --stanza=main \
    --type=time \
    --target="2026-07-27 14:30:00 UTC" \
    --target-action=promote \
    restore

# 5. Verify integrity
pgbackrest --stanza=main check

# 6. Start application
kubectl scale deployment django-api --replicas=4

# 7. Verify application health
curl -f https://api.tzahu.com/health/
```

### 8.3 Table-Level Restore

```bash
# Restore a single table from backup
# Use case: Accidental deletion of leads from a specific org

# 1. Restore full backup to temporary database
pgbackrest --stanza=main \
    --db-path=/var/lib/postgresql/16/staging \
    restore

# 2. Export specific table
pg_dump -t lead_management_leads \
    --data-only \
    --dbname=tzahu_crm_staging \
    --file=/tmp/leads_restore.sql

# 3. Dry run: check what will be restored
head -100 /tmp/leads_restore.sql

# 4. Apply to production
psql -d tzahu_crm -f /tmp/leads_restore.sql

# 5. Clean up staging database
dropdb tzahu_crm_staging
```

### 8.4 Cross-Region Restore

```bash
# Restore backup from DR region
# Use case: us-east-1 primary region is down, need to restore in us-west-2

# 1. Configure pgBackRest for DR
# pgbackrest.conf on DR instance:
# repo1-s3-bucket=tzahu-db-backups-dr
# repo1-s3-region=us-west-2

# 2. Restore from DR backup
pgbackrest --stanza=main restore

# 3. Promote to primary
pg_ctl promote

# 4. Update DNS to point to DR region
# (Route53 health check + failover)

# 5. Start application in DR region
kubectl --context=us-west-2 scale deployment django-api --replicas=4
```

---

## 9. RPO and RTO

### 9.1 Recovery Objectives

| Component | RPO (Recovery Point Objective) | RTO (Recovery Time Objective) |
|-----------|-------------------------------|-------------------------------|
| PostgreSQL | 5 minutes (WAL archiving) | 30 minutes (full restore) |
| Redis (sessions) | 1 second (AOF everysec) | 5 minutes (AOF replay) |
| Redis (cache) | 0 (rebuild from DB) | 10 minutes (cache warm) |
| RabbitMQ | 0 (HA mirroring) | 1 minute (node failover) |
| MinIO | 15 minutes (async replication) | 15 minutes (DNS switch) |
| Application (stateless) | 0 (no state) | 2 minutes (K8s redeploy) |

### 9.2 Recovery Time Budget

```
PostgreSQL full restore:      30 minutes (120GB @ 70MB/s read)
PostgreSQL PITR restore:      35 minutes (30 min restore + 5 min WAL apply)
Redis session restore:         5 minutes (50GB AOF replay)
Redis cluster restore:        10 minutes (3 × 5 min parallel)
RabbitMQ HA failover:          1 minute (automatic)
MinIO DR failover:            15 minutes (DNS + verify)
Application redeploy:          2 minutes (K8s HPA scale up)

Combined worst-case:          35 minutes (database restore)
```

### 9.3 RPO Compliance

```python
class RPOCompliance:
    """Monitor and enforce RPO compliance."""

    def check_rpo(self) -> dict:
        # 1. WAL archive lag
        wal_lag = self._get_wal_archive_lag()
        if wal_lag > timedelta(minutes=5):
            self._alert("WAL archive lag exceeds 5 minutes RPO")

        # 2. Last successful backup
        last_full = self._get_last_full_backup()
        hours_since_backup = (datetime.now(pytz.UTC) - last_full).total_seconds() / 3600
        if hours_since_backup > 30:
            self._alert("No full backup in > 30 hours")

        # 3. S3 replication lag
        replication_lag = self._get_s3_replication_lag()
        if replication_lag > timedelta(minutes=15):
            self._alert("S3 replication lag exceeds 15 minutes RPO")

        return {
            "wal_lag_seconds": wal_lag.total_seconds(),
            "hours_since_full_backup": hours_since_backup,
            "replication_lag_seconds": replication_lag.total_seconds(),
            "rpo_compliant": wal_lag < timedelta(minutes=5),
        }
```
