# TZAHU CRM — DevOps Implementation Plan

> **Version:** 0.1.0
> **Last Updated:** 2026-07-27
> **Status:** Foundational Design Phase
> **Owner:** Platform Architecture Team

---

## Table of Contents

1. [DevOps Architecture Overview](#1-devops-architecture-overview)
2. [Container Strategy](#2-container-strategy)
3. [Docker Compose (Local Development)](#3-docker-compose-local-development)
4. [Docker Images & Multi-Stage Builds](#4-docker-images--multi-stage-builds)
5. [CI/CD Pipeline](#5-cicd-pipeline)
6. [Environment Configuration](#6-environment-configuration)
7. [AWS Infrastructure](#7-aws-infrastructure)
8. [Kubernetes Manifests](#8-kubernetes-manifests)
9. [Monitoring & Observability](#9-monitoring--observability)
10. [Secrets Management](#10-secrets-management)
11. [Backup & Disaster Recovery](#11-backup--disaster-recovery)
12. [Scaling Strategy](#12-scaling-strategy)
13. [Phase-by-Phase DevOps Deliverables](#13-phase-by-phase-devops-deliverables)
14. [Runbooks](#14-runbooks)

---

## 1. DevOps Architecture Overview

### 1.1 Deployment Topology (Production)

```
Internet
    │
    ▼
┌──────────────┐
│  CloudFront   │  CDN for static assets + API caching
│  (CDN)        │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  Route53     │  DNS, weighted routing, health checks
│  (DNS)       │
└──────┬───────┘
       │
       ▼
┌──────────────┐     ┌──────────────────┐
│  ALB         │────►│  WAF             │  Web application firewall
│  (Load       │     │  (Rate limit,    │
│   Balancer)  │     │   SQLi, XSS)    │
└──────┬───────┘     └──────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────┐
│                 EKS Cluster (K8s)                     │
│                                                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │ Django   │  │ Django   │  │ Celery Workers    │   │
│  │ Pods     │  │ Pods     │  │ (workflow, notify,│   │
│  │ (Gunicorn│  │ (Gunicorn│  │  reports, sync)   │   │
│  │ + ASGI)  │  │ + ASGI)  │  └──────────────────┘   │
│  └──────────┘  └──────────┘                          │
│                                                       │
│  ┌──────────────────┐  ┌──────────────────┐         │
│  │ AI Gateway Pods  │  │ Nginx Ingress    │         │
│  │ (FastAPI)        │  │ Controller       │         │
│  └──────────────────┘  └──────────────────┘         │
│                                                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │ Pgbouncer│  │ Redis    │  │ RabbitMQ │           │
│  │ (Sidecar)│  │ (Sidecar)│  │ (Stateful│           │
│  └──────────┘  └──────────┘  │  Set)    │           │
│                              └──────────┘           │
└──────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────┐
│                    AWS RDS (PostgreSQL)               │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │ Primary  │──►│ Read     │──►│ Read Replica     │   │
│  │ (writer) │  │ Replica1 │  │ (reporting)      │   │
│  └──────────┘  └──────────┘  └──────────────────┘   │
│                                                       │
│  ┌──────────────────────────────────────────────────┐│
│  │  ElastiCache (Redis)  │  MQ (RabbitMQ)          ││
│  └──────────────────────────────────────────────────┘│
│                                                       │
│  ┌──────────────────────────────────────────────────┐│
│  │  S3 (File Storage, Backups, Logs)               ││
│  └──────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────┘
```

### 1.2 Network Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      VPC (10.0.0.0/16)                   │
│                                                           │
│  ┌──────────────────────┐  ┌──────────────────────────┐  │
│  │  Public Subnets       │  │  Private Subnets          │  │
│  │  (us-east-1a, 1b, 1c)│  │  (us-east-1a, 1b, 1c)     │  │
│  │                       │  │                           │  │
│  │  • ALB                │  │  • EKS Worker Nodes       │  │
│  │  • Bastion Host       │  │  • RDS                    │  │
│  │  • NAT Gateway        │  │  • ElastiCache            │  │
│  │                       │  │  • RabbitMQ               │  │
│  └──────────────────────┘  └──────────────────────────┘  │
│                                                           │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  Security Groups                                      │ │
│  │  • ALB: 443 from 0.0.0.0/0                           │ │
│  │  • EKS: 443 from ALB, 10250 from EKS control plane   │ │
│  │  • RDS: 5432 from EKS + Bastion                      │ │
│  │  • ElastiCache: 6379 from EKS                        │ │
│  │  • RabbitMQ: 5671, 15671 from EKS                    │ │
│  └──────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Container Strategy

### 2.1 Image Architecture

```
                        ┌─────────────────────┐
                        │  Base Images         │
                        │  python:3.13-slim    │
                        │  node:22-alpine      │
                        │  nginx:1.27-alpine   │
                        └─────────┬───────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                            │
                    ▼                            ▼
        ┌──────────────────────┐    ┌──────────────────────┐
        │  Django Base Image   │    │  Node Build Image    │
        │  (deps installed)    │    │  (npm ci + build)    │
        └──────────┬───────────┘    └──────────┬───────────┘
                   │                            │
        ┌──────────┴──────────┐                 │
        │                     │                 │
        ▼                     ▼                 │
┌──────────────┐   ┌──────────────────┐        │
│ Django API   │   │ Celery Worker    │        │
│ (Gunicorn +  │   │ (all queues)     │        │
│  Uvicorn)    │   └──────────────────┘        │
└──────────────┘                                │
                                                │
        ┌───────────────────────────────────────┘
        │
        ▼
┌──────────────────────┐    ┌──────────────────────┐
│  Nginx Image         │    │  Frontend Image      │
│  (static serving +   │    │  (React build output)│
│   reverse proxy)     │    └──────────────────────┘
└──────────────────────┘
```

### 2.2 Image Registry

- **Development:** Docker Hub or GitHub Container Registry (ghcr.io)
- **Production:** Amazon ECR (Elastic Container Registry)
- **Tagging strategy:** `{image}:{git-sha}-{env}` (e.g., `django:abc1234-prod`)
- **Latest tag:** `{image}:latest` updated on main branch builds only

---

## 3. Docker Compose (Local Development)

### 3.1 docker-compose.yml (Services)

```yaml
version: '3.9'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: tzahu_crm
      POSTGRES_USER: tzahu
      POSTGRES_PASSWORD: tzahu_dev_pass
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U tzahu"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes --maxmemory 512mb --maxmemory-policy allkeys-lru
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  rabbitmq:
    image: rabbitmq:4-management-alpine
    environment:
      RABBITMQ_DEFAULT_USER: tzahu
      RABBITMQ_DEFAULT_PASS: tzahu_dev_pass
      RABBITMQ_DEFAULT_VHOST: tzahu_dev
    ports:
      - "5672:5672"    # AMQP
      - "15672:15672"  # Management UI
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "check_port_connectivity"]
      interval: 10s
      timeout: 5s
      retries: 5

  minio:
    image: minio/minio:latest
    environment:
      MINIO_ROOT_USER: tzahu
      MINIO_ROOT_PASSWORD: tzahu_dev_pass
    ports:
      - "9000:9000"   # API
      - "9001:9001"   # Console
    volumes:
      - minio_data:/data
    command: server /data --console-address ":9001"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 10s
      timeout: 5s
      retries: 5

  pgbouncer:
    image: bitnami/pgbouncer:latest
    environment:
      POSTGRESQL_HOST: postgres
      POSTGRESQL_PORT: 5432
      POSTGRESQL_USER: tzahu
      POSTGRESQL_PASSWORD: tzahu_dev_pass
      PGBOUNCER_MAX_CLIENT_CONN: 100
      PGBOUNCER_DEFAULT_POOL_SIZE: 25
    ports:
      - "6432:6432"
    depends_on:
      postgres:
        condition: service_healthy

  django:
    build:
      context: ./backend
      dockerfile: Dockerfile.dev
    environment:
      DJANGO_SETTINGS_MODULE: config.settings.dev
      DATABASE_URL: postgres://tzahu:tzahu_dev_pass@pgbouncer:6432/tzahu_crm
      REDIS_URL: redis://redis:6379/0
      RABBITMQ_URL: amqp://tzahu:tzahu_dev_pass@rabbitmq:5672/tzahu_dev
      CELERY_BROKER_URL: amqp://tzahu:tzahu_dev_pass@rabbitmq:5672/tzahu_dev
      AWS_ACCESS_KEY_ID: tzahu
      AWS_SECRET_ACCESS_KEY: tzahu_dev_pass
      AWS_S3_ENDPOINT_URL: http://minio:9000
      DISABLE_RLS: "True"
      DEBUG: "True"
    ports:
      - "8000:8000"
    volumes:
      - ./backend:/app
      - ./backend/media:/app/media
    command: >
      sh -c "python manage.py migrate &&
             python manage.py runserver 0.0.0.0:8000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy
      minio:
        condition: service_healthy

  celery_worker:
    build:
      context: ./backend
      dockerfile: Dockerfile.dev
    environment:
      DJANGO_SETTINGS_MODULE: config.settings.dev
      DATABASE_URL: postgres://tzahu:tzahu_dev_pass@pgbouncer:6432/tzahu_crm
      REDIS_URL: redis://redis:6379/0
      RABBITMQ_URL: amqp://tzahu:tzahu_dev_pass@rabbitmq:5672/tzahu_dev
      CELERY_BROKER_URL: amqp://tzahu:tzahu_dev_pass@rabbitmq:5672/tzahu_dev
    volumes:
      - ./backend:/app
    command: celery -A config.celery worker -l info -Q default,workflow,notification,reports,integrations,imports
    depends_on:
      rabbitmq:
        condition: service_healthy
      redis:
        condition: service_healthy

  celery_beat:
    build:
      context: ./backend
      dockerfile: Dockerfile.dev
    environment:
      DJANGO_SETTINGS_MODULE: config.settings.dev
      DATABASE_URL: postgres://tzahu:tzahu_dev_pass@pgbouncer:6432/tzahu_crm
      REDIS_URL: redis://redis:6379/0
      RABBITMQ_URL: amqp://tzahu:tzahu_dev_pass@rabbitmq:5672/tzahu_dev
      CELERY_BROKER_URL: amqp://tzahu:tzahu_dev_pass@rabbitmq:5672/tzahu_dev
    volumes:
      - ./backend:/app
    command: celery -A config.celery beat -l info
    depends_on:
      rabbitmq:
        condition: service_healthy

  ai_gateway:
    build:
      context: ./ai_gateway
      dockerfile: Dockerfile.dev
    environment:
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      DATABASE_URL: postgres://tzahu:tzahu_dev_pass@pgbouncer:6432/tzahu_crm
    ports:
      - "8100:8000"
    volumes:
      - ./ai_gateway:/app
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
    depends_on:
      postgres:
        condition: service_healthy

  nginx:
    image: nginx:1.27-alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx/nginx.dev.conf:/etc/nginx/conf.d/default.conf
      - ./frontend/dist:/usr/share/nginx/html
    depends_on:
      - django

  flower:
    image: mher/flower
    environment:
      CELERY_BROKER_URL: amqp://tzahu:tzahu_dev_pass@rabbitmq:5672/tzahu_dev
      FLOWER_PORT: 5555
    ports:
      - "5555:5555"
    depends_on:
      rabbitmq:
        condition: service_healthy

  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      GF_SECURITY_ADMIN_PASSWORD: admin
    volumes:
      - ./monitoring/grafana/dashboards:/etc/grafana/provisioning/dashboards
      - ./monitoring/grafana/datasources:/etc/grafana/provisioning/datasources
      - grafana_data:/var/lib/grafana

volumes:
  postgres_data:
  redis_data:
  rabbitmq_data:
  minio_data:
  prometheus_data:
  grafana_data:
```

### 3.2 Makefile Commands

```makefile
.PHONY: dev test lint migrate seed clean build prod-up

# Local development
dev:
    docker compose up -d

dev-logs:
    docker compose logs -f

dev-down:
    docker compose down

dev-rebuild:
    docker compose build --no-cache django
    docker compose up -d

# Testing
test:
    docker compose run --rm django pytest

test-coverage:
    docker compose run --rm django pytest --cov --cov-report=html

# Linting
lint:
    docker compose run --rm django ruff check .
    docker compose run --rm django mypy --strict .
    docker compose run --rm django import-linter

lint-fix:
    docker compose run --rm django ruff check --fix .

# Database
migrate:
    docker compose run --rm django python manage.py migrate

makemigrations:
    docker compose run --rm django python manage.py makemigrations

seed:
    docker compose run --rm django python manage.py seed_data

# Admin
shell:
    docker compose run --rm django python manage.py shell

dbshell:
    docker compose exec postgres psql -U tzahu tzahu_crm

# Production
prod-up:
    docker compose -f docker-compose.prod.yml up -d

prod-down:
    docker compose -f docker-compose.prod.yml down

# Cleanup
clean:
    docker compose down -v
    rm -rf frontend/dist
```

### 3.3 nginx.dev.conf

```nginx
server {
    listen 80;
    server_name localhost;

    # Static files (frontend)
    root /usr/share/nginx/html;
    index index.html;

    # API proxy
    location /api/ {
        proxy_pass http://django:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Admin
    location /admin/ {
        proxy_pass http://django:8000;
    }

    # WebSocket
    location /ws/ {
        proxy_pass http://django:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # Media files
    location /media/ {
        proxy_pass http://minio:9000;
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

## 4. Docker Images & Multi-Stage Builds

### 4.1 Django Dockerfile (Production)

```dockerfile
# ============================================
# Stage 1: Build dependencies
# ============================================
FROM python:3.13-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    POETRY_VERSION=1.8.0

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    gcc libpq-dev && \
    rm -rf /var/lib/apt/lists/*

RUN pip install "poetry==$POETRY_VERSION"

WORKDIR /build
COPY pyproject.toml poetry.lock ./
RUN poetry config virtualenvs.create false && \
    poetry install --no-root --only main --no-interaction --no-ansi

# ============================================
# Stage 2: Runtime
# ============================================
FROM python:3.13-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_SETTINGS_MODULE=config.settings.prod \
    PORT=8000

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    libpq-dev curl && \
    rm -rf /var/lib/apt/lists/*

RUN groupadd -r django && useradd -r -g django django

WORKDIR /app

COPY --from=builder /usr/local/lib/python3.13/site-packages /usr/local/lib/python3.13/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

COPY . .

RUN mkdir -p /app/media /app/static && \
    chown -R django:django /app/media /app/static

USER django

RUN python manage.py collectstatic --noinput --clear

EXPOSE $PORT

HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:$PORT/health/ || exit 1

# Run with Gunicorn + Uvicorn workers
CMD gunicorn config.wsgi:application \
    --bind 0.0.0.0:$PORT \
    --workers 4 \
    --threads 2 \
    --worker-class uvicorn.workers.UvicornWorker \
    --timeout 120 \
    --keep-alive 5 \
    --max-requests 1000 \
    --max-requests-jitter 50 \
    --access-logfile - \
    --error-logfile -
```

### 4.2 Celery Worker Dockerfile

```dockerfile
# Reuses the Django build stages, different CMD
FROM python:3.13-slim AS runtime

# ... (same as Django runtime above)

# Run Celery worker
CMD celery -A config.celery worker \
    -l info \
    -Q default,workflow,notification,reports,integrations,imports \
    --concurrency=4 \
    --max-tasks-per-child=100 \
    --time-limit=300 \
    --soft-time-limit=240
```

### 4.3 AI Gateway Dockerfile (FastAPI)

```dockerfile
# ============================================
# Stage 1: Build
# ============================================
FROM python:3.13-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /build
COPY pyproject.toml ./
RUN pip install --no-cache-dir -e .

# ============================================
# Stage 2: Runtime
# ============================================
FROM python:3.13-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

RUN groupadd -r aigw && useradd -r -g aigw aigw

WORKDIR /app

COPY --from=builder /usr/local/lib/python3.13/site-packages /usr/local/lib/python3.13/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin
COPY . .

USER aigw

HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:$PORT/health/ || exit 1

CMD uvicorn app.main:app \
    --host 0.0.0.0 \
    --port $PORT \
    --workers 2 \
    --limit-concurrency 100 \
    --timeout-keep-alive 30
```

### 4.4 Frontend Dockerfile (React + Vite)

```dockerfile
# ============================================
# Stage 1: Build
# ============================================
FROM node:22-alpine AS builder

WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci --only=production && npm cache clean --force

COPY . .
RUN npm run build

# ============================================
# Stage 2: Nginx serving
# ============================================
FROM nginx:1.27-alpine AS runtime

COPY --from=builder /build/dist /usr/share/nginx/html
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -qO- http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
```

### 4.5 Nginx Production Config

```nginx
upstream django_backend {
    server django:8000;
    keepalive 32;
}

upstream ai_gateway {
    server ai_gateway:8000;
    keepalive 16;
}

server {
    listen 80;
    server_name api.tzahu.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.tzahu.com;

    ssl_certificate /etc/ssl/certs/tzahu.crt;
    ssl_certificate_key /etc/ssl/private/tzahu.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'";

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=100r/s;
    limit_req zone=api burst=200 nodelay;

    client_max_body_size 10M;
    proxy_read_timeout 60s;
    proxy_send_timeout 60s;

    # API
    location /api/ {
        limit_req zone=api burst=200 nodelay;
        proxy_pass http://django_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
    }

    # AI Gateway
    location /ai/ {
        limit_req zone=api burst=50 nodelay;
        proxy_pass http://ai_gateway;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_buffering off;
        proxy_cache off;
    }

    # WebSocket
    location /ws/ {
        proxy_pass http://django_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }

    # Admin
    location /admin/ {
        proxy_pass http://django_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Health
    location /health/ {
        proxy_pass http://django_backend;
        access_log off;
        return 200 "OK";
    }

    # Static files (served directly)
    location /static/ {
        alias /app/static/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Media files
    location /media/ {
        proxy_pass http://minio:9000;
        expires 7d;
    }
}
```

---

## 5. CI/CD Pipeline

### 5.1 GitHub Actions Workflow

```yaml
# .github/workflows/ci-cd.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop, 'release/*']
  pull_request:
    branches: [main, develop]

env:
  REGISTRY: ghcr.io
  IMAGE_TAG: ${{ github.sha }}

jobs:
  lint:
    name: Lint & Type Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.13'

      - name: Install Poetry
        run: pip install poetry

      - name: Install dependencies
        run: poetry install --no-root

      - name: Run ruff
        run: poetry run ruff check .

      - name: Run mypy
        run: poetry run mypy --strict backend/

      - name: Run import-linter
        run: poetry run lint-imports

      - name: Check OpenAPI schema
        run: poetry run python manage.py spectacular --file schema.yml --validate

  frontend-lint:
    name: Frontend Lint & Type Check
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Run ESLint
        run: npm run lint

      - name: Run TypeScript check
        run: npm run typecheck

  test:
    name: Test
    needs: [lint, frontend-lint]
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: tzahu_test
          POSTGRES_USER: tzahu
          POSTGRES_PASSWORD: tzahu_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      rabbitmq:
        image: rabbitmq:4-alpine
        env:
          RABBITMQ_DEFAULT_USER: tzahu
          RABBITMQ_DEFAULT_PASS: tzahu_test
        ports:
          - 5672:5672
        options: >-
          --health-cmd "rabbitmq-diagnostics check_port_connectivity"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.13'

      - name: Install Poetry
        run: pip install poetry

      - name: Cache dependencies
        uses: actions/cache@v3
        with:
          path: ~/.cache/pypoetry
          key: ${{ runner.os }}-poetry-${{ hashFiles('poetry.lock') }}

      - name: Install dependencies
        run: poetry install

      - name: Run migrations
        run: poetry run python manage.py migrate
        env:
          DATABASE_URL: postgres://tzahu:tzahu_test@localhost:5432/tzahu_test

      - name: Run tests
        run: poetry run pytest --cov --cov-report=xml --junitxml=test-results.xml
        env:
          DATABASE_URL: postgres://tzahu:tzahu_test@localhost:5432/tzahu_test
          REDIS_URL: redis://localhost:6379/0
          CELERY_BROKER_URL: amqp://tzahu:tzahu_test@localhost:5672/
          DJANGO_SETTINGS_MODULE: config.settings.test

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage.xml

  build:
    name: Build Docker Images
    needs: [test]
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && (github.ref == 'refs/heads/main' || github.ref == 'refs/heads/develop')
    steps:
      - uses: actions/checkout@v4

      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push Django
        uses: docker/build-push-action@v5
        with:
          context: ./backend
          push: true
          tags: |
            ${{ env.REGISTRY }}/${{ github.repository }}/django:${{ env.IMAGE_TAG }}
            ${{ env.REGISTRY }}/${{ github.repository }}/django:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Build and push Celery
        uses: docker/build-push-action@v5
        with:
          context: ./backend
          file: ./backend/Dockerfile.celery
          push: true
          tags: |
            ${{ env.REGISTRY }}/${{ github.repository }}/celery:${{ env.IMAGE_TAG }}
            ${{ env.REGISTRY }}/${{ github.repository }}/celery:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Build and push AI Gateway
        uses: docker/build-push-action@v5
        with:
          context: ./ai_gateway
          push: true
          tags: |
            ${{ env.REGISTRY }}/${{ github.repository }}/ai-gateway:${{ env.IMAGE_TAG }}
            ${{ env.REGISTRY }}/${{ github.repository }}/ai-gateway:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Build and push Frontend
        uses: docker/build-push-action@v5
        with:
          context: ./frontend
          push: true
          tags: |
            ${{ env.REGISTRY }}/${{ github.repository }}/frontend:${{ env.IMAGE_TAG }}
            ${{ env.REGISTRY }}/${{ github.repository }}/frontend:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy-staging:
    name: Deploy to Staging
    needs: [build]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/develop'
    environment: staging
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Update kubeconfig
        run: aws eks update-kubeconfig --name tzahu-staging --region us-east-1

      - name: Deploy with Helm
        run: |
          helm upgrade --install tzahu-crm ./infra/helm \
            --namespace tzahu-staging \
            --set image.tag=${{ env.IMAGE_TAG }} \
            --set environment=staging \
            --wait --timeout 5m

  deploy-production:
    name: Deploy to Production
    needs: [deploy-staging]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    environment:
      name: production
      url: https://app.tzahu.com
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Update kubeconfig
        run: aws eks update-kubeconfig --name tzahu-prod --region us-east-1

      - name: Smoke test staging
        run: |
          curl -f https://staging.api.tzahu.com/health/ || exit 1

      - name: Deploy with Helm
        run: |
          helm upgrade --install tzahu-crm ./infra/helm \
            --namespace tzahu-prod \
            --set image.tag=${{ env.IMAGE_TAG }} \
            --set environment=production \
            --set replicaCount=4 \
            --wait --timeout 10m

      - name: Post-deploy smoke tests
        run: |
          sleep 30
          curl -f https://api.tzahu.com/health/ || exit 1
          curl -f https://app.tzahu.com/ || exit 1

  security-scan:
    name: Security Scan
    needs: [build]
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4

      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ${{ env.REGISTRY }}/${{ github.repository }}/django:latest
          format: table
          exit-code: '1'
          severity: 'CRITICAL,HIGH'
```

### 5.2 Pipeline Stages

```
PR Created (feature/*, bugfix/*)
  ├── Lint (ruff, mypy, import-linter)
  ├── Frontend Lint (ESLint, tsc)
  ├── Test (pytest, coverage)
  └── [Required: all pass for merge]

Push to develop
  ├── (same as PR)
  ├── Build all Docker images
  ├── Push to registry
  └── Deploy to staging (auto)

Push to main
  ├── (same as PR + build)
  ├── Deploy to staging (auto)
  ├── Smoke tests on staging
  ├── Manual approval gate
  ├── Deploy to production (canary 10% -> 100%)
  └── Post-deploy smoke tests

Scheduled (daily)
  ├── Dependency security scan (Dependabot)
  ├── Container vulnerability scan (Trivy)
  └── Performance benchmark (k6)

Weekly
  ├── Dependency updates PR (Renovate)
  ├── SSL certificate expiry check
  └── Backup restore test (DR drill)
```

---

## 6. Environment Configuration

### 6.1 Environment Matrix

| Variable | local | dev | staging | production | dr |
|----------|-------|-----|---------|------------|-----|
| DJANGO_SETTINGS_MODULE | dev | staging | staging | prod | prod |
| DEBUG | True | True | False | False | False |
| DATABASE_URL | local pg | RDS dev | RDS staging | RDS prod + replicas | RDS dr |
| REDIS_URL | local redis | ElastiCache | ElastiCache | ElastiCache | ElastiCache dr |
| CELERY_BROKER_URL | local rabbitmq | MQ dev | MQ staging | MQ prod | MQ dr |
| AWS_S3_ENDPOINT | local minio | S3 dev | S3 staging | S3 prod | S3 dr |
| SECRET_KEY | dev key | env var | env var | Secrets Manager | Secrets Manager |
| SENTRY_DSN | - | sentry dev | sentry staging | sentry prod | sentry prod |
| OTEL_EXPORTER | console | console | OTLP gRPC | OTLP gRPC | OTLP gRPC |
| DISABLE_RLS | True | False | False | False | False |
| CELERY_TASK_ALWAYS_EAGER | True | False | False | False | False |
| EMAIL_BACKEND | console | SES | SES | SES | SES |
| DEFAULT_FILE_STORAGE | local | S3 | S3 | S3 | S3 |

### 6.2 Settings Structure

```
backend/config/
├── settings/
│   ├── base.py          # Shared settings (DB, cache, celery, auth)
│   ├── dev.py           # Local dev overrides (debug, console email)
│   ├── test.py          # Test overrides (fast password hasher, eager tasks)
│   ├── staging.py       # Staging overrides (Sentry, SES, S3)
│   └── prod.py          # Production overrides (strict security, replicas)
├── urls/
│   ├── __init__.py
│   ├── v1.py            # API v1 URL configuration
│   └── admin.py         # Admin URLs
├── asgi.py
├── wsgi.py
├── celery.py
└── __init__.py
```

### 6.3 Environment Variables (Production)

```bash
# Django
DJANGO_SETTINGS_MODULE=config.settings.prod
SECRET_KEY=arn:aws:secretsmanager:us-east-1:xxx:secret:prod/django/secret-key
DEBUG=False
ALLOWED_HOSTS=.tzahu.com

# Database
DATABASE_URL=postgres://tzahu:password@tzahu-prod.cluster-xxx.us-east-1.rds.amazonaws.com:5432/tzahu_crm
DATABASE_REPLICA_URL=postgres://tzahu:password@tzahu-prod-replica.xxx.us-east-1.rds.amazonaws.com:5432/tzahu_crm
PGSSLMODE=require

# Cache
REDIS_URL=rediss://tzahu-prod.xxx.ng.0001.use1.cache.amazonaws.com:6379/0
REDIS_SESSION_URL=rediss://tzahu-prod.xxx.ng.0001.use1.cache.amazonaws.com:6379/1
REDIS_RATE_LIMIT_URL=rediss://tzahu-prod.xxx.ng.0001.use1.cache.amazonaws.com:6379/2

# Message Broker
CELERY_BROKER_URL=amqps://tzahu:password@b-xxx.mq.us-east-1.amazonaws.com:5671/tzahu_prod

# AWS
AWS_ACCESS_KEY_ID=arn:aws:secretsmanager:...
AWS_SECRET_ACCESS_KEY=arn:aws:secretsmanager:...
AWS_S3_REGION_NAME=us-east-1
AWS_S3_BUCKET_NAME=tzahu-prod-media
AWS_S3_CUSTOM_DOMAIN=media.tzahu.com

# Email
EMAIL_BACKEND=django_ses.SESBackend
AWS_SES_REGION_NAME=us-east-1
DEFAULT_FROM_EMAIL=noreply@tzahu.com

# AI
OPENAI_API_KEY=arn:aws:secretsmanager:...
ANTHROPIC_API_KEY=arn:aws:secretsmanager:...
AI_GATEWAY_URL=http://ai-gateway:8000

# Monitoring
SENTRY_DSN=https://xxx@sentry.tzahu.com/1
OTEL_EXPORTER_OTLP_ENDPOINT=https://otel.tzahu.com:4318
OTEL_SERVICE_NAME=tzahu-crm-prod

# Feature Flags
ENABLE_AI_FEATURES=True
ENABLE_VOICE_AI=True
ENABLE_WORKFLOW_AUTO=True
```

---

## 7. AWS Infrastructure

### 7.1 Resource Inventory

| Service | Resource | Configuration | Phase |
|---------|----------|---------------|-------|
| **Compute** | EKS Cluster | 3 nodes (t3.large), auto-scaling 3-10 | Phase 0+ |
| **Compute** | Fargate (optional) | Serverless for AI Gateway burst | Phase 8+ |
| **Database** | RDS PostgreSQL 16 | db.r6g.large, Multi-AZ, 500GB gp3 | Phase 0+ |
| **Database** | RDS Read Replicas | db.r6g.large, 2 replicas | Phase 11 |
| **Cache** | ElastiCache Redis 7 | cache.r6g.large, Cluster mode, 3 shards | Phase 0+ |
| **Queue** | Amazon MQ RabbitMQ | mq.m5.large, Multi-AZ | Phase 1+ |
| **Storage** | S3 Bucket (Media) | Standard, versioning, lifecycle to Glacier after 90d | Phase 0+ |
| **Storage** | S3 Bucket (Backups) | Standard-IA, lifecycle to Glacier Deep Archive | Phase 0+ |
| **Storage** | S3 Bucket (Logs) | Standard-IA, expiration after 365d | Phase 0+ |
| **CDN** | CloudFront | S3 + API distribution, WAF, custom SSL | Phase 3+ |
| **DNS** | Route53 | tzahu.com, app.tzahu.com, api.tzahu.com | Phase 0 |
| **Certificates** | ACM | *.tzahu.com wildcard cert | Phase 0 |
| **Monitoring** | CloudWatch | Log groups, metrics, alarms | Phase 0 |
| **Secrets** | Secrets Manager | DB creds, API keys, JWT secrets | Phase 0 |
| **WAF** | WAFv2 | Rate limiting, SQLi/XSS rules, IP allow/deny | Phase 5+ |
| **Backup** | AWS Backup | RDS automated snapshots, S3 backup plan | Phase 0+ |
| **Networking** | VPC | 3 AZs, public+private subnets, NAT gateway | Phase 0 |

### 7.2 Terraform Structure

```
infra/terraform/
├── environments/
│   ├── _global/              # Global resources (Route53, ACM)
│   ├── dev/                  # Dev environment
│   ├── staging/              # Staging environment
│   └── prod/                 # Production environment
├── modules/
│   ├── vpc/                  # VPC, subnets, NAT, security groups
│   ├── eks/                  # EKS cluster, node groups, IRSA
│   ├── rds/                  # RDS instance, replicas, parameter groups
│   ├── elasticache/          # Redis cluster
│   ├── rabbitmq/             # Amazon MQ
│   ├── s3/                   # S3 buckets with policies
│   ├── cloudfront/           # CDN distribution
│   ├── waf/                  # WAFv2 web ACL
│   ├── monitoring/           # CloudWatch, SNS, alarms
│   └── secrets/              # Secrets Manager
├── backend.tf               # S3 backend for Terraform state
├── providers.tf              # AWS provider config
└── variables.tf              # Global variables
```

### 7.3 Terraform RDS Module

```hcl
# modules/rds/main.tf
resource "aws_rds_cluster" "postgresql" {
  cluster_identifier      = "tzahu-${var.environment}-aurora"
  engine                  = "aurora-postgresql"
  engine_version          = "16.3"
  database_name           = "tzahu_crm"
  master_username         = var.db_username
  master_password         = var.db_password
  backup_retention_period = var.backup_retention_days
  preferred_backup_window = "03:00-04:00"
  preferred_maintenance_window = "sun:05:00-sun:06:00"
  port                    = 5432
  db_subnet_group_name    = var.db_subnet_group
  vpc_security_group_ids  = [var.security_group_id]
  storage_encrypted       = true
  kms_key_id              = var.kms_key_id
  deletion_protection     = var.environment == "prod" ? true : false
  skip_final_snapshot     = var.environment == "prod" ? false : true
  final_snapshot_identifier = "tzahu-${var.environment}-final-${formatdate("YYYY-MM-DD-hhmm", timestamp())}"

  serverlessv2_scaling_configuration {
    min_capacity = var.min_capacity  # 0.5 ACU
    max_capacity = var.max_capacity  # 64 ACU (prod: 128)
  }
}

resource "aws_rds_cluster_instance" "writer" {
  identifier         = "tzahu-${var.environment}-writer"
  cluster_identifier = aws_rds_cluster.postgresql.id
  instance_class     = var.instance_class
  engine             = aws_rds_cluster.postgresql.engine
  engine_version     = aws_rds_cluster.postgresql.engine_version
  publicly_accessible = false
}

resource "aws_rds_cluster_instance" "reader" {
  count              = var.reader_count
  identifier         = "tzahu-${var.environment}-reader-${count.index + 1}"
  cluster_identifier = aws_rds_cluster.postgresql.id
  instance_class     = var.instance_class
  engine             = aws_rds_cluster.postgresql.engine
  engine_version     = aws_rds_cluster.postgresql.engine_version
  publicly_accessible = false
  promotion_tier     = count.index + 1
}
```

### 7.4 EKS Cluster Module

```hcl
# modules/eks/main.tf
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.0"

  cluster_name    = "tzahu-${var.environment}"
  cluster_version = "1.30"

  vpc_id     = var.vpc_id
  subnet_ids = var.private_subnet_ids

  cluster_endpoint_public_access           = false
  cluster_endpoint_private_access          = true
  enable_cluster_creator_admin_permissions = true

  cluster_addons = {
    coredns    = { most_recent = true }
    kube-proxy = { most_recent = true }
    vpc-cni    = { most_recent = true }
    aws-ebs-csi-driver = { most_recent = true }
  }

  eks_managed_node_groups = {
    general = {
      desired_size = var.node_desired
      min_size     = var.node_min
      max_size     = var.node_max

      instance_types = var.instance_types
      capacity_type  = "ON_DEMAND"

      block_device_mappings = {
        xvda = {
          device_name = "/dev/xvda"
          ebs = {
            volume_size           = 100
            volume_type           = "gp3"
            iops                  = 3000
            throughput            = 125
            encrypted             = true
            delete_on_termination = true
          }
        }
      }
    }
  }

  node_security_group_additional_rules = {
    ingress_self_all = {
      description = "Allow all traffic within node group"
      protocol    = "-1"
      from_port   = 0
      to_port     = 0
      type        = "ingress"
      self        = true
    }
  }
}
```

---

## 8. Kubernetes Manifests

### 8.1 Django Deployment

```yaml
# infra/kubernetes/django/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: tzahu-django
  namespace: tzahu-{{ .Values.environment }}
  labels:
    app: tzahu-django
spec:
  replicas: {{ .Values.django.replicaCount }}
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1
      maxSurge: 1
  selector:
    matchLabels:
      app: tzahu-django
  template:
    metadata:
      labels:
        app: tzahu-django
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "8000"
        prometheus.io/path: "/metrics"
    spec:
      serviceAccountName: tzahu-django
      terminationGracePeriodSeconds: 60
      containers:
        - name: django
          image: {{ .Values.image.registry }}/django:{{ .Values.image.tag }}
          imagePullPolicy: IfNotPresent
          ports:
            - containerPort: 8000
              protocol: TCP
          env:
            - name: DJANGO_SETTINGS_MODULE
              value: config.settings.prod
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: tzahu-db-credentials
                  key: database_url
            - name: REDIS_URL
              valueFrom:
                secretKeyRef:
                  name: tzahu-redis-credentials
                  key: redis_url
            - name: CELERY_BROKER_URL
              valueFrom:
                secretKeyRef:
                  name: tzahu-rabbitmq-credentials
                  key: broker_url
            - name: SECRET_KEY
              valueFrom:
                secretKeyRef:
                  name: tzahu-django-secret
                  key: secret_key
            - name: SENTRY_DSN
              valueFrom:
                secretKeyRef:
                  name: tzahu-sentry
                  key: dsn
                  optional: true
          resources:
            requests:
              cpu: 500m
              memory: 512Mi
            limits:
              cpu: 2000m
              memory: 1Gi
          livenessProbe:
            httpGet:
              path: /health/
              port: 8000
            initialDelaySeconds: 30
            periodSeconds: 15
            timeoutSeconds: 5
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /health/
              port: 8000
            initialDelaySeconds: 15
            periodSeconds: 10
            timeoutSeconds: 3
            failureThreshold: 2
          lifecycle:
            preStop:
              exec:
                command: ["sh", "-c", "sleep 10 && kill -SIGTERM 1"]
---
apiVersion: v1
kind: Service
metadata:
  name: tzahu-django
  namespace: tzahu-{{ .Values.environment }}
spec:
  type: ClusterIP
  ports:
    - port: 8000
      targetPort: 8000
      protocol: TCP
      name: http
  selector:
    app: tzahu-django
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: tzahu-django-hpa
  namespace: tzahu-{{ .Values.environment }}
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: tzahu-django
  minReplicas: {{ .Values.django.minReplicas }}
  maxReplicas: {{ .Values.django.maxReplicas }}
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
        - type: Percent
          value: 100
          periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 25
          periodSeconds: 60
```

### 8.2 Celery Worker Deployment

```yaml
# infra/kubernetes/celery/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: tzahu-celery-worker
  namespace: tzahu-{{ .Values.environment }}
spec:
  replicas: {{ .Values.celery.replicaCount }}
  selector:
    matchLabels:
      app: tzahu-celery-worker
  template:
    metadata:
      labels:
        app: tzahu-celery-worker
    spec:
      serviceAccountName: tzahu-django
      terminationGracePeriodSeconds: 120
      containers:
        - name: celery
          image: {{ .Values.image.registry }}/celery:{{ .Values.image.tag }}
          command:
            - celery
            - -A
            - config.celery
            - worker
            - -l
            - info
            - -Q
            - default,workflow,notification,reports,integrations,imports
            - --concurrency=4
            - --max-tasks-per-child=100
          env:
            - name: DJANGO_SETTINGS_MODULE
              value: config.settings.prod
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: tzahu-db-credentials
                  key: database_url
            - name: CELERY_BROKER_URL
              valueFrom:
                secretKeyRef:
                  name: tzahu-rabbitmq-credentials
                  key: broker_url
            - name: REDIS_URL
              valueFrom:
                secretKeyRef:
                  name: tzahu-redis-credentials
                  key: redis_url
          resources:
            requests:
              cpu: 500m
              memory: 512Mi
            limits:
              cpu: 2000m
              memory: 2Gi
          livenessProbe:
            exec:
              command:
                - celery
                - -A
                - config.celery
                - inspect
                - ping
                - -d
                - celery@$HOSTNAME
            initialDelaySeconds: 30
            periodSeconds: 30
            timeoutSeconds: 10
            failureThreshold: 3
```

### 8.3 AI Gateway Deployment

```yaml
# infra/kubernetes/ai-gateway/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: tzahu-ai-gateway
  namespace: tzahu-{{ .Values.environment }}
spec:
  replicas: {{ .Values.aiGateway.replicaCount }}
  selector:
    matchLabels:
      app: tzahu-ai-gateway
  template:
    metadata:
      labels:
        app: tzahu-ai-gateway
    spec:
      serviceAccountName: tzahu-ai-gateway
      containers:
        - name: ai-gateway
          image: {{ .Values.image.registry }}/ai-gateway:{{ .Values.image.tag }}
          ports:
            - containerPort: 8000
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: tzahu-db-credentials
                  key: database_url
            - name: OPENAI_API_KEY
              valueFrom:
                secretKeyRef:
                  name: tzahu-openai
                  key: api_key
            - name: ANTHROPIC_API_KEY
              valueFrom:
                secretKeyRef:
                  name: tzahu-anthropic
                  key: api_key
          resources:
            requests:
              cpu: 500m
              memory: 512Mi
            limits:
              cpu: 4000m
              memory: 4Gi
---
apiVersion: v1
kind: Service
metadata:
  name: tzahu-ai-gateway
  namespace: tzahu-{{ .Values.environment }}
spec:
  type: ClusterIP
  ports:
    - port: 8000
      targetPort: 8000
  selector:
    app: tzahu-ai-gateway
```

### 8.4 Nginx Ingress

```yaml
# infra/kubernetes/ingress/nginx.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: tzahu-ingress
  namespace: tzahu-{{ .Values.environment }}
  annotations:
    kubernetes.io/ingress.class: nginx
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/proxy-body-size: "10m"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "60"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "60"
    nginx.ingress.kubernetes.io/limit-rps: "100"
    nginx.ingress.kubernetes.io/limit-burst: "200"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/enable-cors: "true"
    nginx.ingress.kubernetes.io/cors-allow-methods: "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    nginx.ingress.kubernetes.io/cors-allow-credentials: "true"
spec:
  tls:
    - hosts:
        - api.tzahu.com
        - app.tzahu.com
      secretName: tzahu-tls
  rules:
    - host: api.tzahu.com
      http:
        paths:
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: tzahu-django
                port:
                  number: 8000
          - path: /ai
            pathType: Prefix
            backend:
              service:
                name: tzahu-ai-gateway
                port:
                  number: 8000
          - path: /ws
            pathType: Prefix
            backend:
              service:
                name: tzahu-django
                port:
                  number: 8000
    - host: app.tzahu.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: tzahu-frontend
                port:
                  number: 80
```

### 8.5 ConfigMap & Secrets

```yaml
# infra/kubernetes/config/django-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: tzahu-django-config
  namespace: tzahu-{{ .Values.environment }}
data:
  DJANGO_SETTINGS_MODULE: "config.settings.prod"
  ALLOWED_HOSTS: "api.tzahu.com,app.tzahu.com"
  AWS_S3_REGION_NAME: "us-east-1"
  AWS_S3_BUCKET_NAME: "tzahu-prod-media"
  EMAIL_BACKEND: "django_ses.SESBackend"
  AWS_SES_REGION_NAME: "us-east-1"
  DEFAULT_FROM_EMAIL: "noreply@tzahu.com"
  OTEL_SERVICE_NAME: "tzahu-crm-prod"
  CORS_ALLOWED_ORIGINS: "https://app.tzahu.com"
```

### 8.6 Network Policies

```yaml
# infra/kubernetes/network-policies/django-policy.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: django-network-policy
  namespace: tzahu-{{ .Values.environment }}
spec:
  podSelector:
    matchLabels:
      app: tzahu-django
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: tzahu-nginx-ingress
      ports:
        - protocol: TCP
          port: 8000
  egress:
    - to:
        - podSelector:
            matchLabels:
              app: tzahu-celery-worker
      ports:
        - protocol: TCP
          port: 8000
    - to:
        - ipBlock:
            cidr: 0.0.0.0/0
            except:
              - 10.0.0.0/8
              - 172.16.0.0/12
              - 192.168.0.0/16
      ports:
        - protocol: TCP
          port: 443
    - to:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: kube-system
      ports:
        - protocol: UDP
          port: 53
```

### 8.7 Pod Disruption Budget

```yaml
# infra/kubernetes/pdb/django-pdb.yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: tzahu-django-pdb
  namespace: tzahu-{{ .Values.environment }}
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: tzahu-django
```

---

## 9. Monitoring & Observability

### 9.1 Prometheus Configuration

```yaml
# monitoring/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'django'
    kubernetes_sd_configs:
      - role: pod
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        action: keep
        regex: true
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
        action: replace
        target_label: __metrics_path__
        regex: (.+)
      - source_labels: [__address__, __meta_kubernetes_pod_annotation_prometheus_io_port]
        action: replace
        regex: ([^:]+)(?::\d+)?;(\d+)
        replacement: $1:$2
        target_label: __address__
      - source_labels: [__meta_kubernetes_pod_label_app]
        target_label: app

  - job_name: 'celery'
    static_configs:
      - targets: ['flower:5555']

  - job_name: 'node'
    kubernetes_sd_configs:
      - role: node
    relabel_configs:
      - source_labels: [__address__]
        regex: '(.*):10250'
        replacement: '${1}:9100'
        target_label: __address__

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']

  - job_name: 'rabbitmq'
    static_configs:
      - targets: ['rabbitmq-exporter:9419']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']
```

### 9.2 Grafana Dashboards

**Pre-built dashboards:**

| Dashboard | Description | Metrics |
|-----------|-------------|---------|
| **Django API** | Request rate, error rate, latency (p50/p95/p99), DB query count | http_requests_total, http_request_duration_ms, http_errors_total, db_queries_total |
| **Celery Workers** | Task rate, task duration, queue depth, worker count | celery_tasks_total, celery_task_duration_ms, rabbitmq_queue_messages |
| **Database** | Connection count, query performance, cache hit ratio, replication lag | pg_stat_activity_count, pg_stat_database_tup_fetched, pg_stat_bgwriter_buffers_hit |
| **Redis** | Memory usage, hit rate, command rate, connected clients | redis_memory_usage_bytes, redis_hit_ratio, redis_commands_total |
| **RabbitMQ** | Queue depth, consumer count, publish rate, delivery rate | rabbitmq_queue_messages_ready, rabbitmq_consumers |
| **Infrastructure** | CPU, memory, disk, network by pod/node | node_cpu_seconds_total, container_memory_usage_bytes |
| **AI Platform** | Token usage, LLM latency, cost per feature, cost per org | ai_tokens_total, ai_request_duration_ms, ai_cost_total |
| **Business SLOs** | API SLO, Workflow SLO, Email SLO, Report SLO | Custom SLO metrics |

### 9.3 Sentry Error Tracking

```python
# backend/config/settings/base.py
import sentry_sdk
from sentry_sdk.integrations.django import DjangoIntegration
from sentry_sdk.integrations.celery import CeleryIntegration
from sentry_sdk.integrations.redis import RedisIntegration

if SENTRY_DSN := env("SENTRY_DSN", default=None):
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        environment=env("SENTRY_ENVIRONMENT", default="development"),
        integrations=[
            DjangoIntegration(),
            CeleryIntegration(),
            RedisIntegration(),
        ],
        traces_sample_rate=env.float("SENTRY_TRACES_SAMPLE_RATE", default=0.1),
        profiles_sample_rate=env.float("SENTRY_PROFILES_SAMPLE_RATE", default=0.1),
        send_default_pii=False,
        attach_stacktrace=True,
        release=f"tzahu-crm@{VERSION}",
    )
```

### 9.4 Alerting Rules

```yaml
# monitoring/alerts/django-alerts.yml
groups:
  - name: django-api
    rules:
      - alert: HighErrorRate
        expr: rate(http_errors_total[5m]) / rate(http_requests_total[5m]) > 0.01
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "API error rate > 1% for 5 minutes"
          description: "Current error rate: {{ $value | humanizePercentage }}"

      - alert: HighLatency
        expr: histogram_quantile(0.95, rate(http_request_duration_ms_bucket[5m])) > 500
        for: 5m
        labels:
          severity: high
        annotations:
          summary: "API p95 latency > 500ms"
          description: "Current p95: {{ $value }}ms"

  - name: celery
    rules:
      - alert: CeleryQueueBacklog
        expr: rabbitmq_queue_messages_ready > 10000
        for: 5m
        labels:
          severity: high
        annotations:
          summary: "Celery queue backlog > 10k messages"

      - alert: CeleryTaskFailure
        expr: rate(celery_tasks_total{status="failed"}[10m]) > 10
        for: 5m
        labels:
          severity: high
        annotations:
          summary: "High Celery task failure rate"

  - name: database
    rules:
      - alert: DBConnectionHigh
        expr: pg_stat_activity_count > 80
        for: 5m
        labels:
          severity: high
        annotations:
          summary: "Database connection count > 80"

      - alert: ReplicationLag
        expr: pg_replication_lag_seconds > 60
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Replication lag > 60 seconds"

  - name: infrastructure
    rules:
      - alert: PodCrashLoopBackOff
        expr: kube_pod_status_phase{phase="CrashLoopBackOff"} > 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Pod in CrashLoopBackOff state"

      - alert: DiskSpaceLow
        expr: node_filesystem_avail_bytes / node_filesystem_size_bytes < 0.1
        for: 5m
        labels:
          severity: high
        annotations:
          summary: "Disk space < 10% available"
```

---

## 10. Secrets Management

### 10.1 Strategy

- **Production:** AWS Secrets Manager with automatic rotation
- **Staging/Dev:** AWS Secrets Manager (separate from prod)
- **Local:** `.env` file (gitignored) with dev-only secrets
- **CI/CD:** GitHub Actions secrets + OpenID Connect to AWS

### 10.2 Secret Inventory

| Secret Name | Rotation | Accessed By |
|-------------|----------|-------------|
| `tzahu/django/secret-key` | Monthly | Django |
| `tzahu/db/credentials` | Quarterly | Django, Celery, AI Gateway |
| `tzahu/redis/credentials` | Quarterly | Django, Celery |
| `tzahu/rabbitmq/credentials` | Quarterly | Django, Celery |
| `tzahu/openai/api-key` | Manual | AI Gateway |
| `tzahu/anthropic/api-key` | Manual | AI Gateway |
| `tzahu/sentry/dsn` | Manual | Django, Celery |
| `tzahu/jwt/private-key` | Yearly | Django |
| `tzahu/jwt/public-key` | Yearly | Django, AI Gateway |
| `tzahu/integrations/*` | Manual | Django |

### 10.3 Kubernetes External Secrets

```yaml
# infra/kubernetes/external-secrets/db-credentials.yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: tzahu-db-credentials
  namespace: tzahu-{{ .Values.environment }}
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secretsmanager
    kind: ClusterSecretStore
  target:
    name: tzahu-db-credentials
    creationPolicy: Owner
  data:
    - secretKey: database_url
      remoteRef:
        key: tzahu/{{ .Values.environment }}/db/credentials
        property: database_url
    - secretKey: database_replica_url
      remoteRef:
        key: tzahu/{{ .Values.environment }}/db/credentials
        property: database_replica_url
```

### 10.4 Local .env Template

```bash
# .env.template (copy to .env, never commit)
DJANGO_SETTINGS_MODULE=config.settings.dev
SECRET_KEY=dev-secret-key-not-for-production
DEBUG=True

DATABASE_URL=postgres://tzahu:tzahu_dev_pass@localhost:5432/tzahu_crm
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=amqp://tzahu:tzahu_dev_pass@localhost:5672/tzahu_dev

AWS_ACCESS_KEY_ID=minioadmin
AWS_SECRET_ACCESS_KEY=minioadmin
AWS_S3_ENDPOINT_URL=http://localhost:9000
AWS_S3_BUCKET_NAME=tzahu-media

OPENAI_API_KEY=sk-your-openai-key
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key

SENTRY_DSN=
DISABLE_RLS=True
```

---

## 11. Backup & Disaster Recovery

### 11.1 Backup Strategy

| Component | Method | Frequency | Retention | RPO | RTO |
|-----------|--------|-----------|-----------|-----|-----|
| PostgreSQL | Automated snapshots (RDS) | Daily | 30 days | 24h | 4h |
| PostgreSQL | WAL streaming to S3 | Continuous | 7 days (WAL), 30d (PITR) | 5 min | 30 min |
| Redis | RDB snapshots to S3 | Hourly | 7 days | 1h | 1h |
| RabbitMQ | Queue definitions export | On config change | Git history | N/A | 1h |
| S3 Media | Cross-region replication | Continuous | Same as source | Minutes | Minutes |
| EBS Volumes | Snapshots | Weekly | 90 days | 1 week | 4h |
| K8s Manifests | Git (IaC) | On change | Git history | N/A | 1h |
| Terraform State | S3 backend + DynamoDB lock | On change | Git history | N/A | 1h |

### 11.2 PostgreSQL WAL Archiving

```sql
-- RDS automated: archive_command sends to S3
-- Manual backup script
#!/bin/bash
# scripts/backup-db.sh
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
BACKUP_FILE="tzahu-db-${TIMESTAMP}.sql.gz"

pg_dump \
    --host=${DATABASE_HOST} \
    --port=${DATABASE_PORT} \
    --username=${DATABASE_USER} \
    --dbname=${DATABASE_NAME} \
    --format=custom \
    --compress=9 \
    --verbose \
    --file=/tmp/${BACKUP_FILE}

aws s3 cp /tmp/${BACKUP_FILE} s3://tzahu-backups/postgresql/${BACKUP_FILE}
rm /tmp/${BACKUP_FILE}
```

### 11.3 Disaster Recovery Runbook

```
DR SCENARIO: Complete AWS region failure

TRIGGER: Region us-east-1 unavailable for > 15 minutes
RPO: 5 minutes (WAL streaming)
RTO: 30 minutes

STEP 1: Failover DNS (Route53)
- Update health check to fail over to us-west-2
- Update Route53 records to point to us-west-2 ALB
- Estimated: 2 minutes

STEP 2: Promote Read Replica to Primary (us-west-2)
- aws rds promote-read-replica --db-instance-identifier tzahu-prod-dr
- Update DATABASE_URL in secrets to DR instance
- Estimated: 5 minutes

STEP 3: Scale EKS in DR Region
- Update kubeconfig to dr cluster
- kubectl scale deployment tzahu-django --replicas=3
- kubectl scale deployment tzahu-celery-worker --replicas=2
- Estimated: 5 minutes

STEP 4: Restore Redis from S3 Snapshot
- Download latest RDB from s3://tzahu-backups/redis/
- Start ElastiCache cluster with restored data
- Estimated: 10 minutes

STEP 5: Restore RabbitMQ
- Import queue definitions from S3
- Start Amazon MQ broker
- Estimated: 5 minutes

STEP 6: Verify Health
- curl -f https://dr.api.tzahu.com/health/
- Run smoke test suite
- Estimated: 3 minutes

TOTAL RTO: ~30 minutes
```

### 11.4 Automated Backup Verification

```yaml
# .github/workflows/backup-verify.yml
name: Weekly Backup Verification

on:
  schedule:
    - cron: '0 6 * * 1'  # Monday 6 AM UTC

jobs:
  verify-backup:
    runs-on: ubuntu-latest
    steps:
      - name: Restore latest backup to test DB
        run: |
          LATEST_BACKUP=$(aws s3 ls s3://tzahu-backups/postgresql/ | sort | tail -1 | awk '{print $4}')
          aws s3 cp s3://tzahu-backups/postgresql/$LATEST_BACKUP /tmp/latest_backup.sql.gz
          pg_restore --dbname=postgresql://test:test@localhost:5432/verify_test \
            /tmp/latest_backup.sql.gz

      - name: Run data integrity checks
        run: |
          psql postgresql://test:test@localhost:5432/verify_test -c "
            SELECT 'users' as table_name, count(*) as row_count FROM identity_users
            UNION ALL
            SELECT 'organizations', count(*) FROM organization_organizations
            UNION ALL
            SELECT 'leads', count(*) FROM lead_management_leads
          "

      - name: Notify on failure
        if: failure()
        uses: slackapi/slack-github-action@v1
        with:
          payload: '{"text": "❌ Weekly backup verification FAILED"}'
```

---

## 12. Scaling Strategy

### 12.1 Horizontal Pod Autoscaling

| Component | Min | Max | CPU Target | Memory Target | Custom Metric |
|-----------|-----|-----|------------|---------------|---------------|
| Django API | 2 | 10 | 70% | 80% | HTTP request rate > 1000/s |
| Celery Worker | 1 | 8 | 70% | 80% | RabbitMQ queue depth > 1000 |
| AI Gateway | 1 | 5 | 60% | 70% | OpenAI rate limit headroom |
| Frontend | 2 | 5 | 70% | 80% | — |

### 12.2 Connection Pooling

```
Pgbouncer Configuration:
- Mode: transaction
- Default pool size: 25
- Max client connections: 200
- Max DB connections: 50
- Pool timeout: 5s
- Idle transaction timeout: 60s
- Server idle timeout: 600s

RDS Configuration:
- Max connections: 500 (Aurora Serverless v2 auto-scales)
- Connection burst: up to 1000 during peak
```

### 12.3 Database Read/Write Splitting

```python
# backend/config/settings/base.py
DATABASES = {
    'default': {
        'ENGINE': 'django_db_geventpool.backends.postgresql_psycopg2',
        'NAME': env('DB_NAME'),
        'USER': env('DB_USER'),
        'PASSWORD': env('DB_PASSWORD'),
        'HOST': env('DB_HOST'),
        'PORT': env('DB_PORT', default='5432'),
        'CONN_MAX_AGE': 60,
        'CONN_HEALTH_CHECKS': True,
    },
    'replica': {
        'ENGINE': 'django_db_geventpool.backends.postgresql_psycopg2',
        'NAME': env('DB_NAME'),
        'USER': env('DB_USER'),
        'PASSWORD': env('DB_PASSWORD'),
        'HOST': env('DB_REPLICA_HOST'),
        'PORT': env('DB_PORT', default='5432'),
        'CONN_MAX_AGE': 60,
        'CONN_HEALTH_CHECKS': True,
        'TEST': {
            'MIRROR': 'default',
        },
    },
}

DATABASE_ROUTERS = ['config.database_router.PrimaryReplicaRouter']
```

```python
# backend/config/database_router.py
class PrimaryReplicaRouter:
    def db_for_read(self, model, **hints):
        """Read from replica unless the model is being written in this request."""
        if hints.get('use_replica', True):
            return 'replica'
        return 'default'

    def db_for_write(self, model, **hints):
        return 'default'

    def allow_relation(self, obj1, obj2, **hints):
        return True

    def allow_migrate(self, db, app_label, model_name=None, **hints):
        return db == 'default'
```

### 12.4 CDN Strategy

| Content | CDN | Cache TTL | Cache Strategy |
|---------|-----|-----------|----------------|
| Static build (JS, CSS, fonts) | CloudFront | 30 days | Immutable, content-hash filenames |
| Images (avatars, logos) | CloudFront | 7 days | Cache with revalidation |
| API responses (GET) | CloudFront + ALB | 1-5 min | Cache based on URL + headers |
| User-uploaded files | CloudFront + S3 | 7 days | Cache with ETag validation |
| AI generated content | No CDN | N/A | Not cacheable (dynamic) |

---

## 13. Phase-by-Phase DevOps Deliverables

### Phase 0 — Foundation

| # | Deliverable | Description |
|---|-------------|-------------|
| D0.1 | Docker Compose | All services (Django, PG, Redis, RabbitMQ, Celery, MinIO, Pgbouncer) |
| D0.2 | Makefile | dev, test, lint, migrate, seed, clean commands |
| D0.3 | CI Pipeline | Lint -> Typecheck -> Test (PR check) |
| D0.4 | CD Pipeline | Build images -> Push to registry -> Deploy to staging |
| D0.5 | Staging Environment | Single-host Docker or minimal K8s cluster |
| D0.6 | Monitoring Stub | OpenTelemetry, console exporter, health endpoint |
| D0.7 | .env Template | Environment variable documentation |
| D0.8 | Django Settings | base, dev, test, staging, prod split |

### Phase 1 — Core Framework

| # | Deliverable | Description |
|---|-------------|-------------|
| D1.1 | Docker Compose for Celery | Separate worker service for background tasks |
| D1.2 | Prometheus + Grafana | Basic dashboard setup (request rate, error rate, latency) |
| D1.3 | Sentry DSN config | Error tracking integration |
| D1.4 | RabbitMQ config | Queue setup: default, workflow, notification, reports, integrations |
| D1.5 | Redis config | DB indices: 0=cache, 1=rate-limit, 2=sessions, 3=channels |

### Phase 2 — Multi-Tenancy

| # | Deliverable | Description |
|---|-------------|-------------|
| D2.1 | RLS Migration Automation | CI step to verify RLS on all tenant-scoped tables |
| D2.2 | Tenant-specific metrics | Prometheus labels with org_id (aggregated, not per-org) |

### Phase 3 — Lead/Contact/Account

| # | Deliverable | Description |
|---|-------------|-------------|
| D3.1 | CloudFront Distribution | CDN for static assets |
| D3.2 | S3 Buckets | Media storage with tenant prefix isolation |
| D3.3 | File Upload Pipeline | MinIO (dev), S3 (prod), presigned URLs |

### Phase 4 — Pipeline/Opportunity/Activity

| # | Deliverable | Description |
|---|-------------|-------------|
| D4.1 | Celery Queue Tuning | Separate queues per workload type |
| D4.2 | Flower Dashboard | Celery monitoring for development |

### Phase 5 — Workflow Engine

| # | Deliverable | Description |
|---|-------------|-------------|
| D5.1 | Workflow Queue | Dedicated queue with higher priority |
| D5.2 | Celery Task Timeout Config | 30s default, 300s max for reports |

### Phase 6 — Notification Engine

| # | Deliverable | Description |
|---|-------------|-------------|
| D6.1 | SES Configuration | SPF, DKIM, DMARC DNS records |
| D6.2 | WebSocket Support | ASGI server config, Redis channel layer |

### Phase 7 — Reports

| # | Deliverable | Description |
|---|-------------|-------------|
| D7.1 | Materialized Views | DB maintenance for report performance |
| D7.2 | Async Export Pipeline | Celery tasks for CSV/PDF/XLSX generation |

### Phase 8 — AI Platform

| # | Deliverable | Description |
|---|-------------|-------------|
| D8.1 | AI Gateway Dockerfile | FastAPI multi-stage build |
| D8.2 | AI Gateway Service | K8s deployment, HPA, Service |
| D8.3 | OpenAI API Key Management | Secrets Manager, auto-rotation |
| D8.4 | AI Cost Monitoring | Prometheus metrics for token usage |

### Phase 9 — Voice AI

| # | Deliverable | Description |
|---|-------------|-------------|
| D9.1 | Twilio Integration | Webhook endpoints, Media Streams config |
| D9.2 | Audio File Storage | S3 bucket with encryption for call recordings |

### Phase 10 — Integration Hub

| # | Deliverable | Description |
|---|-------------|-------------|
| D10.1 | OAuth Token Vault | Encrypted storage in Secrets Manager |
| D10.2 | Webhook Delivery Service | Retry queue, DLQ monitoring |

### Phase 11 — Enterprise

| # | Deliverable | Description |
|---|-------------|-------------|
| D11.1 | Multi-Region EKS | Secondary cluster in us-west-2 |
| D11.2 | RDS Read Replicas | Read replicas in secondary region |
| D11.3 | Cross-Region Replication | S3 CRR, RDS cross-region read replicas |
| D11.4 | WAFv2 Configuration | Rate limiting, IP allow/deny, SQLi/XSS rules |
| D11.5 | Backup Verification | Weekly automated backup restore test |
| D11.6 | DR Runbook | Documented failover procedure, tested quarterly |
| D11.7 | Performance Benchmark Suite | k6 load tests in CI |
| D11.8 | Pod Disruption Budgets | minAvailable for all critical services |
| D11.9 | Network Policies | Least-privilege network policy for all pods |

---

## 14. Runbooks

### 14.1 Incident Response Runbook

```
SEVERITY LEVELS:
  SEV1: Service down, data loss, security breach
  SEV2: Degraded performance, feature outage
  SEV3: Minor issue, no customer impact

RESPONSE FLOW:
1. DETECT
   - Alert from Prometheus/Grafana
   - User report via support
   - Sentry error spike
   
2. TRIAGE (within 5 min)
   - Check Grafana dashboards
   - Check Sentry for error details
   - Check CloudWatch logs
   - Determine severity

3. MITIGATE
   - SEV1: Page on-call engineer immediately
     - Rollback last deployment
     - Scale up affected service
     - Redirect traffic to DR if needed
   
   - SEV2: Investigate during business hours
     - Check recent changes
     - Review logs and metrics
     - Apply hotfix if root cause identified
   
   - SEV3: Log ticket, fix in next sprint

4. RESOLVE
   - Confirm service health restored
   - Postmortem within 48h for SEV1
   - Update runbook with lessons learned
```

### 14.2 Deployment Rollback Runbook

```
TRIGGER: Failed smoke test, error rate spike, latency increase

AUTOMATIC ROLLBACK:
1. GitHub Actions detects failure in post-deploy smoke test
2. Pipeline automatically reverts to previous Helm release
3. kubectl rollout undo deployment/tzahu-django

MANUAL ROLLBACK:
1. Identify last known good version:
   kubectl rollout history deployment/tzahu-django

2. Rollback:
   kubectl rollout undo deployment/tzahu-django --to-revision=N

3. Verify:
   curl -f https://api.tzahu.com/health/
   kubectl logs -l app=tzahu-django --tail=100

4. Database rollback (if migration applied):
   python manage.py migrate <app_name> <previous_migration>
   Note: Data migration rollback requires manual verification
```

### 14.3 Database Recovery Runbook

```
SCENARIO: Accidental data deletion or corruption

POINT-IN-TIME RECOVERY:
1. Identify target time:
    - RDS: Use AWS Console -> Snapshots -> Restore to point in time
    - Select timestamp before data loss event

2. Restore:
    aws rds restore-db-cluster-to-point-in-time \
        --source-db-cluster-identifier tzahu-prod \
        --restore-to-time "2026-07-27T14:00:00Z" \
        --db-cluster-identifier tzahu-prod-restored

3. Verify restored data:
    Connect to restored instance
    Run data integrity queries

4. Export and import affected data:
    pg_dump --table=lead_management_leads \
        --data-only --where="created_at >= '2026-07-27'" \
        postgresql://... > /tmp/recovered_leads.sql
    psql postgresql://... < /tmp/recovered_leads.sql

5. Switch application to restored DB:
    Update DATABASE_URL in secrets
    kubectl rollout restart deployment/tzahu-django
```

### 14.4 Certificate Renewal Runbook

```
CERTIFICATE: *.tzahu.com (ACM)

AUTOMATIC RENEWAL:
- ACM automatically renews certificates 60 days before expiry
- No action required for CloudFront distributions
- Verify: aws acm list-certificates --certificate-status ISSUED

MANUAL RENEWAL (if auto-renewal fails):
1. aws acm request-certificate \
    --domain-name *.tzahu.com \
    --validation-method DNS \
    --idempotency-token $(date +%s)

2. Add CNAME record to Route53:
    aws route53 change-resource-record-sets \
        --hosted-zone-id ZONE_ID \
        --change-batch file://dns-validation.json

3. Wait for validation (typically < 5 min):
    aws acm describe-certificate --certificate-arn ARN

4. Update Nginx ingress to use new certificate:
    kubectl delete secret tzahu-tls
    kubectl create secret tls tzahu-tls \
        --cert=arn:aws:acm:... \
        --key=arn:aws:acm:...
    kubectl rollout restart deployment/nginx-ingress-controller
```
