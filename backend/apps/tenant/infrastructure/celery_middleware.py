"""Celery task middleware for tenant context propagation.

Ensures that every Celery task running in the background has the correct
tenant context restored before execution, and that suspended/disabled tenants
cannot process tasks.
"""

from __future__ import annotations

import threading
from uuid import UUID

from celery import Task
from django.db import connection

# Thread-local storage for tenant context
_tenant_local = threading.local()


def get_current_organization_id() -> UUID | None:
    """Get the current tenant's organization_id from thread-local storage."""
    return getattr(_tenant_local, "organization_id", None)


def set_current_organization_id(org_id: UUID | None) -> None:
    """Set the current tenant's organization_id in thread-local storage."""
    _tenant_local.organization_id = org_id


class TenantAwareTask(Task):
    """Celery task base class that restores tenant context before execution.

    Every Celery task in the system should inherit from this class to ensure
    tenant isolation in background processing.
    """

    abstract = True

    def __call__(self, *args, **kwargs):
        org_id = kwargs.pop("_organization_id", None)

        if org_id:
            set_current_organization_id(org_id)

            with connection.cursor() as cursor:
                cursor.execute(
                    "SET app.current_organization_id = %s",
                    [str(org_id)],
                )

            if self._is_tenant_suspended(org_id):
                raise PermissionError(f"Tenant {org_id} is suspended — task rejected")

        try:
            return super().__call__(*args, **kwargs)
        finally:
            set_current_organization_id(None)
            if org_id:
                with connection.cursor() as cursor:
                    cursor.execute("SET app.current_organization_id = NULL")

    @staticmethod
    def _is_tenant_suspended(org_id: UUID) -> bool:
        from apps.tenant.infrastructure.models import TenantModel
        return TenantModel.objects.filter(
            organization_id=org_id, status__in=["SUSPENDED", "DISABLED", "DELETED"]
        ).exists()
