# Module Blueprint: Pipeline & Opportunity Management

- **Module:** `modules.pipeline`
- **Bounded Context:** Sales Pipeline & Deal Management
- **Status:** Draft v1.0

## Business Purpose

The Pipeline & Opportunity module manages the sales pipeline from qualified lead through deal closure. It tracks opportunities through configurable stages, supports team selling, provides forecasting, and captures win/loss analysis. This is the core revenue-tracking module of the CRM.

## Bounded Context

This module owns Opportunities, Pipelines (stage definitions), Products, Quotes, and Forecasts. It depends on Lead Management (for converted leads) and Identity (for users/teams). It does NOT own billing/invoicing or order fulfillment (future modules).

## Aggregates, Entities, Value Objects

### Aggregate: Pipeline
- **Pipeline** (Aggregate Root)
  - `id: UUID v7`
  - `tenant_id: UUID v7`
  - `name: str`
  - `description: Text`
  - `is_default: bool`
  - `stages: List[PipelineStage]` (ordered)
  - `timestamps: created_at, updated_at`

### Entity: PipelineStage
- `id: UUID v7`
- `pipeline_id: FK`
- `name: str` (e.g., "Discovery", "Proposal", "Negotiation")
- `order: int`
- `probability: Decimal 0-100` (e.g., Discovery=10%, Proposal=50%)
- `category: StageCategory` (enum: `LEAD, QUALIFIED, PROPOSAL, NEGOTIATION, CLOSED_WON, CLOSED_LOST`)
- `is_active: bool`

### Aggregate: Opportunity
- **Opportunity** (Aggregate Root)
  - `id: UUID v7`
  - `tenant_id: UUID v7`
  - `title: str`
  - `description: Text`
  - `pipeline_id: FK(Pipeline)`
  - `stage_id: FK(PipelineStage)`
  - `amount: Decimal (currencified)`
  - `currency: str (ISO 4217, default USD)`
  - `probability: Decimal 0-100 (inherited from stage, can be overridden)`
  - `expected_close_date: Date`
  - `actual_close_date: Date | None`
  - `contact_id: FK(Contact) | None`
  - `account_id: FK(Account)`
  - `lead_id: FK(Lead) | None` (source lead if converted)
  - `owner_id: FK(User)`
  - `deal_type: DealType (enum: NEW_BUSINESS, RENEWAL, UPSELL, CROSS_SELL)`
  - `loss_reason: LossReason | None` (if CLOSED_LOST)
  - `competitors: Array[str]`
  - `custom_fields: JSONB`
  - `tags: Array[str]`
  - `notes: Text`
  - `timestamps: created_at, updated_at, closed_at`

### Value Objects
- **StageCategory:** `enum(LEAD, QUALIFIED, PROPOSAL, NEGOTIATION, CLOSED_WON, CLOSED_LOST)`
- **DealType:** `enum(NEW_BUSINESS, RENEWAL, UPSELL, CROSS_SELL)`
- **LossReason:** `enum(PRICE, COMPETITOR, FEATURE, TIMING, RELATIONSHIP, NO_DECISION, BUDGET, OTHER)`
- **ForecastCategory:** `enum(COMMIT, BEST_CASE, PIPELINE, OMITTED)`
- **ProductCategory:** `str (tenant-defined)`

### Entities (sub-entities of Opportunity)
- **OpportunityLineItem:** Products/Services in the deal
  - `product_id, product_name, quantity, unit_price, discount, total_price`
- **OpportunityTeamMember:** Team selling participants
  - `user_id, role, contribution_percentage`
- **OpportunityActivity:** Log of deal-related activities
- **OpportunityCompetitor:** Tracked competitors in the deal

### Aggregate: Product
- **Product**
  - `id: UUID v7`
  - `tenant_id: UUID v7`
  - `name: str`
  - `description: Text`
  - `unit_price: Decimal`
  - `currency: str`
  - `category: str`
  - `is_active: bool`
  - `custom_fields: JSONB`

### Aggregate: Forecast
- **Forecast** (period snapshot)
  - `id: UUID v7`
  - `tenant_id: UUID v7`
  - `period: YearMonth (YYYY-MM)`
  - `user_id: FK(User)`
  - `commit_amount: Decimal`
  - `best_case_amount: Decimal`
  - `pipeline_amount: Decimal`
  - `weighted_amount: Decimal`
  - `quota: Decimal`
  - `notes: Text`

## Domain Events

- `OpportunityCreated` — New deal created
- `OpportunityStageChanged` — Deal moved to new stage (with amount and probability)
- `OpportunityAmountUpdated` — Deal amount changed
- `OpportunityOwnerChanged` — Deal ownership transferred
- `OpportunityTeamMemberAdded` — Team member added to deal
- `OpportunityWon` — Deal marked as Closed Won
- `OpportunityLost` — Deal marked as Closed Lost (with reason)
- `OpportunityReopened` — Deal reopened from Closed Lost
- `ForecastSubmitted` — User submits forecast for period
- `ProductAdded` — Product/line item added to opportunity

