import uuid

from django.db import models

from apps.organization.infrastructure.models import OrganizationModel


class PipelineModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(OrganizationModel, on_delete=models.CASCADE, related_name="lead_pipelines")
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "lead_management_pipelines"
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(fields=["organization", "name"], name="uq_pipeline_org_name"),
        ]


class LeadStageModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    pipeline = models.ForeignKey(PipelineModel, on_delete=models.CASCADE, null=True, blank=True, related_name="stages")
    organization = models.ForeignKey(OrganizationModel, on_delete=models.CASCADE, related_name="lead_stages")
    name = models.CharField(max_length=80)
    order = models.IntegerField(default=0)
    color = models.CharField(max_length=7, default="#6366f1")
    is_terminal = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "lead_management_stages"
        ordering = ["order"]
        constraints = [
            models.UniqueConstraint(fields=["pipeline", "name"], name="uq_lead_stage_pipeline_name"),
            models.UniqueConstraint(fields=["pipeline", "order"], name="uq_lead_stage_pipeline_order"),
        ]


class LeadModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        OrganizationModel, on_delete=models.CASCADE, related_name="leads"
    )
    pipeline = models.ForeignKey(PipelineModel, on_delete=models.SET_NULL, null=True, blank=True, related_name="leads")
    stage = models.ForeignKey(
        LeadStageModel, on_delete=models.SET_NULL, null=True, blank=True, related_name="leads"
    )
    first_name = models.CharField(max_length=120)
    last_name = models.CharField(max_length=120)
    email = models.EmailField(max_length=254)
    phone = models.CharField(max_length=40, blank=True, default="")
    company = models.CharField(max_length=200, blank=True, default="")
    title = models.CharField(max_length=200, blank=True, default="")
    source = models.CharField(
        max_length=30,
        choices=[
            ("WEB_FORM", "Web Form"),
            ("REFERRAL", "Referral"),
            ("COLD_CALL", "Cold Call"),
            ("EMAIL", "Email"),
            ("SOCIAL_MEDIA", "Social Media"),
            ("PARTNER", "Partner"),
            ("OTHER", "Other"),
        ],
        default="OTHER",
    )
    status = models.CharField(max_length=20, default="NEW", editable=False)
    score = models.IntegerField(default=0)
    owner_id = models.UUIDField(null=True, blank=True)
    assigned_to_id = models.UUIDField(null=True, blank=True)
    notes = models.TextField(blank=True, default="")
    disqualification_reason = models.TextField(blank=True, default="")
    converted_at = models.DateTimeField(null=True, blank=True)
    converted_to_contact_id = models.UUIDField(null=True, blank=True)
    converted_to_opportunity_id = models.UUIDField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "lead_management_leads"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["organization", "status"]),
            models.Index(fields=["organization", "email"]),
            models.Index(fields=["organization", "assigned_to_id"]),
            models.Index(fields=["organization", "created_at"]),
            models.Index(fields=["organization", "stage"]),
        ]

    def save(self, *args, **kwargs):
        if self.score is not None and (self.score < 0 or self.score > 100):
            raise ValueError(f"Score must be between 0 and 100, got {self.score}")
        super().save(*args, **kwargs)


COMMUNICATION_TYPES = [
    ("EMAIL", "Email"),
    ("WHATSAPP", "WhatsApp"),
    ("CALL", "Call"),
    ("SMS", "SMS"),
]

COMMUNICATION_DIRECTIONS = [
    ("OUTBOUND", "Outbound"),
    ("INBOUND", "Inbound"),
]


class CommunicationLogModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    lead = models.ForeignKey(LeadModel, on_delete=models.CASCADE, related_name="communications")
    type = models.CharField(max_length=20, choices=COMMUNICATION_TYPES)
    direction = models.CharField(max_length=20, choices=COMMUNICATION_DIRECTIONS, default="OUTBOUND")
    subject = models.CharField(max_length=200, blank=True, default="")
    body = models.TextField(blank=True, default="")
    from_address = models.CharField(max_length=200, blank=True, default="")
    to_address = models.CharField(max_length=200, blank=True, default="")
    status = models.CharField(max_length=30, default="PENDING")
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "lead_management_communications"
        ordering = ["-created_at"]


class ActivityLogModel(models.Model):
    ACTIVITY_TYPES = [
        ("LEAD_CREATED", "Lead Created"),
        ("STATUS_CHANGED", "Status Changed"),
        ("STAGE_CHANGED", "Stage Changed"),
        ("SCORE_CHANGED", "Score Changed"),
        ("LEAD_ASSIGNED", "Lead Assigned"),
        ("COMMUNICATION", "Communication"),
        ("NOTE_ADDED", "Note Added"),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    lead = models.ForeignKey(LeadModel, on_delete=models.CASCADE, related_name="activities")
    activity_type = models.CharField(max_length=30, choices=ACTIVITY_TYPES)
    description = models.TextField(blank=True, default="")
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "lead_management_activity_log"
        ordering = ["-created_at"]
