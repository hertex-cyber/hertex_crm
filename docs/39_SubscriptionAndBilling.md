# TZAHU CRM — Subscription and Billing

> **Version:** 0.1.0-draft
> **Last Updated:** 2026-07-27
> **Status:** Foundational Design Phase
> **Owner:** Platform Architecture Team

---

## Table of Contents

1. [Overview](#1-overview)
2. [Billing Model](#2-billing-model)
3. [Subscription Lifecycle](#3-subscription-lifecycle)
4. [Payment Provider](#4-payment-provider)
5. [Feature Entitlement](#5-feature-entitlement)
6. [Usage Tracking](#6-usage-tracking)
7. [Invoicing](#7-invoicing)
8. [Quotas](#8-quotas)
9. [Self-Service](#9-self-service)
10. [Enterprise](#10-enterprise)

---

## 1. Overview

The Subscription and Billing system manages pricing tiers, plan entitlements, usage metering, invoicing, and quota enforcement. It is built around Stripe as the primary payment processor, with an abstraction layer that allows switching providers if needed.

### 1.1 Architecture

```
┌──────────────────┐     ┌──────────────────────────────────────────┐
│   Stripe API     │     │       TZAHU Billing System                │
│                  │     │                                          │
│  Customers ──────┼─────┼──► SubscriptionService                  │
│  Products ───────┼─────┼──► EntitlementService                   │
│  Prices ─────────┼─────┼──► UsageTrackingService                 │
│  Subscriptions ──┼─────┼──► QuotaEnforcementService              │
│  Invoices ───────┼─────┼──► InvoiceService                       │
│  Webhooks ───────┼─────┼──► WebhookHandler (idempotent)          │
│                  │     │                                          │
│  Customer Portal─┼─────┼──► SelfServicePortal                    │
└──────────────────┘     └──────────────────────────────────────────┘
```

---

## 2. Billing Model

### 2.1 Pricing Tiers

| Feature | Free | Growth | Enterprise |
|---------|------|--------|------------|
| Monthly Price | $0 | $29/seat/month | Custom |
| Users | Up to 3 | Up to 50 | Unlimited |
| Contacts | 500 | 50,000 | Unlimited |
| Storage | 100 MB | 10 GB | 100 GB |
| AI Credits | 0/month | 10,000 tokens/month | Unlimited |
| API Calls | 1,000/month | 100,000/month | Custom |
| Workflows | 3 | 20 | Unlimited |
| Integrations | — | 5 | Unlimited |
| Reports | Basic | Advanced | Custom |
| SSO / SAML | — | — | Yes |
| Audit Log | — | 30 days | 7 years |
| Support | Community | Email (4h) | Priority (1h) + TAM |

### 2.2 Add-Ons

| Add-On | Price | Description |
|--------|-------|-------------|
| Additional AI Tokens | $0.01/1K tokens | Prepaid token packs |
| Additional Storage | $10/GB/month | Beyond plan limit |
| Additional API Calls | $5/10K calls | Beyond plan limit |
| Additional Seats (Growth) | $15/seat/month | Beyond 50 users |
| Phone Support | $100/month | Per-org phone support |
| Dedicated Infrastructure | Custom | Single-tenant silo |

### 2.3 Per-Seat Pricing

```python
class SeatPricing:
    """Calculate per-seat pricing with volume discounts."""

    BASE_PRICE_GROWTH = Decimal("29.00")

    def calculate_seat_price(self, active_users: int) -> Decimal:
        """Volume-based pricing for Growth tier."""
        if active_users <= 10:
            return self.BASE_PRICE_GROWTH
        elif active_users <= 25:
            return Decimal("25.00")
        elif active_users <= 50:
            return Decimal("22.00")
        return Decimal("20.00")  # Custom pricing above 50

    def calculate_monthly_cost(self, org: Organization) -> Decimal:
        active_users = User.objects.filter(
            organization=org, is_active=True
        ).count()
        seat_price = self.calculate_seat_price(active_users)
        addons = self._get_addon_costs(org)
        return seat_price * active_users + addons
```

### 2.4 Usage-Based Add-Ons

```python
@dataclass
class UsageAddOn:
    sku: str
    name: str
    unit: str          # tokens, bytes, calls
    unit_price: Decimal
    billing_period: str  # monthly, prepaid

ADDON_CATALOG = [
    UsageAddOn("ai_tokens_10k", "AI Tokens (10K)", "tokens", Decimal("0.10"), "prepaid"),
    UsageAddOn("ai_tokens_100k", "AI Tokens (100K)", "tokens", Decimal("0.80"), "prepaid"),
    UsageAddOn("storage_1gb", "Additional Storage (1GB)", "bytes", Decimal("10.00"), "monthly"),
    UsageAddOn("api_calls_10k", "Additional API Calls (10K)", "calls", Decimal("5.00"), "monthly"),
    UsageAddOn("seat_growth", "Additional Seat (Growth)", "seat", Decimal("15.00"), "monthly"),
]
```

---

## 3. Subscription Lifecycle

### 3.1 Lifecycle States

```
                    ┌──────────┐
                    │  Trial   │
                    └────┬─────┘
                         │ Subscribe
                         ▼
                    ┌──────────┐
               ┌───►│  Active  │◄────┐
               │    └────┬─────┘     │
               │         │           │
          Past Due   Renewal    Upgrade/Downgrade
               │         │           │
               ▼         │           │
          ┌──────────┐   │           │
          │ Past Due  │──┘           │
          └────┬─────┘               │
               │ Suspended           │
               ▼                     │
          ┌──────────┐               │
          │Cancelled │───────────────┘
          └────┬─────┘  (Re-activate)
               │
               ▼
          ┌──────────┐
          │ Expired  │
          └──────────┘
```

### 3.2 State Machine

```python
class SubscriptionStateMachine:
    """State machine for subscription lifecycle."""

    TRANSITIONS = {
        "trial": ["active", "cancelled"],
        "active": ["past_due", "cancelled", "active"],  # active includes upgrade/downgrade
        "past_due": ["active", "cancelled", "suspended"],
        "suspended": ["active", "expired"],
        "cancelled": ["active", "expired"],  # Re-activation allowed during current period
        "expired": ["active"],  # New subscription
    }

    GRACE_PERIODS = {
        "past_due": timedelta(days=7),     # 7 days to pay
        "suspended": timedelta(days=14),   # 14 days before permanent expiration
        "cancelled": timedelta(days=30),   # Data retained for 30 days after cancellation
    }

    def transition(self, subscription: Subscription, to_state: str) -> Subscription:
        if to_state not in self.TRANSITIONS.get(subscription.status, []):
            raise InvalidTransitionError(
                f"Cannot transition from {subscription.status} to {to_state}"
            )
        subscription.status = to_state
        subscription.status_changed_at = timezone.now()
        if to_state == "active" and subscription.status == "past_due":
            subscription.past_due_ended_at = timezone.now()
        if to_state == "cancelled":
            subscription.cancelled_at = timezone.now()
            subscription.expires_at = timezone.now() + self.GRACE_PERIODS["cancelled"]
        return subscription
```

### 3.3 Trial to Paid Conversion

```python
class TrialConversion:
    """Handle trial → paid conversion with Stripe."""

    TRIAL_DAYS = 14

    async def create_trial(self, org: Organization, email: str) -> Subscription:
        """Create a trial subscription."""
        stripe_customer = await stripe.Customer.create(
            email=email,
            metadata={"org_id": str(org.id)},
        )

        subscription = await Subscription.objects.create(
            organization=org,
            stripe_customer_id=stripe_customer.id,
            plan="growth",
            status="trial",
            trial_ends_at=timezone.now() + timedelta(days=self.TRIAL_DAYS),
        )

        # Schedule trial ending notifications
        schedule_trial_notifications.delay(subscription.id)

        return subscription

    async def convert_to_paid(self, subscription: Subscription, payment_method_id: str) -> Subscription:
        """Convert trial to paid subscription."""
        # Attach payment method
        await stripe.PaymentMethod.attach(
            payment_method_id,
            customer=subscription.stripe_customer_id,
        )

        # Create subscription in Stripe
        stripe_sub = await stripe.Subscription.create(
            customer=subscription.stripe_customer_id,
            items=[{"price": settings.STRIPE_GROWTH_PRICE_ID}],
            trial_end="now",  # End trial immediately
            payment_settings={
                "payment_method_types": ["card"],
                "save_default_payment_method": "on_subscription",
            },
        )

        subscription.stripe_subscription_id = stripe_sub.id
        subscription.status = "active"
        subscription.current_period_start = timezone.now()
        subscription.current_period_end = datetime.fromtimestamp(
            stripe_sub.current_period_end, tz=timezone.utc
        )
        await subscription.save()

        return subscription
```

---

## 4. Payment Provider

### 4.1 Stripe as Primary Provider

```python
class StripePaymentProvider:
    """Payment provider abstraction for Stripe."""

    async def create_customer(self, email: str, metadata: dict) -> str:
        customer = await stripe.Customer.create(email=email, metadata=metadata)
        return customer.id

    async def create_subscription(
        self,
        customer_id: str,
        price_id: str,
        trial_days: int = 0,
        metadata: dict | None = None,
    ) -> dict:
        subscription = await stripe.Subscription.create(
            customer=customer_id,
            items=[{"price": price_id}],
            trial_period_days=trial_days or None,
            metadata=metadata,
        )
        return subscription

    async def cancel_subscription(self, subscription_id: str, at_period_end: bool = True) -> dict:
        subscription = await stripe.Subscription.update(
            subscription_id,
            cancel_at_period_end=at_period_end,
        )
        return subscription

    async def update_subscription(self, subscription_id: str, price_id: str) -> dict:
        subscription = await stripe.Subscription.retrieve(subscription_id)
        await stripe.Subscription.modify(
            subscription_id,
            items=[{
                "id": subscription["items"]["data"][0]["id"],
                "price": price_id,
            }],
            proration_behavior="create_prorations",
        )
        return subscription

    async def create_invoice(self, customer_id: str, days_until_due: int = 30) -> dict:
        invoice = await stripe.Invoice.create(
            customer=customer_id,
            days_until_due=days_until_due,
        )
        await stripe.Invoice.finalize_invoice(invoice.id)
        return invoice

    async def handle_webhook(self, payload: dict, sig_header: str) -> WebhookEvent:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
        return event
```

### 4.2 Webhook Handler

```python
class StripeWebhookHandler:
    """Handle Stripe webhooks with idempotency."""

    EVENT_HANDLERS = {
        "customer.subscription.created": "handle_subscription_created",
        "customer.subscription.updated": "handle_subscription_updated",
        "customer.subscription.deleted": "handle_subscription_deleted",
        "invoice.payment_succeeded": "handle_payment_succeeded",
        "invoice.payment_failed": "handle_payment_failed",
        "invoice.upcoming": "handle_upcoming_invoice",
        "customer.updated": "handle_customer_updated",
    }

    async def handle(self, event: stripe.Event) -> None:
        # Idempotency check
        if await self._is_duplicate(event.id):
            logger.info("duplicate_webhook", event_id=event.id)
            return

        handler_name = self.EVENT_HANDLERS.get(event.type)
        if not handler_name:
            logger.warning("unhandled_webhook", event_type=event.type)
            return

        handler = getattr(self, handler_name)
        await handler(event.data.object)

        await self._mark_processed(event.id)

    async def handle_subscription_created(self, subscription):
        org_id = subscription.metadata.get("org_id")
        if not org_id:
            logger.error("missing_org_id", stripe_sub_id=subscription.id)
            return

        await Subscription.objects.update_or_create(
            stripe_subscription_id=subscription.id,
            defaults={
                "organization_id": org_id,
                "status": "active",
                "current_period_start": datetime.fromtimestamp(
                    subscription.current_period_start, tz=timezone.utc
                ),
                "current_period_end": datetime.fromtimestamp(
                    subscription.current_period_end, tz=timezone.utc
                ),
            },
        )

    async def handle_payment_failed(self, invoice):
        subscription_id = invoice.subscription
        sub = await Subscription.objects.get(stripe_subscription_id=subscription_id)
        sub.status = "past_due"
        sub.past_due_started_at = timezone.now()
        await sub.save()

        # Notify admin
        await notification_service.send(
            org_id=sub.organization_id,
            channel="email",
            template="payment_failed",
            context={"invoice_url": invoice.hosted_invoice_url},
        )
```

### 4.3 Abstraction Layer

```python
class PaymentProvider(ABC):
    """Abstract payment provider for switching capability."""

    @abstractmethod
    async def create_customer(self, email: str, metadata: dict) -> str: ...

    @abstractmethod
    async def create_subscription(self, customer_id: str, price_id: str, **kwargs) -> dict: ...

    @abstractmethod
    async def cancel_subscription(self, subscription_id: str, at_period_end: bool) -> dict: ...

    @abstractmethod
    async def update_subscription(self, subscription_id: str, price_id: str) -> dict: ...

    @abstractmethod
    async def create_invoice(self, customer_id: str, days_until_due: int) -> dict: ...

    @abstractmethod
    async def handle_webhook(self, payload: dict, sig_header: str) -> WebhookEvent: ...


class PaymentProviderFactory:
    _providers: dict[str, type[PaymentProvider]] = {
        "stripe": StripePaymentProvider,
        "test": TestPaymentProvider,  # For integration tests
    }

    @classmethod
    def get_provider(cls, name: str = "stripe") -> PaymentProvider:
        provider_class = cls._providers.get(name)
        if not provider_class:
            raise ValueError(f"Unknown payment provider: {name}")
        return provider_class()
```

---

## 5. Feature Entitlement

### 5.1 Plan to Feature Mapping

```python
class EntitlementService:
    """Determine feature availability based on subscription plan."""

    PLAN_FEATURES = {
        "free": {
            "max_users": 3,
            "max_contacts": 500,
            "max_storage_mb": 100,
            "ai_tokens_monthly": 0,
            "api_calls_monthly": 1000,
            "max_workflows": 3,
            "max_integrations": 0,
            "audit_log_retention_days": 0,
            "sso_enabled": False,
            "custom_roles": False,
        },
        "growth": {
            "max_users": 50,
            "max_contacts": 50000,
            "max_storage_mb": 10240,
            "ai_tokens_monthly": 10000,
            "api_calls_monthly": 100000,
            "max_workflows": 20,
            "max_integrations": 5,
            "audit_log_retention_days": 30,
            "sso_enabled": False,
            "custom_roles": False,
        },
        "enterprise": {
            "max_users": 999999,
            "max_contacts": 9999999,
            "max_storage_mb": 102400,
            "ai_tokens_monthly": 99999999,
            "api_calls_monthly": 9999999,
            "max_workflows": 999,
            "max_integrations": 999,
            "audit_log_retention_days": 2555,
            "sso_enabled": True,
            "custom_roles": True,
        },
    }

    def get_entitlement(self, org: Organization, feature: str) -> Any:
        plan = org.subscription.plan
        return self.PLAN_FEATURES[plan][feature]
```

### 5.2 Enforcement

Entitlements are enforced at multiple layers:

1. **API Layer**: Feature flags check plan tier before enabling features
2. **Rate Limiting**: API rate limits are set based on plan
3. **Storage**: File upload middleware checks storage quota before accepting files
4. **User Management**: Invitation blocked if user count exceeds plan limit
5. **UI**: Features hidden or disabled based on plan (no confusing 403 errors)

---

## 6. Usage Tracking

### 6.1 Event-Based Counters

```sql
CREATE TABLE billing_usage_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    organization_id UUID NOT NULL,
    metric_name VARCHAR(100) NOT NULL,  -- api_calls, ai_tokens, storage_bytes
    quantity BIGINT NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_usage_org_metric ON billing_usage_records(organization_id, metric_name, recorded_at);

-- Daily aggregation (materialized view)
CREATE MATERIALIZED VIEW mv_daily_usage AS
SELECT
    organization_id,
    metric_name,
    DATE(recorded_at) AS day,
    SUM(quantity) AS total_quantity
FROM billing_usage_records
GROUP BY organization_id, metric_name, DATE(recorded_at);

CREATE UNIQUE INDEX idx_mv_daily_usage ON mv_daily_usage(organization_id, metric_name, day);
```

### 6.2 API Call Tracking Middleware

```python
class UsageTrackingMiddleware:
    """Track API usage per org."""

    EXCLUDED_PATHS = ["/health/", "/metrics/"]

    def __call__(self, request):
        response = self.get_response(request)

        path = request.path
        if any(path.startswith(p) for p in self.EXCLUDED_PATHS):
            return response

        org_id = getattr(request, "organization_id", None)
        if org_id:
            UsageTracker.increment(org_id, "api_calls", 1)

        return response
```

### 6.3 Storage Metering

```python
class StorageMeter:
    """Track storage usage per org."""

    @celery.task
    def update_storage_usage(org_id: UUID):
        """Recalculate storage usage for an org."""
        from minio import Minio

        client = Minio(settings.MINIO_ENDPOINT, ...)
        total_bytes = 0

        objects = client.list_objects(
            "tzahu-media",
            prefix=f"{org_id}/",
            recursive=True,
        )
        for obj in objects:
            total_bytes += obj.size

        UsageRecord.objects.create(
            organization_id=org_id,
            metric_name="storage_bytes",
            quantity=total_bytes,
            metadata={"calculated_at": str(timezone.now())},
        )

        # Check quota
        org = Organization.objects.get(id=org_id)
        max_storage = EntitlementService().get_entitlement(org, "max_storage_mb")
        if total_bytes > max_storage * 1024 * 1024:
            # Warn admin
            notification_service.send(
                org_id=org_id,
                channel="in_app",
                template="storage_quota_exceeded",
                context={"usage_mb": total_bytes / 1024 / 1024},
            )
```

### 6.4 Daily Aggregation

```python
@celery.task
def aggregate_daily_usage():
    """Aggregate usage records into daily rollup."""
    from django.db.models import Sum

    yesterday = timezone.now().date() - timedelta(days=1)
    records = (
        BillingUsageRecord.objects
        .filter(recorded_at__date=yesterday)
        .values("organization_id", "metric_name")
        .annotate(total=Sum("quantity"))
    )

    for record in records:
        DailyUsage.objects.update_or_create(
            organization_id=record["organization_id"],
            metric_name=record["metric_name"],
            date=yesterday,
            defaults={"quantity": record["total"]},
        )
```

---

## 7. Invoicing

### 7.1 Auto-Invoicing (Stripe)

```python
class InvoiceService:
    """Manage invoice generation and delivery."""

    async def generate_invoice(self, subscription: Subscription) -> Invoice:
        """Generate invoice for the current billing period."""
        # Stripe auto-generates invoices for subscriptions
        # This method handles manual invoices for enterprise

        items = []

        # Base plan
        plan_price = self._get_plan_price(subscription.plan)
        items.append({
            "description": f"{subscription.plan.title()} Plan",
            "amount": plan_price,
        })

        # Per-seat charges
        if subscription.plan == "growth":
            active_users = User.objects.filter(
                organization=subscription.organization,
                is_active=True,
            ).count()
            items.append({
                "description": f"Users ({active_users} @ ${SeatPricing.BASE_PRICE_GROWTH})",
                "amount": active_users * SeatPricing.BASE_PRICE_GROWTH,
            })

        # Add-on charges
        addons = await self._get_addon_charges(subscription)
        items.extend(addons)

        total = sum(item["amount"] for item in items)

        return Invoice(
            organization=subscription.organization,
            items=items,
            total=total,
            due_date=timezone.now() + timedelta(days=30),
            status="pending",
        )
```

### 7.2 Tax Handling (VAT, Sales Tax)

```python
class TaxCalculator:
    """Calculate applicable taxes for billing."""

    VAT_RATES = {
        "DE": Decimal("0.19"),
        "FR": Decimal("0.20"),
        "GB": Decimal("0.20"),
        "IN": Decimal("0.18"),
        "AU": Decimal("0.10"),
        "JP": Decimal("0.10"),
        "SG": Decimal("0.09"),
    }

    # US states with digital sales tax
    US_SALES_TAX_STATES = {
        "NY": Decimal("0.04"),
        "CA": Decimal("0.06"),
        "TX": Decimal("0.0625"),
        "FL": Decimal("0.06"),
        "IL": Decimal("0.0625"),
        "PA": Decimal("0.06"),
        "OH": Decimal("0.0575"),
        "MI": Decimal("0.06"),
        "NC": Decimal("0.0475"),
        "GA": Decimal("0.04"),
    }

    def calculate_tax(self, amount: Decimal, country: str, state: str | None = None) -> Decimal:
        if country == "US" and state in self.US_SALES_TAX_STATES:
            rate = self.US_SALES_TAX_STATES[state]
            return (amount * rate).quantize(Decimal("0.01"))
        elif country in self.VAT_RATES:
            rate = self.VAT_RATES[country]
            return (amount * rate).quantize(Decimal("0.01"))
        return Decimal("0.00")
```

---

## 8. Quotas

### 8.1 Enforcement at API Layer

```python
class QuotaEnforcement:
    """Enforce usage quotas at multiple layers."""

    async def check_quota(self, org_id: UUID, metric: str, increment: int = 1) -> bool:
        org = await Organization.objects.get(id=org_id)
        plan = org.subscription.plan
        limits = ENTITLEMENTS[plan]

        current_usage = await self._get_current_usage(org_id, metric)

        if metric == "api_calls" and current_usage + increment > limits["api_calls_monthly"]:
            raise RateLimitError("API call quota exceeded")
        elif metric == "ai_tokens" and current_usage + increment > limits["ai_tokens_monthly"]:
            raise QuotaExceededError("AI token quota exceeded")
        elif metric == "storage_bytes":
            max_bytes = limits["max_storage_mb"] * 1024 * 1024
            if current_usage + increment > max_bytes:
                raise QuotaExceededError("Storage quota exceeded")

        return True
```

### 8.2 File Upload Rejection

```python
class FileUploadValidator:
    """Validate file uploads against quotas and limits."""

    async def validate(self, org: Organization, file_size: int) -> ValidationResult:
        # Check storage quota
        usage = await UsageTracker.get_current(org.id, "storage_bytes")
        max_storage = EntitlementService().get_entitlement(org, "max_storage_mb")
        max_bytes = max_storage * 1024 * 1024

        if usage + file_size > max_bytes:
            return ValidationResult(
                valid=False,
                error="Storage quota exceeded",
                detail=f"Usage: {usage / 1024 / 1024:.1f}MB / {max_storage}MB",
            )

        # Check file size limit per plan
        file_size_limits = {"free": 5, "growth": 25, "enterprise": 100}
        max_file_mb = file_size_limits.get(org.subscription.plan, 5)
        if file_size > max_file_mb * 1024 * 1024:
            return ValidationResult(
                valid=False,
                error=f"File too large (max {max_file_mb}MB for {org.subscription.plan} plan)",
            )

        return ValidationResult(valid=True)
```

### 8.3 Invitation Blocked

```python
class InvitationValidator:
    """Block user invitations when plan user limit is reached."""

    async def can_invite(self, org: Organization, count: int = 1) -> bool:
        current_users = await User.objects.filter(
            organization=org, is_active=True
        ).count()
        max_users = EntitlementService().get_entitlement(org, "max_users")

        if current_users + count > max_users:
            return False

        return True
```

---

## 9. Self-Service

### 9.1 Stripe Customer Portal

```python
class CustomerPortal:
    """Manage self-service billing via Stripe Customer Portal."""

    async def create_portal_session(self, customer_id: str, return_url: str) -> str:
        session = await stripe.billing_portal.Configuration.create(
            customer=customer_id,
            return_url=return_url,
            features={
                "customer_update": {
                    "enabled": True,
                    "allowed_updates": ["address", "shipping", "tax_id"],
                },
                "invoice_history": {"enabled": True},
                "payment_method_update": {"enabled": True},
                "subscription_cancel": {"enabled": True},
                "subscription_update": {
                    "enabled": True,
                    "default_allowed_updates": ["price"],
                    "proration_behavior": "create_prorations",
                },
            },
        )
        return session.url
```

### 9.2 Plan Changes

| Action | Immediate Effect | Proration |
|--------|-----------------|-----------|
| Upgrade (Free → Growth) | Enabled immediately | Full proration for remaining days |
| Upgrade (Growth → Enterprise) | Enabled immediately | Custom proration |
| Add seats | Enabled immediately | Partial month charge |
| Downgrade (Growth → Free) | At end of billing period | None (credit applied) |
| Cancel | At end of billing period | None |

---

## 10. Enterprise

### 10.1 Custom Contracts

Enterprise customers can have custom contracts with:
- Custom pricing (per-seat, flat annual, usage-based)
- Custom SLAs (99.99% uptime, 1-hour response)
- Custom data retention policies
- Dedicated infrastructure (silo deployment)
- Invoice-based payment (net 30/60/90)
- Custom SSO/SAML configuration
- Dedicated customer success manager

### 10.2 Annual Billing

```python
class AnnualBilling:
    """Handle annual billing with discount."""

    DISCOUNT_PERCENTAGE = Decimal("0.20")  # 20% discount for annual

    def calculate_annual_price(self, monthly_price: Decimal) -> Decimal:
        """Annual = 12 months - 20% discount."""
        annual = monthly_price * 12 * (1 - self.DISCOUNT_PERCENTAGE)
        return annual.quantize(Decimal("0.01"))

    async def create_annual_subscription(self, customer_id: str, price_id: str) -> dict:
        # Stripe handles annual billing natively
        subscription = await stripe.Subscription.create(
            customer=customer_id,
            items=[{"price": price_id}],
        )
        return subscription
```
