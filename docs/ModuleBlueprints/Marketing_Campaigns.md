# Module Blueprint: Marketing Campaigns

- **Module:** `apps.campaign`
- **Bounded Context:** Marketing Automation & Campaign Management
- **Status:** Draft v1.0

## Business Purpose

The Marketing Campaigns module manages multi-channel marketing campaigns from planning through execution and analysis. It supports email campaigns, audience segmentation, lead nurturing, and ROI tracking.

## Bounded Context

This module owns Campaigns, Segments, Email Templates, and Campaign Analytics. It integrates with Lead Management (for nurture), Notification (for email/SMS delivery), and Integrations (for Mailchimp/HubSpot sync).

## Aggregates, Entities, Value Objects

### Aggregate: Campaign
- **Campaign** (Aggregate Root)
  - `id: UUID v7`
  - `tenant_id: UUID v7`
  - `name: str`
  - `description: Text`
  - `campaign_type: CampaignType`
  - `status: CampaignStatus`
  - `goal: CampaignGoal`
  - `target_value: Decimal | None` (target revenue)
  - `budget: Decimal | None`
  - `actual_cost: Decimal`
  - `start_date: DateTime`
  - `end_date: DateTime | None`
  - `owner_id: UUID v7`
  - `segment_id: UUID v7 | None`
  - `template_id: UUID v7 | None` (email template)
  - `channel_config: JSONB` (channel-specific settings)
  - `tracking_params: JSONB` (UTM tags, tracking pixels)
  - `timestamps: created_at, updated_at, launched_at, completed_at`

### Value Objects
- **CampaignType:** `enum(EMAIL, SMS, SOCIAL, WEBINAR, EVENT, DIRECT_MAIL, CONTENT, PAID_AD, MULTI_CHANNEL)`
- **CampaignStatus:** `enum(PLANNING, DRAFT, SCHEDULED, RUNNING, PAUSED, COMPLETED, CANCELLED)`
- **CampaignGoal:** `enum(AWARENESS, LEAD_GEN, NURTURE, CONVERSION, RETENTION, REACTIVATION, REFERRAL)`

### Entities
- **CampaignAudience** — Targeted leads/contacts for the campaign
- **CampaignMetric** — Performance metrics (sends, opens, clicks, conversions, revenue)
- **CampaignStep** — Multi-step nurture sequence
  - `id, campaign_id, step_order, delay_days, channel, template_id, condition`
- **EmailTemplate** — Reusable email templates
  - `id, tenant_id, name, subject, preheader, html_body, text_body, variables_schema, design_json`

### Aggregate: Segment
- **Segment** (Aggregate Root)
  - `id: UUID v7`
  - `tenant_id: UUID v7`
  - `name: str`
  - `description: Text`
  - `criteria: JSONB` (filter expression tree)
  - `estimated_count: int`
  - `is_dynamic: bool` (auto-updating vs static snapshot)
  - `source: SegmentSource` (leads, contacts, both)
  - `timestamps: created_at, updated_at, last_refreshed_at`

### Value Objects
- **SegmentSource:** `enum(LEADS, CONTACTS, BOTH, ACCOUNTS)`
- **SegmentCriteria:** Nested filter groups with AND/OR logic

## Domain Events

- `CampaignCreated`, `CampaignLaunched`, `CampaignPaused`, `CampaignCompleted`
- `CampaignMetricUpdated` — New metric recorded
- `SegmentCreated`, `SegmentRefreshed`
- `EmailSent`, `EmailOpened`, `EmailClicked`, `EmailBounced`, `EmailUnsubscribed`
- `StepCompleted` — Nurture step executed

## Commands & Queries

### Commands
- `CreateCampaign`, `UpdateCampaign`, `LaunchCampaign`, `PauseCampaign`
- `CompleteCampaign`, `CancelCampaign`
- `CreateSegment`, `UpdateSegment`, `RefreshSegment`, `DeleteSegment`
- `CreateEmailTemplate`, `UpdateEmailTemplate`, `DeleteEmailTemplate`
- `SendCampaign(campaign_id)` — Execute campaign send
- `ScheduleCampaign(campaign_id, launch_date)`
- `TestCampaign(campaign_id, test_emails)`
- `AddNurtureStep(campaign_id, step_config)`
- `RecordMetric(campaign_id, metric_type, value)`

