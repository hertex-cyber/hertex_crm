# TZAHU CRM — Performance Strategy

> **Version:** 0.1.0-draft
> **Last Updated:** 2026-07-27
> **Status:** Foundational Design Phase
> **Owner:** Platform Architecture Team

---

## Table of Contents

1. [Overview](#1-overview)
2. [API Performance](#2-api-performance)
3. [Database Performance](#3-database-performance)
4. [Celery Performance](#4-celery-performance)
5. [AI Performance](#5-ai-performance)
6. [Frontend Performance](#6-frontend-performance)
7. [Caching Strategy](#7-caching-strategy)
8. [Performance Budget](#8-performance-budget)

---

## 1. Overview

This document defines the performance strategy for TZAHU CRM across all layers — API, database, background processing, AI, frontend, and caching. Each section identifies specific techniques, configurations, and budgets that ensure the platform meets its SLOs at scale.

### 1.1 Performance Principles

- **N+1 queries are bugs**: Any query that causes an N+1 pattern in a hot path is classified as a production bug
- **Cache aggressively, invalidate carefully**: Default to caching; invest in event-driven invalidation
- **Profile before optimizing**: Use `py-spy`, `Django Debug Toolbar`, and `pg_stat_statements` to identify bottlenecks
- **Async for I/O, sync for CPU**: I/O-bound operations use async/await or Celery; CPU-bound operations use processes

---

## 2. API Performance

### 2.1 Connection Pooling (Pgbouncer)

```
Client (Django) ──► Pgbouncer ──► PostgreSQL
      (1000 conns)      (50 conns)    (200 max_connections)

Configuration:
  pool_mode = transaction
  default_pool_size = 25
  max_db_connections = 50
  server_idle_timeout = 300

This enables 1000 concurrent HTTP requests to share 50 database connections
with minimal contention. The 20:1 ratio works because each request holds a
DB connection for only ~50ms (transaction duration).
```

### 2.2 Redis Multi-Tier Caching

```python
class MultiTierCache:
    """L1: Django local memory (per-process). L2: Redis (distributed)."""

    def __init__(self):
        self.local = caches["local"]   # LocMemCache (per-process)
        self.redis = caches["default"] # RedisCache (distributed)

    def get(self, key: str, default=None):
        # L1: Check local memory (microseconds)
        value = self.local.get(key)
        if value is not None:
            return value

        # L2: Check Redis (milliseconds)
        value = self.redis.get(key)
        if value is not None:
            self.local.set(key, value, timeout=10)  # Short TTL on L1
            return value

        return default

    def set(self, key: str, value, timeout: int = 300):
        self.redis.set(key, value, timeout)
        self.local.set(key, value, timeout=10)  # Brief local cache
```

### 2.3 Query Optimization Techniques

```python
# 1. select_related (JOIN for FK relationships)
lead = Lead.objects.select_related("owner", "pipeline").get(id=lead_id)
# → Single query with JOINs vs N+1 queries

# 2. prefetch_related (separate query for M2M/reverse FK)
leads = Lead.objects.prefetch_related(
    Prefetch("activities", queryset=Activity.objects.order_by("-created_at")[:5])
).filter(organization_id=org_id)
# → 2 queries: leads + activities (vs 1+N)

# 3. only / defer (select specific columns)
lead = Lead.objects.only("id", "first_name", "last_name", "email").get(id=lead_id)
# → SELECT id, first_name, last_name, email FROM leads ...
# Avoids loading large TEXT/JSONB columns when not needed

# 4. Subquery for aggregated values
from django.db.models import Subquery, OuterRef
recent_activity = Activity.objects.filter(
    lead_id=OuterRef("pk")
).order_by("-created_at").values("type")[:1]
leads = Lead.objects.annotate(last_activity=Subquery(recent_activity))
# → Single query with subquery vs N+1
```

### 2.4 Pagination (Cursor vs Page)

```python
# Use cursor pagination for real-time lists (leads, contacts, activities)
# Use page pagination for admin/historical views (reports, audit logs)

class CursorPagination(PageNumberPagination):
    """Cursor-based pagination for stable, real-time lists.

    Benefits over page-based:
    - No offset skips/duplicates when items are inserted/deleted
    - Consistent ordering even with high write volume
    - O(1) performance regardless of page number
    """
    cursor_query_param = "cursor"
    page_size = 20
    ordering = "-created_at"  # Must be a unique, indexed field


class PagePagination(PageNumberPagination):
    """Page-based pagination for static/snapshot views."""
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100
```

### 2.5 N+1 Query Detection

```python
# Development: Django Debug Toolbar shows all queries per page
# CI: Automated N+1 detection with django-test-migrations or custom test

# Runtime: Slow query log (PostgreSQL)
# log_min_duration_statement = '200ms'
# Logs all queries taking > 200ms for analysis

# Manual detection:
from django.db import connection
connection.queries  # All queries executed in the current request

# Production: pg_stat_statements
SELECT query, calls, total_time / calls AS avg_time_ms
FROM pg_stat_statements
ORDER BY total_time DESC
LIMIT 20;
```

---

## 3. Database Performance

### 3.1 Indexing Strategy

| Index Type | Best For | Example |
|-----------|----------|---------|
| **B-tree** (default) | Primary keys, FKs, exact lookups, sort, unique | `id`, `organization_id`, `email` |
| **GIN** | Full-text search, JSONB, arrays | `search_vector` (tsvector), `tags`, `metadata` |
| **GiST** | Range queries, exclusion constraints | Date ranges, geometry |
| **BRIN** | Large append-only tables with ordered data | `created_at` on audit/activity tables |
| **Partial** | Filtered queries (WHERE deleted_at IS NULL) | Soft-delete filtering |
| **Composite** | Multi-column query patterns | `(organization_id, stage_id, created_at)` |
| **Covering** | Index-only scans | Include columns to avoid table heap lookups |
| **IVFFlat** | Vector similarity search | `embedding vector_cosine_ops` |
| **HNSW** | > 1M vectors | `embedding vector_cosine_ops` with `m=16` |

```sql
-- B-tree: Primary lookups
CREATE INDEX idx_leads_org_email ON lead_management_leads(organization_id, email)
    WHERE deleted_at IS NULL;

-- GIN: Full-text search
CREATE INDEX idx_leads_search ON lead_management_leads USING GIN(search_vector);

-- BRIN: Append-heavy tables
CREATE INDEX idx_audit_created_at ON audit_auditlog USING BRIN(created_at)
    WITH (pages_per_range = 32);

-- Partial: Active records only
CREATE INDEX idx_leads_active ON lead_management_leads(organization_id, status)
    WHERE deleted_at IS NULL;
```

### 3.2 Query Optimization (EXPLAIN ANALYZE)

```sql
-- Slow query detection workflow:
-- 1. Identify slow query from pg_stat_statements or slow query log
-- 2. Run EXPLAIN (ANALYZE, BUFFERS, TIMING)
-- 3. Look for: Sequential scans on large tables, missing indexes,
--    nested loop joins on large result sets, sort operations on disk

EXPLAIN (ANALYZE, BUFFERS, TIMING)
SELECT l.id, l.first_name, l.last_name, l.score
FROM lead_management_leads l
WHERE l.organization_id = 'abc-123'
  AND l.status IN ('new', 'qualified')
  AND l.score >= 50
ORDER BY l.score DESC
LIMIT 20;

-- Expected: Index Scan on composite index (organization_id, status, score)
-- Bad: Sequential Scan on large table (add composite index)
```

### 3.3 Connection Pooling

```
Application Servers (4 pods × 4 workers = 16 processes)
    │
    ▼
Pgbouncer (max_db_connections = 50)
    │
    ▼
PostgreSQL (max_connections = 200)

Connection distribution:
- 50 connections for application (via Pgbouncer)
- 10 connections for Celery workers (via Pgbouncer)
- 5 connections for admin/monitoring tools
- 5 connections for reporting queries (direct, if needed)
- Balance: 130 reserved for future growth
```

### 3.4 Read Replicas for Reporting

```python
# Database router for read replicas
class ReportRouter:
    """Route reporting queries to read replicas."""

    def db_for_read(self, model, **hints):
        if model._meta.app_label in ["reports", "dashboard", "analytics"]:
            return "replica"
        return "default"

    def db_for_write(self, model, **hints):
        return "default"

    def allow_relation(self, obj1, obj2, **hints):
        return True

    def allow_migrate(self, db, app_label, model_name=None, **hints):
        return db == "default"  # Migrations only on primary
```

### 3.5 Materialized Views for Aggregations

```sql
-- Refresh nightly for dashboard/report queries
CREATE MATERIALIZED VIEW mv_daily_pipeline_summary AS
SELECT
    organization_id,
    pipeline_id,
    DATE(created_at) AS day,
    COUNT(*) AS total_opportunities,
    SUM(CASE WHEN stage = 'won' THEN 1 ELSE 0 END) AS won_count,
    SUM(amount) AS total_amount,
    SUM(CASE WHEN stage = 'won' THEN amount ELSE 0 END) AS won_amount,
    AVG(cycle_time_days) AS avg_cycle_time
FROM pipeline_management_opportunities
WHERE deleted_at IS NULL
GROUP BY organization_id, pipeline_id, DATE(created_at);

CREATE UNIQUE INDEX idx_mv_daily_pipeline
    ON mv_daily_pipeline_summary(organization_id, pipeline_id, day);

-- Refresh:
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_pipeline_summary;
```

---

## 4. Celery Performance

### 4.1 Named Queues per Workload

| Queue | Concurrency | Pool | Task Type | Bottleneck |
|-------|-------------|------|-----------|------------|
| `workflow` | 4 | prefork | Mixed CPU/I/O | DB + condition evaluation |
| `notification` | 8 | gevent | I/O-bound | HTTP/SMTP latency |
| `reports` | 2 | prefork | CPU-bound | Data aggregation |
| `integrations` | 4 | gevent | I/O-bound | External API calls |
| `imports` | 2 | prefork | CPU + I/O | File parsing + DB writes |
| `default` | 4 | prefork | General | Misc |

### 4.2 Prefetch Count

```python
# Each worker prefetches exactly 1 message at a time
worker_prefetch_multiplier = 1

# Benefits:
# - Fair distribution: busy workers don't hoard tasks
# - Graceful shutdown: no in-flight tasks lost
# - Memory efficiency: no message buffer
# - Priority respect: high-priority tasks don't wait behind buffered tasks

# Trade-off: Slightly higher broker overhead (more frequent fetch requests)
```

### 4.3 Concurrency Tuning

```python
# Notification queue (gevent: I/O bound)
# Command: celery -A config worker -Q notification -c 8 -P gevent
# Each greenlet handles 1 email/SMS API call
# 8 greenlets × 4 workers = 32 concurrent I/O operations

# Reports queue (prefork: CPU bound)
# Command: celery -A config worker -Q reports -c 2
# Each process handles 1 report generation
# 2 processes × 2 workers = 4 concurrent report generations

# Tuning guidelines:
# - I/O bound tasks: gevent/threads with higher concurrency (8-16)
# - CPU bound tasks: processes with lower concurrency (2-4)
# - Mixed tasks: processes with moderate concurrency (4-8)
```

### 4.4 Task Timeouts

```python
# Soft time limit: task receives SoftTimeLimitExceeded exception
# Hard time limit: worker terminates the task process

CELERY_TASK_SOFT_TIME_LIMIT = {
    "workflow.tasks.*": 30,           # 30 seconds
    "notification.tasks.*": 30,       # 30 seconds
    "reports.tasks.*": 300,           # 5 minutes
    "integrations.tasks.*": 60,       # 1 minute
    "imports.tasks.*": 300,           # 5 minutes
    "ai.tasks.*": 120,                # 2 minutes
    "*": 60,                          # Default: 60 seconds
}

CELERY_TASK_TIME_LIMIT = {
    "*": CELERY_TASK_SOFT_TIME_LIMIT + 5,  # Hard = Soft + 5s
}
```

### 4.5 Rate Limiting per Queue

```python
# Per-task rate limits
CELERY_TASK_RATE_LIMITS = {
    "notification.tasks.send_email": "50/m",     # 50 emails/min
    "notification.tasks.send_sms": "20/m",       # 20 SMS/min
    "integrations.tasks.sync_contacts": "10/m",  # 10 syncs/min
    "workflow.tasks.execute": "100/m",           # 100 workflows/min
    "ai.tasks.score_leads": "30/m",              # 30 scoring runs/min
}
```

### 4.6 Result Backend Optimization

```python
# Use Redis with result expiry
CELERY_RESULT_BACKEND = "redis://:password@redis:6380/0"
CELERY_TASK_RESULT_EXPIRES = 86400  # 24 hours (auto-cleanup)
CELERY_RESULT_EXTENDED = True       # Include task name, args in result

# For high-throughput tasks, consider disabling result storage:
CELERY_IGNORE_RESULT = False  # Default: store results
# Set task.ignore_result=True for fire-and-forget tasks
```

---

## 5. AI Performance

### 5.1 Streaming Responses

```python
@router.post("/v1/chat/completions")
async def chat_completion(request: ChatRequest):
    """Stream LLM response via Server-Sent Events."""

    async def generate():
        async for chunk in llm_provider.chat_completion_stream(
            messages=request.messages,
            model=request.model,
            temperature=request.temperature,
        ):
            yield f"data: {json.dumps(chunk)}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        },
    )
```

### 5.2 Response Caching (Redis)

```python
class AICache:
    """Cache for AI responses with semantic similarity matching."""

    def __init__(self, redis_client):
        self.redis = redis_client

    async def get_cached_response(self, prompt: str, feature: str) -> str | None:
        """Check for exact or semantically similar cached response."""
        # 1. Exact match
        key = f"ai:cache:{feature}:{hash(prompt)}"
        cached = await self.redis.get(key)
        if cached:
            return cached

        # 2. Semantic similarity match (for RAG queries)
        if feature == "rag":
            similar = await self._find_similar_queries(prompt, feature)
            if similar and similar["similarity"] > 0.95:
                return similar["response"]

        return None

    async def cache_response(self, prompt: str, response: str, feature: str, ttl: int = 3600):
        key = f"ai:cache:{feature}:{hash(prompt)}"
        await self.redis.setex(key, ttl, response)
```

### 5.3 Embedding Caching

```python
class EmbeddingCache:
    """Cache embeddings to avoid redundant API calls."""

    def __init__(self, redis_client):
        self.redis = redis_client
        self.ttl = 86400  # 24 hours

    async def get_embeddings(self, texts: list[str]) -> list[list[float] | None]:
        keys = [f"embed:{hash(t)}" for t in texts]
        cached = await self.redis.mget(*keys)
        return [json.loads(c) if c else None for c in cached]

    async def set_embeddings(self, texts: list[str], embeddings: list[list[float]]):
        pipe = self.redis.pipeline()
        for text, embedding in zip(texts, embeddings):
            pipe.setex(f"embed:{hash(text)}", self.ttl, json.dumps(embedding))
        await pipe.execute()
```

### 5.4 Model Tiering

```python
class ModelTierRouter:
    """Route AI requests to appropriate model based on criticality."""

    TIERS = {
        "economy": {"model": "gpt-4o-mini", "max_tokens": 1024},
        "standard": {"model": "gpt-4o", "max_tokens": 4096},
        "premium": {"model": "gpt-4o", "max_tokens": 8192},
    }

    FEATURE_TIERS = {
        "sentiment_analysis": "economy",
        "entity_extraction": "economy",
        "lead_scoring": "standard",
        "next_best_action": "standard",
        "rag_generation": "standard",
        "conversation_summary": "standard",
        "deal_insights": "premium",
        "sales_coach": "premium",
    }

    def select_model(self, feature: str, org_tier: str) -> str:
        feature_tier = self.FEATURE_TIERS.get(feature, "standard")
        # Enterprise orgs can use premium for all features
        if org_tier == "enterprise":
            feature_tier = "premium"
        return self.TIERS[feature_tier]["model"]
```

### 5.5 Batch Embedding

```python
class BatchEmbedder:
    """Batch embedding with automatic retry and rate limiting."""

    BATCH_SIZE = 20            # Max texts per API call
    MAX_RETRIES = 3
    RATE_LIMIT = 3000          # RPM

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        results = [None] * len(texts)
        for batch_start in range(0, len(texts), self.BATCH_SIZE):
            batch = texts[batch_start:batch_start + self.BATCH_SIZE]
            for attempt in range(self.MAX_RETRIES):
                try:
                    embeddings = await self.provider.embed_batch(batch)
                    for i, emb in enumerate(embeddings):
                        results[batch_start + i] = emb
                    break
                except RateLimitError:
                    await asyncio.sleep(2 ** attempt)
        return results
```

---

## 6. Frontend Performance

### 6.1 Code Splitting

```typescript
// React.lazy for route-based code splitting
const LeadManagement = React.lazy(() => import('./pages/LeadManagement'));
const PipelineView = React.lazy(() => import('./pages/PipelineView'));
const ReportsDashboard = React.lazy(() => import('./pages/ReportsDashboard'));
const AISettings = React.lazy(() => import('./pages/AISettings'));

// Suspense boundary with loading fallback
<Routes>
  <Route path="/leads" element={
    <Suspense fallback={<PageSkeleton />}>
      <LeadManagement />
    </Suspense>
  } />
  <Route path="/pipeline" element={
    <Suspense fallback={<PageSkeleton />}>
      <PipelineView />
    </Suspense>
  } />
</Routes>
```

### 6.2 Bundle Optimization

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    target: 'es2020',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          mui: ['@mui/material', '@mui/icons-material'],
          query: ['@tanstack/react-query'],
          forms: ['react-hook-form', 'zod'],
        },
      },
    },
    chunkSizeWarningLimit: 200,
  },
});
```

### 6.3 Image Optimization

```typescript
// Use next-gen formats with automatic fallback
<Image
  src={avatar.url}
  alt={user.name}
  width={48}
  height={48}
  format="webp"  // or avif
  quality={80}
  loading="lazy"
/>

// Avatar component with CDN optimization
function Avatar({ url, name, size }: AvatarProps) {
  const optimizedUrl = `${url}?w=${size * 2}&h=${size * 2}&fit=crop&format=webp`;
  return (
    <img
      src={optimizedUrl}
      alt={name}
      width={size}
      height={size}
      loading="lazy"
      onError={(e) => {
        e.currentTarget.src = `https://ui-avatars.com/api/?name=${name}&size=${size}`;
      }}
    />
  );
}
```

### 6.4 Virtualization for Large Lists

```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

function LeadList({ leads }: { leads: Lead[] }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: leads.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,  // Row height in px
    overscan: 5,
  });

  return (
    <div ref={parentRef} style={{ height: '600px', overflow: 'auto' }}>
      <div style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            <LeadRow lead={leads[virtualItem.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 6.5 Debounced Search

```typescript
function LeadSearch() {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);

  const { data, isLoading } = useQuery({
    queryKey: ['leads', 'search', debouncedSearch],
    queryFn: () => searchLeads(debouncedSearch),
    enabled: debouncedSearch.length >= 2,
  });

  return (
    <TextField
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      placeholder="Search leads..."
      InputProps={{
        endAdornment: isLoading ? <CircularProgress size={20} /> : <SearchIcon />,
      }}
    />
  );
}
```

---

## 7. Caching Strategy

### 7.1 Cache-Aside Pattern

```python
def get_lead(lead_id: UUID, org_id: UUID) -> Lead:
    # 1. Try cache
    cache_key = f"v1:{org_id}:lead:{lead_id}"
    cached = cache.get(cache_key)
    if cached:
        return cached

    # 2. Cache miss → load from DB
    lead = Lead.objects.get(id=lead_id, organization_id=org_id)

    # 3. Store in cache
    cache.set(cache_key, lead, timeout=300)

    return lead
```

### 7.2 Write-Through for Critical Data

```python
def update_lead(lead_id: UUID, data: dict) -> Lead:
    lead = Lead.objects.get(id=lead_id)
    for field, value in data.items():
        setattr(lead, field, value)
    lead.save()

    # Write-through: update cache immediately
    cache_key = f"v1:{lead.organization_id}:lead:{lead_id}"
    cache.set(cache_key, lead, timeout=300)

    # Invalidate related caches
    cache.delete(f"v1:{lead.organization_id}:lead:list")
    cache.delete(f"v1:{lead.organization_id}:dashboard:summary")

    return lead
```

### 7.3 TTL Management

| Cache Type | TTL | Strategy | Notes |
|-----------|-----|----------|-------|
| Entity (lead, contact) | 5 min | Write-through | Updated on entity save |
| List queries | 2 min | Cache-aside | Invalidated on any entity change |
| User permissions | 5 min | Write-through | Invalidated on role change |
| Feature flags | 1 min | Write-through | Updated on flag change |
| Report results | 30 min | Cache-aside | TTL-based invalidation |
| Dashboard data | 5 min | Cache-aside | TTL-based invalidation |
| AI responses | 1 hour | Cache-aside | TTL-based invalidation |
| Embeddings | 24 hours | Cache-aside | TTL-based invalidation |
| Configuration | 1 hour | Write-through | Updated on config change |
| Session data | 7 days | Write-through | No eviction policy |

### 7.4 Invalidation Strategies

```python
class CacheInvalidator:
    """Event-driven cache invalidation."""

    STRATEGIES = {
        "entity_update": Invalidator(
            key_pattern="v1:{org_id}:{entity_type}:{entity_id}",
            on="entity.updated",
        ),
        "entity_list": Invalidator(
            key_pattern="v1:{org_id}:{entity_type}:list:*",
            on=["entity.created", "entity.updated", "entity.deleted"],
        ),
        "user_permissions": Invalidator(
            key_pattern="v1:{org_id}:user:{user_id}:permissions",
            on="role.assigned",
        ),
        "dashboard": Invalidator(
            key_pattern="v1:{org_id}:dashboard:*",
            on=["lead.created", "opportunity.won", "activity.created"],
        ),
    }

    async def invalidate(self, event: DomainEvent):
        for name, strategy in self.STRATEGIES.items():
            if event.event_type in strategy.on:
                key = strategy.key_pattern.format(
                    org_id=event.organization_id,
                    entity_type=event.aggregate_type,
                    entity_id=event.aggregate_id,
                    user_id=event.actor_id,
                )
                await cache.delete_pattern(key)
```

### 7.5 Cache Warming

```python
class CacheWarmer:
    """Pre-warm cache for frequently accessed data."""

    @celery.task
    def warm_org_cache(org_id: UUID):
        """Warm cache for an organization after login."""
        # 1. Org settings and config
        org = OrganizationService.get_config(org_id)
        cache.set(f"v1:{org_id}:settings", org.settings, timeout=3600)
        cache.set(f"v1:{org_id}:config", org.config, timeout=3600)

        # 2. Feature flags
        flags = FeatureFlagService.get_active_flags(org_id)
        cache.set(f"v1:{org_id}:features", flags, timeout=300)

        # 3. User permissions (for frequently accessed users)
        for user in org.active_users:
            perms = RBACService.get_user_permissions(user.id, org_id)
            cache.set(f"v1:{org_id}:user:{user.id}:permissions", perms, timeout=300)

        # 4. Pipeline definitions
        pipelines = PipelineService.get_pipelines(org_id)
        cache.set(f"v1:{org_id}:pipelines", pipelines, timeout=300)
```

---

## 8. Performance Budget

### 8.1 Service-Level Budgets

| Metric | Target | Measurement | Violation Action |
|--------|--------|-------------|------------------|
| API p95 latency | < 200ms | All endpoints, rolling 5 min | Alert, investigate |
| API p99 latency | < 500ms | All endpoints, rolling 5 min | Alert, investigate |
| Page load (UI) | < 3s | Lighthouse, 75th percentile | Optimize bundle/chunks |
| AI response | < 2s | p95, rolling 5 min | Check model tier, cache |
| Report generation | < 30s | p95, rolling 1h | Optimize query, MV |
| Search response | < 500ms | p95, rolling 5 min | Check index, cache |
| RAG query | < 2s | p95, rolling 5 min | Optimize retrieval |
| Workflow execution | < 5s | p95, rolling 1h | Check conditions, actions |
| Email delivery | < 60s | p95, rolling 1h | Check provider, queue |
| DB query (p95) | < 50ms | pg_stat_statements | Add index, optimize |

### 8.2 Bundle Budgets

| Asset | Budget | Current | Status |
|-------|--------|---------|--------|
| JS bundle (initial) | < 200KB | 180KB | Pass |
| JS bundle (total) | < 500KB | 450KB | Pass |
| CSS bundle | < 50KB | 35KB | Pass |
| Images per page | < 500KB | 300KB | Pass |
| Fonts | < 50KB | 25KB | Pass |
| Lighthouse performance | > 90 | 92 | Pass |
| First Contentful Paint | < 1.5s | 1.2s | Pass |
| Largest Contentful Paint | < 2.5s | 2.1s | Pass |
| Time to Interactive | < 3.5s | 2.8s | Pass |

### 8.3 CI Performance Gates

```yaml
# GitHub Actions: Performance regression detection
- name: Performance CI
  run: |
    # API performance tests
    locust --headless -u 100 -r 10 --run-time 60s \
      --host https://staging.tzahu.com \
      --csv results

    # Check against budget
    python scripts/check_performance_budget.py results.csv
    # Fails CI if:
    # - p95 latency > 200ms (5% tolerance)
    # - Error rate > 0.1%
    # - Any endpoint exceeds 2x expected latency
```
