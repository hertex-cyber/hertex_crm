# API Contracts — Design Overview

## Design Philosophy

The TZAHU CRM API follows **RESTful resource-oriented design** principles. Resources are nouns, HTTP methods define operations, and responses follow consistent structures. The API is designed for the React SPA frontend and third-party integrations.

### Core Principles

1. **Resource-Oriented:** URLs represent resources (`/api/v1/leads/`, `/api/v1/opportunities/`)
2. **HTTP Methods as Verbs:** GET (read), POST (create), PUT (full update), PATCH (partial update), DELETE (delete)
3. **Consistent Responses:** All responses follow `{ data, meta, errors }` envelope
4. **Stateless Auth:** JWT Bearer tokens (RS256) for every request
5. **Versioned:** URL namespace `/api/v1/` for explicit versioning
6. **Self-Describing:** Hateoas links where practical, OpenAPI 3.1 documentation

## API Base URL

- **Development:** `http://localhost:8000/api/v1/`
- **Staging:** `https://staging-api.tzahu.com/api/v1/`
- **Production:** `https://api.tzahu.com/api/v1/`

## Versioning Strategy

- **URL namespace versioning:** `/api/v1/`, `/api/v2/`
- **Backward compatibility within major version:** Add fields, don't remove/rename
- **Deprecation policy:** Endpoints marked `Deprecated` in OpenAPI, 6-month deprecation window
- **Breaking changes:** New major version (`/api/v2/`), old version available for 12 months
- **Headers:** Optional `Accept-Version: 2025-07-01` for date-based versioning (future)

## Authentication

- **Scheme:** Bearer JWT
- **Header:** `Authorization: Bearer <access_token>`
- **Token type:** RS256-signed JWT (access: 15 min, refresh: 7 days)
- **Public endpoints:** Login, Register, Forgot Password, Reset Password, Verify Email
- **All other endpoints:** Require valid JWT

See `Auth_API.md` for complete auth flows.

## Pagination

All list endpoints use cursor-based pagination by default, with page-number fallback.

### Cursor Pagination (Default)
```
GET /api/v1/leads/?cursor=eyJpZCI6IjAxOGUwZjUy...&limit=25

Response:
{
  "data": [...],
  "meta": {
    "pagination": {
      "next_cursor": "eyJpZCI6IjAxOGUwZjUy...",
      "prev_cursor": null,
      "has_next": true,
      "has_prev": false,
      "total_count": 1542,
      "limit": 25
    }
  }
}
```

### Page Number Pagination (Alternative)
```
GET /api/v1/leads/?page=1&page_size=25
```

### Pagination Parameters
| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| `cursor` | string | null | - | Cursor for cursor pagination |
| `limit` | int | 25 | 100 | Items per page |
| `page` | int | 1 | - | Page number (page pagination) |
| `page_size` | int | 25 | 100 | Items per page (page pagination) |

## Filtering

Filtering uses query parameters with a consistent syntax:

### Simple Filters
```
GET /api/v1/leads/?status=QUALIFIED&source=WEBSITE
```

### Range Filters
```
GET /api/v1/leads/?created_at__gte=2025-01-01&created_at__lte=2025-06-30
GET /api/v1/opportunities/?amount__gte=10000&amount__lte=50000
```

### Multi-Value Filters
```
GET /api/v1/leads/?status__in=QUALIFIED,CONTACTED
GET /api/v1/opportunities/?stage_id__in=id1,id2,id3
```

### Search Filters
```
GET /api/v1/leads/?search=john+doe&search_fields=first_name,last_name,email
```

### Filter Operators
| Operator | Description | Example |
|----------|-------------|---------|
| (none) | Exact match | `status=QUALIFIED` |
| `__in` | In list | `status__in=NEW,CONTACTED` |
| `__gte` | Greater or equal | `amount__gte=1000` |
| `__lte` | Less or equal | `created_at__lte=2025-06-30` |
| `__gt` | Greater than | `score__gt=50` |
| `__lt` | Less than | `amount__lt=10000` |
| `__contains` | String contains | `name__contains=acme` |
| `__isnull` | Null check | `owner_id__isnull=true` |

## Sorting

```
GET /api/v1/leads/?sort=-created_at
GET /api/v1/leads/?sort=last_name,first_name
```

- Default sort: `-created_at` (descending)
- Prefix `-` for descending order
- Multiple sort fields: comma-separated
- Only sortable on indexed fields (documented per endpoint)

## Field Selection

