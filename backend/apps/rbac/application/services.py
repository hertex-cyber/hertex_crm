from __future__ import annotations

from uuid import UUID

from django.db import transaction
from django.db.models import Count

from apps.organization.infrastructure.models import MembershipModel
from apps.rbac.domain.events import (
    OrganizationBootstrapped,
    RoleAssigned,
    RoleCreated,
    RoleDeleted,
    RoleUnassigned,
    RoleUpdated,
)
from apps.rbac.models import MembershipRoleAssignmentModel, PermissionModel, RoleModel
from apps.shared_kernel.application.ports import EventPublisher
from apps.shared_kernel.domain.errors import NotFoundError, PermissionDeniedError, ValidationError
from apps.shared_kernel.infrastructure.event_bus import CeleryEventPublisher

SYSTEM_ROLE_NAMES = {"Owner", "Admin", "Member"}
BASE_MEMBER_PERMISSIONS = [
    "lead.view", "lead.create", "lead.update",
    "contact.view", "contact.manage",
    "opportunity.view", "opportunity.manage",
    "activity.manage", "report.view",
]


class RbacService:
    def __init__(self, event_publisher: EventPublisher | None = None) -> None:
        self.event_publisher = event_publisher or CeleryEventPublisher()

    # ------------------------------------------------------------------
    # Public membership helpers
    # ------------------------------------------------------------------

    def verify_membership(self, user_id: UUID, organization_id: UUID) -> MembershipModel:
        try:
            return MembershipModel.objects.get(
                user_id=user_id, organization_id=organization_id, status="ACTIVE"
            )
        except MembershipModel.DoesNotExist as exc:
            raise PermissionDeniedError("You are not an active member of this organization") from exc

    def is_admin(self, user_id: UUID, organization_id: UUID) -> bool:
        membership = self.verify_membership(user_id, organization_id)
        if membership.role in {"OWNER", "ADMIN"}:
            return True
        return membership.role_assignments.filter(role__name__in=["Owner", "Admin"]).exists()

    def require_admin(self, user_id: UUID, organization_id: UUID) -> None:
        if not self.is_admin(user_id, organization_id):
            raise PermissionDeniedError("Administrator permission is required")

    # ------------------------------------------------------------------
    # Permission resolution
    # ------------------------------------------------------------------

    def permissions_for(self, user_id: UUID, organization_id: UUID) -> set[str]:
        membership = self.verify_membership(user_id, organization_id)
        if membership.role == "OWNER":
            return set(PermissionModel.objects.values_list("code", flat=True))
        codes = PermissionModel.objects.filter(roles__assignments__membership=membership).values_list("code", flat=True)
        return set(codes)

    def has_permission(self, user_id: UUID, organization_id: UUID, permission: str) -> bool:
        return permission in self.permissions_for(user_id, organization_id)

    # ------------------------------------------------------------------
    # Bootstrap
    # ------------------------------------------------------------------

    @transaction.atomic
    def bootstrap_organization(self, organization_id: UUID) -> None:
        all_permissions = list(PermissionModel.objects.all())
        member_permissions = list(PermissionModel.objects.filter(code__in=BASE_MEMBER_PERMISSIONS))
        role_permissions = {"Owner": all_permissions, "Admin": all_permissions, "Member": member_permissions}
        roles: dict[str, RoleModel] = {}
        for name, permissions in role_permissions.items():
            role, _ = RoleModel.objects.get_or_create(
                organization_id=organization_id,
                name=name,
                defaults={"description": f"Built-in {name.lower()} role", "is_system": True},
            )
            role.permissions.set(permissions)
            roles[name] = role

        legacy_map = {"OWNER": "Owner", "ADMIN": "Admin", "MEMBER": "Member"}
        for membership in MembershipModel.objects.filter(organization_id=organization_id):
            role_name = legacy_map.get(membership.role, "Member")
            MembershipRoleAssignmentModel.objects.get_or_create(membership=membership, role=roles[role_name])

        self.event_publisher.publish(OrganizationBootstrapped(
            created_roles=list(roles.keys()),
            organization_id=organization_id,
        ))

    # ------------------------------------------------------------------
    # Role CRUD
    # ------------------------------------------------------------------

    def list_roles(self, organization_id: UUID) -> list[RoleModel]:
        return list(
            RoleModel.objects.filter(organization_id=organization_id)
            .prefetch_related("permissions", "assignments")
            .annotate(member_count=Count("assignments"))
        )

    @transaction.atomic
    def create_role(self, organization_id: UUID, name: str, description: str, permission_codes: list[str]) -> RoleModel:
        if name.strip() in SYSTEM_ROLE_NAMES:
            raise ValidationError("System role names cannot be used for custom roles")
        permissions = list(PermissionModel.objects.filter(code__in=permission_codes))
        if len(permissions) != len(set(permission_codes)):
            raise ValidationError("One or more permissions are invalid")
        role = RoleModel.objects.create(organization_id=organization_id, name=name.strip(), description=description)
        role.permissions.set(permissions)
        self.event_publisher.publish(RoleCreated(
            role_id=role.id,
            name=role.name,
            permission_codes=list(role.permissions.values_list("code", flat=True)),
            organization_id=organization_id,
        ))
        return role

    @transaction.atomic
    def update_role(self, role_id: UUID, organization_id: UUID, name: str | None, description: str | None, permission_codes: list[str] | None) -> RoleModel:
        try:
            role = RoleModel.objects.get(id=role_id, organization_id=organization_id)
        except RoleModel.DoesNotExist as exc:
            raise NotFoundError("Role not found") from exc
        if role.is_system and name and name.strip() != role.name:
            raise ValidationError("System role names cannot be changed")
        if name:
            role.name = name.strip()
        if description is not None:
            role.description = description
        if permission_codes is not None:
            perms = list(PermissionModel.objects.filter(code__in=permission_codes))
            if len(perms) != len(set(permission_codes)):
                raise ValidationError("One or more permissions are invalid")
            role.permissions.set(perms)
        role.save()
        self.event_publisher.publish(RoleUpdated(
            role_id=role.id,
            name=role.name,
            permission_codes=list(role.permissions.values_list("code", flat=True)),
            organization_id=organization_id,
        ))
        return role

    @transaction.atomic
    def delete_role(self, role_id: UUID, organization_id: UUID) -> None:
        try:
            role = RoleModel.objects.get(id=role_id, organization_id=organization_id)
        except RoleModel.DoesNotExist as exc:
            raise NotFoundError("Role not found") from exc
        if role.is_system:
            raise ValidationError("System roles cannot be deleted")
        name = role.name
        role.delete()
        self.event_publisher.publish(RoleDeleted(
            role_id=role_id,
            name=name,
            organization_id=organization_id,
        ))

    # ------------------------------------------------------------------
    # Role assignments
    # ------------------------------------------------------------------

    @transaction.atomic
    def assign_role(self, role_id: UUID, membership_id: UUID, organization_id: UUID) -> MembershipRoleAssignmentModel:
        try:
            role = RoleModel.objects.get(id=role_id, organization_id=organization_id)
            membership = MembershipModel.objects.get(id=membership_id, organization_id=organization_id)
        except (RoleModel.DoesNotExist, MembershipModel.DoesNotExist) as exc:
            raise NotFoundError("Role or organization member not found") from exc
        assignment, created = MembershipRoleAssignmentModel.objects.get_or_create(role=role, membership=membership)
        if created:
            self.event_publisher.publish(RoleAssigned(
                role_id=role.id,
                membership_id=membership.id,
                user_id=membership.user_id,
                organization_id=organization_id,
            ))
        return assignment

    def unassign_role(self, role_id: UUID, membership_id: UUID, organization_id: UUID) -> None:
        membership = MembershipModel.objects.filter(id=membership_id, organization_id=organization_id).first()
        deleted, _ = MembershipRoleAssignmentModel.objects.filter(
            role_id=role_id, membership_id=membership_id, membership__organization_id=organization_id
        ).delete()
        if deleted and membership:
            self.event_publisher.publish(RoleUnassigned(
                role_id=role_id,
                membership_id=membership_id,
                user_id=membership.user_id,
                organization_id=organization_id,
            ))

    # ------------------------------------------------------------------
    # Member onboarding
    # ------------------------------------------------------------------

    @transaction.atomic
    def ensure_member_role(self, membership_id: UUID, organization_id: UUID) -> None:
        try:
            member_role = RoleModel.objects.get(organization_id=organization_id, name="Member")
            membership = MembershipModel.objects.get(id=membership_id)
            MembershipRoleAssignmentModel.objects.get_or_create(role=member_role, membership=membership)
        except (RoleModel.DoesNotExist, MembershipModel.DoesNotExist):
            pass
