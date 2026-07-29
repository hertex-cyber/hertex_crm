from uuid import UUID

from django.test import TestCase

from apps.identity.infrastructure.models import User as UserModel
from apps.organization.application.services import InviteMemberCommand, MembershipService, OrgService, CreateOrgCommand
from apps.organization.infrastructure.models import MembershipModel, OrganizationModel
from apps.shared_kernel.domain.errors import ConflictError, NotFoundError, PermissionDeniedError, ValidationError


def _uuid(i: int) -> UUID:
    return UUID(f"00000000-0000-0000-0000-{i:012d}")


class OrgServiceTests(TestCase):
    def setUp(self):
        self.svc = OrgService()

    def test_create_org_creates_organization_and_owner_membership(self):
        cmd = CreateOrgCommand(name="Test Org", slug="test-org", owner_id=_uuid(1))
        result = self.svc.create(cmd)
        self.assertTrue(result.is_success)
        org = OrganizationModel.objects.get(slug="test-org")
        self.assertEqual(org.name, "Test Org")
        owner = MembershipModel.objects.get(organization=org, user_id=_uuid(1))
        self.assertEqual(owner.role, "OWNER")
        self.assertEqual(owner.status, "ACTIVE")

    def test_create_org_duplicate_slug_raises(self):
        OrganizationModel.objects.create(name="Existing", slug="dup")
        cmd = CreateOrgCommand(name="Test", slug="dup", owner_id=_uuid(2))
        result = self.svc.create(cmd)
        self.assertTrue(result.is_failure)
        self.assertIsInstance(result.error, ConflictError)

    def test_create_org_bootstraps_rbac_roles(self):
        cmd = CreateOrgCommand(name="RBAC Org", slug="rbac-org", owner_id=_uuid(10))
        result = self.svc.create(cmd)
        self.assertTrue(result.is_success)
        org = OrganizationModel.objects.get(slug="rbac-org")
        from apps.rbac.models import RoleModel
        roles = RoleModel.objects.filter(organization_id=org.id)
        self.assertEqual({r.name for r in roles}, {"Owner", "Admin", "Member"})

    def test_create_org_assigns_owner_rbac_role(self):
        cmd = CreateOrgCommand(name="Owner RBAC", slug="owner-rbac", owner_id=_uuid(11))
        result = self.svc.create(cmd)
        self.assertTrue(result.is_success)
        org = OrganizationModel.objects.get(slug="owner-rbac")
        membership = MembershipModel.objects.get(organization=org, user_id=_uuid(11))
        assignments = membership.role_assignments.all()
        self.assertEqual(assignments.count(), 1)
        self.assertEqual(assignments.first().role.name, "Owner")


