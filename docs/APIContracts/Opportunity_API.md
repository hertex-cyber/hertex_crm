# Opportunity API — Pipeline & Opportunity Endpoints

Base URL: `/api/v1/opportunities/`

## Schema

### Opportunity Resource
```json
{
  "id": "018e0f52-6a7c-7b00-b000-000000000001",
  "type": "opportunity",
  "attributes": {
    "title": "Enterprise SaaS Platform Deal",
    "description": "Full suite implementation for Acme Corp",
    "pipeline_id": "018e0f53-...",
    "pipeline_name": "Default Sales Pipeline",
    "stage_id": "018e0f54-...",
    "stage_name": "Proposal",
    "stage_order": 3,
    "amount": "50000.00",
    "currency": "USD",
    "probability": 50,
    "expected_close_date": "2025-10-01",
    "actual_close_date": null,
    "contact_id": "018e0f55-...",
    "contact_name": "John Doe",
    "account_id": "018e0f56-...",
    "account_name": "Acme Corp",
    "lead_id": "018e0f57-...",
    "owner_id": "018e0f58-...",
    "owner_name": "Jane Smith",
    "deal_type": "NEW_BUSINESS",
    "loss_reason": null,
    "competitors": ["CompetitorX", "CompetitorY"],
    "custom_fields": {"contract_terms": 12, "implementation_months": 3},
    "tags": ["enterprise", "saas"],
    "notes": "Executive sponsor is CTO",
    "forecast_category": "BEST_CASE",
    "last_activity_at": "2025-07-26T14:00:00Z",
    "created_at": "2025-07-15T09:00:00Z",
    "updated_at": "2025-07-27T10:30:00Z",
    "closed_at": null
  },
  "relationships": {
    "owner": { "data": { "id": "018e0f58-...", "type": "user" } },
    "contact": { "data": { "id": "018e0f55-...", "type": "contact" } },
    "account": { "data": { "id": "018e0f56-...", "type": "account" } },
    "line_items": { "links": { "self": "/api/v1/opportunities/018e0f52-.../line-items/" } },
    "team": { "links": { "self": "/api/v1/opportunities/018e0f52-.../team/" } }
  },
  "links": {
    "self": "/api/v1/opportunities/018e0f52-.../",
    "stage": "/api/v1/opportunities/018e0f52-.../stage/",
    "won": "/api/v1/opportunities/018e0f52-.../won/",
    "lost": "/api/v1/opportunities/018e0f52-.../lost/"
  }
}
```

## Endpoints

### List Opportunities

**GET** `/api/v1/opportunities/`

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `search` | string | Full-text search across title, account, contact |
| `stage_id` | UUID | Filter by stage |
| `pipeline_id` | UUID | Filter by pipeline |
| `owner_id` | UUID | Filter by owner |
| `account_id` | UUID | Filter by account |
| `amount__gte` | decimal | Minimum amount |
| `amount__lte` | decimal | Maximum amount |
| `expected_close_date__gte` | date | Expected close after |
| `expected_close_date__lte` | date | Expected close before |
| `deal_type` | string | NEW_BUSINESS, RENEWAL, UPSELL, CROSS_SELL |
| `forecast_category` | string | COMMIT, BEST_CASE, PIPELINE, OMITTED |
| `tags__contains` | string | Filter by tag |
| `is_closed` | boolean | Filter open/closed deals |
| `sort` | string | Sort fields (e.g., `-amount`, `expected_close_date`) |
| `fields` | string | Comma-separated field selection |
| `cursor` | string | Pagination cursor |
| `limit` | int | Page size (max 100) |

**Response (200):** Paginated list of opportunity resources.

**Permissions:** `pipeline.view_opportunity`

---

### Create Opportunity

**POST** `/api/v1/opportunities/`

**Request:**
```json
{
  "title": "Enterprise SaaS Platform Deal",
  "description": "Full suite implementation for Acme Corp",
  "account_id": "018e0f56-...",
  "contact_id": "018e0f55-...",
  "pipeline_id": "018e0f53-...",
  "stage_id": "018e0f54-...",
  "amount": "50000.00",
  "currency": "USD",
  "expected_close_date": "2025-10-01",
  "deal_type": "NEW_BUSINESS",
  "competitors": ["CompetitorX"],
  "tags": ["enterprise"],
  "notes": "Initial meeting scheduled"
}
```

**Response (201):** Opportunity resource. Owner set to current user.

**Permissions:** `pipeline.add_opportunity`

---

### Get Opportunity

**GET** `/api/v1/opportunities/{id}/`

Returns opportunity with line items, team members, and recent activities included.

**Response (200):** Opportunity resource with included relationships.

**Permissions:** `pipeline.view_opportunity`

---

### Update Opportunity

**PUT** `/api/v1/opportunities/{id}/` — Full update.

**PATCH** `/api/v1/opportunities/{id}/` — Partial update.

**Response (200):** Updated opportunity resource.

**Permissions:** `pipeline.change_opportunity`

---

### Delete Opportunity

**DELETE** `/api/v1/opportunities/{id}/`

Soft-deletes the opportunity.

