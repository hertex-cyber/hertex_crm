# Analytics Schema — Reports, Dashboards, Audit Log, Event Log, Search Index

Schema: `analytics`

## Tables

### analytics_report

```sql
CREATE TABLE analytics_report (
    id              UUID PRIMARY KEY DEFAULT uuid_v7(),
    tenant_id       UUID NOT NULL REFERENCES core_tenant(id),
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    report_type     VARCHAR(50) NOT NULL
                        CHECK (report_type IN ('PIPELINE', 'LEAD_CONVERSION', 'ACTIVITY',
                                                'FORECAST', 'WON_LOSS', 'PERFORMANCE', 'CUSTOM')),
    source_module   VARCHAR(50) NOT NULL,
    config          JSONB NOT NULL DEFAULT '{}',
        -- config: { measures: [...], dimensions: [...], filters: [...], sorts: [...] }
    schedule_config JSONB,
        -- schedule_config: { frequency: 'daily'|'weekly'|'monthly', hour: 8, day_of_week: 1, emails: [...] }
    is_auto_generated BOOLEAN NOT NULL DEFAULT FALSE,
    is_shared        BOOLEAN NOT NULL DEFAULT FALSE,
    owner_id        UUID REFERENCES core_user(id),
    last_run_at     TIMESTAMPTZ,
    last_run_status VARCHAR(20) DEFAULT 'never'
                        CHECK (last_run_status IN ('never', 'success', 'failed', 'running')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by      UUID REFERENCES core_user(id),
    updated_by      UUID REFERENCES core_user(id),
    is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,

    CONSTRAINT uq_report_tenant_name UNIQUE (tenant_id, name)
);

ALTER TABLE analytics_report ENABLE ROW LEVEL SECURITY;
CREATE POLICY report_tenant_isolation ON analytics_report
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE INDEX ix_report_tenant_owner ON analytics_report(tenant_id, owner_id);
CREATE INDEX ix_report_tenant_type ON analytics_report(tenant_id, report_type);
```

### analytics_report_snapshot

```sql
CREATE TABLE analytics_report_snapshot (
    id              UUID PRIMARY KEY DEFAULT uuid_v7(),
    report_id       UUID NOT NULL REFERENCES analytics_report(id) ON DELETE CASCADE,
    tenant_id       UUID NOT NULL REFERENCES core_tenant(id),
    snapshot_data   JSONB NOT NULL,
    period_start    DATE NOT NULL,
    period_end      DATE NOT NULL,
    row_count       INTEGER NOT NULL DEFAULT 0,
    generated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    generated_by    UUID REFERENCES core_user(id)
);

ALTER TABLE analytics_report_snapshot ENABLE ROW LEVEL SECURITY;
CREATE POLICY reportsnap_tenant_isolation ON analytics_report_snapshot
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE INDEX ix_reportsnap_report ON analytics_report_snapshot(report_id, period_start DESC);
CREATE INDEX ix_reportsnap_period ON analytics_report_snapshot(tenant_id, period_start, period_end);
```

### analytics_dashboard

```sql
CREATE TABLE analytics_dashboard (
    id              UUID PRIMARY KEY DEFAULT uuid_v7(),
    tenant_id       UUID NOT NULL REFERENCES core_tenant(id),
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    layout          JSONB NOT NULL DEFAULT '[]',
        -- layout: [{ widget_id, position: {x, y, w, h}, config: {...} }]
    is_default      BOOLEAN NOT NULL DEFAULT FALSE,
    is_shared       BOOLEAN NOT NULL DEFAULT FALSE,
    owner_id        UUID REFERENCES core_user(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by      UUID REFERENCES core_user(id),
    updated_by      UUID REFERENCES core_user(id),
    is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,

    CONSTRAINT uq_dashboard_tenant_name UNIQUE (tenant_id, name)
);

ALTER TABLE analytics_dashboard ENABLE ROW LEVEL SECURITY;
CREATE POLICY dashboard_tenant_isolation ON analytics_dashboard
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE INDEX ix_dashboard_tenant_owner ON analytics_dashboard(tenant_id, owner_id);
```

### analytics_dashboard_widget

