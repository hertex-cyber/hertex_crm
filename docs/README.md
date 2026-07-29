# TZAHU CRM — Documentation Master Index

**TZAHU CRM** is an AI-first, multi-tenant enterprise CRM platform built with Django 5.x, React 18, PostgreSQL 16, and a modern event-driven architecture.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        React SPA (Vite + MUI 5)                 │
│              TanStack Query │ Zustand │ React Router 6          │
├──────────────────────┬──────────────────┬──────────────────────┤
│    Nginx Reverse Proxy / Load Balancer / K8s Ingress           │
├──────────────────────┼──────────────────┼──────────────────────┤
│  Django Monolith     │  FastAPI Sidecar │  Celery Workers      │
│  (DRF REST API)      │  (AI Gateway)    │  (Background Tasks)  │
│  Gunicorn + Sync     │  Uvicorn + Async │                      │
├──────────────────────┴──────────────────┴──────────────────────┤
│  PostgreSQL 16 (pgvector, pg_trgm) │ Redis 7 │ RabbitMQ        │
│  MinIO (S3 Storage) │ OpenTelemetry │ Prometheus │ Grafana     │
├─────────────────────────────────────────────────────────────────┤
│  Docker │ Kubernetes │ GitHub Actions │ AWS │ Sentry            │
└─────────────────────────────────────────────────────────────────┘
```

## Document Index

### Project Foundation (00-09)

| # | Document | Description | Audience |
|---|----------|-------------|----------|
| 00 | `00_ProjectMemory.md` | Complete project context, decisions, constraints | All |
| 01 | `01_ProjectVision.md` | Vision statement, goals, key differentiators | PM, Stakeholders |
| 02 | `02_BusinessRequirements.md` | Business needs, user stories, epics | PM, Product |
| 03 | `03_FunctionalRequirements.md` | Detailed functional requirements | Dev, QA |
| 04 | `04_NonFunctionalRequirements.md` | Performance, security, scalability, compliance | Dev, DevOps |
| 05 | `05_ProductRoadmap.md` | Phased delivery roadmap (MVP → V2 → V3) | PM, Stakeholders |
| 06 | `06_ImplementationPlan.md` | Phased implementation approach | Dev, PM |
| 07 | `07_BackendImplementationPlan.md` | Backend-specific build order | Backend Dev |
| 08 | `08_FrontendImplementationPlan.md` | Frontend-specific build order | Frontend Dev |
| 09 | `09_DevOpsImplementationPlan.md` | Infrastructure, CI/CD, deployment plan | DevOps |

### Architecture & Design (10-15)

| # | Document | Description | Audience |
|---|----------|-------------|----------|
| 10 | `10_ArchitectureOverview.md` | High-level architecture summary | All |
| 11 | `11_SystemArchitecture.md` | System context, containers, components | Architect, Dev |
| 12 | `12_HighLevelDesign.md` | Module boundaries, communication, data flow | Architect, Dev |
| 13 | `13_LowLevelDesign.md` | Detailed class, sequence, and state diagrams | Dev |
| 14 | `14_ModuleDependencyMap.md` | Module dependencies and import rules | Architect, Dev |
| 15 | `15_ProjectStructure.md` | Repository layout, package structure | Dev |

### Architecture Decision Records (41)

| # | Document | Decision | Status |
|---|----------|----------|--------|
| ADR-001 | `ArchitectureDecisionRecords/ADR-001-Python-Framework.md` | Django 5.x as primary web framework | Accepted |
| ADR-002 | `ArchitectureDecisionRecords/ADR-002-Application-Topology.md` | Modular Monolith (not microservices) | Accepted |
| ADR-003 | `ArchitectureDecisionRecords/ADR-003-Database-Isolation.md` | Shared Schema + PostgreSQL RLS | Accepted |
| ADR-004 | `ArchitectureDecisionRecords/ADR-004-ID-Strategy.md` | UUID v7 (not auto-increment, not UUID v4) | Accepted |
| ADR-005 | `ArchitectureDecisionRecords/ADR-005-Event-Bus.md` | RabbitMQ for event bus | Accepted |
| ADR-006 | `ArchitectureDecisionRecords/ADR-006-Search-Engine.md` | PostgreSQL FTS + pgvector (not ES) | Accepted |
| ADR-007 | `ArchitectureDecisionRecords/ADR-007-AI-Gateway.md` | FastAPI sidecar for AI workloads | Accepted |
| ADR-008 | `ArchitectureDecisionRecords/ADR-008-File-Storage.md` | MinIO (S3-compatible, not local) | Accepted |
| ADR-009 | `ArchitectureDecisionRecords/ADR-009-Cache-Layer.md` | Redis multi-tier caching | Accepted |
| ADR-010 | `ArchitectureDecisionRecords/ADR-010-Background-Tasks.md` | Celery + RabbitMQ | Accepted |
| ADR-011 | `ArchitectureDecisionRecords/ADR-011-API-Style.md` | DRF + Viewsets REST (not GraphQL) | Accepted |
| ADR-012 | `ArchitectureDecisionRecords/ADR-012-Authentication.md` | JWT RS256 access + refresh tokens | Accepted |
| ADR-013 | `ArchitectureDecisionRecords/ADR-013-Testing-Framework.md` | pytest + pytest-django | Accepted |
| ADR-014 | `ArchitectureDecisionRecords/ADR-014-Monitoring.md` | OpenTelemetry + Prometheus + Grafana + Sentry | Accepted |
| ADR-015 | `ArchitectureDecisionRecords/ADR-015-Container-Orchestration.md` | Docker + Kubernetes | Accepted |

### Module Blueprints (42)

| Document | Module | Bounded Context |
|----------|--------|-----------------|
| `ModuleBlueprints/Identity_and_MultiTenancy.md` | Identity & MultiTenancy | Authentication, RBAC, Organization |
| `ModuleBlueprints/Lead_Management.md` | Lead Management | Lead Acquisition & Qualification |
| `ModuleBlueprints/Pipeline_and_Opportunity.md` | Pipeline & Opportunity | Sales Pipeline & Deal Management |
| `ModuleBlueprints/Workflow_Engine.md` | Workflow Engine | Automation & Business Process |
| `ModuleBlueprints/AI_Platform.md` | AI Platform | AI/ML Services, LLM, Embeddings |
| `ModuleBlueprints/Integration_Hub.md` | Integration Hub | External Integrations, Webhooks |

### API Contracts (43)

| Document | Description |
|----------|-------------|
| `APIContracts/README.md` | API design philosophy, versioning, pagination, error handling, rate limiting |
| `APIContracts/Auth_API.md` | Complete auth endpoints: register, login, refresh, logout, verify, reset, me, sessions |
| `APIContracts/Lead_API.md` | Lead CRUD, status transitions, assignment, conversion, dedup, import, export |
| `APIContracts/Opportunity_API.md` | Opportunity CRUD, stage transitions, forecast, team selling, products |

### Database Schemas (44)

| Document | Schema | Tables |
|----------|--------|--------|
| `DatabaseSchemas/README.md` | Design philosophy, UUID v7, conventions, RLS templates, migrations |
| `DatabaseSchemas/Core_Schema.md` | `core` | Tenant, User, Role, Permission, Team, Session, AuditLog, Outbox |
| `DatabaseSchemas/CRM_Schema.md` | `crm` | Lead, Contact, Account, Pipeline, Stage, Opportunity, LineItem, Team, Product, Forecast, Task, Activity |
| `DatabaseSchemas/Analytics_Schema.md` | `analytics` | Report, Dashboard, Widget, EventLog, AuditLog, SearchIndex, UserActivity, MaterializedMetrics |

### UI/UX Design (45)

| Document | Description |
|----------|-------------|
| `UIUX/README.md` | Design philosophy, component hierarchy, layout patterns, responsive breakpoints, accessibility |
| `UIUX/Design_System.md` | Color palette, typography, spacing, elevation, icons, motion, MUI 5 theme configuration |
| `UIUX/Key_Screens.md` | Wireframe descriptions for 12 key screens (Login through AI Chat) |
| `UIUX/Frontend_Architecture.md` | React architecture, Zustand stores, TanStack Query, routing, permissions, forms, real-time |

## Reading Guide

### For Developers (Backend)
Start with: `00_ProjectMemory.md` → `15_ProjectStructure.md` → **ADRs (1-15)** → `DatabaseSchemas/README.md` → Relevant Module Blueprint → Relevant API Contract

### For Developers (Frontend)
Start with: `00_ProjectMemory.md` → **UIUX/README.md** → `UIUX/Design_System.md` → `UIUX/Frontend_Architecture.md` → `APIContracts/README.md` → Relevant API Contract

### For Architects
Start with: `10_ArchitectureOverview.md` → `11_SystemArchitecture.md` → `12_HighLevelDesign.md` → `13_LowLevelDesign.md` → **All ADRs** → `14_ModuleDependencyMap.md`

### For Product Managers
Start with: `01_ProjectVision.md` → `02_BusinessRequirements.md` → `03_FunctionalRequirements.md` → `05_ProductRoadmap.md` → **UIUX/Key_Screens.md**

### For DevOps
Start with: `09_DevOpsImplementationPlan.md` → `04_NonFunctionalRequirements.md` → **ADRs (5, 8, 9, 10, 14, 15)** → Database Schemas for RLS + partitioning

## Quick-Start

### Prerequisites
- Python 3.13+
- Node.js 20+
- Docker & Docker Compose
- PostgreSQL 16 (with pgvector, pg_trgm)
- Redis 7
- RabbitMQ 4

### Local Development Setup

```bash
# 1. Clone the repository
git clone https://github.com/tzahu/tzahu-crm.git
cd tzahu-crm

