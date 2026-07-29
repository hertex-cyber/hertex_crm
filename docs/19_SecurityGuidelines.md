# TZAHU CRM — Security Guidelines

> **Version:** 0.1.0-draft
> **Last Updated:** 2026-07-27
> **Status:** Approved
> **Owner:** Platform Architecture Team

---

## Table of Contents

1. [Security Principles](#1-security-principles)
2. [Authentication](#2-authentication)
3. [Authorization (RBAC)](#3-authorization-rbac)
4. [Multi-Factor Authentication (MFA)](#4-multi-factor-authentication-mfa)
5. [Single Sign-On (SSO)](#5-single-sign-on-sso)
6. [Data Security](#6-data-security)
7. [Password Policy](#7-password-policy)
8. [API Security](#8-api-security)
9. [Row-Level Security (RLS)](#9-row-level-security-rls)
10. [Audit & Compliance](#10-audit--compliance)
11. [OWASP Top 10 Mitigation](#11-owasp-top-10-mitigation)
12. [Security Incident Response](#12-security-incident-response)
13. [Third-Party & Dependency Security](#13-third-party--dependency-security)

---

## 1. Security Principles

1. **Defense in depth.** Multiple layers of security — network, application, data, encryption.
2. **Least privilege.** Every user, service, and process gets the minimum permissions required.
3. **Default deny.** All access is denied unless explicitly granted.
4. **Secure by default.** Security-sensitive features are opt-out, not opt-in.
5. **Never trust user input.** All input is validated, sanitized, and parameterized.
6. **Fail securely.** Errors reveal no sensitive information.
7. **Separation of duties.** No single user has end-to-end control of sensitive operations.
8. **Privacy by design.** PII is minimized, encrypted, and access-controlled.

---

## 2. Authentication

### JWT Configuration

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Algorithm | RS256 | Asymmetric — private key signs, public key verifies |
| Access token TTL | 15 minutes | Short-lived to limit exposure |
| Refresh token TTL | 7 days | Balance UX with security |
| Token refresh | Rotation | Old refresh token invalidated on use |
| Issuer | `tzahu-crm` | Identifies token origin |
| Audience | `tzahu-api` | Identifies intended recipient |

### Key Management
- Private key stored in AWS Secrets Manager / Vault.
- Public key exposed via `/.well-known/jwks.json`.
- Key rotation: every 90 days (automated via cron).
- Key history: previous 2 public keys retained for token validity during rotation.

### JWT Payload
```json
{
  "sub": "0190a3b2-...",
  "org_id": "0190a3b2-...",
  "role": "org_admin",
  "perms_hash": "sha256(org_id + role + version)",
  "iat": 1722080000,
  "exp": 1722080900,
  "jti": "0190a3b2-...",
  "iss": "tzahu-crm",
  "aud": "tzahu-api",
  "type": "access"
}
```

### Refresh Token Rotation
```python
class TokenService:
    def refresh_access_token(self, refresh_token: str) -> Result[TokenPair, AuthError]:
        decoded = self._decode_refresh_token(refresh_token)
        if decoded is None:
            return Result.failure(InvalidTokenError("Invalid or expired refresh token"))

        # Rotation: invalidate old refresh token
        self._invalidate_refresh_token(decoded.jti)

        # Generate new pair
        new_access = self._create_access_token(decoded.sub, decoded.org_id, decoded.role)
        new_refresh = self._create_refresh_token(decoded.sub, decoded.org_id, decoded.role)

        return Result.success(TokenPair(access=new_access, refresh=new_refresh))
```

### Rate Limiting on Login
```python
class LoginRateThrottle(SimpleRateThrottle):
    rate = "5/min"
    scope = "login_attempts"

    def get_cache_key(self, request, view):
        ident = request.data.get("email", request.META.get("REMOTE_ADDR", ""))
        return f"login_attempts_{ident}"
```

- 5 attempts per email per minute.
- 20 attempts per IP per minute.
- After 5 consecutive failures: lockout for 15 minutes.
- Account lockout: 30 minutes after 10 failed attempts (configurable per org policy).

### Session Invalidation
- Password change: invalidate all sessions.
- MFA enrollment/removal: invalidate all sessions.
- Role change: invalidate on next token refresh.
- Admin forced logout: immediate token blacklist in Redis.

---

## 3. Authorization (RBAC)

### Permission Model
- **Permission**: `{entity}.{action}` — e.g., `lead.create`, `lead.view`, `lead.update`, `lead.delete`, `lead.assign`.
- **Role**: Named collection of permissions — e.g., `Sales Rep`, `Sales Manager`, `Org Admin`.
- **Assignment**: User + Role + Scope (organization-level or entity-level).

### Standard Roles
| Role | Permissions | Scope |
|------|-------------|-------|
| System Admin | All | Global |
| Org Admin | Org-level CRUD + user management | Organization |
| Sales Manager | Lead/opportunity CRUD + assign + report view | Organization |
| Sales Rep | Lead/opportunity CRUD (self-assigned) | Self |
| Read Only | View all | Organization |
| Integration | API access via service account | Organization |

### Permission Naming Matrix
| Entity | view | create | update | delete | assign | export | import |
|--------|------|--------|--------|--------|--------|--------|--------|
| lead | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| contact | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ |
| opportunity | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| pipeline | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| workflow | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| report | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ |
| user | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ |
| organization | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ |
| settings | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ |
| audit | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ |

### Permission Check Flow
```
Request → Authentication (JWT) → Authorization (RBAC) → Tenant Isolation (RLS)
```

### DRF Permission Implementation
```python
class RolePermission(BasePermission):
    """Check user has required permission for the requested action."""

    action_permission_map: dict[str, str] = {
        "list": "{entity}.view",
        "retrieve": "{entity}.view",
        "create": "{entity}.create",
        "update": "{entity}.update",
        "partial_update": "{entity}.update",
        "destroy": "{entity}.delete",
    }

    def __init__(self, entity: str):
        self.entity = entity

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        perm = self.action_permission_map[view.action].format(entity=self.entity)
        return request.user.has_perm(perm)
```

---

## 4. Multi-Factor Authentication (MFA)

### Supported Methods
- **TOTP** (Time-based One-Time Password): RFC 6238, 30-second window, 6 digits.
- **Backup codes**: 10 single-use codes, regenerated on request.
- Recovery flow: email verification + security questions (configurable).

### MFA Enrollment Flow
1. Admin or user enables MFA from settings.
2. Server generates TOTP secret, returns QR code URI.
3. User scans with authenticator app (Google Authenticator, Authy, etc.).
4. User submits code from app; server verifies.
5. On success: secret stored (AES-256 encrypted), backup codes generated and displayed.
6. MFA required on next login.

### MFA Enforcement
- Per-org policy: optional / required for all / required for admins only.
- Grace period: configurable (default 7 days) before enforcement kicks in.
- Trusted devices: optional 30-day cookie to skip MFA.

### Django MFA Implementation
```python
class MfaService:
    def generate_totp_secret(self, user: User) -> tuple[str, str]:
        secret = pyotp.random_base32()
        uri = pyotp.totp.TOTP(secret).provisioning_uri(
            name=user.email,
            issuer_name="TZAHU CRM",
        )
        return secret, uri

    def verify_totp(self, user: User, code: str) -> bool:
        secret = self._decrypt_secret(user.mfa_secret_encrypted)
        totp = pyotp.TOTP(secret)
        return totp.verify(code, valid_window=1)

    def generate_backup_codes(self, user: User) -> list[str]:
        codes = [secrets.token_hex(4) for _ in range(10)]
        hashed = [hashlib.sha256(c.encode()).hexdigest() for c in codes]
        user.mfa_backup_codes_hashed = hashed
        user.save(update_fields=["mfa_backup_codes_hashed"])
        return codes
```

---

## 5. Single Sign-On (SSO)

### Supported Protocols
- **SAML 2.0**: Enterprise customers with Active Directory / ADFS.
- **OIDC**: Customers using Google Workspace, Azure AD, Okta.
- **JIT Provisioning**: Users created on first SSO login.
- **Group Sync**: Role mapping via SAML/OIDC group claims.

### SSO Configuration (Per Organization)
| Setting | Description |
|---------|-------------|
| `sso_provider` | `saml` or `oidc` |
| `sso_entity_id` | Entity ID / Client ID |
| `sso_acs_url` | Assertion Consumer Service URL |
| `sso_certificate` | Public certificate for SAML response verification |
| `sso_group_mapping` | `{"SAML_GROUP": "TZAHU_ROLE"}` |
| `sso_jit_provisioning` | Boolean — auto-create users |
| `sso_enforced` | Boolean — disable password login |

### Implementation (Phase 11)
```python
class SamlAuthView(APIView):
    def post(self, request):
        # 1. Verify SAML response signature
        # 2. Extract NameID, email, groups
        # 3. Find or create user (JIT provisioning)
        # 4. Sync group → role mapping
        # 5. Issue JWT tokens
        # 6. Redirect to frontend with tokens
        ...
```

---

## 6. Data Security

### Encryption at Rest
| Data | Method | Key Management |
|------|--------|----------------|
| Database (entire) | AWS RDS encryption (AES-256) | AWS KMS |
| PII columns (email, phone) | pgcrypto `pgp_sym_encrypt` | Application-level key in Vault |
| OAuth tokens | AES-256-GCM with per-token IV | Vault transit engine |
| MFA secrets | AES-256-GCM with per-user IV | Vault transit engine |
| File uploads | Server-side encryption (S3/MinIO) | AWS KMS |
| Backups | AES-256 (pg_dump -Fc) | Separate backup key |

### PII Column Encryption
```python
class LeadModel(TenantScopedModel):
    email_encrypted = models.BinaryField(null=True)
    phone_encrypted = models.BinaryField(null=True)

    def set_email(self, email: str) -> None:
        self.email_encrypted = encrypt_pgp(email)

    def get_email(self) -> str | None:
        if self.email_encrypted:
            return decrypt_pgp(self.email_encrypted)
        return None
```

### Encryption in Transit
- TLS 1.3 minimum for all external communications.
- mTLS for service-to-service communication within the cluster.
- Internal traffic: encrypted via K8s network policies + wireguard sidecar.
- Database connections: TLS enforced (reject non-TLS connections).

### Secrets Management
- **Never** store secrets in code, config files, or environment variables in dev.
- Production secrets in AWS Secrets Manager / HashiCorp Vault.
- Accessed via External Secrets Operator (K8s).
- Rotation policy:
  - Database passwords: 90 days.
  - JWT signing keys: 90 days.
  - API keys (third-party): 180 days.
  - Encryption keys: 1 year.

---

## 7. Password Policy

### Requirements
| Rule | Value |
|------|-------|
| Minimum length | 12 characters |
| Maximum length | 128 characters |
| Complexity | 3 of 4: uppercase, lowercase, digit, special |
| Password history | 5 (cannot reuse last 5 passwords) |
| Maximum age | 90 days |
| Account lockout | 5 attempts → 15 min lockout |
| Maximum lockout duration | 30 min (or admin reset) |
| Failed attempts reset | After successful login |

### Implementation
```python
class PasswordPolicy:
    MIN_LENGTH = 12
    MAX_LENGTH = 128
    HISTORY_COUNT = 5
    MAX_AGE_DAYS = 90
    LOCKOUT_THRESHOLD = 5
    LOCKOUT_DURATION_MINUTES = 15

    @staticmethod
    def validate(password: str) -> list[str]:
        errors = []
        if len(password) < PasswordPolicy.MIN_LENGTH:
            errors.append(f"Must be at least {PasswordPolicy.MIN_LENGTH} characters")
        if len(password) > PasswordPolicy.MAX_LENGTH:
            errors.append(f"Must be at most {PasswordPolicy.MAX_LENGTH} characters")
        categories = sum([
            bool(re.search(r'[A-Z]', password)),
            bool(re.search(r'[a-z]', password)),
            bool(re.search(r'\d', password)),
            bool(re.search(r'[!@#$%^&*(),.?":{}|<>]', password)),
        ])
        if categories < 3:
            errors.append("Must contain 3 of 4: uppercase, lowercase, digit, special character")
        return errors
```

### Password Storage
- Algorithm: Argon2id (memory-hard, resistant to GPU attacks).
- Django setting: `PASSWORD_HASHERS = ["django.contrib.auth.hashers.Argon2PasswordHasher"]`.
- Parameters: `time_cost=3, memory_cost=65536, parallelism=4`.

---

## 8. API Security

### CORS
```python
CORS_ALLOWED_ORIGINS = [
    "https://app.tzahu.com",
    "https://*.tzahu.com",
]
CORS_ALLOW_CREDENTIALS = True
CORS_EXPOSE_HEADERS = ["X-RateLimit-Limit", "X-RateLimit-Remaining", "X-Request-Id"]
```

### CSRF
- CSRF tokens required for session-based auth (admin panel).
- Token-based auth (JWT) does not require CSRF — tokens are not browser-stored automatically.
- `CSRF_TRUSTED_ORIGINS` set to the frontend domain.

### SQL Injection Prevention
- **No raw SQL** in application code. ORM only.
- Exception: migrations (documented in ADR).
- Exception: complex reporting queries — use parameterized queries only.
- All user input goes through Django ORM parameterization.

### XSS Prevention
- React handles XSS by default via JSX escaping.
- Django templates: `|escape` filter on all user content.
- `Content-Security-Policy` header:
  ```
  default-src 'self';
  script-src 'self' 'strict-dynamic';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:;
  connect-src 'self' https://api.tzahu.com wss://api.tzahu.com;
  ```
- `X-Content-Type-Options: nosniff`.
- `X-Frame-Options: DENY`.

### Request Size Limits
| Component | Limit |
|-----------|-------|
| Request body (API) | 10 MB |
| File upload (single) | 50 MB |
| File upload (batch) | 200 MB |
| URL length | 8 KB |
| Header size | 16 KB |

```python
DATA_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = 50 * 1024 * 1024
```

### Security Headers (Nginx)
```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'strict-dynamic'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://api.tzahu.com wss://api.tzahu.com;";
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header X-XSS-Protection "0" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
```

---

## 9. Row-Level Security (RLS)

### 6-Layer Tenant Isolation

| Layer | Technology | Scope |
|-------|-----------|-------|
| 1. Network | VPC, security groups | All traffic |
| 2. Authentication | JWT with org_id claim | API access |
| 3. Middleware | `TenantResolutionMiddleware` | Request context |
| 4. Application | DRF queryset filtering | View-level |
| 5. Database | PostgreSQL RLS | Row-level |
| 6. Audit | Cross-tenant leak detection | CI/CD |

### Template per Table
```sql
-- Every tenant-scoped table gets these 4 policies
CREATE POLICY {table}_select_tenant ON {table}
FOR SELECT USING (organization_id = current_setting('app.current_org_id')::uuid);

CREATE POLICY {table}_insert_tenant ON {table}
FOR INSERT WITH CHECK (organization_id = current_setting('app.current_org_id')::uuid);

CREATE POLICY {table}_update_tenant ON {table}
FOR UPDATE USING (organization_id = current_setting('app.current_org_id')::uuid);

CREATE POLICY {table}_delete_tenant ON {table}
FOR DELETE USING (organization_id = current_setting('app.current_org_id')::uuid);
```

### Force RLS
```sql
ALTER TABLE leads FORCE ROW LEVEL SECURITY;
```
`FORCE RLS` ensures RLS applies even to the table owner (Django user).

### Automated Policy Verification
```python
def verify_rls_policies():
    """Check every tenant-scoped table has RLS enabled and forced."""
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT relname, relrowsecurity, relforcerowsecurity
            FROM pg_class
            WHERE relkind = 'r'
              AND relnamespace = 'public'::regnamespace
              AND relname NOT IN (
                  'django_migrations', 'django_content_type',
                  'django_session', 'auth_permission', 'auth_group'
              )
            ORDER BY relname;
        """)
        tables = cursor.fetchall()
        for table, rls_enabled, rls_forced in tables:
            if not rls_enabled:
                raise RLSViolation(f"Table {table} does not have RLS enabled")
            if not rls_forced:
                raise RLSViolation(f"Table {table} does not have FORCE RLS")
```

---

## 10. Audit & Compliance

### Security Events Logged (Immutable)
| Event Category | Events |
|---------------|--------|
| Authentication | Login success, login failure, logout, token refresh, password change |
| MFA | MFA enabled, MFA disabled, backup codes generated, recovery used |
| SSO | SSO login, SSO failure, SSO config changed |
| User management | User created, role changed, user suspended, user deleted |
| Organization | Org created, org suspended, org settings changed |
| Permission | Role created, role modified, permission granted, permission revoked |
| API Security | Rate limit exceeded, invalid token, blocked IP, CORS violation |
| Data access | Bulk export, PII accessed, GDPR data request |
| Integration | API key created, webhook registered, OAuth authorized |

### Audit Trail Requirements
- Append-only: no updates or deletes on audit events.
- Immutable: audit events are write-once, read-many.
- Retention: minimum 3 years (GDPR), 7 years (enterprise contracts).
- Storage: monthly partitioned table (see Database Guidelines).
- Integrity: SHA-256 hash chain linking consecutive events.

### Audit Event Schema
```json
{
  "id": "0190a3b2-...",
  "organizationId": "0190a3b2-...",
  "actorId": "0190a3b2-...",
  "actorEmail": "user@acme.com",
  "eventType": "user.login.failure",
  "severity": "medium",
  "resourceType": "session",
  "resourceId": "0190a3b2-...",
  "action": "login",
  "outcome": "failure",
  "ipAddress": "203.0.113.42",
  "userAgent": "Mozilla/5.0...",
  "correlationId": "0190a3b2-...",
  "details": {
    "reason": "invalid_password",
    "attemptCount": 3
  },
  "timestamp": "2026-07-27T10:30:00Z",
  "previousHash": "0000abc...",
  "hash": "sha256(current)"
}
```

### GDPR Compliance
| Right | Implementation |
|-------|---------------|
| Right to access | `GET /api/v1/gdpr/data-export/` — returns all PII as JSON |
| Right to rectification | Standard CRUD on user profile |
| Right to erasure | Hard delete user + anonymize linked records (not soft delete) |
| Right to restrict processing | `is_processing_restricted` flag |
| Right to data portability | `GET /api/v1/gdpr/data-portability/` — machine-readable format |
| Right to object | Per-processing-purpose opt-out flags |
| Automated decision making | AI features require opt-in; explanation provided |

---

## 11. OWASP Top 10 Mitigation

### A01: Broken Access Control
- RBAC enforced at every endpoint via DRF Permission classes.
- RLS at database level as defense in depth.
- Automated tenant isolation tests in CI.
- Object-level permission checks via `has_object_permission()`.

### A02: Cryptographic Failures
- TLS 1.3 for all communications.
- AES-256 for data at rest.
- Argon2id for password hashing.
- Secrets in Vault, not code.
- Key rotation policy enforced.

### A03: Injection
- ORM-only queries (no raw SQL in application code).
- All user input parameterized via Django ORM.
- `Content-Security-Policy` header prevents script injection.
- React's JSX escaping prevents XSS.

### A04: Insecure Design
- Rate limiting on all auth endpoints.
- Idempotency keys prevent duplicate processing.
- Soft delete prevents accidental data loss.
- Circuit breakers for external service calls.

### A05: Security Misconfiguration
- Infrastructure as Code (Terraform) for consistent environments.
- ConfigMaps for non-sensitive settings; Secrets for sensitive.
- Security scanning in CI (trivy, bandit, safety).
- No debug mode in production.

### A06: Vulnerable & Outdated Components
- Automated dependency scanning (Dependabot + `safety`).
- Weekly dependency updates.
- Container image scanning (trivy) in CI.
- Version pinning in `pyproject.toml` and `package.json`.

### A07: Identification & Authentication Failures
- Short-lived JWT (15 min access, 7 day refresh).
- Account lockout after 5 failed attempts.
- MFA enforced for admin roles.
- Session invalidation on sensitive actions.

### A08: Software & Data Integrity Failures
- Signed JWT (RS256) prevents token tampering.
- Signed webhook payloads (HMAC-SHA256).
- Checksum verification for file uploads.
- Dependency lockfiles (`poetry.lock`, `package-lock.json`).

### A09: Security Logging & Monitoring Failures
- All security events logged to immutable audit trail.
- Real-time alerting on critical security events.
- Centralized logging (CloudWatch / Loki).
- Retention: 3 years minimum.

### A10: Server-Side Request Forgery (SSRF)
- URL allowlist for outgoing webhooks.
- No user-controlled URLs in server-side requests.
- Network policies restrict egress from application pods.
- Internal metadata endpoints blocked (169.254.169.254).

---

## 12. Security Incident Response

### Severity Levels
| Severity | Definition | Response Time | Escalation |
|----------|-----------|---------------|------------|
| Critical | Data breach, active exploitation | < 15 min | CTO + Security Lead |
| High | Vulnerability in core auth/access | < 1 hour | Security Lead + Engineering Lead |
| Medium | Vulnerability in non-critical path | < 1 day | Engineering Lead |
| Low | Best practice violation | < 1 week | Assigned engineer |

### Incident Response Process
1. **Detect** — automated alert or user report.
2. **Triage** — assess severity, contain impact.
3. **Respond** — patch, rotate keys, notify affected users.
4. **Recover** — restore service, verify fix.
5. **Post-mortem** — root cause analysis, preventive measures.

### Key Contacts
- Security Lead: security@tzahu.com
- CTO: cto@tzahu.com
- Compliance: compliance@tzahu.com
- Emergency: on-call@pagerduty.com

---

## 13. Third-Party & Dependency Security

### Dependency Scanning
```yaml
# .github/workflows/dependency-check.yml
- name: Check Python dependencies
  run: safety check --full-report

- name: Check Node dependencies
  run: npm audit

- name: Scan container images
  run: trivy image tzahu-backend:latest
```

### API Key Management
- Third-party API keys stored in Vault.
- Each integration gets a unique key.
- Keys scoped to minimum required permissions.
- Automatic rotation via Vault.
- Audit log for every key usage.

### Webhook Security
- Webhook payloads signed with HMAC-SHA256.
- Signature in `X-Tzahu-Signature` header.
- IP allowlisting for webhook delivery.
- Payload timeout: 5 minutes (replay protection via timestamp).
- Idempotency via `X-Tzahu-Delivery` header.
