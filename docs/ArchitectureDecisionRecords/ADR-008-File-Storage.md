# ADR-008: File Storage — MinIO (S3-Compatible)

- **Status:** Accepted
- **Date:** 2025-07-27
- **Authors:** Chief Architect, DevOps Lead

## Context

TZAHU CRM handles file uploads: attachments (documents, images), email attachments, export files, AI-generated documents, and report exports. Storage must be reliable, scalable, secure (tenant isolation), and cost-effective.

## Options Considered

### 1. MinIO (S3-Compatible, Self-Hosted) (Selected)
- **Pros:** S3-compatible API (industry standard), self-hosted (data residency control), high performance (10GB/s+), erasure coding for data durability, built-in bucket-level versioning, lifecycle policies, encryption at rest (SSE-S3/KMS), bucket policies for tenant isolation, excellent IAM integration, active open-source development (AGPLv3), lightweight (single binary).
- **Cons:** Requires operational management (cluster maintenance, disk management), not as feature-rich as AWS S3 (Glacier, S3 Object Lambda, etc.), self-hosted means storage capacity planning.

### 2. Local Filesystem (Django `FileSystemStorage`)
- **Pros:** Simplest, no external dependency, no network latency, easy backup.
- **Cons:** Not scalable across multiple app instances, file loss on container restart (unless using persistent volumes), no built-in replication, backup requires filesystem-level tooling, cannot serve files without Django (performance bottleneck), no object versioning.

### 3. AWS S3 (Managed)
- **Pros:** Fully managed, infinite scalability, 11 9s durability, rich feature set (Glacier, Intelligent-Tiering, Object Lambda), global CDN via CloudFront, well-supported by Django (boto3/django-storages).
- **Cons:** Cloud vendor lock-in, data residency compliance (GDPR, SOC 2), egress costs at scale, requires AWS account and credentials, not available for local development without MinIO or LocalStack.

### 4. Google Cloud Storage
- **Pros:** Similar to AWS S3, strong consistency, integrated with GCP ecosystem.
- **Cons:** Cloud vendor lock-in, different API (not S3-compatible), similar data residency concerns, smaller Django ecosystem.

## Decision

**Use MinIO** as the primary file storage backend, with S3-compatible API.

- Local development: MinIO Docker container
- Production: MinIO cluster with erasure coding
- Django integration: `django-storages` with `S3Boto3Storage` backend (pointed at MinIO)
- Tenant isolation: Per-tenant bucket or prefix-based isolation (`tenant/{tenant_id}/`)
- File metadata stored in PostgreSQL (`files_upload` table)
- Signed URLs for temporary file access
- Upload size limit: 50MB default, configurable per tenant

## Consequences

- **Positive:** S3-compatible API (standard interface), self-hosted (data residency), portable to AWS S3 later.
- **Positive:** Erasure coding protects against disk failures without RAID.
- **Negative:** Self-hosted storage requires operational management (disk health, capacity).
- **Negative:** MinIO cluster setup requires at least 4 drives for erasure coding.
- **Migration Path:** If MinIO becomes too expensive to operate, migrate to AWS S3 by changing the endpoint in Django settings.

## Compliance

- All file uploads go through MinIO, not local filesystem.
- `django-storages` configured with MinIO endpoint in all environments.
- PR review: No new `FileSystemStorage` usages.
- Production: MinIO metrics scraped by Prometheus.
- Backup: MinIO buckets backed up to secondary location (S3 Glacier or tape).
