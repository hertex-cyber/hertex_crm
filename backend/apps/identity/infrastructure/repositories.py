"""Identity repository implementations."""

from __future__ import annotations

from django.contrib.auth.hashers import make_password, check_password
from django.utils import timezone

from apps.identity.domain.entities import Session as SessionEntity
from apps.identity.domain.entities import User, UserStatus
from apps.identity.domain.value_objects import DeviceInfo, UserPreferences
from apps.identity.infrastructure.models import Session as SessionModel
from apps.identity.infrastructure.models import User as UserModel
from apps.shared_kernel.application.ports import Repository
from apps.shared_kernel.domain.base import UUID
from apps.shared_kernel.domain.result import PaginatedResult
from apps.shared_kernel.domain.value_objects import Email, PersonName


class UserRepository(Repository[User]):
    """Django ORM-based repository for User aggregate."""

    def get_by_id(self, id: UUID) -> User | None:
        try:
            instance = UserModel.objects.get(id=id)
            return self._to_domain(instance)
        except UserModel.DoesNotExist:
            return None

    def get_by_email(self, email: str) -> User | None:
        try:
            instance = UserModel.objects.get(email=email)
            return self._to_domain(instance)
        except UserModel.DoesNotExist:
            return None

    def save(self, entity: User) -> User:
        instance, created = UserModel.objects.update_or_create(
            id=entity.id,
            defaults={
                "email": str(entity.email.address),
                "first_name": entity.display_name.first_name,
                "last_name": entity.display_name.last_name,
                "status": entity.status.value,
                "password": entity._password_hash,
                "failed_login_attempts": entity._failed_login_attempts,
                "email_verified_at": entity._email_verified_at,
            },
        )
        return self._to_domain(instance)

    def delete(self, entity: User) -> None:
        UserModel.objects.filter(id=entity.id).delete()

    def list(self, **filters) -> PaginatedResult[User]:
        qs = UserModel.objects.all()
        if "status" in filters:
            qs = qs.filter(status=filters["status"])
        if "search" in filters:
            qs = qs.filter(email__icontains=filters["search"])
        users = [self._to_domain(u) for u in qs]
        return PaginatedResult(items=users, total_count=len(users), page=1, page_size=len(users))

    def _to_domain(self, instance: UserModel) -> User:
        user = User(
            email=Email(instance.email),
            display_name=PersonName(instance.first_name, instance.last_name),
            id=instance.id,
            status=UserStatus(instance.status),
            email_verified_at=instance.email_verified_at,
            password_hash=instance.password,
            password_changed_at=instance.last_login_at,
        )
        return user


class SessionRepository:
    """Django ORM-based repository for Session entities."""

    def create(
        self,
        user_id: UUID,
        refresh_token_hash: str,
        device_info: DeviceInfo,
        ip_address: str,
        id: UUID | None = None,
    ) -> SessionEntity:
        from apps.identity.infrastructure.models import Session as SessionModel

        expires_at = timezone.now() + timezone.timedelta(days=7)
        instance = SessionModel.objects.create(
            id=id or UUID.v7(),
            user_id=user_id,
            refresh_token_hash=refresh_token_hash,
            device_name=device_info.name,
            device_type=device_info.device_type,
            os=device_info.os,
            browser=device_info.browser,
            ip_address=ip_address,
            expires_at=expires_at,
        )
        return self._to_domain(instance)

    def get_by_id(self, session_id: UUID) -> SessionEntity | None:
        try:
            instance = SessionModel.objects.get(id=session_id)
            return self._to_domain(instance)
        except SessionModel.DoesNotExist:
            return None

    def get_by_refresh_token_hash(self, token_hash: str) -> SessionEntity | None:
        try:
            instance = SessionModel.objects.get(
                refresh_token_hash=token_hash,
                revoked_at__isnull=True,
            )
            return self._to_domain(instance)
        except SessionModel.DoesNotExist:
            return None

    def save(self, entity: SessionEntity) -> SessionEntity:
        SessionModel.objects.filter(id=entity.id).update(
            last_used_at=entity._last_used_at,
            revoked_at=entity._revoked_at,
        )
        return entity

    def list_active_for_user(self, user_id: UUID) -> list[SessionEntity]:
        qs = SessionModel.objects.filter(
            user_id=user_id,
            revoked_at__isnull=True,
            expires_at__gt=timezone.now(),
        )
        return [self._to_domain(s) for s in qs]

    def revoke_all_for_user(self, user_id: UUID) -> int:
        count, _ = SessionModel.objects.filter(
            user_id=user_id,
            revoked_at__isnull=True,
        ).update(revoked_at=timezone.now())
        return count

    def _to_domain(self, instance: SessionModel) -> SessionEntity:
        device_info = DeviceInfo(
            name=instance.device_name,
            device_type=instance.device_type,
            os=instance.os,
            browser=instance.browser,
        )
        session = SessionEntity(
            user_id=instance.user_id,
            refresh_token_hash=instance.refresh_token_hash,
            device_info=device_info,
            ip_address=instance.ip_address,
            id=instance.id,
        )
        if instance.revoked_at:
            session._revoked_at = instance.revoked_at
        return session
