# Module Blueprint: AI Platform

- **Module:** `modules.ai_platform` (FastAPI sidecar) + `modules.ai_integration` (Django bridge)
- **Bounded Context:** AI/ML Services, LLM Orchestration, Embeddings, Smart Features
- **Status:** Draft v1.0

## Business Purpose

The AI Platform provides intelligence across the entire CRM: lead scoring, smart suggestions, semantic search, predictive analytics, natural language queries, content generation, and automated workflows. It abstracts AI/ML complexity behind a clean service interface, enabling CRM features to leverage AI without coupling to specific providers.

## Architecture

The AI Platform has two components:
1. **Django Bridge Module** (`modules.ai_integration`): Configuration, model registry, prompt templates, usage tracking, and gating logic in Django.
2. **FastAPI Sidecar Service** (`services/ai_gateway/`): Heavy AI workloads—LLM inference, embedding generation, RAG pipeline, agent orchestration. See ADR-007.

Communication: Django → RabbitMQ (task requests) → FastAPI consumer; or Django → HTTP (synchronous results) → FastAPI.

## Bounded Context

This module owns: AI model configuration, prompt templates, embedding management, RAG pipeline configuration, AI agent definitions, usage quotas, and model telemetry. It does NOT own domain-specific AI logic (e.g., lead scoring formula) — those are owned by respective domain modules.

## Aggregates, Entities, Value Objects

### Aggregate: AIModel
- **AIModel** (Aggregate Root)
  - `id: UUID v7`
  - `tenant_id: UUID v7`
  - `name: str` (e.g., "gpt-4o", "claude-3.5", "text-embedding-3-large")
  - `provider: AIProvider` (OPENAI, ANTHROPIC, AZURE_OPENAI, LOCAL)
  - `model_type: ModelType` (LLM, EMBEDDING, CLASSIFIER, RERANKER)
  - `config: JSONB` (temperature, max_tokens, top_p, etc.)
  - `capabilities: Array[str]` (CHAT, STREAMING, FUNCTION_CALLING, VISION)
  - `cost_per_1k_input: Decimal`
  - `cost_per_1k_output: Decimal`
  - `is_active: bool`
  - `rate_limit: JSONB` (requests_per_minute, tokens_per_minute)
  - `timestamps: created_at, updated_at`

### Aggregate: PromptTemplate
- **PromptTemplate**
  - `id: UUID v7`
  - `tenant_id: UUID v7`
  - `name: str`
  - `description: Text`
  - `model_id: FK(AIModel)`
  - `system_prompt: Text` (Jinja2 template)
  - `user_prompt_template: Text` (Jinja2 template, variables from context)
  - `output_schema: JSONB | None` (JSON Schema for structured output)
  - `temperature: Decimal`
  - `max_tokens: int`
  - `version: int`
  - `is_active: bool`
  - `category: str` (LEAD_SCORING, SMART_SUGGESTION, SUMMARY, CLASSIFICATION)

### Value Objects
- **AIProvider:** `enum(OPENAI, ANTHROPIC, AZURE_OPENAI, GOOGLE, LOCAL_LLM)`
- **ModelType:** `enum(LLM, EMBEDDING, CLASSIFIER, RERANKER, IMAGE_GENERATION)`
- **EmbeddingModel:** `enum(OPENAI_TEXT_EMBEDDING_3_LARGE, OPENAI_TEXT_EMBEDDING_3_SMALL, LOCAL_EMBEDDING)`
- **AIRequestStatus:** `enum(PENDING, PROCESSING, COMPLETED, FAILED, CANCELLED)`
- **SafetyCategory:** `enum(VIOLENCE, HATE, SEXUAL, SELF_HARM, HARASSMENT, UNSPECIFIED)`

### Aggregate: RAGPipeline
- **RAGPipeline** (Configuration for Retrieval-Augmented Generation)
  - `id: UUID v7`
  - `tenant_id: UUID v7`
  - `name: str`
  - `embedding_model_id: FK(AIModel)`
  - `llm_model_id: FK(AIModel)`
  - `chunking_strategy: ChunkingStrategy`
  - `chunk_size: int` (tokens)
  - `chunk_overlap: int` (tokens)
  - `retrieval_k: int` (number of chunks to retrieve)
  - `retrieval_strategy: RetrievalStrategy` (VECTOR_ONLY, HYBRID, MMR)
  - `reranker_id: FK(AIModel) | None`
  - `prompt_template_id: FK(PromptTemplate)`
  - `indexed_entities: Array[str]` (which entities to index: lead, opportunity, etc.)

