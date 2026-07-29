# ADR-015: Container Orchestration — Docker + Kubernetes

- **Status:** Accepted
- **Date:** 2025-07-27
- **Authors:** Chief Architect, DevOps Lead

## Context

TZAHU CRM requires a container orchestration strategy for development, staging, and production environments. The strategy must support CI/CD, scaling, service discovery, secrets management, zero-downtime deployments, and multi-environment management.

## Options Considered

### 1. Docker + Kubernetes (Selected for Production)
- **Pros:** Industry standard for container orchestration, self-healing (restart, replace, reschedule), auto-scaling (HPA/VPA), service discovery + DNS, load balancing (Ingress), rolling updates + rollback, secrets management, config maps, persistent volumes, namespace isolation, ecosystem (Helm, Kustomize, Istio, cert-manager), cloud-agnostic (EKS, AKS, GKE, kOps).
- **Cons:** Operational complexity (control plane, etcd, CNI, CSI), resource overhead (control plane nodes, system daemonsets), learning curve for team, over-engineering for early stage with low traffic.

### 2. Docker Compose (Development) + Managed Containers (Prod)
- **Pros:** Simple for local development, single command to start all services (`docker compose up`), good for small teams, minimal operational overhead, environment parity across dev/staging/prod.
- **Cons:** No auto-scaling, no self-healing, no load balancing (manual), no rolling updates, no secrets management, no service discovery beyond Docker DNS, manual cluster management, not designed for production at scale.

### 3. AWS ECS (Fargate)
- **Pros:** No control plane management, AWS-managed orchestration, Fargate (serverless containers), ALB integration, CloudWatch integration, IAM task roles, simpler than K8s.
- **Cons:** AWS vendor lock-in, less flexible than K8s, no ecosystem (no Helm, no operator pattern), limited portability, more expensive than EC2-backed ECS, smaller community.

### 4. Nomad (HashiCorp)
- **Pros:** Simpler than K8s, single binary, supports Docker/raw_exec, integrated with Consul for service discovery, Vault for secrets.
- **Cons:** Smaller ecosystem, fewer integrations, less cloud-native (no Ingress, no HPA), smaller community, less industry adoption.

## Decision

**Use Docker Compose for local development** and **Kubernetes (K8s) for production**.

Development:
- `docker-compose.yml` defines all services: Django app, Celery worker, FastAPI sidecar, PostgreSQL, Redis, RabbitMQ, MinIO, Nginx.
- Hot-reload for Django (watchfiles) and React (Vite HMR).
- Volume mounts for code changes (no rebuild needed).
- Profile-based service selection: `docker compose --profile ai up` for AI services.

Production (K8s):
- Cluster: Managed K8s (EKS/AKS/GKE) with node groups (general, GPU for AI, memory-optimized for Celery).
- Deployment: Helm charts for each service, ArgoCD for GitOps deployment.
- Service mesh: Istio for traffic management, mTLS, observability.
- Ingress: Nginx Ingress Controller with cert-manager for TLS.
- HPA: Auto-scaling based on CPU/memory and custom metrics (Celery queue depth).
- Secrets: External Secrets Operator with AWS Secrets Manager.
- Storage: PVC for PostgreSQL, MinIO. EBS/EFS depending on performance needs.

## Consequences

- **Positive:** K8s provides enterprise-grade orchestration, portability across clouds, and ecosystem.
- **Positive:** Docker Compose provides simple, reproducible local development.
- **Negative:** K8s operational complexity requires dedicated DevOps expertise.
- **Negative:** Development-production parity gap (Docker Compose ≠ K8s). Compose features not available in K8s.
- **Negative:** K8s resource overhead for small deployments (3 control plane nodes minimum).
- **Mitigation:** Start with K8s for staging/prod only. Use Docker Compose for dev. Explore K3s for smaller deployments.

## Compliance

- All services must have `Dockerfile` and `docker-compose` entry.
- K8s manifests in `deploy/k8s/` directory (Helm charts in `deploy/helm/`).
- CI builds Docker images and pushes to container registry.
- ArgoCD syncs K8s state from Git repository (GitOps).
- Security: Container scanning (Trivy), K8s audit logging (Falco), network policies, pod security standards.
- PR review: Configuration changes must not hardcode environment-specific values.
