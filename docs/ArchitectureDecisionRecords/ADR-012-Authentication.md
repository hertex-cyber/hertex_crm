# ADR-012: Authentication — JWT (RS256) with Access + Refresh Tokens

- **Status:** Accepted
- **Date:** 2025-07-27
- **Authors:** Chief Architect, Security Lead

## Context

TZAHU CRM requires stateless authentication for REST APIs, supporting multi-tenant access, role-based permissions, and integration with third-party systems. The auth system must be secure, performant, and compliant with enterprise security requirements.

## Options Considered

### 1. JWT Access + Refresh with RS256 (Selected)
- **Pros:** Stateless (no DB lookup on each request), RS256 asymmetric signing (private key signs, public key verifies), access tokens short-lived (15 min), refresh tokens longer-lived (7 days), token rotation for refresh, revocable via blacklist (Redis), multi-service friendly (FastAPI sidecar also validates with same public key), standard (RFC 7519), well-supported by DRF (djangorestframework-simplejwt).
- **Cons:** Token revocation requires blacklist (Redis), token size (~1KB with claims), no built-in session management on server side, RS256 is slower than HS256 (asymmetric crypto), requires key management (rotation, storage).

### 2. Session-Based Auth (Django Session Middleware)
- **Pros:** Server-side session (revocable immediately), no token size concerns, built-in CSRF protection, simple, mature.
- **Cons:** Stateful (requires session store lookup on each request), not suitable for mobile/SPA clients without CSRF workarounds, session store (Redis/DB) becomes bottleneck, cross-service auth requires session sharing.

### 3. Django REST Framework Session Auth + CSRF Tokens
- **Pros:** Same as session-based, plus DRF support for cookie-based auth with CSRF.
- **Cons:** Same as session-based, CSRF token management in SPA adds complexity, mobile app auth is difficult, API key rotation is manual.

### 4. OAuth 2.0 (Authorization Code Flow with PKCE)
- **Pros:** Industry standard for third-party auth, supports social login (Google, Microsoft), delegation, fine-grained scopes.
- **Cons:** Significant protocol complexity (redirects, code exchange, token refresh), requires authorization server (Auth0, Keycloak, or Django OAuth Toolkit), over-engineering for first-party auth, UX friction of redirects.

## Decision

**Use JWT (RS256) access + refresh tokens** for API authentication.

Implementation:
- `djangorestframework-simplejwt` for JWT issuance and validation
- RS256 signing with 2048-bit RSA key pair
- Access token: 15-minute TTL, includes `tenant_id`, `user_id`, `role`, `permissions`
- Refresh token: 7-day TTL, stored in Redis for revocation
- Token blacklist: Redis set for revoked tokens (checked on each request)
- Token refresh: Returns new access + refresh token (rotation, old refresh invalidated)
- Multi-service: FastAPI sidecar validates access tokens using the same RS256 public key
- Password hashing: Django's PBKDF2 (default) with bcrypt upgrade path

Auth flows:
- Login: `POST /api/v1/auth/login/` → returns tokens + user profile
- Register: `POST /api/v1/auth/register/` → creates user, returns tokens
- Refresh: `POST /api/v1/auth/refresh/` → rotates tokens
- Logout: `POST /api/v1/auth/logout/` → blacklists refresh token

## Consequences

- **Positive:** Stateless auth (no session DB), cross-service compatible with FastAPI sidecar, standard JWT.
- **Positive:** RS256 enables key separation (private key on auth service, public key deployed widely).
- **Negative:** Access tokens cannot be revoked until expiry (mitigated by 15-min TTL + blacklist for emergencies).
- **Negative:** JWT size can impact HTTP headers (keep claims minimal: only IDs, not full profile).
- **Negative:** Key rotation requires coordination (generate new key pair, validate with both during rotation window).

## Compliance

- All API endpoints require JWT Bearer auth (except register, login, verify-email, forgot-password, reset-password).
- CI test: `python manage.py check_jwt_config` validates RS256 key existence and permissions.
- PR review: No endpoints with `authentication_classes = []` without security review.
- Penetration testing: JWT attack vectors verified (alg=none, weak key, token replay).
- Key rotation: Automated via management command, run quarterly.
