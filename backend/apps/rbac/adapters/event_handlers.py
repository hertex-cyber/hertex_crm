import structlog

from apps.rbac.domain.events import (
    OrganizationBootstrapped,
    RoleAssigned,
    RoleCreated,
    RoleDeleted,
    RoleUnassigned,
    RoleUpdated,
)

logger = structlog.get_logger(__name__)


def handle_RoleCreated(event: RoleCreated) -> None:
    logger.info("role_created", role_id=str(event.role_id), name=event.name, org_id=str(event.organization_id))


def handle_RoleUpdated(event: RoleUpdated) -> None:
    logger.info("role_updated", role_id=str(event.role_id), name=event.name, org_id=str(event.organization_id))


def handle_RoleDeleted(event: RoleDeleted) -> None:
    logger.info("role_deleted", role_id=str(event.role_id), name=event.name, org_id=str(event.organization_id))


def handle_RoleAssigned(event: RoleAssigned) -> None:
    logger.info("role_assigned", role_id=str(event.role_id), membership_id=str(event.membership_id), org_id=str(event.organization_id))


def handle_RoleUnassigned(event: RoleUnassigned) -> None:
    logger.info("role_unassigned", role_id=str(event.role_id), membership_id=str(event.membership_id), org_id=str(event.organization_id))


def handle_OrganizationBootstrapped(event: OrganizationBootstrapped) -> None:
    logger.info("org_bootstrapped", org_id=str(event.organization_id), roles=event.created_roles)
