"""DRF exception handler — maps domain errors to consistent HTTP responses.

This is the one place where the DomainError hierarchy is mapped to HTTP status codes.
Third-party integrators get one predictable error contract instead of fifteen bespoke ones.
"""

from __future__ import annotations

import uuid
import logging
from typing import Any

from django.http import HttpRequest
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

from apps.shared_kernel.domain.errors import DomainError

logger = logging.getLogger(__name__)


def domain_exception_handler(exc: Exception, context: dict[str, Any]) -> Response | None:
    """DRF exception handler that converts DomainErrors to consistent error responses."""

    if isinstance(exc, DomainError):
        request = context.get("request")
        return Response(
            {
                "error": {
                    "code": exc.code,
                    "message": exc.message,
                    "details": exc.details,
                    "requestId": getattr(request, "request_id", str(uuid.uuid4())),
                    "timestamp": __import__("datetime").datetime.now(
                        __import__("datetime").timezone.utc
                    ).isoformat(),
                }
            },
            status=exc.status_code,
        )

    response = drf_exception_handler(exc, context)

    if response is not None:
        request = context.get("request")
        response.data = {
            "error": {
                "code": "API_ERROR",
                "message": str(response.data) if isinstance(response.data, str) else str(exc),
                "details": response.data if isinstance(response.data, dict) else {},
                "requestId": getattr(request, "request_id", str(uuid.uuid4())),
                "timestamp": __import__("datetime").datetime.now(
                    __import__("datetime").timezone.utc
                ).isoformat(),
            }
        }

    return response
