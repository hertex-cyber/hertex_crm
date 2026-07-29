"""JWT access token and opaque refresh token generation."""

from __future__ import annotations

import secrets
import uuid
from datetime import timedelta
from hashlib import sha256

import jwt
from django.conf import settings
from django.utils import timezone

from apps.shared_kernel.domain.base import UUID


class TokenService:
    """Handles JWT access token and opaque refresh token generation.

    Access tokens: RS256 JWTs with 15-minute lifetime.
    Refresh tokens: cryptographically random opaque strings,
    stored hashed in the Session model for revocation support.
    """

    ACCESS_TOKEN_LIFETIME = timedelta(minutes=15)
    REFRESH_TOKEN_LIFETIME = timedelta(days=7)
    REFRESH_TOKEN_BYTES = 48

    def generate_access_token(
        self,
        user_id: uuid.UUID,
        organization_id: uuid.UUID | None = None,
    ) -> str:
        now = timezone.now()
        payload = {
            "sub": str(user_id),
            "iss": settings.JWT_ISSUER,
            "aud": settings.JWT_AUDIENCE,
            "iat": int(now.timestamp()),
            "exp": int((now + self.ACCESS_TOKEN_LIFETIME).timestamp()),
            "jti": str(UUID.v7()),
            "type": "access",
        }
        if organization_id:
            payload["org"] = str(organization_id)
        return jwt.encode(
            payload,
            settings.JWT_PRIVATE_KEY,
            algorithm=settings.JWT_ALGORITHM,
        )

    def generate_refresh_token(self) -> tuple[str, str]:
        """Generate an opaque refresh token and its SHA-256 hash.

        Returns (raw_token, hashed_token). Store the hash, return the raw value.
        """
        raw = secrets.token_urlsafe(self.REFRESH_TOKEN_BYTES)
        hashed = sha256(raw.encode()).hexdigest()
        return raw, hashed

    def hash_refresh_token(self, raw_token: str) -> str:
        return sha256(raw_token.encode()).hexdigest()

    def get_refresh_token_expiry(self) -> str:
        return timezone.now() + self.REFRESH_TOKEN_LIFETIME
