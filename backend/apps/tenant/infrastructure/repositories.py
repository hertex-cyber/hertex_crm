"""Tenant repository implementations."""

from __future__ import annotations

from uuid import UUID

from apps.shared_kernel.application.ports import Repository
from apps.shared_kernel.domain.result import PaginatedResult
from apps.tenant.domain.entities import Tenant, TenantStatus
from apps.tenant.infrastructure.models import TenantModel


class TenantRepository(Repository[Tenant]):
    """Django ORM-based repository for Tenant aggregate."""

    def get_by_id(self, id: UUID) -> Tenant | None:
        try:
            instance = TenantModel.objects.get(id=id)
            return self._to_domain(instance)
        except TenantModel.DoesNotExist:
            return None

    def get_by_organization_id(self, org_id: UUID) -> Tenant | None:
        try:
            instance = TenantModel.objects.get(organization_id=org_id)
            return self._to_domain(instance)
        except TenantModel.DoesNotExist:
            return None

    def save(self, entity: Tenant) -> Tenant:
        instance, created = TenantModel.objects.update_or_create(
            id=entity.id,
            defaults={
                "organization_id": entity.organization_id,
                "plan": entity.plan,
                "status": entity.status.value,
                "settings": entity.settings,
            },
        )
        return self._to_domain(instance)

    def delete(self, entity: Tenant) -> None:
        TenantModel.objects.filter(id=entity.id).update(status="DISABLED")

    def list(self, **filters) -> PaginatedResult[Tenant]:
        qs = TenantModel.objects.all()
        if "status" in filters:
            qs = qs.filter(status=filters["status"])
        if "plan" in filters:
            qs = qs.filter(plan=filters["plan"])
        tenants = [self._to_domain(t) for t in qs]
        return PaginatedResult(items=tenants, total_count=len(tenants), page=1, page_size=len(tenants))

    def _to_domain(self, instance: TenantModel) -> Tenant:
        return Tenant(
            organization_id=instance.organization_id,
            plan=instance.plan,
            id=instance.id,
            status=TenantStatus(instance.status),
            settings=instance.settings,
            created_at=instance.created_at,
        )
