import uuid

from django.db import models


class TenantModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization_id = models.UUIDField(unique=True)
    plan = models.CharField(max_length=32, default="free")
    status = models.CharField(max_length=32, default="ACTIVE",
        choices=[
            ("ACTIVE", "Active"),
            ("SUSPENDED", "Suspended"),
            ("DISABLED", "Disabled"),
        ],
    )
    settings = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "tenant_tenants"
        indexes = [
            models.Index(fields=["organization_id"], name="idx_tenant_org"),
            models.Index(fields=["status"], name="idx_tenant_status"),
        ]
