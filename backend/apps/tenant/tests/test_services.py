from uuid import UUID

from django.test import TestCase

from apps.tenant.application.services import ProvisionTenantCommand, TenantService
from apps.tenant.infrastructure.models import TenantModel
from apps.shared_kernel.domain.errors import ConflictError, NotFoundError, ValidationError


def _uuid(i: int) -> UUID:
    return UUID(f"00000000-0000-0000-0000-{i:012d}")


class TenantServiceTests(TestCase):
    def setUp(self):
        self.org_id = _uuid(1)
        self.service = TenantService()

    # ------------------------------------------------------------------
    # provision
    # ------------------------------------------------------------------

    def test_provision_creates_tenant(self):
        result = self.service.provision(ProvisionTenantCommand(organization_id=self.org_id))
        self.assertTrue(result.is_success)
        self.assertEqual(result.value.organization_id, self.org_id)
        self.assertEqual(result.value.plan, "free")
        self.assertTrue(result.value.is_active)

    def test_provision_custom_plan(self):
        result = self.service.provision(ProvisionTenantCommand(organization_id=_uuid(2), plan="professional"))
        self.assertTrue(result.is_success)
        self.assertEqual(result.value.plan, "professional")

    def test_provision_duplicate_raises(self):
        self.service.provision(ProvisionTenantCommand(organization_id=self.org_id))
        result = self.service.provision(ProvisionTenantCommand(organization_id=self.org_id))
        self.assertTrue(result.is_failure)
        self.assertIsInstance(result.error, ConflictError)

    def test_provision_creates_tenant_model(self):
        self.service.provision(ProvisionTenantCommand(organization_id=self.org_id))
        self.assertTrue(TenantModel.objects.filter(organization_id=self.org_id).exists())

    # ------------------------------------------------------------------
    # get_by_org
    # ------------------------------------------------------------------

    def test_get_by_org_returns_tenant(self):
        self.service.provision(ProvisionTenantCommand(organization_id=self.org_id))
        result = self.service.get_by_org(self.org_id)
        self.assertTrue(result.is_success)
        self.assertEqual(result.value.organization_id, self.org_id)

    def test_get_by_org_not_found_raises(self):
        result = self.service.get_by_org(_uuid(99))
        self.assertTrue(result.is_failure)
        self.assertIsInstance(result.error, NotFoundError)

    # ------------------------------------------------------------------
    # change_plan
    # ------------------------------------------------------------------

    def test_change_plan_updates_plan(self):
        result = self.service.provision(ProvisionTenantCommand(organization_id=self.org_id))
        tenant_id = result.value.id
        result2 = self.service.change_plan(tenant_id, "professional")
        self.assertTrue(result2.is_success)
        self.assertEqual(result2.value.plan, "professional")

    def test_change_plan_invalid_raises(self):
        result = self.service.provision(ProvisionTenantCommand(organization_id=self.org_id))
        with self.assertRaises(ValidationError):
            self.service.change_plan(result.value.id, "invalid")

    def test_change_plan_not_found_raises(self):
        result = self.service.change_plan(_uuid(99), "professional")
        self.assertTrue(result.is_failure)
        self.assertIsInstance(result.error, NotFoundError)

    # ------------------------------------------------------------------
    # suspend / activate
    # ------------------------------------------------------------------

    def test_suspend_changes_status(self):
        self.service.provision(ProvisionTenantCommand(organization_id=self.org_id))
        result = self.service.suspend(self.org_id, "non-payment")
        self.assertTrue(result.is_success)
        self.assertFalse(result.value.is_active)
        self.assertEqual(result.value.status.value, "SUSPENDED")

    def test_suspend_not_found_raises(self):
        result = self.service.suspend(_uuid(99), "reason")
        self.assertTrue(result.is_failure)
        self.assertIsInstance(result.error, NotFoundError)

    def test_activate_reactivates_suspended(self):
        self.service.provision(ProvisionTenantCommand(organization_id=self.org_id))
        self.service.suspend(self.org_id, "non-payment")
        result = self.service.activate(self.org_id)
        self.assertTrue(result.is_success)
        self.assertTrue(result.value.is_active)

    def test_activate_not_found_raises(self):
        result = self.service.activate(_uuid(99))
        self.assertTrue(result.is_failure)
        self.assertIsInstance(result.error, NotFoundError)

    # ------------------------------------------------------------------
    # domain entity invariants
    # ------------------------------------------------------------------

    def test_domain_suspend_disabled_raises(self):
        from apps.tenant.domain.entities import Tenant, TenantStatus
        tenant = Tenant(organization_id=self.org_id, status=TenantStatus.DISABLED)
        with self.assertRaises(ValidationError):
            tenant.suspend("reason")

    def test_domain_activate_active_raises(self):
        from apps.tenant.domain.entities import Tenant
        tenant = Tenant(organization_id=self.org_id)
        with self.assertRaises(ValidationError):
            tenant.activate()

    def test_domain_activate_disabled_raises(self):
        from apps.tenant.domain.entities import Tenant, TenantStatus
        tenant = Tenant(organization_id=self.org_id, status=TenantStatus.DISABLED)
        with self.assertRaises(ValidationError):
            tenant.activate()