## Commands & Queries

### Commands
- `CreateOpportunity(title, account, contact?, pipeline, stage, amount, ...) → OpportunityId`
- `UpdateOpportunity(id, data) → Opportunity`
- `MoveOpportunityStage(id, new_stage_id, reason?) → Opportunity`
- `WinOpportunity(id, close_date, notes) → Opportunity`
- `LossOpportunity(id, loss_reason, notes) → Opportunity`
- `ReopenOpportunity(id) → Opportunity`
- `AssignOpportunity(id, user_id) → Opportunity`
- `AddTeamMember(id, user_id, role) → TeamMember`
- `RemoveTeamMember(id, user_id) → void`
- `AddLineItem(opportunity_id, product_id, qty, discount) → LineItem`
- `UpdateLineItem(item_id, data) → LineItem`
- `RemoveLineItem(item_id) → void`
- `SubmitForecast(user_id, period, commit_amount, best_case) → Forecast`
- `CreatePipeline(name, stages) → PipelineId`
- `UpdatePipelineStages(pipeline_id, stages) → Pipeline`

### Queries
- `GetOpportunity(id) → Opportunity (with line items, team, activities)`
- `ListOpportunities(filters, sort, page) → PaginatedResult[Opportunity]`
- `GetPipelineSummary(tenant_id, user_id?, period?) → PipelineSummary`
- `GetForecast(user_id, period) → Forecast`
- `GetTeamForecast(team_id, period) → List[Forecast]`
- `GetOpportunityTimeline(id) → List[Activity]`
- `GetWonLossAnalysis(start, end, group_by) → Aggregation`
- `GetStageConversionRates(pipeline_id) → StageConversion[]`
- `SearchOpportunities(query, filters) → PaginatedResult[Opportunity]`

## Application Services

- `OpportunityService` — CRUD, stage transitions, closure
- `PipelineConfigurationService` — Pipeline and stage management
- `ForecastService` — Forecast submission, rollup, reporting
- `TeamSellingService` — Team member management
- `ProductService` — Product catalog management
- `WonLossAnalysisService` — Reporting and analytics

## API Endpoints

| Method | URL | Description | Permissions |
|--------|-----|-------------|-------------|
| GET | `/api/v1/opportunities/` | List opportunities | `pipeline.view_opportunity` |
| POST | `/api/v1/opportunities/` | Create opportunity | `pipeline.add_opportunity` |
| GET | `/api/v1/opportunities/{id}/` | Get opportunity | `pipeline.view_opportunity` |
| PUT | `/api/v1/opportunities/{id}/` | Update opportunity | `pipeline.change_opportunity` |
| PATCH | `/api/v1/opportunities/{id}/` | Partial update | `pipeline.change_opportunity` |
| DELETE | `/api/v1/opportunities/{id}/` | Soft-delete | `pipeline.delete_opportunity` |
| POST | `/api/v1/opportunities/{id}/stage/` | Move stage | `pipeline.change_opportunity_stage` |
| POST | `/api/v1/opportunities/{id}/won/` | Mark won | `pipeline.close_opportunity` |
| POST | `/api/v1/opportunities/{id}/lost/` | Mark lost | `pipeline.close_opportunity` |
| POST | `/api/v1/opportunities/{id}/reopen/` | Reopen | `pipeline.change_opportunity` |
| POST | `/api/v1/opportunities/{id}/assign/` | Assign owner | `pipeline.assign_opportunity` |
| GET | `/api/v1/opportunities/{id}/team/` | List team | `pipeline.view_opportunity` |
| POST | `/api/v1/opportunities/{id}/team/` | Add team member | `pipeline.manage_opportunity_team` |
| DELETE | `/api/v1/opportunities/{id}/team/{user_id}/` | Remove member | `pipeline.manage_opportunity_team` |
| GET | `/api/v1/opportunities/{id}/line-items/` | List line items | `pipeline.view_opportunity` |
| POST | `/api/v1/opportunities/{id}/line-items/` | Add line item | `pipeline.change_opportunity` |
| GET | `/api/v1/opportunities/{id}/timeline/` | Timeline | `pipeline.view_opportunity` |
| GET | `/api/v1/pipelines/` | List pipelines | `pipeline.view_pipeline` |
| POST | `/api/v1/pipelines/` | Create pipeline | `pipeline.add_pipeline` |
| GET | `/api/v1/pipelines/{id}/` | Get pipeline | `pipeline.view_pipeline` |
| PUT | `/api/v1/pipelines/{id}/` | Update pipeline | `pipeline.change_pipeline` |
| GET | `/api/v1/products/` | List products | `pipeline.view_product` |
| POST | `/api/v1/products/` | Create product | `pipeline.add_product` |
| GET | `/api/v1/forecasts/` | Get forecasts | `pipeline.view_forecast` |
| POST | `/api/v1/forecasts/` | Submit forecast | `pipeline.add_forecast` |
| GET | `/api/v1/forecasts/summary/` | Forecast summary | `pipeline.view_forecast` |
| GET | `/api/v1/reports/pipeline/` | Pipeline report | `pipeline.view_report` |
| GET | `/api/v1/reports/won-loss/` | Win/loss analysis | `pipeline.view_report` |

