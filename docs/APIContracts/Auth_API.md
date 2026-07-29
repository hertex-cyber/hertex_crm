# Auth API — Authentication & Identity Endpoints

Base URL: `/api/v1/auth/`

## Authentication Flow

```
┌─────────┐         ┌──────────┐         ┌──────────┐
│  Client  │         │  Django  │         │  Redis   │
└────┬────┘         └────┬─────┘         └────┬─────┘
     │ POST /login/      │                    │
     │ {email, password} │                    │
     ├──────────────────►│                    │
     │                   │ Verify credentials │
     │                   │ Generate tokens    │
     │                   │ Store refresh hash │
     │                   ├───────────────────►│
     │ 200 {access,      │                    │
     │ refresh, user}    │                    │
     │◄──────────────────┤                    │
     │                   │                    │
     │ POST /refresh/    │                    │
     │ {refresh}         │                    │
     ├──────────────────►│                    │
     │                   │ Verify refresh     │
     │                   │ Rotate tokens      │
     │                   ├───────────────────►│
     │ 200 {access,      │                    │
     │ refresh}          │                    │
     │◄──────────────────┤                    │
```

## Endpoints

---

### POST /api/v1/auth/register/

Register a new user account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecureP@ss123!",
  "password_confirm": "SecureP@ss123!",
  "first_name": "John",
  "last_name": "Doe",
  "company_name": "Acme Corp",
  "phone": "+12025551234",
  "timezone": "America/New_York",
  "locale": "en-US"
}
```

**Response (201):**
```json
{
  "data": {
    "id": "018e0f52-6a7c-7b00-b000-000000000001",
    "type": "user",
    "attributes": {
      "email": "user@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "company_name": "Acme Corp",
      "phone": "+12025551234",
      "timezone": "America/New_York",
      "locale": "en-US",
      "email_verified": false,
      "tenant_id": "018e0f52-6a7c-7b00-b000-000000000002",
      "role": "org_admin",
      "created_at": "2025-07-27T10:00:00Z"
    },
    "links": {
      "self": "/api/v1/users/018e0f52-6a7c-7b00-b000-000000000001/"
    }
  },
  "meta": {
    "tokens": {
      "access": "eyJhbGciOiJSUzI1NiIs...",
      "refresh": "eyJhbGciOiJSUzI1NiIs...",
      "access_expires_in": 900,
      "refresh_expires_in": 604800
    }
  }
}
```

**Errors:** `400` (validation), `409` (email exists)

---

### POST /api/v1/auth/login/

Authenticate and receive JWT tokens.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecureP@ss123!"
}
```

**Response (200):**
```json
{
  "data": {
    "id": "018e0f52-6a7c-7b00-b000-000000000001",
    "type": "user",
    "attributes": {
      "email": "user@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "role": "org_admin",
      "permissions": ["lead.view_lead", "lead.add_lead", "..."],
      "tenant_id": "018e0f52-...",
      "avatar_url": "https://minio.tzahu.com/tenant/avatars/...",
      "email_verified": true
    }
  },
  "meta": {
    "tokens": {
      "access": "eyJhbGciOiJSUzI1NiIs...",
      "refresh": "eyJhbGciOiJSUzI1NiIs...",
      "access_expires_in": 900,
      "refresh_expires_in": 604800
    }
  }
}
```

**Errors:** `401` (invalid credentials), `423` (account locked)

---

### POST /api/v1/auth/refresh/

Refresh an expiring access token.

**Request:**
```json
{
  "refresh": "eyJhbGciOiJSUzI1NiIs..."
}
```

**Response (200):**
```json
{
  "meta": {
    "tokens": {
      "access": "eyJhbGciOiJSUzI1NiIs... (new)",
      "refresh": "eyJhbGciOiJSUzI1NiIs... (rotated)",
      "access_expires_in": 900,
      "refresh_expires_in": 604800
    }
  }
}
```

**Errors:** `401` (invalid/expired refresh token, token blacklisted)

---

### POST /api/v1/auth/logout/

Invalidate refresh token.

**Request:**
```json
{
  "refresh": "eyJhbGciOiJSUzI1NiIs..."
}
```

**Response (204):** No content.

The refresh token is added to the Redis blacklist. Access token remains valid until natural expiry (15 min).

---

### POST /api/v1/auth/verify-email/

Verify email address with token from email.

**Request:**
```json
{
  "token": "verify_abc123def456..."
}
```

**Response (200):**
```json
{
  "data": {
    "message": "Email verified successfully"
  }
}
```

**Errors:** `400` (invalid/expired token)

---

### POST /api/v1/auth/forgot-password/

Request password reset email.

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response (200):**
```json
{
  "data": {
    "message": "If the email exists, a reset link has been sent"
  }
}
```

