# Module Blueprint: Knowledge Base

- **Module:** `apps.knowledge_base`
- **Bounded Context:** Knowledge Management & Self-Service
- **Status:** Draft v1.0

## Business Purpose

The Knowledge Base module provides a structured repository of articles, guides, and FAQs for both internal (agents) and external (customers) use. It powers self-service customer support, agent training, and AI-assisted answers.

## Bounded Context

This module owns Articles, Categories, and Search. It integrates with the Support module for article suggestions and with the AI Gateway for semantic search and answer generation.

## Aggregates, Entities, Value Objects

### Aggregate: Article
- **Article** (Aggregate Root)
  - `id: UUID v7`
  - `tenant_id: UUID v7`
  - `title: str`
  - `slug: str (unique per tenant)`
  - `content: Text (Markdown or rich HTML)`
  - `excerpt: Text`
  - `article_type: ArticleType`
  - `status: ArticleStatus`
  - `category_id: UUID v7 (FK to Category)`
  - `author_id: UUID v7`
  - `reviewer_id: UUID v7 | None`
  - `tags: Array[str]`
  - `is_internal: bool` (agent-only vs public)
  - `is_featured: bool`
  - `view_count: int`
  - `helpful_count: int`
  - `not_helpful_count: int`
  - `related_articles: List[UUID]`
  - `attachments: List[FileRef]`
  - `timestamps: created_at, updated_at, published_at`

### Value Objects
- **ArticleType:** `enum(GUIDE, FAQ, TROUBLESHOOT, HOW_TO, REFERENCE, RELEASE_NOTE, POLICY)`
- **ArticleStatus:** `enum(DRAFT, REVIEW, PUBLISHED, ARCHIVED)`
- **FileRef:** `{file_id, file_name, file_url, mime_type, size}`

### Entities
- **Category** — Hierarchical article organization
  - `id, tenant_id, name, slug, description, parent_id, sort_order, icon`
- **ArticleFeedback** — User feedback on articles
  - `id, article_id, user_id, helpful, comment, created_at`
- **ArticleVersion** — Version history
  - `id, article_id, version, content, change_summary, created_by, created_at`
- **ArticleSearchLog** — Search query analytics

## Domain Events

- `ArticlePublished`, `ArticleUpdated`, `ArticleArchived`
- `ArticleFeedbackReceived`
- `CategoryCreated`, `CategoryUpdated`, `CategoryDeleted`

## Commands & Queries

### Commands
- `CreateArticle`, `UpdateArticle`, `DeleteArticle`
- `PublishArticle(article_id)`, `ArchiveArticle(article_id)`
- `SubmitForReview(article_id, reviewer_id)`
- `ApproveArticle(article_id)`, `RejectArticle(article_id, reason)`
- `CreateCategory`, `UpdateCategory`, `DeleteCategory`
- `RecordFeedback(article_id, helpful, comment)`
- `RecordView(article_id)`
- `LinkRelatedArticles(article_id, related_ids)`

### Queries
- `GetArticle(id)`, `GetArticleBySlug(slug)`
- `ListArticles(category_id?, status?, tags?, page)`
- `SearchArticles(query, filters) -> ranked results`
- `GetPopularArticles(limit)`
- `GetFeaturedArticles()`
- `GetCategoryTree() -> hierarchical categories`
- `GetArticleHistory(article_id) -> version list`
- `GetArticleFeedback(article_id) -> aggregated stats`
- `GetSearchAnalytics(period) -> popular queries, zero-result queries`

## Application Services

- `ArticleService` — Article CRUD, workflow, publishing
- `CategoryService` — Category tree management
- `ArticleSearchService` — Full-text + vector search
- `ArticleFeedbackService` — Feedback collection and analytics
- `SuggestionService` — Suggest articles based on support ticket context
- `ContentMigrationService` — Import/export articles in bulk

## API Endpoints

| Method | URL | Description |
|--------|-----|-------------|
| GET/POST | `/api/v1/kb/articles/` | List/Create articles |
| GET/PUT/DELETE | `/api/v1/kb/articles/{id}/` | Article CRUD |
| GET | `/api/v1/kb/articles/{id}/by-slug/{slug}/` | Get by slug |
| POST | `/api/v1/kb/articles/{id}/publish/` | Publish |
| POST | `/api/v1/kb/articles/{id}/archive/` | Archive |
| POST | `/api/v1/kb/articles/{id}/review/` | Submit for review |
| GET | `/api/v1/kb/articles/{id}/versions/` | Version history |
| POST | `/api/v1/kb/articles/{id}/feedback/` | Submit feedback |
| GET | `/api/v1/kb/articles/{id}/related/` | Related articles |
| GET | `/api/v1/kb/search/?q=query` | Search articles |
| GET | `/api/v1/kb/popular/` | Popular articles |
| GET/POST | `/api/v1/kb/categories/` | Category CRUD |
| GET | `/api/v1/kb/categories/tree/` | Category tree |
| GET | `/api/v1/kb/stats/` | KB usage stats |

## Database Tables

- `knowledge_base_article` — Core articles
- `knowledge_base_articleversion` — Version history
- `knowledge_base_articlefeedback` — User feedback
- `knowledge_base_category` — Categories
- `knowledge_base_articlerelated` — Related articles M2M
- `knowledge_base_searchlog` — Search analytics

## Validation Rules

| Field | Rule |
|-------|------|
| title | Unique per tenant, max 255 chars |
| slug | Auto-generated from title, URL-safe |
| content | Required for PUBLISHED status |
| status | DRAFT->REVIEW->PUBLISHED->ARCHIVED |
| category | Must belong to same tenant |

## Security & Permissions

| Permission | Codename |
|------------|----------|
| View Public | (public - no auth for published articles) |
| View Internal | `knowledge_base.view_internal_article` |
| Add Article | `knowledge_base.add_article` |
| Change Article | `knowledge_base.change_article` |
| Delete Article | `knowledge_base.delete_article` |
| Publish Article | `knowledge_base.publish_article` |
| Manage Categories | `knowledge_base.manage_category` |

## Testing Strategy

| Layer | Focus |
|-------|-------|
| Unit | Slug generation, Content sanitization, Status workflow transitions |
| Integration | Article search (FTS + vector), Category tree queries |
| API | Article CRUD with versioning, Category management, Feedback aggregation |

## Future Enhancements

- **AI Article Generator:** Auto-generate drafts from support ticket resolutions
- **Content Suggestions:** Identify knowledge gaps from search analytics
- **Article Embeddings:** Vector search for semantic matching
- **Multi-Language:** Content translation workflows
- **Rich Media:** Video embeds, image galleries, interactive guides
- **Content Scheduling:** Schedule publish/unpublish dates
- **PDF Export:** Generate PDF versions of articles
- **Article Clustering:** Topic clustering for better navigation
