"""Domain error hierarchy for explicit business-failure handling.

All expected business failures (validation errors, not-found, conflicts, permission
denied) use these exception classes. They are caught by the DRF exception handler
and mapped to consistent HTTP status codes.

Python exceptions are reserved for truly unexpected failures (DB down, bug).
"""

from __future__ import annotations

from typing import Any


class DomainError(Exception):
    """Base class for all domain-level errors.

    These represent expected business rule violations, not system failures.
    """

    code: str = "DOMAIN_ERROR"
    status_code: int = 400

    def __init__(self, message: str = "", details: dict[str, Any] | None = None) -> None:
        self.message = message or self.__class__.__name__
        self.details = details or {}
        super().__init__(self.message)

    def to_dict(self) -> dict[str, Any]:
        return {
            "code": self.code,
            "message": self.message,
            "details": self.details,
        }


class NotFoundError(DomainError):
    """Resource not found."""

    code = "NOT_FOUND"
    status_code = 404

    def __init__(self, message: str = "Resource not found", resource_id: str | None = None) -> None:
        details = {"resource_id": resource_id} if resource_id else {}
        super().__init__(message, details)


class ValidationError(DomainError):
    """Business rule validation failure."""

    code = "VALIDATION_ERROR"
    status_code = 422

    def __init__(self, message: str = "Validation failed", field_errors: dict[str, list[str]] | None = None) -> None:
        details = {"field_errors": field_errors} if field_errors else {}
        super().__init__(message, details)


class ConflictError(DomainError):
    """Resource conflict — duplicate, state conflict, etc."""

    code = "CONFLICT"
    status_code = 409

    def __init__(self, message: str = "Resource conflict", conflicting_id: str | None = None) -> None:
        details = {"conflicting_id": conflicting_id} if conflicting_id else {}
        super().__init__(message, details)


class PermissionDeniedError(DomainError):
    """Insufficient permissions."""

    code = "PERMISSION_DENIED"
    status_code = 403

    def __init__(self, message: str = "Permission denied", required_permission: str | None = None) -> None:
        details = {"required_permission": required_permission} if required_permission else {}
        super().__init__(message, details)


class UnauthorizedError(DomainError):
    """Authentication required or failed."""

    code = "UNAUTHORIZED"
    status_code = 401

    def __init__(self, message: str = "Authentication required") -> None:
        super().__init__(message)
