# ADR-007: AI Gateway — FastAPI Sidecar

- **Status:** Accepted
- **Date:** 2025-07-27
- **Authors:** Chief Architect, AI Lead

## Context

TZAHU CRM is an AI-first platform. AI workloads (LLM inference, embeddings, RAG, agent orchestration) have different performance and scaling characteristics than typical CRUD operations. These workloads benefit from async I/O, streaming responses, and GPU utilization.

## Options Considered

### 1. FastAPI Sidecar (Selected)
- **Pros:** Native async for streaming LLM responses, separate scaling (can scale AI worker independently), does not block Django request pool, separate deployment (can use GPU nodes), FastAPI's automatic OpenAPI docs, Pydantic validation, async database access via SQLAlchemy async, clear separation of concerns. Can use LangChain and OpenAI SDK efficiently in async mode.
- **Cons:** Additional network hop (Django→FastAPI), requires service discovery/load balancing, data duplication if FastAPI needs DB access, requires shared auth (JWT validation in both services).

### 2. Embedded in Django (DRF views for AI)
- **Pros:** No additional network hop, shared auth/DB context, simpler deployment (single process), simpler codebase.
- **Cons:** Django's sync ORM blocks async AI calls, request pool contention (AI requests block DB CRUD), cannot scale AI separately, streaming responses difficult with DRF, Celery task-based AI is poor for interactive chat.

### 3. Separate Python Service (Standalone AI microservice)
- **Pros:** Full isolation, independent tech stack, independent scaling, clear team ownership.
- **Cons:** Full microservice overhead, requires API gateway, service mesh, data synchronization, duplicate infrastructure, over-engineering for current stage.

### 4. AWS Bedrock / Managed AI Gateway
- **Pros:** Zero operations, managed API keys, usage tracking, guardrails.
- **Cons:** Cloud vendor lock-in, higher per-request cost, latency, cannot run custom models or fine-tuned open-source models, data residency concerns.

## Decision

**Deploy a FastAPI sidecar service** alongside the Django monolith for AI-specific workloads.

Architecture:
- Django monolith handles CRUD, auth, business logic
- FastAPI sidecar handles: LLM chat/streaming, embedding generation, RAG pipeline, AI agent orchestration, smart suggestions, lead scoring inference
- Communication: Django publishes to RabbitMQ → FastAPI consumes; or Django makes HTTP calls to FastAPI internal endpoint for synchronous AI results
- Both services share: PostgreSQL database (Django ORM for writes, SQLAlchemy async for FastAPI reads), Redis cache, RabbitMQ events
- Auth: FastAPI validates JWT from Authorization header (same RS256 public key as Django)

## Consequences

- **Positive:** Django handles CRUD (sync, stable), FastAPI handles AI (async, streaming). Each scales independently.
- **Positive:** Can deploy FastAPI on GPU nodes without affecting Django.
- **Positive:** FastAPI is natural for LangChain + OpenAI streaming with Server-Sent Events.
- **Negative:** Additional service to deploy and monitor.
- **Negative:** Two services share the database; careful with connection pooling (separate pool for each).
- **Negative:** AI features depend on FastAPI being available (resilience: fallback to cached/model responses).

## Compliance

- FastAPI runs as a separate Docker service in docker-compose and K8s.
- Both services validate JWT using the same RS256 public key.
- AI endpoints are prefixed with `/api/ai/` through Nginx routing.
- API contract: All AI endpoints documented in OpenAPI spec (`/ai/docs`).
- No direct Django→FastAPI DB writes; FastAPI is read-only for CRM data.