```
GET /api/v1/leads/?fields=id,first_name,last_name,email,status,score
```

Limits response to specified fields for performance. Only available on list endpoints.

## Error Handling

### Standard Error Response
```json
{
  "errors": [
    {
      "code": "VALIDATION_ERROR",
      "detail": "Email is required",
      "source": {
        "pointer": "/data/attributes/email"
      },
      "status": "422"
    }
  ],
  "meta": {
    "request_id": "req_018e0f52-6a7c-7b00-...",
    "timestamp": "2025-07-27T10:30:00Z"
  }
}
```

### HTTP Status Codes
| Code | Description |
|------|-------------|
| 200 | Success (GET, PUT, PATCH) |
| 201 | Created (POST) |
| 204 | No Content (DELETE) |
| 400 | Bad Request (malformed syntax) |
| 401 | Unauthorized (missing/invalid JWT) |
| 403 | Forbidden (valid JWT, insufficient permissions) |
| 404 | Not Found |
| 409 | Conflict (duplicate, state conflict) |
| 422 | Unprocessable Entity (validation errors) |
| 429 | Too Many Requests (rate limit) |
| 500 | Internal Server Error |
| 503 | Service Unavailable |

### Error Codes
| Code | HTTP Status | Description |
|------|-------------|-------------|
| `AUTHENTICATION_FAILED` | 401 | Invalid or expired JWT |
| `INSUFFICIENT_PERMISSIONS` | 403 | Valid JWT but missing permission |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 422 | Request body validation failed |
| `DUPLICATE_RESOURCE` | 409 | Resource already exists |
| `CONFLICTING_STATE` | 409 | Resource state prevents operation |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Unexpected server error |
| `DEPENDENCY_FAILURE` | 503 | Upstream service unavailable |

## Rate Limiting

- **Default:** 100 requests/minute per user
- **Burst:** 200 requests/minute (short spike allowance)
- **AI endpoints:** 20 requests/minute (separate tier)
- **Import endpoints:** 10 requests/minute
- **Headers returned:**
  - `X-RateLimit-Limit`: Max requests per window
  - `X-RateLimit-Remaining`: Remaining requests
  - `X-RateLimit-Reset`: Unix timestamp when window resets
  - `Retry-After`: Seconds to wait (when limited)
- **Rate limit tiers:** Per-user, per-tenant aggregate, per-IP (unauthenticated)

## Standard Headers

### Request Headers
| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes* | `Bearer <jwt_access_token>` |
| `Content-Type` | Yes* | `application/json` |
| `Accept` | No | `application/json` (default) |
| `Accept-Language` | No | `en-US`, `es-MX` (i18n) |
| `X-Idempotency-Key` | No | UUID for idempotent POST requests |
| `X-Tenant-ID` | Internal | Set by middleware from JWT |

### Response Headers
| Header | Description |
|--------|-------------|
| `X-Request-ID` | Unique request identifier |
| `X-RateLimit-Limit` | Rate limit ceiling |
| `X-RateLimit-Remaining` | Requests remaining |
| `X-RateLimit-Reset` | Reset timestamp |
| `X-Execution-Time` | Request processing time (ms) |

## Idempotency

POST requests with `X-Idempotency-Key` header guarantee the request is processed only once. Useful for payment webhooks and critical creations. Idempotency keys expire after 24 hours.

## OpenAPI Specification

The full OpenAPI 3.1 specification is generated by `drf-spectacular` and available at:
- `/api/docs/` — Swagger UI
- `/api/redoc/` — ReDoc
- `/api/schema/` — Raw OpenAPI JSON/YAML

## Hypermedia

List responses include pagination links. Resource responses include `links` object with self, related resources, and available actions based on permissions.

```json
{
  "data": {
    "id": "018e0f52-...",
    "type": "lead",
    "attributes": {...},
    "links": {
      "self": "/api/v1/leads/018e0f52-...",
      "owner": "/api/v1/users/018e0f53-...",
      "convert": "/api/v1/leads/018e0f52-/convert/",
      "timeline": "/api/v1/leads/018e0f52-/timeline/"
    }
  }
}
```

## Related Documents

- `Auth_API.md` — Authentication endpoints
- `Lead_API.md` — Lead management endpoints
- `Opportunity_API.md` — Pipeline & opportunity endpoints
- `DatabaseSchemas/README.md` — Database design philosophy
- `ArchitectureDecisionRecords/ADR-011-API-Style.md` — API design decisions