## Database Tables

See also: `CRM_Schema.md` for full DDL.

- `pipeline_pipeline` — Pipeline definitions
- `pipeline_pipelinestage` — Stages within pipelines
- `pipeline_opportunity` — Core opportunity table
- `pipeline_opportunitylineitem` — Products in deals
- `pipeline_opportunityteam` — Team selling participants
- `pipeline_opportunityactivity` — Deal activities
- `pipeline_product` — Product catalog
- `pipeline_forecast` — Forecast submissions

### Key Indexes
- `(tenant_id, stage_id)` — Pipeline view queries
- `(tenant_id, owner_id, expected_close_date)` — User's pipeline by date
- `(tenant_id, account_id)` — Account opportunities
- `(tenant_id, actual_close_date)` — Won/Lost date range queries
- `(tenant_id, amount)` — Amount-based filtering/sorting

## Validation Rules

| Field | Rule |
|-------|------|
| amount | Must be ≥ 0 |
| probability | Must be 0-100; if changed independently from stage, user override flag set |
| expected_close_date | Must be in the future (or today) for open deals |
| pipeline_id | Must belong to same tenant |
| stage_id | Must belong to specified pipeline |
| stage transition | Must follow pipeline stage order (cannot skip backwards except reopen) |
| owner_id | Must be active user in same tenant |
| close_date | Required when marking Closed Won; must be today or past |

## Workflows & State Machine

### Opportunity Stage State Machine

```
CLOSED_WON ← (any open stage) → CLOSED_LOST
    ↑                                |
    └──────── REOPENED ←─────────────┘
```

Stage progression is linear within a pipeline (stage.order increments). Deals can move forward or backward by one stage at a time. Reopening a CLOSED_LOST deal creates a new opportunity with original data.

### Forecast Workflow
1. Monthly forecast window opens (last 5 business days of month)
2. Sales reps review pipeline and commit to deals
3. Rep submits forecast (commit, best_case amounts with rationale)
4. Managers review and adjust team forecasts
5. Forecast rollup: individual → team → department → organization
6. Forecast data frozen after close of period

### Team Selling Workflow
1. Primary owner assigned at opportunity creation
2. Owner can add team members from any department
3. Each member has a role (Technical, Executive, Support, etc.)
4. Contribution percentage (optional) for commission/split calculations
5. Team members receive notifications on deal updates

## Security & Permissions

| Permission | Description |
|------------|-------------|
| `pipeline.view_opportunity` | View own opportunities |
| `pipeline.view_all_opportunities` | View all opportunities in tenant |
| `pipeline.add_opportunity` | Create opportunities |
| `pipeline.change_opportunity` | Edit own opportunities |
| `pipeline.change_all_opportunities` | Edit any opportunity |
| `pipeline.delete_opportunity` | Soft-delete own |
| `pipeline.change_opportunity_stage` | Move stage |
| `pipeline.close_opportunity` | Mark won/lost |
| `pipeline.assign_opportunity` | Reassign ownership |
| `pipeline.manage_opportunity_team` | Add/remove team members |
| `pipeline.view_forecast` | View own forecast |
| `pipeline.view_team_forecast` | View team forecasts |
| `pipeline.submit_forecast` | Submit forecast |
| `pipeline.manage_pipeline` | CRUD pipelines |
| `pipeline.view_report` | View pipeline reports |

## Testing Strategy

| Layer | Focus |
|-------|-------|
| Unit | Stage transition validation, Probability calculation, Amount computation, Forecast rollup logic |
| Integration | Opportunity → line items → team creation, Stage movement triggers events, Forecast submission freezes data |
| API | Pipeline CRUD, Stage movement with validation, Win/loss with required reasons, Team member management |
| E2E | Complete deal flow: create → move stages → add products → close won, Forecast submission and rollup |

## Future Enhancements

- **AI Deal Scoring:** Predictive close probability (ML model), recommended next actions
- **Deal Room:** Secure portal for prospects to collaborate
- **Quote Management:** Generate PDF quotes from opportunities
- **Contract Management:** Link contracts to won opportunities
- **Subscription Management:** Recurring revenue tracking
- **CPQ (Configure-Price-Quote):** Guided product configuration with pricing rules
- **Partner Deals:** Co-sell with channel partners
- **Rollup Forecasting:** Multi-level forecast rollup with AI adjustments
