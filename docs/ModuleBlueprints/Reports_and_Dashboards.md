# Module Blueprint: Reports & Dashboards

- **Module:** `apps.reports`, `apps.dashboard`
- **Bounded Context:** Analytics, Reporting & Visualization
- **Status:** Draft v1.0

## Business Purpose

The Reports & Dashboards module provides configurable analytics, report generation, and visual dashboarding. Users can build custom reports using drag-and-drop field selection, schedule recurring reports, and create personalized dashboards with widget-based layouts.

## Bounded Context

This module owns Report definitions, Report schedules, Dashboard definitions, Widgets, and the SQL-based report execution engine. It consumes data from all other modules via read models and materialized views. It does NOT own raw data or domain logic.

## Aggregates, Entities, Value Objects

### Aggregate: Report
- **Report** (Aggregate Root)
  - `id: UUID v7`
  - `tenant_id: UUID v7`
  - `name: str`
  - `description: Text`
  - `report_type: ReportType`
  - `source_module: str` (e.g., "lead_management", "pipeline_management")
  - `config: JSONB` (fields, filters, groupings, aggregations, sorting)
  - `visualization: VisualizationConfig`
  - `schedule: ReportSchedule | None`
  - `is_shared: bool`
  - `owner_id: UUID v7 (FK to User)`
  - `last_generated_at: DateTime | None`
  - `timestamps: created_at, updated_at`

### Value Objects
- **ReportType:** `enum(TABLE, SUMMARY, CHART, PIVOT_TABLE, FUNNEL, HEATMAP)`
- **VisualizationConfig:** `{chart_type: BAR|LINE|PIE|AREA|DONUT|SCATTER|FUNNEL, x_axis, y_axis, group_by, color_by, stacked: bool, show_legend: bool}`
- **ReportSchedule:** `{frequency: ONCE|DAILY|WEEKLY|MONTHLY, day_of_week, day_of_month, time, format: PDF|CSV|XLSX, recipients: List[Email]}`

### Entities
- **ReportFilter** — Filter criteria
  - `field, operator, value, logic_group`
- **ReportField** — Selected output fields
  - `field, label, aggregation: SUM|AVG|COUNT|MIN|MAX|NONE, sort: ASC|DESC|NONE`
- **ReportExecution** — Execution history
  - `id, report_id, started_at, completed_at, status, row_count, file_url, error_message`

### Aggregate: Dashboard
- **Dashboard** (Aggregate Root)
  - `id: UUID v7`
  - `tenant_id: UUID v7`
  - `name: str`
  - `description: Text`
  - `layout: DashboardLayout`
  - `is_default: bool`
  - `is_shared: bool`
  - `owner_id: UUID v7 (FK to User)`
  - `timestamps: created_at, updated_at`

### Value Objects
- **DashboardLayout:** `{columns: int, row_height: int, widgets: List[Widget]}`
- **DashboardShare:** `{shared_with: List[UUID], role: VIEW|EDIT}`

### Entities
- **Widget** — Dashboard widget
  - `id: UUID v7`
  - `dashboard_id: FK`
  - `widget_type: WidgetType`
  - `title: str`
  - `config: JSONB` (report_id, or inline query config)
  - `position: {x, y, width, height}`
  - `refresh_interval: int | None` (seconds: 60, 300, 900, 3600)
  - `date_range_preset: str | None` (today, this_week, this_month, last_quarter, custom)
  - `is_visible: bool`

### Value Objects
- **WidgetType:** `enum(KPI, CHART, TABLE, FUNNEL, ACTIVITY_FEED, TASK_LIST, LEAD_STATS, PIPELINE_SUMMARY, FORECAST, GOAL_PROGRESS, EMBEDDED_REPORT, TEXT, MAP)`

## Domain Events

- `ReportGenerated` — Report execution completed
- `ReportScheduled` — Schedule created/updated
- `ReportShared` — Report shared with user/team
- `DashboardCreated` — New dashboard created
- `DashboardShared` — Dashboard shared with others
- `WidgetDataRefreshed` — Widget data updated

