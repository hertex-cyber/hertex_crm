"""Application-layer ports (interfaces) for dependency inversion.

These ports define the contracts that the domain/application layer expects
from infrastructure. Concrete implementations live in each module's
infrastructure layer and are injected at runtime.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime
from typing import Generic, Protocol, TypeVar

from apps.shared_kernel.domain.base import DomainEvent, Entity, UUID
from apps.shared_kernel.domain.result import PaginatedResult

T = TypeVar("T", bound=Entity)


class Repository(ABC, Generic[T]):
    """Generic repository interface for aggregate persistence."""

    @abstractmethod
    def get_by_id(self, id: UUID) -> T | None: ...

    @abstractmethod
    def save(self, entity: T) -> T: ...

    @abstractmethod
    def delete(self, entity: T) -> None: ...

    @abstractmethod
    def list(self, **filters) -> PaginatedResult[T]: ...


class EventPublisher(ABC):
    """Abstract event publisher port.

    The one concrete implementation lives in infrastructure/event_bus.py
    and uses RabbitMQ via Celery. The interface lives here so that every
    module's application layer depends only on the abstraction.
    """

    @abstractmethod
    def publish(self, event: DomainEvent) -> None: ...

    @abstractmethod
    def publish_many(self, events: list[DomainEvent]) -> None: ...


class Clock(ABC):
    """Abstract clock for deterministic time in tests.

    Application services call Clock.now() (injected) rather than datetime.now()
    directly, so domain logic involving time (SLA deadlines, expected_close_date
    checks) is deterministically testable.
    """

    @abstractmethod
    def now(self) -> datetime: ...

    @abstractmethod
    def today(self) -> datetime: ...


class RealClock(Clock):
    """Production clock — returns real time."""

    def now(self) -> datetime:
        from datetime import timezone
        return datetime.now(timezone.utc)

    def today(self) -> datetime:
        from datetime import timezone
        return datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
