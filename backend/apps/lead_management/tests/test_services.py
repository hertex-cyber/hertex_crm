from uuid import UUID

from django.test import TestCase

from apps.lead_management.application.services import LeadService
from apps.lead_management.domain.value_objects import LeadSource, LeadStatus
from apps.lead_management.models import LeadModel
from apps.organization.infrastructure.models import MembershipModel, OrganizationModel
from apps.rbac.models import PermissionModel
from apps.shared_kernel.domain.errors import NotFoundError, ValidationError


def _uuid(i: int) -> UUID:
    return UUID(f"00000000-0000-0000-0000-{i:012d}")


def _create_lead(service, org_id, **overrides):
    data = {
        "organization_id": org_id,
        "first_name": "John",
        "last_name": "Doe",
        "email": "john@example.com",
        "phone": "+1234567890",
        "company": "Acme Corp",
        "title": "Engineer",
        "source": "WEB_FORM",
        "notes": "Test lead",
    }
    data.update(overrides)
    return service.create_lead(**data)


class LeadValueObjectsTests(TestCase):
    def test_lead_status_enum_values(self):
        self.assertEqual(LeadStatus.NEW.value, "NEW")
        self.assertEqual(LeadStatus.CONTACTED.value, "CONTACTED")
        self.assertEqual(LeadStatus.QUALIFIED.value, "QUALIFIED")
        self.assertEqual(LeadStatus.CONVERTED.value, "CONVERTED")
        self.assertEqual(LeadStatus.DISQUALIFIED.value, "DISQUALIFIED")
        self.assertEqual(LeadStatus.RECYCLED.value, "RECYCLED")

    def test_lead_status_valid_transitions(self):
        self.assertTrue(LeadStatus.NEW.can_transition_to(LeadStatus.CONTACTED))
        self.assertTrue(LeadStatus.NEW.can_transition_to(LeadStatus.DISQUALIFIED))
        self.assertFalse(LeadStatus.NEW.can_transition_to(LeadStatus.QUALIFIED))
        self.assertFalse(LeadStatus.NEW.can_transition_to(LeadStatus.CONVERTED))
        self.assertTrue(LeadStatus.CONTACTED.can_transition_to(LeadStatus.QUALIFIED))
        self.assertTrue(LeadStatus.CONTACTED.can_transition_to(LeadStatus.DISQUALIFIED))
        self.assertFalse(LeadStatus.CONTACTED.can_transition_to(LeadStatus.NEW))
        self.assertTrue(LeadStatus.QUALIFIED.can_transition_to(LeadStatus.CONVERTED))
        self.assertTrue(LeadStatus.QUALIFIED.can_transition_to(LeadStatus.DISQUALIFIED))
        self.assertFalse(LeadStatus.CONVERTED.can_transition_to(LeadStatus.NEW))
        self.assertTrue(LeadStatus.DISQUALIFIED.can_transition_to(LeadStatus.RECYCLED))
        self.assertTrue(LeadStatus.DISQUALIFIED.can_transition_to(LeadStatus.NEW))
        self.assertTrue(LeadStatus.RECYCLED.can_transition_to(LeadStatus.CONTACTED))
        self.assertTrue(LeadStatus.RECYCLED.can_transition_to(LeadStatus.QUALIFIED))

    def test_lead_source_enum_values(self):
        self.assertEqual(LeadSource.WEB_FORM.value, "WEB_FORM")
        self.assertEqual(LeadSource.REFERRAL.value, "REFERRAL")
        self.assertEqual(LeadSource.COLD_CALL.value, "COLD_CALL")
        self.assertEqual(LeadSource.EMAIL.value, "EMAIL")
        self.assertEqual(LeadSource.SOCIAL_MEDIA.value, "SOCIAL_MEDIA")
        self.assertEqual(LeadSource.PARTNER.value, "PARTNER")
        self.assertEqual(LeadSource.OTHER.value, "OTHER")

    def test_lead_rating_score_range(self):
        from apps.lead_management.domain.value_objects import LeadRating
        LeadRating(0)
        LeadRating(50)
        LeadRating(100)
        with self.assertRaises(ValueError):
            LeadRating(-1)
        with self.assertRaises(ValueError):
            LeadRating(101)

    def test_lead_rating_labels(self):
        from apps.lead_management.domain.value_objects import LeadRating
        self.assertEqual(LeadRating(100).label, "Hot")
        self.assertEqual(LeadRating(80).label, "Hot")
        self.assertEqual(LeadRating(79).label, "Warm")
        self.assertEqual(LeadRating(50).label, "Warm")
        self.assertEqual(LeadRating(49).label, "Cool")
        self.assertEqual(LeadRating(20).label, "Cool")
        self.assertEqual(LeadRating(19).label, "Cold")
        self.assertEqual(LeadRating(0).label, "Cold")