- **ChunkingStrategy:** `enum(FIXED_SIZE, RECURSIVE, SEMANTIC, MARKDOWN_HEADER)`
- **RetrievalStrategy:** `enum(VECTOR_ONLY, HYBRID_FTS_VECTOR, MMR, CONTEXTUAL_COMPRESSION)`

### Entities
- **EmbeddingRecord:** Vector embeddings for entities
  - `id, tenant_id, entity_type, entity_id, embedding vector(1536), chunk_text, metadata JSONB`
- **AIRequestLog:** Usage tracking and audit
  - `id, tenant_id, user_id, model_id, prompt_template_id, input_tokens, output_tokens, duration_ms, cost, status, error`
- **AIAgent:** Configurable AI agents for autonomous tasks
  - `id, tenant_id, name, system_prompt, tools, max_iterations, is_active`

## Domain Events

- `EmbeddingGenerated` — Vector embedding created/updated for entity
- `AIRequestCompleted` — AI processing finished (with result)
- `AIRequestFailed` — AI processing failed (with error)
- `ModelQuotaExceeded` — Tenant reached rate limit/cost cap
- `ModelCostAlert` — Monthly cost threshold crossed
- `PromptExecuted` — Prompt template evaluated and executed

## Commands & Queries

### Commands
- `GenerateEmbeddings(entity_type, entity_ids) → void` (batch)
- `ExecutePrompt(prompt_template_id, context) → AIResult`
- `StartAIAgent(agent_id, goal) → AgentExecutionId`
- `StreamChat(model_id, messages, stream_config) → AsyncStream`
- `ScoreLead(lead_id) → ScoreResult`
- `GenerateSuggestions(entity_type, entity_id) → List[Suggestion]`
- `SemanticSearch(query, entity_type, filters, k) → SearchResult`
- `SummarizeEntity(entity_type, entity_id) → Summary`
- `ClassifyEntity(entity_type, entity_id, categories) → Classification`

### Queries
- `GetEmbedding(entity_type, entity_id) → EmbeddingRecord`
- `SearchSimilarEntities(entity_type, entity_id, k) → List[Similar]`
- `GetAIUsage(tenant_id, period) → UsageReport`
- `GetModelCosts(tenant_id, period) → CostReport`
- `GetPromptTemplates(category?) → List[PromptTemplate]`
- `GetRAGStatus(pipeline_id) → RAGStatus`

## Application Services

- `EmbeddingService` — Generate and store embeddings for entities
- `PromptExecutionService` — Resolve prompt templates and execute LLM calls
- `RAGService` — Chunk, index, retrieve, and generate with RAG
- `SemanticSearchService` — Hybrid vector + FTS search
- `AIAgentService` — Agent lifecycle management (OpenAI Assistants API or LangChain agents)
- `UsageTrackingService` — Token counting, cost calculation, quota enforcement
- `ModelRouter` — Route requests to appropriate model based on capability, cost, tenant config

## API Endpoints

FastAPI sidecar endpoints (prefixed `/api/ai/`):

| Method | URL | Description | Auth |
|--------|-----|-------------|------|
| POST | `/api/ai/chat/` | Chat completion (streaming SSE) | JWT |
| POST | `/api/ai/chat/{agent_id}/` | Chat with AI agent | JWT |
| POST | `/api/ai/embeddings/` | Generate embeddings | JWT |
| POST | `/api/ai/search/` | Semantic search | JWT |
| POST | `/api/ai/suggest/` | Get smart suggestions | JWT |
| POST | `/api/ai/score/lead/{id}/` | Score a lead | JWT |
| POST | `/api/ai/summarize/` | Summarize entity | JWT |
| POST | `/api/ai/classify/` | Classify entity | JWT |
| POST | `/api/ai/stream/{session_id}/` | Streaming chat session | JWT |
| GET | `/api/ai/health/` | Health check | None |
| GET | `/api/ai/models/` | List available models | JWT |
| GET | `/api/ai/usage/` | Usage statistics | JWT |

Django management endpoints:

| Method | URL | Description | Permissions |
|--------|-----|-------------|-------------|
| GET | `/api/v1/ai/models/` | List configured models | `ai.view_model` |
| POST | `/api/v1/ai/models/` | Add model configuration | `ai.add_model` |
| GET | `/api/v1/ai/prompts/` | List prompt templates | `ai.view_prompt` |
| POST | `/api/v1/ai/prompts/` | Create prompt template | `ai.add_prompt` |
| GET | `/api/v1/ai/rag-pipelines/` | List RAG pipelines | `ai.view_rag` |
| POST | `/api/v1/ai/rag-pipelines/` | Create RAG pipeline | `ai.add_rag` |
| POST | `/api/v1/ai/rag-pipelines/{id}/index/` | Rebuild index | `ai.change_rag` |
| GET | `/api/v1/ai/usage/` | Usage and cost report | `ai.view_usage` |