class MembershipServiceTests(TestCase):
    def setUp(self):
        self.org = OrganizationModel.objects.create(name="Acme", slug="acme-mem")
        self.owner = MembershipModel.objects.create(
            user_id=_uuid(1), organization=self.org, role="OWNER"
        )
        self.admin = MembershipModel.objects.create(
            user_id=_uuid(2), organization=self.org, role="ADMIN"
        )
        self.member = MembershipModel.objects.create(
            user_id=_uuid(3), organization=self.org, role="MEMBER"
        )
        self.invitee_user = UserModel.objects.create(
            id=_uuid(5), email="invitee@test.com", first_name="Invitee", last_name="User",
        )
        self.invitee_user2 = UserModel.objects.create(
            id=_uuid(6), email="invitee2@test.com", first_name="Invitee2", last_name="User",
        )
        self.svc = MembershipService()
        from apps.rbac.application.services import RbacService
        RbacService().bootstrap_organization(self.org.id)

    # ------------------------------------------------------------------
    # invite
    # ------------------------------------------------------------------

    def test_invite_creates_invited_membership(self):
        cmd = InviteMemberCommand(
            organization_id=self.org.id,
            invited_by_user_id=_uuid(1),
            invitee_email="invitee@test.com",
            role="Admin",
        )
        result = self.svc.invite(cmd)
        self.assertTrue(result.is_success)
        self.assertEqual(result.value["role"], "ADMIN")
        self.assertEqual(result.value["status"], "INVITED")

    def test_invite_assigns_rbac_role(self):
        cmd = InviteMemberCommand(
            organization_id=self.org.id,
            invited_by_user_id=_uuid(1),
            invitee_email="invitee@test.com",
            role="Admin",
        )
        result = self.svc.invite(cmd)
        self.assertTrue(result.is_success)
        membership = MembershipModel.objects.get(id=result.value["id"])
        assignments = membership.role_assignments.all()
        self.assertEqual(assignments.count(), 1)
        self.assertEqual(assignments.first().role.name, "Admin")

    def test_invite_custom_role(self):
        from apps.rbac.models import RoleModel
        custom_role = RoleModel.objects.create(
            organization=self.org, name="Manager", is_system=False,
        )
        cmd = InviteMemberCommand(
            organization_id=self.org.id,
            invited_by_user_id=_uuid(1),
            invitee_email="invitee2@test.com",
            role="Manager",
        )
        result = self.svc.invite(cmd)
        self.assertTrue(result.is_success)
        membership = MembershipModel.objects.get(id=result.value["id"])
        assignments = membership.role_assignments.all()
        self.assertEqual(assignments.count(), 1)
        self.assertEqual(assignments.first().role.name, "Manager")

    def test_invite_non_admin_raises(self):
        cmd = InviteMemberCommand(
            organization_id=self.org.id,
            invited_by_user_id=_uuid(3),  # MEMBER, not admin
            invitee_email="invitee@test.com",
            role="Member",
        )
        result = self.svc.invite(cmd)
        self.assertTrue(result.is_failure)
        self.assertIsInstance(result.error, PermissionDeniedError)

    def test_invite_unknown_user_raises(self):
        cmd = InviteMemberCommand(
            organization_id=self.org.id,
            invited_by_user_id=_uuid(1),
            invitee_email="ghost@test.com",
            role="Member",
        )
        result = self.svc.invite(cmd)
        self.assertTrue(result.is_failure)
        self.assertIsInstance(result.error, NotFoundError)

    def test_invite_existing_active_member_raises(self):
        MembershipModel.objects.create(
            user_id=_uuid(5), organization=self.org, role="MEMBER"
        )
        cmd = InviteMemberCommand(
            organization_id=self.org.id,
            invited_by_user_id=_uuid(1),
            invitee_email="invitee@test.com",
            role="Member",
        )
        result = self.svc.invite(cmd)
        self.assertTrue(result.is_failure)
        self.assertIsInstance(result.error, ConflictError)

    def test_invite_existing_invited_raises(self):
        MembershipModel.objects.create(
            user_id=_uuid(5), organization=self.org, role="MEMBER", status="INVITED"
        )
        cmd = InviteMemberCommand(
            organization_id=self.org.id,
            invited_by_user_id=_uuid(1),
            invitee_email="invitee@test.com",
            role="Member",
        )
        result = self.svc.invite(cmd)
        self.assertTrue(result.is_failure)
        self.assertIsInstance(result.error, ConflictError)

    # ------------------------------------------------------------------
    # accept_invite
    # ------------------------------------------------------------------

    def test_accept_invite_activates_membership(self):
        membership = MembershipModel.objects.create(
            user_id=_uuid(5), organization=self.org, role="MEMBER", status="INVITED"
        )
        result = self.svc.accept_invite(membership.id, _uuid(5))
        self.assertTrue(result.is_success)
        membership.refresh_from_db()
        self.assertEqual(membership.status, "ACTIVE")

    def test_accept_invite_ensures_rbac_role(self):
        membership = MembershipModel.objects.create(
            user_id=_uuid(5), organization=self.org, role="MEMBER", status="INVITED"
        )
        self.svc.accept_invite(membership.id, _uuid(5))
        assignments = membership.role_assignments.all()
        self.assertGreaterEqual(assignments.count(), 1)

    def test_accept_invite_wrong_user_raises(self):
        membership = MembershipModel.objects.create(
            user_id=_uuid(5), organization=self.org, role="MEMBER", status="INVITED"
        )
        result = self.svc.accept_invite(membership.id, _uuid(99))
        self.assertTrue(result.is_failure)
        self.assertIsInstance(result.error, PermissionDeniedError)

    def test_accept_invite_not_found_raises(self):
        result = self.svc.accept_invite(_uuid(9999), _uuid(5))
        self.assertTrue(result.is_failure)
        self.assertIsInstance(result.error, NotFoundError)

    # ------------------------------------------------------------------
    # change_role
    # ------------------------------------------------------------------

    def test_change_role_updates_legacy_role(self):
        cmd = InviteMemberCommand(
            organization_id=self.org.id,
            invited_by_user_id=_uuid(1),
            invitee_email="invitee@test.com",
            role="Member",
        )
        invite_result = self.svc.invite(cmd)
        membership_id = UUID(invite_result.value["id"])
        result = self.svc.change_role(membership_id, "Admin", _uuid(1))
        self.assertTrue(result.is_success)
        self.assertEqual(result.value.role.value, "ADMIN")

    def test_change_role_assigns_rbac_role(self):
        cmd = InviteMemberCommand(
            organization_id=self.org.id,
            invited_by_user_id=_uuid(1),
            invitee_email="invitee@test.com",
            role="Member",
        )
        invite_result = self.svc.invite(cmd)
        membership_id = UUID(invite_result.value["id"])
        self.svc.change_role(membership_id, "Admin", _uuid(1))
        membership = MembershipModel.objects.get(id=membership_id)
        role_names = [a.role.name for a in membership.role_assignments.all()]
        self.assertIn("Admin", role_names)

    def test_change_role_non_admin_raises(self):
        cmd = InviteMemberCommand(
            organization_id=self.org.id,
            invited_by_user_id=_uuid(1),
            invitee_email="invitee@test.com",
            role="Member",
        )
        invite_result = self.svc.invite(cmd)
        membership_id = UUID(invite_result.value["id"])
        result = self.svc.change_role(membership_id, "Admin", _uuid(3))
        self.assertTrue(result.is_failure)
        self.assertIsInstance(result.error, PermissionDeniedError)

    def test_change_role_owner_raises(self):
        result = self.svc.change_role(self.owner.id, "MEMBER", _uuid(1))
        self.assertTrue(result.is_failure)
        self.assertIsInstance(result.error, ValidationError)

    # ------------------------------------------------------------------
    # remove_member
    # ------------------------------------------------------------------

    def test_remove_member_deletes_membership(self):
        cmd = InviteMemberCommand(
            organization_id=self.org.id,
            invited_by_user_id=_uuid(1),
            invitee_email="invitee@test.com",
            role="Member",
        )
        invite_result = self.svc.invite(cmd)
        membership_id = UUID(invite_result.value["id"])
        result = self.svc.remove_member(membership_id, _uuid(1))
        self.assertTrue(result.is_success)
        self.assertIsNone(MembershipModel.objects.filter(id=membership_id).first())

    def test_remove_member_owner_raises(self):
        result = self.svc.remove_member(self.owner.id, _uuid(1))
        self.assertTrue(result.is_failure)
        self.assertIsInstance(result.error, ValidationError)

    # ------------------------------------------------------------------
    # list_members
    # ------------------------------------------------------------------

    def test_list_members_returns_rbac_roles(self):
        members = self.svc.list_members(self.org.id)
        for m in members:
            self.assertIn("rbac_roles", m)
        owner_entry = next(m for m in members if m["role"] == "OWNER")
        self.assertIn("Owner", owner_entry["rbac_roles"])
