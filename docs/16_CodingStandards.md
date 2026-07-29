# TZAHU CRM — Coding Standards

> **Version:** 0.1.0-draft
> **Last Updated:** 2026-07-27
> **Status:** Approved
> **Owner:** Platform Architecture Team

---

## Table of Contents

1. [Language & Runtime Standards](#1-language--runtime-standards)
2. [Python Coding Standards](#2-python-coding-standards)
3. [Django Standards](#3-django-standards)
4. [Django REST Framework Standards](#4-django-rest-framework-standards)
5. [Domain Layer Standards](#5-domain-layer-standards)
6. [Application Service Layer Standards](#6-application-service-layer-standards)
7. [Infrastructure Layer Standards](#7-infrastructure-layer-standards)
8. [Testing Standards](#8-testing-standards)
9. [Naming Conventions](#9-naming-conventions)
10. [Documentation Standards](#10-documentation-standards)
11. [Git & Collaboration Standards](#11-git--collaboration-standards)
12. [Code Review Checklist](#12-code-review-checklist)

---

## 1. Language & Runtime Standards

### Python Version
- Target: Python 3.13+
- All new code must be compatible with Python 3.13.
- Use Python 3.13 features: `pathlib.Path` exclusively (no `os.path`), `dataclass` for data containers, `ZoneInfo` for timezone handling.
- Do NOT use deprecated features: `distutils`, `pkg_resources`, `datetime.utcnow()`.

### Type System
- Strict type hints everywhere. Enable `mypy` with `--strict` in CI.
- `pyproject.toml` mypy config:
  ```toml
  [tool.mypy]
  strict = true
  disallow_untyped_defs = true
  disallow_any_unimported = true
  no_implicit_optional = true
  warn_return_any = true
  warn_unused_configs = true
  ignore_missing_imports = false
  ```
- Use `from __future__ import annotations` in all files for PEP 604 syntax.
- Prefer `|` over `Optional[]`: `str | None` not `Optional[str]`.
- Use `Self` return type for class methods returning `self`.
- Use `TypeGuard` and `TypeIs` for custom type narrowing.
- All public functions must have annotated return types.
- Use `Protocol` for structural subtyping; use `ABC` only when method implementation is required.

### Linting (ruff)
- Run `ruff check .` pre-commit and in CI.
- Enable all recommended rulesets: `E`, `F`, `W`, `I`, `N`, `UP`, `B`, `SIM`, `ARG`, `C4`, `EM`, `ICN`, `INP`, `ISC`, `LOG`, `NPY`, `PD`, `PGH`, `PIE`, `PL`, `PT`, `PTH`, `PYI`, `RET`, `RSE`, `RUF`, `SLF`, `SLOT`, `T10`, `T20`, `TCH`, `TRY`, `FLY`, `INT`.
- `pyproject.toml` ruff config:
  ```toml
  [tool.ruff]
  line-length = 100
  target-version = "py313"

  [tool.ruff.lint]
  select = ["E", "F", "W", "I", "N", "UP", "B", "SIM", "ARG", "C4", "EM", "ICN", "PL", "PT", "PTH", "RET", "RSE", "T20", "TRY"]
  ignore = ["EM101", "EM102", "PLR0913", "PLR2004"]
  ```

### Formatting (black)
- `black` with `--line-length=100`.
- No exceptions. All code must pass `black --check` in CI.
- `pyproject.toml` black config:
  ```toml
  [tool.black]
  line-length = 100
  target-version = ["py313"]
  skip-magic-trailing-comma = true
  ```

### Pre-commit Hooks
Mandatory hooks (`.pre-commit-config.yaml`):
1. `ruff check` — lint
2. `ruff format` — format
3. `mypy --strict` — type check
4. `check-json` — valid JSON
5. `check-yaml` — valid YAML
6. `detect-private-key` — no secrets
7. `trailing-whitespace` — clean endings
8. `end-of-file-fixer` — final newline
9. `check-added-large-files` — max 500 KB
10. `check-merge-conflict` — no conflict markers

---

## 2. Python Coding Standards

### Imports
```python
from __future__ import annotations

import json
import re
from collections.abc import Sequence
from dataclasses import dataclass
from decimal import Decimal
from uuid import UUID

from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.shared_kernel.domain.base import AggregateRoot, Entity, ValueObject
from apps.shared_kernel.domain.result import Result, PaginatedResult
```

Order: standard library → third-party → Django → first-party. One blank line between groups.

### Docstrings
- Every public module, class, method, and function must have a docstring.
- Follow Google-style docstrings:
  ```python
  def calculate_lead_score(lead: Lead, weights: dict[str, float]) -> int:
      """Calculate lead score based on engagement and demographic data.

      Args:
          lead: The lead entity to score.
          weights: Mapping of scoring factors to their weights.

      Returns:
          Integer score between 0 and 100.

      Raises:
          InvalidScoreWeightsError: If weights don't sum to 1.0.
      """
  ```
- One-liners for trivial accessors:
  ```python
  @property
  def full_name(self) -> str:
      """Return the user's full name."""
  ```

### Error Handling
- Raise domain-specific exceptions from the domain layer.
- Never raise `Exception`, `RuntimeError`, or plain `Django` exceptions from domain code.
- Use `Result[T, E]` pattern for expected failure modes; raise for unexpected failures.
- Always use specific exception types; never catch bare `Exception`.

### Functional Style
- Prefer pure functions: no side effects, no I/O, deterministic output.
- Immutable data structures: use `@dataclass(frozen=True)` for Value Objects.
- Avoid `None` as a sentinel; use `Result` or `Optional` with explicit handling.

---

## 3. Django Standards

### Model Conventions
```python
class LeadModel(TenantScopedModel):
    company_name = models.CharField(max_length=255)
    email = models.EmailField(unique=True)
    status = models.CharField(
        max_length=20,
        choices=LeadStatus.choices,
        default=LeadStatus.NEW,
    )
    score = models.IntegerField(default=0)

    class Meta:
        app_label = "lead_management"
        db_table = "leads"
        verbose_name = "Lead"
        verbose_name_plural = "Leads"
        indexes = [
            models.Index(fields=["status", "score"]),
            models.Index(fields=["organization", "created_at"]),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(score__gte=0),
                name="ck_leads_score_positive",
            ),
        ]

    def __str__(self) -> str:
        return self.company_name
```

Rules:
### Model Class Rules
1. Every Django model must inherit from `TenantScopedModel`, `SoftDeleteModel`, or `AuditableModel` — never from `models.Model` directly.
2. `app_label` must match the module name.
3. `db_table` is snake_case plural of the entity name.
4. Always define `__str__`.
5. `Meta` class must always be defined.
6. All CharFields must define `max_length`.
7. Use `choices` from a `TextChoices` / `IntegerChoices` enum class.
8. No business logic in models. Models are data holders only.

### View Patterns (Thin Views, Fat Services)
- Views must be < 20 lines. Any complexity beyond that belongs in services.
- A view's job: parse request, call service, format response.
```python
class LeadListCreateView(CreateModelMixin, ListModelMixin, GenericViewSet):
    permission_classes = [IsAuthenticated, LeadPermission]
    serializer_class = LeadSerializer

    def create(self, request, *args, **kwargs):
        command = CreateLeadCommand(
            organization_id=request.tenant.org_id,
            created_by_id=request.user.id,
            **request.data,
        )
        result = LeadService().create_lead(command)
        if result.is_failure:
            raise ValidationError(result.error.message)
        serializer = self.get_serializer(result.value)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
```

### Serializer Patterns
- Input serializers: validate and deserialize request data. No `ModelSerializer` for input — use manual `Serializer` with explicit fields.
- Output serializers: `ModelSerializer` with `read_only_fields` for response data. May include nested serializers.
- Always validate uniqueness and existence in service layer, not serializers.
- Use `SerializerMethodField` sparingly; prefer annotated querysets.

### Migration Naming Convention
```
{app_label}/migrations/{sequence}_{action}_{entity}.py
```
Examples:
- `0001_create_lead_model.py`
- `0002_add_score_index_to_leads.py`
- `0003_add_company_size_to_leads.py`
- `0004_squash_migrations_v2.py`

Migration rules:
- Never edit committed migrations.
- Never use `RunSQL` unless unavoidable (document with ADR).
- Data migrations go in `management/commands/` — not in migrations.
- Squash migrations quarterly (v1, v2, v3...).
- Test migrations forward AND backward.

### Settings Management
- `base.py`: shared settings.
- `dev.py`: debug on, SQL logging, console email, local cache.
- `staging.py`: production-like, debug off, low resources.
- `prod.py`: debug off, sentry on, strict security.
- Secrets via environment variables, never hardcoded.

---

## 4. Django REST Framework Standards

### ViewSet Conventions
- One ViewSet per aggregate root.
- Use `ModelViewSet` only for CRUD-heavy resources.
- Custom actions use `@action(detail=True/False, methods=[...])`.
- Action naming: `lead_assign`, `lead_convert`, `lead_import`.
- URL naming: `leads-assign`, `leads-convert`, `leads-import`.

### Permission Classes
- Default: `IsAuthenticated` at the project level.
- Per-viewset: `[IsAuthenticated, LeadPermission]`.
- Permission naming: `{entity}{Permission}` e.g., `LeadPermission`, `OpportunityPermission`.
- Permission logic checks RBAC via `request.user.has_perm(...)`.
- Object-level permissions via `BasePermission.has_object_permission()`.

### Filter Backends
- Use `django-filter` `FilterSet` per ViewSet.
- Filter field naming: `field_name` for exact, `field_name__{lookup}` for operators.
- Common lookups: `exact`, `in`, `gt`, `gte`, `lt`, `lte`, `contains`, `icontains`, `isnull`.
- For full-text search: `search` parameter mapped to `SearchVector`.
- For vector search: `q` parameter mapped via embedding.

```python
class LeadFilterSet(FilterSet):
    status = CharFilter(lookup_expr="exact")
    score_min = NumberFilter(field_name="score", lookup_expr="gte")
    score_max = NumberFilter(field_name="score", lookup_expr="lte")
    created_after = DateTimeFilter(field_name="created_at", lookup_expr="gte")
    search = CharFilter(method="filter_search")

    class Meta:
        model = LeadModel
        fields = {
            "status": ["exact", "in"],
            "score": ["gte", "lte"],
            "company_name": ["icontains"],
            "email": ["exact", "icontains"],
            "created_at": ["gte", "lte", "date"],
        }

    def filter_search(self, queryset, name, value):
        return queryset.filter(
            search_vector=SearchQuery(value, config="english")
        )
```

### Pagination
- Default: `PageNumberPagination` with `page_size=25`, `max_page_size=100`.
- For high-write resources: `CursorPagination` with `ordering=-created_at`.
- Response envelope:
  ```json
  {
    "count": 150,
    "next": "http://.../?cursor=cD0yMDI2LTA3LTI3",
    "previous": null,
    "results": [...]
  }
  ```

### Versioning
- URL-based: `/api/v1/leads/`, `/api/v2/leads/`.
- `DEFAULT_VERSIONING_CLASS = NamespaceVersioning`.
- `ALLOWED_VERSIONS = ["v1"]` during Phase 1.
- Backward-compatible evolution: add fields silently, remove after deprecation period.
- Version bump for breaking changes: field removal, renamed endpoints, changed response types.

### OpenAPI (drf-spectacular)
```python
@extend_schema(
    summary="List leads with filtering and search",
    description="Returns paginated list of leads for the current organization.",
    parameters=[
        OpenApiParameter("status", str, OpenApiParameter.QUERY),
        OpenApiParameter("search", str, OpenApiParameter.QUERY),
    ],
    responses={200: LeadSerializer(many=True)},
)
def list(self, request, *args, **kwargs):
    ...
```
- Auto-generate schema: `./manage.py spectacular --file schema.yml`.
- Validate schema in CI: `./manage.py spectacular --validate`.
- Never disable generation with `@extend_schema(exclude=True)` without ADR.

---

## 5. Domain Layer Standards

### Zero Django Imports
The `domain/` package must have zero Django dependencies. It is pure Python.
- Allowed: `dataclasses`, `enum`, `abc`, `typing`, `decimal`, `uuid`, `datetime`.
- Forbidden: `django.*`, `rest_framework.*`, `celery.*`, any I/O.
- Validation logic lives in Value Object constructors, not in serializers.

### Pure Functions & Immutability
```python
@dataclass(frozen=True)
class Email:
    address: str

    def __post_init__(self) -> None:
        if not re.match(r"^[^@]+@[^@]+\.[^@]+$", self.address):
            raise ValueError(f"Invalid email address: {self.address}")

    def __str__(self) -> str:
        return self.address

@dataclass(frozen=True)
class LeadSource:
    name: str
    confidence: float

    def __post_init__(self) -> None:
        if not 0 <= self.confidence <= 1:
            raise ValueError("Confidence must be between 0 and 1")
```

### Entity Identity Rules
- Entities are identified by their `id` (UUID v7), not by business attributes.
- Two entities with the same `id` are the same entity regardless of other fields.
- Equality: `def __eq__(self, other) -> bool: return isinstance(other, self.__class__) and self.id == other.id`.
- Hash by `id` only.
- Never reuse an `id` across different entity types.

### Aggregate Root Pattern
- Aggregate roots in `domain/models.py`.
- Only aggregate roots have repositories.
- Entities within an aggregate are accessed only through the root.
- Aggregate boundary = transactional consistency boundary.

```python
class Lead(AggregateRoot):
    id: UUID
    company_name: str
    email: Email
    source: LeadSource | None
    status: LeadStatus
    score: int
    contacts: list[Contact]  # Internal entities

    def convert_to_opportunity(self, pipeline_id: UUID) -> Opportunity:
        if self.status != LeadStatus.QUALIFIED:
            raise LeadNotQualifiedError(self.id)
        self.status = LeadStatus.CONVERTED
        self._add_event(LeadConverted(lead_id=self.id))
        return Opportunity(lead_id=self.id, pipeline_id=pipeline_id)
```

### Domain Events
- Events are immutable `@dataclass` objects.
- Event name: past tense verb. `LeadCreated`, `LeadConverted`, `OpportunityWon`.
- Events carry only primitive data or Value Objects — never entities.
- Each event has an `event_id: UUID` (generated at creation) and `occurred_at: datetime`.

---

## 6. Application Service Layer Standards

### One Public Method Per Service
```python
class LeadService:
    def __init__(
        self,
        lead_repo: LeadRepository,
        uow: UnitOfWork,
        event_publisher: EventPublisher,
    ) -> None:
        self._lead_repo = lead_repo
        self._uow = uow
        self._event_publisher = event_publisher

    def create_lead(self, command: CreateLeadCommand) -> Result[LeadResponseDTO, ApplicationError]:
        ...
```

### Command/Query Pattern
```python
@dataclass(frozen=True)
class CreateLeadCommand:
    organization_id: UUID
    created_by_id: UUID
    company_name: str
    email: str
    source_name: str | None = None
    source_confidence: float | None = None

class CreateLeadHandler:
    def __init__(self, service: LeadService) -> None:
        self._service = service

    def handle(self, command: CreateLeadCommand) -> Result[LeadResponseDTO, ApplicationError]:
        return self._service.create_lead(command)
```

Queries follow the same pattern with `Query` suffix:
```python
@dataclass(frozen=True)
class SearchLeadsQuery:
    organization_id: UUID
    status: str | None = None
    search: str | None = None
    page: int = 1
    page_size: int = 25
```

### Result Return Type
- All service methods return `Result[T, E]`.
- `Result` has `.is_success`, `.is_failure`, `.value`, `.error` properties.
- Never raise exceptions from application services.
- Expected failures return `Result.failure(error)`, unexpected failures raise.
- Error types are domain-specific subclasses of `ApplicationError`.

### Dependency Injection
- Services receive dependencies through `__init__`.
- No `from django.conf import settings` in services — pass config via constructor.
- No `import models` in service files — services depend on repository interfaces.

---

## 7. Infrastructure Layer Standards

### Repository Pattern
```python
class DjangoLeadRepository(LeadRepository):
    def __init__(self, org_id: UUID | None = None) -> None:
        self._org_id = org_id

    def save(self, lead: Lead) -> None:
        model = self._to_model(lead)
        model.save()

    def get_by_id(self, lead_id: UUID) -> Lead | None:
        try:
            model = LeadModel.objects.get(id=lead_id)
            return self._to_domain(model)
        except LeadModel.DoesNotExist:
            return None

    def _to_model(self, lead: Lead) -> LeadModel: ...
    def _to_domain(self, model: LeadModel) -> Lead: ...
```

- Repository interfaces (ports) in `domain/` as `Protocol`.
- Repository implementations in `infrastructure/`.
- No business logic in repositories — they are persistence mappers.

### Selector Pattern
For complex queries that don't fit repository pattern:
```python
class LeadSearchSelector:
    def search(self, query: SearchLeadsQuery) -> PaginatedResult[LeadResponseDTO]:
        qs = LeadModel.objects.filter(
            organization_id=query.organization_id,
            deleted_at__isnull=True,
        )
        if query.status:
            qs = qs.filter(status=query.status)
        if query.search:
            qs = qs.annotate(
                rank=SearchRank("search_vector", SearchQuery(query.search))
            ).filter(rank__gte=0.1).order_by("-rank")
        total = qs.count()
        page = qs[(query.page - 1) * query.page_size : query.page * query.page_size]
        return PaginatedResult(
            items=[LeadResponseDTO(**m.__dict__) for m in page],
            total=total,
            page=query.page,
            page_size=query.page_size,
        )
```

### Celery Task Patterns
- Tasks are thin wrappers — logic lives in services.
- `shared_task(bind=True, max_retries=3, default_retry_delay=60)`.
- Always catch expected exceptions and retry.
- Log task_id and correlation_id.
- Tasks return `Result` or raise `Retry` for transient failures.

---

## 8. Testing Standards

### Test Framework
- `pytest` as the test runner with `pytest-django`.
- `factory_boy` for test data factories.
- `freezegun` for time-dependent tests.
- `pytest-cov` for coverage reporting.

### Factory Boy Patterns
```python
class LeadModelFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = "lead_management.LeadModel"

    id = factory.LazyFunction(uuid7)
    organization = factory.SubFactory(OrganizationModelFactory)
    company_name = factory.Faker("company")
    email = factory.Faker("email")
    status = LeadStatus.NEW
    score = 0
    created_by = factory.SubFactory(UserModelFactory)
```

- One factory per Django model.
- One factory per domain entity.
- Use `factory.SubFactory` for related models.
- Override defaults in test methods, not factory definitions.

### Test Naming Convention
```
test_{module}_{method}_{scenario}_{expected}.py
```
Examples:
- `test_lead_service_create_lead_success.py`
- `test_lead_service_create_lead_duplicate_email_failure.py`
- `test_lead_api_list_filters_by_status.py`
- `test_lead_api_create_requires_authentication.py`

Test class names: `Test{Module}{Method}` or `Test{Feature}`.
Test method names: `def test_{scenario}_{expected_result}`.

### Test Structure (Given-When-Then)
```python
def test_create_lead_with_valid_data_returns_lead_dto() -> None:
    # Given
    org = OrganizationModelFactory()
    user = UserModelFactory(organization=org)
    command = CreateLeadCommand(
        organization_id=org.id,
        created_by_id=user.id,
        company_name="Acme Corp",
        email="contact@acme.com",
    )
    service = LeadService(
        lead_repo=DjangoLeadRepository(org_id=org.id),
        uow=DjangoUnitOfWork(),
        event_publisher=InMemoryEventPublisher(),
    )

    # When
    result = service.create_lead(command)

    # Then
    assert result.is_success
    assert result.value.company_name == "Acme Corp"
    assert LeadModel.objects.count() == 1
```

### Coverage Targets
| Layer | Coverage Target |
|-------|----------------|
| Domain | 100% |
| Application services | 95% |
| Infrastructure | 90% |
| API views | 85% |
| **Overall** | **90%+** |

- Coverage enforced in CI: `pytest --cov=apps --cov-fail-under=90`.
- Branch coverage target: 80%.

### Test Categories
- `pytest -m unit` — domain layer, value objects, pure functions. No DB.
- `pytest -m integration` — services, repositories, API endpoints. DB required.
- `pytest -m isolation` — tenant isolation tests.
- `pytest -m contract` — OpenAPI schema validation.
- `pytest -m security` — auth bypass, RLS bypass, injection.
- `pytest -m performance` — benchmark tests.

### Mocking Rules
- Mock at the infrastructure boundary only (external APIs, file system, RabbitMQ).
- Never mock domain entities or Value Objects.
- Use `unittest.mock` or `pytest-mock`.
- Prefer dependency injection over mocking.
- For Celery: use `celery.contrib.testing.tasks` or patch task `apply()`.

---

## 9. Naming Conventions

| Domain | Convention | Example |
|--------|-----------|---------|
| Python packages | snake_case | `lead_management/`, `shared_kernel/` |
| Python modules | snake_case | `models.py`, `value_objects.py` |
| Python classes | PascalCase | `LeadService`, `CreateLeadCommand` |
| Python functions/methods | snake_case | `create_lead()`, `get_by_id()` |
| Python variables | snake_case | `lead_count`, `org_id` |
| Python constants | UPPER_SNAKE | `MAX_SCORE`, `DEFAULT_PAGE_SIZE` |
| Python private methods | _snake_case | `_validate_email()` |
| Django models | PascalCase + Model suffix | `LeadModel`, `ContactModel` |
| Django model `Meta.db_table` | snake_case plural | `leads`, `contacts` |
| Django model fields | snake_case | `company_name`, `created_at` |
| Django app labels | snake_case | `lead_management`, `identity` |
| DRF ViewSets | PascalCase + ViewSet suffix | `LeadViewSet`, `ContactViewSet` |
| DRF Serializers | PascalCase + Serializer suffix | `LeadSerializer`, `CreateLeadInputSerializer` |
| DRF Permissions | PascalCase + Permission suffix | `LeadPermission`, `AdminPermission` |
| DRF Filters | PascalCase + FilterSet suffix | `LeadFilterSet` |
| Database tables | snake_case plural | `leads`, `contact_logs` |
| Database columns | snake_case | `company_name`, `created_at` |
| Database indexes | idx\_{table}\_{column(s)} | `idx_leads_status_score` |
| Database constraints | uq\_(unique) / ck\_(check) | `uq_leads_email`, `ck_leads_score_positive` |
| API URLs | kebab-case | `/api/v1/lead-management/`, `/api/v1/sales-pipeline/` |
| API query params | snake_case | `?status=new&created_after=2026-01-01` |
| API JSON fields | camelCase (req/res) | `companyName`, `createdAt`, `leadSource` |
| API error codes | UPPER_SNAKE | `NOT_FOUND`, `VALIDATION_ERROR` |
| Git branches | type/description-kebab-case | `feat/lead-scoring`, `fix/import-bug` |
| Git commits | Conventional Commits | `feat(leads): add lead scoring endpoint` |
| Docker images | kebab-case | `tzahu-backend`, `tzahu-ai-gateway` |
| K8s resources | kebab-case | `backend-deployment`, `celery-service` |

---

## 10. Documentation Standards

### Docstring Requirements
- Every public API: class, function, method.
- Google-style with `Args:`, `Returns:`, `Raises:`.
- Type annotations in function signature; docstring describes semantics.
- One-liner for trivial getters/setters.

### README Per Module
Each Django app module must have a `README.md`:
```markdown
# lead_management

## Domain
...
## Commands
...
## Events
...
## API Endpoints
...
## Dependencies
...
## Testing
...
```

### Architecture Decision Records (ADRs)
- Every significant architectural decision requires an ADR.
- ADR filename: `{date}-{title-with-dashes}.md`.
- Template: Context → Decision → Consequences → Status.
- Stored in `docs/ArchitectureDecisionRecords/`.
- Minimum ADR triggers: framework choice, database choice, library addition, package structure change.

### Changelog
- Keep `CHANGELOG.md` updated with every meaningful change.
- Format: Keep a Changelog standard.
- Sections: Added, Changed, Deprecated, Removed, Fixed, Security.

---

## 11. Git & Collaboration Standards

### Commit Message Format (Conventional Commits)
```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
Scopes: `leads`, `pipeline`, `auth`, `org`, `workflow`, `notification`, `ai`, `api`, `db`, `infra`, `deps`.

Examples:
```
feat(leads): add AI-powered lead scoring endpoint

Implements POST /api/v1/leads/{id}/score which uses the AI Gateway
to analyze lead data and return a score 0-100.

Closes: #142
```

```
fix(auth): handle expired JWT gracefully in middleware

Return 401 with specific error code instead of 500.
```

### Branch Naming
```
{type}/{description}
```
Examples: `feat/lead-scoring`, `fix/import-crash`, `chore/upgrade-deps`, `docs/api-guide`.

### Pull Request Template
```markdown
## Description
[What does this PR do?]

## Type
- [ ] Feature
- [ ] Bug Fix
- [ ] Refactor
- [ ] Documentation
- [ ] CI/CD
- [ ] Dependencies

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Tenant isolation tests verified
- [ ] Manual testing completed

## Checklist
- [ ] Code follows coding standards
- [ ] Type hints complete
- [ ] Docstrings updated
- [ ] Migration includes forward AND backward
- [ ] No new vulnerabilities introduced
- [ ] Performance impact assessed
- [ ] Changelog updated

## Related Issues
Closes #[issue]
```

### Branch Protection Rules
- `main`: protected. Requires PR, passing CI, 1 approval.
- Direct commits to `main` forbidden.
- `staging`/`production` branches: deploy-only via CI/CD.

---

## 12. Code Review Checklist

### Architecture & Design
- [ ] Follows DDD/Clean Architecture layering? No leaky dependencies?
- [ ] Domain layer has zero Django imports?
- [ ] Service has one public method?
- [ ] Repository/Selector separation correct?
- [ ] Event published for side effects?
- [ ] CQRS respected (commands don't return query data)?
- [ ] No circular dependencies between modules?

### Correctness
- [ ] All edge cases handled?
- [ ] Input validation at boundary?
- [ ] Error handling uses Result pattern?
- [ ] Database constraints prevent data corruption?
- [ ] Race conditions considered? (optimistic locking, unique constraints)
- [ ] Soft delete respected in all queries?

### Security
- [ ] Tenant isolation: organization_id scoped?
- [ ] RLS policy covers new table?
- [ ] Permission check before every mutation?
- [ ] No SQL injection (ORM only, no raw SQL)?
- [ ] No secrets/credentials in code?
- [ ] Input sanitized for XSS?
- [ ] Rate limiting for auth endpoints?
- [ ] File upload validation (type, size, scan)?

### Performance
- [ ] N+1 queries avoided? (select_related, prefetch_related)
- [ ] Indexes for new query patterns?
- [ ] Pagination for list endpoints?
- [ ] Caching strategy considered?
- [ ] Background task for expensive operations?
- [ ] DB query EXPLAIN ANALYZE'd for new queries?

### Testing
- [ ] Unit tests for domain logic?
- [ ] Integration tests for service layer?
- [ ] API endpoint tested for success + failure?
- [ ] Tenant isolation test added?
- [ ] Edge cases tested (empty, null, duplicates)?
- [ ] Coverage >= 90% for new code?

### Code Quality
- [ ] Type hints complete and strict-mypy compliant?
- [ ] No linting violations?
- [ ] No commented-out code?
- [ ] No print/debug statements?
- [ ] Consistent naming conventions?
- [ ] Functions < 30 lines?
- [ ] No TODO/FIXME left in code?
- [ ] Idempotent operations documented?
- [ ] Logging at appropriate level?
- [ ] Metrics added for new operations?