```sql
CREATE TABLE analytics_dashboard_widget (
    id              UUID PRIMARY KEY DEFAULT uuid_v7(),
    dashboard_id    UUID NOT NULL REFERENCES analytics_dashboard(id) ON DELETE CASCADE,
    tenant_id       UUID NOT NULL REFERENCES core_tenant(id),
    widget_type     VARCHAR(50) NOT NULL
                        CHECK (widget_type IN ('KPI', 'CHART_BAR', 'CHART_LINE', 'CHART_PIE',
                                               'TABLE', 'METRIC', 'PIPELINE', 'FORECAST', 'RECENT_ACTIVITY')),
    title           VARCHAR(255) NOT NULL,
    config          JSONB NOT NULL DEFAULT '{}',
        -- config: { data_source, measure, dimension, aggregation, filters, ... }
    position_x      INTEGER NOT NULL DEFAULT 0,
    position_y      INTEGER NOT NULL DEFAULT 0,
    width           INTEGER NOT NULL DEFAULT 3,
    height          INTEGER NOT NULL DEFAULT 2,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE analytics_dashboard_widget ENABLE ROW LEVEL SECURITY;
CREATE POLICY widget_tenant_isolation ON analytics_dashboard_widget
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE INDEX ix_widget_dashboard ON analytics_dashboard_widget(dashboard_id);
```

### analytics_event_log

Event sourcing / domain event store for analytics processing. Append-only, high write volume.

```sql
CREATE TABLE analytics_event_log (
    id              UUID NOT NULL DEFAULT uuid_v7(),
    tenant_id       UUID NOT NULL,
    event_type      VARCHAR(255) NOT NULL,
    aggregate_type  VARCHAR(100) NOT NULL,
    aggregate_id    UUID NOT NULL,
    event_data      JSONB NOT NULL,
    metadata        JSONB NOT NULL DEFAULT '{}',
    correlation_id  UUID,
    causation_id    UUID,
    occurred_at     TIMESTAMPTZ NOT NULL,
    ingested_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (occurred_at);

-- Monthly partitions
CREATE TABLE analytics_event_log_2025_07
    PARTITION OF analytics_event_log
    FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');
CREATE TABLE analytics_event_log_2025_08
    PARTITION OF analytics_event_log
    FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');

ALTER TABLE analytics_event_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY eventlog_tenant_isolation ON analytics_event_log
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE INDEX ix_eventlog_tenant_type ON analytics_event_log(tenant_id, event_type, occurred_at DESC);
CREATE INDEX ix_eventlog_aggregate ON analytics_event_log(aggregate_type, aggregate_id, occurred_at DESC);
CREATE INDEX ix_eventlog_correlation ON analytics_event_log(correlation_id);
CREATE INDEX ix_eventlog_occurred ON analytics_event_log(occurred_at DESC);
```

### analytics_audit_log

Detailed audit trail of data changes across all modules. Partitioned by month.

```sql
CREATE TABLE analytics_audit_log (
    id              UUID NOT NULL DEFAULT uuid_v7(),
    tenant_id       UUID NOT NULL REFERENCES core_tenant(id),
    actor_id        UUID REFERENCES core_user(id),
    actor_email     VARCHAR(255),
    event_type      VARCHAR(100) NOT NULL,
    entity_type     VARCHAR(100) NOT NULL,
    entity_id       UUID NOT NULL,
    entity_label    VARCHAR(255),
    changes         JSONB,
    -- changes: { field_name: { old: ..., new: ... } }
    diff_summary    TEXT,
    ip_address      INET,
    user_agent      TEXT,
    request_id      VARCHAR(255),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- Monthly partitions
CREATE TABLE analytics_audit_log_2025_07
    PARTITION OF analytics_audit_log
    FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');
CREATE TABLE analytics_audit_log_2025_08
    PARTITION OF analytics_audit_log
    FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');

ALTER TABLE analytics_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY auditlog_tenant_isolation ON analytics_audit_log
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE INDEX ix_auditlog_tenant_entity ON analytics_audit_log(tenant_id, entity_type, entity_id, created_at DESC);
CREATE INDEX ix_auditlog_tenant_event ON analytics_audit_log(tenant_id, event_type, created_at DESC);
CREATE INDEX ix_auditlog_tenant_actor ON analytics_audit_log(tenant_id, actor_id, created_at DESC);
CREATE INDEX ix_auditlog_created ON analytics_audit_log(created_at DESC);
```

### analytics_search_index

Materialized search index for cross-entity search (leads, contacts, accounts, opportunities).

```sql
CREATE TABLE analytics_search_index (
    id              UUID PRIMARY KEY DEFAULT uuid_v7(),
    tenant_id       UUID NOT NULL REFERENCES core_tenant(id),
    entity_type     VARCHAR(50) NOT NULL,
    entity_id       UUID NOT NULL,
    title           VARCHAR(500) NOT NULL,
    description     TEXT,
    keywords        TEXT[] NOT NULL DEFAULT '{}',
    entity_data     JSONB NOT NULL DEFAULT '{}',
    _search_vector  TSVECTOR,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_search_entity UNIQUE (entity_type, entity_id)
);

ALTER TABLE analytics_search_index ENABLE ROW LEVEL SECURITY;
CREATE POLICY searchindex_tenant_isolation ON analytics_search_index
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE INDEX ix_searchindex_tenant_type ON analytics_search_index(tenant_id, entity_type);
CREATE INDEX ix_searchindex_search ON analytics_search_index USING GIN(_search_vector);
CREATE INDEX ix_searchindex_keywords ON analytics_search_index USING GIN(keywords);
```

