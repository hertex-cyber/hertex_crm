"""Tenant domain aggregate.

Tenants represent the billing and plan boundary for an organization.
Each organization has exactly one tenant. Tenants control feature access,
storage limits, and API rate limits.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any

from apps.shared_kernel.domain.base import AggregateRoot, UUID, utcnow
from apps.shared_kernel.domain.errors import ValidationError


class TenantStatus(Enum):
    ACTIVE = "ACTIVE"
    SUSPENDED = "SUSPENDED"
    DISABLED = "DISABLED"


class Tenant(AggregateRoot):
    """A tenant representing billing and plan boundaries.

    Invariants:
    - One tenant per organization
    - Suspended tenants cannot use the platform
    - Disabled tenants are permanently closed
    """

    def __init__(
        self,
        organization_id: UUID,
        plan: str = "free",
        id: UUID | None = None,
        status: TenantStatus = TenantStatus.ACTIVE,
        settings: dict[str, Any] | None = None,
        created_at: datetime | None = None,
    ) -> None:
        super().__init__(id)
        self._organization_id = organization_id
        self._plan = plan
        self._status = status
        self._settings = settings or {}
        self._created_at = created_at or utcnow()

    @property
    def organization_id(self) -> UUID:
        return self._organization_id

    @property
    def plan(self) -> str:
        return self._plan

    @property
    def status(self) -> TenantStatus:
        return self._status

    @property
    def settings(self) -> dict[str, Any]:
        return self._settings

    @property
    def created_at(self) -> datetime:
        return self._created_at

    @property
    def is_active(self) -> bool:
        return self._status == TenantStatus.ACTIVE

    def change_plan(self, new_plan: str) -> None:
        """Change the tenant's subscription plan."""
        valid_plans = ["free", "starter", "professional", "enterprise"]
        if new_plan not in valid_plans:
            raise ValidationError(f"Invalid plan. Must be one of: {', '.join(valid_plans)}")
        old_plan = self._plan
        self._plan = new_plan
        from .events import TenantPlanChanged
        self._record_event(TenantPlanChanged(
            tenant_id=self.id,
            organization_id=self.organization_id,
            old_plan=old_plan,
            new_plan=new_plan,
        ))

    def suspend(self, reason: str) -> None:
        """Suspend tenant for non-payment or policy violation."""
        if self._status == TenantStatus.DISABLED:
            raise ValidationError("Cannot suspend a disabled tenant")
        self._status = TenantStatus.SUSPENDED
        self._settings["suspend_reason"] = reason
        self._settings["suspended_at"] = utcnow().isoformat()
        from .events import TenantSuspended
        self._record_event(TenantSuspended(
            tenant_id=self.id,
            organization_id=self.organization_id,
            reason=reason,
        ))

    def activate(self) -> None:
        """Reactivate a suspended tenant."""
        if self._status == TenantStatus.DISABLED:
            raise ValidationError("Cannot activate a disabled tenant")
        if self._status == TenantStatus.ACTIVE:
            raise ValidationError("Tenant is already active")
        self._status = TenantStatus.ACTIVE
        self._settings.pop("suspend_reason", None)
        self._settings.pop("suspended_at", None)
        from .events import TenantActivated
        self._record_event(TenantActivated(
            tenant_id=self.id,
            organization_id=self.organization_id,
        ))

    def disable(self, reason: str) -> None:
        """Permanently disable a tenant."""
        self._status = TenantStatus.DISABLED
        self._settings["disabled_reason"] = reason
        self._settings["disabled_at"] = utcnow().isoformat()
        from .events import TenantDisabled
        self._record_event(TenantDisabled(
            tenant_id=self.id,
            organization_id=self.organization_id,
            reason=reason,
        ))
