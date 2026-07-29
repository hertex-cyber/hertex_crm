"""Tenant application services — use cases for tenant lifecycle management."""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from apps.shared_kernel.domain.errors import ConflictError, NotFoundError
from apps.shared_kernel.domain.result import Result
from apps.tenant.domain.entities import Tenant, TenantStatus
from apps.tenant.infrastructure.repositories import TenantRepository


@dataclass
class ProvisionTenantCommand:
    organization_id: UUID
    plan: str = "free"


class TenantService:
    def provision(self, cmd: ProvisionTenantCommand) -> Result[Tenant, Exception]:
        tenant_repo = TenantRepository()
        existing = tenant_repo.get_by_organization_id(cmd.organization_id)
        if existing:
            return Result.failure(ConflictError("Tenant already exists for this organization"))

        tenant = Tenant(
            organization_id=cmd.organization_id,
            plan=cmd.plan,
            status=TenantStatus.ACTIVE,
        )
        tenant = tenant_repo.save(tenant)
        return Result.success(tenant)

    def get_by_org(self, org_id: UUID) -> Result[Tenant, Exception]:
        tenant = TenantRepository().get_by_organization_id(org_id)
        if not tenant:
            return Result.failure(NotFoundError(f"Tenant for organization {org_id} not found"))
        return Result.success(tenant)

    def change_plan(self, tenant_id: UUID, new_plan: str) -> Result[Tenant, Exception]:
        tenant_repo = TenantRepository()
        tenant = tenant_repo.get_by_id(tenant_id)
        if not tenant:
            return Result.failure(NotFoundError(f"Tenant {tenant_id} not found"))

        tenant.change_plan(new_plan)
        tenant = tenant_repo.save(tenant)
        return Result.success(tenant)

    def suspend(self, org_id: UUID, reason: str) -> Result[Tenant, Exception]:
        tenant_repo = TenantRepository()
        tenant = tenant_repo.get_by_organization_id(org_id)
        if not tenant:
            return Result.failure(NotFoundError(f"Tenant for organization {org_id} not found"))

        tenant.suspend(reason)
        tenant = tenant_repo.save(tenant)
        return Result.success(tenant)

    def activate(self, org_id: UUID) -> Result[Tenant, Exception]:
        tenant_repo = TenantRepository()
        tenant = tenant_repo.get_by_organization_id(org_id)
        if not tenant:
            return Result.failure(NotFoundError(f"Tenant for organization {org_id} not found"))

        tenant.activate()
        tenant = tenant_repo.save(tenant)
        return Result.success(tenant)
