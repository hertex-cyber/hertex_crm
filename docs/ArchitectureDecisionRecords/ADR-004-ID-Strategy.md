# ADR-004: ID Strategy — UUID v7

- **Status:** Accepted
- **Date:** 2025-07-27
- **Authors:** Chief Architect, Database Lead

## Context

TZAHU CRM requires globally unique identifiers across all entities. IDs must be sortable by creation time (for B-tree index performance), unpredictable (for security), and suitable for distributed systems (no central sequence). The strategy affects database index performance, URL safety, developer experience, and cross-system integration.

## Options Considered

### 1. UUID v7 (Selected)
- **Pros:** Time-ordered (ms precision prefix + random suffix) → B-tree index friendly, no index fragmentation (vs UUID v4), globally unique without coordination, 128-bit (36 char hex string), standard format (RFC 9562), generates in application layer (no DB roundtrip), URL-safe when hyphenated.
- **Pros for PostgreSQL:** Sequential UUIDs reduce B-tree page splits by ~80% vs UUID v4, comparable insert performance to bigint auto-increment.
- **Cons:** Slightly larger than bigint (16 bytes vs 8 bytes), requires Python library (uuid7 or custom), not human-readable, longer URLs.

### 2. Auto-Increment Bigint (serial/bigserial)
- **Pros:** Smallest (8 bytes), fastest for B-tree indexes, human-readable, simple, universally supported.
- **Cons:** Exposes record count (information disclosure), requires coordination in distributed writes, sequence locks are contention point, multi-tenant sequential IDs are guessable, migration between databases breaks sequences.

### 3. UUID v4 (Random)
- **Pros:** Globally unique, no coordination, unpredictable, widely supported.
- **Cons:** Random distribution → B-tree index fragmentation, 3-4x more page splits than sequential inserts, degraded read performance over time, non-sortable.

### 4. Snowflake-style (Twitter Snowflake / Sonyflake)
- **Pros:** Time-ordered, compact (64-bit), distributed-friendly, no coordination.
- **Cons:** Not a standard (no RFC), requires worker ID coordination, bit layout varies by implementation, less ecosystem support than UUID, integer overflow at edge.

### 5. ULID
- **Pros:** Sortable, 26-char Crockford Base32 (shorter than UUID), case-insensitive, URL-safe.
- **Cons:** Not a widely adopted standard (vs UUID RFC), less ecosystem support, PostgreSQL has no native ULID type, Crockford Base32 less familiar to developers.

## Decision

**Use UUID v7** as the single ID strategy for all entities across the system.

Implementation:
- Python library: `uuid7` from `uuid-ext` or custom implementation using `os.urandom` + timestamp
- PostgreSQL: Store as `uuid` type (not `bytea`) for readability and tool compatibility
- Indexes: B-tree on UUID v7 columns (time-ordered → good performance)
- Primary keys: All tables use `id UUID PRIMARY KEY DEFAULT uuid7()`
- Foreign keys: `UUID REFERENCES parent(id)`

Format: `018e0f52-6a7c-7b00-b000-000000000000` (36 chars, hyphenated)

## Consequences

- **Positive:** Index-friendly UUIDs, globally unique, no coordination, sortable, standard RFC format.
- **Positive:** Migration-friendly (generate client-side), safe for multi-region deployment.
- **Negative:** 16 bytes vs 8 for bigint; storage overhead acceptable (1-2 GB per 100M rows).
- **Negative:** Must generate UUIDs in application code (Django model `default=uuid7`); can also use PG function.
- **Migration:** All existing auto-increment IDs must migrate to UUID v7 during initial development (no production data yet).

## Compliance

- `pyproject.toml` dependency: `uuid-ext>=7.0` or vendored `utils/uuid7.py`.
- All models: `id = models.UUIDField(primary_key=True, default=uuid7, editable=False)`.
- All migrations verify no `AutoField` or `BigAutoField` is used.
- CI check: `python manage.py check --deploy` flags auto-increment fields.
