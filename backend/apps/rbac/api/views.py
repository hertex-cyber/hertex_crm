from uuid import UUID

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.rbac.application.services import RbacService
from apps.rbac.models import PermissionModel
from apps.shared_kernel.api.pagination import StandardPagination
from apps.shared_kernel.domain.errors import NotFoundError, PermissionDeniedError, ValidationError

from .permissions import HasOrganizationPermission
from .serializers import AssignmentSerializer, PermissionSerializer, RoleSerializer, RoleWriteSerializer


def organization_id(request):
    value = request.headers.get("X-Organization-ID")
    if not value:
        raise ValidationError("X-Organization-ID header is required")
    try:
        return UUID(str(value))
    except ValueError as exc:
        raise ValidationError("X-Organization-ID must be a valid UUID") from exc


def error_response(error):
    status_code = (
        status.HTTP_403_FORBIDDEN
        if isinstance(error, PermissionDeniedError)
        else status.HTTP_404_NOT_FOUND
        if isinstance(error, NotFoundError)
        else status.HTTP_400_BAD_REQUEST
    )
    return Response({"error": {"code": "RBAC_ERROR", "message": str(error)}}, status=status_code)


def role_payload(role):
    member_count = getattr(role, "member_count", None)
    if member_count is None:
        member_count = role.assignments.count()
    return {
        "id": role.id,
        "name": role.name,
        "description": role.description,
        "is_system": role.is_system,
        "permissions": [p.code for p in role.permissions.all()],
        "member_count": member_count,
    }


class PermissionListView(APIView):
    permission_classes = [IsAuthenticated, HasOrganizationPermission]
    required_permission = "organization.manage"

    def get(self, request):
        try:
            org_id = organization_id(request)
            RbacService().verify_membership(request.user.id, org_id)
            data = PermissionSerializer(PermissionModel.objects.all(), many=True).data
            return Response(data)
        except (ValidationError, PermissionDeniedError) as error:
            return error_response(error)


class RoleListCreateView(APIView):
    permission_classes = [IsAuthenticated, HasOrganizationPermission]
    required_permission = "organization.manage"

    def get(self, request):
        try:
            org_id = organization_id(request)
            service = RbacService()
            service.verify_membership(request.user.id, org_id)
            roles = service.list_roles(org_id)
            paginator = StandardPagination()
            page = paginator.paginate_queryset(roles, request)
            if page is not None:
                serializer = RoleSerializer([role_payload(r) for r in page], many=True)
                return paginator.get_paginated_response(serializer.data)
            return Response(RoleSerializer([role_payload(r) for r in roles], many=True).data)
        except (ValidationError, PermissionDeniedError) as error:
            return error_response(error)

    def post(self, request):
        serializer = RoleWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            org_id = organization_id(request)
            service = RbacService()
            service.require_admin(request.user.id, org_id)
            role = service.create_role(
                org_id,
                serializer.validated_data["name"],
                serializer.validated_data.get("description", ""),
                serializer.validated_data.get("permissions", []),
            )
            return Response(RoleSerializer(role_payload(role)).data, status=status.HTTP_201_CREATED)
        except (ValidationError, PermissionDeniedError) as error:
            return error_response(error)


class RoleDetailView(APIView):
    permission_classes = [IsAuthenticated, HasOrganizationPermission]
    required_permission = "organization.manage"

    def patch(self, request, role_id):
        serializer = RoleWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            org_id = organization_id(request)
            service = RbacService()
            service.require_admin(request.user.id, org_id)
            role = service.update_role(
                role_id,
                org_id,
                serializer.validated_data.get("name"),
                serializer.validated_data.get("description"),
                serializer.validated_data.get("permissions"),
            )
            return Response(RoleSerializer(role_payload(role)).data)
        except (ValidationError, PermissionDeniedError, NotFoundError) as error:
            return error_response(error)

    def delete(self, request, role_id):
        try:
            org_id = organization_id(request)
            service = RbacService()
            service.require_admin(request.user.id, org_id)
            service.delete_role(role_id, org_id)
            return Response(status=status.HTTP_204_NO_CONTENT)
        except (ValidationError, PermissionDeniedError, NotFoundError) as error:
            return error_response(error)


class RoleAssignmentView(APIView):
    permission_classes = [IsAuthenticated, HasOrganizationPermission]
    required_permission = "organization.manage"

    def post(self, request, role_id):
        serializer = AssignmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            org_id = organization_id(request)
            service = RbacService()
            service.require_admin(request.user.id, org_id)
            assignment = service.assign_role(role_id, serializer.validated_data["membership_id"], org_id)
            return Response(
                {"id": assignment.id, "membership_id": assignment.membership_id, "role_id": assignment.role_id},
                status=status.HTTP_201_CREATED,
            )
        except (PermissionDeniedError, NotFoundError) as error:
            return error_response(error)

    def delete(self, request, role_id, membership_id):
        try:
            org_id = organization_id(request)
            service = RbacService()
            service.require_admin(request.user.id, org_id)
            service.unassign_role(role_id, membership_id, org_id)
            return Response(status=status.HTTP_204_NO_CONTENT)
        except (PermissionDeniedError, ValidationError, NotFoundError) as error:
            return error_response(error)


class MyPermissionsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            org_id = organization_id(request)
            service = RbacService()
            return Response({
                "permissions": sorted(service.permissions_for(request.user.id, org_id)),
                "is_admin": service.is_admin(request.user.id, org_id),
            })
        except (ValidationError, PermissionDeniedError) as error:
            return error_response(error)
