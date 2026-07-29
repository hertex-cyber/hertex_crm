# Database Schema — Design Overview

## Design Philosophy

The TZAHU CRM database is designed for **multi-tenancy**, **performance**, **consistency**, and **extensibility**. Every design decision prioritizes tenant isolation, query performance at scale (100+ tenants, millions of records), and maintainability across schema versions.

### Core Principles

1. **Shared Schema + RLS:** Single PostgreSQL database with Row-Level Security for tenant isolation (see ADR-003)
2. **UUID v7 Primary Keys:** Time-ordered UUIDs for B-tree index performance (see ADR-004)
3. **Universal Columns:** Every table includes `id`, `tenant_id`, `created_at`, `updated_at`, `is_deleted`
4. **Convention Over Configuration:** Consistent naming, column types, and indexing patterns
5. **Embedding-Ready:** pgvector support for AI features (semantic search, embeddings)
6. **Search-Ready:** tsvector columns for full-text search (see ADR-006)
7. **Audit-Ready:** `created_by`, `updated_by` tracking on all tables

## UUID v7 Strategy

- **All primary keys:** `UUID PRIMARY KEY DEFAULT uuid_generate_v7()`
- **All foreign keys:** `UUID REFERENCES parent_table(id)`
- **All tenant IDs:** `UUID NOT NULL`
- **PostgreSQL extension:** `pg_uuidv7` for server-side UUID v7 generation
- **Application fallback:** Python `uuid7()` function if extension unavailable

```sql
CREATE EXTENSION IF NOT EXISTS pg_uuidv7;

-- Custom function for default value
CREATE OR REPLACE FUNCTION uuid_v7() RETURNS uuid
LANGUAGE sql PARALLEL SAFE
AS $$ SELECT uuid_generate_v7(); $$;
```

## Universal Columns (Present in Every Table)

```sql
id              UUID PRIMARY KEY DEFAULT uuid_v7(),
tenant_id       UUID NOT NULL REFERENCES core_tenant(id),
created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
created_by      UUID REFERENCES core_user(id),
updated_by      UUID REFERENCES core_user(id),
is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,
```

## Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Database | snake_case | `tzahu_crm` |
| Schema | snake_case | `crm`, `core`, `analytics` |
| Table | `{module}_{entity}` | `lead_lead`, `pipeline_opportunity` |
| Column | snake_case | `first_name`, `expected_close_date` |
| Primary Key | `id` | `id UUID PRIMARY KEY` |
| Foreign Key | `{referenced_table}_id` | `owner_id`, `tenant_id` |
| Index | `ix_{table}_{columns}` | `ix_lead_tenant_status` |
| Unique Constraint | `uq_{table}_{columns}` | `uq_lead_tenant_email` |
| Check Constraint | `ck_{table}_{description}` | `ck_lead_score_range` |
| Trigger | `trg_{table}_{action}` | `trg_lead_updated_at` |

## Column Types Reference

| Concept | PostgreSQL Type | Notes |
|---------|----------------|-------|
| Primary Key | `UUID` | UUID v7, default `uuid_v7()` |
| Tenant ID | `UUID` | FK to `core_tenant` |
| Foreign Key | `UUID` | Nullable references |
| Short String | `VARCHAR(255)` | Names, titles, emails |
| Long String | `TEXT` | Descriptions, notes |
| Enum | `VARCHAR(50)` with CHECK | Status, type, category |
| Money | `DECIMAL(15,2)` | Amounts, prices |
| Percentage | `DECIMAL(5,2)` | 0-100 values |
| Integer | `INTEGER` or `SMALLINT` | Counts, scores |
| Date | `DATE` | Close dates, birth dates |
| Timestamp | `TIMESTAMPTZ` | All timestamps with timezone |
| JSON | `JSONB` | Flexible data, custom fields |
| Array | `TEXT[]` | Tags, multi-select |
| Vector | `vector(1536)` | pgvector embeddings |
| Search | `TSVECTOR` | Full-text search vectors |
| Boolean | `BOOLEAN` | Flags, is_active, is_deleted |
| Phone | `VARCHAR(20)` | E.164 format |
| Email | `VARCHAR(255)` | With unique constraint |
| URL | `TEXT` | With CHECK (starts with http) |

## Indexing Strategy

### Mandatory Indexes (every module)
- `(tenant_id, created_at DESC)` — Time-based listing
- `(tenant_id, id)` — Tenant-scoped lookups
- `(tenant_id, is_deleted)` — Soft-delete filtering

