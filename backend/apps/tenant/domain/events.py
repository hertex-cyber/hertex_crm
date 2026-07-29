"""Tenant domain events."""

from __future__ import annotations

from dataclasses import dataclass

from apps.shared_kernel.domain.base import DomainEvent, UUID


@dataclass(kw_only=True)
class TenantProvisioned(DomainEvent):
    tenant_id: str
    organization_id: str
    plan: str

    def get_aggregate_id(self) -> UUID:
        return UUID(self.tenant_id)


@dataclass(kw_only=True)
class TenantPlanChanged(DomainEvent):
    tenant_id: str
    organization_id: str
    old_plan: str
    new_plan: str

    def get_aggregate_id(self) -> UUID:
        return UUID(self.tenant_id)


@dataclass(kw_only=True)
class TenantSuspended(DomainEvent):
    tenant_id: str
    organization_id: str
    reason: str

    def get_aggregate_id(self) -> UUID:
        return UUID(self.tenant_id)


@dataclass(kw_only=True)
class TenantActivated(DomainEvent):
    tenant_id: str
    organization_id: str

    def get_aggregate_id(self) -> UUID:
        return UUID(self.tenant_id)


@dataclass(kw_only=True)
class TenantDisabled(DomainEvent):
    tenant_id: str
    organization_id: str
    reason: str

    def get_aggregate_id(self) -> UUID:
        return UUID(self.tenant_id)
