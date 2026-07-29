# CRM Schema — Lead, Contact, Account, Pipeline, Opportunity, Activity, Task

Schema: `crm`

## Tables

### crm_lead

```sql
CREATE TABLE crm_lead (
    id                  UUID PRIMARY KEY DEFAULT uuid_v7(),
    tenant_id           UUID NOT NULL REFERENCES core_tenant(id),
    first_name          VARCHAR(255) NOT NULL,
    last_name           VARCHAR(255) NOT NULL,
    email               VARCHAR(255) NOT NULL,
    phone               VARCHAR(20),
    company_name        VARCHAR(255),
    job_title           VARCHAR(255),
    lead_source         VARCHAR(50) NOT NULL DEFAULT 'OTHER'
                            CHECK (lead_source IN ('WEBSITE', 'REFERRAL', 'COLD_CALL', 'EVENT',
                                                   'PARTNER', 'ONLINE_AD', 'EMAIL_MARKETING',
                                                   'IMPORT', 'API', 'OTHER')),
    lead_status         VARCHAR(20) NOT NULL DEFAULT 'NEW'
                            CHECK (lead_status IN ('NEW', 'CONTACTED', 'QUALIFIED', 'DISQUALIFIED', 'CONVERTED', 'JUNK')),
    score               INTEGER NOT NULL DEFAULT 0
                            CHECK (score >= 0 AND score <= 100),
    rating              VARCHAR(10) NOT NULL DEFAULT 'COLD'
                            CHECK (rating IN ('HOT', 'WARM', 'COLD')),
    owner_id            UUID REFERENCES core_user(id),
    assigned_team_id    UUID REFERENCES core_team(id),
    converted_contact_id    UUID,
    converted_account_id    UUID,
    converted_opportunity_id UUID,
    converted_at        TIMESTAMPTZ,
    last_contacted_at   TIMESTAMPTZ,
    notes               TEXT,
    tags                TEXT[] NOT NULL DEFAULT '{}',
    custom_fields       JSONB NOT NULL DEFAULT '{}',
    _search_vector      TSVECTOR,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by          UUID REFERENCES core_user(id),
    updated_by          UUID REFERENCES core_user(id),
    is_deleted          BOOLEAN NOT NULL DEFAULT FALSE,

    CONSTRAINT uq_lead_tenant_email UNIQUE (tenant_id, email, is_deleted)
);

ALTER TABLE crm_lead ENABLE ROW LEVEL SECURITY;
CREATE POLICY lead_tenant_isolation ON crm_lead
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Indexes
CREATE INDEX ix_lead_tenant_status ON crm_lead(tenant_id, lead_status) WHERE is_deleted = FALSE;
CREATE INDEX ix_lead_tenant_owner ON crm_lead(tenant_id, owner_id) WHERE is_deleted = FALSE;
CREATE INDEX ix_lead_tenant_score ON crm_lead(tenant_id, score DESC);
CREATE INDEX ix_lead_tenant_source ON crm_lead(tenant_id, lead_source);
CREATE INDEX ix_lead_tenant_created ON crm_lead(tenant_id, created_at DESC);
CREATE INDEX ix_lead_tenant_rating ON crm_lead(tenant_id, rating);
CREATE INDEX ix_lead_search ON crm_lead USING GIN(_search_vector);
CREATE INDEX ix_lead_tags ON crm_lead USING GIN(tags);
CREATE INDEX ix_lead_custom_fields ON crm_lead USING GIN(custom_fields);
CREATE INDEX ix_lead_email_trgm ON crm_lead USING GIST(email gin_trgm_ops);
CREATE INDEX ix_lead_name_trgm ON crm_lead USING GIST(
    (COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')) gin_trgm_ops
);

-- FTS trigger
CREATE OR REPLACE FUNCTION lead_search_update() RETURNS TRIGGER AS $$
BEGIN
    NEW._search_vector := to_tsvector('english',
        COALESCE(NEW.first_name, '') || ' ' ||
        COALESCE(NEW.last_name, '') || ' ' ||
        COALESCE(NEW.email, '') || ' ' ||
        COALESCE(NEW.company_name, '') || ' ' ||
        COALESCE(NEW.job_title, '') || ' ' ||
        COALESCE(NEW.notes, '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_lead_search
    BEFORE INSERT OR UPDATE ON crm_lead
    FOR EACH ROW
    EXECUTE FUNCTION lead_search_update();
```

