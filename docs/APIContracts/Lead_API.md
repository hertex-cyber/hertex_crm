# Lead API — Lead Management Endpoints

Base URL: `/api/v1/leads/`

## Schema

### Lead Resource
```json
{
  "id": "018e0f52-6a7c-7b00-b000-000000000001",
  "type": "lead",
  "attributes": {
    "first_name": "John",
    "last_name": "Doe",
    "email": "john@acme.com",
    "phone": "+12025551234",
    "company_name": "Acme Corp",
    "job_title": "CTO",
    "lead_source": "WEBSITE",
    "lead_status": "NEW",
    "score": 0,
    "rating": "COLD",
    "owner_id": "018e0f52-...",
    "owner_name": "Jane Smith",
    "assigned_team_id": null,
    "converted_contact_id": null,
    "converted_account_id": null,
    "converted_opportunity_id": null,
    "custom_fields": {"industry": "Technology", "employee_count": 500},
    "tags": ["enterprise", "saas"],
    "notes": "Met at TechConf 2025",
    "last_contacted_at": null,
    "created_at": "2025-07-27T10:00:00Z",
    "updated_at": "2025-07-27T10:00:00Z",
    "converted_at": null
  },
  "relationships": {
    "owner": {
      "data": { "id": "018e0f52-...", "type": "user" },
      "links": { "self": "/api/v1/users/018e0f52-.../" }
    },
    "activities": {
      "links": { "self": "/api/v1/leads/018e0f52-.../timeline/" }
    }
  },
  "links": {
    "self": "/api/v1/leads/018e0f52-.../",
    "assign": "/api/v1/leads/018e0f52-.../assign/",
    "convert": "/api/v1/leads/018e0f52-.../convert/"
  }
}
```

## Endpoints

### List Leads

**GET** `/api/v1/leads/`

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `search` | string | Full-text search across name, email, company |
| `status` | string | Filter by status (NEW, CONTACTED, QUALIFIED, DISQUALIFIED, CONVERTED) |
| `source` | string | Filter by source (WEBSITE, REFERRAL, etc.) |
| `rating` | string | Filter by rating (HOT, WARM, COLD) |
| `owner_id` | UUID | Filter by assigned owner |
| `score__gte` | int | Minimum score |
| `score__lte` | int | Maximum score |
| `created_at__gte` | date | Created after |
| `created_at__lte` | date | Created before |
| `last_contacted_at__gte` | date | Last contacted after |
| `tags__contains` | string | Filter by tag |
| `sort` | string | Sort fields (e.g., `-score`, `created_at`, `last_name`) |
| `fields` | string | Comma-separated field selection |
| `cursor` | string | Pagination cursor |
| `limit` | int | Page size (max 100) |

**Response (200):**
```json
{
  "data": [
    { "...lead object..." },
    { "...lead object..." }
  ],
  "meta": {
    "pagination": {
      "next_cursor": "eyJpZCI6IjAxOGUwZjUy...",
      "prev_cursor": null,
      "has_next": true,
      "has_prev": false,
      "total_count": 1542,
      "limit": 25
    }
  },
  "included": [
    { "type": "user", "id": "018e0f52-...", "attributes": {"first_name": "Jane", "last_name": "Smith"} }
  ]
}
```

**Permissions:** `lead.view_lead`

---

### Create Lead

**POST** `/api/v1/leads/`

**Request:**
```json
{
  "first_name": "John",
  "last_name": "Doe",
  "email": "john@acme.com",
  "phone": "+12025551234",
  "company_name": "Acme Corp",
  "job_title": "CTO",
  "lead_source": "WEBSITE",
  "notes": "Met at conference",
  "tags": ["enterprise"],
  "custom_fields": {
    "industry": "Technology"
  }
}
```

**Response (201):** Lead resource with `"lead_status": "NEW"`, `"score": 0`.

**Permissions:** `lead.add_lead`

**Rate Limit:** 60/minute

---

### Get Lead

**GET** `/api/v1/leads/{id}/`

**Response (200):** Lead resource.

**Permissions:** `lead.view_lead`

---

### Update Lead (Full)

**PUT** `/api/v1/leads/{id}/`

Requires all required fields. Same schema as POST.

**Response (200):** Updated lead resource.

**Permissions:** `lead.change_lead`

---

### Update Lead (Partial)

**PATCH** `/api/v1/leads/{id}/`

