"""Persistent, organization-scoped roles and permission assignments."""

import uuid

from django.db import models

from apps.organization.infrastructure.models import MembershipModel, OrganizationModel


class PermissionModel(models.Model):
    code = models.CharField(primary_key=True, max_length=100)
    label = models.CharField(max_length=150)
    module = models.CharField(max_length=64)
    description = models.TextField(blank=True, default="")

    class Meta:
        db_table = "rbac_permissions"
        ordering = ["module", "code"]


class RoleModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(OrganizationModel, on_delete=models.CASCADE, related_name="roles")
    name = models.CharField(max_length=80)
    description = models.TextField(blank=True, default="")
    is_system = models.BooleanField(default=False)
    permissions = models.ManyToManyField(PermissionModel, related_name="roles", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "rbac_roles"
        ordering = ["name"]
        constraints = [models.UniqueConstraint(fields=["organization", "name"], name="uq_rbac_role_org_name")]


class MembershipRoleAssignmentModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    membership = models.ForeignKey(MembershipModel, on_delete=models.CASCADE, related_name="role_assignments")
    role = models.ForeignKey(RoleModel, on_delete=models.CASCADE, related_name="assignments")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "rbac_membership_role_assignments"
        constraints = [models.UniqueConstraint(fields=["membership", "role"], name="uq_rbac_membership_role")]
