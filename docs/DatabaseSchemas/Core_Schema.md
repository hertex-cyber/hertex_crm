# Core Schema — Identity, Organization, Tenant, RBAC

Schema: `core`

## Extensions

```sql
CREATE EXTENSION IF NOT EXISTS pg_uuidv7;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

## Tables

### core_tenant

```sql
CREATE TABLE core_tenant (
    id              UUID PRIMARY KEY DEFAULT uuid_v7(),
    name            VARCHAR(255) NOT NULL,
    slug            VARCHAR(100) NOT NULL UNIQUE,
    domain          VARCHAR(255),
    plan            VARCHAR(50) NOT NULL DEFAULT 'starter'
                        CHECK (plan IN ('starter', 'professional', 'enterprise', 'sandbox')),
    status          VARCHAR(20) NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'suspended', 'cancelled', 'trial')),
    config          JSONB NOT NULL DEFAULT '{}',
    features        JSONB NOT NULL DEFAULT '{}',
    max_users       INTEGER NOT NULL DEFAULT 25,
    max_storage_gb  INTEGER NOT NULL DEFAULT 5,
    settings        JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_deleted      BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX ix_tenant_slug ON core_tenant(slug);
CREATE INDEX ix_tenant_domain ON core_tenant(domain);
CREATE INDEX ix_tenant_plan_status ON core_tenant(plan, status);
CREATE INDEX ix_tenant_created_at ON core_tenant(created_at DESC);
```

### core_user

```sql
CREATE TABLE core_user (
    id              UUID PRIMARY KEY DEFAULT uuid_v7(),
    tenant_id       UUID NOT NULL REFERENCES core_tenant(id),
    email           VARCHAR(255) NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    first_name      VARCHAR(255) NOT NULL,
    last_name       VARCHAR(255) NOT NULL,
    phone           VARCHAR(20),
    title           VARCHAR(255),
    avatar_url      TEXT,
    timezone        VARCHAR(50) NOT NULL DEFAULT 'UTC',
    locale          VARCHAR(10) NOT NULL DEFAULT 'en-US',
    email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    is_superuser    BOOLEAN NOT NULL DEFAULT FALSE,
    last_login_at   TIMESTAMPTZ,
    last_ip_address INET,
    login_count     INTEGER NOT NULL DEFAULT 0,
    metadata        JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by      UUID REFERENCES core_user(id),
    updated_by      UUID REFERENCES core_user(id),
    is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,

    CONSTRAINT uq_user_tenant_email UNIQUE (tenant_id, email)
);

CREATE INDEX ix_user_tenant ON core_user(tenant_id);
CREATE INDEX ix_user_tenant_active ON core_user(tenant_id, is_active)
    WHERE is_deleted = FALSE;
CREATE INDEX ix_user_email ON core_user(email);
CREATE INDEX ix_user_tenant_role ON core_user(tenant_id, last_login_at DESC);

-- RLS
ALTER TABLE core_user ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_tenant_isolation ON core_user
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

### core_role

```sql
CREATE TABLE core_role (
    id              UUID PRIMARY KEY DEFAULT uuid_v7(),
    tenant_id       UUID NOT NULL REFERENCES core_tenant(id),
    name            VARCHAR(100) NOT NULL,
    description     TEXT,
    is_system       BOOLEAN NOT NULL DEFAULT FALSE,
    priority        INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by      UUID REFERENCES core_user(id),
    updated_by      UUID REFERENCES core_user(id),
    is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,

    CONSTRAINT uq_role_tenant_name UNIQUE (tenant_id, name)
);

ALTER TABLE core_role ENABLE ROW LEVEL SECURITY;
CREATE POLICY role_tenant_isolation ON core_role
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Seed system roles
INSERT INTO core_role (tenant_id, name, description, is_system, priority)
VALUES
    ('00000000-0000-0000-0000-000000000000', 'org_admin', 'Organization administrator', TRUE, 100),
    ('00000000-0000-0000-0000-000000000000', 'manager', 'Team manager', TRUE, 50),
    ('00000000-0000-0000-0000-000000000000', 'agent', 'Sales agent', TRUE, 10),
    ('00000000-0000-0000-0000-000000000000', 'viewer', 'Read-only user', TRUE, 0);
```

