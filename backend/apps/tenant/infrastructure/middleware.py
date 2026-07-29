"""Tenant resolution middleware — the core of multi-tenant isolation.

This middleware is positioned after authentication in the middleware stack.
It extracts the organization_id from the JWT, validates the user's membership,
checks tenant status, and sets app.current_organization_id in the PostgreSQL session
for RLS enforcement.
"""

from __future__ import annotations

import logging
from uuid import UUID

from django.db import connection
from django.http import HttpRequest, JsonResponse

from apps.shared_kernel.domain.errors import PermissionDeniedError

logger = logging.getLogger(__name__)


class TenantResolutionMiddleware:
    """Middleware that enforces tenant isolation for every authenticated request.

    Pipeline:
    1. Skip for unauthenticated requests (public endpoints only)
    2. Extract organization_id from JWT payload (set by JWTAuthentication)
    3. Validate user is a member of the organization
    4. Check tenant status (active / suspended / disabled)
    5. Set app.current_organization_id in PostgreSQL session for RLS
    6. Clean up after response (reset to NULL to prevent cross-request leakage)
    """

    def __init__(self, get_response):
        self._get_response = get_response

    def __call__(self, request: HttpRequest):
        # Skip for unauthenticated or public endpoints
        if not hasattr(request, "user") or not request.user or not request.user.is_authenticated:
            return self._get_response(request)

        org_id = self._resolve_organization(request)

        if org_id:
            if not self._is_member(request.user.id, org_id):
                return JsonResponse(
                    {"error": {"code": "NOT_ORG_MEMBER", "message": "User is not a member of this organization"}},
                    status=403,
                )

            tenant_status = self._get_tenant_status(org_id)
            if tenant_status == "SUSPENDED":
                return JsonResponse(
                    {"error": {"code": "ORG_SUSPENDED", "message": "Organization has been suspended"}},
                    status=403,
                )

            if tenant_status == "DISABLED":
                return JsonResponse(
                    {"error": {"code": "ORG_DISABLED", "message": "Organization has been disabled"}},
                    status=403,
                )

            # Set PostgreSQL session variable for RLS
            self._set_tenant_context(org_id)

        request.organization_id = org_id

        try:
            response = self._get_response(request)
        finally:
            # Clean up tenant context to prevent cross-request leakage
            if org_id:
                self._clear_tenant_context()

        return response

    def _resolve_organization(self, request: HttpRequest) -> UUID | None:
        """Extract organization_id from JWT, header, or query param."""
        # Prefer JWT payload (set by JWTAuthentication)
        token_payload = getattr(request, "token_payload", {})
        org_id = token_payload.get("org")

        # Fall back to header
        if not org_id:
            org_id = request.headers.get("X-Organization-ID")

        # Fall back to query param
        if not org_id:
            org_id = request.GET.get("organization_id")

        if org_id:
            try:
                return UUID(str(org_id))
            except (ValueError, AttributeError):
                return None

        return None

    def _is_member(self, user_id: UUID, org_id: UUID) -> bool:
        """Check if user is an active member of the organization."""
        from apps.organization.infrastructure.models import MembershipModel

        return MembershipModel.objects.filter(
            user_id=user_id,
            organization_id=org_id,
            status="ACTIVE",
        ).exists()

    def _get_tenant_status(self, org_id: UUID) -> str | None:
        """Get the tenant's current status."""
        from apps.tenant.infrastructure.models import TenantModel

        try:
            tenant = TenantModel.objects.get(organization_id=org_id)
            return tenant.status
        except TenantModel.DoesNotExist:
            return None

    def _set_tenant_context(self, org_id: UUID) -> None:
        """Set PostgreSQL session variable for RLS enforcement."""
        if connection.vendor != "postgresql":
            return
        with connection.cursor() as cursor:
            cursor.execute(
                "SET app.current_organization_id = %s",
                [str(org_id)],
            )

    def _clear_tenant_context(self) -> None:
        """Clear PostgreSQL session variable to prevent cross-request leakage."""
        if connection.vendor != "postgresql":
            return
        with connection.cursor() as cursor:
            cursor.execute("SET app.current_organization_id = NULL")
