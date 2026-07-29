"""Identity application services — use cases for authentication and user management."""

from __future__ import annotations

import secrets
from dataclasses import dataclass
from typing import Any
from datetime import timedelta
from hashlib import sha256

from django.conf import settings
from django.utils import timezone

from apps.shared_kernel.application.ports import EventPublisher, Repository
from apps.shared_kernel.domain.errors import ConflictError, NotFoundError, ValidationError
from apps.shared_kernel.domain.result import Result
from apps.shared_kernel.domain.value_objects import Email, PersonName

from apps.identity.domain.entities import User, UserStatus
from apps.identity.domain.value_objects import DeviceInfo


@dataclass
class RegisterUserCommand:
    email: str
    password: str
    first_name: str
    last_name: str
    timezone: str = "UTC"


class RegistrationService:
    """Handles new user registration."""

    def __init__(self, user_repo: Repository[User], event_publisher: EventPublisher):
        self._user_repo = user_repo
        self._event_publisher = event_publisher

    def execute(self, cmd: RegisterUserCommand) -> Result[User, Exception]:
        try:
            email = Email(cmd.email)
        except Exception as e:
            return Result.failure(ValidationError(str(e)))

        existing = self._user_repo.get_by_email(cmd.email)
        if existing:
            return Result.failure(ConflictError("Email already registered", conflicting_id=email.address))

        if len(cmd.password) < 12:
            return Result.failure(ValidationError("Password must be at least 12 characters"))

        user = User(
            email=email,
            display_name=PersonName(cmd.first_name, cmd.last_name),
        )

        from django.contrib.auth.hashers import make_password
        password_hash = make_password(cmd.password)

        user.register(password_hash)
        self._user_repo.save(user)
        self._event_publisher.publish_many(user.collect_events())

        return Result.success(user)


@dataclass
class LoginUserCommand:
    email: str
    password: str
    device_info: DeviceInfo | None = None
    ip_address: str = ""


class LoginService:
    """Handles user authentication."""

    def __init__(self, user_repo: Repository[User], event_publisher: EventPublisher):
        self._user_repo = user_repo
        self._event_publisher = event_publisher

    def execute(self, cmd: LoginUserCommand) -> Result[dict, Exception]:
        user = self._user_repo.get_by_email(cmd.email)
        if not user:
            return Result.failure(NotFoundError("User not found"))

        if user.status == UserStatus.PENDING_VERIFICATION:
            return Result.failure(ValidationError("Please verify your email before logging in"))

        if user.status == UserStatus.DISABLED:
            return Result.failure(ValidationError("Account is disabled"))

        if user.status == UserStatus.LOCKED:
            return Result.failure(ValidationError("Account is locked. Try again later."))

        from django.contrib.auth.hashers import check_password
        if not check_password(cmd.password, user._password_hash):
            user.record_failed_login()
            self._user_repo.save(user)
            if user.status == UserStatus.LOCKED:
                self._event_publisher.publish_many(user.collect_events())
            return Result.failure(ValidationError("Invalid email or password"))

        user.record_login()
        self._user_repo.save(user)
        self._event_publisher.publish_many(user.collect_events())

        return Result.success({
            "user_id": str(user.id),
            "email": str(user.email.address),
            "status": user.status.value,
        })


@dataclass
class ForgotPasswordCommand:
    email: str


@dataclass
class ResetPasswordCommand:
    token: str
    new_password: str


class PasswordResetService:
    """Handles password reset flow — generate token, reset password."""

    RESET_TOKEN_EXPIRY_HOURS = 1

    def __init__(self, user_repo: Repository[User]):
        self._user_repo = user_repo

    def forgot(self, cmd: ForgotPasswordCommand) -> Result[dict, Exception]:
        from apps.identity.infrastructure.models import User as UserModel

        try:
            user_model = UserModel.objects.get(email=cmd.email)
        except UserModel.DoesNotExist:
            return Result.success({"message": "If the email exists, a reset link has been sent."})

        raw_token = secrets.token_urlsafe(32)
        token_hash = sha256(raw_token.encode()).hexdigest()

        from apps.identity.infrastructure.models import PasswordResetToken
        PasswordResetToken.objects.create(
            user=user_model,
            token_hash=token_hash,
            expires_at=timezone.now() + timedelta(hours=self.RESET_TOKEN_EXPIRY_HOURS),
        )

        result = {"message": "If an account exists with that email, a password reset link has been sent."}
        if settings.DEBUG:
            result["reset_token"] = raw_token
            result["reset_url"] = f"{settings.FRONTEND_URL or 'http://localhost:5173'}/reset-password?token={raw_token}"

        return Result.success(result)

    def reset(self, cmd: ResetPasswordCommand) -> Result[dict, Exception]:
        from apps.identity.infrastructure.models import PasswordResetToken

        token_hash = sha256(cmd.token.encode()).hexdigest()
        try:
            reset_token = PasswordResetToken.objects.get(
                token_hash=token_hash,
                used_at__isnull=True,
                expires_at__gt=timezone.now(),
            )
        except PasswordResetToken.DoesNotExist:
            return Result.failure(ValidationError("Invalid or expired reset token"))

        if len(cmd.new_password) < 12:
            return Result.failure(ValidationError("Password must be at least 12 characters"))

        from django.contrib.auth.hashers import make_password
        from apps.identity.infrastructure.models import User as UserModel

        user_model = UserModel.objects.get(id=reset_token.user_id)
        user_model.set_password(cmd.new_password)
        user_model.save(update_fields=["password"])

        reset_token.used_at = timezone.now()
        reset_token.save(update_fields=["used_at"])

        from apps.identity.infrastructure.models import Session as SessionModel
        SessionModel.objects.filter(user=reset_token.user_id, revoked_at__isnull=True).update(
            revoked_at=timezone.now()
        )

        return Result.success({"message": "Password has been reset successfully."})


