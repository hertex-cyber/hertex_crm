import uuid

from django.db import migrations, models
import django.db.models.deletion


PERMISSIONS = [
    ("organization.manage", "Manage workspace", "Organization", "Update workspace settings and memberships"),
    ("users.view", "View users", "Users", "View organization users"),
    ("users.manage", "Manage users", "Users", "Invite and manage organization users"),
    ("lead.view", "View leads", "Leads", "View leads"),
    ("lead.create", "Create leads", "Leads", "Create leads"),
    ("lead.update", "Update leads", "Leads", "Edit leads"),
    ("lead.delete", "Delete leads", "Leads", "Delete leads"),
    ("contact.view", "View contacts", "Contacts", "View contacts and accounts"),
    ("contact.manage", "Manage contacts", "Contacts", "Create and edit contacts and accounts"),
    ("opportunity.view", "View opportunities", "Sales", "View opportunities and pipelines"),
    ("opportunity.manage", "Manage opportunities", "Sales", "Create and edit opportunities and pipelines"),
    ("activity.manage", "Manage activities", "Sales", "Create and edit activities and tasks"),
    ("report.view", "View reports", "Analytics", "View reports and dashboards"),
    ("report.manage", "Manage reports", "Analytics", "Create and manage reports and dashboards"),
    ("workflow.manage", "Manage workflows", "Automation", "Create and manage workflow automations"),
    ("integration.manage", "Manage integrations", "Integrations", "Connect and manage integrations"),
]


def seed_permissions(apps, schema_editor):
    Permission = apps.get_model("rbac", "PermissionModel")
    Permission.objects.bulk_create([
        Permission(code=code, label=label, module=module, description=description)
        for code, label, module, description in PERMISSIONS
    ], ignore_conflicts=True)


class Migration(migrations.Migration):
    initial = True
    dependencies = [("organization", "0002_membershipmodel_invited_by_and_more")]

    operations = [
        migrations.CreateModel(
            name="PermissionModel",
            fields=[
                ("code", models.CharField(max_length=100, primary_key=True, serialize=False)),
                ("label", models.CharField(max_length=150)),
                ("module", models.CharField(max_length=64)),
                ("description", models.TextField(blank=True, default="")),
            ],
            options={"db_table": "rbac_permissions", "ordering": ["module", "code"]},
        ),
        migrations.CreateModel(
            name="RoleModel",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("name", models.CharField(max_length=80)),
                ("description", models.TextField(blank=True, default="")),
                ("is_system", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("organization", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="roles", to="organization.organizationmodel")),
                ("permissions", models.ManyToManyField(blank=True, related_name="roles", to="rbac.permissionmodel")),
            ],
            options={"db_table": "rbac_roles", "ordering": ["name"]},
        ),
        migrations.CreateModel(
            name="MembershipRoleAssignmentModel",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("membership", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="role_assignments", to="organization.membershipmodel")),
                ("role", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="assignments", to="rbac.rolemodel")),
            ],
            options={"db_table": "rbac_membership_role_assignments"},
        ),
        migrations.AddConstraint(model_name="rolemodel", constraint=models.UniqueConstraint(fields=("organization", "name"), name="uq_rbac_role_org_name")),
        migrations.AddConstraint(model_name="membershiproleassignmentmodel", constraint=models.UniqueConstraint(fields=("membership", "role"), name="uq_rbac_membership_role")),
        migrations.RunPython(seed_permissions, migrations.RunPython.noop),
    ]
