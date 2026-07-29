# TZAHU CRM — Non-Functional Requirements

> **Version:** 1.0.0
> **Last Updated:** 2026-07-27
> **Status:** Final
> **Owner:** Platform Architecture Team

---

## Table of Contents

1. [Performance](#1-performance)
2. [Scalability](#2-scalability)
3. [Availability & Reliability](#3-availability--reliability)
4. [Security](#4-security)
5. [Multi-Tenancy](#5-multi-tenancy)
6. [Maintainability](#6-maintainability)
7. [Observability](#7-observability)
8. [Portability](#8-portability)
9. [Usability](#9-usability)
10. [Compatibility](#10-compatibility)
11. [Data Management](#11-data-management)
12. [Development & Deployment](#12-development--deployment)

---

## 1. Performance

### 1.1 API Response Times

| Endpoint Type | p50 | p95 | p99 | Measurement Method |
|--------------|-----|-----|-----|-------------------|
| Simple CRUD (read by ID) | < 50ms | < 100ms | < 200ms | Prometheus histogram, all endpoints averaged |
| List/Search (paginated) | < 100ms | < 200ms | < 500ms | Prometheus histogram, excludes full-text search |
| Entity Create/Update | < 150ms | < 300ms | < 500ms | Includes validation + persistence + event publish |
| Auth (login, refresh) | < 200ms | < 300ms | < 500ms | Includes password verification + JWT generation |
| File Upload | < 1s per MB | < 3s per MB | < 5s per MB | Measured from request receipt to storage completion |
| Full-Text Search | < 200ms | < 400ms | < 800ms | PostgreSQL GIN-indexed search |
| Semantic Search | < 300ms | < 500ms | < 1s | pgvector cosine similarity + FTS hybrid |
| Report Query (simple) | < 2s | < 5s | < 10s | Single-table aggregation |
| Report Query (complex) | < 10s | < 20s | < 30s | Multi-table join + aggregation |
| AI Inference (GPT-4o) | < 1s | < 2s | < 3s | Includes network + LLM generation |
| AI Embedding | < 200ms | < 400ms | < 600ms | text-embedding-3-small per text chunk |
| Webhook Delivery | < 2s | < 5s | < 10s | HTTP POST to external endpoint |
| Dashboard Load | < 1s | < 2s | < 3s | 5 widgets with data |

### 1.2 Throughput

| Metric | Target | Load Test |
|--------|--------|-----------|
| API requests/second (single pod) | > 500 req/s | k6, GET /api/v1/leads/ |
| API requests/second (cluster) | > 5,000 req/s | k6, distributed load test |
| DB writes/second | > 1,000 writes/s | pgbench simulation |
| DB reads/second | > 10,000 reads/s | pgbench simulation |
| Concurrent WebSocket connections | > 10,000 | WS load test |
| Celery task throughput | > 10,000 tasks/min | Per queue: workflow, notification, reports |
| Email send throughput | > 1,000 emails/min | Per org rate limited |

### 1.3 Database Performance

| Operation | Target | Notes |
|-----------|--------|-------|
| Simple SELECT (PK lookup) | < 5ms | Indexed B-tree |
| Complex JOIN (5 tables) | < 30ms | Properly indexed, RLS applied |
| Full-text search query | < 200ms | GIN index on tsvector |
| Vector similarity (IVFFlat, 100k rows) | < 50ms | 1536-dim embeddings |
| Hybrid search (FTS + vector) | < 200ms | Parallel execution |
| Transaction (INSERT + 3 related) | < 20ms | UUID v7 PK, no contention |
| Bulk INSERT (10,000 rows) | < 5s | Batch size 1,000 |
| RLS policy evaluation overhead | < 1ms per query | Added to every tenant-scoped query |

### 1.4 Caching Performance

| Cache Layer | Hit Ratio Target | TTL | Invalidation Strategy |
|-------------|-----------------|-----|----------------------|
| User permissions | > 95% | 5 min | On role/permission change |
| Tenant config | > 99% | 15 min | On settings update |
| Entity lookups (frequent) | > 80% | 10 min | On entity update |
| Report results | > 70% | 30 min | On data change (stale tolerant) |
| AI response cache | > 50% | 24h | Exact match queries |
| Embedding cache | > 80% | 7 days | On model version change |
| Session data | > 99% | TTL-based | Expiry only |

### 1.5 Performance Budgets

| Resource | Budget | Enforcement |
|----------|--------|-------------|
| API endpoint (average) | < 200ms p95 | CI benchmark test; regression alert |
| Page load (SPA) | < 2s initial; < 500ms subsequent | Lighthouse CI |
| API payload size | < 100KB default; < 1MB max (paginated) | Middleware enforcement |
| DB connection per request | < 2 connections | Pgbouncer monitoring |
| Memory per Django process | < 512MB | K8s resource limits |
| Memory per Celery worker | < 1GB | K8s resource limits |
| CPU per API request | < 50ms | Prometheus histogram |

---

## 2. Scalability

### 2.1 Scale Targets

| Dimension | R1 (6mo) | R2 (12mo) | R3 (18mo) | R4 (24mo) |
|-----------|----------|-----------|-----------|-----------|
| Organizations | 50 | 200 | 1,000 | 5,000 |
| Active users | 2,500 | 20,000 | 100,000 | 500,000 |
| Leads per org (avg) | 5,000 | 50,000 | 100,000 | 500,000 |
| Total leads | 250K | 10M | 100M | 2.5B |
| API requests/day | 100K | 5M | 50M | 500M |
| Events/day | 50K | 2M | 20M | 200M |
| File storage | 100GB | 5TB | 50TB | 500TB |
| Email sends/day | 10K | 500K | 5M | 50M |
| AI inference calls/day | — | 10K | 500K | 5M |

### 2.2 Horizontal Scaling

| Component | Scaling Strategy | Max Replicas | Scale Trigger |
|-----------|-----------------|--------------|---------------|
| Django API | HPA (CPU + memory) | 50 | CPU > 70% or p95 > 500ms |
| Celery (workflow) | HPA (queue depth) | 20 | Queue depth > 1,000 |
| Celery (notifications) | HPA (queue depth) | 10 | Queue depth > 500 |
| Celery (reports) | HPA (queue depth) | 5 | Queue depth > 100 |
| AI Gateway | HPA (CPU + queue) | 20 | CPU > 60% or queue > 50 |
| PostgreSQL | Vertical -> Read replicas -> Sharding | 5 read replicas | Connection > 200 or CPU > 70% |
| Redis | Vertical -> Cluster mode | 6 shards + 3 replicas | Memory > 80% |
| RabbitMQ | Cluster mode | 3 nodes | Queue or connection limits |

### 2.3 Database Scaling

| Technique | When | Implementation |
|-----------|------|----------------|
| Read replicas | CPU > 70% or query latency > 100ms p95 | PostgreSQL streaming replication; read/write splitting at app layer |
| Connection pooling | Connections > 200 | Pgbouncer in transaction mode; max 50 pool size per app instance |
| Table partitioning | Table > 100M rows | Range partition by created_at month |
| Index optimization | Slow queries identified | pg_stat_user_indexes review; BRIN for append-heavy tables |
| Materialized views | Complex report queries > 10s | Refresh on schedule; configurable refresh interval |
| Sharding (Citus) | > 5TB data or write throughput > 10K/s | Distributed PostgreSQL; tenant-based sharding |
| Silo escape hatch | Enterprise tenant > 1M records or compliance | Dedicated database instance per tenant |

### 2.4 Queue Scaling

| Queue | Priority | Concurrency | Max Backlog | Action on Backlog |
|-------|----------|-------------|-------------|-------------------|
| workflow | High | 8 | 10,000 | Scale workers; alert if > 10k |
| notification | High | 4 | 5,000 | Scale workers; rate limit senders |
| reports | Low | 2 | 1,000 | Sequential processing; no scaling |
| integrations | Medium | 4 | 2,000 | Scale workers per connector type |
| imports | Low | 2 | 500 | Sequential per org |
| default | Low | 2 | 1,000 | General purpose |

---

## 3. Availability & Reliability

### 3.1 Uptime Targets

| Metric | R1-R2 | R3+ | Measurement |
|--------|-------|-----|-------------|
| Platform uptime (monthly) | 99.95% | 99.99% | External blackbox monitoring |
| API availability | 99.95% | 99.99% | Synthetic transaction monitoring |
| API error rate | < 0.5% | < 0.1% | HTTP 5xx / total requests |
| Scheduled maintenance | < 4 hours/month | < 1 hour/month | Maintenance window notification |
| Degraded mode availability | 99.5% | 99.9% | Non-critical features disabled |

### 3.2 Disaster Recovery

| Metric | R1-R2 | R3+ | Implementation |
|--------|-------|-----|----------------|
| Recovery Point Objective (RPO) | < 15 min | < 5 min | WAL streaming to secondary region |
| Recovery Time Objective (RTO) | < 60 min | < 30 min | Automated failover with runbook |
| Data durability | 99.999999999% (11 9s) | Same | S3 + cross-region replication |
| Backup frequency | Daily full + continuous WAL | Same | pg_dump to S3 + WAL archive |
| Backup retention | 30 days | 90 days | Automated lifecycle policy |
| DR test frequency | Quarterly | Quarterly | Documented drill with results |

### 3.3 Failure Modes

| Failure Mode | Detection | Response | RTO |
|-------------|-----------|----------|-----|
| Single Django pod crash | K8s liveness probe | Auto-restart | < 30s |
| Single AZ outage | Multi-AZ K8s | Traffic routed to healthy AZ | < 2 min |
| PostgreSQL primary failure | Replication monitoring | Promote replica; update connection string | < 5 min |
| Redis failure | Cache miss rate spike | Fall through to DB; auto-rebuild cache | < 1 min |
| RabbitMQ failure | Queue depth alert | Tasks queued in memory; reconnect | < 2 min |
| AI Gateway failure | HTTP 5xx | Fallback to degraded AI (no AI features) | < 1 min |
| Celery worker failure | Task timeout | Tasks re-queued; new worker spawned | < 30s |
| External API (OpenAI) failure | HTTP 5xx/timeout | Circuit breaker -> fallback provider | < 2s |
| Full region failure | CloudWatch alarm | Manual DNS switch to DR region | < 30 min |

### 3.4 Retry & Circuit Breaker Policy

| Service | Retry Count | Backoff | Circuit Breaker Threshold | Half-Open After |
|---------|-------------|---------|--------------------------|-----------------|
| OpenAI / LLM | 3 | Exponential: 1s, 4s, 16s | 5 failures in 60s | 30s |
| SendGrid / Email | 3 | Exponential: 1s, 4s, 16s | 10 failures in 60s | 60s |
| Twilio / SMS | 3 | Exponential: 1s, 4s, 16s | 5 failures in 60s | 30s |
| Webhook Delivery | 3 | Exponential: 3s, 9s, 27s | 10 failures in 5 min | 2 min |
| Integration Sync | 3 | Linear: 30s | 5 failures in 15 min | 5 min |
| Database Query | 1 (retry on deadlock) | Immediate | N/A | N/A |

---

## 4. Security

### 4.1 Authentication

| Requirement | Standard | Implementation |
|-------------|----------|----------------|
| Password hashing | bcrypt, cost factor 12 | Django's make_password() with bcrypt |
| Token signing | RS256 (asymmetric) | Private key in Vault; public key in code/JWKS |
| Access token lifetime | 15 minutes | Short-lived to limit revocation complexity |
| Refresh token lifetime | 7 days | Rotated on use; old token invalidated |
| Token revocation | jti deny list in Redis | Checked on every authenticated request |
| MFA | TOTP (RFC 6238) | Standard authenticator app; backup codes |
| Rate limiting | Per-endpoint, per-IP, per-user | django-ratelimit + Redis |
| Account lockout | 5 failures in 15 min | Auto-unlock after 15 min or admin unlock |
| Session management | List, revoke, max 50 sessions | Per-user session tracking |

### 4.2 Authorization

| Requirement | Implementation | Verification |
|-------------|----------------|--------------|
| RBAC at API layer | DRF permission classes | Every endpoint tested for permission enforcement |
| Row-Level Security | PostgreSQL RLS, forced | Cross-tenant isolation test suite |
| Field-level permissions (R4) | Dynamic field filtering | Per-role field access matrix |
| API key scoping | Keys inherit user permissions | Key cannot exceed user's permissions |
| Public endpoint whitelist | Explicit PUBLIC_URLS list | Test: public endpoints return minimal data |

### 4.3 Data Security

| Concern | Requirement | Implementation |
|---------|-------------|----------------|
| Data in transit | TLS 1.3 minimum | Nginx + cert-manager (Let's Encrypt) |
| Internal communication | mTLS (R3+) | Service mesh (Istio/Linkerd) |
| Data at rest (DB) | AES-256 | PostgreSQL TDE or dm-crypt |
| Data at rest (files) | AES-256-SSE | MinIO server-side encryption |
| Secrets | Encrypted at rest + access audit | AWS Secrets Manager / HashiCorp Vault |
| API keys | AES-256-GCM encrypted in DB | Decrypted in memory only |
| OAuth tokens | AES-256-GCM encrypted in DB | Decrypted in integration service only |
| Passwords | bcrypt, never stored plaintext | django.contrib.auth.hashers |
| PII | Configurable field encryption | Application-level encryption for sensitive fields |
| Audit trail | Append-only, immutable | Write-once-read-many; immutable after 5 min |

### 4.4 API Security

| Measure | Requirement | Implementation |
|---------|-------------|----------------|
| Rate limiting | Tiered per plan | Free: 100/min; Growth: 1,000/min; Pro: 5,000/min; Enterprise: configurable |
| CORS | Restricted to known origins | Per-tenant CORS configuration; default same-origin |
| CSRF | Token-based for browsers | JWT for API (CSRF exempt); cookie-based for admin |
| SQL injection | Zero tolerance | Django ORM (parameterized); raw SQL prohibited |
| XSS | Auto-escaped output | DRF JSON renderer; Content-Type enforcement |
| Request size | 10MB max POST body | Nginx client_max_body_size; file upload per plan |
| Security headers | OWASP recommended | HSTS, X-Content-Type-Options, X-Frame-Options, CSP |
| Input validation | All inputs validated | DRF serializers + domain layer validation |

### 4.5 Compliance Certifications

| Certification | Target Phase | Prerequisites |
|--------------|-------------|---------------|
| SOC 2 Type II | R2 | Audit log, access control, encryption, monitoring, incident response |
| GDPR | R2 | Consent tracking, right to access/erasure, DPA, breach notification |
| ISO 27001 | R4 | ISMS, risk management, continuous improvement |
| HIPAA (BA) | R4 | BA agreement, PHI controls, audit, access logs |

### 4.6 Security Testing

| Test Type | Frequency | Tool/Method |
|-----------|-----------|-------------|
| SAST (Static Analysis) | Every PR | Bandit, Semgrep |
| Dependency scanning | Every commit | Dependabot, Snyk |
| Secret scanning | Every commit | git-secrets, pre-commit hook |
| DAST (Dynamic) | Weekly | OWASP ZAP |
| Penetration testing | Quarterly | External firm |
| Container scanning | Every build | Trivy, Clair |
| RLS isolation test | Every CI run | Custom test suite (10k+ assertions) |
| Permission test | Every CI run | Every endpoint tested per role |

---

## 5. Multi-Tenancy

### 5.1 Isolation Model

| Aspect | Default (Pool) | Enterprise (Silo) |
|--------|---------------|-------------------|
| Database | Shared PostgreSQL | Dedicated PostgreSQL instance |
| Schema | Single public schema | Single schema per instance |
| Isolation mechanism | PostgreSQL RLS + application scoping | Physical database separation |
| Connection pooling | Shared Pgbouncer pool | Dedicated Pgbouncer per tenant |
| RLS policies | Required on every tenant-scoped table | Not needed (separate DB) |
| Migration process | Single migration run | Per-tenant migration (automated) |
| Tenant count supported | 1,000+ per pool | Unlimited |
| Migration path | N/A | Pool to Silo via migration tool |

### 5.2 Tenant Isolation Layers

Layer 1: Authentication (JWT verification)
Layer 2: Tenant Resolution Middleware (validates membership, sets RLS context)
Layer 3: Repository Scoping (automatic organization_id filter)
Layer 4: PostgreSQL RLS (database-level enforcement)
Layer 5: Celery Tenant Propagation (task-local storage, TenantAwareTask)
Layer 6: Automated Test Suite (10k+ isolation assertions per CI run)

### 5.3 RLS Requirements

| Requirement | Implementation |
|-------------|----------------|
| RLS on every tenant-scoped table | Migration linter checks all new TenantScopedModel tables |
| FORCE RLS enabled | Prevents table owner bypass |
| RLS policy format | USING (organization_id = current_setting('app.current_organization_id')::uuid) |
| RLS test coverage | Every endpoint tested with 2 tenants for isolation |
| Missing RLS detection | Weekly check_missing_rls_policies job |
| RLS re-application | python manage.py apply_rls command |

### 5.4 Tenant Lifecycle

Provision -> Active -> Suspended -> Disabled -> Deleted with configurable retention periods and reactivation paths.

---

## 6. Maintainability

### 6.1 Code Quality

| Metric | Target | Enforcement |
|--------|--------|-------------|
| Test coverage (overall) | > 90% | pytest-cov, CI fail if below threshold |
| Test coverage (domain layer) | 100% | pytest-cov, per-module threshold |
| Test coverage (infrastructure) | > 80% | pytest-cov |
| Linting | Zero violations | ruff (all rules) |
| Type checking | Strict mode | mypy strict; no Any without justification |
| Import enforcement | Zero violations | import-linter; CI fail on layer violation |
| Cyclomatic complexity | < 10 per function | ruff complexity check |
| Max function length | < 50 lines | ruff line count check |
| Max file length | < 500 lines | Manual review; automated for new files |
| Duplicate code | < 3% | Manual review |

### 6.2 Testing Requirements

| Test Type | Purpose | CI Requirement |
|-----------|---------|----------------|
| Unit tests | Domain logic (pure Python, no Django) | Must pass before merge |
| Integration tests | Application services with real repos | Must pass before merge |
| API tests | Endpoint contracts, permissions | Must pass before merge |
| Tenant isolation tests | Cross-tenant data leak prevention | Must pass before deploy |
| Performance tests | Latency budgets | Run daily; alert on regression |
| Security tests | Auth, RLS, injection | Must pass before merge |
| E2E tests | Critical user journeys | Run on staging deploy |

### 6.3 Module Isolation

| Rule | Enforcement | Consequence |
|------|-------------|-------------|
| domain imports only shared_kernel | import-linter | CI fails |
| application imports only domain + shared_kernel + ports | import-linter | CI fails |
| infrastructure imports anything in module + shared_kernel | import-linter | CI fails |
| api imports only application + infrastructure | import-linter | CI fails |
| No cross-module domain/infra imports | import-linter | CI fails |
| No circular dependencies | import-linter | CI fails |
| shared_kernel imports zero Django | import-linter + mypy | CI fails |

---

## 7. Observability

### 7.1 Logging

| Requirement | Standard | Implementation |
|-------------|----------|----------------|
| Log format | Structured JSON | structlog |
| Log destination | stdout (container) | Captured by K8s fluentd -> Loki/CloudWatch |
| Correlation ID | W3C Trace Context (traceparent header) | OpenTelemetry auto-instrumentation |
| Required fields | timestamp, level, event, logger, request_id, tenant_id, user_id | structlog processor |
| Log levels | debug, info, warning, error, critical | Production: info+; debugging: debug on demand |
| PII redaction | Automatic for known PII fields | structlog processor + field allowlist |
| Log retention | 30 days active; 1 year archive | Loki retention policy |

### 7.2 Metrics (RED Method)

| Category | Key Metrics | Collection | Visualization |
|----------|-------------|------------|---------------|
| API | Rate, errors, duration (RED), per endpoint | OpenTelemetry -> Prometheus | Grafana dashboard |
| Database | Query count, duration, connections, cache hit ratio | pg_stat_statements + exporter | Grafana dashboard |
| Celery | Task count, duration, failures, queue depth | Celery Prometheus exporter | Grafana dashboard |
| Redis | Hit ratio, memory, commands/s, connections | Redis exporter | Grafana dashboard |
| RabbitMQ | Queue depth, consumer lag, publish rate | RabbitMQ exporter | Grafana dashboard |
| AI | Token usage, latency, cost, provider breakdown | OpenTelemetry + custom | Grafana + LangFuse |
| Business | Active orgs, users, leads created, deals won | Custom metrics | Grafana dashboard |
| Infrastructure | CPU, memory, disk, network per pod/node | K8s metrics + node exporter | Grafana dashboard |

### 7.3 Distributed Tracing

| Requirement | Implementation |
|-------------|----------------|
| Trace every request | OpenTelemetry auto-instrumentation (Django) |
| Trace every Celery task | OpenTelemetry Celery instrumentation |
| Trace LLM calls | OpenTelemetry + LangChain callback |
| Trace database queries | OpenTelemetry Django ORM instrumentation |
| Trace external HTTP calls | OpenTelemetry httpx instrumentation |
| Sampling rate | Production: 10% (head-based); errors: 100% |
| Export | OTLP -> Jaeger/Tempo |
| Trace context propagation | W3C Trace Context (traceparent header) |

### 7.4 Alerting

| Severity | Response Time | Examples | Channel |
|----------|--------------|----------|---------|
| Critical | < 15 min | RLS failure, DB down, 5xx > 5%, payment system down | PagerDuty + Slack |
| High | < 30 min | p95 > 1s, queue backlog > 10k, dead-letter > 100/h | Slack @channel |
| Medium | < 4 hours | Cache hit ratio < 50%, error rate > 0.5%, disk > 80% | Slack @team |
| Low | < 24 hours | SSL expiry < 30 days, unused indexes, slow migrations | Slack daily digest |

### 7.5 SLOs / SLIs

| SLI | Target | Burn Rate Alert |
|-----|--------|-----------------|
| API latency p95 < 200ms | 99% of requests | 2% exceedance over 1h |
| API error rate (5xx) | < 0.1% | 0.5% over 5 min |
| API uptime | 99.95% | Any 5-min downtime |
| Workflow execution latency | < 5s from event to action | 10% over 10s |
| Email delivery latency | < 60s from trigger to SMTP | 5% over 120s |
| Report execution | < 30s for 500k rows | 5% over 60s |
| AI inference p95 | < 2s | 10% over 5s |
| DB query p99 | < 100ms | 1% over 500ms |
| Search latency p95 | < 500ms | 5% over 1s |

---

## 8. Portability

### 8.1 Cloud Agnosticism

| Layer | Primary (AWS) | Alternative | Abstraction |
|-------|--------------|-------------|-------------|
| Compute | EKS (K8s) | GKE, AKS, self-managed K8s | K8s manifests (no cloud-specific APIs) |
| Database | RDS PostgreSQL | CloudSQL, Azure DB, self-hosted | PostgreSQL (no cloud-specific features) |
| Cache | ElastiCache Redis | Memorystore, Azure Cache, self-hosted | Redis (standard protocol) |
| Queue | Amazon MQ (RabbitMQ) | CloudAMQP, self-hosted | AMQP 0-9-1 (standard protocol) |
| Storage | S3 | GCS, Azure Blob, MinIO | S3-compatible API (MinIO in dev) |
| Secrets | AWS Secrets Manager | Vault, GCP Secret Manager | Abstraction layer via Vault |
| DNS | Route53 | CloudDNS, Azure DNS | Standard DNS |
| CDN | CloudFront | Cloud CDN, Akamai | Standard HTTP cache |

### 8.2 Containerization

| Requirement | Implementation |
|-------------|----------------|
| Development | Docker Compose (Django, PG, Redis, RabbitMQ, Celery, MinIO) |
| Production | Kubernetes (Deployments, StatefulSets, HPA, Ingress) |
| Image registry | ECR / Docker Hub / GHCR |
| Base image | python:3.13-slim |
| Multi-stage builds | Builder stage (poetry install) -> Runtime stage (minimal deps) |
| Image size target | < 500MB |
| Security scanning | Trivy in CI; base image updates weekly |

### 8.3 Local Development Environment

| Tool | Purpose |
|------|---------|
| Docker Compose | All services locally |
| Makefile | make dev, make test, make lint, make migrate, make seed |
| Poetry | Python dependency management with locked versions |
| pre-commit | ruff, mypy, import-linter, secrets check |
| .env template | Environment variables for local dev |
| Fixtures | Seed data for development/testing |

---

## 9. Usability

| Requirement | Target | Implementation |
|-------------|--------|----------------|
| Time to first value | < 15 minutes | Guided onboarding; sample data; quick-start wizard |
| Page load time | < 2s initial; < 500ms subsequent | Code splitting; lazy loading; CDN; TanStack Query cache |
| Accessibility | WCAG 2.1 AA | MUI accessibility; axe-core CI checks; keyboard navigation |
| Mobile responsiveness | All features on mobile | Responsive design; mobile-first CSS |
| Browser support | Last 2 versions of Chrome, Firefox, Safari, Edge | Polyfills; progressive enhancement |
| Internationalization | i18n from day 1 | React i18next; locale stored in user preferences |
| Dark mode | System preference + manual toggle | MUI theme toggle; persisted preference |
| Error messages | Human-readable, actionable | DRF error format with user-facing messages |
| Empty states | Helpful guidance for empty lists | Illustration + Get started action |
| Loading states | Skeleton loaders, progress indicators | MUI Skeleton; progress bars for async operations |

---

## 10. Compatibility

| System | Compatibility Requirement | Implementation |
|--------|-------------------------|----------------|
| Google Workspace | Contacts + Calendar read/write sync | OAuth 2.0; Google API v3 |
| Microsoft 365 | Contacts + Calendar read/write sync | OAuth 2.0; Microsoft Graph API |
| Outlook (desktop) | Email sync (IMAP/SMTP) | IMAP IDLE; SMTP |
| Slack | Notifications, workflow triggers | Webhook + Bolt SDK |
| Twilio | SMS + Voice | Twilio SDK |
| SendGrid | Email delivery | SendGrid v3 API |
| OpenAI | LLM + Embeddings | OpenAI Python SDK |
| Anthropic | LLM (fallback) | Anthropic Python SDK |
| Stripe | Billing + Invoices | Stripe SDK + webhooks |
| Zapier / Make | Third-party automation | REST API + Webhooks |

---

## 11. Data Management

| Concern | Requirement | Implementation |
|---------|-------------|----------------|
| Backup | Daily full + continuous WAL | pg_dump to S3 + WAL archive |
| Retention | 30 days (R1); 90 days (R4) | Automated lifecycle policy |
| Archival | Cold storage for data > 1 year | S3 Glacier; restore on demand |
| Purging | GDPR erasure requests | Anonymize data; handle within 30 days |
| Migration | Zero-downtime migrations (R2+) | Django migration + blue/green deploy |
| Seeding | Development seed data | Factory Boy + management commands |
| Data quality | Dedup on import; validation on input | Automated dedup engine; field validation |
| Schema evolution | Backward-compatible changes only | New fields optional; deprecation with warning |
| Data sovereignty | Customer data in chosen region | Multi-region deployment; Silo model |
| Encryption | AES-256 at rest; TLS 1.3 in transit | PostgreSQL TDE; MinIO SSE-S3 |

---

## 12. Development & Deployment

### 12.1 CI/CD Pipeline

| Stage | Tools | Duration Target |
|-------|-------|-----------------|
| Lint + Typecheck | ruff, mypy, import-linter | < 2 min |
| Unit + Integration Tests | pytest, pytest-django, pytest-cov | < 5 min |
| API + Isolation Tests | pytest with DB | < 10 min |
| Build Docker Image | Docker build | < 3 min |
| Container Scan | Trivy | < 2 min |
| Deploy to Staging | GitHub Actions + K8s | < 5 min |
| Smoke + E2E Tests | pytest + Cypress | < 5 min |
| Deploy to Production | Manual approval + K8s rolling update | < 10 min |

### 12.2 Environment Strategy

| Environment | Infrastructure | Data | Access |
|-------------|---------------|------|--------|
| local | Docker Compose | Fresh DB | Developer |
| dev | Single-node Docker | Anonymized prod (weekly) | Engineering team |
| staging | K8s (3-node) | Anonymized prod (bi-weekly) | Internal only |
| production | K8s (multi-node, multi-AZ) | Real customer data | Live customers |
| dr | K8s (secondary region) | WAL streaming | Failover only |

### 12.3 Development Workflow

1. Feature branch from main
2. PR with description referencing requirements
3. CI runs: lint -> typecheck -> test -> build -> scan
4. Code review required (at least 1 approval)
5. Merge to main (squash)
6. Auto-deploy to staging
7. Manual approval for production deploy

---

> **These non-functional requirements define how TZAHU CRM must perform, scale, and behave.**
> Every phase in the implementation plan traces to at least one NFR in this document.
> Violating an NFR requires an ADR and explicit trade-off analysis.