@dataclass
class UpdateProfileCommand:
    user_id: str
    first_name: str | None = None
    last_name: str | None = None
    timezone: str | None = None
    locale: str | None = None
    avatar: Any | None = None


class ProfileService:
    """Handles user profile updates."""

    def __init__(self, user_repo: Repository[User]):
        self._user_repo = user_repo

    def update(self, cmd: UpdateProfileCommand) -> Result[User, Exception]:
        user = self._user_repo.get_by_id(cmd.user_id)
        if not user:
            return Result.failure(NotFoundError("User not found"))

        from apps.identity.infrastructure.models import User as UserModel
        try:
            user_model = UserModel.objects.get(id=cmd.user_id)
        except UserModel.DoesNotExist:
            return Result.failure(NotFoundError("User not found"))

        changed = False
        if cmd.first_name is not None:
            user_model.first_name = cmd.first_name
            changed = True
        if cmd.last_name is not None:
            user_model.last_name = cmd.last_name
            changed = True
        if cmd.timezone is not None:
            user_model.timezone = cmd.timezone
            changed = True
        if cmd.locale is not None:
            user_model.locale = cmd.locale
            changed = True
        if cmd.avatar is not None:
            user_model.avatar = cmd.avatar
            changed = True

        if changed:
            user_model.save()

        return Result.success(self._user_repo.get_by_id(cmd.user_id))


@dataclass
class ChangePasswordCommand:
    user_id: str
    current_password: str
    new_password: str


class ChangePasswordService:
    """Handles password changes for authenticated users."""

    def __init__(self, user_repo: Repository[User]):
        self._user_repo = user_repo

    def execute(self, cmd: ChangePasswordCommand) -> Result[dict, Exception]:
        from apps.identity.infrastructure.models import User as UserModel
        from django.contrib.auth.hashers import check_password, make_password

        try:
            user_model = UserModel.objects.get(id=cmd.user_id)
        except UserModel.DoesNotExist:
            return Result.failure(NotFoundError("User not found"))

        if not check_password(cmd.current_password, user_model.password):
            return Result.failure(ValidationError("Current password is incorrect"))

        if len(cmd.new_password) < 12:
            return Result.failure(ValidationError("New password must be at least 12 characters"))

        user_model.set_password(cmd.new_password)
        user_model.save(update_fields=["password"])

        from apps.identity.infrastructure.models import Session as SessionModel
        SessionModel.objects.filter(user=cmd.user_id, revoked_at__isnull=True).update(
            revoked_at=timezone.now()
        )

        return Result.success({"message": "Password changed successfully."})


class UserService:
    """Handles admin user management."""

    def __init__(self, user_repo: Repository[User]):
        self._user_repo = user_repo

    def list_users(self, page: int = 1, per_page: int = 20, org_id: str | None = None) -> list[User]:
        from apps.identity.infrastructure.models import User as UserModel
        from apps.organization.infrastructure.models import MembershipModel
        qs = UserModel.objects.all().order_by("-date_joined")
        if org_id:
            member_ids = MembershipModel.objects.filter(
                organization_id=org_id,
                status="ACTIVE",
            ).values_list("user_id", flat=True)
            qs = qs.filter(id__in=list(member_ids))
        offset = (page - 1) * per_page
        users_data = list(qs[offset:offset + per_page].values(
            "id", "email", "first_name", "last_name",
            "status", "timezone", "locale",
            "date_joined", "last_login",
        ))
        return users_data

    def get_user(self, user_id: str) -> dict | None:
        from apps.identity.infrastructure.models import User as UserModel
        try:
            user = UserModel.objects.values(
                "id", "email", "first_name", "last_name",
                "status", "timezone", "locale",
                "date_joined", "last_login",
            ).get(id=user_id)
            return user
        except UserModel.DoesNotExist:
            return None
