"""Concrete EventPublisher implementation using Celery + RabbitMQ.

This is the one place a truly shared infrastructure detail is allowed, because
publishing an event is a technical mechanism, not a business rule that varies
by module. Every module's domain events flow through this publisher.
"""

from __future__ import annotations

import json
import logging
from dataclasses import asdict

from celery import shared_task
from celery.exceptions import MaxRetriesExceededError

from apps.shared_kernel.application.ports import EventPublisher
from apps.shared_kernel.domain.base import DomainEvent

import structlog
logger = structlog.get_logger(__name__)


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=1,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=16,
    queue="events",
)
def dispatch_event(self, event_data: str, event_class_path: str) -> None:
    """Celery task that dispatches a domain event to all registered handlers.

    The event is serialized as JSON and reconstructed by the handler module.
    Handlers are discovered via the Django app registry.
    """
    try:
        from django.utils.module_loading import import_string
        from django.apps import apps

        event_data_dict = json.loads(event_data)
        event_class = import_string(event_class_path)
        event = event_class(**event_data_dict)

        # Discover and call handlers for this event
        for app_config in apps.get_app_configs():
            module_name = f"{app_config.name}.adapters.event_handlers"
            try:
                handler_module = import_string(module_name)
            except (ImportError, AttributeError):
                continue

            handler = getattr(handler_module, f"handle_{type(event).__name__}", None)
            if handler:
                try:
                    handler(event)
                except Exception as e:
                    logger.error(
                        "event_handler_failed",
                        event_type=type(event).__name__,
                        handler=f"{module_name}.handle_{type(event).__name__}",
                        error=str(e),
                    )
                    raise

    except Exception as e:
        logger.error("event_dispatch_failed", event_class=event_class_path, error=str(e))
        raise


class CeleryEventPublisher(EventPublisher):
    """Publishes domain events via Celery tasks to RabbitMQ."""

    def publish(self, event: DomainEvent) -> None:
        event_data = json.dumps(asdict(event), default=str)
        event_class_path = f"{type(event).__module__}.{type(event).__name__}"
        dispatch_event.delay(event_data, event_class_path)
        logger.info("event_published", event_type=type(event).__name__, event_id=str(event.event_id))

    def publish_many(self, events: list[DomainEvent]) -> None:
        for event in events:
            self.publish(event)
