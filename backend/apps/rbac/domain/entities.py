from __future__ import annotations

from dataclasses import dataclass, field
from uuid import UUID

from apps.rbac.domain.events import (
    OrganizationBootstrapped,
    RoleAssigned,
    RoleCreated,
    RoleDeleted,
    RoleUnassigned,
    RoleUpdated,
)
from apps.rbac.domain.value_objects import PermissionCode, RoleName
from apps.shared_kernel.domain.base import AggregateRoot


@dataclass
class Permission:
    code: PermissionCode
    label: str
    module: str
    description: str


class Role(AggregateRoot):
    def __init__(
        self,
        organization_id: UUID,
        name: str,
        description: str = "",
        is_system: bool = False,
        permission_codes: list[str] | None = None,
        id: UUID | None = None,
    ) -> None:
        super().__init__(id)
        self.organization_id = organization_id
        self._name = RoleName(name)
        self._description = description
        self._is_system = is_system or self._name.is_system
        self._permission_codes: set[str] = set(permission_codes or [])

    @property
    def name(self) -> str:
        return self._name.name

    @property
    def description(self) -> str:
        return self._description

    @description.setter
    def description(self, value: str) -> None:
        self._description = value

    @property
    def is_system(self) -> bool:
        return self._is_system

    @property
    def permission_codes(self) -> set[str]:
        return set(self._permission_codes)

    def set_permissions(self, codes: list[str]) -> None:
        self._permission_codes = set(codes)

    def record_created(self) -> None:
        self._record_event(
            RoleCreated(
                role_id=self.id,
                name=self.name,
                permission_codes=list(self._permission_codes),
                organization_id=self.organization_id,
            )
        )

    def record_updated(self) -> None:
        self._record_event(
            RoleUpdated(
                role_id=self.id,
                name=self.name,
                permission_codes=list(self._permission_codes),
                organization_id=self.organization_id,
            )
        )

    def record_deleted(self) -> None:
        self._record_event(
            RoleDeleted(
                role_id=self.id,
                name=self.name,
                organization_id=self.organization_id,
            )
        )

    def record_assigned(self, membership_id: UUID, user_id: UUID) -> None:
        self._record_event(
            RoleAssigned(
                role_id=self.id,
                membership_id=membership_id,
                user_id=user_id,
                organization_id=self.organization_id,
            )
        )

    def record_unassigned(self, membership_id: UUID, user_id: UUID) -> None:
        self._record_event(
            RoleUnassigned(
                role_id=self.id,
                membership_id=membership_id,
                user_id=user_id,
                organization_id=self.organization_id,
            )
        )

    @staticmethod
    def record_bootstrap(organization_id: UUID, created_roles: list[str]) -> OrganizationBootstrapped:
        return OrganizationBootstrapped(
            created_roles=created_roles,
            organization_id=organization_id,
        )


class MembershipRoleAssignment(AggregateRoot):
    def __init__(
        self,
        membership_id: UUID,
        role_id: UUID,
        organization_id: UUID,
        id: UUID | None = None,
    ) -> None:
        super().__init__(id)
        self.membership_id = membership_id
        self.role_id = role_id
        self.organization_id = organization_id