**Response (204):** No content.

**Permissions:** `pipeline.delete_opportunity`

---

### Move Stage

**POST** `/api/v1/opportunities/{id}/stage/`

Move opportunity to a new stage in the pipeline.

**Request:**
```json
{
  "stage_id": "018e0f60-6a7c-7b00-b000-000000000015",
  "reason": "Proposal sent to customer"
}
```

**Response (200):** Updated opportunity with new stage, probability, and stage fields.

**Permissions:** `pipeline.change_opportunity_stage`

**Validation:** Stage must belong to same pipeline. Must follow stage order (forward by one or backward by one).

---

### Win Opportunity

**POST** `/api/v1/opportunities/{id}/won/`

**Request:**
```json
{
  "close_date": "2025-09-15",
  "notes": "Signed contract after negotiation"
}
```

**Response (200):** Update opportunity with `Closed Won` stage, actual close date set.

**Permissions:** `pipeline.close_opportunity`

---

### Loss Opportunity

**POST** `/api/v1/opportunities/{id}/lost/`

**Request:**
```json
{
  "loss_reason": "PRICE",
  "close_date": "2025-08-01",
  "notes": "Customer chose cheaper competitor",
  "competitor_won": "CompetitorX"
}
```

**Response (200):** Updated opportunity with `Closed Lost` stage, loss reason recorded.

**Permissions:** `pipeline.close_opportunity`

**Validation:** `loss_reason` is required. Must be one of: `PRICE, COMPETITOR, FEATURE, TIMING, RELATIONSHIP, NO_DECISION, BUDGET, OTHER`.

---

### Reopen Opportunity

**POST** `/api/v1/opportunities/{id}/reopen/`

Reopen a Closed Lost opportunity.

**Response (200):** Opportunity moved to first stage of pipeline with new probabilities.

**Permissions:** `pipeline.change_opportunity`

---

### Assign Owner

**POST** `/api/v1/opportunities/{id}/assign/`

**Request:**
```json
{
  "owner_id": "018e0f58-...",
  "reason": "Territory reassignment"
}
```

**Response (200):** Updated opportunity with new owner.

**Permissions:** `pipeline.assign_opportunity`

---

### List Team Members

**GET** `/api/v1/opportunities/{id}/team/`

**Response (200):**
```json
{
  "data": [
    {
      "id": "tm_018e0f70-...",
      "type": "team_member",
      "attributes": {
        "user_id": "018e0f58-...",
        "user_name": "Jane Smith",
        "role": "EXECUTIVE_SPONSOR",
        "contribution_percentage": 30,
        "added_at": "2025-07-20T10:00:00Z"
      }
    }
  ]
}
```

### Add Team Member

**POST** `/api/v1/opportunities/{id}/team/`

**Request:**
```json
{
  "user_id": "018e0f59-...",
  "role": "TECHNICAL_CONSULTANT",
  "contribution_percentage": 20
}
```

**Response (201):** Team member resource.

### Remove Team Member

**DELETE** `/api/v1/opportunities/{id}/team/{user_id}/`

**Response (204):** No content.

**Permissions:** `pipeline.manage_opportunity_team`

---

### Line Items

**GET** `/api/v1/opportunities/{id}/line-items/` — List line items.

**POST** `/api/v1/opportunities/{id}/line-items/` — Add line item.

**Request:**
```json
{
  "product_id": "018e0f80-...",
  "product_name": "Enterprise License",
  "quantity": 1,
  "unit_price": "50000.00",
  "discount_percentage": 10,
  "description": "Annual enterprise license"
}
```

**Response (201):**
```json
{
  "data": {
    "id": "li_018e0f81-...",
    "type": "line_item",
    "attributes": {
      "product_id": "018e0f80-...",
      "product_name": "Enterprise License",
      "quantity": 1,
      "unit_price": "50000.00",
      "discount_percentage": 10,
      "discount_amount": "5000.00",
      "total_price": "45000.00",
      "description": "Annual enterprise license"
    }
  }
}
```

**PUT/DELETE** on `/api/v1/opportunities/{id}/line-items/{item_id}/` — Update/remove.

**Permissions:** `pipeline.change_opportunity`

---

### Opportunity Timeline

**GET** `/api/v1/opportunities/{id}/timeline/`

Returns chronological activities (stage changes, notes, calls, emails) for the opportunity.

---

## Pipeline Endpoints

### List Pipelines

**GET** `/api/v1/pipelines/`

**Response (200):**
```json
{
  "data": [
    {
      "id": "018e0f53-...",
      "type": "pipeline",
      "attributes": {
        "name": "Default Sales Pipeline",
        "description": "Standard B2B sales process",
        "is_default": true,
        "stages": [
          { "id": "...", "name": "Discovery", "order": 1, "probability": 10, "category": "LEAD" },
          { "id": "...", "name": "Qualification", "order": 2, "probability": 25, "category": "QUALIFIED" },
          { "id": "...", "name": "Proposal", "order": 3, "probability": 50, "category": "PROPOSAL" },
          { "id": "...", "name": "Negotiation", "order": 4, "probability": 75, "category": "NEGOTIATION" },
          { "id": "...", "name": "Closed Won", "order": 5, "probability": 100, "category": "CLOSED_WON" },
          { "id": "...", "name": "Closed Lost", "order": 6, "probability": 0, "category": "CLOSED_LOST" }
        ]
      }
    }
  ]
}
```

