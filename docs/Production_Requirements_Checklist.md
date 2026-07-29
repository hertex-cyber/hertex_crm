# TZAHU CRM — Production-Level Requirements Checklist

> **Purpose:** Everything you need to build, run, and ship a production-grade CRM.  
> **For:** Founder — to understand what tools/services we need and what they cost.

---

## 1. Development Tools

| Tool | Why We Need It | Cost |
|------|---------------|------|
| **VS Code** or **Cursor** | Code editor — primary dev environment | Free / $20/mo (Cursor) |
| **Claude Code / GitHub Copilot** | AI coding assistant — writes & debugs code | $10-20/user/mo |
| **Git** | Version control — track every change | Free |
| **GitHub** | Host our code, manage PRs, issues, CI/CD | Free (public) / $4/user/mo (private) |
| **Docker Desktop** | Run the full stack locally (PostgreSQL, Redis, etc.) | Free |
| **Postman / Bruno** | Test APIs during development | Free |
| **TablePlus / DBeaver** | Database GUI — browse data, run queries | Free / $60 one-time |

---

## 2. Version Control & Collaboration

| Service | Purpose | Plan |
|---------|---------|------|
| **GitHub** | Code repository, pull requests, code reviews | Team plan: $4/user/mo |
| **GitHub Issues** | Task tracking, bug reports, sprint planning | Included |
| **GitHub Projects** | Kanban board for project management | Included |
| **GitHub Wiki** | Internal developer documentation | Included |
| **GitHub Actions** | CI/CD — auto-test, auto-deploy | 2000 min/mo free |

---

## 3. Backend Stack

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| **Runtime** | Python | 3.13 | Backend programming language |
| **Web Framework** | Django | 5.x | Core backend — handles auth, admin, ORM, routing |
| **REST API** | Django REST Framework (DRF) | 3.x | Build all API endpoints |
| **API Docs** | drf-spectacular | Latest | Auto-generate OpenAPI docs |
| **Task Queue** | Celery | 5.x | Run background jobs (emails, reports, AI) |
| **ASGI Server** | Uvicorn + Django Channels | Latest | WebSocket support (real-time notifications) |
| **WSGI Server** | Gunicorn | Latest | Serve the Django app in production |
| **Package Manager** | Poetry / uv | Latest | Python dependency management |
| **Linter** | Ruff | Latest | Code quality — catch bugs before commit |
| **Type Checker** | mypy | Latest | Catch type errors before they reach production |

### Python Packages (Key Dependencies)

```
django, djangorestframework, drf-spectacular
celery, redis, pika (RabbitMQ)
psycopg2-binary, pgvector
boto3 / minio (file storage)
sendgrid / boto3 (email)
twilio (SMS/voice)
pydantic, structlog, sentry-sdk
gunicorn, uvicorn, channels
pytest, factory-boy, coverage
```

---

## 4. Database & Storage

| Component | Technology | Version | Why |
|-----------|-----------|---------|-----|
| **Primary Database** | PostgreSQL | 16 | All CRM data — ACID, reliable |
| **Vector Extension** | pgvector | 0.7+ | AI embeddings — search by meaning, not just keywords |
| **Full-Text Search** | pg_trgm | Built-in | Fuzzy text search across leads, contacts |
| **Connection Pool** | PgBouncer | Latest | Handle 1000s of concurrent connections without crashing DB |
| **Cache** | Redis | 7.x | Speed — cache API responses, user sessions, rate limiting |
| **File Storage** | MinIO (dev) / AWS S3 (prod) | Latest | Store images, attachments, call recordings, exports |
| **Message Broker** | RabbitMQ | 3.13+ | Reliable message delivery for background jobs |

### Estimated Database Size

| Stage | Est. DB Size | Notes |
|-------|-------------|-------|
| Dev / Testing | 1-5 GB | Local PostgreSQL |
| 50 orgs (R1) | 50-100 GB | Single RDS instance |
| 200 orgs (R2) | 200-500 GB | Read replicas needed |
| 1000 orgs (R3) | 1-5 TB | Multi-region, partitioning |

---

## 5. Frontend Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Language** | TypeScript | Type safety — fewer runtime bugs |
| **Framework** | React 19 | UI components |
| **Build Tool** | Vite | Fast development, optimized production builds |
| **UI Library** | Material UI (MUI) 6 | Pre-built components — don't reinvent buttons |
| **Server State** | TanStack Query | Cache API data, auto-refresh |
| **Client State** | Zustand | Lightweight global state |
| **Routing** | React Router 7 | Page navigation |
| **HTTP Client** | Axios | API calls with JWT interceptors |
| **Forms** | React Hook Form + Zod | Fast forms with validation |
| **Testing** | Vitest + Testing Library | Unit & integration tests |
| **E2E Tests** | Playwright | Browser tests — simulate real user flows |

