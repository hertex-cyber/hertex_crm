"""JWT Authentication backend for DRF."""

from __future__ import annotations

import jwt
from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed


class JWTAuthentication(BaseAuthentication):
    """JWT-based authentication for DRF viewsets.

    Expects: Authorization: Bearer <access_token>
    Token format: RS256-signed JWT with sub (user_id), org (organization_id), exp, iat, jti
    """

    def authenticate(self, request):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return None

        token = auth_header.split(" ", 1)[1]

        try:
            payload = jwt.decode(
                token,
                settings.JWT_PUBLIC_KEY,
                algorithms=[settings.JWT_ALGORITHM],
                audience=settings.JWT_AUDIENCE,
                issuer=settings.JWT_ISSUER,
                options={"verify_exp": True},
            )
        except jwt.ExpiredSignatureError:
            raise AuthenticationFailed("Token expired")
        except jwt.InvalidTokenError as e:
            raise AuthenticationFailed(f"Invalid token: {str(e)}")

        User = get_user_model()
        try:
            user = User.objects.get(id=payload["sub"])
        except User.DoesNotExist:
            raise AuthenticationFailed("User not found")

        if not user.is_active:
            raise AuthenticationFailed("User account is disabled")

        # Attach organization context to the request
        request.organization_id = payload.get("org")
        request.token_payload = payload

        return (user, token)

    def authenticate_header(self, request):
        return "Bearer"
