# TZAHU CRM — Tenant Migration

> **Version:** 0.1.0-draft
> **Last Updated:** 2026-07-27
> **Status:** Foundational Design Phase
> **Owner:** Platform Architecture Team

---

## Table of Contents

1. [Overview](#1-overview)
2. [Pool to Silo Migration](#2-pool-to-silo-migration)
3. [Silo to Pool Migration](#3-silo-to-pool-migration)
4. [Tenant Export](#4-tenant-export)
5. [Tenant Deletion](#5-tenant-deletion)
6. [Tenant Archive](#6-tenant-archive)
7. [Schema Migration Across Tenants](#7-schema-migration-across-tenants)
8. [Zero-Downtime Migration](#8-zero-downtime-migration)

---

## 1. Overview

TZAHU CRM supports two tenant isolation models:

- **Pool (Shared Database)**: The default model. All tenants share a single PostgreSQL schema with RLS enforcing isolation. Simple operations, lower cost, easy schema migrations.
- **Silo (Dedicated Database)**: Each tenant gets their own PostgreSQL database. Full resource isolation, no noisy-neighbor problems, separate backup/restore per tenant. Used for enterprise contracts, compliance requirements (HIPAA, GDPR data residency), or performance-critical tenants.

This document defines the migration procedures between these two models, as well as tenant data export, deletion, archival, and schema migration strategies.

### 1.1 Tenant Isolation Models

```
Pool Model (Default):
  ┌──────────────────────┐
  │  PostgreSQL Instance  │
  │  ┌──────────────────┐ │
  │  │  shared_db        │ │
  │  │                   │ │
  │  │  org_1 data ──────│─┤── RLS isolates rows
  │  │  org_2 data ──────│─┤
  │  │  org_3 data ──────│─┤
  │  │  ...              │ │
  │  └──────────────────┘ │
  └──────────────────────┘

Silo Model (Enterprise):
  ┌──────────────────────┐
  │  PostgreSQL Instance  │
  │  ┌──────────────────┐ │
  │  │  org_1_db         │ │  Dedicated database
  │  ├──────────────────┤ │
  │  │  org_2_db         │ │  Dedicated database
  │  ├──────────────────┤ │
  │  │  pool_db          │ │  All other tenants
  │  └──────────────────┘ │
  └──────────────────────┘
```

---

## 2. Pool to Silo Migration

### 2.1 Trigger Conditions

A tenant is migrated from Pool to Silo when:

1. **Enterprise contract**: Customer signs an enterprise agreement requiring data isolation
2. **Compliance requirement**: GDPR data residency, HIPAA, SOC2, PCI-DSS
3. **Performance isolation**: Tenant generates high load impacting other tenants
4. **Custom configuration**: Tenant requires custom indexes, extensions, or PL/pgSQL functions

### 2.2 Pre-Migration Checks

```python
class PreMigrationValidator:
    """Validate that a tenant is ready for silo migration."""

    async def validate(self, org_id: UUID) -> MigrationValidation:
        issues = []

        # 1. Data integrity
        for table in TENANT_SCOPED_TABLES:
            row_count = await self._count_rows(table, org_id)
            if row_count == 0:
                issues.append(f"Empty table: {table} for org {org_id}")
            # Check for orphaned references
            orphans = await self._check_referential_integrity(table, org_id)
            if orphans > 0:
                issues.append(f"Orphaned references in {table}: {orphans} rows")

        # 2. Referential integrity
        fk_issues = await self._check_all_foreign_keys(org_id)
        issues.extend(fk_issues)

        # 3. Row count verification
        counts = await self._get_row_counts(org_id)
        for table, count in counts.items():
            if count > 0:
                logger.info("table_count", table=table, count=count)

        # 4. Active migration check
        if await self._has_active_migration(org_id):
            issues.append("Active migration already in progress")

        return MigrationValidation(
            is_valid=len(issues) == 0,
            issues=issues,
            row_counts=counts,
        )
```

### 2.3 Migration Process

```python
class PoolToSiloMigration:
    """Migrate a single tenant from pool to dedicated database."""

    MIGRATION_STEPS = [
        "pre_validate",
        "lock_tenant",
        "dump_data",
        "create_database",
        "restore_data",
        "verify_integrity",
        "update_routing",
        "cut_over",
        "unlock_tenant",
        "cleanup_pool",
    ]

    async def execute(self, org_id: UUID) -> MigrationResult:
        migration = await MigrationLog.create(
            organization_id=org_id,
            direction="pool_to_silo",
            status="running",
            started_at=timezone.now(),
        )

        try:
            # Phase 1: Pre-migration
            self.log_step(migration, "pre_validate")
            validation = await PreMigrationValidator().validate(org_id)
            if not validation.is_valid:
                raise MigrationError(f"Validation failed: {validation.issues}")

            # Phase 2: Lock tenant (read-only mode)
            self.log_step(migration, "lock_tenant")
            await self._set_tenant_readonly(org_id, True)

            # Phase 3: Dump data (pg_dump with --exclude-table-data for non-tenant tables)
            self.log_step(migration, "dump_data")
            dump_file = await self._dump_tenant_data(org_id)

            # Phase 4: Create dedicated database
            self.log_step(migration, "create_database")
            silo_db_name = f"tzahu_silo_{org_id.hex[:12]}"
            await self._create_database(silo_db_name)

            # Phase 5: Restore data
            self.log_step(migration, "restore_data")
            await self._restore_tenant_data(silo_db_name, dump_file)

            # Phase 6: Verify integrity
            self.log_step(migration, "verify_integrity")
            await self._verify_silo(silo_db_name, org_id)

            # Phase 7: Update routing
            self.log_step(migration, "update_routing")
            await TenantRoute.objects.update_or_create(
                organization_id=org_id,
                defaults={
                    "database": silo_db_name,
                    "isolation_model": "silo",
                    "migrated_at": timezone.now(),
                },
            )

            # Phase 8: Cut over (DNS / connection string)
            self.log_step(migration, "cut_over")
            await self._cut_over(org_id, silo_db_name)

            # Phase 9: Unlock tenant
            self.log_step(migration, "unlock_tenant")
            await self._set_tenant_readonly(org_id, False)

            # Phase 10: Cleanup pool data (optional, after verification period)
            self.log_step(migration, "cleanup_pool")

            migration.status = "completed"
            migration.completed_at = timezone.now()
            await migration.save()

            return MigrationResult(success=True, database=silo_db_name)

        except Exception as e:
            migration.status = "failed"
            migration.error = str(e)
            migration.completed_at = timezone.now()
            await migration.save()
            raise
```

### 2.4 Data Dump Command

```bash
# Dump tenant data from pool database
# Uses --data-only and --table flags to only dump tenant-scoped tables

pg_dump \
    --host=pool-db \
    --port=6432 \
    --username=tzahu_migration \
    --dbname=tzahu_crm \
    --data-only \
    --table=lead_management_leads \
    --table=lead_management_contacts \
    --table=pipeline_management_opportunities \
    --table=activity_activity \
    --table=workflow_workflow_definitions \
    --table=workflow_execution_records \
    --table=notification_notifications \
    --table=audit_auditlog \
    --table=rag_documents \
    --table=rag_vectors \
    --table=integration_connector_instances \
    --table=settings_settings \
    --table=settings_feature_flags \
    --condition="organization_id = 'org-uuid'" \
    --file=/tmp/silo_migration_org_uuid.sql

# Compress
gzip /tmp/silo_migration_org_uuid.sql
```

### 2.5 Rollback Plan

```python
class MigrationRollback:
    """Rollback a failed pool-to-silo migration."""

    async def rollback(self, migration_id: UUID) -> None:
        migration = await MigrationLog.get(id=migration_id)

        if migration.step in ["pre_validate", "dump_data"]:
            # Safe: no data changed yet, just unlock
            await self._set_tenant_readonly(migration.organization_id, False)

        elif migration.step in ["create_database", "restore_data"]:
            # Drop the partially created silo database
            await self._drop_database(migration.silo_db_name)
            await self._set_tenant_readonly(migration.organization_id, False)

        elif migration.step in ["verify_integrity", "update_routing"]:
            # Revert routing, drop silo
            await TenantRoute.filter(
                organization_id=migration.organization_id
            ).delete()
            await self._drop_database(migration.silo_db_name)
            await self._set_tenant_readonly(migration.organization_id, False)

        elif migration.step in ["cut_over"]:
            # Critical: cut over happened but may have issues
            # Switch DNS/routing back to pool
            await self._revert_routing(migration.organization_id)
            await self._set_tenant_readonly(migration.organization_id, False)
            await self._alert(
                f"Rollback of migration {migration_id}: "
                f"data may be inconsistent, manual reconciliation required"
            )

        migration.status = "rolled_back"
        migration.rolled_back_at = timezone.now()
        await migration.save()
```

---

## 3. Silo to Pool Migration

### 3.1 Consolidation After Tenant Deletion

When a silo tenant is deleted or downgrades, their dedicated database can be consolidated back to the pool:

```python
class SiloToPoolMigration:
    """Migrate a silo tenant back to the shared pool."""

    async def execute(self, org_id: UUID) -> MigrationResult:
        # 1. Dump silo database
        dump_file = await self._dump_silo_database(org_id)

        # 2. Restore to pool with org_id filter
        pool_db = settings.DATABASES["default"]["NAME"]
        await self._restore_to_pool(pool_db, dump_file, org_id)

        # 3. Verify data consistency
        await self._verify_pool(org_id)

        # 4. Update routing
        await TenantRoute.filter(organization_id=org_id).update(
            isolation_model="pool",
            database=pool_db,
        )

        # 5. Drop silo database (after 7-day verification period)
        # Silo DB is retained for 7 days before deletion
        await self._schedule_database_deletion(org_id, days=7)
```

### 3.2 Cost Optimization

Silo → Pool migration is used to reduce costs when:
- Enterprise customer downgrades to Growth plan
- Tenant is deleted and no longer needs dedicated infrastructure
- Compliance requirements expire and data can return to shared storage

---

## 4. Tenant Export

### 4.1 Full Data Export

```python
class TenantExporter:
    """Export all tenant data in JSON or CSV format."""

    EXPORT_FORMATS = ["json", "csv"]
    MODULES = [
        "leads", "contacts", "accounts", "opportunities",
        "activities", "tasks", "notes", "workflows",
        "notifications", "settings", "integrations",
    ]

    async def export(
        self,
        org_id: UUID,
        format: str = "json",
        modules: list[str] | None = None,
    ) -> str:  # Returns file path
        export_id = uuid7()
        export_dir = f"/tmp/exports/{org_id}/{export_id}"
        os.makedirs(export_dir, exist_ok=True)

        modules_to_export = modules or self.MODULES

        for module in modules_to_export:
            data = await self._export_module(org_id, module)
            filename = f"{export_dir}/{module}.{format}"

            if format == "json":
                with open(filename, "w") as f:
                    json.dump(data, f, indent=2, default=str)
            elif format == "csv":
                df = pd.DataFrame(data)
                df.to_csv(filename, index=False)

            # Compress
            with open(filename, "rb") as f:
                compressed = gzip.compress(f.read())
            with open(f"{filename}.gz", "wb") as f:
                f.write(compressed)

        # Create manifest
        manifest = {
            "export_id": str(export_id),
            "organization_id": str(org_id),
            "exported_at": str(timezone.now()),
            "format": format,
            "modules": modules_to_export,
            "files": [f"{m}.{format}.gz" for m in modules_to_export],
        }
        with open(f"{export_dir}/manifest.json", "w") as f:
            json.dump(manifest, f, indent=2)

        # Upload to MinIO
        await self._upload_export(org_id, export_id, export_dir)

        # Cleanup temp files
        shutil.rmtree(export_dir)

        return f"tzahu-data-exports/{org_id}/{export_id}/manifest.json"

    @celery.task(bind=True, max_retries=3)
    def request_export(self, org_id: UUID, requested_by_id: UUID, format: str = "json"):
        """Async export request."""
        notification_service.send(
            org_id=org_id,
            user_id=requested_by_id,
            channel="email",
            template="export_ready",
            context={"export_id": str(export_id)},
        )
```

### 4.2 GDPR Data Portability Request

```python
class GDPRDataPortability:
    """Handle GDPR Article 20 data portability requests."""

    def handle_request(self, org_id: UUID, user_id: UUID) -> ExportRequest:
        """Initiate data portability export."""
        request = ExportRequest.objects.create(
            organization_id=org_id,
            requested_by_id=user_id,
            type="gdpr_portability",
            status="pending",
        )

        # Schedule export
        gdpr_export.delay(request.id)

        return request

    async def collect_user_data(self, org_id: UUID, user_id: UUID) -> dict:
        """Collect all personal data for a user (GDPR Article 15)."""
        user = await User.objects.get(id=user_id, organization_id=org_id)
        return {
            "identity": {
                "name": str(user.name),
                "email": str(user.email),
                "phone": str(user.phone) if user.phone else None,
                "created_at": str(user.created_at),
            },
            "activity": await self._get_user_activity(org_id, user_id),
            "communications": await self._get_user_communications(org_id, user_id),
            "login_history": await self._get_login_history(org_id, user_id),
            "preferences": await self._get_user_preferences(org_id, user_id),
        }
```

### 4.3 Scheduled Exports

```yaml
# Automated exports for enterprise customers
scheduled_exports:
  - org_id: "enterprise-org-uuid"
    format: csv
    schedule: "0 3 * * 1"    # Every Monday at 3 AM
    destination: "s3://enterprise-bucket/exports/"
    modules: [leads, contacts, opportunities, activities]
    retention_days: 30
```

---

## 5. Tenant Deletion

### 5.1 Soft Delete (Immediate)

```python
class TenantDeletion:
    """Handle tenant deletion with soft-delete, grace period, and hard-delete."""

    GRACE_PERIOD_DAYS = 30  # Configurable per plan

    async def soft_delete(self, org_id: UUID, requested_by_id: UUID) -> None:
        """Soft delete a tenant — data becomes invisible but is retained."""
        org = await Organization.objects.get(id=org_id)

        # 1. Mark org as deleted
        org.deleted_at = timezone.now()
        org.status = "deleted"
        await org.save()

        # 2. Disable all integrations
        await ConnectorInstance.objects.filter(organization_id=org_id).update(
            status="disabled"
        )

        # 3. Cancel subscription if active
        if org.subscription.status in ["active", "past_due"]:
            await SubscriptionService.cancel(org.subscription.id)

        # 4. Log deletion
        await AuditLog.create(
            organization_id=org_id,
            actor_id=requested_by_id,
            event="tenant.soft_deleted",
            metadata={"grace_period_days": self.GRACE_PERIOD_DAYS},
        )

        # 5. Schedule hard delete notification
        schedule_hard_delete_notification.delay(org_id, days_before=7)

        # 6. Notify admins
        await self._notify_admins(org_id, "soft_deleted")
```

### 5.2 Grace Period (30 Days Configurable)

```python
class GracePeriodManager:
    """Manage the grace period between soft and hard delete."""

    async def get_remaining_days(self, org_id: UUID) -> int:
        org = await Organization.objects.get(id=org_id)
        if not org.deleted_at:
            return 0
        elapsed = (timezone.now() - org.deleted_at).days
        remaining = max(0, TenantDeletion.GRACE_PERIOD_DAYS - elapsed)
        return remaining

    async def restore(self, org_id: UUID, requested_by_id: UUID) -> None:
        """Restore a tenant during the grace period."""
        org = await Organization.objects.get(id=org_id)

        days_remaining = await self.get_remaining_days(org_id)
        if days_remaining <= 0:
            raise RestoreExpiredError("Grace period has expired")

        org.deleted_at = None
        org.status = "active"
        await org.save()

        await AuditLog.create(
            organization_id=org_id,
            actor_id=requested_by_id,
            event="tenant.restored",
        )

        return org

    async def send_reminders(self):
        """Send reminder emails during the grace period."""
        expiring_soon = await Organization.objects.filter(
            status="deleted",
            deleted_at__gte=timezone.now() - timedelta(days=TenantDeletion.GRACE_PERIOD_DAYS - 7),
            deleted_at__lte=timezone.now() - timedelta(days=TenantDeletion.GRACE_PERIOD_DAYS - 1),
        )
        for org in expiring_soon:
            await self._send_reminder(org, days_remaining=7)
```

### 5.3 Hard Delete (After Grace Period)

```python
@celery.task
def hard_delete_tenant(org_id: UUID):
    """Permanently delete all tenant data after grace period."""
    org = Organization.objects.get(id=org_id)

    # 1. Delete data from all tenant-scoped tables
    for table in TENANT_SCOPED_TABLES:
        raw_query(f"DELETE FROM {table} WHERE organization_id = %s", [org_id])

    # 2. Delete MinIO data
    minio_client = MinioClient()
    objects = minio_client.list_objects("tzahu-media", prefix=f"{org_id}/", recursive=True)
    for obj in objects:
        minio_client.remove_object("tzahu-media", obj.object_name)

    # 3. Delete audit logs (with retention exception for compliance)
    if not org.compliance_hold:
        AuditLog.objects.filter(organization_id=org_id).delete()

    # 4. Delete organization record
    org.delete()

    # 5. Log (to system audit, not org-specific)
    SystemAuditLog.create(event="tenant.hard_deleted", org_id=org_id)
```

### 5.4 Data Anonymization (GDPR Right to be Forgotten)

```python
class DataAnonymizer:
    """Anonymize personal data while preserving analytics."""

    async def anonymize_user(self, org_id: UUID, user_id: UUID) -> None:
        """GDPR Article 17: Right to erasure with anonymization."""
        user = await User.objects.get(id=user_id, organization_id=org_id)

        # Anonymize identity data
        user.email = f"deleted-{user_id.hex[:8]}@anonymized.tzahu.com"
        user.first_name = "[Deleted]"
        user.last_name = "[Deleted]"
        user.phone = None
        user.avatar_url = None
        user.is_active = False
        await user.save()

        # Anonymize activities
        await Activity.objects.filter(created_by_id=user_id).update(
            description=RawDB("regexp_replace(description, '[\\w.@+-]+', '[REDACTED]', 'g')"),
        )

        # Anonymize notes
        await Note.objects.filter(created_by_id=user_id).update(
            content="[This user has requested anonymization]"
        )

        # Delete sessions
        await Session.objects.filter(user_id=user_id).delete()

        # Keep aggregate data (counts, dates) but remove personal identifiers
        await AuditLog.create(
            organization_id=org_id,
            actor_id=user_id,
            event="user.anonymized",
            metadata={"type": "gdpr_erasure"},
        )
```

---

## 6. Tenant Archive

### 6.1 Archive Process

```python
class TenantArchiver:
    """Archive inactive tenants to cold storage."""

    async def archive(self, org_id: UUID) -> None:
        """Move tenant data to cold storage (S3 Glacier)."""
        # 1. Export full data
        export_path = await TenantExporter().export(org_id, format="json")

        # 2. Move export to Glacier
        glacier_path = export_path.replace("tzahu-data-exports", "tzahu-archives")
        await self._move_to_glacier(export_path, glacier_path)

        # 3. Create archive metadata in PostgreSQL (lightweight)
        await ArchiveRecord.objects.create(
            organization_id=org_id,
            archive_location=glacier_path,
            archived_at=timezone.now(),
            data_size_bytes=await self._get_data_size(org_id),
            retention_until=timezone.now() + timedelta(days=365 * 7),
        )

        # 4. Delete production data
        await hard_delete_tenant(org_id)
```

### 6.2 Restore from Archive

```python
class ArchiveRestorer:
    """Restore a tenant from archive (Glacier)."""

    async def restore(self, org_id: UUID) -> MigrationResult:
        record = await ArchiveRecord.objects.get(organization_id=org_id)
        if not record:
            raise ArchiveNotFoundError(f"No archive for org {org_id}")

        # 1. Request restore from Glacier (takes 12-48 hours)
        restore_job = await self._request_glacier_restore(record.archive_location)

        # 2. Notify admin when restore is complete
        restore_job.on_complete(
            callback=lambda: self._finish_restore(org_id, record)
        )

        return MigrationResult(
            success=True,
            message=f"Restore initiated. Estimated time: 24 hours.",
        )

    async def _finish_restore(self, org_id: UUID, record: ArchiveRecord):
        # 1. Download restored data
        data = await self._download_restored_data(record.archive_location)

        # 2. Import to database
        await self._import_to_pool(org_id, data)

        # 3. Update routing
        await TenantRoute.objects.update_or_create(
            organization_id=org_id,
            defaults={"isolation_model": "pool", "status": "active"},
        )

        # 4. Notify
        await self._notify_admin(org_id, "restore_complete")
```

---

## 7. Schema Migration Across Tenants

### 7.1 Pool Model: Run Once

```bash
# For pool model, migrations are standard Django migrations:
python manage.py migrate

# All tenants in the pool are migrated simultaneously.
# RLS ensures data isolation while schema is shared.
```

### 7.2 Silo Model: Run N Times

```python
class SiloMigrationRunner:
    """Run Django migrations on all silo databases."""

    async def run_migrations(self) -> MigrationResult:
        silos = await TenantRoute.objects.filter(isolation_model="silo")

        results = []
        for silo in silos:
            try:
                # Connect to silo database
                database = silo.database
                connection = await self._connect_to_silo(database)

                # Run migrations
                result = await self._run_migrations_on_silo(database)
                results.append({
                    "org_id": silo.organization_id,
                    "database": database,
                    "status": "success",
                    "applied": result.applied,
                })

                # Log success
                await self._log_migration(silo.organization_id, result)

            except Exception as e:
                results.append({
                    "org_id": silo.organization_id,
                    "database": database,
                    "status": "failed",
                    "error": str(e),
                })

                # Log failure and alert
                await self._alert(f"Migration failed for {database}: {e}")

        return MigrationResult(
            success=all(r["status"] == "success" for r in results),
            details=results,
        )
```

### 7.3 Migration Tracking per Tenant

```sql
CREATE TABLE tenant_schema_migrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    organization_id UUID NOT NULL,
    migration_name VARCHAR(255) NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    duration_ms INT,
    success BOOLEAN NOT NULL,
    error TEXT,
    UNIQUE(organization_id, migration_name)
);
```

### 7.4 Parallel Silo Migration

```python
class ParallelSiloMigrator:
    """Run migrations on silo databases in parallel with rate limiting."""

    CONCURRENCY = 4  # Max 4 silo migrations at once

    async def run_parallel(self) -> list[MigrationResult]:
        silos = await TenantRoute.objects.filter(isolation_model="silo")
        semaphore = asyncio.Semaphore(self.CONCURRENCY)

        async def migrate_one(silo):
            async with semaphore:
                return await self._migrate_silo(silo)

        tasks = [migrate_one(silo) for silo in silos]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        return results
```

---

## 8. Zero-Downtime Migration

### 8.1 Blue-Green for Silo Migrations

```
Blue (current): Pool database
Green (new): Silo database

Migration steps:
1. Create green environment (silo database + schema)
2. Start syncing data (initial dump + incremental sync)
3. Run validation checks on green
4. Switch application traffic to green
5. Keep blue for rollback (7 days)
6. Decommission blue

Cut-over strategy:
- Update TenantRoute table (application-side routing)
- No DNS change needed (application routes per-tenant)
- In-flight requests on blue complete normally
- New requests go to green
```

### 8.2 Read-Only Mode During Cutover

```python
class ReadOnlyMode:
    """Put tenant in read-only mode during cutover."""

    async def enable(self, org_id: UUID) -> None:
        await cache.set(f"tenant:readonly:{org_id}", True, timeout=300)
        # Middleware checks this flag and rejects writes with 503

    async def disable(self, org_id: UUID) -> None:
        await cache.delete(f"tenant:readonly:{org_id}")

    async def is_readonly(self, org_id: UUID) -> bool:
        return await cache.get(f"tenant:readonly:{org_id}", False)


class ReadOnlyMiddleware:
    """Reject write requests for tenants in read-only mode."""

    READ_ONLY_METHODS = ["POST", "PUT", "PATCH", "DELETE"]

    def __call__(self, request):
        if request.method in self.READ_ONLY_METHODS:
            org_id = getattr(request, "organization_id", None)
            if org_id and ReadOnlyMode().is_readonly(org_id):
                return Response(
                    {"error": "tenant_in_maintenance",
                     "message": "This organization is undergoing maintenance. Please try again."},
                    status=503,
                )
        return self.get_response(request)
```

### 8.3 Cutover Window

```
Total downtime during cutover: < 30 seconds
Cutover steps:
1. Enable read-only mode (0s)
2. Wait for in-flight writes to complete (5s)
3. Final incremental sync (15s)
4. Update TenantRoute (1s)
5. Verify green is serving correctly (5s)
6. Disable read-only mode (0s)
7. Start accepting writes on green (0s)

Total: ~26 seconds of read-only, 0 seconds of complete downtime
```