### analytics_user_activity_log

Per-user activity tracking for analytics, recommendation, and usage insights.

```sql
CREATE TABLE analytics_user_activity_log (
    id              UUID NOT NULL DEFAULT uuid_v7(),
    tenant_id       UUID NOT NULL REFERENCES core_tenant(id),
    user_id         UUID NOT NULL REFERENCES core_user(id),
    activity_type   VARCHAR(50) NOT NULL,
        -- activity_type: 'page_view', 'api_call', 'login', 'export', 'create', 'update', 'delete'
    entity_type     VARCHAR(50),
    entity_id       UUID,
    metadata        JSONB NOT NULL DEFAULT '{}',
    -- metadata: { path: '/leads', method: 'GET', duration_ms: 150, ... }
    session_id      VARCHAR(255),
    ip_address      INET,
    user_agent      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- Monthly partitions
CREATE TABLE analytics_user_activity_log_2025_07
    PARTITION OF analytics_user_activity_log
    FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');
CREATE TABLE analytics_user_activity_log_2025_08
    PARTITION OF analytics_user_activity_log
    FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');

ALTER TABLE analytics_user_activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY useractivity_tenant_isolation ON analytics_user_activity_log
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE INDEX ix_useractivity_tenant_user ON analytics_user_activity_log(tenant_id, user_id, created_at DESC);
CREATE INDEX ix_useractivity_tenant_type ON analytics_user_activity_log(tenant_id, activity_type, created_at DESC);
CREATE INDEX ix_useractivity_created ON analytics_user_activity_log(created_at DESC);
```

### analytics_materialized_metrics

Pre-computed metrics for dashboards, refreshed on schedule or event trigger.

```sql
CREATE TABLE analytics_materialized_metrics (
    id                  UUID PRIMARY KEY DEFAULT uuid_v7(),
    tenant_id           UUID NOT NULL REFERENCES core_tenant(id),
    metric_key          VARCHAR(255) NOT NULL,
    period_start        DATE NOT NULL,
    period_end          DATE NOT NULL,
    metric_value        JSONB NOT NULL,
    dimension_values    JSONB NOT NULL DEFAULT '{}',
    refreshed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_metric_period_key UNIQUE (tenant_id, metric_key, period_start, period_end)
);

ALTER TABLE analytics_materialized_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY metrics_tenant_isolation ON analytics_materialized_metrics
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE INDEX ix_metrics_tenant_key ON analytics_materialized_metrics(tenant_id, metric_key, period_start DESC);
```

## Functions & Maintenance

### Audit Log Trigger (Generic)

```sql
CREATE OR REPLACE FUNCTION log_entity_changes()
RETURNS TRIGGER AS $$
DECLARE
    changes_json JSONB;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        changes_json := '{}'::JSONB;
        -- Capture changed columns (excluding internal fields)
        FOR col IN
            SELECT key FROM jsonb_each(to_jsonb(NEW))
            WHERE key NOT IN ('updated_at', '_search_vector', 'updated_by')
        LOOP
            IF to_jsonb(OLD)::jsonb->>col IS DISTINCT FROM to_jsonb(NEW)::jsonb->>col THEN
                changes_json := changes_json ||
                    jsonb_build_object(col, jsonb_build_object(
                        'old', to_jsonb(OLD)->>col,
                        'new', to_jsonb(NEW)->>col
                    ));
            END IF;
        END LOOP;

        IF changes_json <> '{}'::JSONB THEN
            INSERT INTO analytics_audit_log (
                tenant_id, actor_id, actor_email, event_type, entity_type, entity_id,
                entity_label, changes, ip_address, user_agent, request_id
            ) VALUES (
                NEW.tenant_id,
                current_setting('app.current_user_id', TRUE)::uuid,
                NULL,
                'UPDATE',
                TG_TABLE_NAME,
                NEW.id,
                NEW.name || COALESCE(' ' || NEW.first_name || ' ' || NEW.last_name, ''),
                changes_json,
                NULL,
                NULL,
                NULL
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Event Log Cleanup (Scheduled)

```sql
-- Scheduled via pg_cron or Celery Beat
CREATE OR REPLACE FUNCTION cleanup_old_event_logs(retention_months INTEGER DEFAULT 12)
RETURNS INTEGER AS $$
DECLARE
    cutoff_date TIMESTAMPTZ;
    deleted_count INTEGER;
BEGIN
    cutoff_date := NOW() - (retention_months || ' months')::INTERVAL;

    -- Drop old partitions (safer than DELETE)
    -- For each analytics_event_log_YYYY_MM partition where month < cutoff

    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
