from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from apps.shared_kernel.domain.base import DomainEvent


@dataclass
class RoleCreated(DomainEvent):
    role_id: UUID
    name: str
    permission_codes: list[str]

    def get_aggregate_id(self) -> UUID:
        return self.role_id


@dataclass
class RoleUpdated(DomainEvent):
    role_id: UUID
    name: str
    permission_codes: list[str]

    def get_aggregate_id(self) -> UUID:
        return self.role_id


@dataclass
class RoleDeleted(DomainEvent):
    role_id: UUID
    name: str

    def get_aggregate_id(self) -> UUID:
        return self.role_id


@dataclass
class RoleAssigned(DomainEvent):
    role_id: UUID
    membership_id: UUID
    user_id: UUID

    def get_aggregate_id(self) -> UUID:
        return self.role_id


@dataclass
class RoleUnassigned(DomainEvent):
    role_id: UUID
    membership_id: UUID
    user_id: UUID

    def get_aggregate_id(self) -> UUID:
        return self.role_id


@dataclass
class OrganizationBootstrapped(DomainEvent):
    created_roles: list[str]

    def get_aggregate_id(self) -> UUID:
        return self.organization_id or UUID(int=0)