## Database Tables

- `ai_model` — Model configurations
- `ai_prompttemplate` — Prompt templates (with versioning)
- `ai_ragpipeline` — RAG pipeline configurations
- `ai_embedding` — Vector embeddings
- `ai_airequestlog` — AI request audit trail
- `ai_aiagent` — AI agent configurations
- `ai_usagequota` — Tenant usage quotas and limits

### Key Indexes
- `(tenant_id, model_type, is_active)` — Active models by type
- `(tenant_id, category, is_active)` — Prompt templates by category
- `(entity_type, entity_id)` — Embedding lookup
- `(tenant_id, created_at)` — Usage analytics
- GIN index on `ai_embedding.embedding` via pgvector (IVFFlat or HNSW)

### Partitioning

`ai_airequestlog` should be partitioned by month due to high write volume:
```sql
CREATE TABLE ai_airequestlog (...) PARTITION BY RANGE (created_at);
```

## Validation Rules

| Field | Rule |
|-------|------|
| model name | Must match known provider model names |
| provider | Must have valid API key configured in tenant secrets |
| temperature | 0.0 - 2.0 (OpenAI range) |
| max_tokens | 1 - 128000 (model-dependent) |
| prompt template | Must compile with Jinja2; all variables must have defaults or be required |
| embedding dimension | Must match model's output dimension (1536 for ada-002, 3072 for 3-large) |
| chunk_size | 100-2000 tokens |
| retrieval_k | 1-50 |

## RAG Pipeline Workflow

1. **Indexing Phase:**
   - Entity changes → domain event → trigger reindexing
   - Entity data chunked (by strategy) → embedded → stored in `ai_embedding`
   - FTS search vector also updated for hybrid search

2. **Query Phase:**
   - User query → embedding → vector similarity search
   - Optional: FTS search → hybrid fusion (weighted score)
   - Optional: Reranker re-scores top-k results
   - Context assembled from retrieved chunks
   - LLM prompt with context → generated response

3. **Scheduling:**
   - Full reindex nightly (Celery beat)
   - Incremental index on entity change (event-driven)

## Security & Permissions

| Permission | Description |
|------------|-------------|
| `ai.view_model` | View AI model configs |
| `ai.add_model` | Add model configurations |
| `ai.change_model` | Edit model configs |
| `ai.view_prompt` | View prompt templates |
| `ai.add_prompt` | Create prompts |
| `ai.change_prompt` | Edit prompts |
| `ai.view_rag` | View RAG pipelines |
| `ai.add_rag` | Create RAG pipelines |
| `ai.change_rag` | Edit and reindex RAG |
| `ai.view_usage` | View usage and costs |
| `ai.use_ai` | Execute AI requests (per-tenant) |
| `ai.admin` | Full AI platform admin |

AI usage is tracked per-user and per-tenant. Quotas enforced at tenant level (monthly token caps, cost limits). Sensitive data filtering: PII masking before sending to LLM providers.

## Testing Strategy

| Layer | Focus |
|-------|-------|
| Unit | Prompt template rendering, Token counting, Cost calculation, Quota enforcement, Embedding dimension validation |
| Integration | Embedding generation → storage → search pipeline, RAG pipeline with mocked LLM, Usage tracking end-to-end |
| API | Chat completion, Search results, Streaming responses, Error handling (timeouts, rate limits, invalid models) |
| E2E | Semantic search returns relevant results, AI suggestions are contextually appropriate |

Note: AI tests use mocked LLM responses (deterministic) to avoid API costs and non-deterministic results.

## Future Enhancements

- **Multi-Provider Routing:** Automatically route to cheapest/fastest model based on task complexity
- **Fine-Tuning Pipeline:** Fine-tune models on tenant-specific data
- **AI Guardrails:** Content safety filters, PII redaction, prompt injection detection
- **Custom Knowledge Base:** Upload documents for RAG per tenant
- **AI Copilot:** Contextual AI assistant across all CRM screens
- **Predictive Analytics:** Churn prediction, revenue forecasting, next-best-action
- **Voice Interface:** Speech-to-text for call logging and voice commands
- **BYOM (Bring Your Own Model):** Tenant-specific model endpoints
