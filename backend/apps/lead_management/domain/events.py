from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from apps.shared_kernel.domain.base import DomainEvent


@dataclass
class LeadCreated(DomainEvent):
    lead_id: UUID
    first_name: str
    last_name: str
    email: str
    source: str
    status: str
    assigned_to_id: UUID | None = None

    def get_aggregate_id(self) -> UUID:
        return self.lead_id


@dataclass
class LeadUpdated(DomainEvent):
    lead_id: UUID
    changes: dict[str, list]

    def get_aggregate_id(self) -> UUID:
        return self.lead_id


@dataclass
class LeadAssigned(DomainEvent):
    lead_id: UUID
    from_user_id: UUID | None
    to_user_id: UUID | None

    def get_aggregate_id(self) -> UUID:
        return self.lead_id


@dataclass
class LeadStatusChanged(DomainEvent):
    lead_id: UUID
    from_status: str
    to_status: str
    reason: str = ""

    def get_aggregate_id(self) -> UUID:
        return self.lead_id


@dataclass
class LeadScored(DomainEvent):
    lead_id: UUID
    score: int
    previous_score: int = 0

    def get_aggregate_id(self) -> UUID:
        return self.lead_id


@dataclass
class LeadConverted(DomainEvent):
    lead_id: UUID
    contact_id: UUID
    opportunity_id: UUID | None = None

    def get_aggregate_id(self) -> UUID:
        return self.lead_id


@dataclass
class LeadDeleted(DomainEvent):
    lead_id: UUID

    def get_aggregate_id(self) -> UUID:
        return self.lead_id
