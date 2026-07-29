from rest_framework.permissions import BasePermission

from apps.rbac.application.services import RbacService


class HasOrganizationPermission(BasePermission):
    permission_code = ""

    def has_permission(self, request, view):
        organization_id = request.headers.get("X-Organization-ID")
        if not organization_id:
            return False
        permission = getattr(view, "required_permission", self.permission_code)
        if not permission:
            return True
        return RbacService().has_permission(request.user.id, organization_id, permission)
