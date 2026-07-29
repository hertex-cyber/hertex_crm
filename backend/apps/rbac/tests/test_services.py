from uuid import UUID

from django.test import TestCase

from apps.organization.infrastructure.models import MembershipModel, OrganizationModel
from apps.rbac.application.services import RbacService
from apps.rbac.models import PermissionModel, RoleModel
from apps.shared_kernel.domain.errors import NotFoundError, PermissionDeniedError, ValidationError


def _uuid(i: int) -> UUID:
    return UUID(f"00000000-0000-0000-0000-{i:012d}")


class RbacServiceTests(TestCase):
    def setUp(self):
        self.org = OrganizationModel.objects.create(name="Acme", slug="acme")
        self.owner = MembershipModel.objects.create(
            user_id=_uuid(1), organization=self.org, role="OWNER"
        )
        self.admin = MembershipModel.objects.create(
            user_id=_uuid(2), organization=self.org, role="ADMIN"
        )
        self.member = MembershipModel.objects.create(
            user_id=_uuid(3), organization=self.org, role="MEMBER"
        )
        self.inactive = MembershipModel.objects.create(
            user_id=_uuid(4), organization=self.org, role="MEMBER", status="INVITED"
        )
        self.service = RbacService()
        self.service.bootstrap_organization(self.org.id)

    # ------------------------------------------------------------------
    # Bootstrap
    # ------------------------------------------------------------------

    def test_bootstrap_creates_three_system_roles(self):
        roles = RoleModel.objects.filter(organization_id=self.org.id)
        self.assertEqual({r.name for r in roles}, {"Owner", "Admin", "Member"})
        for role in roles:
            self.assertTrue(role.is_system)

    def test_bootstrap_owner_has_all_permissions(self):
        perms = self.service.permissions_for(self.owner.user_id, self.org.id)
        all_codes = set(PermissionModel.objects.values_list("code", flat=True))
        self.assertEqual(perms, all_codes)

    def test_bootstrap_admin_has_all_permissions(self):
        perms = self.service.permissions_for(self.admin.user_id, self.org.id)
        all_codes = set(PermissionModel.objects.values_list("code", flat=True))
        self.assertEqual(perms, all_codes)

    def test_bootstrap_member_has_base_permissions(self):
        perms = self.service.permissions_for(self.member.user_id, self.org.id)
        expected = {
            "lead.view", "lead.create", "lead.update",
            "contact.view", "contact.manage",
            "opportunity.view", "opportunity.manage",
            "activity.manage", "report.view",
        }
        self.assertEqual(perms, expected)

    def test_bootstrap_creates_role_assignments(self):
        owner_assignments = self.owner.role_assignments.all()
        self.assertEqual(owner_assignments.count(), 1)
        self.assertEqual(owner_assignments.first().role.name, "Owner")

    def test_bootstrap_is_idempotent(self):
        self.service.bootstrap_organization(self.org.id)
        self.service.bootstrap_organization(self.org.id)
        roles = RoleModel.objects.filter(organization_id=self.org.id)
        self.assertEqual(roles.count(), 3)

    # ------------------------------------------------------------------
    # Membership helpers
    # ------------------------------------------------------------------

    def test_verify_membership_active_returns_membership(self):
        m = self.service.verify_membership(self.member.user_id, self.org.id)
        self.assertEqual(m.id, self.member.id)

    def test_verify_membership_inactive_raises(self):
        with self.assertRaises(PermissionDeniedError):
            self.service.verify_membership(self.inactive.user_id, self.org.id)

    def test_verify_membership_wrong_org_raises(self):
        other_org = OrganizationModel.objects.create(name="Other", slug="other")
        with self.assertRaises(PermissionDeniedError):
            self.service.verify_membership(self.member.user_id, other_org.id)

    def test_is_admin_owner_true(self):
        self.assertTrue(self.service.is_admin(self.owner.user_id, self.org.id))

    def test_is_admin_admin_true(self):
        self.assertTrue(self.service.is_admin(self.admin.user_id, self.org.id))

    def test_is_admin_member_false(self):
        self.assertFalse(self.service.is_admin(self.member.user_id, self.org.id))

    def test_require_admin_member_raises(self):
        with self.assertRaises(PermissionDeniedError):
            self.service.require_admin(self.member.user_id, self.org.id)

    # ------------------------------------------------------------------
    # Role CRUD
    # ------------------------------------------------------------------

    def test_list_roles_lists_all_roles(self):
        roles = self.service.list_roles(self.org.id)
        self.assertEqual({r.name for r in roles}, {"Owner", "Admin", "Member"})

    def test_list_roles_includes_member_count(self):
        roles = self.service.list_roles(self.org.id)
        for role in roles:
            self.assertIsNotNone(getattr(role, "member_count", None))
            self.assertGreaterEqual(role.member_count, 0)

    def test_list_roles_does_not_call_bootstrap_again(self):
        """list_roles should not re-create roles or assignments."""
        self.service.list_roles(self.org.id)
        roles = RoleModel.objects.filter(organization_id=self.org.id)
        self.assertEqual(roles.count(), 3)

    def test_create_custom_role(self):
        role = self.service.create_role(self.org.id, "Sales Viewer", "Read-only", ["lead.view", "lead.create"])
        self.assertEqual(role.name, "Sales Viewer")
        self.assertFalse(role.is_system)
        self.assertEqual(set(role.permissions.values_list("code", flat=True)), {"lead.view", "lead.create"})

    def test_create_role_system_name_raises(self):
        for name in ("Owner", "Admin", "Member"):
            with self.subTest(name=name):
                with self.assertRaises(ValidationError):
                    self.service.create_role(self.org.id, name, "", [])

    def test_create_role_invalid_permission_codes_raises(self):
        with self.assertRaises(ValidationError):
            self.service.create_role(self.org.id, "Custom", "", ["nonexistent.code"])

    def test_update_role(self):
        role = self.service.create_role(self.org.id, "Custom", "desc", ["lead.view"])
        updated = self.service.update_role(role.id, self.org.id, "Updated", "new desc", ["lead.view", "lead.create"])
        self.assertEqual(updated.name, "Updated")
        self.assertEqual(set(updated.permissions.values_list("code", flat=True)), {"lead.view", "lead.create"})

    def test_update_role_system_name_change_raises(self):
        owner_role = RoleModel.objects.get(organization_id=self.org.id, name="Owner")
        with self.assertRaises(ValidationError):
            self.service.update_role(owner_role.id, self.org.id, "SuperAdmin", None, None)

    def test_update_role_not_found_raises(self):
        with self.assertRaises(NotFoundError):
            self.service.update_role(_uuid(99), self.org.id, "Name", None, None)

    def test_delete_custom_role(self):
        role = self.service.create_role(self.org.id, "Temp", "", ["lead.view"])
        self.service.delete_role(role.id, self.org.id)
        self.assertFalse(RoleModel.objects.filter(id=role.id).exists())

    def test_delete_system_role_raises(self):
        for name in ("Owner", "Admin", "Member"):
            with self.subTest(name=name):
                role = RoleModel.objects.get(organization_id=self.org.id, name=name)
                with self.assertRaises(ValidationError):
                    self.service.delete_role(role.id, self.org.id)

    def test_delete_nonexistent_role_raises(self):
        with self.assertRaises(NotFoundError):
            self.service.delete_role(_uuid(99), self.org.id)

    # ------------------------------------------------------------------
    # Role assignments
    # ------------------------------------------------------------------

    def test_assign_role_to_member(self):
        role = self.service.create_role(self.org.id, "Sales Viewer", "", ["lead.view"])
        assignment = self.service.assign_role(role.id, self.member.id, self.org.id)
        self.assertEqual(assignment.role_id, role.id)
        self.assertEqual(assignment.membership_id, self.member.id)

    def test_assign_role_grants_permission(self):
        role = self.service.create_role(self.org.id, "Sales Viewer", "", ["lead.view"])
        self.service.assign_role(role.id, self.member.id, self.org.id)
        self.assertTrue(self.service.has_permission(self.member.user_id, self.org.id, "lead.view"))

    def test_unassign_role_revokes_permission(self):
        role = self.service.create_role(self.org.id, "Delete Manager", "", ["lead.delete"])
        self.service.assign_role(role.id, self.member.id, self.org.id)
        self.assertTrue(self.service.has_permission(self.member.user_id, self.org.id, "lead.delete"))
        self.service.unassign_role(role.id, self.member.id, self.org.id)
        self.assertFalse(self.service.has_permission(self.member.user_id, self.org.id, "lead.delete"))

    def test_assign_role_duplicate_is_idempotent(self):
        role = self.service.create_role(self.org.id, "Sales Viewer", "", ["lead.view"])
        a1 = self.service.assign_role(role.id, self.member.id, self.org.id)
        a2 = self.service.assign_role(role.id, self.member.id, self.org.id)
        self.assertEqual(a1.id, a2.id)

    def test_assign_role_wrong_org_raises(self):
        other_org = OrganizationModel.objects.create(name="Other", slug="other")
        other_role = self.service.create_role(other_org.id, "Viewer", "", ["lead.view"])
        with self.assertRaises(NotFoundError):
            self.service.assign_role(other_role.id, self.member.id, self.org.id)

    # ------------------------------------------------------------------
    # Permission checks
    # ------------------------------------------------------------------

    def test_has_permission_true(self):
        self.assertTrue(self.service.has_permission(self.owner.user_id, self.org.id, "lead.view"))

    def test_has_permission_false(self):
        self.assertFalse(self.service.has_permission(self.member.user_id, self.org.id, "lead.delete"))

    def test_has_permission_inactive_member_raises(self):
        with self.assertRaises(PermissionDeniedError):
            self.service.has_permission(self.inactive.user_id, self.org.id, "lead.view")

    # ------------------------------------------------------------------
    # ensure_member_role
    # ------------------------------------------------------------------

    def test_ensure_member_role_assigns_member_role(self):
        new_member = MembershipModel.objects.create(
            user_id=_uuid(5), organization=self.org, role="MEMBER"
        )
        self.service.ensure_member_role(new_member.id, self.org.id)
        self.assertTrue(self.service.has_permission(new_member.user_id, self.org.id, "lead.view"))
        self.assertFalse(self.service.has_permission(new_member.user_id, self.org.id, "lead.delete"))

    def test_ensure_member_role_idempotent(self):
        new_member = MembershipModel.objects.create(
            user_id=_uuid(6), organization=self.org, role="MEMBER"
        )
        self.service.ensure_member_role(new_member.id, self.org.id)
        self.service.ensure_member_role(new_member.id, self.org.id)
        assignments = new_member.role_assignments.filter(role__name="Member")
        self.assertEqual(assignments.count(), 1)
