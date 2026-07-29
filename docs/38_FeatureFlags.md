# TZAHU CRM — Feature Flags

> **Version:** 0.1.0-draft
> **Last Updated:** 2026-07-27
> **Status:** Foundational Design Phase
> **Owner:** Platform Architecture Team

---

## Table of Contents

1. [Overview](#1-overview)
2. [Feature Flag System](#2-feature-flag-system)
3. [Flag Types](#3-flag-types)
4. [Flag Evaluation](#4-flag-evaluation)
5. [Flag Lifecycle](#5-flag-lifecycle)
6. [API](#6-api)
7. [Integration with Subscription Tiers](#7-integration-with-subscription-tiers)
8. [SDK](#8-sdk)
9. [Monitoring](#9-monitoring)

---

## 1. Overview

The Feature Flag system enables gradual rollout, A/B testing, ops kill switches, and entitlement-based feature gating. Flags are database-backed with Redis caching, supporting per-org overrides, percentage rollouts, and per-user targeting for testing.

### 1.1 Design Principles

- **Fast evaluation**: Flag checks are sub-millisecond (Redis cache hit)
- **Gradual rollout**: Percentage-based rollouts with user stickiness
- **Kill switch**: Emergency disable without deployment
- **Auditable**: Every flag evaluation can be logged
- **Self-service**: Admin UI for flag management (no code changes)

---

## 2. Feature Flag System

### 2.1 Data Model

```sql
CREATE TABLE feature_flags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    flag_type VARCHAR(20) NOT NULL,  -- release, experiment, ops, permission
    is_enabled BOOLEAN NOT NULL DEFAULT FALSE,  -- Global default
    rollout_percentage INT DEFAULT 100,         -- 0-100
    metadata JSONB DEFAULT '{}',               -- Additional config per type
    created_by_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE feature_flag_overrides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    flag_id UUID NOT NULL REFERENCES feature_flags(id) ON DELETE CASCADE,
    target_type VARCHAR(20) NOT NULL,  -- organization, user, role
    target_id UUID NOT NULL,           -- org UUID, user UUID, role UUID
    is_enabled BOOLEAN NOT NULL,       -- Override value
    created_by_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(flag_id, target_type, target_id)
);

CREATE INDEX idx_flag_overrides_flag ON feature_flag_overrides(flag_id);
CREATE INDEX idx_flag_overrides_target ON feature_flag_overrides(target_type, target_id);
```

### 2.2 Flag Schema

```python
@dataclass
class FeatureFlag:
    id: UUID
    name: str
    description: str | None
    flag_type: FlagType  # release, experiment, ops, permission
    is_enabled: bool      # Global default
    rollout_percentage: int  # 0-100
    metadata: dict        # Type-specific config
    created_at: datetime
    updated_at: datetime

    def is_active_for(self, org_id: UUID, user_id: UUID | None = None) -> bool:
        """Check if flag is active for a given org/user context."""
        # 1. Check per-user override (highest priority)
        if user_id:
            user_override = self._get_override("user", user_id)
            if user_override is not None:
                return user_override

        # 2. Check per-org override
        org_override = self._get_override("organization", org_id)
        if org_override is not None:
            return org_override

        # 3. Check percentage rollout (sticky per org)
        if self.rollout_percentage < 100:
            if not self._is_in_percentage(org_id):
                return False

        # 4. Return global default
        return self.is_enabled

    def _is_in_percentage(self, org_id: UUID) -> bool:
        """Deterministic hash-based percentage check (sticky per org)."""
        hash_value = int(hashlib.md5(
            f"{self.id}:{org_id}".encode()
        ).hexdigest(), 16) % 100
        return hash_value < self.rollout_percentage

    def _get_override(self, target_type: str, target_id: UUID) -> bool | None:
        """Get override value for a target, or None if no override exists."""
        # Checked from cache first (Redis)
        key = f"flag:override:{self.id}:{target_type}:{target_id}"
        cached = cache.get(key)
        if cached is not None:
            return cached
        return None
```

---

## 3. Flag Types

### 3.1 Release Toggle (Gradual Rollout)

```json
{
  "name": "new-lead-scoring-v2",
  "flag_type": "release",
  "is_enabled": false,
  "rollout_percentage": 0,
  "metadata": {
    "description": "Enable new ML-based lead scoring model",
    "owner": "ai-team",
    "ticket_url": "https://github.com/tzahu/crm/issues/1234",
    "target_date": "2026-08-15"
  }
}
```

Rollout stages:

| Stage | Rollout % | Orgs | Duration | Validation |
|-------|-----------|------|----------|------------|
| Internal | 1% | TZAHU internal org | 3 days | Team dogfooding, bug reports |
| Beta | 5% | Select customer orgs | 7 days | Customer feedback, metrics |
| GA | 25% | Gradual increase over 2 weeks | 14 days | Monitor error rate, latency |
| Full | 100% | All orgs | — | Remove flag after 30 days |

### 3.2 Experiment Toggle (A/B Testing)

```json
{
  "name": "onboarding-flow-v2",
  "flag_type": "experiment",
  "is_enabled": false,
  "rollout_percentage": 50,
  "metadata": {
    "description": "Test new onboarding flow vs existing",
    "owner": "product-team",
    "experiment_id": "exp_2026_07_onboarding",
    "control_name": "existing-flow",
    "treatment_name": "new-flow",
    "metrics": ["signup_completion_rate", "time_to_first_action", "7d_retention"],
    "min_sample_size": 5000,
    "duration_days": 14,
    "started_at": "2026-07-15T00:00:00Z",
    "ended_at": "2026-07-29T00:00:00Z"
  }
}
```

### 3.3 Ops Toggle (Kill Switch)

```json
{
  "name": "integrations-webhook-delivery",
  "flag_type": "ops",
  "is_enabled": true,
  "rollout_percentage": 100,
  "metadata": {
    "description": "Emergency kill switch for all outbound webhooks",
    "owner": "platform-team",
    "emergency_contact": "#oncall-engineering",
    "auto_disable_on_error": true
  }
}
```

Ops toggles are used for:
- Emergency disable of a buggy integration
- Throttle a feature under load (disable non-critical features)
- Circuit breaker for external service degradation

### 3.4 Permission Toggle (Entitlement)

```json
{
  "name": "ai-lead-scoring",
  "flag_type": "permission",
  "is_enabled": false,
  "rollout_percentage": 100,
  "metadata": {
    "description": "AI-powered lead scoring (entitlement)",
    "required_tier": "growth",
    "addon": false,
    "monthly_price_usd": 0
  }
}
```

Permission toggles are tied to subscription tiers:
- Free tier: Basic CRM features only
- Growth tier: AI features, integrations, workflows
- Enterprise tier: All features, including premium AI, SSO, audit logs

---

## 4. Flag Evaluation

### 4.1 Cached in Redis (TTL 60s)

```python
class FeatureFlagService:
    """Feature flag evaluation service with Redis caching."""

    CACHE_TTL = 60  # 60 seconds cache TTL

    def __init__(self):
        self.cache = CacheService("default")

    async def is_active(
        self,
        flag_name: str,
        org_id: UUID,
        user_id: UUID | None = None,
    ) -> bool:
        cache_key = f"flag:{flag_name}:{org_id}:{user_id or 'none'}"

        # 1. Try cache
        cached = await self.cache.get(cache_key)
        if cached is not None:
            return cached

        # 2. Load flag from DB
        flag = await self._load_flag(flag_name)
        if not flag:
            return False

        # 3. Evaluate
        result = flag.is_active_for(org_id, user_id)

        # 4. Cache result
        await self.cache.set(cache_key, result, timeout=self.CACHE_TTL)

        # 5. Log evaluation (sampled at 1%)
        if random.random() < 0.01:
            await self._log_evaluation(flag, org_id, user_id, result)

        return result

    async def get_active_flags(self, org_id: UUID) -> dict[str, bool]:
        """Bulk evaluation of all flags for an org."""
        cache_key = f"flag:all:{org_id}"
        cached = await self.cache.get(cache_key)
        if cached:
            return cached

        flags = await self._load_all_flags()
        result = {}
        for flag in flags:
            result[flag.name] = flag.is_active_for(org_id)

        await self.cache.set(cache_key, result, timeout=self.CACHE_TTL)
        return result
```

### 4.2 Middleware Resolves for Request

```python
class FeatureFlagMiddleware:
    """Middleware that resolves feature flags for the current request."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        org_id = getattr(request, "organization_id", None)
        user_id = getattr(request.user, "id", None)

        if org_id:
            # Resolve all flags for this request context
            request.feature_flags = FeatureFlagService().get_active_flags(org_id)

            # Set flag context for templates
            for flag_name, is_active in request.feature_flags.items():
                setattr(request, f"flag_{flag_name}", is_active)
        else:
            request.feature_flags = {}

        response = self.get_response(request)

        # Add flags to response headers for debugging
        if settings.DEBUG:
            response["X-Feature-Flags"] = json.dumps(request.feature_flags)

        return response
```

### 4.3 Admin UI for Management

The admin UI provides:

1. **Flag Dashboard**: All flags with status, type, and rollout percentage
2. **Override Management**: Set per-org and per-user overrides
3. **Audit Log**: Every flag change is logged with who changed it
4. **Metrics**: Evaluation count, active users per flag
5. **Experiment Dashboard**: A/B test results (if experiment type)

---

## 5. Flag Lifecycle

### 5.1 Lifecycle Stages

```
Create ──► Test (Internal) ──► Beta (Select Orgs) ──► GA (All Orgs) ──► Remove
   │              │                    │                    │              │
   ▼              ▼                    ▼                    ▼              ▼
 Define       Enable for          Enable for           Enable for      Delete flag
 flag in DB   internal org         5% of orgs          100% of orgs    + clean code
```

### 5.2 Lifecycle Timeline

| Stage | Duration | Actions | Conditions |
|-------|----------|---------|------------|
| **Create** | Immediate | Define flag in DB, add code check | Code review approved |
| **Test** | 3-7 days | Enable for internal org only | QA sign-off |
| **Beta** | 7-14 days | Enable for 5% of orgs, collect feedback | Error rate < 0.1% |
| **GA** | 14 days | Gradual rollout 25% → 50% → 100% | 7 days of stable metrics |
| **Remove** | After 30 days GA | Remove flag code, delete flag from DB | All orgs on new behavior |

### 5.3 Flag Cleanup Policy

```python
class FlagCleanupPolicy:
    """Automated flag cleanup reminders and enforcement."""

    def check_stale_flags(self):
        """Find flags that should be removed."""
        stale = []
        for flag in FeatureFlag.objects.filter(is_enabled=True):
            # Flags at 100% for > 30 days should be removed
            if flag.rollout_percentage == 100:
                days_at_100 = (timezone.now() - flag.updated_at).days
                if days_at_100 > 30:
                    stale.append({
                        "flag": flag.name,
                        "days_at_100": days_at_100,
                        "owner": flag.metadata.get("owner", "unknown"),
                    })

        # Send reminders
        if stale:
            self._send_cleanup_reminder(stale)

        # Auto-disable flags at 100% for > 90 days
        for flag in FeatureFlag.objects.filter(
            is_enabled=True,
            rollout_percentage=100,
            updated_at__lt=timezone.now() - timedelta(days=90),
        ):
            flag.is_enabled = True  # Keep enabled (no behavior change)
            flag.rollout_percentage = 100
            # But mark for removal
            FlagRemovalTracker.objects.create(
                flag_id=flag.id,
                reason="Auto-detected: 100% rollout for > 90 days",
                due_date=timezone.now() + timedelta(days=30),
            )
```

---

## 6. API

### 6.1 CRUD for Flags

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/feature-flags` | List flags (with their status per org context) |
| POST | `/api/v1/feature-flags` | Create a new flag |
| GET | `/api/v1/feature-flags/{id}` | Get flag details |
| PUT | `/api/v1/feature-flags/{id}` | Update flag (rollout %, enabled) |
| DELETE | `/api/v1/feature-flags/{id}` | Delete flag (only if not referenced in code) |
| POST | `/api/v1/feature-flags/{id}/evaluate` | Evaluate flag for a given context |

### 6.2 Evaluation Endpoint

```json
POST /api/v1/feature-flags/evaluate
{
  "flags": ["new-lead-scoring", "onboarding-flow-v2", "ai-email-compose"],
  "context": {
    "organization_id": "org-uuid",
    "user_id": "user-uuid"
  }
}

Response:
{
  "evaluations": {
    "new-lead-scoring": true,
    "onboarding-flow-v2": false,
    "ai-email-compose": true
  },
  "evaluated_at": "2026-07-27T10:30:00Z",
  "duration_ms": 2
}
```

### 6.3 Override Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/feature-flags/{id}/overrides` | List all overrides for a flag |
| POST | `/api/v1/feature-flags/{id}/overrides` | Create override for org/user |
| DELETE | `/api/v1/feature-flags/{id}/overrides/{override_id}` | Remove override |

### 6.4 Bulk Evaluation for Performance

```python
class BulkFlagEvaluator:
    """Efficient bulk evaluation of feature flags."""

    async def evaluate_bulk(
        self,
        flag_names: list[str],
        org_id: UUID,
        user_id: UUID | None = None,
    ) -> dict[str, bool]:
        # 1. Try to get all flags from cache in one call
        cache_keys = [f"flag:{name}:{org_id}:{user_id or 'none'}" for name in flag_names]
        cached = await cache.mget(*cache_keys)

        results = {}
        db_lookup_names = []

        for name, cached_value in zip(flag_names, cached):
            if cached_value is not None:
                results[name] = cached_value
            else:
                db_lookup_names.append(name)

        # 2. Load uncached flags from DB
        if db_lookup_names:
            db_flags = await self._load_flags_by_name(db_lookup_names)
            for flag in db_flags.values():
                result = flag.is_active_for(org_id, user_id)
                results[flag.name] = result
                key = f"flag:{flag.name}:{org_id}:{user_id or 'none'}"
                await cache.set(key, result, timeout=60)

        return results
```

---

## 7. Integration with Subscription Tiers

### 7.1 Flag Availability per Plan

```python
class PlanFeatureMatrix:
    """Maps subscription plans to available feature flags."""

    PLAN_FLAGS = {
        "free": {
            "enabled": ["basic-crm", "email-notifications", "task-management"],
            "disabled": ["ai-features", "integrations", "workflows", "reports-advanced"],
        },
        "growth": {
            "enabled": ["basic-crm", "email-notifications", "task-management",
                       "ai-features", "integrations", "workflows"],
            "disabled": ["premium-ai", "sso", "audit-log", "custom-roles"],
        },
        "enterprise": {
            "enabled": ["basic-crm", "email-notifications", "task-management",
                       "ai-features", "integrations", "workflows",
                       "premium-ai", "sso", "audit-log", "custom-roles"],
            "disabled": [],
        },
    }

    def get_flags_for_plan(self, plan_tier: str) -> list[str]:
        config = self.PLAN_FLAGS.get(plan_tier, self.PLAN_FLAGS["free"])
        return config["enabled"]

    def is_feature_allowed(self, flag_name: str, plan_tier: str) -> bool:
        enabled = self.PLAN_FLAGS.get(plan_tier, {}).get("enabled", [])
        return flag_name in enabled
```

### 7.2 Enforcement at API Layer

```python
class FeatureFlagPermission(permissions.BasePermission):
    """DRF permission class checking feature flag entitlement."""

    def has_permission(self, request, view):
        flag_name = getattr(view, "required_feature_flag", None)
        if not flag_name:
            return True

        org_id = request.organization_id
        user_id = request.user.id if request.user.is_authenticated else None

        return FeatureFlagService().is_active(flag_name, org_id, user_id)
```

---

## 8. SDK

### 8.1 Python Client (Backend)

```python
# Usage in application code:

from feature_flags import feature_flag

# Decorator-based check (raises 403 if flag is off)
@feature_flag("new-lead-scoring")
def score_lead(lead_id: UUID) -> Result:
    # This code only runs if the flag is active
    ...

# Conditional check
if feature_flag.is_active("ai-email-compose", org_id, user_id):
    suggestions = ai_service.compose_email(context)
else:
    suggestions = []
```

### 8.2 React Hook (Frontend)

```typescript
// useFeatureFlag hook
import { useFeatureFlag } from '@tzahu/feature-flags';

function LeadScoringPanel({ leadId }: { leadId: string }) {
  const { isActive, isLoading } = useFeatureFlag('new-lead-scoring');

  if (isLoading) return <Skeleton />;

  if (!isActive) {
    return <LegacyScoringPanel leadId={leadId} />;
  }

  return <AIScoringPanel leadId={leadId} />;
}

// Bulk check
function SettingsPage() {
  const flags = useFeatureFlags([
    'ai-features',
    'integrations',
    'workflows',
    'premium-ai',
  ]);

  return (
    <div>
      {flags.aiFeatures && <AISettings />}
      {flags.integrations && <IntegrationSettings />}
      {flags.workflows && <WorkflowSettings />}
    </div>
  );
}
```

### 8.3 React Hook Implementation

```typescript
// useFeatureFlag.ts
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface FlagContext {
  organizationId: string;
  userId?: string;
}

export function useFeatureFlag(name: string, context?: FlagContext) {
  return useQuery({
    queryKey: ['feature-flag', name, context],
    queryFn: async () => {
      const response = await api.post('/api/v1/feature-flags/evaluate', {
        flags: [name],
        context,
      });
      return response.data.evaluations[name];
    },
    staleTime: 60_000,     // 1 minute cache
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useFeatureFlags(names: string[], context?: FlagContext) {
  return useQuery({
    queryKey: ['feature-flags', ...names, context],
    queryFn: async () => {
      const response = await api.post('/api/v1/feature-flags/evaluate', {
        flags: names,
        context,
      });
      return response.data.evaluations;
    },
    staleTime: 60_000,
  });
}
```

---

## 9. Monitoring

### 9.1 Flag Evaluation Count

| Metric | Description | Labels |
|--------|-------------|--------|
| `feature_flag_evaluations_total` | Total flag checks | flag_name, result, org_id |
| `feature_flag_evaluation_duration_ms` | Evaluation latency | flag_name |
| `feature_flag_overrides_total` | Override count | flag_name, target_type |
| `feature_flag_experiment_results` | A/B test results | experiment_id, variant |

### 9.2 Percentage Rollout Tracking

```python
class RolloutTracker:
    """Track the health of gradual rollouts."""

    async def monitor_rollout(self, flag_name: str):
        flag = await FlagService.get(flag_name)
        if flag.rollout_percentage >= 100:
            return  # Fully rolled out

        # Check error rate for the flag's feature
        error_rate = await self._get_error_rate(flag_name)
        latency = await self._get_latency(flag_name)

        if error_rate > 0.01:
            await self._auto_pause_rollout(flag_name, error_rate)
            await self._alert(
                f"Rollout paused: {flag_name} error rate {error_rate:.3%}"
            )

        if latency > 1.5:  # p95 > 1.5x baseline
            await self._alert(
                f"Rollout warning: {flag_name} latency {latency:.1f}x baseline"
            )
```

### 9.3 Experiment Results

```python
class ExperimentAnalyzer:
    """Analyze A/B experiment results."""

    def analyze(self, experiment_id: str) -> ExperimentResult:
        control = self._get_variant_data(experiment_id, "control")
        treatment = self._get_variant_data(experiment_id, "treatment")

        results = {}
        for metric in control.metrics:
            control_values = control.values[metric]
            treatment_values = treatment.values[metric]

            # Statistical significance (t-test)
            t_stat, p_value = stats.ttest_ind(control_values, treatment_values)

            results[metric] = {
                "control_mean": np.mean(control_values),
                "treatment_mean": np.mean(treatment_values),
                "improvement": (np.mean(treatment_values) - np.mean(control_values))
                               / np.mean(control_values) * 100,
                "p_value": p_value,
                "significant": p_value < 0.05,
                "sample_size": len(control_values) + len(treatment_values),
            }

        return ExperimentResult(
            experiment_id=experiment_id,
            results=results,
            winner=self._determine_winner(results),
            recommendation=self._generate_recommendation(results),
        )
```