### Common Index Patterns
```sql
-- Composite B-tree for common query patterns
CREATE INDEX ix_lead_tenant_status ON lead_lead(tenant_id, status);

-- Partial index for active records
CREATE INDEX ix_lead_tenant_active ON lead_lead(tenant_id, status)
  WHERE is_deleted = FALSE AND status NOT IN ('CONVERTED', 'JUNK');

-- GIN for full-text search
CREATE INDEX ix_lead_search ON lead_lead USING GIN(_search_vector);

-- GIN for JSONB queries
CREATE INDEX ix_lead_custom_fields ON lead_lead USING GIN(custom_fields);

-- GIN for array queries
CREATE INDEX ix_lead_tags ON lead_lead USING GIN(tags);

-- GiST for pg_trgm fuzzy search
CREATE INDEX ix_lead_email_trgm ON lead_lead USING GIST(email gin_trgm_ops);

-- IVFFlat for pgvector
CREATE INDEX ix_embedding_vector ON ai_embedding USING IVFFLAT(embedding vector_cosine_ops)
  WITH (lists = 100);
```

## Row-Level Security (RLS)

### Template for Every Tenant-Scoped Table

```sql
ALTER TABLE {schema}.{table} ENABLE ROW LEVEL SECURITY;

CREATE POLICY {table}_tenant_isolation ON {schema}.{table}
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

### Admin/Superuser Bypass

```sql
CREATE POLICY {table}_admin_access ON {schema}.{table}
  FOR ALL
  USING (current_setting('app.bypass_rls', TRUE)::boolean = TRUE);
```

### RLS Functions

```sql
-- Set in Django middleware
SELECT set_config('app.current_tenant_id', %s, TRUE);  -- tenant_id
SELECT set_config('app.current_user_id', %s, TRUE);     -- user_id
SELECT set_config('app.current_role', %s, TRUE);        -- role
SELECT set_config('app.bypass_rls', 'false', TRUE);     -- bypass flag
```

## Migration Strategy

### Tools
- **Primary:** Django migrations (`python manage.py makemigrations && migrate`)
- **Data migrations:** Django RunPython migrations
- **Schema changes:** Manual SQL for complex operations (pgvector, RLS, triggers)
- **Version control:** All migrations committed to Git

### Migration Best Practices

1. **One concept per migration:** Don't mix schema, data, and index changes
2. **Backward compatible:** New columns must be nullable or have defaults
3. **No data loss:** Rename columns in two phases (add new → migrate data → drop old)
4. **Zero-downtime readiness:** Use `--atomic` for transactional safety
5. **RLS in migrations:** Every CREATE TABLE includes ALTER ENABLE RLS + CREATE POLICY
6. **Indexing after data:** Create indexes after bulk data loads (for large tenants)

```python
# Example: Safe column rename
operations = [
    migrations.AddField(
        model_name='lead',
        name='status_new',
        field=models.CharField(max_length=20, null=True),
    ),
    migrations.RunSQL(
        "UPDATE lead_lead SET status_new = status::text;",
        migrations.RunSQL.noop,
    ),
    migrations.RemoveField(model_name='lead', name='status'),
    migrations.RenameField('lead', 'status_new', 'status'),
]
```

## Partitioning Strategy

High-volume tables partitioned by time:

```sql
-- Audit log partitioned by month
CREATE TABLE analytics_auditlog (
    id UUID DEFAULT uuid_v7(),
    tenant_id UUID NOT NULL,
    event_type VARCHAR(100),
    entity_type VARCHAR(100),
    entity_id UUID,
    changes JSONB,
    actor_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- Create monthly partitions
CREATE TABLE analytics_auditlog_2025_07
  PARTITION OF analytics_auditlog
  FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');

CREATE TABLE analytics_auditlog_2025_08
  PARTITION OF analytics_auditlog
  FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');
```

## Schema Organization

| Schema | Purpose | Tables |
|--------|---------|--------|
| `core` | Shared kernel, identity, tenants | `tenant`, `user`, `role`, `permission`, `team`, `auditlog` |
| `crm` | Lead, contact, account, pipeline, opportunity | `lead`, `contact`, `account`, `pipeline`, `opportunity` |
| `workflow` | Workflow engine | `workflow_definition`, `workflow_execution`, etc. |
| `ai` | AI platform | `model`, `embedding`, `prompt_template`, `rag_pipeline` |
| `integration` | Integration hub | `integration`, `credential`, `webhook_endpoint`, `sync_job` |
| `analytics` | Reports, dashboards, event store | `report`, `dashboard`, `event_log`, `search_index` |

## Related Documents

- `Core_Schema.md` — Core identity and multi-tenancy tables
- `CRM_Schema.md` — Lead, pipeline, and opportunity tables
- `Analytics_Schema.md` — Analytics, reporting, and event store tables
- `ArchitectureDecisionRecords/ADR-003-Database-Isolation.md`
- `ArchitectureDecisionRecords/ADR-004-ID-Strategy.md`