### Create Pipeline

**POST** `/api/v1/pipelines/`

**Request:**
```json
{
  "name": "Quick Sales Pipeline",
  "description": "Accelerated sales process",
  "stages": [
    { "name": "Contacted", "order": 1, "probability": 15, "category": "LEAD" },
    { "name": "Demo", "order": 2, "probability": 40, "category": "QUALIFIED" },
    { "name": "Proposal", "order": 3, "probability": 60, "category": "PROPOSAL" },
    { "name": "Negotiation", "order": 4, "probability": 80, "category": "NEGOTIATION" },
    { "name": "Closed Won", "order": 5, "probability": 100, "category": "CLOSED_WON" },
    { "name": "Closed Lost", "order": 6, "probability": 0, "category": "CLOSED_LOST" }
  ]
}
```

---

## Product Endpoints

**GET** `/api/v1/products/` — List products.
**POST** `/api/v1/products/` — Create product.
**GET** `/api/v1/products/{id}/` — Get product.

**Product Request/Response:**
```json
{
  "name": "Enterprise License",
  "description": "Annual enterprise SaaS license",
  "unit_price": "50000.00",
  "currency": "USD",
  "category": "SOFTWARE_LICENSE",
  "is_active": true
}
```

---

## Forecast Endpoints

### Get Forecast Summary

**GET** `/api/v1/forecasts/summary/`

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `period` | string | `YYYY-MM` format (default: current month) |
| `user_id` | UUID | Filter by user (default: current user) |

**Response (200):**
```json
{
  "data": {
    "period": "2025-08",
    "user_id": "018e0f58-...",
    "user_name": "Jane Smith",
    "quota": "100000.00",
    "commit_amount": "75000.00",
    "best_case_amount": "120000.00",
    "pipeline_amount": "250000.00",
    "weighted_amount": "87500.00",
    "gap_to_quota": "25000.00",
    "deals_in_commit": 3,
    "deals_in_pipeline": 8
  }
}
```

### Submit Forecast

**POST** `/api/v1/forecasts/`

**Request:**
```json
{
  "period": "2025-08",
  "commit_amount": "75000.00",
  "best_case_amount": "120000.00",
  "notes": "Feeling confident about the Acme deal closing this month"
}
```

**Response (201):** Forecast resource.

---

## Report Endpoints

### Pipeline Report

**GET** `/api/v1/reports/pipeline/`

**Query Parameters:** `pipeline_id`, `owner_id`, `period_start`, `period_end`

**Response (200):**
```json
{
  "data": {
    "total_pipeline_value": "250000.00",
    "weighted_pipeline": "87500.00",
    "by_stage": [
      { "stage_id": "...", "stage_name": "Discovery", "count": 5, "value": "50000.00" },
      { "stage_id": "...", "stage_name": "Proposal", "count": 3, "value": "200000.00" }
    ],
    "conversion_rates": [
      { "from_stage": "Discovery", "to_stage": "Qualification", "rate": 0.6 }
    ]
  }
}
```

### Win/Loss Analysis

**GET** `/api/v1/reports/won-loss/`

**Query Parameters:** `start_date`, `end_date`, `group_by` (owner, deal_type, loss_reason)

**Response (200):**
```json
{
  "data": {
    "total_won": 25,
    "total_lost": 15,
    "win_rate": 62.5,
    "total_revenue": "1250000.00",
    "lost_revenue": "750000.00",
    "avg_deal_size_won": "50000.00",
    "avg_sales_cycle_won": 45,
    "by_reason": {
      "PRICE": 5,
      "COMPETITOR": 4,
      "FEATURE": 3,
      "BUDGET": 2,
      "OTHER": 1
    }
  }
}
```

---

## Rate Limits

| Endpoint Group | Limit | Window |
|----------------|-------|--------|
| Opportunity CRUD | 60 | 1 min |
| Stage transitions | 30 | 1 min |
| Forecast | 20 | 1 min |
| Reports | 10 | 1 min |
| Pipeline management | 30 | 1 min |
| Products | 60 | 1 min |

## Error Codes (Opportunity-specific)

| Code | HTTP | Description |
|------|------|-------------|
| `INVALID_STAGE_TRANSITION` | 409 | Stage movement violates pipeline rules |
| `OPPORTUNITY_ALREADY_CLOSED` | 409 | Can't modify a closed opportunity |
| `OPPORTUNITY_NOT_CLOSED` | 409 | Must close before reopening |
| `INVALID_LOSS_REASON` | 422 | Loss reason required for closed lost |
| `STAGE_NOT_IN_PIPELINE` | 422 | Stage doesn't belong to specified pipeline |
| `FORECAST_PERIOD_CLOSED` | 409 | Forecast period is frozen |
| `FORECAST_ALREADY_SUBMITTED` | 409 | Forecast for period already submitted (use PUT to update) |