class LeadServiceTests(TestCase):
    def setUp(self):
        self.org = OrganizationModel.objects.create(name="Acme", slug="acme")
        self.owner = MembershipModel.objects.create(
            user_id=_uuid(1), organization=self.org, role="OWNER"
        )
        self.service = LeadService()

    # ------------------------------------------------------------------
    # Create
    # ------------------------------------------------------------------

    def test_create_lead_minimal(self):
        lead = self.service.create_lead(
            organization_id=self.org.id,
            first_name="Jane",
            last_name="Smith",
            email="jane@example.com",
        )
        self.assertEqual(lead["first_name"], "Jane")
        self.assertEqual(lead["last_name"], "Smith")
        self.assertEqual(lead["email"], "jane@example.com")
        self.assertEqual(lead["status"], "NEW")
        self.assertEqual(lead["source"], "OTHER")
        self.assertEqual(lead["score"], 0)

    def test_create_lead_full(self):
        lead = self.service.create_lead(
            organization_id=self.org.id,
            first_name="John",
            last_name="Doe",
            email="john@example.com",
            phone="+1234567890",
            company="Acme Corp",
            title="Engineer",
            source="WEB_FORM",
            notes="Test lead",
            owner_id=_uuid(10),
            assigned_to_id=_uuid(11),
        )
        self.assertEqual(lead["phone"], "+1234567890")
        self.assertEqual(lead["company"], "Acme Corp")
        self.assertEqual(lead["title"], "Engineer")
        self.assertEqual(lead["source"], "WEB_FORM")
        self.assertEqual(lead["assigned_to_id"], _uuid(11))

    def test_create_lead_duplicate_email_raises(self):
        self.service.create_lead(
            organization_id=self.org.id,
            first_name="John",
            last_name="Doe",
            email="dup@example.com",
        )
        with self.assertRaises(ValidationError):
            self.service.create_lead(
                organization_id=self.org.id,
                first_name="Jane",
                last_name="Smith",
                email="dup@example.com",
            )

    def test_create_lead_different_org_same_email_ok(self):
        org2 = OrganizationModel.objects.create(name="Other", slug="other")
        self.service.create_lead(
            organization_id=self.org.id,
            first_name="John",
            last_name="Doe",
            email="same@example.com",
        )
        lead2 = self.service.create_lead(
            organization_id=org2.id,
            first_name="Jane",
            last_name="Smith",
            email="same@example.com",
        )
        self.assertEqual(lead2["email"], "same@example.com")

    def test_create_lead_empty_names_raises(self):
        with self.assertRaises(ValidationError):
            self.service.create_lead(
                organization_id=self.org.id,
                first_name="",
                last_name="Doe",
                email="test@example.com",
            )

    def test_create_lead_invalid_email_raises(self):
        with self.assertRaises(ValidationError):
            self.service.create_lead(
                organization_id=self.org.id,
                first_name="John",
                last_name="Doe",
                email="not-an-email",
            )

    # ------------------------------------------------------------------
    # Get
    # ------------------------------------------------------------------

    def test_get_lead(self):
        created = _create_lead(self.service, self.org.id)
        fetched = self.service.get_lead(created["id"], self.org.id)
        self.assertEqual(fetched["id"], created["id"])
        self.assertEqual(fetched["email"], created["email"])

    def test_get_lead_not_found_raises(self):
        with self.assertRaises(NotFoundError):
            self.service.get_lead(_uuid(99), self.org.id)

    def test_get_lead_wrong_org_raises(self):
        org2 = OrganizationModel.objects.create(name="Other2", slug="other2")
        created = _create_lead(self.service, self.org.id)
        with self.assertRaises(NotFoundError):
            self.service.get_lead(created["id"], org2.id)

    # ------------------------------------------------------------------
    # Update
    # ------------------------------------------------------------------

    def test_update_lead(self):
        created = _create_lead(self.service, self.org.id)
        updated = self.service.update_lead(
            created["id"], self.org.id,
            first_name="Jane",
            company="New Corp",
        )
        self.assertEqual(updated["first_name"], "Jane")
        self.assertEqual(updated["company"], "New Corp")
        self.assertEqual(updated["email"], "john@example.com")

    def test_update_lead_duplicate_email_raises(self):
        l1 = _create_lead(self.service, self.org.id, email="first@example.com")
        _create_lead(self.service, self.org.id, email="second@example.com")
        with self.assertRaises(ValidationError):
            self.service.update_lead(l1["id"], self.org.id, email="second@example.com")

    def test_update_lead_same_email_ok(self):
        created = _create_lead(self.service, self.org.id, email="same@example.com")
        updated = self.service.update_lead(created["id"], self.org.id, email="same@example.com")
        self.assertEqual(updated["email"], "same@example.com")

    def test_update_lead_not_found_raises(self):
        with self.assertRaises(NotFoundError):
            self.service.update_lead(_uuid(99), self.org.id, first_name="John")

    # ------------------------------------------------------------------
    # Delete
    # ------------------------------------------------------------------

    def test_delete_lead(self):
        created = _create_lead(self.service, self.org.id)
        self.service.delete_lead(created["id"], self.org.id)
        self.assertFalse(LeadModel.objects.filter(id=created["id"]).exists())

    def test_delete_lead_not_found_raises(self):
        with self.assertRaises(NotFoundError):
            self.service.delete_lead(_uuid(99), self.org.id)

    # ------------------------------------------------------------------
    # List with filters
    # ------------------------------------------------------------------

    def test_list_leads_empty(self):
        leads = self.service.list_leads(self.org.id)
        self.assertEqual(leads, [])

    def test_list_leads_all(self):
        _create_lead(self.service, self.org.id, email="a@example.com")
        _create_lead(self.service, self.org.id, email="b@example.com", first_name="Jane")
        leads = self.service.list_leads(self.org.id)
        self.assertEqual(len(leads), 2)

    def test_list_leads_filter_by_status(self):
        _create_lead(self.service, self.org.id, email="a@example.com")
        l2 = _create_lead(self.service, self.org.id, email="b@example.com")
        self.service.change_status(l2["id"], self.org.id, "CONTACTED")
        leads = self.service.list_leads(self.org.id, status="CONTACTED")
        self.assertEqual(len(leads), 1)
        self.assertEqual(leads[0].email, "b@example.com")

    def test_list_leads_filter_by_source(self):
        _create_lead(self.service, self.org.id, email="a@example.com")
        _create_lead(self.service, self.org.id, email="b@example.com", source="REFERRAL")
        leads = self.service.list_leads(self.org.id, source="REFERRAL")
        self.assertEqual(len(leads), 1)

    def test_list_leads_filter_by_assigned(self):
        _create_lead(self.service, self.org.id, email="a@example.com")
        l2 = _create_lead(self.service, self.org.id, email="b@example.com")
        self.service.assign_lead(l2["id"], self.org.id, _uuid(50))
        leads = self.service.list_leads(self.org.id, assigned_to_id=_uuid(50))
        self.assertEqual(len(leads), 1)

    def test_list_leads_search(self):
        _create_lead(self.service, self.org.id, email="alice@example.com", first_name="Alice")
        _create_lead(self.service, self.org.id, email="bob@example.com", first_name="Bob")
        leads = self.service.list_leads(self.org.id, search="alice")
        self.assertEqual(len(leads), 1)
        self.assertEqual(leads[0].first_name, "Alice")

    def test_list_leads_search_by_company(self):
        _create_lead(self.service, self.org.id, email="a@example.com", company="TechCorp")
        _create_lead(self.service, self.org.id, email="b@example.com", company="DataInc")
        leads = self.service.list_leads(self.org.id, search="tech")
        self.assertEqual(len(leads), 1)

    def test_list_leads_org_isolation(self):
        org2 = OrganizationModel.objects.create(name="Org2", slug="org2")
        _create_lead(self.service, self.org.id, email="a@example.com")
        _create_lead(self.service, org2.id, email="b@example.com")
        leads_org1 = self.service.list_leads(self.org.id)
        leads_org2 = self.service.list_leads(org2.id)
        self.assertEqual(len(leads_org1), 1)
        self.assertEqual(len(leads_org2), 1)

    # ------------------------------------------------------------------
    # Status transitions
    # ------------------------------------------------------------------

    def test_status_transition_new_to_contacted(self):
        created = _create_lead(self.service, self.org.id)
        updated = self.service.change_status(created["id"], self.org.id, "CONTACTED")
        self.assertEqual(updated["status"], "CONTACTED")

    def test_status_transition_contacted_to_qualified(self):
        created = _create_lead(self.service, self.org.id)
        self.service.change_status(created["id"], self.org.id, "CONTACTED")
        updated = self.service.change_status(created["id"], self.org.id, "QUALIFIED")
        self.assertEqual(updated["status"], "QUALIFIED")

    def test_status_transition_qualified_to_converted(self):
        created = _create_lead(self.service, self.org.id)
        self.service.change_status(created["id"], self.org.id, "CONTACTED")
        self.service.change_status(created["id"], self.org.id, "QUALIFIED")
        updated = self.service.change_status(created["id"], self.org.id, "CONVERTED")
        self.assertEqual(updated["status"], "CONVERTED")
        self.assertIsNotNone(updated["converted_at"])

    def test_status_transition_to_disqualified_saves_reason(self):
        created = _create_lead(self.service, self.org.id)
        updated = self.service.change_status(created["id"], self.org.id, "DISQUALIFIED", reason="Not interested")
        self.assertEqual(updated["status"], "DISQUALIFIED")
        self.assertEqual(updated["disqualification_reason"], "Not interested")

    def test_status_transition_recycled_clears_reason(self):
        created = _create_lead(self.service, self.org.id)
        self.service.change_status(created["id"], self.org.id, "DISQUALIFIED", reason="Bad fit")
        updated = self.service.change_status(created["id"], self.org.id, "RECYCLED")
        self.assertEqual(updated["status"], "RECYCLED")
        self.assertEqual(updated["disqualification_reason"], "")

    def test_invalid_status_transition_raises(self):
        created = _create_lead(self.service, self.org.id)
        with self.assertRaises(ValidationError):
            self.service.change_status(created["id"], self.org.id, "CONVERTED")

    def test_converted_is_terminal(self):
        created = _create_lead(self.service, self.org.id)
        self.service.change_status(created["id"], self.org.id, "CONTACTED")
        self.service.change_status(created["id"], self.org.id, "QUALIFIED")
        self.service.change_status(created["id"], self.org.id, "CONVERTED")
        with self.assertRaises(ValidationError):
            self.service.change_status(created["id"], self.org.id, "NEW")

    def test_status_transition_disqualified_to_new(self):
        created = _create_lead(self.service, self.org.id)
        self.service.change_status(created["id"], self.org.id, "DISQUALIFIED")
        updated = self.service.change_status(created["id"], self.org.id, "NEW")
        self.assertEqual(updated["status"], "NEW")

    def test_status_transition_disqualified_to_recycled(self):
        created = _create_lead(self.service, self.org.id)
        self.service.change_status(created["id"], self.org.id, "DISQUALIFIED")
        updated = self.service.change_status(created["id"], self.org.id, "RECYCLED")
        self.assertEqual(updated["status"], "RECYCLED")

    def test_status_transition_recycled_to_contacted(self):
        created = _create_lead(self.service, self.org.id)
        self.service.change_status(created["id"], self.org.id, "DISQUALIFIED")
        self.service.change_status(created["id"], self.org.id, "RECYCLED")
        updated = self.service.change_status(created["id"], self.org.id, "CONTACTED")
        self.assertEqual(updated["status"], "CONTACTED")

    def test_status_transition_unknown_status_raises(self):
        created = _create_lead(self.service, self.org.id)
        with self.assertRaises(ValueError):
            self.service.change_status(created["id"], self.org.id, "INVALID")

    # ------------------------------------------------------------------
    # Assignment
    # ------------------------------------------------------------------

    def test_assign_lead(self):
        created = _create_lead(self.service, self.org.id)
        updated = self.service.assign_lead(created["id"], self.org.id, _uuid(100))
        self.assertEqual(updated["assigned_to_id"], _uuid(100))

    def test_assign_lead_unassign(self):
        created = _create_lead(self.service, self.org.id)
        self.service.assign_lead(created["id"], self.org.id, _uuid(100))
        updated = self.service.assign_lead(created["id"], self.org.id, None)
        self.assertIsNone(updated["assigned_to_id"])

    def test_assign_lead_reassign(self):
        created = _create_lead(self.service, self.org.id)
        self.service.assign_lead(created["id"], self.org.id, _uuid(100))
        updated = self.service.assign_lead(created["id"], self.org.id, _uuid(200))
        self.assertEqual(updated["assigned_to_id"], _uuid(200))

    # ------------------------------------------------------------------
    # Scoring
    # ------------------------------------------------------------------

    def test_score_lead(self):
        created = _create_lead(self.service, self.org.id)
        updated = self.service.score_lead(created["id"], self.org.id, 75)
        self.assertEqual(updated["score"], 75)

    def test_score_lead_out_of_range_raises(self):
        created = _create_lead(self.service, self.org.id)
        with self.assertRaises(ValidationError):
            self.service.score_lead(created["id"], self.org.id, 200)

    def test_score_lead_zero(self):
        created = _create_lead(self.service, self.org.id)
        updated = self.service.score_lead(created["id"], self.org.id, 0)
        self.assertEqual(updated["score"], 0)

    def test_score_lead_max(self):
        created = _create_lead(self.service, self.org.id)
        updated = self.service.score_lead(created["id"], self.org.id, 100)
        self.assertEqual(updated["score"], 100)

    def test_score_lead_updates_same_score(self):
        created = _create_lead(self.service, self.org.id, email="scoretest@example.com")
        updated = self.service.score_lead(created["id"], self.org.id, 50)
        self.assertEqual(updated["score"], 50)

    # ------------------------------------------------------------------
    # Conversion
    # ------------------------------------------------------------------

    def test_convert_lead(self):
        created = _create_lead(self.service, self.org.id)
        self.service.change_status(created["id"], self.org.id, "CONTACTED")
        self.service.change_status(created["id"], self.org.id, "QUALIFIED")
        contact_id = _uuid(300)
        updated = self.service.convert_lead(created["id"], self.org.id, contact_id=contact_id)
        self.assertEqual(updated["status"], "CONVERTED")
        self.assertEqual(updated["converted_to_contact_id"], contact_id)
        self.assertIsNotNone(updated["converted_at"])

    def test_convert_lead_with_opportunity(self):
        created = _create_lead(self.service, self.org.id)
        self.service.change_status(created["id"], self.org.id, "CONTACTED")
        self.service.change_status(created["id"], self.org.id, "QUALIFIED")
        contact_id = _uuid(400)
        opp_id = _uuid(401)
        updated = self.service.convert_lead(created["id"], self.org.id, contact_id=contact_id, opportunity_id=opp_id)
        self.assertEqual(updated["converted_to_contact_id"], contact_id)
        self.assertEqual(updated["converted_to_opportunity_id"], opp_id)

    def test_convert_lead_not_qualified_raises(self):
        created = _create_lead(self.service, self.org.id)
        self.service.change_status(created["id"], self.org.id, "CONTACTED")
        with self.assertRaises(ValidationError):
            self.service.convert_lead(created["id"], self.org.id, contact_id=_uuid(500))

    def test_convert_lead_new_raises(self):
        created = _create_lead(self.service, self.org.id)
        with self.assertRaises(ValidationError):
            self.service.convert_lead(created["id"], self.org.id, contact_id=_uuid(600))

    def test_convert_lead_recycled_raises(self):
        created = _create_lead(self.service, self.org.id)
        self.service.change_status(created["id"], self.org.id, "DISQUALIFIED")
        self.service.change_status(created["id"], self.org.id, "RECYCLED")
        with self.assertRaises(ValidationError):
            self.service.convert_lead(created["id"], self.org.id, contact_id=_uuid(700))

    # ------------------------------------------------------------------
    # Duplicate detection
    # ------------------------------------------------------------------

    def test_find_duplicates_by_email(self):
        _create_lead(self.service, self.org.id, email="dupe@example.com")
        LeadModel.objects.create(
            organization=self.org,
            first_name="Jane",
            last_name="Doe",
            email="dupe@example.com",
        )
        duplicates = self.service.find_duplicates(self.org.id, email="dupe@example.com")
        self.assertEqual(len(duplicates), 2)

    def test_find_duplicates_no_match(self):
        duplicates = self.service.find_duplicates(self.org.id, email="nobody@example.com")
        self.assertEqual(len(duplicates), 0)

    def test_find_duplicates_no_email_given(self):
        duplicates = self.service.find_duplicates(self.org.id)
        self.assertEqual(len(duplicates), 0)

    def test_find_duplicates_org_isolation(self):
        org2 = OrganizationModel.objects.create(name="Other3", slug="other3")
        _create_lead(self.service, self.org.id, email="dupe@example.com")
        _create_lead(self.service, org2.id, email="dupe@example.com")
        dupes_org1 = self.service.find_duplicates(self.org.id, email="dupe@example.com")
        dupes_org2 = self.service.find_duplicates(org2.id, email="dupe@example.com")
        self.assertEqual(len(dupes_org1), 1)
        self.assertEqual(len(dupes_org2), 1)

    # ------------------------------------------------------------------
    # Model constraint
    # ------------------------------------------------------------------

    def test_lead_score_constraint(self):
        model = LeadModel.objects.create(
            organization=self.org,
            first_name="Test",
            last_name="User",
            email="test@example.com",
            score=50,
        )
        model.score = 150
        with self.assertRaises(Exception):
            model.save()