### crm_lead_activity

```sql
CREATE TABLE crm_lead_activity (
    id              UUID PRIMARY KEY DEFAULT uuid_v7(),
    lead_id         UUID NOT NULL REFERENCES crm_lead(id) ON DELETE CASCADE,
    tenant_id       UUID NOT NULL REFERENCES core_tenant(id),
    activity_type   VARCHAR(50) NOT NULL
                        CHECK (activity_type IN ('NOTE', 'CALL', 'EMAIL', 'MEETING', 'SMS',
                                                 'WHATSAPP', 'LINKEDIN', 'TASK', 'SYSTEM')),
    description     TEXT,
    metadata        JSONB NOT NULL DEFAULT '{}',
    created_by      UUID REFERENCES core_user(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE crm_lead_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY leadactivity_tenant_isolation ON crm_lead_activity
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE INDEX ix_leadactivity_lead ON crm_lead_activity(lead_id, created_at DESC);
CREATE INDEX ix_leadactivity_type ON crm_lead_activity(lead_id, activity_type);
```

### crm_lead_assignment_history

```sql
CREATE TABLE crm_lead_assignment_history (
    id              UUID PRIMARY KEY DEFAULT uuid_v7(),
    lead_id         UUID NOT NULL REFERENCES crm_lead(id) ON DELETE CASCADE,
    tenant_id       UUID NOT NULL REFERENCES core_tenant(id),
    previous_owner  UUID REFERENCES core_user(id),
    new_owner       UUID REFERENCES core_user(id),
    reason          VARCHAR(255),
    assigned_by     UUID REFERENCES core_user(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE crm_lead_assignment_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY leadassign_tenant_isolation ON crm_lead_assignment_history
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE INDEX ix_leadassign_lead ON crm_lead_assignment_history(lead_id);
```

### crm_lead_duplicate

```sql
CREATE TABLE crm_lead_duplicate (
    id              UUID PRIMARY KEY DEFAULT uuid_v7(),
    tenant_id       UUID NOT NULL REFERENCES core_tenant(id),
    lead_id         UUID NOT NULL REFERENCES crm_lead(id) ON DELETE CASCADE,
    duplicate_lead_id UUID NOT NULL REFERENCES crm_lead(id) ON DELETE CASCADE,
    similarity_score DECIMAL(5,2) NOT NULL
                        CHECK (similarity_score >= 0 AND similarity_score <= 1),
    matched_fields  TEXT[] NOT NULL,
    is_resolved     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at     TIMESTAMPTZ,

    CONSTRAINT uq_lead_duplicate UNIQUE (lead_id, duplicate_lead_id)
);

ALTER TABLE crm_lead_duplicate ENABLE ROW LEVEL SECURITY;
CREATE POLICY leaddup_tenant_isolation ON crm_lead_duplicate
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE INDEX ix_leaddup_lead ON crm_lead_duplicate(lead_id);
```

### crm_contact

```sql
CREATE TABLE crm_contact (
    id              UUID PRIMARY KEY DEFAULT uuid_v7(),
    tenant_id       UUID NOT NULL REFERENCES core_tenant(id),
    account_id      UUID, -- FK to crm_account (created after crm_contact, so no FK initially)
    lead_id         UUID REFERENCES crm_lead(id),
    first_name      VARCHAR(255) NOT NULL,
    last_name       VARCHAR(255) NOT NULL,
    email           VARCHAR(255) NOT NULL,
    phone           VARCHAR(20),
    mobile_phone    VARCHAR(20),
    job_title       VARCHAR(255),
    department      VARCHAR(255),
    linkedin_url    TEXT,
    avatar_url      TEXT,
    owner_id        UUID REFERENCES core_user(id),
    notes           TEXT,
    tags            TEXT[] NOT NULL DEFAULT '{}',
    custom_fields   JSONB NOT NULL DEFAULT '{}',
    _search_vector  TSVECTOR,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by      UUID REFERENCES core_user(id),
    updated_by      UUID REFERENCES core_user(id),
    is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,

    CONSTRAINT uq_contact_tenant_email UNIQUE (tenant_id, email, is_deleted)
);

ALTER TABLE crm_contact ENABLE ROW LEVEL SECURITY;
CREATE POLICY contact_tenant_isolation ON crm_contact
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE INDEX ix_contact_tenant_account ON crm_contact(tenant_id, account_id) WHERE is_deleted = FALSE;
CREATE INDEX ix_contact_tenant_owner ON crm_contact(tenant_id, owner_id) WHERE is_deleted = FALSE;
CREATE INDEX ix_contact_tenant_name ON crm_contact(tenant_id, last_name, first_name);
CREATE INDEX ix_contact_search ON crm_contact USING GIN(_search_vector);
CREATE INDEX ix_contact_tags ON crm_contact USING GIN(tags);
CREATE INDEX ix_contact_custom_fields ON crm_contact USING GIN(custom_fields);
-- FTS trigger similar to lead
```

