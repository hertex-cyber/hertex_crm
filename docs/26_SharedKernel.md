# TZAHU CRM — Shared Kernel

> **Version:** 0.1.0-draft
> **Last Updated:** 2026-07-27
> **Status:** Foundational Design Phase
> **Owner:** Platform Architecture Team

---

## Table of Contents

1. [Overview](#1-overview)
2. [Folder Structure and Import Rules](#2-folder-structure-and-import-rules)
3. [Value Objects](#3-value-objects)
4. [Base Classes](#4-base-classes)
5. [Result Type](#5-result-type)
6. [PaginatedResult](#6-paginatedresult)
7. [DomainError Hierarchy](#7-domainerror-hierarchy)
8. [Ports](#8-ports)
9. [Marker Interfaces](#9-marker-interfaces)
10. [ID Generation](#10-id-generation)

---

## 1. Overview

The Shared Kernel is the foundational layer of the TZAHU CRM platform. It contains no business logic, no Django imports, and no I/O. Every other module depends on it through strict `import-linter` rules. The Shared Kernel provides:

- **Value Objects**: Immutable data containers with validation and equality semantics
- **Base Classes**: `AggregateRoot`, `Entity`, `ValueObject`, `DomainEvent` — contracts for DDD building blocks
- **Result Type**: Railway-oriented programming pattern for predictable error handling
- **DomainError Hierarchy**: Typed error classes for domain violations
- **Ports**: Abstract interfaces for infrastructure dependencies (Repository, EventPublisher, Clock)
- **Marker Interfaces**: `TenantScoped`, `Auditable` — cross-cutting concern tags
- **ID Generation**: UUID v7 implementation for conflict-free multi-region primary keys

---

## 2. Folder Structure and Import Rules

### 2.1 Directory Layout

```
shared_kernel/
├── __init__.py                    # Re-exports all public API
├── domain/
│   ├── __init__.py
│   ├── base.py                    # AggregateRoot, Entity, ValueObject, DomainEvent
│   └── errors.py                  # DomainError hierarchy
├── value_objects/
│   ├── __init__.py
│   ├── email.py                   # Email
│   ├── phone_number.py           # PhoneNumber
│   ├── address.py                # Address
│   ├── person_name.py            # PersonName
│   ├── money.py                  # Money, Currency
│   ├── percentage.py             # Percentage
│   └── timezone.py               # TimeZone
├── patterns/
│   ├── __init__.py
│   ├── result.py                 # Result[T, E]
│   └── paginated_result.py       # PaginatedResult[T]
├── ports/
│   ├── __init__.py
│   ├── repository.py             # Repository[T] generic interface
│   ├── event_publisher.py        # EventPublisher abstract
│   └── clock.py                  # Clock abstraction
├── markers/
│   ├── __init__.py
│   ├── tenant_scoped.py          # TenantScoped marker
│   └── auditable.py              # Auditable marker
├── identifiers/
│   ├── __init__.py
│   └── uuid7.py                  # UUID v7 generation
└── tests/
    ├── __init__.py
    ├── test_value_objects.py
    ├── test_result.py
    ├── test_base.py
    ├── test_uuid7.py
    └── test_errors.py
```

### 2.2 Import Rules

```
# Allowed imports (development):
shared_kernel → nothing (must be pure Python, no dependencies)

# Allowed imports (all other modules):
any_module     → shared_kernel ONLY
shared_kernel  → NEVER imports from any module

# Concrete rules:
- shared_kernel MUST NOT import Django, DRF, or any third-party library
- shared_kernel MUST NOT perform I/O (database, network, filesystem)
- shared_kernel MUST NOT import from any CRM application module
- All modules MAY import shared_kernel value_objects, base classes, result, ports, markers, identifiers
- All modules MUST NOT import shared_kernel internals (use __init__.py re-exports)
```

### 2.3 Public API (exposed through `__init__.py`)

```python
# shared_kernel/__init__.py
from shared_kernel.domain.base import AggregateRoot, Entity, ValueObject, DomainEvent
from shared_kernel.domain.errors import (
    DomainError, NotFoundError, ValidationError, ConflictError,
    PermissionDeniedError, InvalidOperationError,
)
from shared_kernel.patterns.result import Result
from shared_kernel.patterns.paginated_result import PaginatedResult
from shared_kernel.ports.repository import Repository
from shared_kernel.ports.event_publisher import EventPublisher
from shared_kernel.ports.clock import Clock
from shared_kernel.markers.tenant_scoped import TenantScoped
from shared_kernel.markers.auditable import Auditable
from shared_kernel.identifiers.uuid7 import uuid7, is_valid_uuid7

__all__ = [
    "AggregateRoot", "Entity", "ValueObject", "DomainEvent",
    "DomainError", "NotFoundError", "ValidationError",
    "ConflictError", "PermissionDeniedError", "InvalidOperationError",
    "Result", "PaginatedResult",
    "Repository", "EventPublisher", "Clock",
    "TenantScoped", "Auditable",
    "uuid7", "is_valid_uuid7",
]
```

---

## 3. Value Objects

All value objects follow these invariants:
- **Immutable**: All fields are `frozen=True` dataclass or `@property` with no setters
- **Self-validating**: Validation occurs in `__post_init__`; invalid states are impossible to construct
- **Value equality**: `__eq__` compares all fields structurally (frozen dataclass provides this)
- **Hashable**: `__hash__` is derived from fields (frozen dataclass provides this)
- **String representation**: `__str__` for display, `__repr__` for debugging

### 3.1 Email

```python
@dataclass(frozen=True)
class Email(ValueObject):
    """Validated email address value object."""

    value: str

    LOCAL_PART_MAX_LENGTH = 64
    DOMAIN_MAX_LENGTH = 255
    TOTAL_MAX_LENGTH = 320

    def __post_init__(self) -> None:
        if not self.value or not isinstance(self.value, str):
            raise ValidationError("Email must be a non-empty string")
        if len(self.value) > self.TOTAL_MAX_LENGTH:
            raise ValidationError(f"Email must not exceed {self.TOTAL_MAX_LENGTH} characters")
        # RFC 5322 simplified pattern
        pattern = r'^[a-zA-Z0-9.!#$%&\'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$'
        if not re.match(pattern, self.value):
            raise ValidationError(f"Invalid email format: {self.value}")

    def __str__(self) -> str:
        return self.value

    @property
    def local_part(self) -> str:
        return self.value.split("@")[0]

    @property
    def domain(self) -> str:
        return self.value.split("@")[1]

    def anonymized(self) -> str:
        """Return GDPR-compliant anonymized version."""
        local, domain = self.value.split("@")
        return f"{local[0]}***@{domain}"
```

**Field Definitions:**

| Field | Type | Max Length | Validation |
|-------|------|-----------|------------|
| `value` | `str` | 320 | RFC 5322 pattern, non-empty |

**Equality Semantics:** Two `Email` instances are equal iff their `value` fields are equal (case-sensitive — the domain part is case-insensitive per RFC, but we store as-provided for display and normalize to lowercase on input).

### 3.2 PhoneNumber

```python
@dataclass(frozen=True)
class PhoneNumber(ValueObject):
    """Validated phone number in E.164 format."""

    value: str

    def __post_init__(self) -> None:
        if not self.value or not isinstance(self.value, str):
            raise ValidationError("Phone number must be a non-empty string")
        # E.164: +[country][number], max 15 digits
        if not re.match(r'^\+[1-9]\d{6,14}$', self.value):
            raise ValidationError(
                f"Phone number must be in E.164 format (+CCNNNNNNNNN): {self.value}"
            )

    def __str__(self) -> str:
        return self.value

    @property
    def country_code(self) -> str:
        return self.value[:self.value.index(" ")] if " " in self.value else ""

    def anonymized(self) -> str:
        return f"+***{self.value[-4:]}"
```

**Field Definitions:**

| Field | Type | Format | Validation |
|-------|------|--------|------------|
| `value` | `str` | E.164 | `+[1-9]\d{6,14}`, max 15 digits |

### 3.3 Address

```python
@dataclass(frozen=True)
class Address(ValueObject):
    """Physical address value object."""

    street: str
    city: str
    state: str | None
    postal_code: str
    country: str  # ISO 3166-1 alpha-2
    line2: str | None = None

    def __post_init__(self) -> None:
        for field_name, field_value, max_len in [
            ("street", self.street, 255),
            ("city", self.city, 100),
            ("postal_code", self.postal_code, 20),
            ("country", self.country, 2),
        ]:
            if not field_value or not isinstance(field_value, str) or len(field_value.strip()) == 0:
                raise ValidationError(f"{field_name} must be a non-empty string")
            if len(field_value) > max_len:
                raise ValidationError(f"{field_name} must not exceed {max_len} characters")
        if self.state and len(self.state) > 100:
            raise ValidationError("state must not exceed 100 characters")
        if not re.match(r'^[A-Z]{2}$', self.country):
            raise ValidationError("country must be ISO 3166-1 alpha-2 (e.g., US, GB, IN)")
        if self.line2 and len(self.line2) > 255:
            raise ValidationError("line2 must not exceed 255 characters")

    def __str__(self) -> str:
        parts = [self.street]
        if self.line2:
            parts.append(self.line2)
        parts.append(f"{self.city}, {self.state or ''} {self.postal_code}".strip(", "))
        parts.append(self.country)
        return ", ".join(part for part in parts if part)
```

**Field Definitions:**

| Field | Type | Max Length | Required | Notes |
|-------|------|-----------|----------|-------|
| `street` | `str` | 255 | Yes | Street number and name |
| `line2` | `str\|None` | 255 | No | Apt, suite, unit |
| `city` | `str` | 100 | Yes | City or locality |
| `state` | `str\|None` | 100 | No | State, province, region |
| `postal_code` | `str` | 20 | Yes | ZIP, postal code |
| `country` | `str` | 2 | Yes | ISO 3166-1 alpha-2 uppercase |

### 3.4 PersonName

```python
@dataclass(frozen=True)
class PersonName(ValueObject):
    """Person's full name with structural parts."""

    first_name: str
    last_name: str
    middle_name: str | None = None
    prefix: str | None = None   # Mr., Mrs., Dr., etc.
    suffix: str | None = None   # Jr., Sr., III, etc.

    ALLOWED_PREFIXES = {"Mr.", "Mrs.", "Ms.", "Dr.", "Prof.", "Hon."}
    ALLOWED_SUFFIXES = {"Jr.", "Sr.", "II", "III", "IV", "Ph.D.", "M.D.", "Esq."}

    def __post_init__(self) -> None:
        for field_name, field_value, max_len in [
            ("first_name", self.first_name, 100),
            ("last_name", self.last_name, 100),
        ]:
            if not field_value or not isinstance(field_value, str) or len(field_value.strip()) == 0:
                raise ValidationError(f"{field_name} must be a non-empty string")
            if len(field_value) > max_len:
                raise ValidationError(f"{field_name} must not exceed {max_len} characters")
        if self.middle_name and len(self.middle_name) > 100:
            raise ValidationError("middle_name must not exceed 100 characters")
        if self.prefix and self.prefix not in self.ALLOWED_PREFIXES:
            raise ValidationError(f"prefix must be one of {self.ALLOWED_PREFIXES}")
        if self.suffix and self.suffix not in self.ALLOWED_SUFFIXES:
            raise ValidationError(f"suffix must be one of {self.ALLOWED_SUFFIXES}")

    def __str__(self) -> str:
        parts = []
        if self.prefix:
            parts.append(self.prefix)
        parts.append(self.first_name)
        if self.middle_name:
            parts.append(self.middle_name)
        parts.append(self.last_name)
        if self.suffix:
            parts.append(self.suffix)
        return " ".join(parts)

    @property
    def full_name(self) -> str:
        return str(self)

    @property
    def initials(self) -> str:
        parts = [self.first_name[0].upper()]
        if self.middle_name:
            parts.append(self.middle_name[0].upper())
        parts.append(self.last_name[0].upper())
        return "".join(parts)

    @property
    def display_name(self) -> str:
        return f"{self.first_name} {self.last_name}"
```

### 3.5 Money and Currency

```python
@dataclass(frozen=True)
class Currency(ValueObject):
    """ISO 4217 currency code."""

    code: str

    SUPPORTED_CURRENCIES = {"USD", "EUR", "GBP", "INR", "CAD", "AUD", "JPY", "SGD", "CHF", "NZD"}

    def __post_init__(self) -> None:
        if not re.match(r'^[A-Z]{3}$', self.code):
            raise ValidationError("currency code must be ISO 4217 (3 uppercase letters)")
        if self.code not in self.SUPPORTED_CURRENCIES:
            raise ValidationError(f"unsupported currency: {self.code}")

    def __str__(self) -> str:
        return self.code


@dataclass(frozen=True)
class Money(ValueObject):
    """Monetary value with currency."""

    amount: Decimal
    currency: Currency

    DECIMAL_PLACES = 4

    def __post_init__(self) -> None:
        if not isinstance(self.amount, Decimal):
            raise ValidationError("amount must be a Decimal type")
        if self.amount < 0:
            raise ValidationError("amount must be non-negative")
        if self.amount.as_tuple().exponent < -self.DECIMAL_PLACES:
            raise ValidationError(f"amount must not exceed {self.DECIMAL_PLACES} decimal places")

    def __str__(self) -> str:
        return f"{self.currency} {self.amount:.2f}"

    def __add__(self, other: Money) -> Money:
        if self.currency != other.currency:
            raise ValidationError("cannot add Money with different currencies")
        return Money(amount=self.amount + other.amount, currency=self.currency)

    def __sub__(self, other: Money) -> Money:
        if self.currency != other.currency:
            raise ValidationError("cannot subtract Money with different currencies")
        return Money(amount=self.amount - other.amount, currency=self.currency)

    def __mul__(self, factor: Decimal | int | float) -> Money:
        return Money(amount=self.amount * Decimal(str(factor)), currency=self.currency)

    def __truediv__(self, divisor: Decimal | int | float) -> Money:
        return Money(amount=self.amount / Decimal(str(divisor)), currency=self.currency)

    def is_zero(self) -> bool:
        return self.amount == Decimal("0")
```

**Money Field Definitions:**

| Field | Type | Precision | Validation |
|-------|------|-----------|------------|
| `amount` | `Decimal` | up to 4 decimal places | Non-negative |
| `currency` | `Currency` | — | Must be supported ISO 4217 |

### 3.6 Percentage

```python
@dataclass(frozen=True)
class Percentage(ValueObject):
    """Represents a percentage value between 0 and 100."""

    value: Decimal

    def __post_init__(self) -> None:
        if not isinstance(self.value, Decimal):
            raise ValidationError("value must be a Decimal type")
        if self.value < 0 or self.value > 100:
            raise ValidationError(f"percentage must be between 0 and 100, got {self.value}")

    def __str__(self) -> str:
        return f"{self.value:.2f}%"

    @property
    def as_decimal(self) -> Decimal:
        """Return as a decimal fraction (e.g., 25% → 0.25)."""
        return self.value / Decimal("100")

    @classmethod
    def from_fraction(cls, fraction: Decimal) -> Percentage:
        """Create from fraction (e.g., 0.25 → 25%)."""
        return cls(value=fraction * Decimal("100"))
```

### 3.7 TimeZone

```python
@dataclass(frozen=True)
class TimeZone(ValueObject):
    """IANA timezone value object."""

    name: str

    def __post_init__(self) -> None:
        if not self.name or not isinstance(self.name, str):
            raise ValidationError("timezone name must be a non-empty string")
        from pytz import all_timezones  # noqa: E501
        if self.name not in all_timezones:
            raise ValidationError(
                f"invalid timezone name: {self.name}. Must be IANA tz database name."
            )

    def __str__(self) -> str:
        return self.name

    def now(self) -> datetime:
        from django.utils import timezone
        return timezone.now().astimezone(pytz.timezone(self.name))

    def utc_offset(self, at_datetime: datetime | None = None) -> timedelta:
        tz = pytz.timezone(self.name)
        dt = at_datetime or datetime.now(pytz.UTC)
        return tz.utcoffset(dt)

    def is_dst(self, at_datetime: datetime | None = None) -> bool:
        tz = pytz.timezone(self.name)
        dt = at_datetime or datetime.now(pytz.UTC)
        return bool(tz.dst(dt))
```

---

## 4. Base Classes

### 4.1 ValueObject

```python
@dataclass(frozen=True)
class ValueObject:
    """Base class for all value objects.

    Value objects are:
    - Immutable: state cannot change after creation
    - Value equality: two VOs are equal if all their attributes are equal
    - Replaceable: can be freely swapped for another instance with same values
    - Self-validating: validation in __post_init__

    Usage::
        @dataclass(frozen=True)
        class Email(ValueObject):
            value: str
    """

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, self.__class__):
            return NotImplemented
        return self.__dict__ == other.__dict__

    def __hash__(self) -> int:
        return hash(tuple(sorted(self.__dict__.items())))

    def __repr__(self) -> str:
        attrs = ", ".join(f"{k}={v!r}" for k, v in self.__dict__.items())
        return f"{self.__class__.__name__}({attrs})"
```

### 4.2 Entity

```python
class Entity(ABC):
    """Base class for entities.

    Entities have identity (id) that distinguishes them regardless of
    attribute values. Two entities with the same id are considered equal
    even if other attributes differ.

    Usage::
        class Lead(Entity):
            def __init__(self, id: UUID, name: PersonName):
                super().__init__(id)
                self._name = name
    """

    def __init__(self, id: UUID) -> None:
        self._id = id

    @property
    def id(self) -> UUID:
        return self._id

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, self.__class__):
            return NotImplemented
        return self.id == other.id

    def __hash__(self) -> int:
        return hash(self.id)

    def __repr__(self) -> str:
        return f"{self.__class__.__name__}(id={self.id})"
```

### 4.3 AggregateRoot

```python
class AggregateRoot(Entity):
    """Base class for aggregate roots.

    Aggregate roots are entities that:
    - Act as the entry point for a consistency boundary
    - Manage a list of domain events that occurred during a command
    - Enforce invariants across all entities within the aggregate
    - Domain events are collected and published by the infrastructure layer

    Usage::
        class Lead(AggregateRoot):
            def __init__(self, id: UUID, name: PersonName, email: Email):
                super().__init__(id)
                self._name = name
                self._email = email
                self._version = 0

            def update_email(self, new_email: Email) -> None:
                self._email = new_email
                self._version += 1
                self._record_event(LeadEmailUpdated(
                    aggregate_id=self.id,
                    new_email=new_email,
                ))
    """

    def __init__(self, id: UUID) -> None:
        super().__init__(id)
        self._domain_events: list[DomainEvent] = []
        self._version: int = 0

    @property
    def version(self) -> int:
        return self._version

    def _record_event(self, event: DomainEvent) -> None:
        """Record a domain event. Events are cleared after publishing."""
        self._domain_events.append(event)

    def pull_events(self) -> list[DomainEvent]:
        """Return and clear all recorded domain events."""
        events = self._domain_events[:]
        self._domain_events.clear()
        return events

    def has_events(self) -> bool:
        return len(self._domain_events) > 0
```

### 4.4 DomainEvent

```python
@dataclass(frozen=True)
class DomainEvent(ABC):
    """Base class for all domain events.

    Domain events represent something meaningful that happened in the domain.
    They are immutable records of past occurrences.

    Attributes:
        event_id: Unique identifier for this event occurrence
        aggregate_id: ID of the aggregate that raised the event
        occurred_at: Timestamp when the event occurred
        version: Event version for schema evolution
    """

    aggregate_id: UUID
    event_id: UUID = field(default_factory=uuid7)
    occurred_at: datetime = field(default_factory=lambda: datetime.now(pytz.UTC))
    version: int = 1

    @property
    def event_type(self) -> str:
        """Fully qualified event type name (e.g., lead_management.lead.created)."""
        return f"{self.__module__}.{self.__class__.__name__}"

    def __repr__(self) -> str:
        return f"{self.__class__.__name__}(id={self.event_id}, agg={self.aggregate_id})"
```

### 4.5 Event Envelope (Infrastructure)

The event envelope wraps domain events for transport over RabbitMQ. This is defined in the infrastructure layer, not in Shared Kernel, but the structure is specified here:

```python
@dataclass(frozen=True)
class EventEnvelope:
    """Envelope wrapping a domain event for transport."""
    event_type: str         # e.g., "lead_management.lead.created"
    event_id: UUID          # Unique event ID (idempotency key)
    occurred_at: datetime   # When the event occurred
    organization_id: UUID   # Tenant context (always required)
    actor_id: UUID | None   # User who triggered the event
    aggregate_type: str     # e.g., "lead"
    aggregate_id: UUID      # Aggregate instance
    version: int            # Event schema version
    data: dict              # Serialized event data (JSON-serializable)
    metadata: dict          # correlation_id, causation_id, trace_id
```

---

## 5. Result Type

The `Result[T, E]` type implements the Railway Oriented Programming pattern. Service methods return `Result[T, E]` instead of raising exceptions for expected (domain) errors. This makes error handling explicit in the type signature.

```python
T = TypeVar("T", covariant=True)
E = TypeVar("E", covariant=True)


class Result(ABC, Generic[T, E]):
    """Result type representing success or failure of an operation.

    Usage::
        def create_lead(name: PersonName) -> Result[Lead, DomainError]:
            if not is_valid(name):
                return Result.fail(ValidationError("Invalid name"))
            lead = Lead(id=uuid7(), name=name)
            return Result.ok(lead)

        result = create_lead(name)
        if result.is_ok():
            lead = result.unwrap()
        else:
            error = result.unwrap_error()
    """

    @staticmethod
    def ok(value: T) -> "Success[T, E]":
        return Success(value)

    @staticmethod
    def fail(error: E) -> "Failure[T, E]":
        return Failure(error)

    @abstractmethod
    def is_ok(self) -> bool: ...

    @abstractmethod
    def is_fail(self) -> bool: ...

    @abstractmethod
    def unwrap(self) -> T: ...

    @abstractmethod
    def unwrap_or(self, default: T) -> T: ...

    @abstractmethod
    def unwrap_error(self) -> E: ...

    @abstractmethod
    def map(self, func: Callable[[T], U]) -> "Result[U, E]": ...

    @abstractmethod
    def map_error(self, func: Callable[[E], F]) -> "Result[T, F]": ...

    @abstractmethod
    def and_then(self, func: Callable[[T], "Result[U, E]"]) -> "Result[U, E]": ...

    @abstractmethod
    def or_else(self, func: Callable[[E], "Result[T, F]"]) -> "Result[T, F]": ...


@dataclass
class Success(Result[T, E]):
    """Represents a successful result containing a value."""

    _value: T

    def is_ok(self) -> bool:
        return True

    def is_fail(self) -> bool:
        return False

    def unwrap(self) -> T:
        return self._value

    def unwrap_or(self, default: T) -> T:
        return self._value

    def unwrap_error(self) -> E:
        raise ValueError("Cannot unwrap error from a Success result")

    def map(self, func: Callable[[T], U]) -> "Result[U, E]":
        try:
            return Success(func(self._value))
        except Exception as e:
            return Failure(e)  # type: ignore

    def map_error(self, func: Callable[[E], F]) -> "Result[T, F]":
        return Success(self._value)  # type: ignore

    def and_then(self, func: Callable[[T], "Result[U, E]"]) -> "Result[U, E]":
        try:
            return func(self._value)
        except Exception as e:
            return Failure(e)  # type: ignore

    def or_else(self, func: Callable[[E], "Result[T, F]"]) -> "Result[T, F]":
        return Success(self._value)  # type: ignore


@dataclass
class Failure(Result[T, E]):
    """Represents a failed result containing an error."""

    _error: E

    def is_ok(self) -> bool:
        return False

    def is_fail(self) -> bool:
        return True

    def unwrap(self) -> T:
        raise ValueError(
            f"Cannot unwrap value from a Failure result: {self._error}"
        )

    def unwrap_or(self, default: T) -> T:
        return default

    def unwrap_error(self) -> E:
        return self._error

    def map(self, func: Callable[[T], U]) -> "Result[U, E]":
        return Failure(self._error)  # type: ignore

    def map_error(self, func: Callable[[E], F]) -> "Result[T, F]":
        return Failure(func(self._error))

    def and_then(self, func: Callable[[T], "Result[U, E]"]) -> "Result[U, E]":
        return Failure(self._error)  # type: ignore

    def or_else(self, func: Callable[[E], "Result[T, F]"]) -> "Result[T, F]":
        try:
            return func(self._error)
        except Exception as e:
            return Failure(e)  # type: ignore
```

### 5.1 Result Usage Patterns

**Pattern 1: Basic check and unwrap**
```python
result = lead_service.create_lead(dto)
if result.is_fail():
    return Response({"error": str(result.unwrap_error())}, status=400)
lead = result.unwrap()
```

**Pattern 2: Railway (chaining)**
```python
result = (Lead.create(name, email)
    .and_then(lambda lead: lead.assign_owner(owner_id))
    .and_then(lambda lead: lead.set_pipeline(pipeline_id))
    .map(lambda lead: lead_response(lead)))
```

**Pattern 3: Error accumulation (validating multiple fields)**
```python
errors: list[ValidationError] = []
if not name:
    errors.append(ValidationError("name is required"))
if not email:
    errors.append(ValidationError("email is required"))
if errors:
    return Result.fail(ValidationError(errors))
```

---

## 6. PaginatedResult

```python
@dataclass
class PaginatedResult[T]:
    """Paginated query result.

    Attributes:
        items: List of items for the current page
        total_count: Total number of items across all pages
        page: Current page number (1-indexed)
        page_size: Number of items per page
        has_next: Whether a next page exists
        has_previous: Whether a previous page exists
    """

    items: list[T]
    total_count: int
    page: int
    page_size: int

    def __post_init__(self) -> None:
        if self.page < 1:
            raise ValidationError("page must be >= 1")
        if self.page_size < 1:
            raise ValidationError("page_size must be >= 1")
        if self.total_count < 0:
            raise ValidationError("total_count must be >= 0")

    @property
    def has_next(self) -> bool:
        return self.page * self.page_size < self.total_count

    @property
    def has_previous(self) -> bool:
        return self.page > 1

    @property
    def total_pages(self) -> int:
        return max(1, -(-self.total_count // self.page_size))

    @property
    def start_index(self) -> int:
        return (self.page - 1) * self.page_size

    @property
    def end_index(self) -> int:
        return min(self.start_index + self.page_size, self.total_count)

    @classmethod
    def empty(cls, page: int = 1, page_size: int = 20) -> PaginatedResult:
        return cls(items=[], total_count=0, page=page, page_size=page_size)

    def map(self, func: Callable[[T], U]) -> "PaginatedResult[U]":
        return PaginatedResult(
            items=[func(item) for item in self.items],
            total_count=self.total_count,
            page=self.page,
            page_size=self.page_size,
        )
```

---

## 7. DomainError Hierarchy

```python
class DomainError(Exception):
    """Base class for all domain exceptions.

    Domain errors represent expected business rule violations.
    They are NOT for infrastructure failures (DB connection, network, etc.)

    Attributes:
        message: Human-readable error description
        code: Machine-readable error code (e.g., "lead_not_found")
        details: Additional error context (field-level errors, etc.)
    """

    def __init__(
        self,
        message: str,
        code: str | None = None,
        details: dict | None = None,
    ) -> None:
        self.message = message
        self.code = code or self._default_code()
        self.details = details or {}
        super().__init__(self.message)

    def _default_code(self) -> str:
        """Derive snake_case code from class name."""
        name = self.__class__.__name__
        # Convert CamelCase to snake_case
        result = ""
        for char in name:
            if char.isupper() and result:
                result += "_"
            result += char.lower()
        return result

    def __str__(self) -> str:
        return f"[{self.code}] {self.message}"

    def __repr__(self) -> str:
        return f"{self.__class__.__name__}(code={self.code!r}, message={self.message!r})"


class NotFoundError(DomainError):
    """Raised when an entity is not found.

    Examples: lead not found, user not found, organization not found.
    Maps to HTTP 404.
    """

    def __init__(self, entity_type: str, entity_id: str, message: str | None = None) -> None:
        self.entity_type = entity_type
        self.entity_id = entity_id
        message = message or f"{entity_type} with id {entity_id} not found"
        super().__init__(message=message, code=f"{entity_type}_not_found")


class ValidationError(DomainError):
    """Raised when domain validation fails.

    Examples: invalid email format, negative money amount, empty name.
    Maps to HTTP 422.
    """

    def __init__(self, message: str, field: str | None = None, details: dict | None = None) -> None:
        self.field = field
        super().__init__(message=message, code="validation_error", details=details)


class ConflictError(DomainError):
    """Raised when an operation conflicts with current state.

    Examples: duplicate email, optimistic locking failure, already converted.
    Maps to HTTP 409.
    """

    def __init__(self, message: str, code: str | None = None, details: dict | None = None) -> None:
        super().__init__(message=message, code=code or "conflict", details=details)


class PermissionDeniedError(DomainError):
    """Raised when the actor lacks permission.

    Examples: user not in org, role lacks permission, tenant disabled.
    Maps to HTTP 403.
    """

    def __init__(self, message: str = "Permission denied", details: dict | None = None) -> None:
        super().__init__(message=message, code="permission_denied", details=details)


class InvalidOperationError(DomainError):
    """Raised when an operation is invalid in the current state.

    Examples: converting an already-converted lead, closing a won opportunity.
    Maps to HTTP 400.
    """

    def __init__(self, message: str, details: dict | None = None) -> None:
        super().__init__(message=message, code="invalid_operation", details=details)


class RateLimitError(DomainError):
    """Raised when rate limit is exceeded. Maps to HTTP 429."""

    def __init__(self, message: str = "Rate limit exceeded", retry_after: int = 60) -> None:
        self.retry_after = retry_after
        super().__init__(message=message, code="rate_limit_exceeded")
```

### 7.1 Error Code Convention

All error codes follow `snake_case` and are globally unique. The convention is:

```
{entity}_{problem}
```

Examples: `lead_not_found`, `email_invalid`, `duplicate_contact`, `stage_invalid_transition`, `org_quota_exceeded`.

### 7.2 HTTP Mapping

| Exception | HTTP Status | DRF Exception |
|-----------|-------------|---------------|
| `NotFoundError` | 404 | `NotFound` |
| `ValidationError` | 422 | `ValidationError` (DRF) |
| `ConflictError` | 409 | `Conflict` |
| `PermissionDeniedError` | 403 | `PermissionDenied` |
| `InvalidOperationError` | 400 | `APIException` |
| `RateLimitError` | 429 | `Throttled` |
| Unexpected errors | 500 | `APIException` |

---

## 8. Ports

### 8.1 Repository[T]

```python
T = TypeVar("T", bound=AggregateRoot)
ID = TypeVar("ID")


class Repository(ABC, Generic[T, ID]):
    """Generic repository interface for aggregate persistence.

    Repositories provide a collection-like interface for aggregates.
    Each aggregate type has its own repository implementation.

    Usage::
        class LeadRepository(Repository[Lead, UUID]):
            def add(self, lead: Lead) -> None: ...
            def get_by_id(self, id: UUID) -> Result[Lead, NotFoundError]: ...

        # In application service:
        repo = LeadRepository()
        result = repo.get_by_id(lead_id)
    """

    @abstractmethod
    def add(self, aggregate: T) -> None:
        """Persist a new aggregate."""
        ...

    @abstractmethod
    def update(self, aggregate: T) -> None:
        """Persist changes to an existing aggregate."""
        ...

    @abstractmethod
    def get_by_id(self, id: ID) -> "Result[T, NotFoundError]":
        """Retrieve an aggregate by its ID."""
        ...

    @abstractmethod
    def delete(self, id: ID) -> None:
        """Delete an aggregate by its ID (soft delete)."""
        ...

    @abstractmethod
    def exists(self, id: ID) -> bool:
        """Check whether an aggregate with the given ID exists."""
        ...
```

### 8.2 EventPublisher

```python
class EventPublisher(ABC):
    """Abstract port for publishing domain events.

    Implementations:
    - RabbitMQEventPublisher: async delivery via RabbitMQ topic exchange
    - InProcessEventPublisher: sync delivery within the same transaction
    - OutboxEventPublisher: transactional outbox pattern for guaranteed delivery
    """

    @abstractmethod
    def publish(self, events: list[DomainEvent], metadata: dict | None = None) -> None:
        """Publish domain events.

        Args:
            events: List of domain events to publish
            metadata: Cross-cutting metadata (correlation_id, causation_id, trace_id)
        """
        ...

    @abstractmethod
    def publish_one(self, event: DomainEvent, metadata: dict | None = None) -> None:
        """Publish a single domain event."""
        ...
```

### 8.3 Clock

```python
class Clock(ABC):
    """Abstract port for time operations.

    Enables testability by allowing time to be controlled in tests.
    """

    @abstractmethod
    def now(self) -> datetime:
        """Return the current UTC datetime."""
        ...

    @abstractmethod
    def today(self) -> date:
        """Return the current UTC date."""
        ...

    @abstractmethod
    def sleep(self, seconds: float) -> None:
        """Sleep for the given duration (only used in retry logic)."""
        ...


class SystemClock(Clock):
    """Production clock — delegates to Django's timezone.now()."""

    def now(self) -> datetime:
        from django.utils import timezone
        return timezone.now()

    def today(self) -> date:
        return self.now().date()

    def sleep(self, seconds: float) -> None:
        import time
        time.sleep(seconds)


class FakeClock(Clock):
    """Test clock — allows manual time control."""

    def __init__(self, fixed_time: datetime | None = None) -> None:
        self._current = fixed_time or datetime(2026, 1, 1, 0, 0, 0, tzinfo=pytz.UTC)

    def now(self) -> datetime:
        return self._current

    def today(self) -> date:
        return self._current.date()

    def advance(self, delta: timedelta) -> None:
        self._current += delta

    def sleep(self, seconds: float) -> None:
        self.advance(timedelta(seconds=seconds))
```

---

## 9. Marker Interfaces

### 9.1 TenantScoped

```python
class TenantScoped(ABC):
    """Marker interface for aggregates that are scoped to a tenant (organization).

    Any aggregate that implements this interface must:
    1. Have an organization_id attribute
    2. Be persisted with RLS policies in PostgreSQL
    3. Have all queries scoped to the organization

    Usage::
        class Lead(AggregateRoot, TenantScoped):
            def __init__(self, id: UUID, organization_id: UUID, ...):
                super().__init__(id)
                self._organization_id = organization_id

            @property
            def organization_id(self) -> UUID:
                return self._organization_id
    """

    @property
    @abstractmethod
    def organization_id(self) -> UUID:
        """The organization (tenant) this aggregate belongs to."""
        ...
```

### 9.2 Auditable

```python
class Auditable(ABC):
    """Marker interface for aggregates that track creation and modification.

    Any aggregate that implements this interface tracks:
    - When and by whom it was created
    - When and by whom it was last modified
    - When it was soft-deleted (if applicable)
    """

    @property
    @abstractmethod
    def created_at(self) -> datetime: ...

    @property
    @abstractmethod
    def updated_at(self) -> datetime: ...

    @property
    @abstractmethod
    def created_by_id(self) -> UUID | None: ...

    @property
    @abstractmethod
    def updated_by_id(self) -> UUID | None: ...

    @property
    def deleted_at(self) -> datetime | None:
        """If set, the aggregate is soft-deleted."""
        return None

    @property
    def is_deleted(self) -> bool:
        return self.deleted_at is not None
```

---

## 10. ID Generation

### 10.1 UUID v7 Implementation

UUID v7 generates time-ordered UUIDs that are sortable by creation time. This avoids B-tree index fragmentation that occurs with random UUID v4 values, while maintaining the collision-resistance benefits of UUIDs.

```python
import os
import uuid
import time


def uuid7() -> uuid.UUID:
    """Generate a UUID v7 (time-ordered) value.

    UUID v7 structure (128 bits):
    - 48 bits: Unix timestamp in milliseconds (enough until 10895 AD)
    - 74 bits: Random (cryptographically secure)
    - 6 bits: Version (0b111 = 7) and variant (0b10)

    The timestamp prefix enables:
    - Natural sort order by creation time
    - Efficient B-tree index performance
    - Conflict-free multi-region generation
    - Extraction of creation timestamp from the UUID

    Returns:
        A UUID v7 instance
    """
    timestamp_ms = int(time.time() * 1000)

    # 48-bit timestamp (6 bytes, big-endian)
    timestamp_bytes = timestamp_ms.to_bytes(6, "big")

    # 10 random bytes (enough for 74 random bits + version/variant)
    random_bytes = os.urandom(10)

    # Combine: 6 bytes timestamp + 10 bytes random
    combined = timestamp_bytes + random_bytes

    # Set version (bits 48-51 = 0b0111 = 7)
    combined[6] = (combined[6] & 0x0F) | 0x70

    # Set variant (bits 62-63 = 0b10)
    combined[8] = (combined[8] & 0x3F) | 0x80

    return uuid.UUID(bytes=bytes(combined))


def is_valid_uuid7(value: str | uuid.UUID) -> bool:
    """Check whether a UUID string is a valid UUID v7.

    Args:
        value: UUID string or UUID instance

    Returns:
        True if the value is a valid UUID v7
    """
    try:
        if isinstance(value, str):
            u = uuid.UUID(value)
        elif isinstance(value, uuid.UUID):
            u = value
        else:
            return False
        # Version byte should be 7
        version = u.version
        return version == 7
    except (ValueError, AttributeError):
        return False


def extract_timestamp(id: uuid.UUID) -> datetime:
    """Extract the creation timestamp from a UUID v7.

    Args:
        id: UUID v7 instance

    Returns:
        UTC datetime of when the UUID was generated
    """
    if id.version != 7:
        raise ValueError("UUID is not version 7")
    timestamp_ms = int.from_bytes(id.bytes[:6], "big")
    return datetime.fromtimestamp(timestamp_ms / 1000.0, tz=pytz.UTC)


def uuid7_str() -> str:
    """Generate a UUID v7 as a hex string (without dashes)."""
    return uuid7().hex
```

### 10.2 PostgreSQL Integration

```sql
-- PostgreSQL function for UUID v7 generation (Fallback if Django generates)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION uuid_generate_v7()
RETURNS uuid
LANGUAGE plpgsql
PARALLEL SAFE
AS $$
DECLARE
    timestamp_bytes bytea;
    random_bytes bytea;
    combined bytea;
BEGIN
    -- Current timestamp in milliseconds (48 bits)
    timestamp_bytes := int8send(
        (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint
    );

    -- 10 random bytes (80 bits)
    random_bytes := gen_random_bytes(10);

    -- Combine
    combined := timestamp_bytes || random_bytes;

    -- Set version 7 (bits 48-51)
    -- 0x70 = 0b01110000
    combined := set_byte(combined, 6,
        (get_byte(combined, 6) & 0x0F) | 0x70
    );

    -- Set variant RFC 4122 (bits 62-63)
    combined := set_byte(combined, 8,
        (get_byte(combined, 8) & 0x3F) | 0x80
    );

    RETURN combined::uuid;
END;
$$;

-- Usage in table definitions:
-- CREATE TABLE lead_management_leads (
--     id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
--     ...
-- );
```

### 10.3 Django Model Field

```python
from django.db import models
from shared_kernel.identifiers.uuid7 import uuid7


class UUID7Model(models.Model):
    """Abstract model with UUID v7 primary key."""

    id = models.UUIDField(
        primary_key=True,
        default=uuid7,
        editable=False,
        db_index=True,
    )

    class Meta:
        abstract = True


class TimestampedModel(models.Model):
    """Abstract model with automatic timestamp tracking."""

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class SoftDeleteModel(models.Model):
    """Abstract model with soft delete support."""

    deleted_at = models.DateTimeField(null=True, blank=True, db_index=True)

    class Meta:
        abstract = True

    def soft_delete(self) -> None:
        from django.utils import timezone
        self.deleted_at = timezone.now()
        self.save(update_fields=["deleted_at", "updated_at"])

    def restore(self) -> None:
        self.deleted_at = None
        self.save(update_fields=["deleted_at", "updated_at"])

    @property
    def is_deleted(self) -> bool:
        return self.deleted_at is not None


class TenantScopedModel(UUID7Model, TimestampedModel, SoftDeleteModel):
    """Base model for all tenant-scoped entities.

    Every tenant-scoped table must have:
    - organization_id FK
    - RLS policy applied
    - FORCE ROW LEVEL SECURITY
    """

    organization = models.ForeignKey(
        "organization.Organization",
        on_delete=models.CASCADE,
        db_index=True,
    )

    class Meta:
        abstract = True
```
