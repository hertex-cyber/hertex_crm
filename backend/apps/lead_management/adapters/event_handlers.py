import structlog

from apps.lead_management.domain.events import (
    LeadAssigned,
    LeadConverted,
    LeadCreated,
    LeadDeleted,
    LeadScored,
    LeadStatusChanged,
    LeadUpdated,
)

logger = structlog.get_logger(__name__)


def handle_LeadCreated(event: LeadCreated) -> None:
    logger.info("lead_created", lead_id=str(event.lead_id), email=event.email, org_id=str(event.organization_id))


def handle_LeadUpdated(event: LeadUpdated) -> None:
    logger.info("lead_updated", lead_id=str(event.lead_id), changed_fields=list(event.changes.keys()), org_id=str(event.organization_id))


def handle_LeadAssigned(event: LeadAssigned) -> None:
    logger.info("lead_assigned", lead_id=str(event.lead_id), to_user=str(event.to_user_id), org_id=str(event.organization_id))


def handle_LeadStatusChanged(event: LeadStatusChanged) -> None:
    logger.info("lead_status_changed", lead_id=str(event.lead_id), from_status=event.from_status, to_status=event.to_status, org_id=str(event.organization_id))


def handle_LeadScored(event: LeadScored) -> None:
    logger.info("lead_scored", lead_id=str(event.lead_id), score=event.score, org_id=str(event.organization_id))


def handle_LeadConverted(event: LeadConverted) -> None:
    logger.info("lead_converted", lead_id=str(event.lead_id), contact_id=str(event.contact_id), org_id=str(event.organization_id))


def handle_LeadDeleted(event: LeadDeleted) -> None:
    logger.info("lead_deleted", lead_id=str(event.lead_id), org_id=str(event.organization_id))
