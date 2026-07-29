# TZAHU CRM — Project Structure

> **Version:** 0.1.0-draft
> **Last Updated:** 2026-07-27
> **Status:** Foundational Design Phase
> **Owner:** Platform Architecture Team

---

## Table of Contents

1. [Repository Root](#1-repository-root)
2. [Backend (`backend/`)](#2-backend)
3. [AI Gateway (`ai_gateway/`)](#3-ai-gateway)
4. [Frontend (`frontend/`)](#4-frontend)
5. [Mobile (`mobile/`)](#5-mobile)
6. [Infrastructure (`infra/`)](#6-infrastructure)
7. [Scripts (`scripts/`)](#7-scripts)
8. [Documentation (`docs/`)](#8-documentation)
9. [CI/CD (`.github/`)](#9-cicd)
10. [Ownership & Responsibilities](#10-ownership--responsibilities)
11. [Naming Conventions](#11-naming-conventions)

---

## 1. Repository Root

```
tzahu_crm/
├── backend/                     # Django application (Python 3.13)
├── ai_gateway/                  # FastAPI sidecar (Python 3.13)
├── frontend/                    # React SPA (TypeScript + Vite)
├── mobile/                      # React Native (placeholder)
├── infra/                       # Infrastructure as Code
├── scripts/                     # Utility scripts
├── docs/                        # Architecture and design docs
├── .github/                     # CI/CD workflows
│
├── .env.example                 # Environment variable template
├── .gitignore                   # Git ignore rules
├── .pre-commit-config.yaml      # Pre-commit hooks
├── AGENTS.md                    # AI assistant instructions
├── CHANGELOG.md                 # Release changelog
├── CONTRIBUTING.md              # Contribution guidelines
├── docker-compose.yml           # Local development services
├── docker-compose.prod.yml      # Production-like services
├── Makefile                     # Common commands
├── pyproject.toml               # Python project config (Poetry)
├── README.md                    # Project overview
└── ruff.toml                    # Ruff linter config
```

---

## 2. Backend

```
backend/
├── config/
│   ├── __init__.py
│   ├── settings/
│   │   ├── __init__.py
│   │   ├── base.py              # Base settings (shared)
│   │   ├── dev.py               # Development overrides
│   │   ├── staging.py           # Staging overrides
│   │   └── prod.py              # Production overrides
│   ├── urls/
│   │   ├── __init__.py
│   │   ├── base.py              # Root URL configuration
│   │   ├── api.py               # API v1 URL routing
│   │   ├── admin.py             # Admin URL routing
│   │   └── ws.py                # WebSocket routing
│   ├── wsgi.py                  # WSGI entrypoint
│   ├── asgi.py                  # ASGI entrypoint (Channels)
│   ├── celery.py                # Celery app configuration
│   └── middleware.py            # Custom middleware registration
│
├── apps/
│   ├── __init__.py
│   │
│   ├── shared_kernel/           # Foundation layer (all modules depend on this)
│   │   ├── __init__.py
│   │   ├── domain/
│   │   │   ├── base.py          # AggregateRoot, Entity, ValueObject
│   │   │   ├── events.py        # DomainEvent base
│   │   │   ├── exceptions.py    # DomainException base
│   │   │   ├── result.py        # Result[T, E], PaginatedResult[T]
│   │   │   └── value_objects.py # Email, Phone, Address, Money, etc.
│   │   ├── application/
│   │   │   ├── ports.py         # Repository[T], EventPublisher interfaces
│   │   │   └── unit_of_work.py  # UnitOfWork pattern
│   │   ├── infrastructure/
│   │   │   ├── models.py        # UUIDModel, TimestampedModel, SoftDeleteModel, TenantScopedModel
│   │   │   ├── repository.py    # TenantScopedRepository base
│   │   │   ├── event_publisher.py # RabbitMQ + InProcess publishers
│   │   │   ├── cache.py         # CacheService
│   │   │   ├── id_generator.py  # uuid7() implementation
│   │   │   └── middleware/
│   │   │       ├── tenant.py    # TenantResolutionMiddleware
│   │   │       └── logging.py   # LoggingMiddleware
│   │   ├── utils/
│   │   │   ├── serializers.py   # DRF base serializers
│   │   │   └── validators.py    # Shared validation
│   │   └── tests/
│   │       ├── test_base.py
│   │       ├── test_result.py
│   │       └── test_value_objects.py
│   │
│   ├── identity/                # User registration, auth, JWT, sessions
│   │   ├── __init__.py
│   │   ├── apps.py              # IdentityConfig
│   │   ├── domain/
│   │   │   ├── models.py        # User, Session aggregates
│   │   │   ├── value_objects.py # UserPreferences, DeviceInfo, PasswordPolicy
│   │   │   ├── events.py        # UserRegistered, EmailVerified, etc.
│   │   │   └── exceptions.py    # UserNotFoundError, InvalidCredentialsError
│   │   ├── application/
│   │   │   ├── services.py      # AuthService, UserService
│   │   │   ├── commands.py      # RegisterUser, LoginUser, RefreshToken
│   │   │   └── queries.py       # GetUserById, GetUserByEmail
│   │   ├── infrastructure/
│   │   │   ├── models.py        # UserModel, SessionModel, PasswordHistoryModel
│   │   │   ├── repositories.py  # DjangoUserRepository, DjangoSessionRepository
│   │   │   ├── auth.py          # JWT encode/decode, password hashing
│   │   │   └── admin.py         # UserModelAdmin
│   │   ├── api/
│   │   │   ├── views.py         # AuthViewSet, UserViewSet
│   │   │   ├── serializers.py   # RegisterSerializer, LoginSerializer
│   │   │   ├── permissions.py   # IsSelf, IsAdmin
│   │   │   └── urls.py          # /auth/*, /users/* routes
│   │   └── tests/
│   │       ├── domain/test_user.py
│   │       ├── application/test_auth_service.py
│   │       ├── infrastructure/test_repositories.py
│   │       └── api/test_auth_api.py
│   │
│   ├── organization/            # Organization, membership, settings, tier
│   │   ├── __init__.py
│   │   ├── apps.py
│   │   ├── domain/
│   │   │   ├── models.py        # Organization, Membership aggregates
│   │   │   ├── value_objects.py # OrganizationSettings, SubscriptionTier
│   │   │   ├── events.py        # OrgProvisioned, OrgSuspended, MemberInvited
│   │   │   └── exceptions.py
│   │   ├── application/
│   │   │   ├── services.py      # OrgService, MembershipService
│   │   │   ├── commands.py      # CreateOrg, InviteMember, AcceptInvite
│   │   │   └── queries.py       # ListOrgMembers, GetOrgSettings
│   │   ├── infrastructure/
│   │   │   ├── models.py        # OrgModel, MembershipModel
│   │   │   ├── repositories.py
│   │   │   └── admin.py
│   │   ├── api/
│   │   │   ├── views.py         # OrgViewSet, MembershipViewSet
│   │   │   ├── serializers.py
│   │   │   ├── permissions.py   # OrgAdminPermission
│   │   │   └── urls.py
│   │   └── tests/
│   │
│   ├── rbac/                    # Roles, permissions, role assignments
│   │   ├── __init__.py
│   │   ├── apps.py
│   │   ├── domain/
│   │   │   ├── models.py        # Role, RoleAssignment aggregates
│   │   │   ├── value_objects.py # Permission
│   │   │   ├── events.py        # RoleCreated, RoleAssigned
│   │   │   └── exceptions.py    # PermissionDeniedError
│   │   ├── application/
│   │   │   ├── services.py      # RbacService, PermissionService
│   │   │   ├── commands.py
│   │   │   └── queries.py       # GetUserPermissions
│   │   ├── infrastructure/
│   │   │   ├── models.py        # RoleModel, RoleAssignmentModel
│   │   │   ├── repositories.py
│   │   │   └── admin.py
│   │   ├── api/
│   │   │   ├── views.py         # RoleViewSet, AssignmentViewSet
│   │   │   ├── serializers.py
│   │   │   ├── permissions.py   # ManageRolesPermission
│   │   │   └── urls.py
│   │   └── tests/
│   │
│   ├── tenant/                  # RLS management, tenant lifecycle, Pool/Silo
│   │   ├── __init__.py
│   │   ├── apps.py
│   │   ├── domain/
│   │   │   ├── models.py        # Tenant aggregate
│   │   │   ├── value_objects.py # IsolationModel, SiloConfig
│   │   │   ├── events.py        # TenantProvisioned, TenantSuspended
│   │   │   └── exceptions.py    # TenantSuspendedError
│   │   ├── application/
│   │   │   ├── services.py      # TenantService, RlsPolicyService
│   │   │   ├── commands.py
│   │   │   └── queries.py
│   │   ├── infrastructure/
│   │   │   ├── models.py        # TenantModel
│   │   │   ├── repositories.py
│   │   │   ├── rls.py           # RLSPolicyManager, policy generation
│   │   │   ├── middleware.py    # TenantResolutionMiddleware
│   │   │   ├── celery_middleware.py # TenantAwareTask base
│   │   │   └── admin.py
│   │   ├── api/
│   │   │   ├── views.py         # TenantViewSet (admin console)
│   │   │   ├── serializers.py
│   │   │   ├── permissions.py   # SystemAdminPermission
│   │   │   └── urls.py
│   │   └── tests/
│   │
│   ├── lead_management/         # Lead, Contact, Account management
│   │   ├── __init__.py
│   │   ├── apps.py
│   │   ├── domain/
│   │   │   ├── models.py        # Lead, Contact, Account aggregates
│   │   │   ├── value_objects.py # LeadSource, LeadScore, ContactPreference
│   │   │   ├── events.py        # LeadCreated, LeadConverted, etc.
│   │   │   └── exceptions.py    # DuplicateLeadError
│   │   ├── application/
│   │   │   ├── services.py      # LeadService, ContactService, LeadScoringService
│   │   │   ├── commands.py      # CreateLead, ConvertLead, MergeContacts
│   │   │   └── queries.py       # SearchLeads, GetLeadTimeline
│   │   ├── infrastructure/
│   │   │   ├── models.py        # LeadModel, ContactModel, AccountModel
│   │   │   ├── repositories.py  # DjangoLeadRepository
│   │   │   ├── selectors.py     # LeadSearchSelector, PipelineSummarySelector
│   │   │   ├── dedup.py         # Duplicate detection engine
│   │   │   └── admin.py
│   │   ├── api/
│   │   │   ├── views.py         # LeadViewSet, ContactViewSet, AccountViewSet
│   │   │   ├── serializers.py
│   │   │   ├── permissions.py   # LeadPermission
│   │   │   ├── filters.py      # LeadFilterSet
│   │   │   └── urls.py
│   │   ├── adapters/
│   │   │   └── event_handlers.py
│   │   └── tests/
│   │
│   ├── pipeline_management/     # Pipeline stages, opportunities, forecasting
│   │   ├── __init__.py
│   │   ├── apps.py
│   │   ├── domain/
│   │   │   ├── models.py        # Pipeline, Opportunity, Stage aggregates
│   │   │   ├── value_objects.py # ForecastCategory, WinReason
│   │   │   ├── events.py        # OpptyCreated, StageChanged, OpptyWon
│   │   │   └── exceptions.py
│   │   ├── application/
│   │   │   ├── services.py      # PipelineService, ForecastService
│   │   │   ├── commands.py
│   │   │   └── queries.py       # GetPipelineSummary, GetForecast
│   │   ├── infrastructure/
│   │   │   ├── models.py        # PipelineModel, StageModel, OpportunityModel
│   │   │   ├── repositories.py
│   │   │   ├── selectors.py     # ForecastSelector
│   │   │   └── admin.py
│   │   ├── api/
│   │   │   ├── views.py         # PipelineViewSet, OpportunityViewSet
│   │   │   ├── serializers.py
│   │   │   ├── permissions.py
│   │   │   └── urls.py
│   │   ├── adapters/
│   │   │   └── event_handlers.py
│   │   └── tests/
│   │
│   ├── activity/                # Activity logging and task management
│   │   ├── __init__.py
│   │   ├── apps.py
│   │   ├── domain/
│   │   │   ├── models.py        # Activity, Task aggregates
│   │   │   ├── value_objects.py # ActivityType, Priority, TaskStatus
│   │   │   ├── events.py        # ActivityLogged, TaskCreated, TaskCompleted
│   │   │   └── exceptions.py
│   │   ├── application/
│   │   │   ├── services.py      # ActivityService, TaskService
│   │   │   ├── commands.py
│   │   │   └── queries.py       # GetEntityTimeline, GetUserTasks
│   │   ├── infrastructure/
│   │   │   ├── models.py        # ActivityModel, TaskModel
│   │   │   ├── repositories.py
│   │   │   └── admin.py
│   │   ├── api/
│   │   │   ├── views.py         # ActivityViewSet, TaskViewSet
│   │   │   ├── serializers.py
│   │   │   ├── permissions.py
│   │   │   └── urls.py
│   │   ├── adapters/
│   │   │   └── event_handlers.py
│   │   └── tests/
│   │
│   ├── calendar/                # Calendar events, Google/MS sync
│   │   ├── __init__.py
│   │   ├── apps.py
│   │   ├── domain/
│   │   │   ├── models.py        # CalendarEvent
│   │   │   ├── value_objects.py # RecurrenceRule
│   │   │   ├── events.py        # MeetingCreated
│   │   │   └── exceptions.py
│   │   ├── application/
│   │   │   ├── services.py      # CalendarService, SyncService
│   │   │   ├── commands.py
│   │   │   └── queries.py
│   │   ├── infrastructure/
│   │   │   ├── models.py
│   │   │   ├── repositories.py
│   │   │   ├── providers/
│   │   │   │   ├── google.py    # Google Calendar API client
│   │   │   │   └── microsoft.py # Microsoft Graph API client
│   │   │   └── admin.py
│   │   ├── api/
│   │   │   ├── views.py
│   │   │   ├── serializers.py
│   │   │   └── urls.py
│   │   └── tests/
│   │
│   ├── workflow/                # Workflow automation engine
│   │   ├── __init__.py
│   │   ├── apps.py
│   │   ├── domain/
│   │   │   ├── models.py        # Workflow, WorkflowExecution, Condition, Action
│   │   │   ├── value_objects.py # ConditionOperator, ActionType
│   │   │   ├── events.py        # WorkflowTriggered, WorkflowCompleted
│   │   │   └── exceptions.py    # WorkflowLoopDetectedError
│   │   ├── application/
│   │   │   ├── services.py      # WorkflowEngine, ConditionEvaluator, ActionExecutor
│   │   │   ├── commands.py
│   │   │   └── queries.py
│   │   ├── infrastructure/
│   │   │   ├── models.py        # WorkflowModel, ExecutionModel
│   │   │   ├── repositories.py
│   │   │   ├── tasks.py         # execute_workflow Celery task
│   │   │   └── admin.py
│   │   ├── api/
│   │   │   ├── views.py         # WorkflowViewSet, ExecutionViewSet
│   │   │   ├── serializers.py
│   │   │   ├── permissions.py
│   │   │   └── urls.py
│   │   ├── adapters/
│   │   │   └── event_handlers.py
│   │   └── tests/
│   │
│   ├── notification/            # Multi-channel notification delivery
│   │   ├── __init__.py
│   │   ├── apps.py
│   │   ├── domain/
│   │   │   ├── models.py        # Notification, NotificationTemplate
│   │   │   ├── value_objects.py # Channel, DeliveryStatus
│   │   │   ├── events.py        # NotificationSent, NotificationFailed
│   │   │   └── exceptions.py    # ChannelUnavailableError
│   │   ├── application/
│   │   │   ├── services.py      # NotificationService, TemplateService
│   │   │   ├── commands.py
│   │   │   └── queries.py
│   │   ├── infrastructure/
│   │   │   ├── models.py        # NotificationModel, TemplateModel, PreferenceModel
│   │   │   ├── repositories.py
│   │   │   ├── channels/
│   │   │   │   ├── email.py     # SendGrid / SES channel
│   │   │   │   ├── sms.py       # Twilio channel
│   │   │   │   ├── in_app.py    # WebSocket push via Channels
│   │   │   │   ├── push.py      # Firebase Cloud Messaging
│   │   │   │   └── slack.py     # Slack webhook
│   │   │   ├── tasks.py         # send_notification Celery task
│   │   │   └── admin.py
│   │   ├── api/
│   │   │   ├── views.py         # NotificationViewSet, PreferenceViewSet
│   │   │   ├── serializers.py
│   │   │   └── urls.py
│   │   ├── adapters/
│   │   │   └── event_handlers.py
│   │   └── tests/
│   │
│   ├── reports/                 # Report builder, analytics, forecasting
│   │   ├── __init__.py
│   │   ├── apps.py
│   │   ├── domain/
│   │   │   ├── models.py        # Report, ReportSchedule, DataSource
│   │   │   ├── value_objects.py # ReportFormat, AggregationType
│   │   │   ├── events.py        # ReportGenerated, ReportScheduled
│   │   │   └── exceptions.py
│   │   ├── application/
│   │   │   ├── services.py      # ReportService, AnalyticsService
│   │   │   ├── commands.py
│   │   │   └── queries.py
│   │   ├── infrastructure/
│   │   │   ├── models.py        # ReportModel, ScheduleModel
│   │   │   ├── repositories.py
│   │   │   ├── engines/
│   │   │   │   └── sql_engine.py # Dynamic SQL generation for reports
│   │   │   ├── exporters/
│   │   │   │   ├── csv_exporter.py
│   │   │   │   ├── xlsx_exporter.py
│   │   │   │   └── pdf_exporter.py
│   │   │   └── admin.py
│   │   ├── api/
│   │   │   ├── views.py         # ReportViewSet, AnalyticsView
│   │   │   ├── serializers.py
│   │   │   └── urls.py
│   │   └── tests/
│   │
│   ├── dashboard/               # Dashboard widgets, layouts, sharing
│   │   ├── __init__.py
│   │   ├── apps.py
│   │   ├── domain/
│   │   │   ├── models.py        # Dashboard, Widget, DashboardShare
│   │   │   ├── value_objects.py # WidgetType, Layout
│   │   │   ├── events.py
│   │   │   └── exceptions.py
│   │   ├── application/
│   │   │   ├── services.py      # DashboardService, WidgetService
│   │   │   ├── commands.py
│   │   │   └── queries.py
│   │   ├── infrastructure/
│   │   │   ├── models.py
│   │   │   └── repositories.py
│   │   ├── api/
│   │   │   ├── views.py
│   │   │   ├── serializers.py
│   │   │   └── urls.py
│   │   └── tests/
│   │
│   ├── ai/                      # AI orchestration, NLP, scoring features
│   │   ├── __init__.py
│   │   ├── apps.py
│   │   ├── domain/
│   │   │   ├── models.py        # AiQuery, AiResponse, EmbeddingJob
│   │   │   ├── value_objects.py # ModelProvider, TokenUsage
│   │   │   ├── events.py        # QueryProcessed, EmbeddingGenerated
│   │   │   └── exceptions.py    # AiProviderUnavailableError
│   │   ├── application/
│   │   │   ├── services.py      # AiService, EmbeddingService, ScoringService
│   │   │   ├── commands.py
│   │   │   └── queries.py
│   │   ├── infrastructure/
│   │   │   ├── models.py
│   │   │   ├── repositories.py
│   │   │   ├── gateway_client.py # HTTP client to AI Gateway
│   │   │   └── admin.py
│   │   ├── api/
│   │   │   ├── views.py         # AiQueryView, AiSettingsView
│   │   │   ├── serializers.py
│   │   │   ├── permissions.py
│   │   │   └── urls.py
│   │   ├── adapters/
│   │   │   └── event_handlers.py
│   │   └── tests/
│   │
│   ├── voice_ai/                # Voice AI, call logging, transcription
│   │   ├── __init__.py
│   │   ├── apps.py
│   │   ├── domain/
│   │   │   ├── models.py        # Call, Transcription, CallAnalysis
│   │   │   ├── value_objects.py # CallOutcome, SentimentScore
│   │   │   ├── events.py        # CallCompleted, CallAnalyzed
│   │   │   └── exceptions.py
│   │   ├── application/
│   │   │   ├── services.py      # CallService, TranscriptionService, AnalysisService
│   │   │   ├── commands.py
│   │   │   └── queries.py
│   │   ├── infrastructure/
│   │   │   ├── models.py
│   │   │   ├── repositories.py
│   │   │   ├── twilio_client.py # Twilio Voice integration
│   │   │   └── admin.py
│   │   ├── api/
│   │   │   ├── views.py         # CallViewSet, TranscriptionView
│   │   │   ├── serializers.py
│   │   │   └── urls.py
│   │   └── tests/
│   │
│   ├── integrations/            # Connector SDK, webhooks, OAuth vault
│   │   ├── __init__.py
│   │   ├── apps.py
│   │   ├── domain/
│   │   │   ├── models.py        # Connector, OAuthToken, WebhookSubscription
│   │   │   ├── value_objects.py # AuthMethod, SyncDirection
│   │   │   ├── events.py        # WebhookDelivered, SyncCompleted
│   │   │   └── exceptions.py
│   │   ├── application/
│   │   │   ├── services.py      # ConnectorService, SyncService, WebhookService
│   │   │   ├── commands.py
│   │   │   └── queries.py
│   │   ├── infrastructure/
│   │   │   ├── models.py        # ConnectorModel, OAuthTokenModel, WebhookModel
│   │   │   ├── repositories.py
│   │   │   ├── vault.py         # Encrypted OAuth token storage
│   │   │   ├── connectors/
│   │   │   │   ├── google/
│   │   │   │   │   ├── contacts.py
│   │   │   │   │   └── calendar.py
│   │   │   │   ├── microsoft/
│   │   │   │   │   ├── contacts.py
│   │   │   │   │   └── calendar.py
│   │   │   │   ├── hubspot.py
│   │   │   │   ├── mailchimp.py
│   │   │   │   └── __init__.py  # Connector SDK base
│   │   │   └── admin.py
│   │   ├── api/
│   │   │   ├── views.py         # IntegrationViewSet, WebhookView
│   │   │   ├── serializers.py
│   │   │   └── urls.py
│   │   ├── adapters/
│   │   │   └── event_handlers.py
│   │   └── tests/
│   │
│   ├── settings/                # Application settings, feature flags
│   │   ├── __init__.py
│   │   ├── apps.py
│   │   ├── domain/
│   │   │   ├── models.py        # AppSetting, FeatureFlag
│   │   │   ├── value_objects.py # SettingType, FlagScope
│   │   │   └── exceptions.py
│   │   ├── application/
│   │   │   ├── services.py      # SettingsService, FeatureFlagService
│   │   │   └── queries.py
│   │   ├── infrastructure/
│   │   │   ├── models.py
│   │   │   └── repositories.py
│   │   ├── api/
│   │   │   ├── views.py
│   │   │   ├── serializers.py
│   │   │   └── urls.py
│   │   └── tests/
│   │
│   ├── audit/                   # Append-only event log, GDPR compliance
│   │   ├── __init__.py
│   │   ├── apps.py
│   │   ├── domain/
│   │   │   ├── models.py        # AuditEvent, GdprRequest
│   │   │   ├── events.py        # AuditLogged
│   │   │   └── exceptions.py
│   │   ├── application/
│   │   │   ├── services.py      # AuditService, GdprService
│   │   │   ├── commands.py
│   │   │   └── queries.py       # SearchAuditLog, GetGdprData
│   │   ├── infrastructure/
│   │   │   ├── models.py        # AuditEventModel (partitioned)
│   │   │   └── repositories.py
│   │   ├── api/
│   │   │   ├── views.py         # AuditViewSet, GdprViewSet
│   │   │   ├── serializers.py
│   │   │   └── urls.py
│   │   └── tests/
│   │
│   └── search/                  # Full-text search, vector search, hybrid
│       ├── __init__.py
│       ├── apps.py
│       ├── domain/
│       │   ├── models.py        # SearchIndex, SearchQuery
│       │   ├── events.py
│       │   └── exceptions.py
│       ├── application/
│       │   ├── services.py      # SearchService, IndexService
│       │   └── queries.py
│       ├── infrastructure/
│       │   ├── models.py
│       │   ├── repositories.py
│       │   ├── search_engine.py # Full-text + vector search implementation
│       │   └── admin.py
│       ├── api/
│       │   ├── views.py         # GlobalSearchView
│       │   ├── serializers.py
│       │   └── urls.py
│       └── tests/
│
├── common/                      # Shared utilities (not domain-related)
│   ├── __init__.py
│   ├── decorators.py            # @format_time, @capture_metrics
│   ├── exceptions.py            # BaseException classes (non-domain)
│   ├── pagination.py            # Custom pagination classes
│   ├── renderers.py             # Custom DRF renderers
│   └── throttling.py            # Custom rate limit classes
│
├── infrastructure/              # Global infrastructure setup
│   ├── __init__.py
│   ├── open_telemetry.py        # OpenTelemetry configuration
│   ├── prometheus.py            # Prometheus metrics exporter
│   ├── sentry.py                # Sentry error tracking (if used)
│   └── structlog_setup.py       # structlog configuration
│
├── templates/                   # Django templates
│   ├── admin/                   # Admin template overrides
│   ├── emails/                  # Email templates (HTML + TXT)
│   │   ├── welcome.html
│   │   ├── password_reset.html
│   │   └── invitation.html
│   └── base.html
│
├── static/                      # Static files (collected by collectstatic)
│   └── admin/                   # Admin CSS/JS overrides
│
└── media/                       # User-uploaded files (in dev — MinIO in prod)
    └── .gitkeep

├── manage.py
└── requirements/               # (Poetry handles deps; these are reference files)
```

---

## 3. AI Gateway

```
ai_gateway/
├── app/
│   ├── __init__.py
│   ├── main.py                  # FastAPI application entrypoint
│   ├── dependencies.py          # Dependency injection (auth, org context)
│   │
│   ├── api/                     # Route handlers
│   │   ├── __init__.py
│   │   ├── chat.py              # POST /v1/chat/completions
│   │   ├── embeddings.py        # POST /v1/embeddings
│   │   ├── rag.py               # POST /v1/rag/query
│   │   ├── analyze.py           # POST /v1/analyze/sentiment
│   │   ├── prompts.py           # GET/POST /v1/prompts
│   │   ├── tools.py             # GET /v1/tools, POST /v1/tools/call
│   │   └── health.py            # GET /v1/health
│   │
│   ├── services/                # Business logic
│   │   ├── __init__.py
│   │   ├── llm_service.py       # LLM proxy, provider routing, retry
│   │   ├── embedding_service.py # Embedding generation + batch processing
│   │   ├── rag_service.py       # Hybrid search + context assembly
│   │   ├── sentiment_service.py # Sentiment analysis
│   │   ├── prompt_service.py    # Prompt template management
│   │   └── mcp_service.py       # MCP tool registration + execution
│   │
│   ├── domain/                  # Domain models (AI-specific)
│   │   ├── __init__.py
│   │   ├── models.py            # ChatRequest, EmbeddingRequest, RAGQuery
│   │   ├── value_objects.py     # TokenUsage, ModelConfig, Provider
│   │   └── exceptions.py        # ProviderError, RateLimitError, ContextOverflow
│   │
│   ├── infrastructure/          # External integrations
│   │   ├── __init__.py
│   │   ├── providers/
│   │   │   ├── __init__.py      # Base provider interface
│   │   │   ├── openai.py        # OpenAI API client
│   │   │   ├── anthropic.py     # Anthropic API client
│   │   │   └── fallback.py      # Provider fallback logic
│   │   ├── vector_store.py      # pgvector client for similarity search
│   │   ├── django_client.py     # HTTP client to Django backend
│   │   ├── cache.py             # Response caching (Redis)
│   │   └── monitoring.py        # Token usage tracking, cost logging
│   │
│   ├── mcp/                     # Model Context Protocol implementation
│   │   ├── __init__.py
│   │   ├── server.py            # MCP server (tool registration, routing)
│   │   ├── tools/
│   │   │   ├── __init__.py
│   │   │   ├── search_leads.py  # Tool: search leads
│   │   │   ├── get_pipeline.py  # Tool: get pipeline summary
│   │   │   ├── send_email.py    # Tool: send email via CRM
│   │   │   ├── create_task.py   # Tool: create follow-up task
│   │   │   └── get_forecast.py  # Tool: get sales forecast
│   │   └── schemas.py           # JSON Schema definitions for tools
│   │
│   └── tests/
│       ├── __init__.py
│       ├── test_chat.py
│       ├── test_embeddings.py
│       ├── test_rag.py
│       ├── test_mcp.py
│       └── test_providers.py
│
├── config/
│   ├── __init__.py
│   ├── settings.py              # FastAPI settings (Pydantic Settings)
│   ├── logging.py               # Logging configuration
│   └── middleware.py             # CORS, auth, rate limit middleware
│
├── Dockerfile                   # AI Gateway container image
├── pyproject.toml               # Python dependencies (Poetry)
└── alembic/                     # (If separate DB - currently uses pgvector in main DB)
    ├── alembic.ini
    └── versions/
```

---

## 4. Frontend

```
frontend/
├── public/
│   ├── favicon.ico
│   ├── manifest.json
│   └── robots.txt
│
├── src/
│   ├── main.tsx                  # React entrypoint
│   ├── App.tsx                   # Root component with providers
│   ├── vite-env.d.ts             # Vite type declarations
│   │
│   ├── components/               # Shared UI components (dumb)
│   │   ├── ui/                   # Primitive UI components (MUI wrappers)
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Table.tsx
│   │   │   ├── FormField.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Avatar.tsx
│   │   │   ├── Breadcrumbs.tsx
│   │   │   ├── DropdownMenu.tsx
│   │   │   └── index.ts          # Barrel export
│   │   ├── layout/               # Layout components
│   │   │   ├── AppLayout.tsx     # Authenticated layout (sidebar + topbar)
│   │   │   ├── AuthLayout.tsx    # Login/register layout
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Topbar.tsx
│   │   │   ├── SidebarItem.tsx
│   │   │   └── BreadcrumbNav.tsx
│   │   ├── feedback/             # Feedback components
│   │   │   ├── Toast.tsx
│   │   │   ├── ConfirmDialog.tsx
│   │   │   ├── LoadingOverlay.tsx
│   │   │   └── EmptyState.tsx
│   │   └── data/                 # Data display components
│   │       ├── DataTable.tsx     # Generic sortable/filterable table
│   │       ├── Pagination.tsx
│   │       ├── SearchInput.tsx
│   │       ├── FilterBar.tsx
│   │       ├── StatusBadge.tsx
│   │       └── Timeline.tsx     # Entity activity timeline
│   │
│   ├── features/                 # Feature modules (domain-specific)
│   │   ├── auth/                 # Authentication feature
│   │   │   ├── components/
│   │   │   │   ├── LoginForm.tsx
│   │   │   │   ├── RegisterForm.tsx
│   │   │   │   ├── ForgotPasswordForm.tsx
│   │   │   │   └── ResetPasswordForm.tsx
│   │   │   ├── pages/
│   │   │   │   ├── LoginPage.tsx
│   │   │   │   ├── RegisterPage.tsx
│   │   │   │   ├── ForgotPasswordPage.tsx
│   │   │   │   └── ResetPasswordPage.tsx
│   │   │   └── index.ts
│   │   │
│   │   ├── leads/                # Lead management feature
│   │   │   ├── components/
│   │   │   │   ├── LeadTable.tsx
│   │   │   │   ├── LeadForm.tsx
│   │   │   │   ├── LeadDetail.tsx
│   │   │   │   ├── LeadTimeline.tsx
│   │   │   │   ├── LeadScoreBadge.tsx
│   │   │   │   ├── LeadConvertDialog.tsx
│   │   │   │   └── LeadImportDialog.tsx
│   │   │   ├── pages/
│   │   │   │   ├── LeadListPage.tsx
│   │   │   │   ├── LeadDetailPage.tsx
│   │   │   │   ├── LeadCreatePage.tsx
│   │   │   │   └── LeadImportPage.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useLeads.ts       # TanStack Query hooks
│   │   │   │   ├── useLead.ts
│   │   │   │   └── useLeadMutations.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── opportunities/         # Pipeline & opportunity feature
│   │   │   ├── components/
│   │   │   │   ├── PipelineBoard.tsx    # Kanban board
│   │   │   │   ├── PipelineColumn.tsx
│   │   │   │   ├── OpportunityCard.tsx
│   │   │   │   ├── OpportunityForm.tsx
│   │   │   │   ├── OpportunityDetail.tsx
│   │   │   │   └── StageTransitionDialog.tsx
│   │   │   ├── pages/
│   │   │   │   ├── PipelinePage.tsx
│   │   │   │   ├── OpportunityDetailPage.tsx
│   │   │   │   └── ForecastPage.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── usePipeline.ts
│   │   │   │   └── useOpportunities.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── contacts/
│   │   ├── accounts/
│   │   ├── activities/
│   │   ├── tasks/
│   │   ├── calendar/
│   │   ├── workflows/
│   │   ├── notifications/
│   │   ├── reports/
│   │   ├── dashboards/
│   │   ├── ai/                   # AI assistant UI
│   │   │   ├── components/
│   │   │   │   ├── AiChatWidget.tsx
│   │   │   │   ├── AiSuggestionCard.tsx
│   │   │   │   └── AiQueryInput.tsx
│   │   │   └── hooks/
│   │   │       └── useAiQuery.ts
│   │   ├── settings/
│   │   ├── admin/
│   │   └── integrations/
│   │
│   ├── store/                    # Zustand client state
│   │   ├── index.ts              # Combined store export
│   │   ├── authStore.ts          # Auth state (user, tokens, org)
│   │   ├── uiStore.ts            # UI state (sidebar, theme, modals)
│   │   ├── notificationStore.ts  # Notification state
│   │   └── settingsStore.ts      # User preferences
│   │
│   ├── services/                 # API service layer
│   │   ├── api.ts                # Axios instance with interceptors
│   │   ├── authService.ts        # Auth endpoints
│   │   ├── leadService.ts        # Lead endpoints
│   │   ├── opportunityService.ts # Opportunity endpoints
│   │   ├── contactService.ts
│   │   ├── activityService.ts
│   │   ├── taskService.ts
│   │   ├── workflowService.ts
│   │   ├── notificationService.ts
│   │   ├── reportService.ts
│   │   ├── dashboardService.ts
│   │   ├── aiService.ts
│   │   ├── integrationService.ts
│   │   └── settingsService.ts
│   │
│   ├── hooks/                    # Shared React hooks
│   │   ├── useAuth.ts            # Authentication hook (wraps authStore)
│   │   ├── useTenant.ts          # Current tenant/organization
│   │   ├── usePagination.ts      # Pagination state
│   │   ├── useDebounce.ts
│   │   ├── useWebSocket.ts       # WebSocket connection
│   │   └── usePermissions.ts     # Permission checking
│   │
│   ├── layouts/                  # Page layout wrappers
│   │   ├── AppLayout.tsx
│   │   ├── AuthLayout.tsx
│   │   └── AdminLayout.tsx
│   │
│   ├── pages/                    # Route-level page components
│   │   ├── DashboardPage.tsx     # Home dashboard
│   │   ├── NotFoundPage.tsx
│   │   └── UnauthorizedPage.tsx
│   │
│   ├── utils/                    # Utility functions
│   │   ├── formatters.ts         # Date, currency, number formatters
│   │   ├── validators.ts         # Form validation helpers
│   │   ├── constants.ts          # App constants, enums
│   │   └── permissions.ts        # Permission string helpers
│   │
│   └── types/                    # TypeScript type definitions
│       ├── api.ts                # API response/request types
│       ├── auth.ts               # User, JWT, session types
│       ├── lead.ts               # Lead, Contact, Account types
│       ├── opportunity.ts        # Pipeline, Opportunity, Stage types
│       ├── activity.ts           # Activity, Task types
│       ├── workflow.ts           # Workflow, Execution types
│       ├── notification.ts       # Notification types
│       ├── report.ts             # Report, Dashboard types
│       └── common.ts             # Shared types (PaginatedResponse, etc.)
│
├── vitest.config.ts              # Test configuration
├── tsconfig.json                 # TypeScript configuration
├── tsconfig.node.json            # Node TypeScript config
├── vite.config.ts                # Vite build configuration
├── package.json                  # Dependencies and scripts
├── index.html                    # HTML entrypoint
└── Dockerfile                    # Frontend container image (for SSR/API proxy if needed)
```

---

## 5. Mobile

```
mobile/                           # React Native (placeholder for Phase 2)
├── app/                          # Expo Router file-based routing
│   ├── _layout.tsx
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   ├── login.tsx
│   │   └── register.tsx
│   └── (app)/
│       ├── _layout.tsx
│       ├── index.tsx             # Dashboard
│       ├── leads/
│       │   ├── index.tsx         # Lead list
│       │   └── [id].tsx          # Lead detail
│       └── opportunities/
│           ├── index.tsx
│           └── [id].tsx
├── src/
│   ├── components/               # Shared mobile components
│   ├── services/                 # API client (same endpoints as frontend)
│   ├── hooks/
│   └── types/
├── app.json                      # Expo configuration
├── package.json
└── tsconfig.json
```

---

## 6. Infrastructure

```
infra/
├── terraform/                    # Infrastructure as Code (AWS)
│   ├── environments/
│   │   ├── dev/
│   │   │   ├── main.tf
│   │   │   ├── variables.tf
│   │   │   └── outputs.tf
│   │   ├── staging/
│   │   │   ├── main.tf
│   │   │   ├── variables.tf
│   │   │   └── outputs.tf
│   │   └── prod/
│   │       ├── main.tf
│   │       ├── variables.tf
│   │       └── outputs.tf
│   ├── modules/
│   │   ├── eks/                  # EKS cluster module
│   │   │   ├── main.tf
│   │   │   ├── variables.tf
│   │   │   └── outputs.tf
│   │   ├── rds/                  # PostgreSQL RDS module
│   │   ├── elasticache/          # Redis ElastiCache module
│   │   ├── mq/                   # Amazon MQ (RabbitMQ) module
│   │   ├── s3/                   # MinIO-or-equivalent S3 module
│   │   ├── networking/           # VPC, subnets, security groups
│   │   ├── alb/                  # Application Load Balancer
│   │   ├── cloudfront/           # CDN distribution
│   │   ├── waf/                  # Web Application Firewall
│   │   └── monitoring/           # CloudWatch, Prometheus, Grafana
│   └── backend.tf                # Terraform state backend (S3 + DynamoDB)
│
└── kubernetes/                   # K8s manifests (ArgoCD or kubectl)
    ├── namespaces/
    │   ├── backend.yaml
    │   ├── ai.yaml
    │   ├── data.yaml
    │   └── monitoring.yaml
    ├── backend/
    │   ├── deployment.yaml
    │   ├── service.yaml
    │   ├── hpa.yaml               # Horizontal Pod Autoscaler
    │   ├── configmap.yaml
    │   ├── secrets.yaml           # (via External Secrets Operator)
    │   └── pdb.yaml               # Pod Disruption Budget
    ├── celery/
    │   ├── deployment.yaml        # Multi-queue worker deployment
    │   ├── hpa.yaml
    │   └── celery-beat.yaml
    ├── ai-gateway/
    │   ├── deployment.yaml
    │   ├── service.yaml
    │   ├── hpa.yaml
    │   └── configmap.yaml
    ├── data/
    │   ├── postgresql/
    │   │   ├── statefulset.yaml
    │   │   ├── service.yaml
    │   │   ├── pvc.yaml
    │   │   └── backup-cronjob.yaml
    │   ├── redis/
    │   │   ├── statefulset.yaml
    │   │   └── service.yaml
    │   ├── rabbitmq/
    │   │   ├── statefulset.yaml
    │   │   └── service.yaml
    │   └── minio/
    │       ├── statefulset.yaml
    │       └── service.yaml
    ├── ingress/
    │   ├── ingress.yaml           # nginx-ingress rules
    │   └── cert-manager.yaml      # Let's Encrypt / ACM
    └── monitoring/
        ├── prometheus/
        │   ├── prometheus.yaml
        │   ├── service-monitor.yaml
        │   └── rules.yaml         # Alerting rules
        ├── grafana/
        │   ├── deployment.yaml
        │   ├── datasources.yaml
        │   └── dashboards/
        │       ├── api-overview.json
        │       ├── celery-monitoring.json
        │       ├── database-monitoring.json
        │       └── ai-cost-tracking.json
        └── opentelemetry/
            ├── collector.yaml
            └── exporter.yaml
```

---

## 7. Scripts

```
scripts/
├── devops/                       # DevOps automation scripts
│   ├── deploy.sh                 # Deploy to environment
│   ├── rollback.sh               # Rollback to previous version
│   ├── rotate-secrets.sh         # Rotate secrets in vault
│   ├── backup-db.sh              # Manual database backup
│   └── migrate-silo.sh           # Pool → Silo migration script
│
├── data/                         # Data management scripts
│   ├── anonymize.py              # Anonymize PII in production copy
│   ├── seed_data.py              # Seed development database
│   ├── bulk_import.py            # Bulk import from CSV/JSON
│   └── gdpr_export.py            # GDPR data export
│
└── seed/                         # Seed data files
    ├── leads.csv
    ├── contacts.csv
    └── demo_workflows.json
```

---

## 8. Documentation

```
docs/
├── ARCHITECTURE_OVERVIEW.md       # Original architecture overview
├── IMPLEMENTATION_PLAN.md         # Phased implementation roadmap
├── PROJECT_MEMORY.md              # Project memory / context file
│
├── 10_ArchitectureOverview.md     # Overview with tech stack, principles, trade-offs
├── 11_SystemArchitecture.md       # C4 diagrams, request/event/AI flows
├── 12_HighLevelDesign.md          # Module decomposition, cross-cutting concerns
├── 13_LowLevelDesign.md           # Class/sequence/state diagrams, DB schema
├── 14_ModuleDependencyMap.md      # Dependency graph, import-linter, governance
├── 15_ProjectStructure.md         # Directory tree, ownership, conventions
│
├── ModuleBlueprints/              # Detailed module specifications
│   ├── Identity_and_MultiTenancy.md
│   ├── Lead_Contact_Account.md          (planned)
│   ├── Pipeline_and_Opportunity.md      (planned)
│   ├── Activity_and_Task.md             (planned)
│   ├── Workflow_Engine.md               (planned)
│   ├── Notification_Engine.md           (planned)
│   ├── Reports_and_Dashboards.md        (planned)
│   ├── AI_Platform.md                   (planned)
│   └── Integration_Hub.md               (planned)
│
├── ArchitectureDecisionRecords/  # ADRs
│   └── (empty — ADRs to be created)
│
├── APIContracts/                 # OpenAPI specifications
│   └── (empty — generated by drf-spectacular)
│
├── DatabaseSchemas/              # DB schema documentation
│   └── (empty — generated by django-extensions)
│
└── UIUX/                         # UI/UX design artifacts
    └── (empty — Figma links instead)
```

---

## 9. CI/CD

```
.github/
├── workflows/
│   ├── ci.yml                    # Main CI: lint → typecheck → test → build
│   ├── cd-staging.yml            # Deploy to staging
│   ├── cd-production.yml         # Deploy to production (manual approval)
│   ├── security-scan.yml         # Security vulnerability scanning
│   ├── dependency-check.yml      # Dependency vulnerability audit
│   └── docs.yml                  # Documentation generation / deployment
│
├── actions/
│   ├── setup-python/             # Reusable Python setup action
│   │   └── action.yml
│   ├── setup-node/               # Reusable Node setup action
│   │   └── action.yml
│   └── deploy-k8s/               # Reusable K8s deploy action
│       └── action.yml
│
├── CODEOWNERS                    # Repository code ownership
├── dependabot.yml                # Dependabot configuration
└── labeler.yml                   # PR labeler rules
```

---

## 10. Ownership & Responsibilities

| Directory | Owner | Responsibility |
|-----------|-------|---------------|
| `backend/config/` | Platform Architecture | Django settings, WSGI/ASGI, Celery config, middleware |
| `backend/apps/shared_kernel/` | Platform Architecture | Foundation classes, base models, ports |
| `backend/apps/identity/` | Platform Architecture | Auth, JWT, sessions, password management |
| `backend/apps/organization/` | Platform Architecture | Org CRUD, membership, settings |
| `backend/apps/rbac/` | Platform Architecture | Roles, permissions, assignments |
| `backend/apps/tenant/` | Platform Architecture | RLS, tenant lifecycle, isolation |
| `backend/apps/lead_management/` | Domain Team | Lead, Contact, Account management |
| `backend/apps/pipeline_management/` | Domain Team | Pipeline stages, opportunities, forecast |
| `backend/apps/activity/` | Domain Team | Activity logging, task management |
| `backend/apps/calendar/` | Integrations Team | Calendar sync (Google, MS) |
| `backend/apps/workflow/` | Platform Architecture | Workflow engine, conditions, actions |
| `backend/apps/notification/` | Platform Architecture | Multi-channel notification delivery |
| `backend/apps/reports/` | Domain Team | Report builder, analytics, forecasting |
| `backend/apps/dashboard/` | Frontend Team | Dashboard widgets, layout |
| `backend/apps/ai/` | AI Team | AI orchestration, NLP features |
| `backend/apps/voice_ai/` | AI Team | Voice AI, call logging |
| `backend/apps/integrations/` | Integrations Team | Connector SDK, webhooks, OAuth |
| `backend/apps/settings/` | Platform Architecture | App settings, feature flags |
| `backend/apps/audit/` | Platform Architecture | Audit log, GDPR compliance |
| `backend/apps/search/` | Platform Architecture | Full-text + vector search |
| `backend/common/` | Platform Architecture | Shared utilities |
| `backend/infrastructure/` | Platform Architecture | OpenTelemetry, metrics, logging |
| `ai_gateway/` | AI Team | FastAPI sidecar, LLM proxy, MCP |
| `frontend/` | Frontend Team | React SPA |
| `mobile/` | Mobile Team (future) | React Native app |
| `infra/terraform/` | Platform Architecture | AWS infrastructure |
| `infra/kubernetes/` | Platform Architecture | K8s manifests |
| `scripts/` | All teams | Automation scripts |
| `docs/` | All teams | Documentation |
| `.github/` | Platform Architecture | CI/CD workflows |

---

## 11. Naming Conventions

### 11.1 Python / Django

| Element | Convention | Example |
|---------|-----------|---------|
| Django app label | snake_case | `lead_management`, `pipeline_management` |
| Python package | snake_case | `apps/lead_management/infrastructure/` |
| Python class | PascalCase | `LeadService`, `CreateLeadCommand` |
| Python function/method | snake_case | `create_lead()`, `get_by_id()` |
| Python variable | snake_case | `lead_id`, `organization` |
| Module-level constant | UPPER_SNAKE | `MAX_RETRY_COUNT = 3` |
| Django model class | PascalCase + Model suffix | `LeadModel`, `ContactModel` |
| Django model field | snake_case | `first_name`, `organization_id` |
| Django model table | snake_case (auto) | `lead_management_leads` |
| Django model Meta.db_table | snake_case | `db_table = "lead_management_leads"` |
| ViewSet | PascalCase + ViewSet | `LeadViewSet`, `ContactViewSet` |
| Serializer | PascalCase + Serializer | `LeadSerializer`, `LeadListSerializer` |
| Permission | PascalCase + Permission | `LeadPermission`, `OrgAdminPermission` |
| FilterSet | PascalCase + FilterSet | `LeadFilterSet` |
| Domain event | PascalCase | `LeadCreated`, `OpportunityWon` |
| Domain exception | PascalCase + Error | `LeadNotFoundError`, `InvalidTransitionError` |
| Value Object | PascalCase | `Email`, `Phone`, `Money`, `Address` |
| DTO | PascalCase + DTO | `CreateLeadDTO`, `LeadResponseDTO` |
| Repository | PascalCase + Repository | `DjangoLeadRepository` |
| Selector | PascalCase + Selector | `LeadSearchSelector` |
| Migration name | descriptive | `0002_add_lead_score_field.py` |
| Celery task function | snake_case | `execute_workflow`, `send_notification` |
| Management command | snake_case | `bulk_import_leads`, `recalculate_scores` |

### 11.2 TypeScript / React

| Element | Convention | Example |
|---------|-----------|---------|
| File name (component) | PascalCase | `LeadTable.tsx`, `LoginForm.tsx` |
| File name (hook) | camelCase | `useLeads.ts`, `useAuth.ts` |
| File name (service) | camelCase | `leadService.ts`, `authService.ts` |
| File name (type) | camelCase | `lead.ts`, `opportunity.ts` |
| React component | PascalCase | `function LeadTable() { ... }` |
| React hook | use + PascalCase | `useLeads()`, `useAuth()` |
| Function | camelCase | `formatCurrency()`, `validateEmail()` |
| Variable | camelCase | `leadData`, `organizationId` |
| Constant | UPPER_SNAKE | `MAX_PAGE_SIZE = 100` |
| Type/Interface | PascalCase | `interface Lead { ... }` |
| Enum | PascalCase | `enum LeadStatus { ... }` |
| Enum member | UPPER_SNAKE | `LeadStatus.NEW`, `LeadStatus.QUALIFIED` |
| CSS class | kebab-case | `lead-table`, `status-badge` |
| Zustand store | camelCase + Store | `authStore`, `uiStore` |
| Query key | array of strings | `['leads', { orgId, status }]` |
| Directory (feature) | kebab-case | `leads/`, `opportunities/` |
| Directory (shared) | camelCase | `components/ui/`, `utils/` |

### 11.3 Infrastructure

| Element | Convention | Example |
|---------|-----------|---------|
| Terraform module name | snake_case | `eks_cluster`, `rds_instance` |
| K8s resource name | kebab-case | `django-app`, `ai-gateway` |
| K8s label | kebab-case | `app.kubernetes.io/name: django` |
| Docker image tag | semver + git-sha | `v1.2.3-a1b2c3d` |
| Environment name | lowercase | `dev`, `staging`, `prod` |
| Helm chart name | kebab-case | `tzahu-backend`, `tzahu-ai` |
| DNS record | lowercase | `api.tzahu.com`, `app.tzahu.com` |

### 11.4 Database

| Element | Convention | Example |
|---------|-----------|---------|
| Table name | `{module}_{entity}` | `lead_management_leads` |
| Column name | snake_case | `first_name`, `organization_id` |
| Primary key | `id` (UUID v7) | `id UUID PRIMARY KEY DEFAULT uuid7()` |
| Foreign key | `{referenced_table}_id` | `organization_id`, `created_by_id` |
| Index name | `idx_{table}_{column}` | `idx_leads_org_status` |
| Unique constraint | `uniq_{table}_{columns}` | `uniq_users_email` |
| RLS policy | `tenant_isolation_{table}` | `tenant_isolation_lead_management_leads` |
| Check constraint | `ck_{table}_{rule}` | `ck_leads_status_valid` |
| Trigger | `trg_{table}_{action}` | `trg_leads_search_vector_update` |

### 11.5 API

| Element | Convention | Example |
|---------|-----------|---------|
| URL path | kebab-case, plural | `/api/v1/leads/`, `/api/v1/lead-forms/` |
| URL path parameter | snake_case | `/api/v1/leads/{lead_id}/` |
| Query parameter | snake_case | `?created_at_gte=2026-01-01&status=NEW` |
| Request body field | snake_case | `first_name`, `created_by_id` |
| Response body field | snake_case | `total_count`, `lead_id` |
| Error code | UPPER_SNAKE | `LEAD_NOT_FOUND`, `VALIDATION_ERROR` |
| Permission name | `{entity}.{action}` | `lead.create`, `opportunity.read` |
| Event routing key | `{module}.{entity}.{action}` | `lead_management.lead.created` |

---

> **Version:** 0.1.0-draft | **Last Updated:** 2026-07-27
> **Cross-reference:** [10_ArchitectureOverview.md](./10_ArchitectureOverview.md),
> [12_HighLevelDesign.md](./12_HighLevelDesign.md),
> [13_LowLevelDesign.md](./13_LowLevelDesign.md),
> [14_ModuleDependencyMap.md](./14_ModuleDependencyMap.md)
