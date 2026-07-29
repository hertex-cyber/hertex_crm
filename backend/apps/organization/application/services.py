"""Organization application services — use cases for org and membership management."""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from apps.organization.domain.entities import (
    Membership,
    MembershipRole,
    MembershipStatus,
    Organization,
)
from apps.organization.infrastructure.repositories import (
    MembershipRepository,
    OrganizationRepository,
)
from apps.shared_kernel.domain.errors import ConflictError, NotFoundError, PermissionDeniedError, ValidationError
from apps.shared_kernel.domain.result import Result

from apps.rbac.models import RoleModel


@dataclass
class CreateOrgCommand:
    name: str
    slug: str
    owner_id: UUID


@dataclass
class InviteMemberCommand:
    organization_id: UUID
    invited_by_user_id: UUID
    invitee_email: str
    role: str


class OrgService:
    def create(self, cmd: CreateOrgCommand) -> Result[dict, Exception]:
        org_repo = OrganizationRepository()
        existing = org_repo.get_by_slug(cmd.slug)
        if existing:
            return Result.failure(ConflictError(f"Organization with slug '{cmd.slug}' already exists"))

        org = Organization(name=cmd.name, slug=cmd.slug, created_by=cmd.owner_id)
        org = org_repo.save(org)

        membership = Membership(
            user_id=cmd.owner_id,
            organization_id=org.id,
            role=MembershipRole.OWNER,
            status=MembershipStatus.ACTIVE,
        )
        MembershipRepository().save(membership)

        # Provision standard organization roles as soon as the workspace exists.
        from apps.rbac.application.services import RbacService
        RbacService().bootstrap_organization(org.id)

        from apps.tenant.application.services import ProvisionTenantCommand, TenantService
        tenant_result = TenantService().provision(ProvisionTenantCommand(organization_id=org.id))
        if tenant_result.is_failure:
            return Result.failure(tenant_result.error)

        return Result.success({
            "org_id": str(org.id),
            "name": org.name,
            "slug": org.slug,
            "tenant_id": str(tenant_result.value.id),
        })

    def get(self, org_id: UUID) -> Result[Organization, Exception]:
        org = OrganizationRepository().get_by_id(org_id)
        if not org:
            return Result.failure(NotFoundError(f"Organization {org_id} not found"))
        return Result.success(org)

    def update(self, org_id: UUID, name: str | None = None, description: str | None = None) -> Result[Organization, Exception]:
        org_repo = OrganizationRepository()
        org = org_repo.get_by_id(org_id)
        if not org:
            return Result.failure(NotFoundError(f"Organization {org_id} not found"))

        if name is not None:
            org.name = name

        org = org_repo.save(org)

        if description is not None:
            from apps.organization.infrastructure.models import OrganizationModel
            OrganizationModel.objects.filter(id=org_id).update(description=description)

        return Result.success(org)

    def archive(self, org_id: UUID) -> Result[Organization, Exception]:
        org_repo = OrganizationRepository()
        org = org_repo.get_by_id(org_id)
        if not org:
            return Result.failure(NotFoundError(f"Organization {org_id} not found"))

        org.archive()
        org = org_repo.save(org)
        return Result.success(org)

    def list_for_user(self, user_id: UUID) -> list[dict]:
        memberships = MembershipRepository().list_by_user(user_id)
        org_repo = OrganizationRepository()
        result = []
        for m in memberships:
            org = org_repo.get_by_id(m.organization_id)
            if org:
                result.append({
                    "id": str(org.id),
                    "name": org.name,
                    "slug": org.slug,
                    "status": org.status.value,
                    "role": m.role.value,
                })
        return result


