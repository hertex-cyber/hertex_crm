# TZAHU CRM — API Guidelines

> **Version:** 0.1.0-draft
> **Last Updated:** 2026-07-27
> **Status:** Approved
> **Owner:** Platform Architecture Team

---

## Table of Contents

1. [API Design Principles](#1-api-design-principles)
2. [Versioning](#2-versioning)
3. [URL Structure & Resource Naming](#3-url-structure--resource-naming)
4. [HTTP Methods & Status Codes](#4-http-methods--status-codes)
5. [Pagination](#5-pagination)
6. [Filtering, Sorting & Search](#6-filtering-sorting--search)
7. [Error Responses](#7-error-responses)
8. [Request & Response Formats](#8-request--response-formats)
9. [Idempotency](#9-idempotency)
10. [Rate Limiting](#10-rate-limiting)
11. [Authentication & Authorization](#11-authentication--authorization)
12. [WebSocket API](#12-websocket-api)
13. [API Deprecation](#13-api-deprecation)
14. [OpenAPI Specification (drf-spectacular)](#14-openapi-specification-drf-spectacular)
15. [API Testing Checklist](#15-api-testing-checklist)

---

## 1. API Design Principles

1. **Consistency over convenience.** Every endpoint follows the same patterns for pagination, filtering, errors, and naming.
2. **Backward compatibility.** Never break existing clients. Add fields silently; remove only after deprecation.
3. **Thin controllers.** Views dispatch to services; they contain no business logic.
4. **Explicit over implicit.** Query parameters are explicit, not inferred from request body.
5. **Idempotent by design.** All mutating operations are idempotent where semantically possible.
6. **Tenant-scoped by default.** Every endpoint is scoped to the authenticated user's organization.
7. **Self-documenting.** OpenAPI spec is generated from code, never maintained separately.

---

## 2. Versioning

### Strategy: URL-Based Versioning
```
/api/v1/leads/
/api/v1/contacts/
/api/v2/leads/
```

### Django Settings
```python
REST_FRAMEWORK = {
    "DEFAULT_VERSIONING_CLASS": "rest_framework.versioning.NamespaceVersioning",
    "ALLOWED_VERSIONS": ["v1"],
    "VERSION_PARAM": "version",
}
```

### URL Configuration
```python
# urls/api.py
router_v1 = DefaultRouter()
router_v1.register(r"leads", lead_views.LeadViewSet, basename="lead")

urlpatterns = [
    path("v1/", include((router_v1.urls, "leads"), namespace="v1")),
]
```

### Version Lifecycle
| Phase | State | Action |
|-------|-------|--------|
| Current | Active | Full support, documented |
| Deprecated | Sunset header | Still works, migration guide published |
| Removed | 410 Gone | Returns `GONE` with link to migration |

### Backward-Compatible Changes
- Adding optional fields to response: safe.
- Adding query parameters: safe.
- Increasing max page size: safe.
- Adding new endpoints: safe.

### Breaking Changes (Require Version Bump)
- Removing or renaming fields.
- Changing field types.
- Making optional fields required.
- Changing endpoint URL.
- Changing error codes.
- Changing pagination format.

---

## 3. URL Structure & Resource Naming

### Conventions
```
/api/{version}/{resource}/
/api/{version}/{resource}/{id}/
/api/{version}/{resource}/{id}/{subresource}/
/api/{version}/{resource}/{id}/{action}/
```

### Resource Names
- **Plural nouns**: `leads`, `contacts`, `opportunities`, `pipelines`.
- **kebab-case**: `lead-management`, `sales-pipeline`, `activity-log`.
- **No verbs in resource names**: use `POST /leads` not `POST /createLead`.
- **Actions as last segment**: `POST /leads/{id}/convert`, `POST /opportunities/{id}/stage-transition`.

### Standard Endpoints per Resource
| Method | URL | Action |
|--------|-----|--------|
| GET | `/api/v1/leads/` | List |
| POST | `/api/v1/leads/` | Create |
| GET | `/api/v1/leads/{id}/` | Retrieve |
| PUT | `/api/v1/leads/{id}/` | Full update |
| PATCH | `/api/v1/leads/{id}/` | Partial update |
| DELETE | `/api/v1/leads/{id}/` | Soft delete |

### Custom Action Endpoints
| Method | URL | Action |
|--------|-----|--------|
| POST | `/api/v1/leads/{id}/convert/` | Convert lead to opportunity |
| POST | `/api/v1/leads/{id}/assign/` | Assign lead to user |
| POST | `/api/v1/opportunities/{id}/stage-transition/` | Move to next stage |
| POST | `/api/v1/workflows/{id}/execute/` | Trigger workflow execution |
| POST | `/api/v1/notifications/{id}/read/` | Mark notification as read |
| POST | `/api/v1/tasks/{id}/complete/` | Mark task complete |

### Related Resource URLs
```
# Nested under parent
/api/v1/leads/{lead_id}/contacts/
/api/v1/leads/{lead_id}/activities/
/api/v1/opportunities/{oppty_id}/notes/

# Cross-reference (query param)
/api/v1/activities/?entity_type=lead&entity_id={id}
```

---

## 4. HTTP Methods & Status Codes

### Method Semantics
| Method | Semantics | Idempotent | Safe |
|--------|-----------|------------|------|
| GET | Retrieve resource(s) | Yes | Yes |
| POST | Create or action | No | No |
| PUT | Full replace | Yes | No |
| PATCH | Partial update | Yes | No |
| DELETE | Soft delete | Yes | No |
| HEAD | Metadata headers | Yes | Yes |
| OPTIONS | Describe endpoints | Yes | Yes |

### Status Codes
| Code | Name | When |
|------|------|------|
| 200 | OK | Successful GET, PUT, PATCH |
| 201 | Created | Successful POST |
| 202 | Accepted | Async operation started (Celery task) |
| 204 | No Content | Successful DELETE |
| 301 | Moved Permanently | Endpoint relocated (legacy) |
| 400 | Bad Request | Validation error, malformed request |
| 401 | Unauthorized | Missing or invalid authentication |
| 403 | Forbidden | Authenticated but not authorized |
| 404 | Not Found | Resource does not exist |
| 405 | Method Not Allowed | Wrong HTTP method |
| 409 | Conflict | Duplicate resource, version conflict |
| 410 | Gone | Removed API version |
| 415 | Unsupported Media Type | Wrong Content-Type |
| 422 | Unprocessable Entity | Business rule violation |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Unexpected server error |
| 502 | Bad Gateway | Upstream service unavailable |
| 503 | Service Unavailable | Temporary maintenance |

---

## 5. Pagination

### Page-Based Pagination (Default)
For resources with low write volume and stable ordering.

**Request:**
```
GET /api/v1/leads/?page=2&page_size=25
```

**Response:**
```json
{
  "count": 150,
  "next": "http://api.tzahu.com/api/v1/leads/?page=3&page_size=25",
  "previous": "http://api.tzahu.com/api/v1/leads/?page=1&page_size=25",
  "results": [...]
}
```

**Configuration:**
```python
class StandardPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 100
    page_query_param = "page"
```

### Cursor-Based Pagination
For high-write resources (activity logs, notifications) where new records are frequently inserted.

**Request:**
```
GET /api/v1/activities/?cursor=cD0yMDI2LTA3LTI3VDEwOjMwOjAw&limit=25
```

**Response:**
```json
{
  "next": "http://api.tzahu.com/api/v1/activities/?cursor=cD0yMDI2LTA3LTI3VDEwOjMwOjAwWg&limit=25",
  "previous": null,
  "results": [...]
}
```

**Configuration:**
```python
class CursorPagination(CursorPagination):
    page_size = 25
    ordering = "-created_at"
    cursor_query_param = "cursor"
    page_size_query_param = "limit"
    max_page_size = 100
```

### Pagination Decision Matrix
| Resource | Pagination Type | Reason |
|----------|----------------|--------|
| Leads, Contacts, Accounts | Page-based | Low write volume, supports random access |
| Opportunities | Page-based | Low cardinality |
| Activities | Cursor-based | Append-only, high write volume |
| Notifications | Cursor-based | New records at top, infinite scroll |
| Audit Events | Cursor-based | Append-only, high write volume |
| Search results | Page-based | Relevance ordering, random access |
| Pipeline stages | None | Low cardinality (< 20) |

---

## 6. Filtering, Sorting & Search

### Filtering Convention
```
GET /api/v1/leads/?status=new&score_min=50&score_max=100&created_after=2026-01-01
```

**Filter Parameters:**
| Operator | Query Param | Example | SQL Equivalent |
|----------|------------|---------|---------------|
| Exact match | `{field}` | `?status=new` | `WHERE status = 'new'` |
| In list | `{field}__in` | `?status__in=new,contacted` | `WHERE status IN ('new','contacted')` |
| Greater than | `{field}__gt` | `?score__gt=50` | `WHERE score > 50` |
| Greater or equal | `{field}__gte` | `?score__gte=50` | `WHERE score >= 50` |
| Less than | `{field}__lt` | `?score__lt=100` | `WHERE score < 100` |
| Less or equal | `{field}__lte` | `?score__lte=100` | `WHERE score <= 100` |
| Contains (case-insensitive) | `{field}__icontains` | `?company_name__icontains=acme` | `WHERE company_name ILIKE '%acme%'` |
| Is null | `{field}__isnull` | `?assigned_to__isnull=true` | `WHERE assigned_to IS NULL` |
| Date range | `{field}__date` | `?created_at__date=2026-07-27` | `WHERE created_at::date = '2026-07-27'` |
| Date after | `{field}__date_after` | `?created_at__date_after=2026-01-01` | `WHERE created_at >= '2026-01-01'` |

### Sorting Convention
```
GET /api/v1/leads/?ordering=-score,company_name
```
- Ascending: `ordering=field_name`
- Descending: `ordering=-field_name`
- Multi-field: `ordering=-score,company_name`
- Allowed sort fields must be explicitly whitelisted to prevent DB abuse.

### Search Convention
```
GET /api/v1/leads/?search=acme+custom+software
```
- Full-text search across weighted fields (see Database Guidelines).
- Semantic search: `?q=software+companies+in+healthcare` (uses embedding).
- Hybrid search: `?search=acme&q=crm+software` (combines full-text + vector).

### Django Filterset Example
```python
class LeadFilterSet(FilterSet):
    status = CharFilter(lookup_expr="exact")
    status__in = CharFilter(field_name="status", lookup_expr="in")
    score__gte = NumberFilter(field_name="score", lookup_expr="gte")
    score__lte = NumberFilter(field_name="score", lookup_expr="lte")
    company_name__icontains = CharFilter(lookup_expr="icontains")
    created_at__date = DateFilter(field_name="created_at", lookup_expr="date")
    created_at__date_after = DateFilter(field_name="created_at", lookup_expr="gte")
    assigned_to__isnull = BooleanFilter(field_name="assigned_to", lookup_expr="isnull")
    search = CharFilter(method="filter_search")
    q = CharFilter(method="filter_semantic")

    class Meta:
        model = LeadModel
        fields = {
            "status": ["exact", "in"],
            "score": ["gte", "lte"],
            "company_name": ["exact", "icontains"],
            "email": ["exact", "icontains"],
            "created_at": ["exact", "gte", "lte", "date"],
            "assigned_to": ["exact", "isnull"],
        }

    def filter_search(self, queryset, name, value):
        return queryset.filter(
            search_vector=SearchQuery(value, config="english")
        )

    def filter_semantic(self, queryset, name, value):
        embedding = get_embedding(value)  # calls AI Gateway
        return queryset.alias(
            distance=CosineDistance("embedding", embedding)
        ).filter(distance__lte=0.3).order_by("distance")
```

---

## 7. Error Responses

### Standard Error Envelope
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "One or more fields failed validation.",
    "details": [
      {
        "field": "email",
        "message": "Enter a valid email address.",
        "code": "invalid"
      },
      {
        "field": "company_name",
        "message": "This field is required.",
        "code": "required"
      }
    ],
    "requestId": "req_abc123",
    "timestamp": "2026-07-27T10:30:00Z"
  }
}
```

### Error Code Taxonomy
| Code | HTTP Status | Description |
|------|-------------|-------------|
| `AUTHENTICATION_REQUIRED` | 401 | No or invalid authentication |
| `TOKEN_EXPIRED` | 401 | Access token has expired |
| `TOKEN_INVALID` | 401 | Token is malformed or revoked |
| `PERMISSION_DENIED` | 403 | Authenticated but not authorized |
| `NOT_FOUND` | 404 | Resource does not exist |
| `METHOD_NOT_ALLOWED` | 405 | Wrong HTTP method |
| `VALIDATION_ERROR` | 400 / 422 | Field-level validation failure |
| `CONFLICT` | 409 | Duplicate resource or version conflict |
| `RESOURCE_GONE` | 410 | API version or resource removed |
| `RATE_LIMITED` | 429 | Too many requests |
| `IDEMPOTENCY_REPLAY` | 422 | Replayed request with different body |
| `DEPENDENCY_ERROR` | 502 | Upstream service failure (AI, email, etc.) |
| `INTERNAL_ERROR` | 500 | Unexpected server error |
| `MAINTENANCE_MODE` | 503 | System under maintenance |

### DRF Exception Handler
```python
from rest_framework.views import exception_handler

def core_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is not None:
        response.data = {
            "error": {
                "code": _get_error_code(exc),
                "message": _get_error_message(exc),
                "details": _get_error_details(exc, response),
                "requestId": _get_request_id(context["request"]),
                "timestamp": timezone.now().isoformat(),
            }
        }
    return response
```

---

## 8. Request & Response Formats

### Content-Type
- Request: `application/json` only.
- Response: `application/json` only.
- File uploads: `multipart/form-data`.
- Binary downloads: `application/octet-stream` or specific MIME type.

### JSON Conventions (camelCase)
All JSON field names use camelCase:
```json
{
  "id": "0190a3b2-8c7d-7e00-9b1a-2c3d4e5f6789",
  "companyName": "Acme Corp",
  "email": "contact@acme.com",
  "leadSource": "website",
  "createdAt": "2026-07-27T10:30:00Z",
  "createdBy": {
    "id": "0190a3b2-8c7d-7e00-9b1a-2c3d4e5f6790",
    "fullName": "John Doe"
  }
}
```

### Field Naming Map
| Python/Django | Database | JSON API |
|---------------|----------|----------|
| `company_name` | `company_name` | `companyName` |
| `created_at` | `created_at` | `createdAt` |
| `created_by_id` | `created_by_id` | `createdBy` (nested) |
| `is_active` | `is_active` | `isActive` |
| `lead_source` | `lead_source` | `leadSource` |
| `sales_rep_id` | `sales_rep_id` | `salesRep` (nested) |

### Date & Time Format
- All timestamps: ISO 8601 with UTC suffix `Z`.
- Date-only: `2026-07-27`.
- Duration: ISO 8601 duration format `PT1H30M`.

### DRF Renderer
```python
REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],
    "DEFAULT_PARSER_CLASSES": [
        "rest_framework.parsers.JSONParser",
        "rest_framework.parsers.MultiPartParser",
    ],
}
```

---

## 9. Idempotency

### When Required
- All `POST` requests for resource creation.
- All `POST` requests for actions (convert, assign, transfer).
- `PUT` and `PATCH` are inherently idempotent via resource identifier.

### Implementation
**Request:**
```
POST /api/v1/leads/
Idempotency-Key: 0190a3b2-8c7d-7e00-9b1a-deadbeef1234
Content-Type: application/json

{ "companyName": "Acme Corp", "email": "contact@acme.com" }
```

**First request:** 201 Created.
**Retry (same key):** Returns cached original response without side effects.

### Idempotency Middleware
```python
class IdempotencyMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        self.cache = cache  # Redis backend

    def __call__(self, request):
        if request.method == "POST":
            key = request.headers.get("Idempotency-Key")
            if not key:
                return self.get_response(request)

            if not self._is_valid_uuid(key):
                return JsonResponse(
                    {"error": {"code": "VALIDATION_ERROR", "message": "Invalid Idempotency-Key format"}},
                    status=400,
                )

            cached = self.cache.get(f"idempotency:{key}")
            if cached:
                return JsonResponse(cached["response"], status=cached["status"])

            response = self.get_response(request)

            if response.status_code in (200, 201, 202, 204):
                self.cache.set(
                    f"idempotency:{key}",
                    {"status": response.status_code, "response": response.data},
                    timeout=86400,  # 24h TTL
                )

            return response

        return self.get_response(request)
```

### Idempotency Rules
- Key: UUID v4 generated by the client.
- TTL: 24 hours in Redis.
- Scope: per-user, per-key (different users can't collide).
- Replay with different body: return `422 IDEMPOTENCY_REPLAY`.
- Response stored includes status code, headers, and body.

---

## 10. Rate Limiting

### Tiered Limits
| Tier | Auth Endpoints | API Endpoints | AI Endpoints |
|------|---------------|---------------|--------------|
| Free | 5/min | 100/min | 10/min |
| Starter | 10/min | 500/min | 50/min |
| Professional | 20/min | 2000/min | 200/min |
| Enterprise | 50/min | 10000/min | 1000/min |
| System | 100/min | Unlimited | Unlimited |

### Response Headers
```
RateLimit-Limit: 500
RateLimit-Remaining: 423
RateLimit-Reset: 1722081600
```

### 429 Response
```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Rate limit exceeded. Please wait and retry.",
    "details": {
      "limit": 500,
      "remaining": 0,
      "resetAt": "2026-07-27T11:00:00Z"
    },
    "requestId": "req_abc123",
    "timestamp": "2026-07-27T10:59:59Z"
  }
}
```

### DRF Throttle Configuration
```python
REST_FRAMEWORK = {
    "DEFAULT_THROTTLE_CLASSES": [
        "apps.identity.infrastructure.throttling.TierRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "free_auth": "5/min",
        "free_api": "100/min",
        "free_ai": "10/min",
        "starter_auth": "10/min",
        "starter_api": "500/min",
        "starter_ai": "50/min",
        "pro_auth": "20/min",
        "pro_api": "2000/min",
        "pro_ai": "200/min",
        "enterprise_auth": "50/min",
        "enterprise_api": "10000/min",
        "enterprise_ai": "1000/min",
    },
}
```

### Tiered Throttle Implementation
```python
class TierRateThrottle(SimpleRateThrottle):
    def get_cache_key(self, request, view):
        if not request.user.is_authenticated:
            return None
        tier = getattr(request.user.organization, "tier", "free")
        scope = self._get_scope(view)
        return f"throttle_{tier}_{scope}_{request.user.pk}"

    def _get_scope(self, view):
        if getattr(view, "ai_endpoint", False):
            return "ai"
        if getattr(view, "auth_endpoint", False):
            return "auth"
        return "api"

    def get_rate(self):
        tier = getattr(self.request.user.organization, "tier", "free")
        scope = self._get_scope(self.view)
        return self.rate_map.get(f"{tier}_{scope}", "100/min")
```

---

## 11. Authentication & Authorization

### Authentication Header
```
Authorization: Bearer eyJhbGciOiJSUzI1NiIs...
```

### JWT Token Format
- **Access Token**: 15 min TTL, RS256 signed, includes user_id, org_id, role, permissions hash.
- **Refresh Token**: 7 day TTL, rotation enabled (old token invalidated on refresh).
- **Token payload:**
  ```json
  {
    "sub": "0190a3b2-...",
    "org_id": "0190a3b2-...",
    "role": "org_admin",
    "perms_hash": "a1b2c3d4...",
    "iat": 1722080000,
    "exp": 1722080900,
    "jti": "0190a3b2-..."
  }
  ```

### Authorization
- Endpoints require explicit permission checks via DRF Permission classes.
- Permission naming: `{entity}.{action}` — `lead.create`, `lead.view`, `lead.update`, `lead.delete`.
- 3-layer model: JWT (identity) → RBAC (role permissions) → RLS (tenant scope).

```python
class LeadPermission(BasePermission):
    def has_permission(self, request, view):
        if view.action == "create":
            return request.user.has_perm("lead.create")
        if view.action in ("list", "retrieve"):
            return request.user.has_perm("lead.view")
        if view.action in ("update", "partial_update"):
            return request.user.has_perm("lead.update")
        if view.action == "destroy":
            return request.user.has_perm("lead.delete")
        return True
```

---

## 12. WebSocket API

### Connection
```
ws://api.tzahu.com/ws/v1/notifications/?token=<jwt_token>
```

### Authentication on Connect
```python
class NotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        token = self.scope["query_string"].decode().split("token=")[-1]
        user = await authenticate_jwt(token)
        if not user:
            await self.close(code=4001)
            return
        self.scope["user"] = user
        self.org_id = user.organization_id
        await self.channel_layer.group_add(f"org_{self.org_id}", self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(f"org_{self.org_id}", self.channel_name)
```

### Event Types
| Type | Direction | Payload |
|------|-----------|---------|
| `notification` | Server → Client | `{ id, type, title, body, data }` |
| `lead.updated` | Server → Client | `{ leadId, changes }` |
| `opportunity.stage_changed` | Server → Client | `{ opportunityId, fromStage, toStage }` |
| `activity.new` | Server → Client | `{ entityType, entityId, action }` |

### Room Scoping
- `org_{org_id}` — all users in the organization.
- `user_{user_id}` — specific user notifications.
- `entity_{type}_{id}` — real-time updates for a specific entity.

---

## 13. API Deprecation

### Deprecation Headers
```http
Sunset: Sat, 27 Jul 2027 00:00:00 GMT
Deprecation: true
Link: <https://docs.tzahu.com/api/migration-v1-to-v2>; rel="deprecation"
```

### Deprecation Policy
1. Announce deprecation with `Sunset` header ≥ 6 months before removal.
2. Publish migration guide at announcement.
3. After 6 months, endpoint returns `410 Gone`.
4. At least 3 minor releases before breaking change.
5. All deprecations logged in changelog.

### DRF Deprecation Mixin
```python
class DeprecationMixin:
    sunset_date: datetime | None = None
    migration_url: str | None = None

    def dispatch(self, request, *args, **kwargs):
        response = super().dispatch(request, *args, **kwargs)
        if self.sunset_date:
            response["Sunset"] = self.sunset_date.strftime("%a, %d %b %Y %H:%M:%S GMT")
            response["Deprecation"] = "true"
            if self.migration_url:
                response["Link"] = f'<{self.migration_url}>; rel="deprecation"'
        return response
```

---

## 14. OpenAPI Specification (drf-spectacular)

### Configuration
```python
SPECTACULAR_SETTINGS = {
    "TITLE": "TZAHU CRM API",
    "DESCRIPTION": "Enterprise CRM platform API",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "SCHEMA_PATH_PREFIX": "/api/v[0-9]",
    "COMPONENT_SPLIT_REQUEST": True,
    "SORT_OPERATIONS": False,
    "ENUM_NAME_OVERRIDES": {
        "LeadStatusEnum": "apps.lead_management.domain.models.LeadStatus",
    },
    "EXTENSION_PREFIX": "x-tzahu",
    "SWAGGER_UI_SETTINGS": {
        "docExpansion": "list",
        "defaultModelsExpandDepth": -1,
    },
}
```

### CI Validation
```bash
# Generate schema
./manage.py spectacular --file schema.yml --validate

# Check for schema drift (compared to committed version)
diff <(./manage.py spectacular --format openapi-json 2>/dev/null) committed-schema.yml
```

### Schema Versioning
- Generated schema checked into `docs/APIContracts/`.
- Schema per API version: `openapi-v1.yml`, `openapi-v2.yml`.
- Schema diff checked in PRs — any unexpected change must be justified.

---

## 15. API Testing Checklist

### Every New Endpoint
- [ ] Success case (200/201) with full payload?
- [ ] Validation failure (400/422) with missing/invalid fields?
- [ ] Authentication required (401) without token?
- [ ] Authorization required (403) without permission?
- [ ] Not found (404) for non-existent ID?
- [ ] Pagination correct for list endpoints?
- [ ] Filtering works for each filter parameter?
- [ ] Sorting works for each sort parameter?
- [ ] Tenant isolation: org A can't see org B's data?
- [ ] Rate limit response (429) when exceeded?
- [ ] Idempotency works for POST endpoints?
- [ ] Soft delete respected (deleted records excluded)?

### Regression Testing
- [ ] Existing clients not broken by changes?
- [ ] All response fields present in OpenAPI spec?
- [ ] No unexpected schema changes?
- [ ] Performance: p95 < 500ms for p50 load?
