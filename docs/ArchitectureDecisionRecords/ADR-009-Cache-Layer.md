# ADR-009: Cache Layer — Redis Multi-Tier

- **Status:** Accepted
- **Date:** 2025-07-27
- **Authors:** Chief Architect, Backend Lead

## Context

TZAHU CRM has caching needs: session data, database query results, API response caching, rate limiting, real-time data, and AI model results. Different data has different cache duration, consistency, and durability requirements.

## Options Considered

### 1. Redis Multi-Tier (Selected)
- **Pros:** Single technology for multiple caching tiers, sub-millisecond latency, rich data structures (strings, hashes, lists, sets, sorted sets, streams, HyperLogLog, Bloom filters), built-in LRU/TTL eviction, Redis Stack adds JSON, Search, TimeSeries, BF/Cuckoo filters, persistence options (RDB/AOF), replication, cluster mode for HA, well-supported by Django (django-redis, django-cacheops).
- **Pros:** Used for: Django cache backend, Celery result backend, session store, rate limiter, real-time pub/sub, distributed locks (Redlock), task queue (if needed).
- **Cons:** Memory-bound (cache size limited by RAM), cache miss penalty to database, cache invalidation complexity, no built-in TLS (requires Stunnel or Redis 6+ ACL/TLS).

### 2. Memcached
- **Pros:** Simpler than Redis (key-value only), lower memory overhead per key, multi-threaded (uses all CPU cores), extremely fast for simple get/set.
- **Cons:** No data structures (only strings), no persistence (cache only, cannot be used for session storage), no replication, no pub/sub, no streams, no built-in auth, maximum key size 250 bytes, less feature-rich for CRM needs.

### 3. Varnish (HTTP Cache)
- **Pros:** HTTP-level caching (reverse proxy), very fast (in-memory + disk), ESI (Edge Side Includes), built-in load balancing, request collapsing.
- **Cons:** Only caches HTTP responses (cannot cache arbitrary data), no data structures, no pub/sub, no persistence, limited to HTTP semantics, not suitable for session storage or rate limiting.

### 4. Local In-Memory Cache (Django LocMemCache)
- **Pros:** No external dependency, zero network latency, simple.
- **Cons:** Not shared across processes (each Gunicorn worker has its own cache), cache invalidation per worker, lost on restart, limited to single machine, not suitable for production.

## Decision

**Use Redis 7** with a multi-tier caching strategy:

| Tier | Storage | TTL | Use Case |
|------|---------|-----|----------|
| L1 (Session) | Redis | Session lifetime | User sessions, JWT blacklist |
| L2 (Query) | Redis (`django-cacheops`) | 5-60 min | Expensive DB queries, reference data |
| L3 (API) | Redis | 1-5 min | Frequent API responses (list endpoints) |
| L4 (Rate) | Redis | Per-window | Rate limiting counters |
| L5 (Pub/Sub) | Redis | - | Real-time notifications (via Django Channels) |
| L6 (Task) | Redis | Per-task | Celery result backend (or use RabbitMQ) |
| L7 (Dist Lock) | Redis | Per-lock | Distributed mutex for critical sections |

Redis Stack features used: Bloom filter (dedup), TimeSeries (rate metrics), RediSearch (optional, if PostgreSQL FTS insufficient).

## Consequences

- **Positive:** Single technology for all caching needs, rich data structures, excellent Django integration.
- **Positive:** Cacheops provides automatic query caching with invalidation on model save.
- **Negative:** Redis is memory-bound; must monitor memory usage and set maxmemory policies.
- **Negative:** Cache invalidation logic must be carefully designed (especially with multi-tier).
- **Negative:** Redis persistence (RDB) is acceptable for cache recovery; AOF for session durability.

## Compliance

- All cache keys prefixed with `tzahu:{env}:{tenant_id}:{module}:` for multi-tenancy.
- `django-cacheops` configuration: `local_get_cursor=True` for per-process caching.
- Redis maxmemory policy: `allkeys-lru` for cache tiers, `noeviction` for session/rate tiers.
- CI check: `redis-cli ping` validates Redis connectivity in tests.
- Production: Redis metrics via `redis_exporter` in Prometheus.
