# TZAHU CRM — AI Platform

> **Version:** 0.1.0-draft
> **Last Updated:** 2026-07-27
> **Status:** Foundational Design Phase
> **Owner:** Platform Architecture Team

---

## Table of Contents

1. [Overview](#1-overview)
2. [AI Gateway Architecture](#2-ai-gateway-architecture)
3. [LLM Provider Abstraction](#3-llm-provider-abstraction)
4. [Prompt Management](#4-prompt-management)
5. [Conversation Memory](#5-conversation-memory)
6. [AI Features](#6-ai-features)
7. [Cost Tracking](#7-cost-tracking)
8. [Guardrails](#8-guardrails)
9. [Evaluation](#9-evaluation)

---

## 1. Overview

The AI Platform is the intelligence layer of TZAHU CRM. It exposes AI capabilities through a dedicated FastAPI sidecar service, providing LLM access, embeddings, RAG, and AI-powered CRM features. The platform abstracts provider differences, manages prompts, tracks costs, and enforces guardrails — all while ensuring tenant isolation and data privacy.

### 1.1 Design Principles

- **Provider agnostic**: Any LLM provider can be swapped in without application changes
- **Tenant isolated**: No training data leaks across tenants
- **Cost tracked**: Every token is billed to the correct org and feature
- **Safe by default**: Guardrails are non-optional — all LLM I/O is validated
- **Observable**: Every call is traced, logged, and metered

### 1.2 Architecture Overview

```
┌──────────────────────┐     ┌────────────────────────────────────┐
│   Django (CRM App)    │     │        AI Gateway (FastAPI)        │
│                      │     │                                    │
│  LeadService ────────┼─────┼──► LLM Proxy ──► OpenAI            │
│  WorkflowEngine ─────┼─────┼──► Embeddings──► Anthropic         │
│  NotificationSvc ────┼─────┼──► RAG Service──► pgvector         │
│  ReportGenerator ────┼─────┼──► Sentiment ──► Self-hosted      │
│                      │     │                                    │
│                      │     │  MCP Server ◄──► External Clients  │
└──────────────────────┘     └────────────────────────────────────┘
```

---

## 2. AI Gateway Architecture

### 2.1 FastAPI Sidecar

The AI Gateway runs as a separate FastAPI service with its own scaling, deployment, and security boundary.

```python
# ai_gateway/main.py
from fastapi import FastAPI
from ai_gateway.routes import chat, embeddings, rag, tools, prompts

app = FastAPI(title="TZAHU AI Gateway", version="0.1.0")

app.include_router(chat.router, prefix="/v1/chat")
app.include_router(embeddings.router, prefix="/v1/embeddings")
app.include_router(rag.router, prefix="/v1/rag")
app.include_router(tools.router, prefix="/v1/tools")
app.include_router(prompts.router, prefix="/v1/prompts")
```

**API Endpoints:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/chat/completions` | LLM chat with prompt injection |
| POST | `/v1/embeddings` | Generate text embeddings |
| POST | `/v1/rag/query` | RAG: retrieve + generate |
| POST | `/v1/analyze/sentiment` | Sentiment analysis |
| POST | `/v1/analyze/entities` | Entity extraction |
| POST | `/v1/analyze/summary` | Conversation/email summary |
| POST | `/v1/score/lead` | ML-based lead scoring |
| POST | `/v1/actions/next-best` | Next-best-action recommendation |
| GET | `/v1/prompts` | List prompt templates |
| POST | `/v1/tools/call` | Execute MCP tool |
| GET | `/v1/health` | Health check |

### 2.2 Retry and Fallback Strategy

```python
class LLMRetryStrategy:
    """Retry with provider fallback on failure."""

    def __init__(self):
        self.providers = [
            ProviderConfig("primary", OpenAIProvider, retry=2),
            ProviderConfig("fallback", AnthropicProvider, retry=1),
            ProviderConfig("emergency", SelfHostedProvider, retry=1),
        ]

    async def execute(self, request: LLMRequest) -> LLMResponse:
        last_error = None
        for attempt in range(3):
            for provider in self.providers:
                try:
                    return await provider.instance.complete(request)
                except (TimeoutError, RateLimitError, ServiceUnavailable) as e:
                    last_error = e
                    logger.warning(
                        "provider_failed",
                        provider=provider.name,
                        attempt=attempt,
                        error=str(e),
                    )
                    continue
            # Exponential backoff between full retry cycles
            await asyncio.sleep(2 ** attempt)
        raise AllProvidersExhausted(last_error)
```

### 2.3 Usage Tracking

Every AI call is tracked for billing and observability:

```python
@dataclass
class UsageRecord:
    request_id: str
    organization_id: str
    feature: str           # lead_scoring, sentiment, rag, etc.
    model: str             # gpt-4o, claude-3-opus, etc.
    provider: str          # openai, anthropic
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    duration_ms: int
    cost_usd: Decimal
    cached: bool
    guardrail_triggered: bool
    timestamp: datetime
```

---

## 3. LLM Provider Abstraction

### 3.1 Unified Interface

```python
class LLMProvider(ABC):
    """Abstract interface for LLM providers."""

    @abstractmethod
    async def chat_completion(
        self,
        messages: list[Message],
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        stream: bool = False,
    ) -> ChatResponse:
        ...

    @abstractmethod
    async def generate_embeddings(
        self,
        texts: list[str],
        model: str | None = None,
    ) -> EmbeddingResponse:
        ...

    @property
    @abstractmethod
    def provider_name(self) -> str: ...

    @property
    @abstractmethod
    def supported_models(self) -> list[str]: ...


class OpenAIProvider(LLMProvider):
    def __init__(self, api_key: str, organization: str | None = None):
        self.client = AsyncOpenAI(api_key=api_key, organization=organization)

    async def chat_completion(self, messages, model=None, temperature=0.7, max_tokens=2048, stream=False):
        model = model or "gpt-4o"
        response = await self.client.chat.completions.create(
            model=model,
            messages=[m.to_dict() for m in messages],
            temperature=temperature,
            max_tokens=max_tokens,
            stream=stream,
        )
        return ChatResponse.from_openai(response)

    @property
    def provider_name(self) -> str:
        return "openai"

    @property
    def supported_models(self) -> list[str]:
        return ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "text-embedding-3-small", "text-embedding-3-large"]


class AnthropicProvider(LLMProvider):
    def __init__(self, api_key: str):
        self.client = AsyncAnthropic(api_key=api_key)

    async def chat_completion(self, messages, model=None, temperature=0.7, max_tokens=2048, stream=False):
        model = model or "claude-3-opus-20240229"
        response = await self.client.messages.create(
            model=model,
            messages=[m.to_dict() for m in messages],
            temperature=temperature,
            max_tokens=max_tokens,
            stream=stream,
        )
        return ChatResponse.from_anthropic(response)

    @property
    def provider_name(self) -> str:
        return "anthropic"

    @property
    def supported_models(self) -> list[str]:
        return ["claude-3-opus-20240229", "claude-3-sonnet-20240229", "claude-3-haiku-20240307"]
```

### 3.2 Provider Configuration

```yaml
# ai_gateway/config/providers.yaml

providers:
  openai:
    api_key: ${OPENAI_API_KEY}
    organization: ${OPENAI_ORG_ID}
    default_model: gpt-4o
    embedding_model: text-embedding-3-small
    rate_limit: 5000  # RPM
    timeout: 30

  anthropic:
    api_key: ${ANTHROPIC_API_KEY}
    default_model: claude-3-sonnet-20240229
    rate_limit: 2000
    timeout: 60

  self_hosted:
    endpoint: http://llm-internal:8000/v1
    default_model: llama-3-70b
    api_key: ${INTERNAL_LLM_KEY}
    rate_limit: 1000
    timeout: 120

routing:
  default_provider: openai
  feature_routing:
    lead_scoring:
      provider: openai
      model: gpt-4o-mini
    sentiment_analysis:
      provider: anthropic
      model: claude-3-haiku-20240307
    rag_generation:
      provider: openai
      model: gpt-4o
    entity_extraction:
      provider: openai
      model: gpt-4o-mini
```

### 3.3 Model Tiering

| Tier | Models | Use Cases | Cost/1K Tokens |
|------|--------|-----------|----------------|
| Economy | gpt-4o-mini, claude-3-haiku | Sentiment, entity extraction, classification | $0.15 |
| Standard | gpt-4o, claude-3-sonnet | Lead scoring, summaries, next-best-action | $2.50 |
| Premium | gpt-4o (full), claude-3-opus | Complex reasoning, contract analysis | $10.00 |

Model selection is automatic based on the feature being called, with per-org overrides available in settings.

---

## 4. Prompt Management

### 4.1 Prompt Registry

Prompts are versioned templates stored in the database and cached in Redis:

```sql
CREATE TABLE ai_prompt_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    template TEXT NOT NULL,  -- Jinja2 template with variables
    version INT NOT NULL DEFAULT 1,
    variables JSONB,  -- Schema of expected variables
    feature VARCHAR(100) NOT NULL,  -- lead_scoring, sentiment, etc.
    model_recommendation VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_by_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 4.2 Prompt Template Structure

```jinja
{% prompt name="lead_scoring_v2" feature="lead_scoring" %}

You are a lead scoring AI for a CRM system. Analyze the lead data below
and assign a score from 0-100 based on the likelihood to convert.

Organization Industry: {{ org.industry }}
Lead Information:
- Name: {{ lead.name }}
- Title: {{ lead.title }}
- Company: {{ lead.company }}
- Company Size: {{ lead.company_size }}
- Industry: {{ lead.industry }}
- Source: {{ lead.source }}
- Email Domain: {{ lead.email_domain }}
- Location: {{ lead.location }}

Scoring Criteria:
- Title Seniority (CEO/VP/Director: +20, Manager: +10, IC: +0)
- Company Fit (target industry: +15, matching size: +10)
- Engagement Signals (visited pricing: +15, downloaded content: +10)
- Source Quality (referral: +20, inbound: +10, purchased: -10)

Respond with ONLY a JSON object:
{
  "score": <0-100>,
  "confidence": <0.0-1.0>,
  "factors": [
    {"name": "<factor>", "contribution": <+-number>, "reason": "<explanation>"}
  ],
  "recommendation": "<nurture | qualify | convert | discard>"
}
{% endprompt %}
```

### 4.3 A/B Testing Support

Prompts can be A/B tested by creating multiple active versions:

```json
{
  "prompt_name": "lead_scoring",
  "test_id": "ab_test_2026_Q3",
  "variants": [
    {"version": 2, "weight": 50, "description": "Control (detailed criteria)"},
    {"version": 3, "weight": 30, "description": "Treatment A (simplified)"},
    {"version": 4, "weight": 20, "description": "Treatment B (fewer factors)"}
  ],
  "metrics": ["score_accuracy", "conversion_rate", "latency"],
  "started_at": "2026-07-01T00:00:00Z",
  "min_sample_size": 1000
}
```

### 4.4 Default Prompts per Feature

| Feature | Default Prompt | Variables |
|---------|---------------|-----------|
| lead_scoring | Score lead 0-100 based on fit and engagement | lead data, org context |
| next_best_action | Recommend next action for a lead/opportunity | entity state, history |
| sentiment_analysis | Classify text as positive/negative/neutral | text content |
| conversation_summary | Summarize email thread or call transcript | messages, duration |
| entity_extraction | Extract entities from text (company, person, etc.) | text |
| sales_coach | Provide coaching feedback on call transcript | transcript, metrics |
| deal_insights | Analyze deal risks and strengths | opportunity data, history |

---

## 5. Conversation Memory

### 5.1 Redis-Backed Session Memory

```python
class ConversationMemory:
    """Redis-backed session memory with token budget management."""

    def __init__(self, redis_client, session_id: str, max_tokens: int = 4096):
        self.redis = redis_client
        self.session_key = f"ai:memory:{session_id}"
        self.max_tokens = max_tokens

    async def add_message(self, role: str, content: str) -> None:
        message = {"role": role, "content": content, "timestamp": time.time()}
        await self.redis.rpush(self.session_key, json.dumps(message))
        await self.redis.expire(self.session_key, 3600)  # 1 hour TTL
        await self._enforce_token_budget()

    async def get_history(self) -> list[dict]:
        messages = await self.redis.lrange(self.session_key, 0, -1)
        return [json.loads(m) for m in messages]

    async def _enforce_token_budget(self) -> None:
        messages = await self.get_history()
        total_tokens = sum(len(m["content"]) // 2 for m in messages)
        while total_tokens > self.max_tokens and len(messages) > 1:
            removed = messages.pop(0)
            if removed["role"] == "system":
                messages.insert(0, messages.pop(0))
            total_tokens = sum(len(m["content"]) // 2 for m in messages)
        await self.redis.delete(self.session_key)
        for m in messages:
            await self.redis.rpush(self.session_key, json.dumps(m))

    async def clear(self) -> None:
        await self.redis.delete(self.session_key)

    async def get_token_count(self) -> int:
        messages = await self.get_history()
        return sum(len(m["content"]) // 2 for m in messages)
```

### 5.2 Conversation Windowing

```python
class ConversationWindow:
    """Manages conversation context window for LLMs."""

    MAX_HISTORY_MESSAGES = 20
    MAX_CONTEXT_TOKENS = 8192

    def build_context(
        self,
        system_prompt: str,
        history: list[dict],
        current_input: str,
    ) -> list[dict]:
        """Build the context respecting token limits."""
        context = [{"role": "system", "content": system_prompt}]
        remaining = self.MAX_CONTEXT_TOKENS - len(system_prompt) // 2

        # Add most recent history first
        for msg in reversed(history[-self.MAX_HISTORY_MESSAGES:]):
            tokens = len(msg["content"]) // 2
            if remaining - tokens < len(current_input) // 2 + 100:
                break
            context.insert(1, msg)
            remaining -= tokens

        context.append({"role": "user", "content": current_input})
        return context
```

---

## 6. AI Features

### 6.1 Lead Scoring

ML-based lead scoring with explainable results (SHAP values):

```
Input: Lead profile data
Process:
  1. Embed lead text fields (name, title, company, notes)
  2. Normalize numerical features (company size, engagement count)
  3. Run through scoring model (LLM or ML model based on scale)
  4. Generate SHAP explanations for each factor
  5. Cache score for 24 hours (re-scored on lead update)

Output:
{
  "score": 85,
  "confidence": 0.92,
  "tier": "hot",
  "factors": [
    {"name": "title_seniority", "contribution": 15, "reason": "Title: VP of Sales"},
    {"name": "company_fit", "contribution": 20, "reason": "Target industry: SaaS"},
    {"name": "engagement", "contribution": 10, "reason": "Visited pricing page 3x"},
    {"name": "source_quality", "contribution": -5, "reason": "Purchased list"}
  ]
}
```

### 6.2 Next-Best-Action

Recommends the optimal next action for a lead or opportunity:

```
Input: Entity state + history + pipeline stage
Process:
  1. Collect entity timeline (activities, emails, calls, meetings)
  2. Collect pipeline stage data and conversion rates
  3. Generate recommendations via LLM
  4. Score each recommendation by predicted impact
  5. Return top 3 actions with rationale

Output:
{
  "recommendations": [
    {
      "action": "send_email",
      "subject": "Enterprise plan proposal",
      "priority": "high",
      "impact_score": 0.85,
      "rationale": "Lead is in decision stage, requested pricing"
    },
    {
      "action": "schedule_demo",
      "priority": "medium",
      "impact_score": 0.72,
      "rationale": "Technical evaluation needed before purchase"
    }
  ]
}
```

### 6.3 Sentiment Analysis

Real-time sentiment analysis on emails, call transcripts, and messages:

| Aspect | Description |
|--------|-------------|
| Polarity | Positive, Negative, Neutral, Mixed |
| Score | -1.0 (very negative) to +1.0 (very positive) |
| Emotions | Anger, Satisfaction, Urgency, Confusion, Interest |
| Topics | Key topics mentioned with sentiment per topic |
| Urgency | Low, Medium, High, Critical |
| Intent | Purchase, Support, Churn, Information |

### 6.4 Conversation Summary

Automated summaries of email threads and call recordings:

```
Input: Email thread (N messages) or Call transcript
Output:
{
  "summary": "3 sentence summary of the conversation",
  "key_points": ["Point 1", "Point 2"],
  "action_items": [
    {"task": "Send proposal", "owner": "John", "due": "2026-08-01"}
  ],
  "decisions": ["Agreed to proceed with pilot"],
  "sentiment_trend": "positive → neutral → positive",
  "next_steps": "Schedule technical review"
}
```

### 6.5 Entity Extraction

Extract structured entities from unstructured text:

```json
{
  "text": "Call with John from Acme Corp. He's interested in our Enterprise plan. Budget is $50k. Decision by next quarter.",
  "entities": {
    "people": [{"name": "John", "role": "contact"}],
    "organizations": [{"name": "Acme Corp", "type": "company"}],
    "products": [{"name": "Enterprise plan"}],
    "money": [{"amount": 50000, "currency": "USD"}],
    "dates": [{"expression": "next quarter"}],
    "intent": "purchase",
    "confidence": 0.88
  }
}
```

### 6.6 Deal Insights

AI-powered analysis of deal health and risks:

```
Input: Opportunity data + activity history + email sentiment
Output:
{
  "health_score": 72,
  "risk_factors": [
    {"risk": "Competitor engaged", "severity": "high", "detail": "Prospect mentioned competitor demo"},
    {"risk": "Stakeholder missing", "severity": "medium", "detail": "No contact with economic buyer"}
  ],
  "strengths": [
    {"strength": "Executive sponsorship", "detail": "VP Sales is champion"},
    {"strength": "Budget approved", "detail": "$50k allocated in Q3"}
  ],
  "recommended_actions": [
    "Schedule meeting with CFO",
    "Send competitive comparison document"
  ],
  "predicted_close_probability": 0.65,
  "forecast_category": "upside"
}
```

---

## 7. Cost Tracking

### 7.1 Token Counting

Every AI call is counted and attributed:

```python
@dataclass
class CostRecord:
    organization_id: UUID
    feature: str
    model: str
    provider: str
    prompt_tokens: int
    completion_tokens: int
    total_cost: Decimal
    timestamp: datetime

# Storage: Written to PostgreSQL via async batch insert (every 60s or 1000 records)
# Aggregation: Daily materialized view for org-level billing
```

### 7.2 Cost Dashboard

| Metric | Description |
|--------|-------------|
| Daily token usage per org | Tracked and aggregated by feature |
| Cost per feature | Lead scoring, RAG, sentiment, etc. |
| Cost per model | GPT-4o vs Claude vs economy models |
| Budget utilization | % of monthly budget consumed |
| Cost anomaly detection | > 2x standard deviation triggers alert |
| Projected monthly cost | Linear projection based on current usage |

### 7.3 Budget Alerts

```python
class BudgetManager:
    async def check_budget(self, org_id: UUID, feature: str) -> bool:
        """Check if org has budget remaining for a feature."""
        budget = await self.get_org_budget(org_id)
        usage = await self.get_org_usage(org_id, feature, period="month")
        if usage + estimated_cost > budget:
            await self.send_alert(org_id, feature, usage, budget)
            return False
        return True

    ALERT_THRESHOLDS = {
        "warning": 0.8,     # 80% of budget consumed
        "critical": 0.95,   # 95% consumed
        "exceeded": 1.0,    # Budget exceeded
    }
```

### 7.4 Model Tiering for Cost Optimization

```python
class ModelRouter:
    """Routes requests to appropriate model based on cost and performance needs."""

    TIER_CONFIG = {
        "economy": {
            "providers": ["openai"],
            "models": ["gpt-4o-mini"],
            "max_tokens": 1024,
            "max_retries": 2,
        },
        "standard": {
            "providers": ["openai", "anthropic"],
            "models": ["gpt-4o", "claude-3-sonnet-20240229"],
            "max_tokens": 4096,
            "max_retries": 3,
        },
        "premium": {
            "providers": ["openai", "anthropic"],
            "models": ["gpt-4o", "claude-3-opus-20240229"],
            "max_tokens": 8192,
            "max_retries": 3,
        },
    }

    def select_tier(self, feature: str, org_tier: str) -> str:
        if org_tier == "enterprise":
            return "premium"
        if feature in ["sentiment_analysis", "entity_extraction"]:
            return "economy"
        if feature in ["lead_scoring", "next_best_action"]:
            return "standard"
        return "standard"
```

---

## 8. Guardrails

### 8.1 Input Validation

```python
async def validate_input(text: str, feature: str, org_id: str) -> InputValidationResult:
    """Validate input before sending to LLM."""
    violations = []

    # 1. Size limits
    if len(text) > 32000:
        violations.append(Violation("input_too_long", f"Max 32000 chars, got {len(text)}"))

    # 2. Prompt injection detection
    injection_score = await detect_prompt_injection(text)
    if injection_score > 0.8:
        violations.append(Violation("prompt_injection_detected", f"Score: {injection_score}"))

    # 3. PII detection
    if feature in ["lead_scoring", "sentiment"]:
        pii_entities = await detect_pii(text)
        if pii_entities and org_tier not in ["enterprise"]:
            text = redact_pii(text, pii_entities)

    # 4. Language check
    lang = detect_language(text)
    if lang not in ALLOWED_LANGUAGES:
        violations.append(Violation("unsupported_language", f"Language: {lang}"))

    return InputValidationResult(
        cleaned_text=text,
        violations=violations,
        is_valid=len(violations) == 0,
    )
```

### 8.2 Output Filtering

```python
async def filter_output(text: str, feature: str) -> OutputFilterResult:
    """Filter and validate LLM output before returning to caller."""
    violations = []

    # 1. Hallucination detection
    hallucination_score = await detect_hallucination(text)
    if hallucination_score > 0.7:
        violations.append(Violation("possible_hallucination", f"Score: {hallucination_score}"))

    # 2. Structured output validation
    if feature == "lead_scoring":
        try:
            result = json.loads(text)
            assert 0 <= result["score"] <= 100
            assert 0 <= result["confidence"] <= 1
        except (json.JSONDecodeError, KeyError, AssertionError):
            violations.append(Violation("invalid_output_format"))

    # 3. Toxicity check
    toxicity_score = await detect_toxicity(text)
    if toxicity_score > 0.9:
        violations.append(Violation("toxic_content", f"Score: {toxicity_score}"))

    # 4. PII leakage
    pii_entities = await detect_pii(text)
    if pii_entities and not feature_requires_pii(feature):
        violations.append(Violation("pii_leakage", "PII detected in output"))

    return OutputFilterResult(
        cleaned_text=text,
        violations=violations,
        is_valid=len(violations) == 0,
    )
```

### 8.3 PII Detection

| PII Type | Detection Method | Redaction |
|----------|-----------------|-----------|
| Email | regex + NLP | `[EMAIL]` |
| Phone | regex (E.164) | `[PHONE]` |
| SSN | regex | `[SSN]` |
| Credit Card | Luhn + regex | `[CC]` |
| Address | NLP NER | `[ADDRESS]` |
| Name | NLP NER | `[NAME]` |
| IP Address | regex | `[IP]` |

### 8.4 Rate Limiting

```yaml
# Per-org rate limits for AI features
rate_limits:
  standard:
    chat: 100/hour
    embeddings: 1000/hour
    rag: 50/hour
    sentiment: 200/hour
  premium:
    chat: 500/hour
    embeddings: 5000/hour
    rag: 200/hour
    sentiment: 1000/hour
  enterprise:
    chat: unlimited
    embeddings: unlimited
    rag: unlimited
    sentiment: unlimited
```

---

## 9. Evaluation

### 9.1 Offline Evaluation

```python
class OfflineEvaluator:
    """Evaluate AI model performance against labeled datasets."""

    METRICS = {
        "lead_scoring": ["mae", "rmse", "spearman_rho", "precision@10", "recall@10"],
        "sentiment": ["accuracy", "f1", "precision", "recall", "confusion_matrix"],
        "entity_extraction": ["precision", "recall", "f1", "exact_match"],
        "classification": ["accuracy", "f1_weighted", "log_loss"],
    }

    def evaluate(self, dataset: LabeledDataset, model_version: str) -> EvaluationResult:
        predictions = []
        labels = []
        for example in dataset:
            prediction = self.model.predict(example.input)
            predictions.append(prediction)
            labels.append(example.label)
        return self._compute_metrics(predictions, labels)
```

### 9.2 Online Evaluation (A/B Comparison)

```yaml
# A/B test configuration for model comparison
experiment:
  name: lead_scoring_v3_vs_v4
  start_time: "2026-07-15T00:00:00Z"
  end_time: "2026-08-15T00:00:00Z"
  variants:
    - name: control
      model_version: v3
      traffic_weight: 50
    - name: treatment
      model_version: v4
      traffic_weight: 50
  metrics:
    - conversion_rate (primary)
    - score_accuracy
    - avg_score
    - user_feedback_score
  success_criteria:
    - treatment.conversion_rate > control.conversion_rate * 1.05
    - p_value < 0.05
```

### 9.3 Drift Detection

```python
class DriftDetector:
    """Monitor model drift over time."""

    def check_drift(self, feature: str) -> DriftReport:
        current_distribution = self.get_current_distribution(feature)
        baseline_distribution = self.get_baseline_distribution(feature)
        drift_score = self.compute_js_divergence(current_distribution, baseline_distribution)
        return DriftReport(
            feature=feature,
            drift_score=drift_score,
            threshold=0.1,
            is_drifting=drift_score > 0.1,
            alert_triggered=drift_score > 0.2,
        )
```

### 9.4 Model Regression Testing

```yaml
# CI/CD pipeline step: AI model regression tests
regression_tests:
  lead_scoring:
    test_cases:
      - input: {title: "CEO", company_size: 500, source: "referral"}
        expected: {score_min: 70, score_max: 100}
      - input: {title: "Intern", company_size: 5, source: "purchased"}
        expected: {score_min: 0, score_max: 30}
      - input: {title: "VP Engineering", company_size: 200, source: "website"}
        expected: {score_min: 50, score_max: 85}
  sentiment:
    test_cases:
      - input: "This is amazing! Thank you so much!"
        expected: {polarity: "positive", score_min: 0.7}
      - input: "This is terrible. I want a refund."
        expected: {polarity: "negative", score_min: -1.0, score_max: -0.5}
```

### 9.5 Evaluation Dashboard

| Metric | Lead Scoring | Sentiment | RAG | Entities |
|--------|-------------|-----------|-----|----------|
| Accuracy | 87% | 94% | 82% | 91% |
| Precision | 0.85 | 0.92 | 0.78 | 0.89 |
| Recall | 0.82 | 0.95 | 0.75 | 0.88 |
| F1 Score | 0.83 | 0.93 | 0.76 | 0.88 |
| Latency p95 | 1.2s | 0.8s | 2.1s | 0.6s |
| Drift | None | None | Detected | None |
| Sample Size | 12,450 | 8,230 | 3,100 | 5,670 |