# 2. Start infrastructure services
docker compose up -d postgres redis rabbitmq minio

# 3. Backend setup
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # Configure environment
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver

# 4. Frontend setup (new terminal)
cd frontend
cp .env.example .env.local
npm install
npm run dev

# 5. AI Gateway (optional, for AI features)
cd services/ai_gateway
cp .env.example .env
pip install -r requirements.txt
uvicorn main:app --reload --port 8001

# 6. Open in browser
open http://localhost:3000
```

### Docker Compose (Full Stack)

```bash
# Start all services
docker compose --profile all up -d

# View logs
docker compose logs -f app worker ai-gateway

# Run migrations
docker compose exec app python manage.py migrate

# Create superuser
docker compose exec app python manage.py createsuperuser
```

### Important Directories

| Path | Description |
|------|-------------|
| `backend/` | Django monolith application |
| `frontend/` | React SPA application |
| `services/ai_gateway/` | FastAPI AI sidecar |
| `deploy/` | Docker, K8s, Helm configurations |
| `docs/` | All documentation (you are here) |
| `.github/` | CI/CD workflows |

## Document Conventions

- **Cross-references:** Documents reference each other as `See ADR-005` or `See ModuleBlueprints/Lead_Management.md`
- **Status:** Every document has a status: `Draft`, `Review`, `Approved`, `Superseded`
- **Staleness:** If you find outdated information, update it or flag with `[NEEDS UPDATE]`
- **Templates:** ADRs follow a standard template. Module blueprints follow a standard template.

---

*TZAHU CRM Documentation — Last updated: 2025-07-27*
*Maintainers: Chief Architect, Tech Lead, All Contributors*