### core_permission

```sql
CREATE TABLE core_permission (
    id              UUID PRIMARY KEY DEFAULT uuid_v7(),
    codename        VARCHAR(100) NOT NULL UNIQUE,
    module          VARCHAR(50) NOT NULL,
    label           VARCHAR(255) NOT NULL,
    description     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_permission_module ON core_permission(module);
```

### core_role_permission

```sql
CREATE TABLE core_role_permission (
    id              UUID PRIMARY KEY DEFAULT uuid_v7(),
    role_id         UUID NOT NULL REFERENCES core_role(id) ON DELETE CASCADE,
    permission_id   UUID NOT NULL REFERENCES core_permission(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_role_permission UNIQUE (role_id, permission_id)
);

CREATE INDEX ix_roleperm_role ON core_role_permission(role_id);
CREATE INDEX ix_roleperm_permission ON core_role_permission(permission_id);
```

### core_user_role

```sql
CREATE TABLE core_user_role (
    id              UUID PRIMARY KEY DEFAULT uuid_v7(),
    user_id         UUID NOT NULL REFERENCES core_user(id) ON DELETE CASCADE,
    role_id         UUID NOT NULL REFERENCES core_role(id) ON DELETE CASCADE,
    assigned_by     UUID REFERENCES core_user(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_user_role UNIQUE (user_id, role_id)
);

CREATE INDEX ix_userrole_user ON core_user_role(user_id);
CREATE INDEX ix_userrole_role ON core_user_role(role_id);
```

### core_team

```sql
CREATE TABLE core_team (
    id              UUID PRIMARY KEY DEFAULT uuid_v7(),
    tenant_id       UUID NOT NULL REFERENCES core_tenant(id),
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    manager_id      UUID REFERENCES core_user(id),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    metadata        JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by      UUID REFERENCES core_user(id),
    updated_by      UUID REFERENCES core_user(id),
    is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,

    CONSTRAINT uq_team_tenant_name UNIQUE (tenant_id, name)
);

ALTER TABLE core_team ENABLE ROW LEVEL SECURITY;
CREATE POLICY team_tenant_isolation ON core_team
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE INDEX ix_team_manager ON core_team(manager_id);
```

### core_team_member

```sql
CREATE TABLE core_team_member (
    id              UUID PRIMARY KEY DEFAULT uuid_v7(),
    team_id         UUID NOT NULL REFERENCES core_team(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES core_user(id) ON DELETE CASCADE,
    role_in_team    VARCHAR(50) NOT NULL DEFAULT 'member',
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_team_member UNIQUE (team_id, user_id)
);

CREATE INDEX ix_teammember_team ON core_team_member(team_id);
CREATE INDEX ix_teammember_user ON core_team_member(user_id);
```

### core_session

```sql
CREATE TABLE core_session (
    id              UUID PRIMARY KEY DEFAULT uuid_v7(),
    user_id         UUID NOT NULL REFERENCES core_user(id) ON DELETE CASCADE,
    tenant_id       UUID NOT NULL REFERENCES core_tenant(id),
    refresh_token_hash VARCHAR(255) NOT NULL,
    device_name     VARCHAR(255),
    device_type     VARCHAR(50),
    ip_address      INET,
    user_agent      TEXT,
    location        VARCHAR(255),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    last_active_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_session_user ON core_session(user_id);
CREATE INDEX ix_session_active ON core_session(user_id, is_active);
CREATE INDEX ix_session_expires ON core_session(expires_at);
```

### core_auditlog

