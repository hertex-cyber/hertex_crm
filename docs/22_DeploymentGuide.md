# TZAHU CRM — Deployment Guide

> **Version:** 0.1.0-draft
> **Last Updated:** 2026-07-27
> **Status:** Approved
> **Owner:** Platform Architecture Team

---

## Table of Contents

1. [Environment Strategy](#1-environment-strategy)
2. [Docker Build Strategy](#2-docker-build-strategy)
3. [Docker Compose (Local Development)](#3-docker-compose-local-development)
4. [CI/CD Pipeline](#4-cicd-pipeline)
5. [AWS Infrastructure](#5-aws-infrastructure)
6. [Kubernetes Manifests](#6-kubernetes-manifests)
7. [Secrets Management](#7-secrets-management)
8. [Zero-Downtime Deployment](#8-zero-downtime-deployment)
9. [Database Migrations](#9-database-migrations)
10. [Rollback Procedure](#10-rollback-procedure)

---

## 1. Environment Strategy

### Environment Matrix

| Environment | Purpose | Infrastructure | Hosting | Data |
|-------------|---------|---------------|---------|------|
| Local | Developer workstation | Docker Compose | Laptop | Anonymized seed data |
| Dev | Integration testing | Single host (docker-compose) | EC2 t3.large | Synthetic data |
| Staging | Pre-production validation | K8s (mini, 3 nodes) | EKS managed node group | Anonymized prod copy |
| Production | Live customer traffic | K8s (multi-AZ, 10+ nodes) | EKS Fargate + node groups | Real customer data |
| DR | Disaster recovery | K8s (secondary region) | EKS in us-west-2 | Async replica |

### Configuration Hierarchy

```
.env.example              # Template with all keys (no secrets)
docker-compose.yml        # Local overrides via .env
.env.dev                  # Dev environment
.env.staging              # Staging environment (secrets in Secrets Manager)
.env.prod                 # Production environment (secrets in Secrets Manager)
```

### Environment Variables by Category

```bash
# Django
DJANGO_SETTINGS_MODULE=config.settings.prod
SECRET_KEY=managed-by-vault
DEBUG=False
ALLOWED_HOSTS=.tzahu.com

# Database
DATABASE_URL=postgres://user:pass@host:5432/tzahu
DB_POOL_MIN=10
DB_POOL_MAX=50

# Redis
REDIS_URL=redis://redis:6379/0
CACHE_URL=redis://redis:6379/1
CHANNEL_URL=redis://redis:6379/2

# RabbitMQ
RABBITMQ_URL=amqp://user:pass@rabbitmq:5672/
CELERY_BROKER_URL=amqp://user:pass@rabbitmq:5672/
CELERY_RESULT_BACKEND=redis://redis:6379/3

# AI Gateway
AI_GATEWAY_URL=http://ai-gateway:8000
OPENAI_API_KEY=managed-by-vault
ANTHROPIC_API_KEY=managed-by-vault

# Storage
AWS_ACCESS_KEY_ID=managed-by-vault
AWS_SECRET_ACCESS_KEY=managed-by-vault
S3_BUCKET=tzahu-prod-media
S3_REGION=us-east-1

# Monitoring
SENTRY_DSN=managed-by-vault
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317
```

---

## 2. Docker Build Strategy

### Django Backend (Multi-Stage)

```dockerfile
# backend/Dockerfile
FROM python:3.13-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev curl \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml poetry.lock ./
RUN pip install poetry && poetry export -f requirements.txt --output requirements.txt
RUN pip install --user --no-warn-script-location -r requirements.txt

FROM python:3.13-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev curl \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd -r django && useradd -r -g django django

COPY --from=builder /root/.local /root/.local
ENV PATH=/root/.local/bin:$PATH

WORKDIR /app
COPY . .

RUN DJANGO_SETTINGS_MODULE=config.settings.prod python manage.py collectstatic --noinput

USER django

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:8000/health/ || exit 1

CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "4", "--threads", "2", "--timeout", "60", "--keep-alive", "65", "--access-logfile", "-", "--error-logfile", "-"]
```

### FastAPI AI Gateway

```dockerfile
# ai_gateway/Dockerfile
FROM python:3.13-slim AS builder
RUN pip install poetry
COPY pyproject.toml poetry.lock ./
RUN poetry export -f requirements.txt --output requirements.txt && \
    pip install --user -r requirements.txt

FROM python:3.13-slim AS runtime
COPY --from=builder /root/.local /root/.local
ENV PATH=/root/.local/bin:$PATH

WORKDIR /app
COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4", "--limit-max-requests", "10000"]
```

### Celery Worker

```dockerfile
# Dockerfile.celery (shares same base as Django)
FROM python:3.13-slim AS runtime
# ... same as Django backend ...

CMD ["celery", "-A", "config.celery", "worker", "-l", "info", "--concurrency", "8", "--queues", "default,high_priority,low_priority,ai"]
```

### Frontend (React + Nginx)

```dockerfile
# frontend/Dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine AS runtime
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:80/health || exit 1

EXPOSE 80
```

### Nginx Reverse Proxy

```nginx
# frontend/nginx.conf
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # API proxy
    location /api/ {
        proxy_pass http://backend:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }

    # WebSocket proxy
    location /ws/ {
        proxy_pass http://backend:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400s;
    }

    # Static files
    location /static/ {
        alias /usr/share/nginx/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Media files
    location /media/ {
        proxy_pass http://minio:9000/tzahu/;
        expires 30d;
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

## 3. Docker Compose (Local Development)

```yaml
# docker-compose.yml
version: "3.9"

services:
  db:
    image: postgis/postgis:16-3.4
    environment:
      POSTGRES_DB: tzahu
      POSTGRES_USER: tzahu
      POSTGRES_PASSWORD: tzahu_dev
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U tzahu"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  rabbitmq:
    image: rabbitmq:3.13-management-alpine
    environment:
      RABBITMQ_DEFAULT_USER: tzahu
      RABBITMQ_DEFAULT_PASS: tzahu_dev
    ports:
      - "5672:5672"
      - "15672:15672"
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "check_port_connectivity"]
      interval: 10s
      timeout: 5s
      retries: 5

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: tzahu
      MINIO_ROOT_PASSWORD: tzahu_dev
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio_data:/data

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    env_file: .env
    environment:
      DJANGO_SETTINGS_MODULE: config.settings.dev
    ports:
      - "8000:8000"
    depends_on:
      db: { condition: service_healthy }
      redis: { condition: service_healthy }
      rabbitmq: { condition: service_healthy }
    volumes:
      - ./backend:/app  # hot reload in dev
    command: ["python", "manage.py", "runserver", "0.0.0.0:8000"]

  celery_worker:
    build:
      context: ./backend
      dockerfile: Dockerfile
    env_file: .env
    environment:
      DJANGO_SETTINGS_MODULE: config.settings.dev
    depends_on:
      db: { condition: service_healthy }
      redis: { condition: service_healthy }
      rabbitmq: { condition: service_healthy }
    volumes:
      - ./backend:/app
    command: ["celery", "-A", "config.celery", "worker", "-l", "info", "-B"]

  ai_gateway:
    build:
      context: ./ai_gateway
      dockerfile: Dockerfile
    env_file: .env
    ports:
      - "8100:8000"
    depends_on:
      redis: { condition: service_healthy }

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "80:80"
    depends_on:
      - backend

volumes:
  pgdata:
  minio_data:
```

---

## 4. CI/CD Pipeline

### Pipeline Overview

```
PR → [Lint → Typecheck → Unit Test → Integration Test → Isolation Test → Security Scan]
  → Merge to main
  → [Build Images → Push to ECR]
  → Deploy to Staging
  → [Smoke Test → E2E Test]
  → [Manual Approval Gate]
  → Deploy to Production
  → [Post-Deployment Monitoring]
```

### GitHub Actions Workflow

```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, 'release/**']
  pull_request:
    branches: [main]

jobs:
  lint-and-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.13'
      - run: pip install poetry && poetry install
      - run: poetry run ruff check .
      - run: poetry run mypy --strict .

  test:
    needs: lint-and-typecheck
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgis/postgis:16-3.4
        env:
          POSTGRES_DB: tzahu_test
          POSTGRES_PASSWORD: postgres
        ports: ['5432:5432']
      redis:
        image: redis:7-alpine
        ports: ['6379:6379']
      rabbitmq:
        image: rabbitmq:3.13-alpine
        ports: ['5672:5672']
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.13'
      - run: pip install poetry && poetry install
      - run: poetry run pytest -m "unit" --cov=apps --cov-fail-under=90
      - run: poetry run pytest -m "integration" --cov=apps --cov-append
      - run: poetry run pytest -m "isolation" --timeout=120
      - run: poetry run pytest -m "contract"
      - run: poetry run pytest -m "security"
      - run: poetry run pytest -m "performance"
      - uses: actions/upload-artifact@v4
        with:
          name: coverage-report
          path: htmlcov/

  build-and-push:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE }}
          aws-region: us-east-1
      - uses: docker/login-action@v3
        with:
          registry: ${{ secrets.ECR_REGISTRY }}
      - run: |
          docker build -t $ECR_REGISTRY/tzahu-backend:${{ github.sha }} -f backend/Dockerfile backend
          docker push $ECR_REGISTRY/tzahu-backend:${{ github.sha }}
          docker build -t $ECR_REGISTRY/tzahu-ai-gateway:${{ github.sha }} -f ai_gateway/Dockerfile ai_gateway
          docker push $ECR_REGISTRY/tzahu-ai-gateway:${{ github.sha }}
          docker build -t $ECR_REGISTRY/tzahu-frontend:${{ github.sha }} -f frontend/Dockerfile frontend
          docker push $ECR_REGISTRY/tzahu-frontend:${{ github.sha }}

  deploy-staging:
    needs: build-and-push
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE }}
          aws-region: us-east-1
      - run: |
          kubectl set image deployment/backend backend=$ECR_REGISTRY/tzahu-backend:${{ github.sha }}
          kubectl set image deployment/celery-worker celery-worker=$ECR_REGISTRY/tzahu-backend:${{ github.sha }}
          kubectl set image deployment/ai-gateway ai-gateway=$ECR_REGISTRY/tzahu-ai-gateway:${{ github.sha }}
          kubectl set image deployment/frontend frontend=$ECR_REGISTRY/tzahu-frontend:${{ github.sha }}
          kubectl rollout status deployment/backend --timeout=5m
      - run: |
          ./scripts/run-smoke-tests.sh https://staging.tzahu.com

  deploy-production:
    needs: deploy-staging
    runs-on: ubuntu-latest
    environment: production
    concurrency: production
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_PROD }}
          aws-region: us-east-1
      - run: |
          kubectl set image deployment/backend backend=$ECR_REGISTRY/tzahu-backend:${{ github.sha }}
          kubectl set image deployment/celery-worker celery-worker=$ECR_REGISTRY/tzahu-backend:${{ github.sha }}
          kubectl set image deployment/ai-gateway ai-gateway=$ECR_REGISTRY/tzahu-ai-gateway:${{ github.sha }}
          kubectl set image deployment/frontend frontend=$ECR_REGISTRY/tzahu-frontend:${{ github.sha }}
          kubectl rollout status deployment/backend --timeout=10m
```

### Smoke Test Script

```bash
#!/bin/bash
# scripts/run-smoke-tests.sh
BASE_URL=$1

echo "Running smoke tests against $BASE_URL"

check() {
  local url=$1
  local expected=$2
  local desc=$3
  status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$url")
  if [ "$status" != "$expected" ]; then
    echo "FAIL: $desc - expected $expected, got $status"
    exit 1
  fi
  echo "PASS: $desc"
}

check "/api/v1/health/" "200" "Health endpoint"
check "/api/v1/auth/login/" "405" "Login endpoint (no POST body)"
check "/" "200" "Frontend SPA"
check "/api/v1/leads/" "401" "Auth required for API"

echo "All smoke tests passed!"
```

---

## 5. AWS Infrastructure

### Network Topology

```
VPC (10.0.0.0/16)
├── Public Subnets (us-east-1a, 1b, 1c)
│   ├── ALB (Internet-facing)
│   ├── Nginx Reverse Proxy
│   └── NAT Gateway
├── Private App Subnets
│   ├── EKS Node Groups (Fargate + EC2)
│   ├── Backend Pods
│   ├── Celery Workers
│   ├── AI Gateway Pods
│   └── Frontend Pods
└── Private Data Subnets
    ├── RDS Aurora (Multi-AZ, 2 read replicas)
    ├── ElastiCache Redis (Cluster Mode)
    ├── Amazon MQ (RabbitMQ, Multi-AZ)
    └── MinIO / S3 Gateway
```

### Terraform Module Structure

```hcl
# infra/terraform/environments/prod/main.tf
module "networking" {
  source = "../../modules/networking"
  vpc_cidr = "10.0.0.0/16"
  availability_zones = ["us-east-1a", "us-east-1b", "us-east-1c"]
  environment = "prod"
}

module "eks" {
  source = "../../modules/eks"
  cluster_name = "tzahu-prod"
  subnet_ids = module.networking.private_subnet_ids
  node_groups = {
    backend = { min = 3, max = 20, instance_types = ["t3.large", "t3.xlarge"] }
    celery  = { min = 3, max = 30, instance_types = ["c6i.xlarge"] }
    ai      = { min = 2, max = 10, instance_types = ["g5.xlarge"] }
  }
  fargate_profiles = ["frontend", "system"]
}

module "rds" {
  source = "../../modules/rds"
  instance_class = "db.r6g.large"
  multi_az = true
  replica_count = 2
  allocated_storage = 500
  max_allocated_storage = 2000
  subnet_ids = module.networking.data_subnet_ids
  environment = "prod"
}

module "elasticache" {
  source = "../../modules/elasticache"
  node_type = "cache.r6g.large"
  num_cache_nodes = 3
  subnet_ids = module.networking.data_subnet_ids
  environment = "prod"
}

module "rabbitmq" {
  source = "../../modules/rabbitmq"
  instance_type = "mq.m5.large"
  multi_az = true
  subnet_ids = module.networking.data_subnet_ids
  environment = "prod"
}

module "monitoring" {
  source = "../../modules/monitoring"
  environment = "prod"
  # Prometheus, Grafana, OpenTelemetry Collector
}
```

---

## 6. Kubernetes Manifests

### Backend Deployment

```yaml
# infra/kubernetes/backend/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  namespace: backend
spec:
  replicas: 4
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "8000"
    spec:
      serviceAccountName: backend
      terminationGracePeriodSeconds: 60
      containers:
        - name: backend
          image: 123456789.dkr.ecr.us-east-1.amazonaws.com/tzahu-backend:latest
          ports:
            - containerPort: 8000
          envFrom:
            - configMapRef:
                name: backend-config
            - secretRef:
                name: backend-secrets
          resources:
            requests:
              cpu: "500m"
              memory: "512Mi"
            limits:
              cpu: "2000m"
              memory: "2Gi"
          livenessProbe:
            httpGet:
              path: /health/
              port: 8000
            initialDelaySeconds: 30
            periodSeconds: 30
          readinessProbe:
            httpGet:
              path: /health/
              port: 8000
            initialDelaySeconds: 10
            periodSeconds: 10
          lifecycle:
            preStop:
              exec:
                command: ["sleep", "30"]
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
            - weight: 100
              podAffinityTerm:
                labelSelector:
                  matchLabels:
                    app: backend
                topologyKey: topology.kubernetes.io/zone
```

### Horizontal Pod Autoscaler

```yaml
# infra/kubernetes/backend/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: backend-hpa
  namespace: backend
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: backend
  minReplicas: 4
  maxReplicas: 20
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
```

### Celery Worker Deployment

```yaml
# infra/kubernetes/celery/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: celery-worker
  namespace: backend
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
  selector:
    matchLabels:
      app: celery-worker
  template:
    metadata:
      labels:
        app: celery-worker
    spec:
      containers:
        - name: worker
          image: 123456789.dkr.ecr.us-east-1.amazonaws.com/tzahu-backend:latest
          command:
            - celery
            - -A
            - config.celery
            - worker
            - -l
            - info
            - --concurrency=8
            - --queues=default,high_priority,low_priority,ai
          envFrom:
            - configMapRef:
                name: backend-config
            - secretRef:
                name: backend-secrets
          resources:
            requests:
              cpu: "1"
              memory: "1Gi"
            limits:
              cpu: "4"
              memory: "4Gi"
```

### Network Policies

```yaml
# infra/kubernetes/network-policies.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: backend-network-policy
  namespace: backend
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              name: frontend
        - namespaceSelector:
            matchLabels:
              name: ai
      ports:
        - port: 8000
  egress:
    - to:
        - namespaceSelector:
            matchLabels:
              name: data
      ports:
        - port: 5432
        - port: 6379
        - port: 5672
        - port: 15672
    - to:
        - namespaceSelector:
            matchLabels:
              name: monitoring
      ports:
        - port: 4317
        - port: 4318
```

### Ingress (ALB Ingress Controller)

```yaml
# infra/kubernetes/ingress/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: tzahu-ingress
  namespace: backend
  annotations:
    kubernetes.io/ingress.class: alb
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
    alb.ingress.kubernetes.io/listen-ports: '[{"HTTP": 80}, {"HTTPS": 443}]'
    alb.ingress.kubernetes.io/ssl-redirect: "443"
    alb.ingress.kubernetes.io/healthcheck-path: /health/
    alb.ingress.kubernetes.io/certificate-arn: arn:aws:acm:us-east-1:123456789:certificate/abc123
spec:
  rules:
    - host: api.tzahu.com
      http:
        paths:
          - path: /api/
            pathType: Prefix
            backend:
              service:
                name: backend
                port:
                  number: 8000
          - path: /ws/
            pathType: Prefix
            backend:
              service:
                name: backend
                port:
                  number: 8000
    - host: app.tzahu.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: frontend
                port:
                  number: 80
    - host: ai.tzahu.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: ai-gateway
                port:
                  number: 8000
```

---

## 7. Secrets Management

### External Secrets Operator

```yaml
# infra/kubernetes/secrets/external-secret.yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: backend-secrets
  namespace: backend
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secrets-manager
    kind: ClusterSecretStore
  target:
    name: backend-secrets
    creationPolicy: Owner
  data:
    - secretKey: SECRET_KEY
      remoteRef:
        key: tzahu/prod/backend
        property: SECRET_KEY
    - secretKey: DATABASE_URL
      remoteRef:
        key: tzahu/prod/database
        property: DATABASE_URL
    - secretKey: OPENAI_API_KEY
      remoteRef:
        key: tzahu/prod/ai
        property: OPENAI_API_KEY
    - secretKey: SENTRY_DSN
      remoteRef:
        key: tzahu/prod/monitoring
        property: SENTRY_DSN
```

### Secret Rotation Policy

| Secret | Rotation | Automation |
|--------|----------|-----------|
| Django SECRET_KEY | 90 days | Lambda function |
| Database passwords | 90 days | RDS automatic rotation |
| JWT signing keys | 90 days | CronJob |
| OpenAI/Anthropic keys | 180 days | Manual (provider limitation) |
| AWS access keys | Never (use IAM roles) | N/A |

---

## 8. Zero-Downtime Deployment

### Principles

1. **Rolling update** with `maxSurge=1, maxUnavailable=0` — never run fewer pods than desired.
2. **Readiness probe** ensures traffic only reaches healthy pods.
3. **PreStop hook** (30s sleep) gives in-flight requests time to complete.
4. **Migration safety** — expand before contract pattern.
5. **Session draining** — old pods finish active requests before termination.

### Deployment Sequence

```
1. Health check existing pods (all must be ready)
2. Run database migrations (Phase 1: additive only)
3. Update image in deployment
4. New pods start, pass readiness probes
5. Old pods receive SIGTERM after 30s preStop sleep
6. Monitor error rate and latency for 10 minutes
7. Run smoke tests
8. Run Phase 2 migrations (data backfill, non-blocking)
9. Run Phase 3 migrations (contract changes, next deploy)
```

### Readiness Probe Guarantee

```yaml
readinessProbe:
  httpGet:
    path: /health/ready/
    port: 8000
  initialDelaySeconds: 10
  periodSeconds: 5
  failureThreshold: 3
```

The `/health/ready/` endpoint checks:
- Database connectivity
- Cache connectivity
- Recent migrations applied
- No pending blocking migrations

---

## 9. Database Migrations

### Safe Migration Patterns

**Safe (online):**
- `CREATE INDEX CONCURRENTLY`
- `ADD COLUMN ... NULL`
- `CREATE TABLE`
- `ADD CONSTRAINT ... NOT VALID` (then validate in background)

**Potentially blocking (requires care):**
- `ADD COLUMN ... DEFAULT` (PostgreSQL 11+ optimized, but test)
- `ALTER COLUMN ... SET NOT NULL` (after validating all rows are non-null)

**Unsafe (requires downtime or alternative approach):**
- `ALTER COLUMN ... TYPE` (majority of type changes)
- `DROP COLUMN` (actually safe in PG — just marks as dropped)

### Migration Deployment Sequence

```bash
# Step 1: Deploy code that supports both old and new schema
kubectl set image deployment/backend backend=$NEW_IMAGE

# Step 2: Run additive migrations
kubectl exec deployment/backend -- python manage.py migrate --plan
kubectl exec deployment/backend -- python manage.py migrate

# Step 3: Run data backfill (background)
kubectl create job --image=$NEW_IMAGE backfill-job -- python manage.py backfill_data

# Step 4: Deploy code that requires new schema
kubectl set image deployment/backend backend=$NEW_IMAGE

# Step 5: Run contract migrations (if any)
kubectl exec deployment/backend -- python manage.py migrate
```

---

## 10. Rollback Procedure

### Immediate Rollback (< 15 min)

```bash
# Revert to previous image
kubectl rollout undo deployment/backend
kubectl rollout status deployment/backend --timeout=5m

# If migration was applied, run reverse migration
kubectl exec deployment/backend -- python manage.py migrate <app> <previous_migration>

# Verify health
./scripts/run-smoke-tests.sh https://app.tzahu.com
```

### Database Rollback (Data Migration)

If a data migration corrupted data:
```bash
# 1. Scale down application to prevent writes
kubectl scale deployment backend --replicas=0

# 2. Restore database from pre-deployment snapshot
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier tzahu-prod \
  --target-db-instance-identifier tzahu-prod-rollback \
  --restore-time "2026-07-27T09:30:00Z"

# 3. Update DB connection string to restored instance
# 4. Scale up application
# 5. Verify data integrity
# 6. Fail back to original instance after confirmation
```

### Rollback Decision Matrix

| Issue Type | Example | Action | Timeline |
|-----------|---------|--------|----------|
| P0: Data loss/leak | Cross-tenant data leak | Immediate rollback + DB restore | < 15 min |
| P0: Service down | All API returning 500 | Immediate rollback | < 15 min |
| P1: Major feature broken | Lead creation failing | Rollback feature | < 1 hour |
| P2: Minor feature broken | Report export formatting | Fix forward | Next release |
| P3: Cosmetic issue | Button misaligned | Fix forward | Next release |
