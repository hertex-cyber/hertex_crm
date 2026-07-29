from django.urls import path

from .views import MyPermissionsView, PermissionListView, RoleAssignmentView, RoleDetailView, RoleListCreateView

urlpatterns = [
    path("permissions", PermissionListView.as_view(), name="permission-list"),
    path("me", MyPermissionsView.as_view(), name="my-permissions"),
    path("", RoleListCreateView.as_view(), name="role-list"),
    path("<uuid:role_id>", RoleDetailView.as_view(), name="role-detail"),
    path("<uuid:role_id>/assignments", RoleAssignmentView.as_view(), name="role-assign"),
    path("<uuid:role_id>/assignments/<uuid:membership_id>", RoleAssignmentView.as_view(), name="role-unassign"),
]
