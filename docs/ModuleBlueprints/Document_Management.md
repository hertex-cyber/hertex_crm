# Module Blueprint: Document Management

- **Module:** `apps.document`
- **Bounded Context:** Document Storage & File Management
- **Status:** Draft v1.0

## Business Purpose

The Document Management module provides centralized file storage, versioning, sharing, and organization for all CRM entities. It integrates with external storage providers (S3/MinIO) and handles file uploads, previews, and access control.

## Bounded Context

This module owns Documents, Folders, File Versions, and Sharing. It does not own the storage infrastructure (S3) but manages the metadata and access layer. Other modules reference documents via FK.

## Aggregates, Entities, Value Objects

### Aggregate: Document
- **Document** (Aggregate Root)
  - `id: UUID v7`
  - `tenant_id: UUID v7`
  - `original_filename: str`
  - `stored_filename: str` (UUID-based for storage)
  - `mime_type: str`
  - `file_size: int` (bytes)
  - `storage_path: str`
  - `storage_provider: str` (s3, minio, local)
  - `checksum: str` (SHA-256)
  - `category: DocumentCategory`
  - `tags: Array[str]`
  - `folder_id: UUID v7 | None`
  - `entity_type: str | None` (related CRM entity)
  - `entity_id: UUID v7 | None`
  - `description: Text | None`
  - `version: int`
  - `is_deleted: bool` (soft-delete)
  - `uploaded_by: UUID v7`
  - `timestamps: created_at, updated_at, accessed_at`

### Value Objects
- **DocumentCategory:** `enum(CONTRACT, INVOICE, REPORT, IMAGE, EMAIL_ATTACHMENT, TICKET_ATTACHMENT, PROPOSAL, PRESENTATION, SPREADSHEET, OTHER)`

### Entities
- **DocumentVersion** — Version history
  - `id, document_id, version, stored_filename, file_size, checksum, uploaded_by, change_summary, created_at`
- **Folder** — Hierarchical folder structure
  - `id, tenant_id, name, parent_id, description, created_by, created_at, updated_at`
- **DocumentShare** — Shared document links
  - `id, document_id, shared_by, shared_with (user or email), permission: VIEW|EDIT, expires_at, access_token, created_at`
- **DocumentAccessLog** — Access tracking
  - `id, document_id, user_id, action: VIEW|DOWNLOAD|EDIT|DELETE, ip_address, timestamp`

## Domain Events

- `DocumentUploaded`, `DocumentUpdated`, `DocumentDeleted`
- `DocumentVersionCreated`
- `DocumentShared`, `DocumentAccessRevoked`
- `DocumentAccessed`, `DocumentDownloaded`
- `FolderCreated`, `FolderMoved`, `FolderDeleted`

## Commands & Queries

### Commands
- `UploadDocument(file, folder_id, entity_ref) -> DocumentId`
- `UpdateDocument(document_id, metadata)`
- `DeleteDocument(document_id) -> soft delete`
- `PermanentDelete(document_id)` (admin only)
- `CreateNewVersion(document_id, file, change_summary)`
- `MoveDocument(document_id, new_folder_id)`
- `CopyDocument(document_id, target_entity_ref) -> DocumentId`
- `CreateFolder(name, parent_id) -> FolderId`
- `MoveFolder(folder_id, new_parent_id)`
- `DeleteFolder(folder_id)`
- `ShareDocument(document_id, user_id, permission, expires_at) -> ShareLink`
- `RevokeShare(share_id)`
- `GenerateDownloadUrl(document_id, version?) -> presigned URL`

### Queries
- `GetDocument(id) -> Document + latest version URL`
- `GetDocumentVersions(document_id)`
- `GetDocumentVersion(id, version_number)`
- `ListDocuments(folder_id?, entity_ref?, category?, page)`
- `SearchDocuments(query, filters)`
- `GetFolderTree() -> hierarchical list`
- `GetRecentDocuments(user_id, limit)`
- `GetStorageUsage(tenant_id) -> total size by category`
- `GetSharedDocuments(user_id) -> documents shared with me`

## Application Services

- `DocumentService` — Upload, metadata management, move/copy
- `DocumentVersionService` — Version tracking and retrieval
- `FolderService` — Folder hierarchy and navigation
- `StorageService` — Abstract storage backend (S3/MinIO/local)
- `ShareService` — Share link generation and access control
- `ThumbnailService` — Generate preview thumbnails for images/PDFs
- `VirusScanService` — File scanning on upload (ClamAV)

## API Endpoints

| Method | URL | Description |
|--------|-----|-------------|
| POST | `/api/v1/documents/upload/` | Upload file |
| GET | `/api/v1/documents/` | List documents |
| GET/PUT/DELETE | `/api/v1/documents/{id}/` | Document CRUD |
| GET | `/api/v1/documents/{id}/download/` | Download (signed URL) |
| GET | `/api/v1/documents/{id}/preview/` | Preview thumbnail |
| GET | `/api/v1/documents/{id}/versions/` | Version history |
| POST | `/api/v1/documents/{id}/versions/` | New version |
| POST | `/api/v1/documents/{id}/move/` | Move to folder |
| POST | `/api/v1/documents/{id}/share/` | Create share link |
| DELETE | `/api/v1/documents/shares/{id}/` | Revoke share |
| GET/POST | `/api/v1/documents/folders/` | Folder CRUD |
| GET | `/api/v1/documents/folders/tree/` | Folder tree |
| GET | `/api/v1/documents/search/?q=` | Search |
| GET | `/api/v1/documents/recent/` | Recent documents |
| GET | `/api/v1/documents/storage/` | Storage usage |

## Database Tables

- `document_document` — Core document metadata
- `document_documentversion` — Version history
- `document_folder` — Folder hierarchy
- `document_documentshare` — Shared links
- `document_documentaccesslog` — Access audit
- `document_documententity` — Entity association M2M

## Validation Rules

| Field | Rule |
|-------|------|
| file_size | Max 25MB per file (configurable) |
| mime_type | Restricted types (configurable allowlist) |
| checksum | Must match SHA-256 of uploaded content |
| folder.parent_id | Circular reference check |
| share.expires_at | Must be future date |

## Security & Permissions

| Permission | Codename |
|------------|----------|
| View Document | `document.view_document` |
| Upload Document | `document.upload_document` |
| Change Document | `document.change_document` |
| Delete Document | `document.delete_document` |
| Share Document | `document.share_document` |
| Manage Folder | `document.manage_folder` |
| View All | `document.view_all_documents` (admin) |

## Testing Strategy

| Layer | Focus |
|-------|-------|
| Unit | File type validation, Checksum computation, Folder path resolution |
| Integration | S3/MinIO storage backend (mock), Version creation, Share link generation |
| API | Upload/download flow, Folder hierarchy CRUD, Search queries |

## Future Enhancements

- **Document OCR:** Text extraction from scanned documents
- **Bulk Upload:** Drag-and-drop multiple file upload
- **Document Templates:** Merge fields into document templates
- **eSignature Integration:** Request signatures on documents
- **Full-Text Search:** OCR content indexing
- **Watermarking:** Auto-watermark shared documents
- **Retention Policies:** Auto-delete based on retention rules
- **Office Online:** View/edit Office docs via Microsoft 365 / Google Workspace embed