### crm_account

```sql
CREATE TABLE crm_account (
    id              UUID PRIMARY KEY DEFAULT uuid_v7(),
    tenant_id       UUID NOT NULL REFERENCES core_tenant(id),
    name            VARCHAR(255) NOT NULL,
    domain          VARCHAR(255),
    website         TEXT,
    phone           VARCHAR(20),
    address_line1   VARCHAR(255),
    address_line2   VARCHAR(255),
    city            VARCHAR(100),
    state           VARCHAR(100),
    postal_code     VARCHAR(20),
    country         VARCHAR(100),
    industry        VARCHAR(100),
    employee_count  INTEGER,
    annual_revenue  DECIMAL(15,2),
    account_type    VARCHAR(50) DEFAULT 'customer'
                        CHECK (account_type IN ('customer', 'partner', 'vendor', 'competitor', 'other')),
    owner_id        UUID REFERENCES core_user(id),
    notes           TEXT,
    tags            TEXT[] NOT NULL DEFAULT '{}',
    custom_fields   JSONB NOT NULL DEFAULT '{}',
    _search_vector  TSVECTOR,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by      UUID REFERENCES core_user(id),
    updated_by      UUID REFERENCES core_user(id),
    is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,

    CONSTRAINT uq_account_tenant_name UNIQUE (tenant_id, name, is_deleted)
);

ALTER TABLE crm_account ENABLE ROW LEVEL SECURITY;
CREATE POLICY account_tenant_isolation ON crm_account
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE INDEX ix_account_tenant_owner ON crm_account(tenant_id, owner_id) WHERE is_deleted = FALSE;
CREATE INDEX ix_account_tenant_industry ON crm_account(tenant_id, industry);
CREATE INDEX ix_account_tenant_revenue ON crm_account(tenant_id, annual_revenue DESC);
CREATE INDEX ix_account_search ON crm_account USING GIN(_search_vector);
CREATE INDEX ix_account_tags ON crm_account USING GIN(tags);

-- Add FK from contact to account after both tables exist
ALTER TABLE crm_contact ADD CONSTRAINT fk_contact_account
    FOREIGN KEY (account_id) REFERENCES crm_account(id);
```

### crm_pipeline