Only send fields to update.

**Request:**
```json
{
  "first_name": "Jonathan",
  "phone": "+12025559999"
}
```

**Response (200):** Updated lead resource.

**Permissions:** `lead.change_lead`

---

### Delete Lead

**DELETE** `/api/v1/leads/{id}/`

Soft-deletes the lead (sets `is_deleted = True`, not removed from DB).

**Response (204):** No content.

**Permissions:** `lead.delete_lead`

---

### Assign Lead Owner

**POST** `/api/v1/leads/{id}/assign/`

**Request:**
```json
{
  "owner_id": "018e0f53-6a7c-7b00-b000-000000000010"
}
```

**Response (200):** Updated lead with new owner.

**Permissions:** `lead.assign_lead`

---

### Change Lead Status

**POST** `/api/v1/leads/{id}/status/`

**Request:**
```json
{
  "status": "QUALIFIED",
  "reason": "Completed discovery call, meets qualification criteria"
}
```

**Response (200):** Updated lead.

**Permissions:** `lead.change_leadstatus`

**Status Transition Validation:**
- `NEW → CONTACTED, DISQUALIFIED, JUNK`
- `CONTACTED → QUALIFIED, DISQUALIFIED, JUNK`
- `QUALIFIED → CONVERTED, DISQUALIFIED, JUNK`
- `CONVERTED` — Terminal state (no further transitions)
- `DISQUALIFIED → JUNK`
- `JUNK` — Terminal state

**Errors:** `409` (invalid transition), `422` (reason required for DISQUALIFIED)

---

### Score Lead

**POST** `/api/v1/leads/{id}/score/`

**Request:**
```json
{
  "score": 85,
  "rating": "HOT"
}
```

**Response (200):** Updated lead with new score and rating.

**Permissions:** `lead.score_lead`

**Validation:** Score 0-100. Rating auto-computed if not provided (0-30=Cold, 31-60=Warm, 61-100=Hot).

---

### Convert Lead

**POST** `/api/v1/leads/{id}/convert/`

Converts a QUALIFIED lead into Contact + Account + Opportunity.

**Request:**
```json
{
  "account_name": "Acme Corp",
  "opportunity_title": "Enterprise SaaS Deal",
  "opportunity_amount": 50000,
  "opportunity_pipeline_id": "018e0f54-...",
  "expected_close_date": "2025-10-01"
}
```

**Response (201):**
```json
{
  "data": {
    "id": "018e0f52-...",
    "type": "lead",
    "attributes": {
      "lead_status": "CONVERTED",
      "converted_contact_id": "018e0f55-...",
      "converted_account_id": "018e0f56-...",
      "converted_opportunity_id": "018e0f57-...",
      "converted_at": "2025-07-27T10:30:00Z"
    }
  },
  "meta": {
    "created_resources": {
      "contact_id": "018e0f55-...",
      "account_id": "018e0f56-...",
      "opportunity_id": "018e0f57-..."
    }
  }
}
```

**Permissions:** `lead.convert_lead`

**Errors:** `409` (lead not in QUALIFIED status), `409` (already converted)

---

### Merge Leads

**POST** `/api/v1/leads/{id}/merge/`

Merge duplicate leads into the primary lead.

**Request:**
```json
{
  "duplicate_ids": ["018e0f58-...", "018e0f59-..."],
  "field_preferences": {
    "email": "primary",
    "phone": "duplicate_1",
    "notes": "merge"
  }
}
```

**Response (200):** Updated primary lead with merged data. Duplicate leads soft-deleted.

**Permissions:** `lead.merge_lead`

---

### Get Lead Timeline

**GET** `/api/v1/leads/{id}/timeline/`

**Response (200):**
```json
{
  "data": [
    {
      "id": "act_018e0f60-...",
      "type": "activity",
      "attributes": {
        "activity_type": "NOTE",
        "description": "Called prospect, left voicemail",
        "created_by": "018e0f52-...",
        "created_at": "2025-07-27T11:00:00Z"
      }
    },
    {
      "id": "evt_018e0f61-...",
      "type": "status_change",
      "attributes": {
        "from_status": "NEW",
        "to_status": "CONTACTED",
        "changed_by": "018e0f52-...",
        "changed_at": "2025-07-27T10:30:00Z"
      }
    }
  ],
  "meta": {
    "pagination": {
      "has_next": false,
      "total_count": 12
    }
  }
}
```

