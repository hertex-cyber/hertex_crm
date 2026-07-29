# ADR-011: API Style — DRF + Viewsets (REST)

- **Status:** Accepted
- **Date:** 2025-07-27
- **Authors:** Chief Architect, Backend Lead

## Context

TZAHU CRM needs a well-defined API for the React frontend and third-party integrations. The API must support CRUD operations, complex business operations, filtering, pagination, sorting, and bulk operations.

## Options Considered

### 1. DRF + Viewsets (Selected)
- **Pros:** Mature REST framework (Django REST Framework), ModelViewSet provides CRUD automatically, serializers for validation/deserialization, built-in pagination (PageNumberPagination, CursorPagination), filtering (django-filter), authentication classes (JWT, Session), permission classes, throttling, versioning, browsable API for development, excellent documentation, largest Django REST ecosystem, strongly typed via djangorestframework-stubs.
- **Cons:** Not GraphQL (over-fetching/under-fetching), serializers can become complex for deeply nested resources, viewset magic can obscure business logic, synchronous by default.
- **Mitigation:** Use serializers for input validation only; business logic in service layer, not viewsets. Use `drf-spectacular` for OpenAPI generation.

### 2. GraphQL (Ariadne / Strawberry / Graphene-Django)
- **Pros:** Client-driven queries (fetch exactly what's needed), single endpoint, strong typing (GraphQL schema), subscriptions for real-time, no versioning needed (evolve schema), excellent for complex nested data (e.g., lead with opportunities and activities).
- **Cons:** Complexity for simple CRUD (overkill), caching is harder (POST requests, no HTTP caching), rate limiting is query-depth-based, N+1 problem on resolvers, tooling maturity lower than REST for Django, frontend requires GraphQL client (Apollo/Relay), learning curve for team.

### 3. JSON:API (with django-rest-framework-json-api)
- **Pros:** REST standard with consistent structure, resource linkage, sparse fieldsets, compound documents, pagination links.
- **Cons:** Stricter specification can be verbose, less flexible for custom operations, smaller ecosystem, frontend must use JSON:API adapter.

### 4. tRPC (TypeScript-only)
- **Pros:** End-to-end type safety, no schema duplication, automatic client generation, simple API.
- **Cons:** TypeScript-only (cannot serve non-JS clients), Python ecosystem integration is immature, not suitable for third-party API consumers.

## Decision

**Use DRF + Viewsets for REST API** with `drf-spectacular` for OpenAPI 3.1 documentation.

API design principles:
- RESTful resource-oriented URLs: `/api/v1/{module}/{resource}/{id}/`
- CRUD via ModelViewSet for standard operations
- Custom actions via `@action` decorator for business operations (e.g., `POST /leads/{id}/convert/`)
- Input validation: DRF serializers (accept, validate, return)
- Output formatting: Serializers for responses (no business logic in serializers)
- Pagination: `PageNumberPagination` with configurable page size (default 25, max 100)
- Filtering: `django-filter` with `FilterSet` per resource
- Versioning: URL namespace (`/api/v1/`, `/api/v2/`)

Consider GraphQL for future read-optimized public APIs or mobile clients, but REST is the primary contract.

## Consequences

- **Positive:** Mature, predictable, tooling-rich, excellent for CRUD-heavy CRM workloads.
- **Positive:** drf-spectacular generates OpenAPI 3.1 schema for client generation and documentation.
- **Negative:** REST may result in over-fetching for complex dashboards (N+1 queries mitigated by `select_related`/`prefetch_related`).
- **Negative:** API versioning via URL namespace is coarser than GraphQL field evolution.
- **Negative:** Frontend needs to manage multiple endpoints vs GraphQL single endpoint.

## Compliance

- All new endpoints: Must be ModelViewSet or @action; no raw APIView unless approved.
- OpenAPI schema: Generated via `drf-spectacular`, validated in CI for breaking changes.
- Pagination: All list endpoints must use pagination.
- Rate limiting: Applied via DRF throttling classes (DEFAULT_THROTTLE_RATES).
- PR review: Verify serializer hygiene (no business logic, no DB queries in serializers).