---

## 6. AI / ML Stack

| Component | Technology | Purpose | Cost |
|-----------|-----------|---------|------|
| **LLM Provider** | OpenAI (GPT-4o) | Primary AI — chat, scoring, summaries | ~$0.15/1M input tokens |
| **Fallback LLM** | Anthropic (Claude) | Backup if OpenAI is down | ~$0.15/1M input tokens |
| **AI Framework** | LangChain | Chain prompts, tool-calling, RAG | Free (open source) |
| **AI Gateway** | FastAPI sidecar | Separate service for AI (doesn't slow down CRM) | Free |
| **Embeddings** | OpenAI text-embedding-3-small | Convert text to vectors for search | ~$0.02/1M tokens |
| **Vector Store** | pgvector | Store embeddings in PostgreSQL | Free (included) |
| **Speech-to-Text** | Deepgram / Whisper | Transcribe call recordings | $0.0043/min (Deepgram) |
| **Text-to-Speech** | ElevenLabs / OpenAI TTS | Voice AI responses | ~$0.015/1K chars |
| **AI Monitoring** | LangFuse / Helicone | Track AI costs, latency, quality | Free tier / $59/mo |

---

## 7. Infrastructure & Hosting

### Development

| Service | Purpose | Cost |
|---------|---------|------|
| Docker Compose | Run everything locally (DB, Redis, Queue) | Free |
| MinIO (local) | Local S3-compatible file storage | Free |
| ngrok / localtunnel | Expose local server for testing webhooks | Free / $20/mo |

### Production (AWS — Estimated Monthly Costs)

| Service | What It Runs | R1 (50 orgs) | R2 (200 orgs) | R3 (1000 orgs) |
|---------|-------------|-------------|--------------|---------------|
| **EKS (K8s)** | Django, Celery, AI Gateway | $150/mo | $300/mo | $600/mo |
| **RDS PostgreSQL** | Database | $50/mo (db.t3.medium) | $200/mo (db.r6g.large) | $800/mo (db.r6g.2xlarge + replicas) |
| **ElastiCache Redis** | Cache, sessions | $30/mo (cache.t3.small) | $60/mo (cache.r6g.large) | $200/mo (cluster mode) |
| **S3** | File storage | $5/mo | $20/mo | $100/mo |
| **CloudFront** | CDN for frontend | $10/mo | $30/mo | $100/mo |
| **ALB** | Load balancer | $25/mo | $50/mo | $100/mo |
| **ECR** | Docker image registry | $5/mo | $10/mo | $20/mo |
| **Route53** | DNS | $5/mo | $5/mo | $10/mo |
| **Total AWS** | | **~$280/mo** | **~$675/mo** | **~$1,930/mo** |

### Alternative: Single Server (Early Stage)

If you want to start cheaper before K8s:

| Service | What | Cost |
|---------|------|------|
| **Hetzner / Vultr VPS** | 8 vCPU, 32GB RAM, 200GB NVMe | ~$50-80/mo |
| Run everything on one server with Docker Compose | Django + Celery + PostgreSQL + Redis + RabbitMQ | Included |

---

## 8. Third-Party Services

| Service | Purpose | Cost | When Needed |
|---------|---------|------|------------|
| **SendGrid** / **AWS SES** | Transactional emails (welcome, reset password) | Free (100/day) / ~$1/1000 emails | R1 |
| **Twilio** | SMS notifications + Voice AI | ~$0.0079/SMS + $0.013/min voice | R1 (SMS), R3 (Voice) |
| **Stripe** | Payment processing (subscriptions) | 2.9% + $0.30 per transaction | R2 |
| **Sentry** | Error tracking & performance monitoring | Free (5k events/mo) / $29/mo | R1 |
| **Meta (WhatsApp Cloud API)** | WhatsApp messaging in Unified Inbox | Free (1000 conversations/mo) | R2 |
| **Meta Graph API** | Instagram DM + Facebook Messenger | Free | R2 |
| **OpenAI API** | AI features (chat, scoring, embeddings) | Pay-as-you-go (~$50-500/mo) | R3 |
| **Deepgram** | Call transcription | $0.0043/min | R3 |
| **Google Workspace** | Company email, docs | $6/user/mo | R0 |
| **Slack** | Team communication | Free / $8.75/user/mo | R0 |
| **Vanta / Drata** | SOC 2 compliance automation | ~$15,000/year | R2 |
| **Statuspage** | Service status page | Free | R2 |

---

## 9. CI/CD & Monitoring

| Tool | Purpose | Cost |
|------|---------|------|
| **GitHub Actions** | Auto-test, auto-deploy on every push | Free (2000 min/mo) |
| **Docker** | Containerize everything | Free |
| **Terraform** | Infrastructure as Code (AWS setup) | Free |
| **Prometheus** | Metrics collection (CPU, memory, requests) | Free (open source) |
| **Grafana** | Dashboards — see what's happening | Free / $50/mo (Grafana Cloud) |
| **Loki** | Log aggregation — search all logs in one place | Free / $30/mo (Grafana Cloud) |
| **OpenTelemetry** | Distributed tracing — debug slow requests | Free (open source) |
| **Flower** | Celery task monitoring UI | Free |
| **RabbitMQ Management** | Queue monitoring UI | Built-in |
| **Uptime Robot / Pingdom** | External uptime monitoring | Free / $15/mo |
| **PagerDuty / Opsgenie** | On-call alerting | Free / $15/user/mo |

---

## 10. Security Requirements

| Requirement | How We Handle It | When |
|------------|-----------------|------|
| **HTTPS / TLS 1.3** | AWS ALB + Cert Manager | R0 |
| **JWT Authentication** | Access token (15min) + Refresh token (7 days) — RS256 signed | R1 |
| **Password Hashing** | bcrypt, cost factor 12 | R1 |
| **Multi-Factor Auth (MFA)** | TOTP via authenticator app | R2 |
| **RBAC (Role-Based Access)** | Admin, Manager, Rep, Read-Only roles | R1 |
| **Row-Level Security (RLS)** | PostgreSQL RLS — even a bug can't leak data | R1 |
| **Rate Limiting** | Redis-backed, tiered by plan | R1 |
| **Audit Log** | Every data change logged — immutable after 5 min | R1 |
| **Encryption at Rest** | PostgreSQL TDE + MinIO SSE-S3 (AES-256) | R1 |
| **Secrets Management** | Never in code — AWS Secrets Manager / Vault | R1 |
| **GDPR Compliance** | Consent tracking, export, erasure, DPA | R2 |
| **SOC 2 Type II** | Annual audit — access control, availability, confidentiality | R2 |
| **SSO / SAML** | Enterprise single sign-on (Okta, Azure AD) | R3 |
| **Penetration Testing** | Annual third-party pen test | R3 |
| **Bug Bounty Program** | Invite researchers to find vulnerabilities | R3 |

---

## 11. Team & Skill Requirements

| Role | Skills Needed | When to Hire |
|------|-------------|-------------|
| **Founder / Tech Lead** | Full-stack Python + React, architecture decisions | Day 1 |
| **Backend Engineer** | Django, PostgreSQL, Celery, REST APIs | R1 (if founder isn't full-time dev) |
| **Frontend Engineer** | React, TypeScript, MUI, TanStack Query | R1 |
| **DevOps Engineer** | Docker, K8s, Terraform, AWS, CI/CD | R2 or part-time |
| **AI Engineer** | LangChain, LLMs, RAG, embeddings | R3 |
| **UI/UX Designer** | Design system, user research, Figma | R1 (contract) |
| **QA Engineer** | Test automation, Playwright, pytest | R2 |
| **Security Engineer** | Pen testing, compliance, SOC 2 | R2 (consultant) |

---

## 12. Quick Start: What to Install on Day 1

```bash
# 1. Version control
git
GitHub account

# 2. Backend
Python 3.13
Poetry or uv (package manager)
Docker Desktop + Docker Compose

# 3. Frontend
Node.js 22
npm or pnpm

# 4. Database tools
PostgreSQL 16 (via Docker)
TablePlus or DBeaver (GUI)

# 5. API testing
Postman or Bruno

# 6. AI coding assistant
Claude Code or GitHub Copilot

# 7. Code quality
Ruff (linter)
mypy (type checker)
Pre-commit (auto-run checks before every commit)
```

---

## 13. Monthly Cost Summary by Phase

| Category | R1 (Months 1-6) | R2 (Months 7-12) | R3 (Months 13-18) |
|----------|----------------|-----------------|------------------|
| **Infrastructure (AWS)** | $280/mo | $675/mo | $1,930/mo |
| **Third-party Services** | $50/mo | $200/mo | $800/mo |
| **AI API Costs** | — | $50/mo | $500/mo |
| **Monitoring** | $30/mo | $80/mo | $200/mo |
| **Team (3-6 people)** | $30,000/mo | $50,000/mo | $80,000/mo |
| **Total Monthly Burn** | **~$30,360/mo** | **~$51,005/mo** | **~$83,430/mo** |

> **Note:** You can cut infrastructure to ~$80/mo early on by using a single VPS (Hetzner) instead of AWS K8s.
