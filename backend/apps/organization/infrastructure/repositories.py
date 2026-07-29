"""Organization repository implementations."""

from __future__ import annotations

from uuid import UUID

from apps.organization.domain.entities import Membership, MembershipRole, MembershipStatus, Organization, OrganizationStatus
from apps.organization.infrastructure.models import MembershipModel, OrganizationModel
from apps.shared_kernel.application.ports import Repository
from apps.shared_kernel.domain.result import PaginatedResult


class OrganizationRepository(Repository[Organization]):
    """Django ORM-based repository for Organization aggregate."""

    def get_by_id(self, id: UUID) -> Organization | None:
        try:
            instance = OrganizationModel.objects.get(id=id)
            return self._to_domain(instance)
        except OrganizationModel.DoesNotExist:
            return None

    def get_by_slug(self, slug: str) -> Organization | None:
        try:
            instance = OrganizationModel.objects.get(slug=slug)
            return self._to_domain(instance)
        except OrganizationModel.DoesNotExist:
            return None

    def save(self, entity: Organization) -> Organization:
        instance, created = OrganizationModel.objects.update_or_create(
            id=entity.id,
            defaults={
                "name": entity.name,
                "slug": entity.slug,
                "status": entity.status.value,
                "created_by": entity.created_by,
            },
        )
        return self._to_domain(instance)

    def delete(self, entity: Organization) -> None:
        OrganizationModel.objects.filter(id=entity.id).update(status="ARCHIVED")

    def list(self, **filters) -> PaginatedResult[Organization]:
        qs = OrganizationModel.objects.all()
        if "status" in filters:
            qs = qs.filter(status=filters["status"])
        if "search" in filters:
            qs = qs.filter(name__icontains=filters["search"])
        orgs = [self._to_domain(o) for o in qs]
        return PaginatedResult(items=orgs, total_count=len(orgs), page=1, page_size=len(orgs))

    def _to_domain(self, instance: OrganizationModel) -> Organization:
        return Organization(
            name=instance.name,
            slug=instance.slug,
            id=instance.id,
            status=OrganizationStatus(instance.status),
            created_by=instance.created_by,
            created_at=instance.created_at,
        )


class MembershipRepository:
    """Django ORM-based repository for Membership entities."""

    def get_by_id(self, id: UUID) -> Membership | None:
        try:
            instance = MembershipModel.objects.get(id=id)
            return self._to_domain(instance)
        except MembershipModel.DoesNotExist:
            return None

    def get_by_user_and_org(self, user_id: UUID, org_id: UUID) -> Membership | None:
        try:
            instance = MembershipModel.objects.get(user_id=user_id, organization_id=org_id)
            return self._to_domain(instance)
        except MembershipModel.DoesNotExist:
            return None

    def list_by_user(self, user_id: UUID) -> list[Membership]:
        qs = MembershipModel.objects.filter(user_id=user_id, status="ACTIVE")
        return [self._to_domain(m) for m in qs]

    def list_by_organization(self, org_id: UUID, status: str | None = None) -> list[Membership]:
        qs = MembershipModel.objects.filter(organization_id=org_id)
        if status:
            qs = qs.filter(status=status)
        return [self._to_domain(m) for m in qs]

    def save(self, entity: Membership) -> Membership:
        instance, created = MembershipModel.objects.update_or_create(
            id=entity.id,
            defaults={
                "user_id": entity.user_id,
                "organization_id": entity.organization_id,
                "role": entity.role.value,
                "status": entity.status.value,
                "invited_by": entity.invited_by,
            },
        )
        return self._to_domain(instance)

    def delete(self, entity: Membership) -> None:
        MembershipModel.objects.filter(id=entity.id).delete()

    def _to_domain(self, instance: MembershipModel) -> Membership:
        return Membership(
            user_id=instance.user_id,
            organization_id=instance.organization_id,
            role=MembershipRole(instance.role),
            status=MembershipStatus(instance.status),
            invited_by=instance.invited_by,
            id=instance.id,
        )