### Queries
- `GetCampaign`, `ListCampaigns(filters, page)`
- `GetCampaignMetrics(campaign_id) -> aggregated stats`
- `GetCampaignROI(campaign_id) -> cost vs attributed revenue`
- `GetSegment(id)`, `ListSegments`, `GetSegmentPreview(segment_id) -> sample members`
- `GetEmailTemplate`, `ListEmailTemplates`
- `GetCampaignAnalytics(tenant_id, period) -> pipeline overview`

## Application Services

- `CampaignService` — Campaign lifecycle management
- `CampaignExecutionService` — Execute campaign sends via notification channels
- `SegmentService` — Segment definition, evaluation, refresh
- `SegmentEvaluator` — Execute segment criteria against database
- `EmailTemplateService` — Template design, variable rendering, testing
- `NurtureService` — Multi-step nurture sequence execution
- `CampaignAnalyticsService` — ROI computation, attribution, reporting

## API Endpoints

| Method | URL | Description |
|--------|-----|-------------|
| GET/POST | `/api/v1/marketing/campaigns/` | List/Create campaigns |
| GET/PUT/DELETE | `/api/v1/marketing/campaigns/{id}/` | Campaign CRUD |
| POST | `/api/v1/marketing/campaigns/{id}/launch/` | Launch campaign |
| POST | `/api/v1/marketing/campaigns/{id}/pause/` | Pause |
| POST | `/api/v1/marketing/campaigns/{id}/test/` | Send test |
| GET | `/api/v1/marketing/campaigns/{id}/metrics/` | Campaign metrics |
| GET | `/api/v1/marketing/campaigns/{id}/roi/` | ROI analysis |
| GET/POST | `/api/v1/marketing/segments/` | Segment CRUD |
| GET | `/api/v1/marketing/segments/{id}/preview/` | Sample members |
| POST | `/api/v1/marketing/segments/{id}/refresh/` | Refresh count |
| GET/POST | `/api/v1/marketing/templates/` | Email template CRUD |
| POST | `/api/v1/marketing/templates/{id}/render/` | Preview with variables |
| GET | `/api/v1/marketing/analytics/` | Campaign analytics dashboard |

## Database Tables

- `campaign_campaign` — Core campaigns
- `campaign_campaignaudience` — Audience snapshot
- `campaign_campaignmetric` — Performance metrics
- `campaign_campaignstep` — Nurture sequence steps
- `campaign_campaignmetriclog` — Time-series metric data
- `campaign_segment` — Segment definitions
- `campaign_segmentmember` — Cached segment membership (static segments)
- `campaign_emailtemplate` — Email template library

## Validation Rules

| Field | Rule |
|-------|------|
| campaign.start_date | Must be before end_date |
| segment.criteria | Must be valid expression tree |
| email_template.variables | Must match merge tag syntax |
| step.delay_days | Non-negative integer |
| campaign.status | Only DRAFT can be launched; only RUNNING can be paused |

## Security & Permissions

| Permission | Codename |
|------------|----------|
| View Campaign | `campaign.view_campaign` |
| Add Campaign | `campaign.add_campaign` |
| Change Campaign | `campaign.change_campaign` |
| Delete Campaign | `campaign.delete_campaign` |
| Launch Campaign | `campaign.launch_campaign` |
| View Segment | `campaign.view_segment` |
| Add Segment | `campaign.add_segment` |
| Change Segment | `campaign.change_segment` |
| Manage Templates | `campaign.manage_template` |
| View Analytics | `campaign.view_analytics` |

## Testing Strategy

| Layer | Focus |
|-------|-------|
| Unit | Segment criteria evaluation, Email template variable substitution, Campaign status state machine |
| Integration | Campaign execution flow, Segment refresh for dynamic segments, Metric aggregation |
| API | Full campaign lifecycle, Segment filter validation, Template rendering |

## Future Enhancements

- **A/B Testing:** Test subject lines, content, send times
- **Lead Scoring Integration:** Score changes from campaign interactions
- **Social Media Campaigns:** LinkedIn/Facebook ad integration
- **Automated Nurture:** Trigger-based drip campaigns
- **Attribution Models:** First-touch, last-touch, multi-touch attribution
- **Landing Pages:** Simple landing page builder with form capture
- **Unsubscribe Management:** Global and per-campaign unsubscribe
- **GDPR Consent:** Consent tracking and audit per contact
