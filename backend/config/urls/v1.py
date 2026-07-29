"""API v1 URL configuration."""

from django.urls import path, include

urlpatterns = [
    path("auth/", include("apps.identity.api.urls")),
    path("orgs/", include("apps.organization.api.urls")),
    path("roles/", include("apps.rbac.api.urls")),
    path("tenants/", include("apps.tenant.api.urls")),
    path("leads/", include("apps.lead_management.api.urls")),
    path("contacts/", include("apps.contact_account.api.contact_urls")),
    path("accounts/", include("apps.contact_account.api.account_urls")),
    path("pipelines/", include("apps.pipeline_management.api.urls")),
    path("opportunities/", include("apps.opportunity.api.urls")),
    path("activities/", include("apps.activity.api.urls")),
    path("tasks/", include("apps.task.api.urls")),
    path("calendar/", include("apps.calendar.api.urls")),
    path("workflows/", include("apps.workflow.api.urls")),
    path("notifications/", include("apps.notification.api.urls")),
    path("dashboards/", include("apps.dashboard.api.urls")),
    path("reports/", include("apps.reports.api.urls")),
    path("ai/", include("apps.ai.api.urls")),
    path("voice/", include("apps.voice_ai.api.urls")),
    path("integrations/", include("apps.integrations.api.urls")),
    path("settings/", include("apps.settings.api.urls")),
    path("audit/", include("apps.audit.api.urls")),
    path("search/", include("apps.search.api.urls")),
]
