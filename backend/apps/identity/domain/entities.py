"""Identity domain aggregates — User and Session.

Users are the central identity entity. Every person using the system 
is represented by a User. Sessions track authenticated devices.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

from apps.shared_kernel.domain.base import AggregateRoot, Entity, UUID, utcnow
from apps.shared_kernel.domain.errors import ValidationError
from apps.shared_kernel.domain.value_objects import Email, PersonName

from .value_objects import DeviceInfo


class UserStatus(Enum):
    PENDING_VERIFICATION = "PENDING_VERIFICATION"
    ACTIVE = "ACTIVE"
    LOCKED = "LOCKED"
    DISABLED = "DISABLED"


class User(AggregateRoot):
    """A person or service account that authenticates to the system.

    Invariants:
    - Email must be unique across all organizations
    - Email must be verified before first login
    - Password must meet policy requirements
    - Account can be active, locked, or disabled
    """

    def __init__(
        self,
        email: Email,
        display_name: PersonName,
        id: UUID | None = None,
        status: UserStatus = UserStatus.PENDING_VERIFICATION,
        email_verified_at: datetime | None = None,
        password_hash: str = "",
        password_changed_at: datetime | None = None,
    ) -> None:
        super().__init__(id)
        self._email = email
        self._display_name = display_name
        self._status = status
        self._email_verified_at = email_verified_at
        self._password_hash = password_hash
        self._password_changed_at = password_changed_at or utcnow()
        self._failed_login_attempts = 0
        self._avatar_url: str | None = None

    @property
    def email(self) -> Email:
        return self._email

    @property
    def avatar_url(self) -> str | None:
        return self._avatar_url

    @avatar_url.setter
    def avatar_url(self, value: str | None) -> None:
        self._avatar_url = value

    @property
    def display_name(self) -> PersonName:
        return self._display_name

    @property
    def status(self) -> UserStatus:
        return self._status

    @property
    def is_active(self) -> bool:
        return self._status == UserStatus.ACTIVE

    @property
    def email_verified(self) -> bool:
        return self._email_verified_at is not None

    def register(self, password_hash: str) -> None:
        """Register a new user."""
        self._password_hash = password_hash
        self._password_changed_at = utcnow()
        self._status = UserStatus.PENDING_VERIFICATION
        from .events import UserRegistered
        self._record_event(UserRegistered(
            user_id=self.id,
            email=str(self._email.address),
        ))

    def verify_email(self) -> None:
        """Mark email as verified."""
        if self.email_verified:
            raise ValidationError("Email already verified")
        self._email_verified_at = utcnow()
        if self._status == UserStatus.PENDING_VERIFICATION:
            self._status = UserStatus.ACTIVE
        from .events import EmailVerified
        self._record_event(EmailVerified(
            user_id=self.id,
            email=str(self._email.address),
        ))

    def record_login(self) -> None:
        """Record a successful login attempt."""
        self._failed_login_attempts = 0

    def record_failed_login(self) -> None:
        """Record a failed login attempt. Lock account after threshold."""
        self._failed_login_attempts += 1
        if self._failed_login_attempts >= 5:
            self.lock("Too many failed login attempts")

    def lock(self, reason: str) -> None:
        """Lock the account."""
        self._status = UserStatus.LOCKED
        from .events import AccountLocked
        self._record_event(AccountLocked(
            user_id=self.id,
            reason=reason,
        ))

    def unlock(self) -> None:
        """Unlock the account."""
        self._status = UserStatus.ACTIVE
        self._failed_login_attempts = 0

    def disable(self, reason: str) -> None:
        """Disable the account."""
        self._status = UserStatus.DISABLED
        from .events import AccountDisabled
        self._record_event(AccountDisabled(
            user_id=self.id,
            reason=reason,
        ))

    def change_password(self, new_password_hash: str) -> None:
        """Change password."""
        self._password_hash = new_password_hash
        self._password_changed_at = utcnow()
        from .events import PasswordChanged
        self._record_event(PasswordChanged(user_id=self.id))


class Session(Entity):
    """An authenticated device/session with refresh token tracking."""

    def __init__(
        self,
        user_id: UUID,
        refresh_token_hash: str,
        device_info: DeviceInfo,
        ip_address: str,
        id: UUID | None = None,
    ) -> None:
        super().__init__(id)
        self._user_id = user_id
        self._refresh_token_hash = refresh_token_hash
        self._device_info = device_info
        self._ip_address = ip_address
        self._last_used_at = utcnow()
        self._revoked_at: datetime | None = None

    @property
    def user_id(self) -> UUID:
        return self._user_id

    @property
    def is_revoked(self) -> bool:
        return self._revoked_at is not None

    def revoke(self) -> None:
        """Revoke this session."""
        self._revoked_at = utcnow()

    def update_last_used(self) -> None:
        self._last_used_at = utcnow()
