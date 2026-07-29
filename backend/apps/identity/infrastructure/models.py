"""Identity Django ORM models."""

import uuid

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone as tz


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("status", "ACTIVE")
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True, max_length=320)
    email_verified_at = models.DateTimeField(null=True, blank=True)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    timezone = models.CharField(max_length=64, default="UTC")
    locale = models.CharField(max_length=10, default="en")
    avatar = models.ImageField(upload_to="avatars/", blank=True, null=True)
    status = models.CharField(
        max_length=32,
        default="PENDING_VERIFICATION",
        choices=[
            ("PENDING_VERIFICATION", "Pending Verification"),
            ("ACTIVE", "Active"),
            ("LOCKED", "Locked"),
            ("DISABLED", "Disabled"),
        ],
    )
    failed_login_attempts = models.IntegerField(default=0)
    last_login_at = models.DateTimeField(null=True, blank=True)
    last_login_ip = models.GenericIPAddressField(null=True, blank=True)
    is_staff = models.BooleanField(default=False)
    is_superuser = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    date_joined = models.DateTimeField(default=tz.now)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["first_name", "last_name"]

    class Meta:
        db_table = "identity_users"
        indexes = [
            models.Index(fields=["email"], name="idx_users_email"),
            models.Index(fields=["status"], name="idx_users_status"),
        ]

    def __str__(self) -> str:
        return self.email


class Session(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="sessions"
    )
    refresh_token_hash = models.CharField(max_length=256)
    device_name = models.CharField(max_length=256, blank=True)
    device_type = models.CharField(max_length=32, blank=True)
    os = models.CharField(max_length=64, blank=True)
    browser = models.CharField(max_length=64, blank=True)
    ip_address = models.GenericIPAddressField()
    last_used_at = models.DateTimeField(default=tz.now)
    expires_at = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "identity_sessions"
        indexes = [
            models.Index(fields=["user"], name="idx_sessions_user"),
            models.Index(fields=["expires_at"], name="idx_sessions_expires"),
        ]


class PasswordHistory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="password_history")
    password_hash = models.CharField(max_length=256)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "identity_password_history"
        indexes = [
            models.Index(fields=["user"], name="idx_pwd_history_user"),
        ]


class PasswordResetToken(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="password_reset_tokens")
    token_hash = models.CharField(max_length=256, unique=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "identity_password_reset_tokens"
        indexes = [
            models.Index(fields=["token_hash"], name="idx_pwd_reset_token"),
            models.Index(fields=["user"], name="idx_pwd_reset_user"),
        ]

    @property
    def is_expired(self) -> bool:
        return timezone.now() >= self.expires_at

    @property
    def is_used(self) -> bool:
        return self.used_at is not None
