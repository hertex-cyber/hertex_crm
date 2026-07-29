# TZAHU CRM — Low-Level Design

> **Version:** 0.1.0-draft
> **Last Updated:** 2026-07-27
> **Status:** Foundational Design Phase
> **Owner:** Platform Architecture Team

---

## Table of Contents

1. [Package Structure per Module](#1-package-structure-per-module)
2. [Class Diagrams for Core Patterns](#2-class-diagrams-for-core-patterns)
3. [Sequence Diagrams for Critical Flows](#3-sequence-diagrams-for-critical-flows)
4. [State Machines](#4-state-machines)
5. [Database Relationship Diagram](#5-database-relationship-diagram)

---

## 1. Package Structure per Module

Every module follows this exact package structure. Deviations require Architecture Decision Record.

```
apps/{module_name}/
│
├── __init__.py
│   # Module initialization, default_app_config
│
├── apps.py
│   # Django AppConfig
│   # class LeadManagementConfig(AppConfig):
│   #     name = "apps.lead_management"
│   #     label = "lead_management"
│   #     verbose_name = "Lead Management"
│
├── domain/                          # Pure Python. NO Django imports. NO I/O.
│   ├── __init__.py
│   ├── models.py                    # Aggregate roots and entities
│   │   # class Lead(AggregateRoot): ...
│   │   # class LeadStatus(enum.Enum): ...
│   ├── value_objects.py             # Immutable value objects
│   │   # @dataclass(frozen=True)
│   │   # class LeadSource: ...
│   ├── events.py                    # Domain event classes
│   │   # @dataclass
│   │   # class LeadCreated(DomainEvent): ...
│   ├── exceptions.py                # Domain-specific exceptions
│   │   # class LeadNotFoundError(DomainException): ...
│   └── services.py                  # Domain services (stateless)
│       # class LeadDeduplicationService: ...
│
├── application/                     # Orchestration layer
│   ├── __init__.py
│   ├── services.py                  # Application services
│   │   # class LeadService: ...
│   ├── commands.py                  # Command pattern
│   │   # @dataclass
│   │   # class CreateLeadCommand: ...
│   │   # class CreateLeadHandler: ...
│   ├── queries.py                   # Query pattern
│   │   # @dataclass
│   │   # class GetLeadQuery: ...
│   │   # class GetLeadHandler: ...
│   └── dto.py                       # Data transfer objects
│       # @dataclass
│       # class CreateLeadDTO: ...
│       # @dataclass
│       # class LeadResponseDTO: ...
│
├── infrastructure/                  # Django-aware implementations
│   ├── __init__.py
│   ├── models.py                    # Django ORM models
│   │   # class LeadModel(TenantScopedModel): ...
│   ├── repositories.py              # Repository implementations
│   │   # class DjangoLeadRepository(LeadRepository): ...
│   ├── selectors.py                 # Complex read queries
│   │   # class LeadSearchSelector: ...
│   ├── admin.py                     # Django admin configuration
│   │   # class LeadModelAdmin(admin.ModelAdmin): ...
│   ├── migrations/
│   │   ├── __init__.py
│   │   ├── 0001_initial.py
│   │   └── ...
│   └── management/
│       └── commands/                # Custom ./manage.py commands
│           ├── __init__.py
│           ├── bulk_import_leads.py
│           └── recalculate_scores.py
│
├── api/                             # DRF API layer
│   ├── __init__.py
│   ├── views.py                     # ViewSets
│   │   # class LeadViewSet(ModelViewSet): ...
│   ├── serializers.py               # Serializers
│   │   # class LeadSerializer(serializers.ModelSerializer): ...
│   ├── permissions.py               # Permission classes
│   │   # class LeadPermission(BasePermission): ...
│   ├── filters.py                   # FilterSets
│   │   # class LeadFilterSet(django_filters.FilterSet): ...
│   └── urls.py                      # URL routing
│       # router.register("leads", LeadViewSet)
│
├── adapters/                        # Cross-module integration
│   ├── __init__.py
│   └── event_handlers.py            # Event subscriptions
│       # def handle_lead_created(event): ...
│       # def register_handlers(): ...
│
└── tests/                           # Test suite
    ├── __init__.py
    ├── domain/                      # Pure unit tests (no DB)
    │   ├── __init__.py
    │   ├── test_lead.py
    │   ├── test_value_objects.py
    │   └── test_events.py
    ├── application/                 # Service tests (mock repos)
    │   ├── __init__.py
    │   ├── test_lead_service.py
    │   └── test_commands.py
    ├── infrastructure/              # Repository tests (test DB)
    │   ├── __init__.py
    │   ├── test_repositories.py
    │   └── test_selectors.py
    └── api/                         # API integration tests
        ├── __init__.py
        ├── test_lead_api.py
        └── test_lead_permissions.py
```

### `shared_kernel` Module (Special)

The shared kernel does not follow the standard module structure — it is a library, not a Django app.

```
apps/shared_kernel/
├── __init__.py
├── domain/
│   ├── __init__.py
│   ├── base.py                     # AggregateRoot, Entity, ValueObject
│   ├── events.py                   # DomainEvent base class
│   ├── exceptions.py               # DomainException base class
│   ├── result.py                   # Result[T, E] type
│   └── value_objects.py            # Email, Phone, Address, Money, etc.
├── application/
│   ├── __init__.py
│   ├── ports.py                    # Repository[T], EventPublisher interfaces
│   ├── pagination.py              # PaginatedResult[T]
│   └── unit_of_work.py            # Unit of work pattern
├── infrastructure/
│   ├── __init__.py
│   ├── models.py                   # UUIDModel, TimestampedModel, SoftDeleteModel, TenantScopedModel
│   ├── repository.py              # TenantScopedRepository base
│   ├── event_publisher.py         # RabbitMQEventPublisher, InProcessEventPublisher
│   ├── cache.py                   # CacheService
│   ├── id_generator.py            # uuid7() implementation
│   └── middleware/
│       ├── __init__.py
│       ├── tenant.py              # TenantResolutionMiddleware
│       └── logging.py             # LoggingMiddleware
└── utils/
    ├── __init__.py
    ├── serializers.py             # DRF base serializers
    └── validators.py              # Shared validation functions
```

---

## 2. Class Diagrams for Core Patterns

### 2.1 AggregateRoot

```
┌──────────────────────────────────────────────────────────────────────────┐
│ AggregateRoot (Base for all domain aggregates)                           │
│                                                                           │
│  ┌─────────────────────────────────────────────┐                        │
│  │             AggregateRoot                    │                        │
│  │  (Abstract Base Class)                       │                        │
│  ├─────────────────────────────────────────────┤                        │
│  │ - id: UUID                                  │                        │
│  │ - _events: list[DomainEvent]                │                        │
│  │ - created_at: datetime                      │                        │
│  │ - updated_at: datetime                      │                        │
│  ├─────────────────────────────────────────────┤                        │
│  │ # __init__(**kwargs)                        │                        │
│  │ # __eq__(other): bool                       │  (by id)               │
│  │ # __hash__(): int                           │  (by id)               │
│  │ + collect_events(): list[DomainEvent]       │  (clears after read)   │
│  │ # _record_event(event: DomainEvent): None   │                        │
│  │ + to_dict(): dict                           │                        │
│  └─────────────────────────────────────────────┘                        │
│            ▲                      ▲                      ▲               │
│            │                      │                      │               │
│  ┌─────────┴──────────┐ ┌────────┴───────┐ ┌───────────┴──────────┐    │
│  │   Lead              │ │  Contact        │ │  Opportunity         │    │
│  ├─────────────────────┤ ├────────────────┤ ├──────────────────────┤    │
│  │ - first_name: str   │ │ - email: Email │ │ - name: str          │    │
│  │ - last_name: str    │ │ - phone: Phone │ │ - amount: Money      │    │
│  │ - email: Email      │ │ - company: str │ │ - stage: Stage       │    │
│  │ - company: str      │ │ - position: str│ │ - probability: float │    │
│  │ - source: LeadSource│ │ - preferences  │ │ - close_date: date   │    │
│  │ - status: LeadStatus│ ├────────────────┤ ├──────────────────────┤    │
│  │ - score: int        │ │ + create():    │ │ + change_stage():    │    │
│  ├─────────────────────┤ │ + merge():     │ │ + update_amount():   │    │
│  │ + create(): events  │ │ + update():    │ │ + win(): events      │    │
│  │ + qualify(): events │ │ + export():    │ │ + lose(): events     │    │
│  │ + convert(): events │ │ + forget():    │ │ + forecast_value():  │    │
│  │ + assign(): events  │ └────────────────┘ └──────────────────────┘    │
│  │ + disqualify():     │                                                │
│  │   events            │                                                │
│  └─────────────────────┘                                                │
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Entity

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Entity (Mutable, has identity via UUID)                                  │
│                                                                           │
│  ┌─────────────────────────────────────────────┐                        │
│  │               Entity (Base)                  │                        │
│  ├─────────────────────────────────────────────┤                        │
│  │ - id: UUID                                  │                        │
│  │ - created_at: datetime                      │                        │
│  │ - updated_at: datetime                      │                        │
│  ├─────────────────────────────────────────────┤                        │
│  │ # __eq__: identity comparison               │                        │
│  │ # __hash__: by id                           │                        │
│  └─────────────────────────────────────────────┘                        │
│            ▲                      ▲                                     │
│            │                      │                                     │
│  ┌─────────┴──────────┐ ┌────────┴──────────┐                          │
│  │   Session           │ │   Activity         │                          │
│  ├─────────────────────┤ ├───────────────────┤                          │
│  │ - user_id: UUID     │ │ - type: Activity   │                          │
│  │ - refresh_token_    │ │   Type              │                          │
│  │   hash: str         │ │ - subject: str     │                          │
│  │ - device_info:      │ │ - duration: int    │                          │
│  │   DeviceInfo        │ │ - outcome: str     │                          │
│  │ - ip_address: str   │ ├───────────────────┤                          │
│  │ - expires_at:       │ │ + log(): events   │                          │
│  │   datetime          │ └───────────────────┘                          │
│  ├─────────────────────┤                                                  │
│  │ + rotate_refresh_   │                                                  │
│  │   token(): None     │                                                  │
│  │ + revoke(): None    │                                                  │
│  │ + is_expired(): bool│                                                  │
│  └─────────────────────┘                                                  │
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.3 ValueObject

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ValueObject (Immutable, value-based equality)                            │
│                                                                           │
│  ┌─────────────────────────────────────────────┐                        │
│  │           ValueObject (Base)                 │                        │
│  │  (dataclass(frozen=True))                    │                        │
│  ├─────────────────────────────────────────────┤                        │
│  │ + __eq__: structural equality               │                        │
│  │ + __hash__: hash of all fields              │                        │
│  │ + __str__: string representation            │                        │
│  └─────────────────────────────────────────────┘                        │
│            ▲                      ▲                      ▲               │
│            │                      │                      │               │
│  ┌─────────┴──────────┐ ┌────────┴───────┐ ┌───────────┴──────────┐    │
│  │   Email             │ │  Phone          │ │  Money               │    │
│  ├─────────────────────┤ ├────────────────┤ ├──────────────────────┤    │
│  │ - value: str        │ │ - country_code │ │ - amount: Decimal    │    │
│  ├─────────────────────┤ │   : str        │ │ - currency: Currency │    │
│  │ + validate(): None  │ │ - national_num │ ├──────────────────────┤    │
│  │ + domain(): str     │ │   : str        │ │ + add(other): Money  │    │
│  │ + is_company_email  │ ├────────────────┤ │ + multiply(factor):  │    │
│  │   (): bool          │ │ + e164(): str  │ │   Money              │    │
│  └─────────────────────┘ │ + is_mobile(): │ └──────────────────────┘    │
│                           │   bool         │                            │
│  ┌─────────────────────┐ └────────────────┘                             │
│  │   Address            │                                               │
│  ├─────────────────────┤                                                │
│  │ - street: str       │                                                │
│  │ - city: str         │                                                │
│  │ - state: str        │                                                │
│  │ - postal_code: str  │                                                │
│  │ - country: str      │                                                │
│  ├─────────────────────┤                                                │
│  │ + formatted(): str  │                                                │
│  │ + geocode(): coord  │                                                │
│  └─────────────────────┘                                                │
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.4 DomainEvent

```
┌──────────────────────────────────────────────────────────────────────────┐
│ DomainEvent (Fact about something that happened)                         │
│                                                                           │
│  ┌─────────────────────────────────────────────┐                        │
│  │           DomainEvent (Base)                 │                        │
│  ├─────────────────────────────────────────────┤                        │
│  │ - event_id: UUID                            │  (uuid7, auto)         │
│  │ - occurred_at: datetime                     │  (utcnow, auto)        │
│  │ - organization_id: UUID                     │  (from thread-local)   │
│  │ - event_type: str                           │  (auto: class name)    │
│  │ - aggregate_type: str                       │                        │
│  │ - aggregate_id: UUID                        │                        │
│  │ - version: int                              │  (event versioning)    │
│  ├─────────────────────────────────────────────┤                        │
│  │ + to_dict(): dict                           │                        │
│  │ + to_json(): str                            │                        │
│  └─────────────────────────────────────────────┘                        │
│            ▲                      ▲                      ▲               │
│            │                      │                      │               │
│  ┌─────────┴──────────┐ ┌────────┴───────┐ ┌───────────┴──────────┐    │
│  │   LeadCreated       │ │  StageChanged   │ │  OpportunityWon     │    │
│  ├─────────────────────┤ ├────────────────┤ ├──────────────────────┤    │
│  │ - lead_id: UUID     │ │ - opportunity  │ │ - opportunity_id:   │    │
│  │ - first_name: str   │ │   _id: UUID    │ │   UUID              │    │
│  │ - last_name: str    │ │ - from_stage:  │ │ - won_amount: Money │    │
│  │ - email: str        │ │   str          │ │ - close_date: date  │    │
│  │ - source: str       │ │ - to_stage:    │ │ - won_reason: str   │    │
│  │ - assigned_to: UUID │ │   str          │ ├──────────────────────┤    │
│  │   | None            │ │ - probability: │ │ + event_type =       │    │
│  ├─────────────────────┤ │   float        │ │   "pipeline.oppty   │    │
│  │ + event_type =       │ ├────────────────┤ │   .won"             │    │
│  │   "lead_management   │ │ + event_type =  │ └──────────────────────┘    │
│  │   .lead.created"    │ │   "pipeline.     │                           │
│  └─────────────────────┘ │   opportunity.   │                           │
│                           │   stage_changed" │                           │
│                           └────────────────┘                            │
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.5 Repository (Port & Adapter)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Repository Pattern                                                        │
│                                                                           │
│  ┌─────────────────────────────────────────────┐  (Port — in domain)    │
│  │       Repository[T] (Abstract Interface)     │                        │
│  ├─────────────────────────────────────────────┤                        │
│  │ + get_by_id(id: UUID) -> T | None           │                        │
│  │ + save(entity: T) -> T                      │                        │
│  │ + delete(entity: T) -> None                 │                        │
│  │ + list(filters: dict) -> PaginatedResult[T]  │                        │
│  │ + count(filters: dict) -> int               │                        │
│  │ + exists(filters: dict) -> bool             │                        │
│  └─────────────────────────────────────────────┘                        │
│            ▲                      ▲                                     │
│            │                      │                                     │
│  ┌─────────┴──────────────────┐ ┌┴─────────────────────────────┐       │
│  │ LeadRepository (Interface)  │ │ ContactRepository (Interface)│       │
│  ├────────────────────────────┤ ├──────────────────────────────┤       │
│  │ + find_by_email(email) ->  │ │ + find_by_email(email) ->    │       │
│  │   T | None                 │ │   T | None                  │       │
│  │ + find_duplicates(lead) -> │ │ + merge(primary, secondary)  │       │
│  │   list[T]                  │ │   -> T                       │       │
│  │ + search(query) ->         │ │ + search(query) ->           │       │
│  │   PaginatedResult[T]       │ │   PaginatedResult[T]         │       │
│  └────────────────────────────┘ └──────────────────────────────┘       │
│            ▲                                            ▲               │
│            │ (implements)                               │ (implements)  │
│  ┌─────────┴────────────────────┐  ┌────────────────────┴──────────┐   │
│  │ DjangoLeadRepository         │  │ DjangoContactRepository        │   │
│  │ (infrastructure)             │  │ (infrastructure)               │   │
│  ├──────────────────────────────┤  ├────────────────────────────────┤   │
│  │ - model_class = LeadModel    │  │ - model_class = ContactModel   │   │
│  │ - lead_to_entity() -> Lead   │  │ - contact_to_entity() ->       │   │
│  │ - entity_to_model(lead) ->   │  │   Contact                      │   │
│  │   LeadModel                 │  │ - entity_to_model(contact) ->  │   │
│  └──────────────────────────────┘  │   ContactModel                 │   │
│                                    └────────────────────────────────┘   │
│                                                                           │
│  Base Implementation: TenantScopedRepository                              │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │ class TenantScopedRepository(Repository[T]):                     │    │
│  │     def __init__(self, model_class, org_id=None):               │    │
│  │         self.model_class = model_class                          │    │
│  │         self._org_id = org_id or get_current_org_id()           │    │
│  │                                                                  │    │
│  │     def get_by_id(self, id):                                     │    │
│  │         qs = self.model_class.objects.filter(id=id)             │    │
│  │         if self._org_id:                                         │    │
│  │             qs = qs.filter(organization_id=self._org_id)        │    │
│  │         return self._to_entity(qs.first())                      │    │
│  │                                                                  │    │
│  │     def save(self, entity):                                      │    │
│  │         if hasattr(entity, 'organization_id') and not entity.org │    │
│  │             entity.organization_id = self._org_id               │    │
│  │         model = self._to_model(entity)                           │    │
│  │         model.save()                                             │    │
│  │         return self._to_entity(model)                            │    │
│  └──────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.6 Service Layers

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Application Service (Orchestration)                                      │
│                                                                           │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │ class LeadService:                                                │    │
│  │                                                                   │    │
│  │     def __init__(                                                   │    │
│  │         self,                                                       │    │
│  │         repository: LeadRepository,        # Port injection        │    │
│  │         event_publisher: EventPublisher,   # Port injection        │    │
│  │         dedup_service: LeadDedupService,   # Domain service        │    │
│  │         unit_of_work: UnitOfWork,          # Transaction mgmt      │    │
│  │     ):                                                             │    │
│  │                                                                     │    │
│  │     def create_lead(self, dto: CreateLeadDTO) -> Result[LeadDTO,   │    │
│  │         LeadError]:                                                │    │
│  │         # 1. Validate business rules                                │    │
│  │         if self.dedup_service.is_duplicate(dto.email, dto.company):│    │
│  │             return Result.fail(DuplicateLeadError(dto.email))      │    │
│  │                                                                     │    │
│  │         # 2. Create domain entity                                   │    │
│  │         lead = Lead.create(                                         │    │
│  │             first_name=dto.first_name,                              │    │
│  │             last_name=dto.last_name,                                │    │
│  │             email=Email(dto.email),                                 │    │
│  │             source=LeadSource(dto.source),                          │    │
│  │             ...                                                      │    │
│  │         )                                                           │    │
│  │                                                                     │    │
│  │         # 3. Persist (within transaction)                           │    │
│  │         with self.unit_of_work:                                     │    │
│  │             saved = self.repository.save(lead)                     │    │
│  │                                                                     │    │
│  │         # 4. Publish events (after commit)                          │    │
│  │         events = lead.collect_events()                              │    │
│  │         self.event_publisher.publish(events, org_id=...)           │    │
│  │                                                                     │    │
│  │         # 5. Return result                                          │    │
│  │         return Result.ok(LeadDTO.from_entity(saved))               │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                                                                           │
│ Domain Service (Stateless Business Logic)                                │
│                                                                           │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │ class LeadDeduplicationService:                                  │    │
│  │     """Pure domain logic — no I/O, no Django."""                  │    │
│  │                                                                   │    │
│  │     def __init__(self, config: DedupConfig):                     │    │
│  │         self.config = config                                     │    │
│  │                                                                   │    │
│  │     def is_duplicate(self, email: Email, company: str,           │    │
│  │                       existing: list[Lead]) -> bool:            │    │
│  │         # Exact email match                                       │    │
│  │         if any(l.email == email for l in existing):              │    │
│  │             return True                                           │    │
│  │         # Fuzzy company + name match                              │    │
│  │         threshold = self.config.fuzzy_threshold                   │    │
│  │         ...                                                       │    │
│  │         return False                                              │    │
│  └──────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.7 Command / Query Pattern

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Command / Query Separation (CQS)                                         │
│                                                                           │
│  Command (Write):                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │ @dataclass                                                        │    │
│  │ class CreateLeadCommand:                                          │    │
│  │     first_name: str                                              │    │
│  │     last_name: str                                               │    │
│  │     email: str                                                   │    │
│  │     company: str                                                 │    │
│  │     source: str                                                  │    │
│  │     assigned_to: UUID | None                                     │    │
│  │                                                                   │    │
│  │ class CreateLeadHandler:                                          │    │
│  │     def __init__(self, service: LeadService):                    │    │
│  │         self.service = service                                   │    │
│  │     def handle(self, cmd: CreateLeadCommand, ctx: Context) ->    │    │
│  │         Result[LeadDTO, LeadError]:                              │    │
│  │         dto = CreateLeadDTO.from_command(cmd, ctx)               │    │
│  │         return self.service.create_lead(dto)                     │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                                                                           │
│  Query (Read):                                                           │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │ @dataclass                                                        │    │
│  │ class SearchLeadsQuery:                                           │    │
│  │     query: str                                                   │    │
│  │     filters: dict                                                │    │
│  │     page: int = 1                                                │    │
│  │     page_size: int = 20                                          │    │
│  │                                                                   │    │
│  │ class SearchLeadsHandler:                                         │    │
│  │     def __init__(self, selector: LeadSearchSelector):            │    │
│  │         self.selector = selector                                 │    │
│  │     def handle(self, query: SearchLeadsQuery, ctx: Context) ->  │    │
│  │         PaginatedResult[LeadDTO]:                                │    │
│  │         return self.selector.search(                              │    │
│  │             query=query.query,                                    │    │
│  │             filters=query.filters,                                │    │
│  │             org_id=ctx.org_id,                                    │    │
│  │             page=query.page,                                      │    │
│  │             page_size=query.page_size                             │    │
│  │         )                                                         │    │
│  └──────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Sequence Diagrams for Critical Flows

### 3.1 User Registration → Email Verification → JWT Issuance → First Login

```
User                      Frontend                     Django API                      Identity Module               Email Service
 │                          │                              │                              │                          │
 │ 1. Fill registration     │                              │                              │                          │
 │   form                   │                              │                              │                          │
 │─────────────────────────►│                              │                              │                          │
 │                          │                              │                              │                          │
 │                          │ 2. POST /auth/register       │                              │                          │
 │                          │    {email, password,         │                              │                          │
 │                          │     first_name, last_name}   │                              │                          │
 │                          │────────────────────────────►│                              │                          │
 │                          │                              │                              │                          │
 │                          │                              │ 3. Validate input            │                          │
 │                          │                              │ 4. Check email uniqueness    │                          │
 │                          │                              │ 5. Create User aggregate:    │                          │
 │                          │                              │    User.register(email, pw) │                          │
 │                          │                              │    → UserRegistered event   │                          │
 │                          │                              │    → EmailVerifiedPending    │                          │
 │                          │                              │                              │                          │
 │                          │                              │ 6. Hash password (bcrypt)   │                          │
 │                          │                              │ 7. Generate verification     │                          │
 │                          │                              │    token                    │                          │
 │                          │                              │ 8. Save user + token to DB  │                          │
 │                          │                              │                              │                          │
 │                          │                              │ 9. Send verification email   │                          │
 │                          │                              │────────────────────────────────────────────────────►│
 │                          │                              │                              │                          │
 │                          │ 10. 201 Created              │                              │                          │
 │                          │◄────────────────────────────│                              │                          │
 │                          │                              │                              │                          │
 │ 11. "Check your email"   │                              │                              │                          │
 │◄─────────────────────────│                              │                              │                          │
 │                          │                              │                              │                          │
 │ 12. Opens email, clicks  │                              │                              │                          │
 │     verification link    │                              │                              │                          │
 │─────────────────────────►│                              │                              │                          │
 │                          │                              │                              │                          │
 │                          │ 13. POST /auth/verify-email  │                              │                          │
 │                          │     {token}                  │                              │                          │
 │                          │────────────────────────────►│                              │                          │
 │                          │                              │                              │                          │
 │                          │                              │ 14. Verifies token hash     │                          │
 │                          │                              │ 15. User.verify_email(token)│                          │
 │                          │                              │     → EmailVerified event   │                          │
 │                          │                              │ 16. Update user status:     │                          │
 │                          │                              │     PENDING_VERIFY → ACTIVE │                          │
 │                          │                              │                              │                          │
 │                          │ 17. 200 OK (verified)        │                              │                          │
 │                          │◄────────────────────────────│                              │                          │
 │                          │                              │                              │                          │
 │ 18. Redirect to login    │                              │                              │                          │
 │◄─────────────────────────│                              │                              │                          │
 │                          │                              │                              │                          │
 │ 19. Enter credentials    │                              │                              │                          │
 │─────────────────────────►│                              │                              │                          │
 │                          │                              │                              │                          │
 │                          │ 20. POST /auth/login         │                              │                          │
 │                          │     {email, password}        │                              │                          │
 │                          │────────────────────────────►│                              │                          │
 │                          │                              │                              │                          │
 │                          │                              │ 21. Load user by email      │                          │
 │                          │                              │ 22. Verify password (bcrypt)│                          │
 │                          │                              │ 23. Check user is ACTIVE    │                          │
 │                          │                              │ 24. User.login()            │                          │
 │                          │                              │     → UserLoggedIn event    │                          │
 │                          │                              │                              │                          │
 │                          │                              │ 25. Generate JWT pair:      │                          │
 │                          │                              │     - Access token (15 min) │                          │
 │                          │                              │     - Refresh token (7 days)│                          │
 │                          │                              │ 26. Hash refresh token,     │                          │
 │                          │                              │     save session            │                          │
 │                          │                              │                              │                          │
 │                          │ 27. 200 OK                   │                              │                          │
 │                          │    {access_token,            │                              │                          │
 │                          │     refresh_token,           │                              │                          │
 │                          │     user}                    │                              │                          │
 │                          │◄────────────────────────────│                              │                          │
 │                          │                              │                              │                          │
 │ 28. Store tokens,        │                              │                              │                          │
 │     redirect to dashboard│                              │                              │                          │
 │◄─────────────────────────│                              │                              │                          │
```

### 3.2 Lead Creation → Repository Save → Event Publish → Workflow → Notification

```
Service: LeadService           Domain: Lead           Repo: DjangoLeadRepo        EventPublisher           RabbitMQ           Celery: Workflow         Celery: Notify
     │                            │                       │                           │                     │                   │                       │
     │ 1. create_lead(dto)       │                       │                           │                     │                   │                       │
     │──────────────────────────►│                       │                           │                     │                   │                       │
     │                            │                       │                           │                     │                   │                       │
     │                            │ 2. Lead.create(...)  │                           │                     │                   │                       │
     │                            │ 3. Validate rules    │                           │                     │                   │                       │
     │                            │ 4. Record event:     │                           │                     │                   │                       │
     │                            │    LeadCreated       │                           │                     │                   │                       │
     │◄──────────────────────────│                       │                           │                     │                   │                       │
     │                            │                       │                           │                     │                   │                       │
     │ 5. unit_of_work.begin()   │                       │                           │                     │                   │                       │
     │ 6. repository.save(lead)  │                       │                           │                     │                   │                       │
     │─────────────────────────────────────────────────►│                           │                     │                   │                       │
     │                            │                       │ 7. entity_to_model(lead)  │                     │                   │                       │
     │                            │                       │    → LeadModel            │                     │                   │                       │
     │                            │                       │ 8. model.save()           │                     │                   │                       │
     │                            │                       │    INSERT INTO leads...   │                     │                   │                       │
     │                            │                       │ 9. model_to_entity(saved) │                     │                   │                       │
     │◄──────────────────────────────────────────────────│    → saved_lead            │                     │                   │                       │
     │                            │                       │                           │                     │                   │                       │
     │ 10. unit_of_work.commit() │                       │                           │                     │                   │                       │
     │                            │                       │                           │                     │                   │                       │
     │ 11. events = lead.        │                       │                           │                     │                   │                       │
     │     collect_events()      │                       │                           │                     │                   │                       │
     │ 12. publish(events)       │                       │                           │                     │                   │                       │
     │────────────────────────────────────────────────────────────────────────────►│                     │                   │                       │
     │                            │                       │                           │ 13. Serialize events│                     │                   │                       │
     │                            │                       │                           │ 14. BasicPublish()  │                     │                   │                       │
     │                            │                       │                           │────────────────────►│                     │                       │
     │                            │                       │                           │                     │ 15. Route to queues │                   │                       │
     │                            │                       │                           │                     │ 16. Domain event    │                   │                       │
     │                            │                       │                           │                     │     stored in queue  │                   │                       │
     │                            │                       │                           │                     │                     │                       │
     │ 17. Return Result.ok(dto) │                       │                           │                     │ 18. Worker picks up │                       │
     │                            │                       │                           │                     │     message          │                       │
     │                            │                       │                           │                     │◄────────────────────│                       │
     │                            │                       │                           │                     │                     │                       │
     │                            │                       │                           │                     │ 19. Idempotency chk │                       │
     │                            │                       │                           │                     │ 20. Restore tenant  │                       │
     │                            │                       │                           │                     │     context          │                       │
     │                            │                       │                           │                     │ 21. Query workflows  │                       │
     │                            │                       │                           │                     │     matching trigger │                       │
     │                            │                       │                           │                     │ 22. Evaluate conds  │                       │
     │                            │                       │                           │                     │ 23. Execute actions │                       │
     │                            │                       │                           │                     │     (e.g., notify)   │                       │
     │                            │                       │                           │                     │                     │                       │
     │                            │                       │                           │                     │ 24. Publish:        │                       │
     │                            │                       │                           │                     │     SendNotification │                       │
     │                            │                       │                           │                     │──────────────────────────────────────────────►│
     │                            │                       │                           │                     │                     │                       │
     │                            │                       │                           │                     │                     │ 25. Load template    │
     │                            │                       │                           │                     │                     │ 26. Render with ctx │
     │                            │                       │                           │                     │                     │ 27. Deliver via      │
     │                            │                       │                           │                     │                     │     channel (email)  │
     │                            │                       │                           │                     │                     │ 28. Record delivery  │
```

### 3.3 Tenant Resolution → Middleware → RLS → Repository Scoping

```
Request                    TenantResolutionMiddleware         PostgreSQL              TenantScopedRepository          Celery: TenantAwareTask
  │                              │                              │                          │                              │
  │ HTTP Request                 │                              │                          │                              │
  │ (Authorization: Bearer JWT) │                              │                          │                              │
  │────────────────────────────►│                              │                          │                              │
  │                              │                              │                          │                              │
  │                              │ 1. Extract JWT              │                          │                              │
  │                              │ 2. Verify signature (RS256) │                          │                              │
  │                              │ 3. Decode payload:          │                          │                              │
  │                              │    user_id, org_id, roles   │                          │                              │
  │                              │                              │                          │                              │
  │                              │ 4. Check user is member of  │                          │                              │
  │                              │    org (Redis cache → DB)   │                          │                              │
  │                              │                              │                          │                              │
  │                              │ 5. Check tenant is ACTIVE   │                          │                              │
  │                              │    (Redis cache → DB)       │                          │                              │
  │                              │                              │                          │                              │
  │                              │ 6. SET app.current_         │                          │                              │
  │                              │    organization_id = <org>  │                          │                              │
  │                              │───────────────────────────►│                          │                              │
  │                              │    PostgreSQL session var   │                          │                              │
  │                              │    set for this connection  │                          │                              │
  │                              │◄───────────────────────────│                          │                              │
  │                              │                              │                          │                              │
  │                              │ 7. request.organization_id  │                          │                              │
  │                              │    = org_id                 │                          │                              │
  │                              │ 8. Call next middleware     │                          │                              │
  │                              │    or view                  │                          │                              │
  │                              │                              │                          │                              │
  │                              │    (View calls service)     │                          │                              │
  │                              │────────────────────────────────────────────────────►│                              │
  │                              │                              │                          │                              │
  │                              │                              │ 9. Repository.get_by_id │                              │
  │                              │                              │    (id)                  │                              │
  │                              │                              │    .filter(org_id=ctx)  │                              │
  │                              │                              │                          │                              │
  │                              │                              │ 10. SELECT * FROM leads  │                              │
  │                              │                              │     WHERE id = $1       │                              │
  │                              │                              │     AND organization_id │                              │
  │                              │                              │     = current_setting(  │                              │
  │                              │                              │       'app.current_     │                              │
  │                              │                              │       organization_id'  │                              │
  │                              │                              │     )::uuid            │                              │
  │                              │                              │                          │                              │
  │                              │                              │ 11. RLS Policy Check:   │                              │
  │                              │                              │     • Is the session     │                              │
  │                              │                              │       var set?          │                              │
  │                              │                              │     • Does org_id match? │                              │
  │                              │                              │     • Return row or     │                              │
  │                              │                              │       empty set         │                              │
  │                              │                              │                          │                              │
  │                              │                              │ (RLS is transparent to  │                              │
  │                              │                              │  application — if it    │                              │
  │                              │                              │  fails, query returns   │                              │
  │                              │                              │  0 rows silently)       │                              │
  │                              │                              │                          │                              │
  │                              │ 12. Response                │                          │                              │
  │                              │◄────────────────────────────│                          │                              │
  │                              │                              │                          │                              │
  │                              │ 13. RESET app.current_      │                          │                              │
  │                              │     organization_id = NULL  │                          │                              │
  │                              │───────────────────────────►│                          │                              │
  │                              │    (Prevent cross-request   │                          │                              │
  │                              │     leakage in connection   │                          │                              │
  │                              │     pool)                   │                          │                              │
  │                              │◄───────────────────────────│                          │                              │
  │                              │                              │                          │                              │
  │ HTTP Response                │                              │                          │                              │
  │◄────────────────────────────│                              │                          │                              │
  │                              │                              │                          │                              │
  │                              │   (Celery Task receives event with org_id)            │                              │
  │                              │                              │                          │                              │
  │                              │                              │                          │ 14. Task.__call__(event)    │
  │                              │                              │                          │────────────────────────────►│
  │                              │                              │                          │                              │
  │                              │                              │                          │ 15. Extract org_id from     │
  │                              │                              │                          │     event envelope          │
  │                              │                              │                          │ 16. set_current_org_id()   │
  │                              │                              │                          │     (thread-local)          │
  │                              │                              │                          │ 17. SET app.current_       │
  │                              │                              │                          │     organization_id         │
  │                              │                              │◄─────────────────────────│                              │
  │                              │                              │                          │                              │
  │                              │                              │ 18. RLS active for       │                              │
  │                              │                              │     task execution       │                              │
  │                              │                              │                          │                              │
  │                              │                              │ 19. RESET after task     │                              │
  │                              │                              │     completion           │                              │
  │                              │                              │◄─────────────────────────│                              │
```

### 3.4 AI Query → MCP Tool Selection → Tool Execution → Response

```
User              Frontend            Django API              AI Gateway (FastAPI)          LangChain            MCP Server          OpenAI/LLM         CRM DB
 │                    │                    │                         │                         │                    │                   │                │
 │ User asks          │                    │                         │                         │                    │                   │                │
 │ question           │                    │                         │                         │                    │                   │                │
 │───────────────────►│                    │                         │                         │                    │                   │                │
 │                    │                    │                         │                         │                    │                   │                │
 │                    │ POST /api/v1/ai/   │                         │                         │                    │                   │                │
 │                    │ query {text}       │                         │                         │                    │                   │                │
 │                    │───────────────────►│                         │                         │                    │                   │                │
 │                    │                    │                         │                         │                    │                   │                │
 │                    │                    │ Auth/Tenant Middleware   │                         │                    │                   │                │
 │                    │                    │ Validate rate limit      │                         │                    │                   │                │
 │                    │                    │ Forward to AI Gateway    │                         │                    │                   │                │
 │                    │                    │────────────────────────►│                         │                    │                   │                │
 │                    │                    │                         │                         │                    │                   │                │
 │                    │                    │                         │ 1. Intent Classification │                    │                   │                │
 │                    │                    │                         │────────────────────────►│                    │                   │                │
 │                    │                    │                         │ 2. "QUERY" (list leads) │                    │                   │                │
 │                    │                    │                         │◄────────────────────────│                    │                   │                │
 │                    │                    │                         │                         │                    │                   │                │
 │                    │                    │                         │ 3. Entity Extraction    │                    │                   │                │
 │                    │                    │                         │────────────────────────►│                    │                   │                │
 │                    │                    │                         │ 4. Entities: {          │                    │                   │                │
 │                    │                    │                         │    filters: {...}}      │                    │                   │                │
 │                    │                    │                         │◄────────────────────────│                    │                   │                │
 │                    │                    │                         │                         │                    │                   │                │
 │                    │                    │                         │ 5. Tool Selection (MCP) │                    │                   │                │
 │                    │                    │                         │────────────────────────►│                    │                   │                │
 │                    │                    │                         │ 6. Discover tools:      │                    │                   │                │
 │                    │                    │                         │    GET /v1/tools        │                    │                   │                │
 │                    │                    │                         │────────────────────────────────────────────►│                   │                │
 │                    │                    │                         │ 7. Available tools:    │                    │                   │                │
 │                    │                    │                         │    [search_leads, ...]  │                    │                   │                │
 │                    │                    │                         │◄────────────────────────────────────────────│                   │                │
 │                    │                    │                         │                         │                    │                   │                │
 │                    │                    │                         │ 8. Select: search_leads│                    │                   │                │
 │                    │                    │                         │ 9. Call tool:          │                    │                   │                │
 │                    │                    │                         │    search_leads(filters)│                    │                   │                │
 │                    │                    │                         │────────────────────────────────────────────►│                   │                │
 │                    │                    │                         │                         │                    │                   │                │
 │                    │                    │                         │                         │                    │ 10. Validate input │                │
 │                    │                    │                         │                         │                    │ 11. Call Django API│                │
 │                    │                    │                         │                         │                    │──────────────────────────────────►│
 │                    │                    │                         │                         │                    │ 12. Query leads    │                │
 │                    │                    │                         │                         │                    │     (RLS applied)  │                │
 │                    │                    │                         │                         │                    │◄─────────────────────────────────│
 │                    │                    │                         │                         │                    │ 13. Format results │                │
 │                    │                    │                         │◄────────────────────────────────────────────│                   │                │
 │                    │                    │                         │                         │                    │                   │                │
 │                    │                    │                         │ 14. Response Generation│                    │                   │                │
 │                    │                    │                         │────────────────────────►│                    │                   │                │
 │                    │                    │                         │ 15. System + context   │                    │                   │                │
 │                    │                    │                         │    + user prompt       │                    │                   │                │
 │                    │                    │                         │─────────────────────────────────────────────────────────────►│                │
 │                    │                    │                         │ 16. LLM response       │                    │                   │                │
 │                    │                    │                         │◄─────────────────────────────────────────────────────────────│                │
 │                    │                    │                         │◄────────────────────────│                    │                   │                │
 │                    │                    │                         │                         │                    │                   │                │
 │                    │                    │                         │ 17. Log + cost track   │                    │                   │                │
 │                    │                    │ 18. Return response     │                         │                    │                   │                │
 │                    │◄───────────────────│                         │                         │                    │                   │                │
 │                    │                    │                         │                         │                    │                   │                │
 │ 19. Display AI     │                    │                         │                         │                    │                   │                │
 │     response       │                    │                         │                         │                    │                   │                │
 │◄───────────────────│                    │                         │                         │                    │                   │                │
```

---

## 4. State Machines

### 4.1 Lead Status

```
                    ┌──────────────────┐
                    │      NEW         │
                    └────────┬─────────┘
                             │
               ┌─────────────┼─────────────┐
               │             │             │
               ▼             ▼             ▼
        ┌────────────┐ ┌────────────┐ ┌────────────┐
        │ CONTACTED   │ │ QUALIFIED   │ │ DISQUALIFIED│
        └────────────┘ └────────────┘ └────────────┘
               │             │
               │             ▼
               │      ┌────────────┐
               │      │ CONVERTED   │
               │      └────────────┘
               │
               ▼
        ┌────────────┐
        │  REcycled   │
        └────────────┘

Valid Transitions:
  NEW         → CONTACTED, QUALIFIED, DISQUALIFIED
  CONTACTED   → QUALIFIED, DISQUALIFIED
  QUALIFIED   → CONVERTED, CONTACTED (re-qualify)
  CONVERTED   → (terminal — leads cannot be unconverted)
  DISQUALIFIED→ RECYCLED (after 30 days)
  RECYCLED    → NEW (re-enters pool)

Invariants:
  - Only QUALIFIED leads can be CONVERTED
  - CONVERTED creates Contact + Account + Opportunity
  - DISQUALIFIED requires a reason
  - RECYCLED leads reset to NEW with original data preserved
```

### 4.2 Opportunity Stage

```
Pipeline-configurable stages. Default pipeline:

  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
  │Prospecting│──►│Qualification│──►│Proposal  │──►│Negotiation│──►│Closed Won│
  │ (10%)     │    │ (25%)     │    │ (40%)    │    │ (70%)    │    │ (100%)   │
  └──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
       │               │               │               │
       │               │               │               ▼
       │               │               │        ┌──────────┐
       │               │               │        │Closed Lost│
       │               │               │        │ (0%)     │
       │               │               │        └──────────┘
       │               │               │
       ▼               ▼               ▼
  ┌─────────────────────────────────────────┐
  │           Closed Lost (any stage)        │
  │         (Opportunity is dead)            │
  └─────────────────────────────────────────┘

Rules:
  - Stages must follow configured order (no skipping)
  - Probability auto-assigned per stage (configurable)
  - Closed Won: requires close_date, won_amount, won_reason
  - Closed Lost: requires lost_reason, lost_to_competitor (optional)
  - Re-open: Closed Lost can be reopened to any active stage
  - Stage transitions record timestamp in stage_history for duration analytics
```

### 4.3 Task Status

```
                  ┌──────────────┐
                  │   PENDING    │
                  └──────────────┘
                         │
                         ▼
                  ┌──────────────┐
          ┌──────►│  IN_PROGRESS │◄──────┐
          │       └──────┬───────┘       │
          │              │               │
          │              ├───────────────┤
          │              ▼               │
          │       ┌──────────────┐       │
          │       │  COMPLETED   │       │
          │       └──────────────┘       │
          │                              │
          │       ┌──────────────┐       │
          └───────│   CANCELLED  │───────┘
                  └──────────────┘

Valid Transitions:
  PENDING     → IN_PROGRESS, CANCELLED
  IN_PROGRESS → COMPLETED, CANCELLED, PENDING (unassign)
  COMPLETED   → (terminal)
  CANCELLED   → PENDING (re-open)

Invariants:
  - Overdue: due_date < now AND status ≠ COMPLETED
  - Completion requires completed_at timestamp
  - Cancellation requires reason
```

### 4.4 Membership Status

```
                  ┌──────────────┐
                  │   INVITED    │
                  └──────┬───────┘
                         │
               ┌─────────┼─────────┐
               │         │         │
               ▼         ▼         │
        ┌──────────┐ ┌──────────┐  │
        │  ACTIVE   │ │ REJECTED │  │
        └─────┬────┘ └──────────┘  │
              │                    │
              ▼                    │
        ┌──────────┐              │
        │ DISABLED │              │
        └──────────┘              │
                                  │
                    Invitation expires after 7 days → INVITED → (auto-cancel)

Valid Transitions:
  INVITED → ACTIVE, REJECTED, (expired)
  ACTIVE  → DISABLED (removed by admin)
  REJECTED→ (terminal)
  DISABLED→ ACTIVE (re-invite)
```

### 4.5 Organization Lifecycle

```
          ┌──────────────────┐
          │      TRIAL       │
          └────────┬─────────┘
                   │ trial ends / upgrade
                   ▼
          ┌──────────────────┐
  ┌───────│     ACTIVE       │◄──────────┐
  │       └────────┬─────────┘           │
  │                │                     │
  │  payment       │ admin /             │  admin
  │  failure       │ policy violation    │  action
  │                │                     │
  ▼                ▼                     │
 ┌──────────┐  ┌──────────────────┐      │
 │ SUSPENDED├──►  REACTIVATE      ├──────┘
 └──────────┘  └──────────────────┘
      │
      │ 30 days → DISABLED
      ▼
 ┌──────────┐
 │ DISABLED │
 └──────────┘
      │
      │ retention period (90 days) → hard delete
      ▼
 ┌──────────┐
 │  DELETED │
 └──────────┘

Valid Transitions:
  TRIAL     → ACTIVE (payment), SUSPENDED (admin)
  ACTIVE    → SUSPENDED (payment failure / violation), TRIAL (downgrade?)
  SUSPENDED → ACTIVE (payment resolved / admin), DISABLED (30 days)
  DISABLED  → DELETED (after retention period)
  DELETED   → (terminal — data purged)

Invariants:
  - TRIAL: max 14 days, limited features
  - SUSPENDED: all API access blocked; data preserved
  - DISABLED: data preserved for retention period (configurable)
  - DELETED: irreversible; data purged from all systems
```

### 4.6 Tenant Lifecycle

```
          ┌──────────────────┐
          │   PROVISIONING   │  (creating RLS policies, setting up infrastructure)
          └────────┬─────────┘
                   │ provision complete
                   ▼
          ┌──────────────────┐
  ┌───────│     ACTIVE       │◄──────────┐
  │       └────────┬─────────┘           │
  │                │                     │
  │  org           │  org                │  org
  │  suspended     │  disabled           │  reactivated
  │                │                     │
  ▼                ▼                     │
 ┌──────────┐  ┌──────────────────┐      │
 │ SUSPENDED│  │  DISABLED        │      │
 └──────────┘  └──────────────────┘      │
      │                                    │
      │ 30 days → DELETION_SCHEDULED      │
      ▼                                    │
 ┌──────────┐                              │
 │ DELETION │                              │
 │ SCHEDULED│                              │
 └──────────┘                              │
      │                                    │
      │ retention period expires           │
      ▼                                    │
 ┌──────────┐                              │
 │  DELETED │  (data purged; irreversible) │
 └──────────┘                              │

Valid Transitions:
  PROVISIONING      → ACTIVE (all RLS policies applied)
  ACTIVE            → SUSPENDED, DISABLED
  SUSPENDED         → ACTIVE (reactivate)
  DISABLED          → DELETION_SCHEDULED (after retention), ACTIVE (reactivate)
  DELETION_SCHEDULED→ DELETED (after retention period), ACTIVE (cancel deletion)
  DELETED           → (terminal)
```

---

## 5. Database Relationship Diagram

### 5.1 Core Entity Relationships

```
┌────────────────────────────────────────────────────────────────────────────┐
│                          CORE ENTITY RELATIONSHIPS                         │
│                                                                           │
│  ┌──────────────────────────┐                                             │
│  │     identity_users        │                                             │
│  ├──────────────────────────┤                                             │
│  │ id (PK)                  │◄────────────────────────────────────────┐  │
│  │ email (UK)               │                                         │  │
│  │ password_hash            │     created_by_id / updated_by_id       │  │
│  │ status                   │         (on every table)                 │  │
│  │ ...                      │                                         │  │
│  └──────────────────────────┘                                         │  │
│           │                                                             │  │
│           │ 1:N                                                         │  │
│           ▼                                                             │  │
│  ┌──────────────────────────┐  ┌──────────────────────────┐           │  │
│  │  identity_sessions       │  │  organization_memberships │           │  │
│  ├──────────────────────────┤  ├──────────────────────────┤           │  │
│  │ id (PK)                  │  │ id (PK)                  │           │  │
│  │ user_id (FK)            │  │ user_id (FK)            │           │  │
│  │ refresh_token_hash       │  │ organization_id (FK)    │           │  │
│  │ expires_at               │  │ status (INVITED/ACTIVE/  │           │  │
│  │ ...                      │  │         DISABLED)        │           │  │
│  └──────────────────────────┘  │ invited_by (FK)         │           │  │
│                                └──────────┬───────────────┘           │  │
│                                           │                           │  │
│  ┌──────────────────────────┐             │ N:1                       │  │
│  │  organization_organizations│◄──────────┘                           │  │
│  ├──────────────────────────┤                                         │  │
│  │ id (PK)                  │─────────────────────────────────────────┘  │
│  │ name                     │   organization_id (on every tenant table) │
│  │ slug (UK)                │                                           │
│  │ status (TRIAL/ACTIVE/    │                                           │
│  │         SUSPENDED/       │                                           │
│  │         DISABLED)        │                                           │
│  │ tier (FREE/GROWTH/       │                                           │
│  │       ENTERPRISE)        │                                           │
│  │ settings (JSONB)         │                                           │
│  └──────────────────────────┘                                           │
│           │                                                              │
│           │ 1:1                                                          │
│           ▼                                                              │
│  ┌──────────────────────────┐  ┌──────────────────────────┐            │
│  │  tenant_tenants          │  │  rbac_roles              │            │
│  ├──────────────────────────┤  ├──────────────────────────┤            │
│  │ id (PK)                  │  │ id (PK)                  │            │
│  │ organization_id (FK,UK) │  │ organization_id (FK)    │            │
│  │ status                   │  │ name                     │            │
│  │ isolation_model (POOL/   │  │ permissions (JSONB)      │            │
│  │           SILO)          │  │ is_system_role           │            │
│  │ rls_policies_applied     │  └──────────────────────────┘            │
│  └──────────────────────────┘           │                              │
│                                          │ 1:N                          │
│  ┌──────────────────────────┐           ▼                              │
│  │  rbac_role_assignments   │  ┌──────────────────────────┐            │
│  ├──────────────────────────┤  │  ...                     │            │
│  │ user_id (FK)            │  │                          │            │
│  │ organization_id (FK)    │  │                          │            │
│  │ role_id (FK)            │  │                          │            │
│  │ assigned_by (FK)        │  └──────────────────────────┘            │
│  └──────────────────────────┘                                         │
│                                                                        │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │                TENANT-SCOPED TABLES                              │    │
│  │  (ALL have: id PK, organization_id FK, created_at, updated_at, │    │
│  │   created_by_id FK, updated_by_id FK, deleted_at)              │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                        │
│  ┌──────────────────────────┐  ┌──────────────────────────┐          │
│  │  lead_management_leads   │  │  lead_management_contacts │          │
│  ├──────────────────────────┤  ├──────────────────────────┤          │
│  │ id (PK)                  │  │ id (PK)                  │          │
│  │ organization_id (FK)    │  │ organization_id (FK)    │          │
│  │ first_name               │  │ first_name               │          │
│  │ last_name                │  │ last_name                │          │
│  │ email                    │  │ email                    │          │
│  │ company                  │  │ phone                    │          │
│  │ title                    │  │ company                  │          │
│  │ source                   │  │ position                 │          │
│  │ status (NEW/CONTACTED/   │  │ preferences (JSONB)      │          │
│  │         QUALIFIED/       │  │ gdpr_consent             │          │
│  │         CONVERTED/       │  │ search_vector (tsvector) │          │
│  │         DISQUALIFIED/    │  │ embedding (vector(1536)) │          │
│  │         RECYCLED)        │  │ merged_into_id (self-FK) │          │
│  │ score                    │  └──────────────────────────┘          │
│  │ assigned_to (FK→users)  │                                         │
│  │ converted_to_contact (FK)│        1:1                             │
│  │ converted_to_account (FK)▼                                        │
│  │ search_vector (tsvector) │  ┌──────────────────────────┐          │
│  │ embedding (vector(1536)) │  │  lead_management_accounts│          │
│  └──────────────────────────┘  ├──────────────────────────┤          │
│                                │ id (PK)                  │          │
│  ┌──────────────────────────┐  │ organization_id (FK)    │          │
│  │  pipeline_stages         │  │ name                     │          │
│  ├──────────────────────────┤  │ industry                 │          │
│  │ id (PK)                  │  │ account_size             │          │
│  │ organization_id (FK)    │  │ territory                │          │
│  │ pipeline_id (FK)        │  │ parent_account_id (self) │          │
│  │ name                     │  │ search_vector (tsvector) │          │
│  │ order                    │  └──────────────────────────┘          │
│  │ probability              │                                         │
│  └──────────────────────────┘                                         │
│           │                                                           │
│           ▼                                                           │
│  ┌──────────────────────────┐  ┌──────────────────────────┐          │
│  │  pipeline_opportunities  │  │  activity_activities     │          │
│  ├──────────────────────────┤  ├──────────────────────────┤          │
│  │ id (PK)                  │  │ id (PK)                  │          │
│  │ organization_id (FK)    │  │ organization_id (FK)    │          │
│  │ name                     │  │ activity_type (CALL/     │          │
│  │ amount (Decimal)         │  │     EMAIL/MEETING/NOTE)  │          │
│  │ currency                 │  │ subject                  │          │
│  │ stage_id (FK)            │  │ description              │          │
│  │ probability              │  │ duration_minutes         │          │
│  │ close_date               │  │ outcome                  │          │
│  │ lead_id (FK)             │  │ lead_id (FK)            │          │
│  │ contact_id (FK)          │  │ contact_id (FK)          │          │
│  │ account_id (FK)          │  │ opportunity_id (FK)     │          │
│  │ owner_id (FK→users)     │  │ account_id (FK)          │          │
│  │ won_amount               │  │ call_recording_url      │          │
│  │ won_reason               │  │ ...                     │          │
│  │ lost_reason              │  └──────────────────────────┘          │
│  │ forecast_category (COMMIT│                                         │
│  │     /BEST_CASE/PIPELINE) │  ┌──────────────────────────┐          │
│  └──────────────────────────┘  │  activity_tasks          │          │
│                                ├──────────────────────────┤          │
│  ┌──────────────────────────┐  │ id (PK)                  │          │
│  │  workflow_workflows      │  │ organization_id (FK)    │          │
│  ├──────────────────────────┤  │ subject                  │          │
│  │ id (PK)                  │  │ description              │          │
│  │ organization_id (FK)    │  │ priority (LOW/MED/HIGH/  │          │
│  │ name                     │  │           CRITICAL)      │          │
│  │ trigger_event_type       │  │ status (PENDING/         │          │
│  │ conditions (JSONB)       │  │     IN_PROGRESS/COMPLETE/│          │
│  │ actions (JSONB)          │  │     CANCELLED)           │          │
│  │ is_enabled               │  │ due_date                 │          │
│  │ priority                 │  │ assignee_id (FK→users)  │          │
│  │ max_executions           │  │ lead_id (FK)            │          │
│  └──────────────────────────┘  │ opportunity_id (FK)     │          │
│                                └──────────────────────────┘          │
│  ┌──────────────────────────┐  ┌──────────────────────────┐          │
│  │  workflow_executions     │  │  notification_notifications│         │
│  ├──────────────────────────┤  ├──────────────────────────┤          │
│  │ id (PK)                  │  │ id (PK)                  │          │
│  │ workflow_id (FK)        │  │ organization_id (FK)    │          │
│  │ trigger_event_id         │  │ user_id (FK)            │          │
│  │ status (SUCCESS/FAILED/  │  │ channel (EMAIL/SMS/IN_APP/│          │
│  │         PARTIAL)         │  │          PUSH/SLACK)     │          │
│  │ conditions_evaluated     │  │ template_id              │          │
│  │ actions_executed (JSONB) │  │ status (QUEUED/SENT/    │          │
│  │ duration_ms              │  │         FAILED/READ)     │          │
│  └──────────────────────────┘  │ read_at                  │          │
│                                └──────────────────────────┘          │
│                                                                        │
│  ┌──────────────────────────┐  ┌──────────────────────────┐          │
│  │  audit_events (PARTITIONED)│ │  search_index_queue     │          │
│  ├──────────────────────────┤  ├──────────────────────────┤          │
│  │ id (PK)                  │  │ entity_type              │          │
│  │ organization_id (FK)    │  │ entity_id                 │          │
│  │ event_type               │  │ action (INDEX/REINDEX/   │          │
│  │ actor_id                  │  │         DELETE)          │          │
│  │ aggregate_type            │  │ status (PENDING/DONE/   │          │
│  │ aggregate_id              │  │         FAILED)          │          │
│  │ changes (JSONB)           │  └──────────────────────────┘          │
│  │ metadata (JSONB)          │                                         │
│  │ created_at (partition key)│                                         │
│  └──────────────────────────┘                                         │
└────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Key Indexes

```sql
-- Every tenant-scoped table:
CREATE INDEX idx_{table}_org ON {table}(organization_id);

-- Foreign key indexes (every FK needs an index):
CREATE INDEX idx_leads_assigned_to ON lead_management_leads(assigned_to);
CREATE INDEX idx_opportunities_stage ON pipeline_opportunities(stage_id);
CREATE INDEX idx_opportunities_owner ON pipeline_opportunities(owner_id);
CREATE INDEX idx_tasks_assignee ON activity_tasks(assignee_id);
CREATE INDEX idx_activities_lead ON activity_activities(lead_id);
CREATE INDEX idx_activities_opportunity ON activity_activities(opportunity_id);

-- Composite indexes for common query patterns:
CREATE INDEX idx_leads_org_status ON lead_management_leads(organization_id, status);
CREATE INDEX idx_leads_org_source ON lead_management_leads(organization_id, source);
CREATE INDEX idx_opportunities_org_stage ON pipeline_opportunities(organization_id, stage_id);
CREATE INDEX idx_opportunities_org_close ON pipeline_opportunities(organization_id, close_date);
CREATE INDEX idx_tasks_org_status ON activity_tasks(organization_id, status);
CREATE INDEX idx_activities_org_created ON activity_activities(organization_id, created_at DESC);

-- Unique constraints:
CREATE UNIQUE INDEX idx_users_email ON identity_users(LOWER(email));
CREATE UNIQUE INDEX idx_memberships_user_org ON organization_memberships(user_id, organization_id);
CREATE UNIQUE INDEX idx_roles_org_name ON rbac_roles(organization_id, name);

-- Full-text search indexes:
CREATE INDEX idx_leads_search ON lead_management_leads USING GIN(search_vector);
CREATE INDEX idx_contacts_search ON lead_management_contacts USING GIN(search_vector);
CREATE INDEX idx_accounts_search ON lead_management_accounts USING GIN(search_vector);

-- Vector indexes:
CREATE INDEX idx_leads_embedding ON lead_management_leads
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_contacts_embedding ON lead_management_contacts
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Partial indexes for soft-delete filtering:
CREATE INDEX idx_leads_active ON lead_management_leads(id)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_opportunities_active ON pipeline_opportunities(id)
    WHERE deleted_at IS NULL;

-- Audit log partitioning (monthly):
CREATE INDEX idx_audit_org_created ON audit_events(organization_id, created_at DESC);
```

---

> **Version:** 0.1.0-draft | **Last Updated:** 2026-07-27
> **Cross-reference:** [10_ArchitectureOverview.md](./10_ArchitectureOverview.md),
> [12_HighLevelDesign.md](./12_HighLevelDesign.md),
> [14_ModuleDependencyMap.md](./14_ModuleDependencyMap.md),
> [15_ProjectStructure.md](./15_ProjectStructure.md)
