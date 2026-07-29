"""Result type for explicit success/failure handling.

Implements Railway-Oriented Programming pattern (https://fsharpforfunandprofit.com/rop/).
Application services return Result[T, E] instead of throwing exceptions for
expected business outcomes. This keeps control flow explicit and testable.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Generic, TypeVar, Union

T = TypeVar("T")
E = TypeVar("E", bound=Exception)


@dataclass(frozen=True)
class Result(Generic[T, E]):
    """Explicit success/failure result wrapper.

    Usage:
        def assign_lead(cmd: AssignLeadCommand) -> Result[Lead, DomainError]:
            lead = repo.get_by_id(cmd.lead_id)
            if not lead:
                return Result.failure(NotFoundError(f"Lead {cmd.lead_id} not found"))
            lead.assign_to(cmd.user_id)
            repo.save(lead)
            return Result.success(lead)

        result = assign_lead(cmd)
        if result.is_success:
            lead = result.value
        else:
            error = result.error
    """

    value: T | None = None
    error: E | None = None

    def __post_init__(self) -> None:
        if self.value is not None and self.error is not None:
            raise ValueError("Result cannot have both value and error")
        if self.value is None and self.error is None:
            raise ValueError("Result must have either value or error")

    @property
    def is_success(self) -> bool:
        return self.error is None

    @property
    def is_failure(self) -> bool:
        return self.error is not None

    @classmethod
    def success(cls, value: T) -> Result[T, E]:
        return cls(value=value)

    @classmethod
    def failure(cls, error: E) -> Result[T, E]:
        return cls(error=error)

    def map(self, fn):
        """Transform the value if success, propagate error if failure."""
        if self.is_success:
            return Result.success(fn(self.value))
        return self

    def bind(self, fn):
        """Chain a function that returns a Result."""
        if self.is_success:
            return fn(self.value)
        return self


@dataclass(frozen=True)
class PaginatedResult(Generic[T]):
    """Standard paginated response envelope.

    Every list endpoint returns this shape, ensuring consistent pagination
    across all 20+ modules.
    """

    items: list[T]
    total_count: int
    page: int
    page_size: int

    @property
    def has_next(self) -> bool:
        return (self.page * self.page_size) < self.total_count

    @property
    def has_previous(self) -> bool:
        return self.page > 1

    @property
    def total_pages(self) -> int:
        return (self.total_count + self.page_size - 1) // self.page_size

    def to_dict(self) -> dict:
        return {
            "data": self.items,
            "pagination": {
                "page": self.page,
                "pageSize": self.page_size,
                "totalCount": self.total_count,
                "totalPages": self.total_pages,
                "hasNext": self.has_next,
                "hasPrevious": self.has_previous,
            },
        }
