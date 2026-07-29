"""Organization domain events."""

from __future__ import annotations

from dataclasses import dataclass

from apps.shared_kernel.domain.base import DomainEvent


@dataclass(kw_only=True)
class OrganizationCreated(DomainEvent):
    organization_id: str
    name: str
    slug: str
    owner_id: str


@dataclass(kw_only=True)
class OrganizationUpdated(DomainEvent):
    organization_id: str
    name: str


@dataclass(kw_only=True)
class OrganizationArchived(DomainEvent):
    organization_id: str


@dataclass(kw_only=True)
class OrganizationRestored(DomainEvent):
    organization_id: str


@dataclass(kw_only=True)
class MemberInvited(DomainEvent):
    membership_id: str
    organization_id: str
    user_id: str
    invited_by: str


@dataclass(kw_only=True)
class MemberJoined(DomainEvent):
    membership_id: str
    organization_id: str
    user_id: str


@dataclass(kw_only=True)
class MembershipRoleChanged(DomainEvent):
    membership_id: str
    user_id: str
    organization_id: str
    old_role: str
    new_role: str

    def get_aggregate_id(self) -> UUID:
        return UUID(self.membership_id)
