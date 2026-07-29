# TZAHU CRM — Database Guidelines

> **Version:** 0.1.0-draft
> **Last Updated:** 2026-07-27
> **Status:** Approved
> **Owner:** Platform Architecture Team

---

## Table of Contents

1. [PostgreSQL Version & Configuration](#1-postgresql-version--configuration)
2. [UUID v7 Strategy](#2-uuid-v7-strategy)
3. [Universal Columns](#3-universal-columns)
4. [Naming Conventions](#4-naming-conventions)
5. [Indexing Strategy](#5-indexing-strategy)
6. [Constraints](#6-constraints)
7. [Full-Text Search](#7-full-text-search)
8. [Vector Storage (pgvector)](#8-vector-storage-pgvector)
9. [Partitioning](#9-partitioning)
10. [Row-Level Security (RLS)](#10-row-level-security-rls)
11. [Migration Strategy](#11-migration-strategy)
12. [Soft Delete Pattern](#12-soft-delete-pattern)
13. [Connection Management](#13-connection-management)
14. [Backup & Recovery](#14-backup--recovery)
15. [Performance Monitoring](#15-performance-monitoring)

---

## 1. PostgreSQL Version & Configuration

### Target Version
- PostgreSQL 16.3+
- Extensions required: `pgvector` (0.7+), `pg_trgm`, `uuid-ossp`, `pgcrypto`, `btree_gin`.

### Configuration Template
```ini
# Connection
max_connections = 200
superuser_reserved_connections = 10

# Memory
shared_buffers = '4GB'
effective_cache_size = '12GB'
work_mem = '64MB'
maintenance_work_mem = '1GB'

# WAL
wal_level = replica
max_wal_size = '4GB'
min_wal_size = '1GB'
wal_buffers = '16MB'
synchronous_commit = remote_write

# Planner
random_page_cost = 1.1
effective_io_concurrency = 200
default_statistics_target = 500

# Parallel
max_parallel_workers = 8
max_parallel_workers_per_gather = 4
parallel_tuple_cost = 0.01
parallel_setup_cost = 100

# Autovacuum
autovacuum_max_workers = 4
autovacuum_naptime = '60s'
autovacuum_vacuum_threshold = 50
autovacuum_vacuum_scale_factor = 0.01
autovacuum_vacuum_cost_limit = 2000
```

### PgBouncer Configuration
- Transaction pooling mode.
- `min_pool_size = 10`, `reserve_pool_size = 5`.
- `server_idle_timeout = 300`.
- `query_timeout = 30`.

---

## 2. UUID v7 Strategy

### Why UUID v7
- **Time-ordered**: monotonically increasing within the same millisecond → reduces B-tree index fragmentation.
- **Index-friendly**: clustered index (PK) inserts are append-heavy, minimizing page splits.
- **Unique across systems**: no collision risk across tenants or regions.
- **Contains timestamp**: extract `created_at` from UUID without a separate column query.

### Implementation
```python
import os
import time
import uuid
from typing import Optional

def uuid7(timestamp: Optional[int] = None) -> uuid.UUID:
    """Generate a UUID v7 (time-ordered) value.

    Format: 0                   1                   2                   3
             0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
            +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
            |            unixts             | ver |       rand_a            |
            +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
            |var|                       rand_b                             |
            +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
            |                            rand_b                            |
            +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+

    Args:
        timestamp: Unix timestamp in milliseconds. If None, uses current time.

    Returns:
        A UUID v7 object.
    """
    if timestamp is None:
        timestamp = int(time.time() * 1000)

    # Fill in random data
    rand_bytes = os.urandom(10)

    # Timestamp: 48 bits (6 bytes)
    timestamp_bytes = timestamp.to_bytes(6, byteorder="big")

    # Construct the UUID bytes
    # Bytes 0-5: timestamp (48 bits)
    # Byte 6: version (4 bits) + high 4 bits of rand_a
    # Byte 7: low 8 bits of rand_a
    # Bytes 8-15: rand_b (8 bytes with variant indicator)
    uuid_bytes = bytearray()
    uuid_bytes.extend(timestamp_bytes)

    # Version 7 (0111) + high 4 bits of rand_a
    uuid_bytes.append((0x70 | (rand_bytes[0] >> 4)))

    # Low 8 bits of rand_a
    uuid_bytes.append(rand_bytes[1])

    # Variant 10xx + rand_b first 6 bits
    uuid_bytes.append((0x80 | (rand_bytes[2] >> 2)))
    uuid_bytes.extend(rand_bytes[3:10])

    return uuid.UUID(bytes=bytes(uuid_bytes))
```

### Django Model Field
```python
class UUIDModel(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid7,
        editable=False,
        db_default=RawSQL("gen_uuid_v7()", []),  # PostgreSQL function
    )

    class Meta:
        abstract = True
```

Create a PostgreSQL function for server-side generation:
```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION gen_uuid_v7()
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  timestamp_ms bytea;
  rand_bytes bytea;
BEGIN
  timestamp_ms := substring(int8send((extract(epoch from clock_timestamp()) * 1000)::bigint) from 3);
  rand_bytes := gen_random_bytes(10);
  RETURN encode(
    timestamp_ms ||
    set_byte(substring(rand_bytes from 1 for 2), 0, 0x70 | (get_byte(rand_bytes, 0) >> 4)) ||
    set_byte(substring(rand_bytes from 3 for 8), 0, 0x80 | (get_byte(rand_bytes, 2) >> 2)),
    'hex'
  )::uuid;
END;
$$;
```

### Migration of Existing Tables
- All new tables use UUID v7 as PK.
- Legacy tables migrated via `ALTER TABLE ... ALTER COLUMN ... SET DEFAULT gen_uuid_v7()`.
- Foreign keys referencing UUID v7 must also be UUID v7.

---

## 3. Universal Columns

Every table in the system MUST include these columns:

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| `id` | `UUID` | `PK DEFAULT gen_uuid_v7()` | Primary identifier |
| `organization_id` | `UUID` | `NOT NULL` | Tenant isolation |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Last update timestamp |
| `created_by_id` | `UUID` | `NOT NULL` | User who created |
| `updated_by_id` | `UUID` | `NOT NULL` | User who last updated |
| `deleted_at` | `TIMESTAMPTZ` | `NULL` | Soft delete marker |

### Abstract Django Model
```python
class TenantScopedModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid7, editable=False)
    organization = models.ForeignKey(
        "organization.OrganizationModel",
        on_delete=models.CASCADE,
        db_column="organization_id",
    )
    created_at = models.DateTimeField(auto_now_add=True, db_default=RawSQL("NOW()", []))
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="%(class)s_created",
        db_column="created_by_id",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="%(class)s_updated",
        db_column="updated_by_id",
    )
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        abstract = true
```

### Exceptions
- Lookup/enum tables (e.g., `pipeline_stages`) may omit `organization_id` if global.
- Audit/event log tables: `organization_id` nullable for system events, `created_by_id` nullable for system actions.
- Join tables: include universal columns unless the join itself is the entire record.

---

## 4. Naming Conventions

### Database Objects
| Object | Convention | Example |
|--------|-----------|---------|
| Database | `{project}_{env}` | `tzahu_prod`, `tzahu_staging` |
| Schema | `public` (default) | `public` |
| Tables | snake_case plural | `leads`, `pipeline_stages`, `activity_logs` |
| Columns | snake_case | `company_name`, `created_at`, `is_active` |
| Primary keys | `id` | `id` |
| Foreign keys | `{referenced_table_singular}_id` | `lead_id`, `organization_id` |
| Indexes | `idx_{table}_{columns}` | `idx_leads_status_score`, `idx_activities_created_at` |
| Unique constraints | `uq_{table}_{columns}` | `uq_leads_email`, `uq_org_name` |
| Check constraints | `ck_{table}_{description}` | `ck_leads_score_positive` |
| Foreign key constraints | `fk_{child}_{parent}` | `fk_leads_organization` |
| Sequences | `seq_{table}_{column}` | `seq_audit_events_id` |
| Triggers | `trg_{table}_{action}` | `trg_leads_set_search_vector` |
| Functions | `{verb}_{noun}` | `gen_uuid_v7()`, `set_search_vector()` |
| Policies | `{table}_{action}_{level}` | `leads_select_tenant`, `leads_insert_tenant` |

### Table Name Examples
| Entity | Table Name |
|--------|-----------|
| Lead | `leads` |
| Contact | `contacts` |
| Account | `accounts` |
| Opportunity | `opportunities` |
| Pipeline | `pipelines` |
| Pipeline Stage | `pipeline_stages` |
| Activity | `activities` |
| Task | `tasks` |
| Workflow | `workflows` |
| Workflow Execution | `workflow_executions` |
| Notification | `notifications` |
| Notification Template | `notification_templates` |
| Report | `reports` |
| Dashboard | `dashboards` |
| User | `users` |
| Organization | `organizations` |
| Role | `roles` |
| Role Assignment | `role_assignments` |
| Audit Event | `audit_events` |
| Connector | `connectors` |
| OAuth Token | `oauth_tokens` |
| Webhook Subscription | `webhook_subscriptions` |
| Calendar Event | `calendar_events` |
| Call | `calls` |
| Transcription | `transcriptions` |
| AI Query | `ai_queries` |
| Feature Flag | `feature_flags` |
| App Setting | `app_settings` |

---

## 5. Indexing Strategy

### B-Tree Indexes (Default)
Use for: equality lookups, range queries, ORDER BY, foreign keys.
```sql
CREATE INDEX idx_leads_status ON leads (status);
CREATE INDEX idx_leads_organization_created ON leads (organization_id, created_at DESC);
CREATE INDEX idx_opportunities_pipeline_stage ON opportunities (pipeline_id, stage_id);
CREATE INDEX idx_tasks_assignee_due ON tasks (assigned_to_id, due_date)
    WHERE deleted_at IS NULL;
```

### GIN Indexes
Use for: full-text search, JSONB queries, array columns.
```sql
-- Full-text search vector
CREATE INDEX idx_leads_search_vector ON leads USING GIN (search_vector);

-- JSONB settings column
CREATE INDEX idx_org_settings ON organizations USING GIN (settings);

-- Array tags
CREATE INDEX idx_leads_tags ON leads USING GIN (tags);

-- Trigram similarity (for fuzzy search)
CREATE INDEX idx_leads_company_trgm ON leads USING GIN (company_name gin_trgm_ops);
CREATE INDEX idx_contacts_name_trgm ON contacts USING GIN (full_name gin_trgm_ops);
```

### GiST Indexes
Use for: exclusion constraints, geometric data, range types.
```sql
-- Exclusion: no overlapping calendar events for the same user
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE calendar_events
ADD CONSTRAINT ck_no_overlap
EXCLUDE USING gist (
    assigned_to_id WITH =,
    tstzrange(start_time, end_time) WITH &&
);
```

### BRIN Indexes
Use for: append-only / time-series tables where physical order correlates with logical order.
```sql
-- Audit events are append-only; BRIN is highly space-efficient
CREATE INDEX idx_audit_events_created_brin
ON audit_events USING BRIN (created_at)
WITH (pages_per_range = 32);

-- Activity log
CREATE INDEX idx_activities_created_brin
ON activities USING BRIN (created_at)
WITH (pages_per_range = 32);
```

### Partial Indexes
Use for: subset of rows that are frequently queried.
```sql
-- Only active (non-deleted) leads
CREATE INDEX idx_active_leads_company
ON leads (company_name)
WHERE deleted_at IS NULL;

-- Only open opportunities
CREATE INDEX idx_open_opportunities
ON opportunities (pipeline_id, stage_id)
WHERE status NOT IN ('won', 'lost');

-- Only unread notifications
CREATE INDEX idx_unread_notifications
ON notifications (user_id, created_at DESC)
WHERE read_at IS NULL;
```

### Composite Indexes
Rules:
1. Equality columns first, then range columns, then sort columns.
2. Cover the most selective column first.
3. Consider index-only scans by including all needed columns.

```sql
-- Good: status=equality, score=range
CREATE INDEX idx_leads_status_score ON leads (status, score);

-- Good: organization=equality, created_at=sort
CREATE INDEX idx_org_created ON leads (organization_id, created_at DESC);

-- Covering index: includes `company_name` for index-only scans
CREATE INDEX idx_org_created_covering
ON leads (organization_id, created_at DESC)
INCLUDE (company_name, email);
```

### Index Checklist for Every Migration
- [ ] All foreign key columns indexed?
- [ ] All columns used in `WHERE`, `ORDER BY`, `JOIN` indexed?
- [ ] All columns used in `LIKE '%...'` have trigram GIN index?
- [ ] JSONB query paths have GIN index?
- [ ] Full-text search columns have GIN index on `search_vector`?
- [ ] Soft-delete tables have partial indexes (`WHERE deleted_at IS NULL`)?
- [ ] BRIN considered for append-only tables?
- [ ] Composite index order correct (equality → range → sort)?

---

## 6. Constraints

### NOT NULL
- All universal columns are NOT NULL except `deleted_at`.
- Boolean columns: `NOT NULL DEFAULT false` unless nullable has specific meaning.
- Monetary columns: `NOT NULL DEFAULT 0`.

### CHECK Constraints
```sql
-- Score must be non-negative
ALTER TABLE leads ADD CONSTRAINT ck_leads_score_positive CHECK (score >= 0);

-- Probability must be 0-100
ALTER TABLE opportunities
ADD CONSTRAINT ck_oppty_probability_range CHECK (probability >= 0 AND probability <= 100);

-- Valid email format
ALTER TABLE leads ADD CONSTRAINT ck_leads_email_format
CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Enum validation via CHECK (alternative to enum types for flexibility)
ALTER TABLE leads ADD CONSTRAINT ck_leads_status
CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'disqualified'));
```

### UNIQUE Constraints
```sql
-- Business key: unique email per organization
ALTER TABLE leads ADD CONSTRAINT uq_leads_org_email
UNIQUE (organization_id, email);

-- Unique pipeline stage position within a pipeline
ALTER TABLE pipeline_stages ADD CONSTRAINT uq_pipeline_position
UNIQUE (pipeline_id, position);

-- Unique partial: only one active role assignment per user+scope
ALTER TABLE role_assignments ADD CONSTRAINT uq_active_role_assignment
UNIQUE (user_id, scope_type, scope_id)
WHERE deleted_at IS NULL;
```

### FOREIGN KEY Constraints
```sql
-- Standard: cascade org deletion to all tenant data
ALTER TABLE leads ADD CONSTRAINT fk_leads_organization
FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

-- Protect: don't delete users with created records
ALTER TABLE leads ADD CONSTRAINT fk_leads_created_by
FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE PROTECT;

-- Set null: keep records if user is deleted (audit trail)
ALTER TABLE activities ADD CONSTRAINT fk_activities_performed_by
FOREIGN KEY (performed_by_id) REFERENCES users(id) ON DELETE SET NULL;
```

| ON DELETE Action | Use Case |
|-----------------|----------|
| `CASCADE` | Tenant-scoped data (org deletion removes all data) |
| `PROTECT` | Audit/ownership references (user deletion blocked if they own records) |
| `SET NULL` | Optional references (keep historical data when actor is deleted) |
| `SET DEFAULT` | Rarely used; prefer `SET NULL` |

### Django Model Constraints
```python
class Meta:
    constraints = [
        models.CheckConstraint(
            condition=models.Q(score__gte=0),
            name="ck_leads_score_positive",
        ),
        models.UniqueConstraint(
            fields=["organization", "email"],
            name="uq_leads_org_email",
        ),
        models.UniqueConstraint(
            fields=["organization", "company_name"],
            condition=models.Q(deleted_at__isnull=True),
            name="uq_active_leads_org_company",
        ),
    ]
```

---

## 7. Full-Text Search

### tsvector Column
Every searchable entity needs a `search_vector` column:
```sql
ALTER TABLE leads ADD COLUMN search_vector tsvector;
```

### Trigger-Based Update
```sql
CREATE FUNCTION set_leads_search_vector()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('english', coalesce(NEW.company_name, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(NEW.email, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(NEW.website, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(NEW.description, '')), 'C');
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_leads_set_search_vector
BEFORE INSERT OR UPDATE ON leads
FOR EACH ROW EXECUTE FUNCTION set_leads_search_vector();
```

### Django Integration
```python
class LeadModel(TenantScopedModel):
    search_vector = SearchVectorField(null=True)

    class Meta:
        indexes = [
            GinIndex(fields=["search_vector"], name="idx_leads_search_vector"),
        ]

# Query
from django.contrib.postgres.search import SearchQuery, SearchRank, SearchVector

LeadModel.objects.annotate(
    rank=SearchRank("search_vector", SearchQuery("acme corp"))
).filter(rank__gte=0.1).order_by("-rank")
```

### Searchable Entities
| Entity | Weight A | Weight B | Weight C |
|--------|----------|----------|----------|
| Lead | company_name | email, website, phone | description, notes |
| Contact | full_name | email, phone, job_title | notes |
| Account | name | domain, industry | description |
| Opportunity | title | account_name | notes |
| Task | subject | description | — |

---

## 8. Vector Storage (pgvector)

### Enable Extension
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### Column Definition
```sql
ALTER TABLE leads ADD COLUMN embedding vector(1536);  -- OpenAI text-embedding-3-small
ALTER TABLE leads ADD COLUMN embedding_updated_at timestamptz;
```

### Django Model Field
```python
from pgvector.django import VectorField

class LeadModel(TenantScopedModel):
    embedding = VectorField(dimensions=1536, null=True)
    embedding_updated_at = DateTimeField(null=True)
```

### Indexes

**IVFFlat** (Inverted File with Flat — good for approximate search):
```sql
CREATE INDEX idx_leads_embedding_ivfflat
ON leads USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```
- Number of lists: `sqrt(n_rows)` for up to 1M rows, `n_rows / 1000` for larger.
- Trade-off: faster build, slower query than HNSW for high-accuracy needs.

**HNSW** (Hierarchical Navigable Small World — better accuracy):
```sql
CREATE INDEX idx_leads_embedding_hnsw
ON leads USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 200);
```
- `m`: 16-64 (higher = better recall, slower build).
- `ef_construction`: 100-300 (higher = better recall, slower build).
- Default: `m=16, ef_construction=200`.
- Preferred for production when recall > 95% required.

### Query
```python
from pgvector.django import CosineDistance

# Find semantically similar leads
similar = LeadModel.objects.alias(
    distance=CosineDistance("embedding", query_vector)
).filter(
    distance__lte=0.3
).order_by("distance")[:20]
```

### Embedding Strategy
- Embeddings generated by AI Gateway via batch Celery task.
- Re-embed on update of significant fields (company_name, description, etc.).
- Stale embedding detection: `WHERE embedding IS NULL OR embedding_updated_at < updated_at`.
- `ivfflat.probes = 5` for balanced performance.

---

## 9. Partitioning

### When to Partition
- Tables > 10 GB or > 100M rows.
- Append-heavy tables (audit, activity logs, AI queries).
- Clear partitioning key (time range or list).

### Range Partitioning (Monthly)
```sql
CREATE TABLE audit_events (
    id UUID NOT NULL DEFAULT gen_uuid_v7(),
    organization_id UUID,
    actor_id UUID,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE TABLE audit_events_2026_07 PARTITION OF audit_events
FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');

CREATE TABLE audit_events_2026_08 PARTITION OF audit_events
FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');

-- Create partitions proactively (3 months ahead via cron)
CREATE TABLE audit_events_2026_09 PARTITION OF audit_events
FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
```

Suitable tables: `audit_events`, `activities`, `ai_queries`, `notifications`.

### List Partitioning
```sql
CREATE TABLE organizations (
    id UUID NOT NULL DEFAULT gen_uuid_v7(),
    name VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, status)
) PARTITION BY LIST (status);

CREATE TABLE organizations_active PARTITION OF organizations
FOR VALUES IN ('active', 'trial', 'limited');

CREATE TABLE organizations_inactive PARTITION OF organizations
FOR VALUES IN ('suspended', 'cancelled', 'archived');
```

### Django Partitioning
Django does not natively create partitions. Use raw SQL in migrations:
```python
from django.db import migrations

class Migration(migrations.Migration):
    operations = [
        migrations.RunSQL(
            sql="""
                CREATE TABLE audit_events_2026_07 PARTITION OF audit_events
                FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
            """,
            reverse_sql="DROP TABLE IF EXISTS audit_events_2026_07;",
        ),
    ]
```

### Partition Management
- Monthly partition creation: cron job running 3 months ahead.
- Partition detach + compress: after 6 months, detach partitions and enable pgroll compression.
- Partition drop: after retention period (audit: 3 years, activity: 1 year).

---

## 10. Row-Level Security (RLS)

### Enable on All Tenant Tables
```sql
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads FORCE ROW LEVEL SECURITY;
```

### Policy Template
```sql
-- SELECT: users can only see their own org's data
CREATE POLICY leads_select_tenant ON leads
FOR SELECT
USING (organization_id = current_setting('app.current_org_id')::uuid);

-- INSERT: users can only insert into their own org
CREATE POLICY leads_insert_tenant ON leads
FOR INSERT
WITH CHECK (organization_id = current_setting('app.current_org_id')::uuid);

-- UPDATE: users can only update their own org's data
CREATE POLICY leads_update_tenant ON leads
FOR UPDATE
USING (organization_id = current_setting('app.current_org_id')::uuid)
WITH CHECK (organization_id = current_setting('app.current_org_id')::uuid);

-- DELETE: users can only soft-delete their own org's data
CREATE POLICY leads_delete_tenant ON leads
FOR DELETE
USING (organization_id = current_setting('app.current_org_id')::uuid);
```

### System User Bypass
```sql
-- System admins can bypass RLS
CREATE POLICY leads_admin_all ON leads
FOR ALL
USING (current_setting('app.user_role') = 'system_admin')
WITH CHECK (current_setting('app.user_role') = 'system_admin');
```

### Django Middleware Integration
```python
class RLSMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        org_id = getattr(request, 'org_id', None)
        if org_id:
            with connection.cursor() as cursor:
                cursor.execute(
                    "SET app.current_org_id = %s", [str(org_id)]
                )
                cursor.execute(
                    "SET app.user_role = %s", [request.user.role or 'user']
                )
        return self.get_response(request)
```

### Policy Naming Convention
```
{table}_{action}_{scope}
```
Examples:
- `leads_select_tenant`
- `leads_insert_tenant`
- `leads_update_tenant`
- `leads_delete_tenant`
- `leads_admin_all`

### Automated Verification Query
```sql
-- List all tables without RLS enabled
SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class
WHERE relkind = 'r'
  AND relnamespace = 'public'::regnamespace
  AND relname NOT IN ('django_migrations', 'django_content_type', 'django_session', 'auth_permission', 'auth_group')
  AND NOT relrowsecurity;

-- List all tables with RLS enabled but not forced
SELECT relname
FROM pg_class
WHERE relkind = 'r'
  AND relrowsecurity
  AND NOT relforcerowsecurity;
```

### RLS Testing (Critical)
Every CI run must verify RLS is correctly isolating tenants:
```python
def test_tenant_isolation_no_cross_tenant_data_leak() -> None:
    org_a = OrganizationModelFactory()
    org_b = OrganizationModelFactory()
    user_a = UserModelFactory(organization=org_a)

    LeadModelFactory(organization=org_a, company_name="OrgALead")
    LeadModelFactory(organization=org_b, company_name="OrgBLead")

    # Authenticate as user_a
    self.client.force_authenticate(user=user_a)
    with self.capture_on_commit_callbacks(execute=True):
        connection.settings_dict['OPTIONS'] = {'options': f'-c app.current_org_id={org_a.id}'}

    response = self.client.get("/api/v1/leads/")
    assert response.status_code == 200
    lead_names = [lead["companyName"] for lead in response.data["results"]]
    assert "OrgALead" in lead_names
    assert "OrgBLead" not in lead_names  # CRITICAL: cross-tenant leak
```

---

## 11. Migration Strategy

### Migration Workflow
```bash
# Create a new migration
./manage.py makemigrations lead_management

# Apply migration
./manage.py migrate

# Check SQL
./manage.py sqlmigrate lead_management 0002

# Test migration forward and backward
./manage.py migrate lead_management 0001
./manage.py migrate lead_management 0002
./manage.py migrate lead_management 0001
```

### Zero-Downtime Migration Pattern

**Phase 1: Expand (additive only)**
```python
operations = [
    migrations.AddField(
        model_name='leadmodel',
        name='company_size',
        field=models.CharField(max_length=20, null=True, blank=True),
    ),
]
```
Safe: adding nullable columns, creating indexes concurrently.

**Phase 2: Migrate data (background)**
```bash
# Separate deployment step - not in the same migration
./manage.py backfill_company_size &
```

**Phase 3: Contract (after confirming data is populated)**
```python
operations = [
    migrations.AlterField(
        model_name='leadmodel',
        name='company_size',
        field=models.CharField(max_length=20, null=False, blank=False),
    ),
    migrations.RemoveField(
        model_name='leadmodel',
        name='old_field',
    ),
]
```

### Squash Migrations
- Squash quarterly: `v1`, `v2`, `v3`.
- After squashing, all intermediate migrations are replaced.
- Update `replaces` attribute in squashed migration.
- Run `./manage.py squashmigrations lead_management 0001 0050`.
- Delete squashed files after confirming.

### Migration Checklist
- [ ] Migration tested forward AND backward?
- [ ] No `RunSQL` that locks tables for extended periods?
- [ ] `CREATE INDEX CONCURRENTLY` used for large tables?
- [ ] Data migrations done in management commands, not migrations?
- [ ] Migration tested against a copy of production data?

### Forbidden Operations on Large Tables
- `ALTER TABLE ... ADD COLUMN DEFAULT <volatile>` — locks table.
- `CREATE INDEX` without `CONCURRENTLY` — locks table.
- `ALTER COLUMN ... TYPE ...` — locks table.
- `DROP COLUMN` — safe (PostgreSQL just marks column as dropped).

---

## 12. Soft Delete Pattern

### Implementation
```python
class SoftDeleteQuerySet(models.QuerySet):
    def active(self):
        return self.filter(deleted_at__isnull=True)

    def deleted(self):
        return self.filter(deleted_at__isnull=False)

class SoftDeleteManager(models.Manager):
    def get_queryset(self):
        return SoftDeleteQuerySet(self.model, using=self._db).active()

    def all_with_deleted(self):
        return SoftDeleteQuerySet(self.model, using=self._db)

class SoftDeleteModel(models.Model):
    deleted_at = models.DateTimeField(null=True, blank=True)

    objects = SoftDeleteManager()

    def soft_delete(self) -> None:
        self.deleted_at = timezone.now()
        self.save(update_fields=["deleted_at", "updated_at"])

    def restore(self) -> None:
        self.deleted_at = None
        self.save(update_fields=["deleted_at", "updated_at"])

    class Meta:
        abstract = True
```

### Query Rules
- All queries use `WHERE deleted_at IS NULL` (via `SoftDeleteManager`).
- Exception: admin panels may show deleted records.
- Unique constraints must be partial (`WHERE deleted_at IS NULL`) to allow "deleted" duplicates.

### Unique Constraints with Soft Delete
```python
class Meta:
    constraints = [
        models.UniqueConstraint(
            fields=["organization", "email"],
            condition=models.Q(deleted_at__isnull=True),
            name="uq_active_leads_org_email",
        ),
    ]
```

### Django Admin Integration
```python
class LeadModelAdmin(admin.ModelAdmin):
    def get_queryset(self, request):
        return LeadModel.all_objects.all()  # bypass soft delete filter

    actions = ["soft_delete_selected", "restore_selected"]
```

### Foreign Key Considerations
- For soft-deleted parent records: `on_delete=models.SET_NULL` or `PROTECT`.
- Never cascade delete to child records; mark children as deleted via a management command.

---

## 13. Connection Management

### PgBouncer
- Transaction pooling mode.
- Do NOT use session-level features with PgBouncer (e.g., `LISTEN/NOTIFY`, `SET LOCAL`).
- Use `SET app.current_org_id` via `connection.incr_counter` — not session-wide.
- Connection strings:
  ```
  pgbouncer://user:pass@pgbouncer:6432/tzahu?application_name=django
  ```

### Django DATABASES
```python
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "OPTIONS": {
            "application_name": "tzahu-backend",
            "connect_timeout": 5,
            "options": "-c statement_timeout=30s -c idle_in_transaction_session_timeout=60s",
        },
        "CONN_MAX_AGE": 60,
        "CONN_HEALTH_CHECKS": True,
    }
}
```

### Connection Pool Sizing
```
Pool size = ((core_count * 2) + effective_spindle_count) * connection_pool_ratio
```
- Django (4 workers × 10 threads × 0.5 ratio) = 20 connections
- Celery (8 workers × 5 threads × 0.5 ratio) = 20 connections
- AI Gateway (4 workers × 10 threads × 0.3 ratio) = 12 connections
- Total: ~52 connections per host

---

## 14. Backup & Recovery

### Backup Schedule
| Type | Frequency | Retention | Method |
|------|-----------|-----------|--------|
| Full | Daily | 30 days | `pg_dump -Fc` |
| WAL | Continuous | 7 days | `archive_command` + S3 |
| Logical | Weekly | 90 days | `pg_dumpall` |
| Snapshot | Pre-deployment | 48 hours | RDS snapshot |

### Backup Script
```bash
#!/bin/bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
pg_dump -Fc \
  -h $DB_HOST \
  -U $DB_USER \
  -d $DB_NAME \
  --exclude-table="audit_events_*" \
  --exclude-table="activities_*" \
  -f /backups/tzahu_${TIMESTAMP}.dump

# Upload to S3
aws s3 cp /backups/tzahu_${TIMESTAMP}.dump s3://tzahu-backups/db/
```

### Recovery Test
- Full restore tested quarterly.
- Point-in-time recovery tested monthly.
- Document RTO: 1 hour, RPO: 5 minutes.

---

## 15. Performance Monitoring

### Query Logging
```python
# dev.py
LOGGING["loggers"]["django.db.backends"] = {
    "handlers": ["console"],
    "level": "DEBUG",
}
```

### Slow Query Log
```ini
# postgresql.conf
log_min_duration_statement = 500  # ms
log_connections = on
log_disconnections = on
log_lock_waits = on
```

### Metrics to Monitor
| Metric | Threshold | Alert |
|--------|-----------|-------|
| Connection count | > 150 | Warning |
| Active connections | > 100 | Critical |
| Long-running queries | > 30s | Critical |
| Cache hit ratio | < 95% | Warning |
| Dead tuples ratio | > 20% | Warning |
| Replication lag | > 10s | Critical |
| Index bloat | > 30% | Warning |
| Vacuum age | > 100M txns | Critical |
| Table size growth | > 10GB/week | Warning |

### EXPLAIN ANALYZE Template
```sql
EXPLAIN (ANALYZE, BUFFERS, TIMING, FORMAT JSON)
SELECT * FROM leads
WHERE organization_id = '...'
  AND status = 'new'
  AND deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 25;
```

### Django Debug Toolbar
- Enabled in `dev.py` only.
- Show SQL, cache, signals, timings.
- Flag views with > 10 queries or > 50ms query time.
