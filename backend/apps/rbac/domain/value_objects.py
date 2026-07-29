from __future__ import annotations

from dataclasses import dataclass
from typing import ClassVar

from apps.shared_kernel.domain.base import ValueObject


@dataclass(frozen=True)
class PermissionCode(ValueObject):
    code: str

    def __post_init__(self) -> None:
        if not self.code or "." not in self.code:
            raise ValueError(f"Invalid permission code format: {self.code!r}")


@dataclass(frozen=True)
class RoleName(ValueObject):
    name: str

    SYSTEM_ROLES: ClassVar[set[str]] = {"Owner", "Admin", "Member"}

    @property
    def is_system(self) -> bool:
        return self.name in self.SYSTEM_ROLES