```

### Materialized Metrics Refresh (Scheduled)

```sql
-- Refresh key metrics for dashboards
CREATE OR REPLACE FUNCTION refresh_materialized_metrics(p_tenant_id UUID)
RETURNS VOID AS $$
BEGIN
    -- Total leads by status
    INSERT INTO analytics_materialized_metrics (tenant_id, metric_key, period_start, period_end, metric_value)
    SELECT
        p_tenant_id,
        'leads_by_status',
        DATE_TRUNC('day', NOW())::DATE,
        DATE_TRUNC('day', NOW())::DATE + INTERVAL '1 day',
        jsonb_build_object(
            'total', COUNT(*),
            'new', COUNT(*) FILTER (WHERE lead_status = 'NEW'),
            'contacted', COUNT(*) FILTER (WHERE lead_status = 'CONTACTED'),
            'qualified', COUNT(*) FILTER (WHERE lead_status = 'QUALIFIED'),
            'converted', COUNT(*) FILTER (WHERE lead_status = 'CONVERTED')
        )
    FROM crm_lead
    WHERE tenant_id = p_tenant_id AND is_deleted = FALSE
    ON CONFLICT (tenant_id, metric_key, period_start, period_end)
    DO UPDATE SET metric_value = EXCLUDED.metric_value, refreshed_at = NOW();

    -- Pipeline value summary
    INSERT INTO analytics_materialized_metrics (tenant_id, metric_key, period_start, period_end, metric_value)
    SELECT
        p_tenant_id,
        'pipeline_summary',
        DATE_TRUNC('day', NOW())::DATE,
        DATE_TRUNC('day', NOW())::DATE + INTERVAL '1 day',
        jsonb_build_object(
            'total_pipeline_value', COALESCE(SUM(amount), 0),
            'weighted_pipeline', COALESCE(SUM(amount * probability / 100), 0),
            'deal_count', COUNT(*),
            'avg_deal_size', COALESCE(AVG(amount), 0)
        )
    FROM crm_opportunity
    WHERE tenant_id = p_tenant_id AND is_deleted = FALSE
      AND actual_close_date IS NULL
    ON CONFLICT (tenant_id, metric_key, period_start, period_end)
    DO UPDATE SET metric_value = EXCLUDED.metric_value, refreshed_at = NOW();
END;
$$ LANGUAGE plpgsql;
```

## Partition Management

```sql
-- Create new partition for next month (run on 25th of each month via Celery Beat)
CREATE OR REPLACE FUNCTION create_next_month_partition()
RETURNS VOID AS $$
DECLARE
    next_month DATE;
    partition_name TEXT;
    start_date TEXT;
    end_date TEXT;
BEGIN
    next_month := DATE_TRUNC('month', NOW()) + INTERVAL '1 month';
    partition_name := 'analytics_event_log_' || TO_CHAR(next_month, 'YYYY_MM');
    start_date := TO_CHAR(next_month, 'YYYY-MM-DD');
    end_date := TO_CHAR(next_month + INTERVAL '1 month', 'YYYY-MM-DD');

    EXECUTE FORMAT(
        'CREATE TABLE IF NOT EXISTS analytics.%I PARTITION OF analytics.analytics_event_log
         FOR VALUES FROM (%L) TO (%L);',
        partition_name, start_date, end_date
    );
END;
$$ LANGUAGE plpgsql;
```

## Search Index Refresh

```sql
-- Refresh search index for cross-entity search
CREATE OR REPLACE FUNCTION refresh_entity_search_index(p_tenant_id UUID)
RETURNS VOID AS $$
BEGIN
    -- Index leads
    INSERT INTO analytics_search_index (tenant_id, entity_type, entity_id, title, description, keywords, entity_data, _search_vector)
    SELECT
        tenant_id, 'lead', id,
        first_name || ' ' || last_name,
        COALESCE(company_name, '') || ' ' || COALESCE(email, ''),
        ARRAY[first_name, last_name, COALESCE(email, ''), COALESCE(company_name, '')],
        jsonb_build_object('status', lead_status, 'score', score, 'owner_id', owner_id),
        to_tsvector('english', first_name || ' ' || last_name || ' ' || COALESCE(email, ''))
    FROM crm_lead
    WHERE tenant_id = p_tenant_id AND is_deleted = FALSE
    ON CONFLICT (entity_type, entity_id)
    DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        keywords = EXCLUDED.keywords,
        entity_data = EXCLUDED.entity_data,
        _search_vector = EXCLUDED._search_vector,
        updated_at = NOW();

    -- Index contacts similarly...
    -- Index accounts similarly...
    -- Index opportunities similarly...
END;
$$ LANGUAGE plpgsql;
```
