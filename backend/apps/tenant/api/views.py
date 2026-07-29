"""Tenant API views."""

from __future__ import annotations

from uuid import UUID

from django.http import JsonResponse
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

from apps.shared_kernel.domain.errors import ConflictError, NotFoundError, ValidationError
from apps.tenant.application.services import TenantService

from .serializers import TenantResponseSerializer, UpdatePlanSerializer


def health_check(request):
    return JsonResponse({"status": "ok", "service": "tzahu-crm"})


def _error_to_status(error: Exception) -> int:
    if isinstance(error, NotFoundError):
        return status.HTTP_404_NOT_FOUND
    if isinstance(error, ConflictError):
        return status.HTTP_409_CONFLICT
    if isinstance(error, ValidationError):
        return status.HTTP_422_UNPROCESSABLE_ENTITY
    return status.HTTP_400_BAD_REQUEST


class TenantViewSet(ViewSet):
    permission_classes = [IsAuthenticated]

    def retrieve(self, request, pk=None):
        try:
            UUID(str(pk))
        except (ValueError, AttributeError):
            return Response(
                {"error": {"code": "TENANT_NOT_FOUND", "message": "Tenant not found"}},
                status=status.HTTP_404_NOT_FOUND,
            )

        from apps.tenant.infrastructure.repositories import TenantRepository
        tenant = TenantRepository().get_by_id(pk)

        if not tenant:
            return Response(
                {"error": {"code": "TENANT_NOT_FOUND", "message": f"Tenant {pk} not found"}},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(TenantResponseSerializer({
            "id": str(tenant.id),
            "organization_id": str(tenant.organization_id),
            "plan": tenant.plan,
            "status": tenant.status.value,
            "settings": tenant.settings,
            "created_at": tenant.created_at,
        }).data)

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
                {"error": {"code": "TENANT_NOT_FOUND", "message": "Tenant not found"}},
                status=status.HTTP_404_NOT_FOUND,
            )

        result = TenantService().get_by_org(org_id)
        if result.is_failure:
            return Response(
                {"error": {"code": "TENANT_NOT_FOUND", "message": str(result.error)}},
                status=status.HTTP_404_NOT_FOUND,
            )

        tenant = result.value
        return Response(TenantResponseSerializer({
            "id": str(tenant.id),
            "organization_id": str(tenant.organization_id),
            "plan": tenant.plan,
            "status": tenant.status.value,
            "settings": tenant.settings,
            "created_at": tenant.created_at,
        }).data)

    @action(detail=False, methods=["post"], url_path="plan")
    def plan(self, request):
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
                {"error": {"code": "TENANT_NOT_FOUND", "message": "Tenant not found"}},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = UpdatePlanSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        result = TenantService().get_by_org(org_id)
        if result.is_failure:
            return Response(
                {"error": {"code": "TENANT_NOT_FOUND", "message": str(result.error)}},
                status=status.HTTP_404_NOT_FOUND,
            )

        tenant = result.value
        change_result = TenantService().change_plan(tenant.id, serializer.validated_data["plan"])
        if change_result.is_failure:
            return Response(
                {"error": {"code": "PLAN_CHANGE_FAILED", "message": str(change_result.error)}},
                status=_error_to_status(change_result.error),
            )

        updated_tenant = change_result.value
        return Response(TenantResponseSerializer({
            "id": str(updated_tenant.id),
            "organization_id": str(updated_tenant.organization_id),
            "plan": updated_tenant.plan,
            "status": updated_tenant.status.value,
            "settings": updated_tenant.settings,
            "created_at": updated_tenant.created_at,
        }).data)
