"""Organization domain aggregates — Organization and Membership.

Organizations are the top-level tenant boundary. Every user belongs to one
or more organizations through a Membership. Organizations own all CRM data.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from apps.shared_kernel.domain.base import AggregateRoot, Entity, UUID, utcnow
from apps.shared_kernel.domain.errors import ValidationError


class OrganizationStatus(Enum):
    ACTIVE = "ACTIVE"
    ARCHIVED = "ARCHIVED"


class MembershipRole(Enum):
    OWNER = "OWNER"
    ADMIN = "ADMIN"
    MEMBER = "MEMBER"


class MembershipStatus(Enum):
    ACTIVE = "ACTIVE"
    INVITED = "INVITED"
    DECLINED = "DECLINED"


class Organization(AggregateRoot):
    """An organization/workspace that owns CRM data.

    Invariants:
    - Name must be non-empty
    - Slug must be unique across all organizations
    - Status determines if the org is usable
    """

    def __init__(
        self,
        name: str,
        slug: str,
        id: UUID | None = None,
        status: OrganizationStatus = OrganizationStatus.ACTIVE,
        created_by: UUID | None = None,
        created_at: datetime | None = None,
    ) -> None:
        super().__init__(id)
        self._name = name
        self._slug = slug
        self._status = status
        self._created_by = created_by
        self._created_at = created_at or utcnow()

    @property
    def name(self) -> str:
        return self._name

    @name.setter
    def name(self, value: str) -> None:
        if not value or not value.strip():
            raise ValidationError("Organization name cannot be empty")
        self._name = value.strip()
        from .events import OrganizationUpdated
        self._record_event(OrganizationUpdated(organization_id=self.id, name=self._name))

    @property
    def slug(self) -> str:
        return self._slug

    @property
    def status(self) -> OrganizationStatus:
        return self._status

    @property
    def created_by(self) -> UUID | None:
        return self._created_by

    @created_by.setter
    def created_by(self, value: UUID | None) -> None:
        self._created_by = value

    @property
    def created_at(self) -> datetime:
        return self._created_at

    def archive(self) -> None:
        """Archive this organization (soft-delete)."""
        if self._status == OrganizationStatus.ARCHIVED:
            raise ValidationError("Organization is already archived")
        self._status = OrganizationStatus.ARCHIVED
        from .events import OrganizationArchived
        self._record_event(OrganizationArchived(organization_id=self.id))

    def restore(self) -> None:
        """Restore an archived organization."""
        if self._status == OrganizationStatus.ACTIVE:
            raise ValidationError("Organization is already active")
        self._status = OrganizationStatus.ACTIVE
        from .events import OrganizationRestored
        self._record_event(OrganizationRestored(organization_id=self.id))


class Membership(AggregateRoot):
    """A user's membership in an organization with a specific role.

    Invariants:
    - A user can have only one membership per organization
    - An organization must have exactly one OWNER
    - OWNER role cannot be changed or removed
    """

    def __init__(
        self,
        user_id: UUID,
        organization_id: UUID,
        role: MembershipRole,
        status: MembershipStatus = MembershipStatus.ACTIVE,
        invited_by: UUID | None = None,
        id: UUID | None = None,
    ) -> None:
        super().__init__(id)
        self._user_id = user_id
        self._organization_id = organization_id
        self._role = role
        self._status = status
        self._invited_by = invited_by

    @property
    def user_id(self) -> UUID:
        return self._user_id

    @property
    def organization_id(self) -> UUID:
        return self._organization_id

    @property
    def role(self) -> MembershipRole:
        return self._role

    @property
    def status(self) -> MembershipStatus:
        return self._status

    @property
    def invited_by(self) -> UUID | None:
        return self._invited_by

    @property
    def is_active(self) -> bool:
        return self._status == MembershipStatus.ACTIVE

    def change_role(self, new_role: MembershipRole) -> None:
        if self._role == MembershipRole.OWNER:
            raise ValidationError("Cannot change the role of the organization owner")
        if new_role == MembershipRole.OWNER:
            raise ValidationError("Cannot assign OWNER role through role change")
        old_role = self._role
        self._role = new_role
        from .events import MembershipRoleChanged
        self._record_event(MembershipRoleChanged(
            membership_id=self.id,
            user_id=self.user_id,
            organization_id=self.organization_id,
            old_role=old_role.value,
            new_role=new_role.value,
        ))

    def activate(self) -> None:
        if self._status == MembershipStatus.ACTIVE:
            return
        self._status = MembershipStatus.ACTIVE

    def decline(self) -> None:
        if self._status == MembershipStatus.DECLINED:
            raise ValidationError("Membership already declined")
        self._status = MembershipStatus.DECLINED