```sql
CREATE TABLE crm_pipeline (
    id              UUID PRIMARY KEY DEFAULT uuid_v7(),
    tenant_id       UUID NOT NULL REFERENCES core_tenant(id),
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    is_default      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by      UUID REFERENCES core_user(id),
    updated_by      UUID REFERENCES core_user(id),
    is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,

    CONSTRAINT uq_pipeline_tenant_name UNIQUE (tenant_id, name)
);

ALTER TABLE crm_pipeline ENABLE ROW LEVEL SECURITY;
CREATE POLICY pipeline_tenant_isolation ON crm_pipeline
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

### crm_pipeline_stage

```sql
CREATE TABLE crm_pipeline_stage (
    id              UUID PRIMARY KEY DEFAULT uuid_v7(),
    pipeline_id     UUID NOT NULL REFERENCES crm_pipeline(id) ON DELETE CASCADE,
    tenant_id       UUID NOT NULL REFERENCES core_tenant(id),
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    stage_order     INTEGER NOT NULL,
    probability     DECIMAL(5,2) NOT NULL DEFAULT 0
                        CHECK (probability >= 0 AND probability <= 100),
    category        VARCHAR(50) NOT NULL
                        CHECK (category IN ('LEAD', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST')),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_stage_pipeline_order UNIQUE (pipeline_id, stage_order)
);

ALTER TABLE crm_pipeline_stage ENABLE ROW LEVEL SECURITY;
CREATE POLICY pipelinestage_tenant_isolation ON crm_pipeline_stage
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE INDEX ix_pipelinestage_pipeline ON crm_pipeline_stage(pipeline_id, stage_order);
```

### crm_opportunity

```sql
CREATE TABLE crm_opportunity (
    id                  UUID PRIMARY KEY DEFAULT uuid_v7(),
    tenant_id           UUID NOT NULL REFERENCES core_tenant(id),
    title               VARCHAR(255) NOT NULL,
    description         TEXT,
    pipeline_id         UUID NOT NULL REFERENCES crm_pipeline(id),
    stage_id            UUID NOT NULL REFERENCES crm_pipeline_stage(id),
    amount              DECIMAL(15,2) NOT NULL DEFAULT 0
                            CHECK (amount >= 0),
    currency            VARCHAR(3) NOT NULL DEFAULT 'USD',
    probability         DECIMAL(5,2) NOT NULL DEFAULT 0
                            CHECK (probability >= 0 AND probability <= 100),
    expected_close_date DATE,
    actual_close_date   DATE,
    contact_id          UUID REFERENCES crm_contact(id),
    account_id          UUID NOT NULL REFERENCES crm_account(id),
    lead_id             UUID REFERENCES crm_lead(id),
    owner_id            UUID REFERENCES core_user(id),
    deal_type           VARCHAR(20) NOT NULL DEFAULT 'NEW_BUSINESS'
                            CHECK (deal_type IN ('NEW_BUSINESS', 'RENEWAL', 'UPSELL', 'CROSS_SELL')),
    loss_reason         VARCHAR(50)
                            CHECK (loss_reason IN ('PRICE', 'COMPETITOR', 'FEATURE', 'TIMING',
                                                   'RELATIONSHIP', 'NO_DECISION', 'BUDGET', 'OTHER')),
    forecast_category   VARCHAR(20) DEFAULT 'PIPELINE'
                            CHECK (forecast_category IN ('COMMIT', 'BEST_CASE', 'PIPELINE', 'OMITTED')),
    competitors         TEXT[] NOT NULL DEFAULT '{}',
    notes               TEXT,
    tags                TEXT[] NOT NULL DEFAULT '{}',
    custom_fields       JSONB NOT NULL DEFAULT '{}',
    _search_vector      TSVECTOR,
    last_activity_at    TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by          UUID REFERENCES core_user(id),
    updated_by          UUID REFERENCES core_user(id),
    is_deleted          BOOLEAN NOT NULL DEFAULT FALSE
);

ALTER TABLE crm_opportunity ENABLE ROW LEVEL SECURITY;
CREATE POLICY opportunity_tenant_isolation ON crm_opportunity
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE INDEX ix_opportunity_tenant_stage ON crm_opportunity(tenant_id, stage_id) WHERE is_deleted = FALSE;
CREATE INDEX ix_opportunity_tenant_owner ON crm_opportunity(tenant_id, owner_id) WHERE is_deleted = FALSE;
CREATE INDEX ix_opportunity_tenant_account ON crm_opportunity(tenant_id, account_id);
CREATE INDEX ix_opportunity_tenant_amount ON crm_opportunity(tenant_id, amount DESC);
CREATE INDEX ix_opportunity_tenant_close ON crm_opportunity(tenant_id, expected_close_date);
CREATE INDEX ix_opportunity_tenant_closed ON crm_opportunity(tenant_id, actual_close_date)
    WHERE actual_close_date IS NOT NULL;
CREATE INDEX ix_opportunity_tenant_pipeline ON crm_opportunity(tenant_id, pipeline_id, stage_id);
CREATE INDEX ix_opportunity_search ON crm_opportunity USING GIN(_search_vector);
CREATE INDEX ix_opportunity_tags ON crm_opportunity USING GIN(tags);
CREATE INDEX ix_opportunity_custom_fields ON crm_opportunity USING GIN(custom_fields);
```

### crm_opportunity_line_item

```sql
CREATE TABLE crm_opportunity_line_item (
    id                  UUID PRIMARY KEY DEFAULT uuid_v7(),
    opportunity_id      UUID NOT NULL REFERENCES crm_opportunity(id) ON DELETE CASCADE,
    tenant_id           UUID NOT NULL REFERENCES core_tenant(id),
    product_id          UUID, -- FK to crm_product
    product_name        VARCHAR(255) NOT NULL,
    description         TEXT,
    quantity            INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price          DECIMAL(15,2) NOT NULL CHECK (unit_price >= 0),
    discount_percentage DECIMAL(5,2) DEFAULT 0 CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
    discount_amount     DECIMAL(15,2) DEFAULT 0 CHECK (discount_amount >= 0),
    total_price         DECIMAL(15,2) NOT NULL CHECK (total_price >= 0),
    sort_order          INTEGER NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE crm_opportunity_line_item ENABLE ROW LEVEL SECURITY;
CREATE POLICY lineitem_tenant_isolation ON crm_opportunity_line_item
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE INDEX ix_lineitem_opportunity ON crm_opportunity_line_item(opportunity_id);
```

### crm_opportunity_team_member

```sql
CREATE TABLE crm_opportunity_team_member (
    id                      UUID PRIMARY KEY DEFAULT uuid_v7(),
    opportunity_id          UUID NOT NULL REFERENCES crm_opportunity(id) ON DELETE CASCADE,
    tenant_id               UUID NOT NULL REFERENCES core_tenant(id),
    user_id                 UUID NOT NULL REFERENCES core_user(id),
    role                    VARCHAR(50) NOT NULL
                                CHECK (role IN ('PRIMARY_OWNER', 'EXECUTIVE_SPONSOR', 'TECHNICAL_CONSULTANT',
                                                'BUSINESS_CONSULTANT', 'SUPPORT', 'MANAGER', 'OTHER')),
    contribution_percentage DECIMAL(5,2) CHECK (contribution_percentage >= 0 AND contribution_percentage <= 100),
    added_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    added_by                UUID REFERENCES core_user(id),

    CONSTRAINT uq_opp_team_member UNIQUE (opportunity_id, user_id)
);

ALTER TABLE crm_opportunity_team_member ENABLE ROW LEVEL SECURITY;
CREATE POLICY oppteam_tenant_isolation ON crm_opportunity_team_member
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE INDEX ix_oppteam_opportunity ON crm_opportunity_team_member(opportunity_id);
CREATE INDEX ix_oppteam_user ON crm_opportunity_team_member(user_id);
```

### crm_product

```sql
CREATE TABLE crm_product (
    id              UUID PRIMARY KEY DEFAULT uuid_v7(),
    tenant_id       UUID NOT NULL REFERENCES core_tenant(id),
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    unit_price      DECIMAL(15,2) NOT NULL CHECK (unit_price >= 0),
    currency        VARCHAR(3) NOT NULL DEFAULT 'USD',
    category        VARCHAR(100),
    sku             VARCHAR(100),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    custom_fields   JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by      UUID REFERENCES core_user(id),
    updated_by      UUID REFERENCES core_user(id),
    is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,

    CONSTRAINT uq_product_tenant_name UNIQUE (tenant_id, name)
);

ALTER TABLE crm_product ENABLE ROW LEVEL SECURITY;
CREATE POLICY product_tenant_isolation ON crm_product
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE INDEX ix_product_tenant_category ON crm_product(tenant_id, category);
```

### crm_forecast

```sql
CREATE TABLE crm_forecast (
    id              UUID PRIMARY KEY DEFAULT uuid_v7(),
    tenant_id       UUID NOT NULL REFERENCES core_tenant(id),
    user_id         UUID NOT NULL REFERENCES core_user(id),
    period          VARCHAR(7) NOT NULL, -- YYYY-MM
    commit_amount   DECIMAL(15,2) NOT NULL DEFAULT 0,
    best_case_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    pipeline_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    weighted_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    quota           DECIMAL(15,2) DEFAULT 0,
    notes           TEXT,
    is_submitted    BOOLEAN NOT NULL DEFAULT FALSE,
    is_frozen       BOOLEAN NOT NULL DEFAULT FALSE,
    submitted_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_forecast_user_period UNIQUE (user_id, period)
);

ALTER TABLE crm_forecast ENABLE ROW LEVEL SECURITY;
CREATE POLICY forecast_tenant_isolation ON crm_forecast
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE INDEX ix_forecast_tenant_period ON crm_forecast(tenant_id, period);
CREATE INDEX ix_forecast_user ON crm_forecast(user_id);
```

### crm_task

```sql
CREATE TABLE crm_task (
    id              UUID PRIMARY KEY DEFAULT uuid_v7(),
    tenant_id       UUID NOT NULL REFERENCES core_tenant(id),
    subject         VARCHAR(255) NOT NULL,
    description     TEXT,
    status          VARCHAR(20) NOT NULL DEFAULT 'not_started'
                        CHECK (status IN ('not_started', 'in_progress', 'completed', 'deferred', 'cancelled')),
    priority        VARCHAR(10) NOT NULL DEFAULT 'medium'
                        CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    due_date        TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    owner_id        UUID REFERENCES core_user(id),
    related_to_type VARCHAR(50), -- 'lead', 'contact', 'account', 'opportunity'
    related_to_id   UUID,
    reminder_at     TIMESTAMPTZ,
    is_recurring    BOOLEAN NOT NULL DEFAULT FALSE,
    recurrence_rule JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by      UUID REFERENCES core_user(id),
    updated_by      UUID REFERENCES core_user(id),
    is_deleted      BOOLEAN NOT NULL DEFAULT FALSE
);

ALTER TABLE crm_task ENABLE ROW LEVEL SECURITY;
CREATE POLICY task_tenant_isolation ON crm_task
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE INDEX ix_task_tenant_owner ON crm_task(tenant_id, owner_id, status);
CREATE INDEX ix_task_tenant_due ON crm_task(tenant_id, due_date) WHERE status NOT IN ('completed', 'cancelled');
CREATE INDEX ix_task_related ON crm_task(related_to_type, related_to_id);
```

### crm_activity

```sql
CREATE TABLE crm_activity (
    id              UUID PRIMARY KEY DEFAULT uuid_v7(),
    tenant_id       UUID NOT NULL REFERENCES core_tenant(id),
    activity_type   VARCHAR(50) NOT NULL
                        CHECK (activity_type IN ('CALL', 'EMAIL', 'MEETING', 'NOTE', 'TASK',
                                                 'SMS', 'WHATSAPP', 'LINKEDIN', 'SYSTEM')),
    subject         VARCHAR(255) NOT NULL,
    description     TEXT,
    duration_minutes INTEGER,
    activity_date   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    owner_id        UUID REFERENCES core_user(id),
    related_to_type VARCHAR(50) NOT NULL, -- 'lead', 'contact', 'account', 'opportunity'
    related_to_id   UUID NOT NULL,
    metadata        JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by      UUID REFERENCES core_user(id),
    updated_by      UUID REFERENCES core_user(id),
    is_deleted      BOOLEAN NOT NULL DEFAULT FALSE
);

ALTER TABLE crm_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY activity_tenant_isolation ON crm_activity
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE INDEX ix_activity_tenant_related ON crm_activity(tenant_id, related_to_type, related_to_id, activity_date DESC);
CREATE INDEX ix_activity_tenant_owner ON crm_activity(tenant_id, owner_id, activity_date DESC);
CREATE INDEX ix_activity_tenant_type ON crm_activity(tenant_id, activity_type, activity_date DESC);
CREATE INDEX ix_activity_tenant_date ON crm_activity(tenant_id, activity_date DESC);
```

### crm_opportunity_activity

```sql
CREATE TABLE crm_opportunity_activity (
    id              UUID PRIMARY KEY DEFAULT uuid_v7(),
    opportunity_id  UUID NOT NULL REFERENCES crm_opportunity(id) ON DELETE CASCADE,
    tenant_id       UUID NOT NULL REFERENCES core_tenant(id),
    activity_type   VARCHAR(50) NOT NULL,
    description     TEXT,
    metadata        JSONB NOT NULL DEFAULT '{}',
    created_by      UUID REFERENCES core_user(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE crm_opportunity_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY oppactivity_tenant_isolation ON crm_opportunity_activity
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE INDEX ix_oppactivity_opportunity ON crm_opportunity_activity(opportunity_id, created_at DESC);
```