## Commands & Queries

### Commands
- `CreateReport(name, source, config) → ReportId`
- `UpdateReport(report_id, data) → Report`
- `DeleteReport(report_id) → void`
- `RunReport(report_id) → ReportExecution`
- `ScheduleReport(report_id, schedule) → Report`
- `UnscheduleReport(report_id) → Report`
- `ExportReport(report_id, format) → File`
- `ShareReport(report_id, user_ids, permissions) → void`
- `CreateDashboard(name, layout) → DashboardId`
- `UpdateDashboard(dashboard_id, data) → Dashboard`
- `DeleteDashboard(dashboard_id) → void`
- `AddWidget(dashboard_id, widget_config) → WidgetId`
- `UpdateWidget(widget_id, config) → Widget`
- `RemoveWidget(widget_id) → void`
- `MoveWidget(widget_id, position) → void`
- `ShareDashboard(dashboard_id, user_ids, permissions) → void`
- `SetDefaultDashboard(user_id, dashboard_id) → void`
- `RefreshWidget(widget_id) → WidgetData`

### Queries
- `GetReport(id) → Report`
- `ListReports(filters, page) → PaginatedResult[Report]`
- `GetReportExecutions(report_id, page) → PaginatedResult[Execution]`
- `GetReportData(report_id, params?) → Dataset` (execute and return)
- `GetDashboard(id) → Dashboard`
- `ListDashboards(user_id) → List[Dashboard]`
- `GetDashboardData(dashboard_id) → Dict` (all widget data)
- `GetWidgetData(widget_id, params?) → WidgetDataset`
- `GetDashboardShares(dashboard_id) → List[Share]`
- `GetDashboardStats(tenant_id) → Stats`

## Application Services

- `ReportDefinitionService` — CRUD for report definitions
- `ReportExecutionEngine` — Build and execute SQL/materialized view queries
- `ReportExportService` — Generate CSV, XLSX, PDF files
- `ReportScheduler` — Schedule and trigger recurring reports
- `DashboardService` — CRUD for dashboards and widgets
- `WidgetDataService` — Fetch and cache widget data
- `KPIService` — Compute KPI values from aggregated data
- `ReportSharingService` — Manage report/dashboard sharing

### SQL Engine
- Dynamic SQL generation from report config
- Parameterized queries with injection protection
- Support for aggregations, groupings, window functions
- Caching via Redis (configurable TTL per report)
- Read replicas for heavy reports

## API Endpoints

### Reports
| Method | URL | Description | Permissions |
|--------|-----|-------------|-------------|
| GET | `/api/v1/reports/` | List reports | `report.view_report` |
| POST | `/api/v1/reports/` | Create report | `report.add_report` |
| GET | `/api/v1/reports/{id}/` | Get report | `report.view_report` |
| PUT | `/api/v1/reports/{id}/` | Update report | `report.change_report` |
| DELETE | `/api/v1/reports/{id}/` | Delete report | `report.delete_report` |
| POST | `/api/v1/reports/{id}/run/` | Execute report | `report.run_report` |
| GET | `/api/v1/reports/{id}/data/` | Get report data | `report.view_report` |
| GET | `/api/v1/reports/{id}/export/?format=csv` | Export | `report.export_report` |
| POST | `/api/v1/reports/{id}/schedule/` | Set schedule | `report.schedule_report` |
| DELETE | `/api/v1/reports/{id}/schedule/` | Remove schedule | `report.schedule_report` |
| GET | `/api/v1/reports/{id}/executions/` | Execution history | `report.view_report` |
| POST | `/api/v1/reports/{id}/share/` | Share report | `report.share_report` |
| GET | `/api/v1/reports/available-fields/` | Available fields per module | `report.view_report` |