Always returns 200 (don't reveal whether email exists).

---

### POST /api/v1/auth/reset-password/

Reset password with token from email.

**Request:**
```json
{
  "token": "reset_abc123def456...",
  "password": "NewSecureP@ss456!",
  "password_confirm": "NewSecureP@ss456!"
}
```

**Response (200):**
```json
{
  "data": {
    "message": "Password reset successfully"
  }
}
```

**Errors:** `400` (invalid/expired token, validation)

---

### GET /api/v1/auth/me/

Get current user profile.

**Headers:** `Authorization: Bearer <access_token>`

**Response (200):**
```json
{
  "data": {
    "id": "018e0f52-...",
    "type": "user",
    "attributes": {
      "email": "user@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "role": "org_admin",
      "permissions": [...],
      "tenant_id": "018e0f52-...",
      "tenant_name": "Acme Corp",
      "avatar_url": null,
      "email_verified": true,
      "timezone": "America/New_York",
      "locale": "en-US",
      "last_login_at": "2025-07-27T10:00:00Z",
      "created_at": "2025-06-01T08:00:00Z"
    },
    "links": {
      "self": "/api/v1/users/018e0f52-/",
      "sessions": "/api/v1/auth/sessions/"
    }
  }
}
```

---

### PATCH /api/v1/auth/me/

Update current user profile.

**Request:**
```json
{
  "first_name": "Jonathan",
  "last_name": "Doe",
  "phone": "+12025559999",
  "timezone": "America/Chicago",
  "locale": "en-US"
}
```

**Response (200):** Updated user profile (same schema as GET).

---

### GET /api/v1/auth/sessions/

List active sessions for current user.

**Response (200):**
```json
{
  "data": [
    {
      "id": "sess_018e0f52-...",
      "type": "session",
      "attributes": {
        "device_name": "Chrome 127 on macOS",
        "ip_address": "203.0.113.42",
        "location": "San Francisco, US",
        "last_active_at": "2025-07-27T09:55:00Z",
        "created_at": "2025-07-20T14:30:00Z",
        "is_current": true
      }
    }
  ],
  "meta": {
    "pagination": {
      "total_count": 3
    }
  }
}
```

---

### DELETE /api/v1/auth/sessions/{id}/

Revoke a specific session (logout from that device).

**Response (204):** No content.

Cannot delete current session (must use `POST /logout/`).

---

### POST /api/v1/auth/change-password/

Change password (requires current password).

**Request:**
```json
{
  "current_password": "CurrentP@ss123!",
  "new_password": "NewSecureP@ss456!",
  "new_password_confirm": "NewSecureP@ss456!"
}
```

**Response (200):**
```json
{
  "data": {
    "message": "Password changed successfully"
  }
}
```

**Errors:** `400` (validation), `401` (incorrect current password)

---

## JWT Token Claims

### Access Token
```json
{
  "sub": "018e0f52-...",           // User ID
  "tenant_id": "018e0f53-...",     // Tenant ID
  "role": "org_admin",
  "permissions": ["lead.view_lead", "lead.add_lead"],
  "email": "user@example.com",
  "iat": 1722000000,
  "exp": 1722000900,
  "jti": "jti_018e0f54-..."        // Token ID (for blacklisting)
}
```

### Refresh Token
```json
{
  "sub": "018e0f52-...",
  "tenant_id": "018e0f53-...",
  "type": "refresh",
  "iat": 1722000000,
  "exp": 1722604800,
  "jti": "jti_018e0f55-..."
}
```

## Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/login/` | 10 | 15 min |
| `/register/` | 3 | 60 min |
| `/forgot-password/` | 3 | 60 min |
| `/reset-password/` | 5 | 15 min |
| `/refresh/` | 20 | 15 min |
| `/verify-email/` | 5 | 60 min |
| `/me/` | 60 | 1 min |
| `/sessions/` | 30 | 1 min |

## Error Codes (Auth-specific)

| Code | HTTP | Description |
|------|------|-------------|
| `INVALID_CREDENTIALS` | 401 | Email/password mismatch |
| `ACCOUNT_LOCKED` | 423 | Too many failed attempts |
| `EMAIL_NOT_VERIFIED` | 403 | Email verification required |
| `TOKEN_EXPIRED` | 401 | JWT token expired |
| `TOKEN_BLACKLISTED` | 401 | Token has been revoked |
| `INVALID_TOKEN` | 400 | Malformed or invalid token |
| `WEAK_PASSWORD` | 422 | Password doesn't meet requirements |
| `EMAIL_EXISTS` | 409 | Email already registered |
| `SESSION_NOT_FOUND` | 404 | Session ID not found |