class MembershipService:
    def invite(self, cmd: InviteMemberCommand) -> Result[dict, Exception]:
        membership_repo = MembershipRepository()
        inviter_membership = membership_repo.get_by_user_and_org(cmd.invited_by_user_id, cmd.organization_id)
        if not inviter_membership or inviter_membership.role not in (MembershipRole.ADMIN, MembershipRole.OWNER):
            return Result.failure(PermissionDeniedError("Only ADMIN or OWNER can invite members"))

        from apps.identity.infrastructure.models import User as UserModel
        try:
            invitee = UserModel.objects.get(email=cmd.invitee_email)
        except UserModel.DoesNotExist:
            return Result.failure(NotFoundError(f"User with email '{cmd.invitee_email}' not found"))

        existing = membership_repo.get_by_user_and_org(invitee.id, cmd.organization_id)
        if existing:
            if existing.status == MembershipStatus.ACTIVE:
                return Result.failure(ConflictError("User is already a member of this organization"))
            if existing.status == MembershipStatus.INVITED:
                return Result.failure(ConflictError("User has already been invited to this organization"))

        role_name = cmd.role
        if role_name.lower() == "owner":
            legacy_role = MembershipRole.OWNER
        elif role_name.lower() == "admin":
            legacy_role = MembershipRole.ADMIN
        else:
            legacy_role = MembershipRole.MEMBER

        membership = Membership(
            user_id=invitee.id,
            organization_id=cmd.organization_id,
            role=legacy_role,
            status=MembershipStatus.INVITED,
            invited_by=cmd.invited_by_user_id,
        )
        membership = membership_repo.save(membership)

        try:
            rbac_role = RoleModel.objects.get(organization_id=cmd.organization_id, name__iexact=role_name)
            from apps.rbac.application.services import RbacService
            RbacService().assign_role(role_id=rbac_role.id, membership_id=membership.id, organization_id=cmd.organization_id)
        except (RoleModel.DoesNotExist, Exception):
            pass

        try:
            from apps.organization.application.notifications import send_invite_email
            from apps.organization.infrastructure.models import OrganizationModel
            inviter = UserModel.objects.get(id=cmd.invited_by_user_id)
            org = OrganizationModel.objects.get(id=cmd.organization_id)
            send_invite_email(
                invitee_email=cmd.invitee_email,
                inviter_name=f"{inviter.first_name} {inviter.last_name}",
                org_name=org.name,
                membership_id=str(membership.id),
            )
        except Exception:
            pass

        return Result.success({
            "id": str(membership.id),
            "user_id": str(membership.user_id),
            "organization_id": str(membership.organization_id),
            "role": membership.role.value,
            "status": membership.status.value,
        })

    def accept_invite(self, membership_id: UUID, user_id: UUID) -> Result[Membership, Exception]:
        membership_repo = MembershipRepository()
        membership = membership_repo.get_by_id(membership_id)
        if not membership:
            return Result.failure(NotFoundError(f"Membership {membership_id} not found"))
        if membership.user_id != user_id:
            return Result.failure(PermissionDeniedError("This invitation is not for you"))

        membership.activate()
        membership = membership_repo.save(membership)

        from apps.rbac.application.services import RbacService
        RbacService().ensure_member_role(membership.id, membership.organization_id)

        return Result.success(membership)

    def list_members(self, org_id: UUID) -> list[dict]:
        memberships = MembershipRepository().list_by_organization(org_id)
        result = []
        from apps.identity.infrastructure.models import User as UserModel
        user_ids = [str(m.user_id) for m in memberships]
        users = {str(u.id): u for u in UserModel.objects.filter(id__in=user_ids)}

        from apps.organization.infrastructure.models import MembershipModel
        membership_models = {
            str(m.id): m for m in MembershipModel.objects.filter(organization_id=org_id)
        }

        from apps.rbac.models import MembershipRoleAssignmentModel, RoleModel
        assignment_qs = MembershipRoleAssignmentModel.objects.filter(
            membership__organization_id=org_id
        ).select_related("role")
        member_roles: dict[str, list[str]] = {}
        for a in assignment_qs:
            member_roles.setdefault(str(a.membership_id), []).append(a.role.name)

        for m in memberships:
            user = users.get(str(m.user_id), None)
            model = membership_models.get(str(m.id), None)
            result.append({
                "id": str(m.id),
                "user_id": str(m.user_id),
                "email": user.email if user else "",
                "first_name": user.first_name if user else "",
                "last_name": user.last_name if user else "",
                "role": m.role.value,
                "rbac_roles": member_roles.get(str(m.id), []),
                "status": m.status.value,
                "created_at": model.created_at.isoformat() if model else None,
            })
        return result

    def change_role(self, membership_id: UUID, new_role: str, requested_by_user_id: UUID) -> Result[Membership, Exception]:
        membership_repo = MembershipRepository()
        membership = membership_repo.get_by_id(membership_id)
        if not membership:
            return Result.failure(NotFoundError(f"Membership {membership_id} not found"))

        requester = membership_repo.get_by_user_and_org(requested_by_user_id, membership.organization_id)
        if not requester or requester.role not in (MembershipRole.ADMIN, MembershipRole.OWNER):
            return Result.failure(PermissionDeniedError("Only ADMIN or OWNER can change roles"))

        if membership.role == MembershipRole.OWNER:
            return Result.failure(ValidationError("Cannot change the role of the organization owner"))

        role_name = new_role
        if role_name.lower() == "owner":
            legacy_role = MembershipRole.OWNER
        elif role_name.lower() == "admin":
            legacy_role = MembershipRole.ADMIN
        else:
            legacy_role = MembershipRole.MEMBER

        membership.change_role(legacy_role)
        membership = membership_repo.save(membership)

        try:
            rbac_role = RoleModel.objects.get(organization_id=membership.organization_id, name__iexact=role_name)
            from apps.rbac.application.services import RbacService
            RbacService().assign_role(role_id=rbac_role.id, membership_id=membership.id, organization_id=membership.organization_id)
        except (RoleModel.DoesNotExist, Exception):
            pass

        return Result.success(membership)

    def remove_member(self, membership_id: UUID, requested_by_user_id: UUID) -> Result[None, Exception]:
        membership_repo = MembershipRepository()
        membership = membership_repo.get_by_id(membership_id)
        if not membership:
            return Result.failure(NotFoundError(f"Membership {membership_id} not found"))

        if membership.role == MembershipRole.OWNER:
            return Result.failure(ValidationError("Cannot remove the organization owner"))

        requester = membership_repo.get_by_user_and_org(requested_by_user_id, membership.organization_id)
        if not requester or requester.role not in (MembershipRole.ADMIN, MembershipRole.OWNER):
            return Result.failure(PermissionDeniedError("Only ADMIN or OWNER can remove members"))

        membership_repo.delete(membership)
        return Result.success(membership_id)
