# ADR-006: Search Engine — PostgreSQL Full-Text Search + pgvector

- **Status:** Accepted
- **Date:** 2025-07-27
- **Authors:** Chief Architect, Backend Lead

## Context

TZAHU CRM requires search across leads, contacts, accounts, opportunities, and activities. Requirements include full-text search with relevance ranking, fuzzy matching (typo tolerance), vector similarity search (AI-powered semantic search), and multi-tenant result filtering.

## Options Considered

### 1. PostgreSQL Full-Text Search + pgvector (Selected)
- **Pros:** No additional infrastructure (runs in PostgreSQL), full-text search with `tsvector`/`tsquery`, relevance ranking (`ts_rank`), stemming, dictionary support, multi-tenant RLS integration, pgvector enables semantic search (768d/1536d embeddings), GiST/GIN indexes for performance, transactionally consistent with data.
- **Cons:** Not as performant as dedicated search engines at massive scale (100M+ documents), no built-in faceted search UI (requires application logic), no built-in typo tolerance (requires pg_trgm), no built-in analytics/search metrics.

### 2. Elasticsearch
- **Pros:** Industry-standard search engine, full-text with relevance scoring, fuzzy matching, autocomplete, faceted search, aggregations, near real-time indexing, rich query DSL, Kibana for visualization and search analytics.
- **Cons:** Requires separate cluster (ops overhead), Java/JVM dependency, data duplication (ES indexes must be synced with PostgreSQL), eventual consistency (index lag), cluster management at scale, resource heavy.

### 3. Meilisearch
- **Pros:** Developer-friendly, instant typo-tolerance, built-in faceted search, fast indexing, simple API, minimal configuration.
- **Cons:** Less mature for enterprise, smaller community, fewer deployment options, no vector search, document storage limit (free tier), eventual consistency, not as battle-tested for CRM workloads.

### 4. Algolia (Managed)
- **Pros:** Best-in-class search experience, instant results, typo tolerance, faceting, analytics, zero operations.
- **Cons:** Cost prohibitive at scale (per-search pricing), cloud vendor lock-in, data residency concerns, network latency for API calls, cannot deploy on-premises.

## Decision

**Use PostgreSQL Full-Text Search (FTS) + pgvector + pg_trgm** as the primary search engine.

Search tiers:
1. **Keyword search:** PostgreSQL FTS with GIN indexes on `tsvector` columns
2. **Fuzzy search:** pg_trgm with `similarity()` and `%` operator for typo tolerance
3. **Semantic search:** pgvector with OpenAI embeddings (1536d) for AI-powered search
4. **Combined:** Weighted combination of FTS rank + vector similarity distance

For deduplication: Use pg_trgm similarity matching on lead/contact names and emails.

## Consequences

- **Positive:** Zero additional infrastructure, transactionally consistent, integrated with RLS, simple operational model.
- **Positive:** Team can stay within PostgreSQL expertise.
- **Negative:** At massive scale (millions of records per tenant), PostgreSQL search may require read replicas or Elasticsearch migration.
- **Negative:** Complex queries may require raw SQL beyond Django ORM capabilities.
- **Negative:** Must maintain FTS indexes via triggers or scheduled refresh.
- **Migration Path:** When PostgreSQL search becomes a bottleneck, add Elasticsearch as a secondary search index, keeping PostgreSQL FTS as the primary source of truth.

## Compliance

- All searchable tables require a `_search_vector tsvector` column updated via trigger.
- pgvector extension must be enabled on all databases.
- CI test: `python manage.py verify_search_indexes` validates FTS coverage.
- Search performance benchmark in CI for queries >500ms.
