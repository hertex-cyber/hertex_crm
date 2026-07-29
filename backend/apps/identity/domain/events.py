"""Identity domain events."""

from dataclasses import dataclass
from datetime import datetime

from apps.shared_kernel.domain.base import DomainEvent, UUID


@dataclass
class UserRegistered(DomainEvent):
    user_id: UUID
    email: str
    registered_at: datetime | None = None

    def get_aggregate_id(self) -> UUID:
        return self.user_id


@dataclass
class EmailVerified(DomainEvent):
    user_id: UUID
    email: str
    verified_at: datetime | None = None

    def get_aggregate_id(self) -> UUID:
        return self.user_id


@dataclass
class UserLoggedIn(DomainEvent):
    user_id: UUID
    login_method: str
    ip_address: str
    user_agent: str | None = None

    def get_aggregate_id(self) -> UUID:
        return self.user_id


@dataclass
class PasswordChanged(DomainEvent):
    user_id: UUID

    def get_aggregate_id(self) -> UUID:
        return self.user_id


@dataclass
class AccountLocked(DomainEvent):
    user_id: UUID
    reason: str

    def get_aggregate_id(self) -> UUID:
        return self.user_id


@dataclass
class AccountDisabled(DomainEvent):
    user_id: UUID
    reason: str

    def get_aggregate_id(self) -> UUID:
        return self.user_id