**Permissions:** `lead.view_lead`

---

### Get Duplicates

**GET** `/api/v1/leads/{id}/duplicates/`

**Response (200):**
```json
{
  "data": [
    {
      "lead_id": "018e0f58-...",
      "first_name": "Jon",
      "last_name": "Doe",
      "email": "john@acme.com",
      "similarity_score": 0.95,
      "matched_on": ["email"]
    }
  ]
}
```

**Permissions:** `lead.view_lead`

---

### Bulk Assign

**POST** `/api/v1/leads/bulk-assign/`

**Request:**
```json
{
  "lead_ids": ["018e0f52-...", "018e0f53-...", "018e0f54-..."],
  "owner_id": "018e0f55-..."
}
```

**Response (200):**
```json
{
  "data": {
    "assigned_count": 3,
    "skipped_count": 0
  }
}
```

**Permissions:** `lead.assign_lead`

---

### Bulk Delete

**POST** `/api/v1/leads/bulk-delete/`

**Request:**
```json
{
  "lead_ids": ["018e0f52-...", "018e0f53-..."],
  "reason": "Bulk cleanup of junk leads"
}
```

**Response (200):**
```json
{
  "data": {
    "deleted_count": 2
  }
}
```

**Permissions:** `lead.delete_lead`

---

### Import Leads

**POST** `/api/v1/leads/import/`

**Content-Type:** `multipart/form-data`

| Field | Type | Description |
|-------|------|-------------|
| `file` | file | CSV or XLSX file |
| `field_mapping` | JSON | Map file columns to lead fields |
| `deduplicate` | boolean | Skip duplicates (default: true) |
| `notify_on_complete` | boolean | Email when import finishes |

**Response (202):**
```json
{
  "data": {
    "import_id": "imp_018e0f70-...",
    "status": "PROCESSING",
    "total_rows": 500,
    "estimated_time_seconds": 30
  }
}
```

Import runs asynchronously (Celery task). Status can be polled via `GET /api/v1/leads/imports/{import_id}/`.

**Permissions:** `lead.import_lead`

**Rate Limit:** 10 imports/hour per user.

---

### Export Leads

**GET** `/api/v1/leads/export/`

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `format` | string | `csv` (default) or `xlsx` |
| `filters` | JSON | Same filter params as list endpoint serialized |

**Response (200):** File download (Content-Disposition: attachment).

**Permissions:** `lead.export_lead`

---

### Lead Statistics

**GET** `/api/v1/leads/stats/`

**Response (200):**
```json
{
  "data": {
    "total": 1542,
    "by_status": {
      "NEW": 500,
      "CONTACTED": 400,
      "QUALIFIED": 300,
      "DISQUALIFIED": 200,
      "CONVERTED": 100,
      "JUNK": 42
    },
    "by_source": {
      "WEBSITE": 600,
      "REFERRAL": 300,
      "COLD_CALL": 200,
      "EVENT": 150,
      "PARTNER": 292
    },
    "by_rating": {
      "HOT": 150,
      "WARM": 400,
      "COLD": 992
    },
    "conversion_rate": 6.48,
    "avg_score": 42.5,
    "created_today": 12,
    "created_this_week": 85,
    "created_this_month": 350
  }
}
```

**Permissions:** `lead.view_lead`

---

## Rate Limits Summary

| Endpoint Group | Limit | Window |
|----------------|-------|--------|
| List/Create/Update | 60 | 1 min |
| Import | 10 | 1 hour |
| Export | 5 | 15 min |
| Bulk operations | 20 | 1 min |
| Stats | 30 | 1 min |

## Error Codes (Lead-specific)

| Code | HTTP | Description |
|------|------|-------------|
| `INVALID_STATUS_TRANSITION` | 409 | Status change not allowed |
| `LEAD_ALREADY_CONVERTED` | 409 | Lead is already converted |
| `LEAD_NOT_CONVERTIBLE` | 409 | Lead must be QUALIFIED to convert |
| `DUPLICATE_EMAIL` | 409 | Email already exists in tenant |
| `MERGE_CONFLICT` | 409 | Cannot merge leads from different tenants |
| `IMPORT_TOO_LARGE` | 422 | File exceeds 50MB limit |
| `IMPORT_INVALID_FORMAT` | 422 | Unsupported file format |
