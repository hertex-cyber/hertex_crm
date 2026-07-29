# TZAHU CRM — RAG Architecture

> **Version:** 0.1.0-draft
> **Last Updated:** 2026-07-27
> **Status:** Foundational Design Phase
> **Owner:** Platform Architecture Team

---

## Table of Contents

1. [Overview](#1-overview)
2. [Document Pipeline](#2-document-pipeline)
3. [Retrieval](#3-retrieval)
4. [Generation](#4-generation)
5. [Knowledge Base](#5-knowledge-base)
6. [Chunk Strategies](#6-chunk-strategies)
7. [Embedding Models](#7-embedding-models)
8. [RLS on Vectors](#8-rls-on-vectors)
9. [Performance](#9-performance)
10. [Monitoring](#10-monitoring)

---

## 1. Overview

The Retrieval-Augmented Generation (RAG) system enables AI-powered question answering over organizational documents. Users upload documents, which are parsed, chunked, embedded, and indexed in pgvector. When a user asks a question, the system retrieves relevant chunks via hybrid search, re-ranks them, and generates an answer with citations.

### 1.1 RAG Flow

```
Upload ──► Parse ──► Chunk ──► Embed ──► Index (pgvector)
                                         │
Query ──► Embed ──► Hybrid Search ──► Re-rank ──► LLM Generate ──► Answer + Citations
```

### 1.2 Architecture Principles

- **Tenant-isolated**: RLS on vector table ensures no cross-org data leakage
- **Hybrid search**: Vector similarity + keyword (BM25 via pg_trgm) for best results
- **Explainable**: Answers include source citations and confidence scores
- **Incremental**: Documents are processed incrementally; no full re-index needed
- **Observable**: Every query is logged with precision, recall, and latency

---

## 2. Document Pipeline

### 2.1 Upload Flow

```
Client ──► Django API ──► MinIO ──► Celery (parse_chunk_embed)
                                    │
                                    ▼
                              Parse Document
                              (unstructured.io / pdfminer / beautifulsoup)
                                    │
                                    ▼
                              Chunk Text
                              (RecursiveCharacterTextSplitter)
                                    │
                                    ▼
                              Generate Embeddings
                              (text-embedding-3-small)
                                    │
                                    ▼
                              Store in pgvector
                                    │
                                    ▼
                              Update Knowledge Base Index
```

### 2.2 Parser Selection

| File Type | Parser | Notes |
|-----------|--------|-------|
| PDF | `unstructured.PDFParser` + `pdfminer.six` | Table extraction via Camelot |
| DOCX | `unstructured.DocxParser` | Handles headers, lists, tables |
| HTML | `beautifulsoup4` | Strips tags, extracts headings |
| TXT | Raw text | UTF-8 encoded |
| CSV | `pandas` + custom parser | Row-as-chunk strategy |
| Markdown | `markdown` + custom parser | Preserves heading hierarchy |
| EML/MSG | `extract_msg` | Email thread parsing |
| Images (OCR) | `pytesseract` + `pdf2image` | OCR pipeline (enterprise tier) |

### 2.3 Chunking Configuration

```python
text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=512,       # Target chunk size in tokens
    chunk_overlap=128,    # Overlap between chunks (context preservation)
    length_function=tiktoken_len,  # Token-aware splitting (cl100k_base)
    separators=[
        "\n\n",           # Paragraph break
        "\n",             # Line break
        ". ",             # Sentence break
        "! ",             # Sentence break
        "? ",             # Sentence break
        "; ",             # Clause break
        ", ",             # Clause break
        " ",              # Word break (last resort)
        "",               # Character break (rare)
    ],
)
```

### 2.4 Chunk Metadata

Each chunk stores:

```json
{
  "chunk_id": "uuid",
  "document_id": "uuid",
  "organization_id": "uuid",
  "content": "The actual text content...",
  "embedding": [0.001, -0.023, ...],  // 1536-dim vector
  "metadata": {
    "page_number": 5,
    "section": "Installation Guide",
    "heading": "System Requirements",
    "chunk_index": 23,
    "total_chunks": 45,
    "tokens": 498,
    "file_type": "pdf",
    "created_at": "2026-07-27T10:30:00Z"
  },
  "search_vector": null  // tsvector for hybrid search
}
```

### 2.5 Document Processing Queue

```python
@celery.task(queue="ai_documents", bind=True, max_retries=3)
def process_document(self, document_id: UUID):
    doc = DocumentService.get(document_id)
    doc.status = "processing"
    doc.save()

    try:
        # 1. Parse
        raw_text, metadata = parse_document(doc.file_path, doc.file_type)

        # 2. Chunk
        chunks = chunk_text(raw_text, strategy=doc.chunk_strategy, metadata=metadata)

        # 3. Embed (batch)
        embeddings = embed_service.embed_chunks([c.content for c in chunks])

        # 4. Store
        for chunk, embedding in zip(chunks, embeddings):
            VectorStore.store(chunk, embedding, organization_id=doc.organization_id)

        # 5. Update status
        doc.status = "indexed"
        doc.chunk_count = len(chunks)
        doc.save()

    except Exception as e:
        doc.status = "failed"
        doc.error = str(e)
        doc.save()
        raise self.retry(exc=e, countdown=60 * (2 ** self.request.retries))
```

---

## 3. Retrieval

### 3.1 Hybrid Search

```python
class HybridSearch:
    """Hybrid search combining vector similarity and keyword search."""

    VECTOR_WEIGHT = 0.7   # Cosine similarity weight
    KEYWORD_WEIGHT = 0.3  # pg_trgm similarity weight

    async def search(
        self,
        query: str,
        organization_id: UUID,
        top_k: int = 20,
        filters: dict | None = None,
    ) -> list[SearchResult]:
        # 1. Embed query
        query_embedding = await embed_service.embed(query)

        # 2. Vector search (cosine similarity)
        vector_results = await self._vector_search(
            query_embedding, organization_id, top_k=top_k * 2, filters=filters
        )

        # 3. Keyword search (pg_trgm)
        keyword_results = await self._keyword_search(
            query, organization_id, top_k=top_k * 2, filters=filters
        )

        # 4. Hybrid fusion (Reciprocal Rank Fusion)
        fused = self._rrf_fusion(vector_results, keyword_results, k=60)
        return fused[:top_k]

    def _rrf_fusion(
        self,
        vector_results: list[SearchResult],
        keyword_results: list[SearchResult],
        k: int = 60,
    ) -> list[SearchResult]:
        scores = {}
        for rank, result in enumerate(vector_results):
            scores[result.chunk_id] = scores.get(result.chunk_id, 0) + 1 / (k + rank + 1)
        for rank, result in enumerate(keyword_results):
            scores[result.chunk_id] = scores.get(result.chunk_id, 0) + 1 / (k + rank + 1)
        return sorted(
            [r for r in vector_results + keyword_results if r.chunk_id in scores],
            key=lambda r: scores[r.chunk_id],
            reverse=True,
        )
```

### 3.2 SQL Query

```sql
-- Vector search (cosine similarity)
SELECT chunk_id, content, metadata,
       1 - (embedding <=> :query_embedding) AS similarity
FROM rag_vectors
WHERE organization_id = :org_id
ORDER BY embedding <=> :query_embedding
LIMIT :top_k;

-- Keyword search (pg_trgm)
SELECT chunk_id, content, metadata,
       similarity(content, :query) AS similarity
FROM rag_vectors
WHERE organization_id = :org_id
  AND content % :query  -- Trigram similarity threshold
ORDER BY similarity DESC
LIMIT :top_k;

-- Hybrid (combined query - simplified)
-- Full hybrid is done in application layer with RRF
```

### 3.3 Cross-Encoder Re-Ranker

Top-20 results from hybrid search are re-ranked with a cross-encoder model for improved accuracy:

```python
class CrossEncoderReRanker:
    """Re-ranks results using a cross-encoder model."""

    MODEL_NAME = "cross-encoder/ms-marco-MiniLM-L-6-v2"

    def __init__(self):
        self.model = CrossEncoder(self.MODEL_NAME)

    async def rerank(
        self,
        query: str,
        candidates: list[SearchResult],
        top_k: int = 5,
    ) -> list[SearchResult]:
        pairs = [(query, c.content) for c in candidates]
        scores = self.model.predict(pairs)

        for result, score in zip(candidates, scores):
            result.relevance_score = float(score)

        candidates.sort(key=lambda r: r.relevance_score, reverse=True)
        return candidates[:top_k]
```

### 3.4 Tenant-Scoped Retrieval

Every search query is scoped to an organization using RLS:

```sql
-- RLS policy on rag_vectors
CREATE POLICY tenant_isolation_rag_vectors ON rag_vectors
    FOR ALL
    USING (organization_id = current_setting('app.current_organization_id')::uuid);

ALTER TABLE rag_vectors FORCE ROW LEVEL SECURITY;
```

---

## 4. Generation

### 4.1 RAG Generation Pipeline

```python
class RAGGenerator:
    """Generate answers from retrieved context."""

    async def generate(
        self,
        query: str,
        organization_id: UUID,
        user_id: UUID | None = None,
    ) -> RAGResponse:
        # 1. Retrieve
        retrieved = await self.hybrid_search.search(query, organization_id)
        if not retrieved:
            return RAGResponse(
                answer="I couldn't find relevant information in your knowledge base.",
                citations=[],
                confidence=0.0,
            )

        # 2. Re-rank
        top_chunks = await self.reranker.rerank(query, retrieved, top_k=5)

        # 3. Build context
        context = self._build_context(top_chunks)

        # 4. Generate
        prompt = self.prompt_manager.render("rag_generation", {
            "query": query,
            "context": context,
        })
        response = await self.llm.chat_completion(
            messages=[{"role": "system", "content": prompt}],
            model="gpt-4o",
            temperature=0.3,
        )

        # 5. Parse response
        return self._parse_response(response, top_chunks)

    def _build_context(self, chunks: list[SearchResult]) -> str:
        parts = []
        for i, chunk in enumerate(chunks, 1):
            source = chunk.metadata.get("document_name", "Unknown")
            page = chunk.metadata.get("page_number")
            source_str = f"[{i}] Source: {source}" + (f", Page {page}" if page else "")
            parts.append(f"{source_str}\n{chunk.content}\n")
        return "\n---\n".join(parts)
```

### 4.2 Generation Prompt

```
You are a helpful AI assistant with access to the organization's knowledge base.
Answer the user's question based ONLY on the provided context.
If the context doesn't contain enough information, say so.

Context:
[1] Source: Employee Handbook.pdf, Page 12
Our remote work policy requires employees to work from home at least 3 days per week...

[2] Source: Benefits Guide.docx
Health insurance coverage includes medical, dental, and vision...

Question: What is the remote work policy?

Instructions:
1. Answer using only the provided context
2. Cite sources using [1], [2] notation
3. If the context is insufficient, say "I cannot find information about..."
4. Be concise and accurate
5. Do not make up information
```

### 4.3 Citation Generation

```json
{
  "answer": "Our remote work policy requires employees to work from home at least 3 days per week [1]. Health insurance benefits include medical, dental, and vision coverage [2].",
  "citations": [
    {
      "id": 1,
      "document_name": "Employee Handbook.pdf",
      "page": 12,
      "chunk_id": "uuid",
      "text": "Our remote work policy requires employees to work from home at least 3 days per week...",
      "relevance_score": 0.92
    },
    {
      "id": 2,
      "document_name": "Benefits Guide.docx",
      "chunk_id": "uuid",
      "text": "Health insurance coverage includes medical, dental, and vision...",
      "relevance_score": 0.85
    }
  ],
  "confidence": 0.88
}
```

---

## 5. Knowledge Base

### 5.1 Schema

```sql
CREATE TABLE rag_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    organization_id UUID NOT NULL,
    collection_id UUID REFERENCES rag_collections(id),
    name VARCHAR(512) NOT NULL,
    file_type VARCHAR(20) NOT NULL,  -- pdf, docx, html, txt, csv, md
    file_path VARCHAR(1024) NOT NULL,  -- MinIO path
    file_size BIGINT NOT NULL,
    chunk_count INT DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending, processing, indexed, failed
    error TEXT,
    metadata JSONB DEFAULT '{}',
    version INT NOT NULL DEFAULT 1,
    uploaded_by_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE rag_collections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    organization_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    access_control VARCHAR(20) DEFAULT 'org',  -- org, role, user
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE rag_vectors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    organization_id UUID NOT NULL,
    document_id UUID NOT NULL REFERENCES rag_documents(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    embedding vector(1536),
    search_vector tsvector,  -- For keyword search
    metadata JSONB DEFAULT '{}',
    token_count INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_rag_vectors_org ON rag_vectors(organization_id);
CREATE INDEX idx_rag_vectors_doc ON rag_vectors(document_id);
CREATE INDEX idx_rag_vectors_embedding ON rag_vectors
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_rag_vectors_search ON rag_vectors USING GIN(search_vector);
CREATE INDEX idx_rag_docs_org ON rag_documents(organization_id, collection_id);
```

### 5.2 Access Control

| Collection Type | Access Scope | Description |
|----------------|-------------|-------------|
| `org` | All org members | Company-wide knowledge base |
| `role` | Users with specific role | Only admins and managers |
| `user` | Specific users | Personal document collections |

### 5.3 Supported Formats

| Format | Max Size | Pages (PDF) | Notes |
|--------|----------|-------------|-------|
| PDF | 50 MB | 500 | Table extraction, OCR (enterprise) |
| DOCX | 25 MB | N/A | Tracked changes flattened |
| HTML | 10 MB | N/A | Preserves heading hierarchy |
| TXT | 5 MB | N/A | UTF-8, auto-detect encoding |
| CSV | 25 MB | N/A | Row-as-chunk, header-as-metadata |

---

## 6. Chunk Strategies

### 6.1 Strategy Comparison

| Strategy | Description | Best For |
|----------|-------------|----------|
| `fixed_size` | Split by exact token count | Uniform documents |
| `recursive` | Split by separators recursively | General purpose (default) |
| `semantic` | LLM-based topic boundary detection | Complex documents |
| `document_aware` | Respect document structure (headings, pages) | PDFs, DOCX |
| `sentence` | Split at sentence boundaries | Legal documents |
| `paragraph` | Split at paragraph boundaries | Articles, blog posts |

### 6.2 Semantic Chunking

```python
class SemanticChunker:
    """LLM-based semantic chunking for topic boundary detection."""

    async def chunk(self, text: str, max_chunk_size: int = 512) -> list[Chunk]:
        paragraphs = text.split("\n\n")
        chunks = []
        current_chunk = []
        current_tokens = 0

        for para in paragraphs:
            para_tokens = count_tokens(para)
            if current_tokens + para_tokens > max_chunk_size and current_chunk:
                # Check if this is a good boundary
                if await self._is_semantic_boundary(current_chunk[-1], para):
                    chunks.append(self._create_chunk(current_chunk))
                    current_chunk = []
                    current_tokens = 0
            current_chunk.append(para)
            current_tokens += para_tokens

        if current_chunk:
            chunks.append(self._create_chunk(current_chunk))
        return chunks

    async def _is_semantic_boundary(self, para1: str, para2: str) -> bool:
        """Use LLM to check if this is a good chunk boundary."""
        prompt = f"Are these paragraphs about different topics? (yes/no)\n\n{para1}\n\n{para2}"
        result = await self.llm.complete(prompt, max_tokens=5, temperature=0)
        return "yes" in result.lower()
```

---

## 7. Embedding Models

### 7.1 Model Abstraction

```python
class EmbeddingProvider(ABC):
    """Abstract interface for embedding models."""

    @abstractmethod
    async def embed(self, text: str) -> list[float]: ...

    @abstractmethod
    async def embed_batch(self, texts: list[str]) -> list[list[float]]: ...

    @abstractmethod
    async def embed_dimension(self) -> int: ...

    @property
    @abstractmethod
    def model_name(self) -> str: ...


class OpenAIEmbeddingProvider(EmbeddingProvider):
    def __init__(self, model: str = "text-embedding-3-small"):
        self.model = model
        self.client = AsyncOpenAI()

    async def embed(self, text: str) -> list[float]:
        response = await self.client.embeddings.create(
            model=self.model,
            input=text,
        )
        return response.data[0].embedding

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        response = await self.client.embeddings.create(
            model=self.model,
            input=texts,
        )
        return [d.embedding for d in response.data]

    @property
    def embed_dimension(self) -> int:
        return 1536 if "small" in self.model else 3072

    @property
    def model_name(self) -> str:
        return self.model
```

### 7.2 Model Configuration

```yaml
embedding:
  default_model: text-embedding-3-small
  dimension: 1536
  batch_size: 20  # Max texts per API call
  rate_limit: 3000  # RPM
  cache:
    enabled: true
    ttl_seconds: 86400  # 24 hours
    max_size: 10000  # Max cached embeddings

  models:
    text-embedding-3-small:
      dimension: 1536
      cost_per_1k: $0.00002
      performance: fast
    text-embedding-3-large:
      dimension: 3072
      cost_per_1k: $0.00013
      performance: best
    int8-multilingual-v2:  # Self-hosted option
      dimension: 768
      endpoint: http://embedding-service:8001/embed
      performance: fast
```

### 7.3 Batch Embedding

```python
class BatchEmbeddingService:
    """Batch embedding with rate limiting and caching."""

    def __init__(self, provider: EmbeddingProvider, cache: CacheService):
        self.provider = provider
        self.cache = cache
        self.batch_size = 20
        self.semaphore = asyncio.Semaphore(10)  # Max 10 concurrent batches

    async def embed_batch(self, chunks: list[Chunk]) -> list[list[float]]:
        results = [None] * len(chunks)
        uncached_indices = []
        uncached_texts = []

        # Check cache
        for i, chunk in enumerate(chunks):
            cached = await self.cache.get(f"embed:{hash(chunk.content)}")
            if cached:
                results[i] = cached
            else:
                uncached_indices.append(i)
                uncached_texts.append(chunk.content)

        # Embed uncached in batches
        for batch_start in range(0, len(uncached_texts), self.batch_size):
            batch = uncached_texts[batch_start:batch_start + self.batch_size]
            async with self.semaphore:
                embeddings = await self.provider.embed_batch(batch)
            for i, emb in enumerate(embeddings):
                idx = uncached_indices[batch_start + i]
                results[idx] = emb
                await self.cache.set(f"embed:{hash(batch[i])}", emb, timeout=86400)

        return results
```

### 7.4 Incremental Updates

When a document is re-uploaded (new version):
1. Mark old chunks as `superseded` (not deleted — still available for queries on old document versions)
2. Process new document (parse → chunk → embed)
3. Update document version reference
4. Query routing uses document version to determine which chunks to search

---

## 8. RLS on Vectors

### 8.1 RLS Implementation

```sql
-- 1. Enable RLS on the vector table
ALTER TABLE rag_vectors ENABLE ROW LEVEL SECURITY;

-- 2. Create tenant isolation policy
CREATE POLICY tenant_isolation_rag_vectors ON rag_vectors
    FOR ALL
    USING (organization_id = current_setting('app.current_organization_id')::uuid);

-- 3. Force RLS (affects all users including table owner)
ALTER TABLE rag_vectors FORCE ROW LEVEL SECURITY;

-- 4. Application sets context
-- In Django middleware:
--     from django.db import connection
--     with connection.cursor() as cursor:
--         cursor.execute("SET app.current_organization_id = %s", [org_id])

-- 5. Index with RLS consideration
-- The IVFFlat index on embedding column works correctly with RLS
-- Postgres checks RLS after index scan, filtering out non-matching rows
CREATE INDEX idx_rag_vectors_embedding ON rag_vectors
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)
    WHERE organization_id IS NOT NULL;  -- Partial index hint for RLS
```

### 8.2 Vector Table Design

```sql
CREATE TABLE rag_vectors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    organization_id UUID NOT NULL,      -- Tenant column for RLS
    document_id UUID NOT NULL REFERENCES rag_documents(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    embedding vector(1536),
    search_vector tsvector,
    metadata JSONB DEFAULT '{}',
    token_count INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_organization
        FOREIGN KEY (organization_id)
        REFERENCES organization_organizations(id)
);
```

### 8.3 Tenant Isolation Guarantees

- **Application layer**: Repository pattern enforces `.filter(organization_id=...)`
- **Database layer**: RLS is the last line of defense
- **Even if** a raw SQL query omits the organization filter, RLS returns empty results
- **Even if** a bug in the application code forgets to scope, RLS prevents data leakage

---

## 9. Performance

### 9.1 Index Strategy

```sql
-- For up to 1M vectors: IVFFlat
CREATE INDEX idx_rag_vectors_ivfflat ON rag_vectors
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- For 1M-10M vectors: HNSW
CREATE INDEX idx_rag_vectors_hnsw ON rag_vectors
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 200);

-- For >10M vectors: Consider partitioning or dedicated vector DB
```

Index tuning:

| Vectors | Index Type | lists (IVFFlat) | m / ef_construction (HNSW) | Recall |
|---------|-----------|-----------------|---------------------------|--------|
| < 100K | IVFFlat | 20 | N/A | 0.95 |
| 100K - 1M | IVFFlat | 100 | N/A | 0.98 |
| 1M - 10M | HNSW | N/A | 16 / 200 | 0.99 |
| > 10M | HNSW | N/A | 32 / 400 | 0.99 |

### 9.2 Caching

```python
class RAGCache:
    """Multi-level caching for RAG queries."""

    def __init__(self, redis_client):
        self.redis = redis_client
        self.ttl = {
            "embedding": 86400,    # 24 hours
            "query_result": 3600,  # 1 hour (identical queries)
            "popular_docs": 300,   # 5 min (frequently accessed docs)
        }

    async def get_or_compute(
        self,
        query: str,
        org_id: str,
        compute_fn: Callable,
    ) -> RAGResponse:
        cache_key = f"rag:{org_id}:{hash(query)}"
        cached = await self.redis.get(cache_key)
        if cached:
            return RAGResponse.from_json(cached)

        result = await compute_fn()
        if result.confidence > 0.9:  # Only cache high-confidence results
            await self.redis.setex(cache_key, self.ttl["query_result"], result.to_json())
        return result
```

### 9.3 Performance Budget

| Operation | Target p95 | Target p99 |
|-----------|-----------|------------|
| Document parse + chunk | 5s per 100 pages | 10s per 100 pages |
| Embedding (batch of 20) | 500ms | 1s |
| Hybrid search | 200ms | 500ms |
| Re-ranking (top 20) | 100ms | 200ms |
| LLM generation | 1s | 2s |
| End-to-end query | 2s | 3s |

---

## 10. Monitoring

### 10.1 Key Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `rag_queries_total` | Counter | Total RAG queries by org |
| `rag_query_duration_ms` | Histogram | Query latency distribution |
| `rag_retrieval_precision` | Gauge | Precision@5 for retrieval |
| `rag_retrieval_recall` | Gauge | Recall@10 for retrieval |
| `rag_cache_hit_ratio` | Gauge | Cache hit rate |
| `rag_documents_indexed` | Counter | Documents processed |
| `rag_embedding_freshness` | Gauge | Hours since last embedding update |
| `rag_vectors_total` | Gauge | Total vectors stored |
| `rag_chunk_size_tokens` | Histogram | Distribution of chunk sizes |

### 10.2 Retrieval Quality Monitoring

```python
class RetrievalQualityMonitor:
    """Monitor retrieval precision and recall over time."""

    def log_query(
        self,
        query: str,
        retrieved_chunks: list[SearchResult],
        clicked_chunks: list[str],  # User feedback
        relevant_chunks: list[str] | None = None,  # From labeled dataset
    ):
        if relevant_chunks:
            retrieved_ids = [c.chunk_id for c in retrieved_chunks]
            relevant_set = set(relevant_chunks)
            retrieved_set = set(retrieved_ids)

            precision = len(retrieved_set & relevant_set) / max(len(retrieved_set), 1)
            recall = len(retrieved_set & relevant_set) / max(len(relevant_set), 1)

            metrics.rag_retrieval_precision.observe(precision)
            metrics.rag_retrieval_recall.observe(recall)

        # Track user feedback (implicit: did they click?)
        if clicked_chunks:
            click_rate = len(clicked_chunks) / max(len(retrieved_chunks), 1)
            metrics.rag_click_through_rate.observe(click_rate)
```

### 10.3 Alerts

| Alert | Condition | Severity |
|-------|-----------|----------|
| Retrieval precision drop | Precision@5 < 0.7 over 1h | Warning |
| High latency | p95 > 3s over 5 min | Critical |
| Cache miss spike | Cache hit ratio < 0.5 over 10 min | Warning |
| Embedding failure | > 10% embedding errors over 5 min | Critical |
| Index stale | Last embedding update > 24h ago | Info |
| Storage threshold | pgvector table > 80% of budgeted storage | Warning |