```sql
CREATE TABLE core_auditlog (
    id              UUID PRIMARY KEY DEFAULT uuid_v7(),
    tenant_id       UUID NOT NULL REFERENCES core_tenant(id),
    actor_id        UUID REFERENCES core_user(id),
    event_type      VARCHAR(100) NOT NULL,
    entity_type     VARCHAR(100) NOT NULL,
    entity_id       UUID NOT NULL,
    changes         JSONB,
    diff            JSONB,
    metadata        JSONB NOT NULL DEFAULT '{}',
    ip_address      INET,
    user_agent      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- Monthly partitions
CREATE TABLE core_auditlog_2025_07
    PARTITION OF core_auditlog
    FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');
CREATE TABLE core_auditlog_2025_08
    PARTITION OF core_auditlog
    FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');

ALTER TABLE core_auditlog ENABLE ROW LEVEL SECURITY;
CREATE POLICY auditlog_tenant_isolation ON core_auditlog
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE INDEX ix_auditlog_tenant_entity ON core_auditlog(tenant_id, entity_type, entity_id);
CREATE INDEX ix_auditlog_tenant_event ON core_auditlog(tenant_id, event_type);
CREATE INDEX ix_auditlog_created ON core_auditlog(created_at DESC);
```

### core_invitation

```sql
CREATE TABLE core_invitation (
    id              UUID PRIMARY KEY DEFAULT uuid_v7(),
    tenant_id       UUID NOT NULL REFERENCES core_tenant(id),
    email           VARCHAR(255) NOT NULL,
    token           VARCHAR(255) NOT NULL UNIQUE,
    role_id         UUID REFERENCES core_role(id),
    invited_by      UUID REFERENCES core_user(id),
    status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
    expires_at      TIMESTAMPTZ NOT NULL,
    accepted_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_invitation_tenant_email UNIQUE (tenant_id, email, status)
);

CREATE INDEX ix_invitation_token ON core_invitation(token);
CREATE INDEX ix_invitation_tenant_status ON core_invitation(tenant_id, status);
```

### core_event_outbox

Implements the Transactional Outbox pattern for reliable event publishing.

```sql
CREATE TABLE core_event_outbox (
    id              UUID PRIMARY KEY DEFAULT uuid_v7(),
    tenant_id       UUID NOT NULL,
    event_type      VARCHAR(255) NOT NULL,
    aggregate_type  VARCHAR(100) NOT NULL,
    aggregate_id    UUID NOT NULL,
    event_data      JSONB NOT NULL,
    metadata        JSONB NOT NULL DEFAULT '{}',
    status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'published', 'failed', 'skipped')),
    retry_count     INTEGER NOT NULL DEFAULT 0,
    max_retries     INTEGER NOT NULL DEFAULT 3,
    last_error      TEXT,
    scheduled_at    TIMESTAMPTZ,
    published_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_outbox_status_scheduled ON core_event_outbox(status, scheduled_at)
    WHERE status = 'pending';
CREATE INDEX ix_outbox_aggregate ON core_event_outbox(aggregate_type, aggregate_id);
CREATE INDEX ix_outbox_created ON core_event_outbox(created_at);
```

## Functions & Triggers

### Updated At Trigger

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables (example for core_user)
CREATE TRIGGER trg_user_updated_at
    BEFORE UPDATE ON core_user
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

### Tenant Config Validation

```sql
CREATE OR REPLACE FUNCTION validate_tenant_config()
RETURNS TRIGGER AS $$
BEGIN
    -- Ensure features JSON has required keys
    IF NOT (NEW.features ? 'ai_enabled') THEN
        NEW.features = NEW.features || '{"ai_enabled": false}';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tenant_config
    BEFORE INSERT OR UPDATE ON core_tenant
    FOR EACH ROW
    EXECUTE FUNCTION validate_tenant_config();
```

## RLS Utility Functions

```sql
-- Set tenant context in Django middleware
CREATE OR REPLACE FUNCTION set_tenant_context(p_tenant_id UUID, p_user_id UUID, p_bypass BOOLEAN DEFAULT FALSE)
RETURNS VOID AS $$
BEGIN
    PERFORM set_config('app.current_tenant_id', p_tenant_id::text, TRUE);
    PERFORM set_config('app.current_user_id', p_user_id::text, TRUE);
    PERFORM set_config('app.bypass_rls', p_bypass::text, TRUE);
END;
$$ LANGUAGE plpgsql;
```
