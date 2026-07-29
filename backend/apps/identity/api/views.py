"""Identity API views — authentication endpoints."""

import uuid
from datetime import timedelta

from django.conf import settings
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

from apps.identity.application.services import (
    RegisterUserCommand,
    RegistrationService,
    LoginUserCommand,
    LoginService,
    ForgotPasswordCommand,
    ResetPasswordCommand,
    PasswordResetService,
    UpdateProfileCommand,
    ProfileService,
    ChangePasswordCommand,
    ChangePasswordService,
    UserService,
)
from apps.identity.domain.value_objects import DeviceInfo
from apps.identity.infrastructure.repositories import SessionRepository, UserRepository
from apps.identity.infrastructure.tokens import TokenService
from apps.shared_kernel.infrastructure.event_bus import CeleryEventPublisher

from .serializers import (
    RegisterSerializer,
    LoginSerializer,
    TokenResponseSerializer,
    RefreshTokenSerializer,
    UserResponseSerializer,
    ForgotPasswordSerializer,
    ResetPasswordSerializer,
    UpdateProfileSerializer,
    ChangePasswordSerializer,
    SessionSerializer,
    UserAdminSerializer,
)


token_service = TokenService()


class AuthViewSet(ViewSet):
    """Authentication endpoints — register, login, refresh, logout."""

    def get_permissions(self):
        if self.action in ("register", "login", "refresh", "forgot_password", "reset_password"):
            return [AllowAny()]
        return [IsAuthenticated()]

    def register(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        cmd = RegisterUserCommand(**serializer.validated_data)
        service = RegistrationService(
            user_repo=UserRepository(),
            event_publisher=CeleryEventPublisher(),
        )
        result = service.execute(cmd)

        if result.is_failure:
            return Response(
                {"error": {"code": "REGISTRATION_FAILED", "message": str(result.error)}},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )

        user = result.value
        return Response(
            {
                "id": str(user.id),
                "email": str(user.email.address),
                "status": user.status.value,
            },
            status=status.HTTP_201_CREATED,
        )

    def login(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        cmd = LoginUserCommand(
            email=serializer.validated_data["email"],
            password=serializer.validated_data["password"],
            ip_address=request.META.get("REMOTE_ADDR", ""),
        )
        service = LoginService(
            user_repo=UserRepository(),
            event_publisher=CeleryEventPublisher(),
        )
        result = service.execute(cmd)

        if result.is_failure:
            return Response(
                {"error": {"code": "LOGIN_FAILED", "message": str(result.error)}},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        user_data = result.value
        user_id = user_data["user_id"]

        device_info = DeviceInfo(
            name=serializer.validated_data.get("device_name", ""),
            device_type=serializer.validated_data.get("device_type", ""),
        )

        access_token = token_service.generate_access_token(user_id)
        raw_refresh, hashed_refresh = token_service.generate_refresh_token()

        session_repo = SessionRepository()
        session_repo.create(
            user_id=user_id,
            refresh_token_hash=hashed_refresh,
            device_info=device_info,
            ip_address=request.META.get("REMOTE_ADDR", ""),
        )

        return Response({
            "access_token": access_token,
            "refresh_token": raw_refresh,
            "token_type": "Bearer",
            "expires_in": int(token_service.ACCESS_TOKEN_LIFETIME.total_seconds()),
        })

    def _serialize_user(self, request, user) -> dict:
        avatar_url = None
        if user.avatar:
            try:
                avatar_url = request.build_absolute_uri(user.avatar.url)
            except Exception:
                avatar_url = None
        return UserResponseSerializer({
            "id": user.id,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "display_name": f"{user.first_name} {user.last_name}",
            "status": user.status,
            "timezone": user.timezone,
            "locale": user.locale,
            "avatar_url": avatar_url,
            "created_at": user.date_joined,
        }).data

    def me(self, request):
        if request.method == "PUT":
            serializer = UpdateProfileSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)

            cmd = UpdateProfileCommand(user_id=str(request.user.id), **serializer.validated_data)
            service = ProfileService(user_repo=UserRepository())
            result = service.update(cmd)

            if result.is_failure:
                return Response(
                    {"error": {"code": "UPDATE_FAILED", "message": str(result.error)}},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            from apps.identity.infrastructure.models import User as UserModel
            user = UserModel.objects.get(id=request.user.id)
            return Response(self._serialize_user(request, user))

        user = request.user
        return Response(self._serialize_user(request, user))

    @action(detail=False, methods=["post"], url_path="change-password")
    def change_password(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        cmd = ChangePasswordCommand(
            user_id=str(request.user.id),
            current_password=serializer.validated_data["current_password"],
            new_password=serializer.validated_data["new_password"],
        )
        service = ChangePasswordService(user_repo=UserRepository())
        result = service.execute(cmd)

        if result.is_failure:
            return Response(
                {"error": {"code": "PASSWORD_CHANGE_FAILED", "message": str(result.error)}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(result.value)

    @action(detail=False, methods=["get"], url_path="sessions")
    def list_sessions(self, request):
        from apps.identity.infrastructure.models import Session as SessionModel
        qs = SessionModel.objects.filter(
            user=request.user,
            revoked_at__isnull=True,
        ).order_by("-created_at")
        return Response(SessionSerializer(qs, many=True).data)

    @action(detail=True, methods=["delete"], url_path="sessions")
    def revoke_session(self, request, pk=None):
        from apps.identity.infrastructure.models import Session as SessionModel
        try:
            session = SessionModel.objects.get(
                id=pk,
                user=request.user,
                revoked_at__isnull=True,
            )
        except SessionModel.DoesNotExist:
            return Response(
                {"error": {"code": "SESSION_NOT_FOUND", "message": "Session not found"}},
                status=status.HTTP_404_NOT_FOUND,
            )

        session.revoked_at = timezone.now()
        session.save(update_fields=["revoked_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    def refresh(self, request):
        serializer = RefreshTokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        token_hash = token_service.hash_refresh_token(
            serializer.validated_data["refresh_token"]
        )
        session_repo = SessionRepository()
        session = session_repo.get_by_refresh_token_hash(token_hash)

        if not session:
            return Response(
                {"error": {"code": "INVALID_REFRESH_TOKEN", "message": "Refresh token is invalid or has been revoked"}},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if session.is_revoked:
            return Response(
                {"error": {"code": "SESSION_REVOKED", "message": "Session has been revoked"}},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        session.revoke()
        session_repo.save(session)

        new_access = token_service.generate_access_token(session.user_id)
        new_raw, new_hashed = token_service.generate_refresh_token()

        session_repo.create(
            user_id=session.user_id,
            refresh_token_hash=new_hashed,
            device_info=session._device_info,
            ip_address=session._ip_address,
        )

        return Response({
            "access_token": new_access,
            "refresh_token": new_raw,
            "token_type": "Bearer",
            "expires_in": int(token_service.ACCESS_TOKEN_LIFETIME.total_seconds()),
        })

    def logout(self, request):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return Response(status=status.HTTP_204_NO_CONTENT)

        refresh_token = request.data.get("refresh_token", "")
        if refresh_token:
            token_hash = token_service.hash_refresh_token(refresh_token)
            session_repo = SessionRepository()
            session = session_repo.get_by_refresh_token_hash(token_hash)
            if session:
                session.revoke()
                session_repo.save(session)

        return Response(status=status.HTTP_204_NO_CONTENT)

    def forgot_password(self, request):
        from apps.identity.infrastructure.models import User as UserModel, PasswordResetToken
        import secrets
        from hashlib import sha256

        serializer = ForgotPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"]
        try:
            user = UserModel.objects.get(email=email)
        except UserModel.DoesNotExist:
            return Response({"message": "If the email exists, a password reset link has been sent."})

        raw_token = secrets.token_urlsafe(32)
        token_hash = sha256(raw_token.encode()).hexdigest()

        PasswordResetToken.objects.create(
            user=user,
            token_hash=token_hash,
            expires_at=timezone.now() + timedelta(hours=1),
        )

        result = {
            "message": "If an account exists with that email, a password reset link has been sent.",
            "reset_token": raw_token,
            "reset_url": f"{getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')}/reset-password?token={raw_token}",
        }

        return Response(result)

    def reset_password(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        service = PasswordResetService(user_repo=UserRepository())
        result = service.reset(ResetPasswordCommand(**serializer.validated_data))

        if result.is_failure:
            return Response(
                {"error": {"code": "RESET_PASSWORD_FAILED", "message": str(result.error)}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(result.value)


class UserViewSet(ViewSet):
    """Admin user management endpoints."""

    def get_permissions(self):
        return [IsAuthenticated()]

    def list(self, request):
        page = int(request.query_params.get("page", 1))
        per_page = int(request.query_params.get("per_page", 20))
        org_id = request.query_params.get("org_id") or request.headers.get("X-Organization-ID")
        service = UserService(user_repo=UserRepository())
        users = service.list_users(page=page, per_page=per_page, org_id=org_id)
        return Response(UserAdminSerializer(users, many=True).data)

    def retrieve(self, request, pk=None):
        try:
            uuid.UUID(str(pk))
        except (ValueError, AttributeError):
            return Response(
                {"error": {"code": "USER_NOT_FOUND", "message": "User not found"}},
                status=status.HTTP_404_NOT_FOUND,
            )
        service = UserService(user_repo=UserRepository())
        user = service.get_user(pk)
        if not user:
            return Response(
                {"error": {"code": "USER_NOT_FOUND", "message": "User not found"}},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(UserAdminSerializer(user).data)
