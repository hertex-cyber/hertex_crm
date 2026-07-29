"""Base domain primitives — AggregateRoot, Entity, ValueObject, DomainEvent.

These are the foundational building blocks for all domain models.
Zero Django imports — pure Python to keep the domain layer framework-agnostic.
"""

from __future__ import annotations

import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def generate_uuid7() -> uuid.UUID:
    """Generate a UUID v7 (time-ordered, sortable by creation time).

    Uses the python-ulid library's ULID as the basis, converted to UUID v7 format.
    Falls back to uuid4 if python-ulid is not available.
    """
    try:
        from ulid import ULID
        return UUID(bytes=ULID().bytes)
    except ImportError:
        return uuid.uuid4()


# Temporary UUID v7 placeholder until python-ulid is installed
class UUID(uuid.UUID):
    """UUID with v7 generation support."""
    @classmethod
    def v7(cls) -> UUID:
        """Generate a UUID v7 (time-ordered, sortable)."""
        return uuid.uuid7() if hasattr(uuid, "uuid7") else UUID(bytes=uuid.uuid4().bytes)


@dataclass(frozen=True)
class ValueObject(ABC):
    """Base class for Value Objects — immutable, value-based equality.

    Two ValueObjects with the same field values are considered equal.
    Value Objects have no identity — they are defined solely by their attributes.
    """

    def __eq__(self, other: Any) -> bool:
        if not isinstance(other, self.__class__):
            return NotImplemented
        return self.__dict__ == other.__dict__

    def __hash__(self) -> int:
        return hash(tuple(sorted(self.__dict__.items())))

    def __repr__(self) -> str:
        fields = ", ".join(f"{k}={v!r}" for k, v in self.__dict__.items())
        return f"{self.__class__.__name__}({fields})"


class Entity(ABC):
    """Base class for Entities — mutable, identity-based equality.

    Two Entities with the same id are considered equal regardless of field values.
    """

    def __init__(self, id: UUID | None = None) -> None:
        self._id = id or UUID.v7()

    @property
    def id(self) -> UUID:
        return self._id

    def __eq__(self, other: Any) -> bool:
        if not isinstance(other, self.__class__):
            return NotImplemented
        return self._id == other._id

    def __hash__(self) -> int:
        return hash(self._id)

    def __repr__(self) -> str:
        return f"{self.__class__.__name__}(id={self._id})"


@dataclass
class DomainEvent(ABC):
    """Base class for domain events — facts that have happened in the system.

    Events are immutable records of past occurrences. They carry the data
    needed by subscribers to react appropriately.
    """

    event_id: UUID = field(default_factory=UUID.v7, kw_only=True)
    occurred_at: datetime = field(default_factory=utcnow, kw_only=True)
    organization_id: UUID | None = field(default=None, kw_only=True)

    @abstractmethod
    def get_aggregate_id(self) -> UUID:
        """Return the ID of the aggregate that published this event."""
        ...


class AggregateRoot(Entity, ABC):
    """Base class for Aggregate Roots — the consistency boundary.

    An Aggregate Root is an Entity that acts as the entry point for a cluster
    of domain objects. All invariants are enforced through the root.
    Domain events are collected here and published by the application service.
    """

    def __init__(self, id: UUID | None = None) -> None:
        super().__init__(id)
        self._domain_events: list[DomainEvent] = []

    def _record_event(self, event: DomainEvent) -> None:
        """Record a domain event to be published after the transaction completes."""
        event.organization_id = getattr(self, "organization_id", None)
        self._domain_events.append(event)

    def collect_events(self) -> list[DomainEvent]:
        """Return all recorded domain events and clear the collection."""
        events = list(self._domain_events)
        self._domain_events.clear()
        return events