### Dashboards
| Method | URL | Description | Permissions |
|--------|-----|-------------|-------------|
| GET | `/api/v1/dashboards/` | List dashboards | `dashboard.view_dashboard` |
| POST | `/api/v1/dashboards/` | Create dashboard | `dashboard.add_dashboard` |
| GET | `/api/v1/dashboards/{id}/` | Get dashboard | `dashboard.view_dashboard` |
| PUT | `/api/v1/dashboards/{id}/` | Update dashboard | `dashboard.change_dashboard` |
| DELETE | `/api/v1/dashboards/{id}/` | Delete dashboard | `dashboard.delete_dashboard` |
| GET | `/api/v1/dashboards/{id}/data/` | All widget data | `dashboard.view_dashboard` |
| POST | `/api/v1/dashboards/{id}/share/` | Share dashboard | `dashboard.share_dashboard` |
| POST | `/api/v1/dashboards/default/` | Set default | `dashboard.view_dashboard` |
| POST | `/api/v1/dashboards/widgets/` | Add widget | `dashboard.change_dashboard` |
| PUT | `/api/v1/dashboards/widgets/{id}/` | Update widget | `dashboard.change_dashboard` |
| DELETE | `/api/v1/dashboards/widgets/{id}/` | Remove widget | `dashboard.change_dashboard` |
| PATCH | `/api/v1/dashboards/widgets/{id}/position/` | Move widget | `dashboard.change_dashboard` |
| POST | `/api/v1/dashboards/widgets/{id}/refresh/` | Refresh data | `dashboard.view_dashboard` |

## Database Tables

- `report_report` — Report definitions
- `report_filter` — Report filter criteria
- `report_field` — Report output field configuration
- `report_execution` — Execution history
- `report_schedule` — Scheduled report configurations
- `report_share` — Report sharing permissions
- `dashboard_dashboard` — Dashboard definitions
- `dashboard_widget` — Dashboard widgets
- `dashboard_share` — Dashboard sharing

### Key Indexes
- `(tenant_id, owner_id)` — User's reports/dashboards
- `(tenant_id, source_module)` — Module-based report listing
- `(report_id, scheduled_at)` — Scheduler polling
- `(tenant_id, is_shared)` — Shared content queries
- `(dashboard_id, widget.position)` — Layout ordering

## Security & Permissions

| Permission | Codename | Description |
|------------|----------|-------------|
| View Report | `report.view_report` | View own reports |
| Add Report | `report.add_report` | Create reports |
| Change Report | `report.change_report` | Edit reports |
| Delete Report | `report.delete_report` | Delete reports |
| Run Report | `report.run_report` | Execute reports |
| Export Report | `report.export_report` | Export to file |
| Schedule Report | `report.schedule_report` | Manage schedules |
| Share Report | `report.share_report` | Share with others |
| View Dashboard | `dashboard.view_dashboard` | View dashboards |
| Add Dashboard | `dashboard.add_dashboard` | Create dashboards |
| Change Dashboard | `dashboard.change_dashboard` | Edit dashboards/widgets |
| Delete Dashboard | `dashboard.delete_dashboard` | Delete dashboards |
| Share Dashboard | `dashboard.share_dashboard` | Share dashboards |

## Testing Strategy

| Layer | Tool | Focus |
|-------|------|-------|
| Unit | pytest | Report config validation, SQL generation (no injection), Scheduled expression parsing, Widget position overlap detection |
| Integration | pytest-django | Report execution engine (against actual DB), Export format generation, Dashboard widget data aggregation |
| API | DRF APIClient | Report CRUD, Execution flow, Dashboard layout management, Sharing permissions |
| E2E | Playwright | Create report → run → export, Create dashboard → add widgets → verify data |

## Future Enhancements

- **AI Report Insights:** Natural language summaries of report data
- **Drill-Down:** Clickable chart elements that open detail views
- **Custom Formulas:** Calculated fields using formula expressions
- **Embedded Dashboards:** Public share links with token auth
- **Scheduled Deliveries:** Email/Slack delivery of reports on schedule
- **Data Alerts:** Threshold-based alerts (e.g., "leads dropped 20%")
- **Cross-Tenant Benchmarking:** Anonymized industry benchmarks
- **Report Builder UI:** Drag-and-drop field/aggregation builder
- **Forecasting:** Time-series predictions based on historical data