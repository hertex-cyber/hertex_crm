import uuid

from django.db import models


class OrganizationModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    slug = models.SlugField(unique=True, max_length=128)
    description = models.TextField(blank=True, default="")
    status = models.CharField(max_length=32, default="ACTIVE")
    created_by = models.UUIDField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "organization_organizations"
        indexes = [
            models.Index(fields=["slug"], name="idx_orgs_slug"),
            models.Index(fields=["status"], name="idx_orgs_status"),
        ]


class MembershipModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user_id = models.UUIDField()
    organization = models.ForeignKey(OrganizationModel, on_delete=models.CASCADE, related_name="memberships")
    status = models.CharField(max_length=32, default="ACTIVE")
    role = models.CharField(max_length=32, default="MEMBER")
    invited_by = models.UUIDField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "organization_memberships"
        indexes = [
            models.Index(fields=["user_id"], name="idx_memberships_user"),
            models.Index(fields=["organization"], name="idx_memberships_org"),
        ]
        unique_together = [("user_id", "organization")]
