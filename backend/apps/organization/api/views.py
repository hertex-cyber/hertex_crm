"""Organization API views."""

from __future__ import annotations

from uuid import UUID

from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

from apps.organization.application.services import (
    CreateOrgCommand,
    InviteMemberCommand,
    MembershipService,
    OrgService,
)
from apps.organization.infrastructure.models import OrganizationModel
from apps.shared_kernel.domain.errors import (
    ConflictError,
    NotFoundError,
    PermissionDeniedError,
    ValidationError,
)

from .serializers import (
    AcceptInviteSerializer,
    ChangeRoleSerializer,
    CreateOrgSerializer,
    InviteMemberSerializer,
    MemberResponseSerializer,
    OrgResponseSerializer,
    UpdateOrgSerializer,
)


def _error_to_status(error: Exception) -> int:
    if isinstance(error, NotFoundError):
        return status.HTTP_404_NOT_FOUND
    if isinstance(error, ConflictError):
        return status.HTTP_409_CONFLICT
    if isinstance(error, ValidationError):
        return status.HTTP_422_UNPROCESSABLE_ENTITY
    if isinstance(error, PermissionDeniedError):
        return status.HTTP_403_FORBIDDEN
    return status.HTTP_400_BAD_REQUEST


class OrgViewSet(ViewSet):
    permission_classes = [IsAuthenticated]

    def create(self, request):
        serializer = CreateOrgSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        cmd = CreateOrgCommand(
            name=serializer.validated_data["name"],
            slug=serializer.validated_data["slug"],
            owner_id=request.user.id,
        )
        result = OrgService().create(cmd)

        if result.is_failure:
            return Response(
                {"error": {"code": "ORG_CREATE_FAILED", "message": str(result.error)}},
                status=_error_to_status(result.error),
            )

        org_data = result.value
        response = Response(org_data, status=status.HTTP_201_CREATED)
        response["X-Organization-ID"] = org_data["org_id"]
        return response

    def list(self, request):
        orgs = OrgService().list_for_user(request.user.id)
        return Response(orgs)

    def retrieve(self, request, pk=None):
        try:
            UUID(str(pk))
        except (ValueError, AttributeError):
            return Response(
                {"error": {"code": "ORG_NOT_FOUND", "message": "Organization not found"}},
                status=status.HTTP_404_NOT_FOUND,
            )

        result = OrgService().get(pk)
        if result.is_failure:
            return Response(
                {"error": {"code": "ORG_NOT_FOUND", "message": str(result.error)}},
                status=status.HTTP_404_NOT_FOUND,
            )

        org = result.value
        model = OrganizationModel.objects.get(id=pk)
        return Response(OrgResponseSerializer({
            "id": str(org.id),
            "name": org.name,
            "slug": org.slug,
            "description": model.description or "",
            "status": org.status.value,
            "created_at": org.created_at,
        }).data)

    def update(self, request, pk=None):
        return self._partial_update(request, pk)

    def partial_update(self, request, pk=None):
        return self._partial_update(request, pk)

    def _partial_update(self, request, pk=None):
        try:
            UUID(str(pk))
        except (ValueError, AttributeError):
            return Response(
                {"error": {"code": "ORG_NOT_FOUND", "message": "Organization not found"}},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = UpdateOrgSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        result = OrgService().update(
            org_id=pk,
            name=serializer.validated_data.get("name"),
            description=serializer.validated_data.get("description"),
        )
        if result.is_failure:
            return Response(
                {"error": {"code": "ORG_UPDATE_FAILED", "message": str(result.error)}},
                status=_error_to_status(result.error),
            )

        org = result.value
        model = OrganizationModel.objects.get(id=pk)
        return Response(OrgResponseSerializer({
            "id": str(org.id),
            "name": org.name,
            "slug": org.slug,
            "description": model.description or "",
            "status": org.status.value,
            "created_at": org.created_at,
        }).data)

    def destroy(self, request, pk=None):
        try:
            UUID(str(pk))
        except (ValueError, AttributeError):
            return Response(
                {"error": {"code": "ORG_NOT_FOUND", "message": "Organization not found"}},
                status=status.HTTP_404_NOT_FOUND,
            )

        result = OrgService().archive(pk)
        if result.is_failure:
            return Response(
                {"error": {"code": "ORG_ARCHIVE_FAILED", "message": str(result.error)}},
                status=_error_to_status(result.error),
            )

        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["get"], url_path="current")
    def current(self, request):
        org_id = request.headers.get("X-Organization-ID") or request.META.get("HTTP_X_ORGANIZATION_ID")
        if not org_id:
            return Response(
                {"error": {"code": "ORG_ID_REQUIRED", "message": "X-Organization-ID header is required"}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            UUID(str(org_id))
        except (ValueError, AttributeError):
            return Response(
                {"error": {"code": "ORG_NOT_FOUND", "message": "Organization not found"}},
                status=status.HTTP_404_NOT_FOUND,
            )

        result = OrgService().get(org_id)
        if result.is_failure:
            return Response(
                {"error": {"code": "ORG_NOT_FOUND", "message": str(result.error)}},
                status=status.HTTP_404_NOT_FOUND,
            )

        org = result.value
        model = OrganizationModel.objects.get(id=org_id)
        return Response(OrgResponseSerializer({
            "id": str(org.id),
            "name": org.name,
            "slug": org.slug,
            "description": model.description or "",
            "status": org.status.value,
            "created_at": org.created_at,
        }).data)

    @action(detail=True, methods=["get"], url_path="members")
    def members(self, request, pk=None):
        try:
            UUID(str(pk))
        except (ValueError, AttributeError):
            return Response(
                {"error": {"code": "ORG_NOT_FOUND", "message": "Organization not found"}},
                status=status.HTTP_404_NOT_FOUND,
            )

        members = MembershipService().list_members(pk)
        return Response(MemberResponseSerializer(members, many=True).data)

    @action(detail=True, methods=["post"], url_path="invite")
    def invite(self, request, pk=None):
        try:
            UUID(str(pk))
        except (ValueError, AttributeError):
            return Response(
                {"error": {"code": "ORG_NOT_FOUND", "message": "Organization not found"}},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = InviteMemberSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        cmd = InviteMemberCommand(
            organization_id=pk,
            invited_by_user_id=request.user.id,
            invitee_email=serializer.validated_data["email"],
            role=serializer.validated_data["role"],
        )
        result = MembershipService().invite(cmd)
        if result.is_failure:
            return Response(
                {"error": {"code": "INVITE_FAILED", "message": str(result.error)}},
                status=_error_to_status(result.error),
            )

        return Response(result.value, status=status.HTTP_201_CREATED)

    @action(
        detail=True,
        methods=["post", "delete"],
        url_path=r"members/(?P<membership_id>[^/.]+)",
    )
    def manage_member(self, request, pk=None, membership_id=None):
        try:
            UUID(str(pk))
            UUID(str(membership_id))
        except (ValueError, AttributeError):
            return Response(
                {"error": {"code": "NOT_FOUND", "message": "Resource not found"}},
                status=status.HTTP_404_NOT_FOUND,
            )

        if request.method == "DELETE":
            result = MembershipService().remove_member(membership_id, request.user.id)
            if result.is_failure:
                return Response(
                    {"error": {"code": "REMOVE_MEMBER_FAILED", "message": str(result.error)}},
                    status=_error_to_status(result.error),
                )
            return Response(status=status.HTTP_204_NO_CONTENT)

        serializer = ChangeRoleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        result = MembershipService().change_role(
            membership_id=membership_id,
            new_role=serializer.validated_data["role"],
            requested_by_user_id=request.user.id,
        )
        if result.is_failure:
            return Response(
                {"error": {"code": "CHANGE_ROLE_FAILED", "message": str(result.error)}},
                status=_error_to_status(result.error),
            )

        membership = result.value
        return Response({
            "id": str(membership.id),
            "user_id": str(membership.user_id),
            "role": membership.role.value,
            "status": membership.status.value,
        })

    @action(detail=False, methods=["post"], url_path="accept-invite")
    def accept_invite(self, request):
        serializer = AcceptInviteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        result = MembershipService().accept_invite(
            membership_id=serializer.validated_data["membership_id"],
            user_id=request.user.id,
        )
        if result.is_failure:
            return Response(
                {"error": {"code": "ACCEPT_INVITE_FAILED", "message": str(result.error)}},
                status=_error_to_status(result.error),
            )

        membership = result.value
        return Response({
            "id": str(membership.id),
            "user_id": str(membership.user_id),
            "organization_id": str(membership.organization_id),
            "role": membership.role.value,
            "status": membership.status.value,
        })
