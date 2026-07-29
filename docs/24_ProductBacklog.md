# TZAHU CRM — Product Backlog

> **Version:** 0.1.0-draft
> **Last Updated:** 2026-07-27
> **Status:** Approved
> **Owner:** Product Management

---

## Table of Contents

1. [Backlog Management Process](#1-backlog-management-process)
2. [Epic Overview](#2-epic-overview)
3. [Epic Detail: Identity & Auth](#3-epic-detail-identity--auth)
4. [Epic Detail: Multi-Tenancy](#4-epic-detail-multi-tenancy)
5. [Epic Detail: CRM Core](#5-epic-detail-crm-core)
6. [Epic Detail: Sales Pipeline](#6-epic-detail-sales-pipeline)
7. [Epic Detail: Activities & Tasks](#7-epic-detail-activities--tasks)
8. [Epic Detail: Workflow Automation](#8-epic-detail-workflow-automation)
9. [Epic Detail: AI Platform](#9-epic-detail-ai-platform)
10. [Epic Detail: Voice AI](#10-epic-detail-voice-ai)
11. [Epic Detail: Notifications](#11-epic-detail-notifications)
12. [Epic Detail: Reports & Analytics](#12-epic-detail-reports--analytics)
13. [Epic Detail: Integration Hub](#13-epic-detail-integration-hub)
14. [Epic Detail: Settings & Administration](#14-epic-detail-settings--administration)
15. [Epic Detail: Audit & Compliance](#15-epic-detail-audit--compliance)
16. [Technical Debt](#16-technical-debt)
17. [Known Bugs](#17-known-bugs)
18. [Future Ideas / Icebox](#18-future-ideas--icebox)

---

## 1. Backlog Management Process

### Refinement Cadence
- **Weekly backlog refinement** (30 min): Review top 10 items, estimate, clarify.
- **Bi-weekly sprint planning** (1 hour): Select items for next sprint, break into tasks.
- **Monthly roadmap review** (1 hour): Re-prioritize epics, adjust release scope.

### Estimation
- Story points: Fibonacci (1, 2, 3, 5, 8, 13, 21).
- 1 point = ~half-day of work for a senior engineer.
- Team velocity target: 30-40 points per 2-week sprint.

### Prioritization Framework (RICE)
- **Reach**: How many users/customers does this affect?
- **Impact**: How much does this improve the product (0.25x, 0.5x, 1x, 2x, 3x)?
- **Confidence**: How sure are we of the estimates (low/medium/high)?
- **Effort**: Estimated story points.

Priority Score = (Reach * Impact * Confidence) / Effort

### Backlog States
| State | Description |
|-------|-------------|
| Icebox | Future idea, no immediate plans |
| Backlog | Refined, estimated, waiting for sprint |
| Sprint | Selected for current sprint |
| In Progress | Being worked on |
| Review | Code review / QA |
| Done | Merged to main |
| Blocked | Waiting on dependency or decision |

---

## 2. Epic Overview

| # | Epic | Business Value | Priority | SP Estimate | Target Release |
|---|------|---------------|----------|-------------|----------------|
| E1 | Identity & Auth | Foundation — required for all other features | P0-critical | 34 | R1 |
| E2 | Multi-Tenancy | Foundation — core differentiator | P0-critical | 21 | R1 |
| E3 | CRM Core | Primary value proposition | P0-critical | 55 | R1 |
| E4 | Sales Pipeline | Revenue-driving feature | P0-critical | 34 | R1 |
| E5 | Activities & Tasks | User engagement and productivity | P1-high | 21 | R1 |
| E6 | Workflow Automation | Key automation differentiator | P1-high | 40 | R2 |
| E7 | AI Platform | AI-first differentiator | P1-high | 55 | R2 |
| E8 | Voice AI | Innovative AI feature | P2-medium | 34 | R3 |
| E9 | Notifications | Cross-channel engagement | P1-high | 21 | R2 |
| E10 | Reports & Analytics | Enterprise requirement | P1-high | 34 | R2 |
| E11 | Integration Hub | Ecosystem expansion | P2-medium | 40 | R3 |
| E12 | Settings & Administration | Foundation | P1-high | 13 | R1 |
| E13 | Audit & Compliance | Enterprise requirement | P2-medium | 21 | R4 |

**Total estimated effort:** 423 story points (~21 sprints ~10 months)

---

## 3. Epic Detail: Identity & Auth

**Epic ID:** E1
**Business Value:** Foundation for all user interactions. Secure auth is table stakes.
**Priority:** P0-critical
**Dependencies:** None
**Target Release:** R1
**Estimated SP:** 34
**Owner:** Platform Architecture

### Stories

| ID | Title | Description | SP | Acceptance Criteria |
|----|-------|-------------|----|-------------------|
| E1-1 | User registration | Users can register with email + password | 5 | Valid email, strong password, email verification required, duplicate email rejected |
| E1-2 | User login | Users can login with email + password | 3 | JWT access + refresh tokens returned, rate-limited (5/min), lockout after 5 failures |
| E1-3 | JWT token management | Access token (15min), refresh token (7d, rotation) | 5 | RS256 signed, proper expiration, rotation invalidates old token, blacklist on logout |
| E1-4 | Password management | Forgot password, reset password, change password | 5 | Email with reset link, token expires in 1h, password history enforced, Argon2id hashing |
| E1-5 | Email verification | Verify email during registration | 3 | Verification link sent, 24h expiry, resend allowed after 60s |
| E1-6 | Session management | List active sessions, revoke session | 3 | Show device/browser/IP, revoke single or all sessions |
| E1-7 | MFA enrollment | TOTP-based MFA setup and verification | 8 | QR code, backup codes (10), verification before enable, per-org policy |
| E1-8 | Account lockout | Lock account after repeated failed attempts | 2 | 5 attempts, 15min lockout, auto-unlock, admin can unlock |

---

## 4. Epic Detail: Multi-Tenancy

**Epic ID:** E2
**Business Value:** Core differentiator — enterprise-grade tenant isolation.
**Priority:** P0-critical
**Dependencies:** E1
**Target Release:** R1
**Estimated SP:** 21
**Owner:** Platform Architecture

### Stories

| ID | Title | Description | SP | Acceptance Criteria |
|----|-------|-------------|----|-------------------|
| E2-1 | Organization CRUD | Create, read, update organization | 5 | Name, domain, tier, status lifecycle; org admin role assignment |
| E2-2 | Membership management | Invite users, accept/reject invite, remove member | 5 | Email invitation with token, role assignment on accept, member listing |
| E2-3 | RLS policy generation | Auto-generate RLS policies for new tables | 5 | 4 policies per table (SELECT/INSERT/UPDATE/DELETE), FORCE RLS, system admin bypass |
| E2-4 | Tenant context middleware | Set org context per request via JWT + middleware | 3 | app.current_org_id set in DB session, Celery task context propagation |
| E2-5 | Tenant isolation testing | Automated tests for cross-tenant data leak prevention | 3 | All endpoints tested, 10000+ assertions, CI gate |

---

## 5. Epic Detail: CRM Core

**Epic ID:** E3
**Business Value:** Primary product — this IS the CRM.
**Priority:** P0-critical
**Dependencies:** E1, E2
**Target Release:** R1
**Estimated SP:** 55
**Owner:** CRM Team

### Stories

| ID | Title | Description | SP | Acceptance Criteria |
|----|-------|-------------|----|-------------------|
| E3-1 | Lead CRUD | Create, list, view, update, soft-delete leads | 8 | All fields: company, email, phone, website, description, source, status, score; validation, pagination, filtering, sorting |
| E3-2 | Lead deduplication | Detect and prevent duplicate leads per org | 5 | Email uniqueness enforced, fuzzy name matching suggested, merge UI |
| E3-3 | Lead assignment | Assign lead to user, reassign, auto-assign rules | 5 | Assign to user/team, round-robin auto-assignment, reassignment history |
| E3-4 | Lead scoring | Rule-based scoring (demographic + behavioral) | 5 | Configurable rules, score range 0-100, score history, score-based routing |
| E3-5 | Contact CRUD | Create, list, view, update, soft-delete contacts | 5 | Name, email, phone, job title, company, address, social links, linked leads |
| E3-6 | Account CRUD | Create, list, view, update, soft-delete accounts | 5 | Name, domain, industry, size, website, address, linked contacts |
| E3-7 | Lead conversion | Convert lead to contact with data mapping | 5 | Select fields to carry over, optional account creation, link to opportunity |
| E3-8 | Bulk import | CSV import for leads and contacts | 8 | Column mapping, validation report, progress tracking, error recovery, 50k rows |
| E3-9 | Bulk export | CSV/Excel export for leads and contacts | 3 | All fields or selected, date range filter, async processing, email notification |
| E3-10 | Merge duplicates | Merge duplicate leads/contacts/accounts | 5 | Select master record, field-level conflict resolution, history preserved |
| E3-11 | Activity timeline | Show all activities for a lead/contact/account | 3 | Chronological feed, filterable by type, paginated |

---

## 6. Epic Detail: Sales Pipeline

**Epic ID:** E4
**Business Value:** Core revenue management feature.
**Priority:** P0-critical
**Dependencies:** E3
**Target Release:** R1
**Estimated SP:** 34
**Owner:** Pipeline Team

### Stories

| ID | Title | Description | SP | Acceptance Criteria |
|----|-------|-------------|----|-------------------|
| E4-1 | Pipeline CRUD | Create, list, view, update, delete pipelines | 3 | Name, stages (ordered list), default for org, visibility settings |
| E4-2 | Stage management | Add, reorder, rename, delete stages | 3 | Stages create opportunity lifecycle, drag-drop reorder, stage probability |
| E4-3 | Opportunity CRUD | Create, list, view, update, soft-delete opportunities | 8 | Title, value, probability, stage, assigned to, close date, lead source, notes |
| E4-4 | Stage transition | Move opportunity through pipeline stages | 5 | Validation rules per transition, stage change notifications, win/loss reason capture |
| E4-5 | Kanban board view | Visual pipeline with drag-drop cards | 8 | Drag between stages, card summary, total value per stage, WIP limits |
| E4-6 | Pipeline analytics | Summary metrics per pipeline | 3 | Total value, weighted value, deal count, stage velocity, conversion rate |
| E4-7 | Forecasting | Revenue forecast based on pipeline data | 5 | Current quarter forecast, probability-weighted, category-based |
| E4-8 | Win/loss analysis | Track win/loss reasons and trends | 3 | Reason capture on close, reporting by reason, trends over time |

---

## 7. Epic Detail: Activities & Tasks

**Epic ID:** E5
**Business Value:** User productivity and engagement.
**Priority:** P1-high
**Dependencies:** E3
**Target Release:** R1
**Estimated SP:** 21
**Owner:** Platform Team

### Stories

| ID | Title | Description | SP | Acceptance Criteria |
|----|-------|-------------|----|-------------------|
| E5-1 | Activity logging | Auto-log activities on entity changes | 5 | Activity types: note, call, email, meeting, system; linked to any entity; immutable |
| E5-2 | Manual activity entry | Users can log manual activities | 3 | Type, description, date/time, duration, outcome, link to entity |
| E5-3 | Task CRUD | Create, list, view, update, complete, delete tasks | 5 | Title, description, due date, priority, assignee, status, related entity |
| E5-4 | Task assignment | Assign tasks to users, reassign | 3 | Single user, due date notification, reassignment history |
| E5-5 | Task dashboard | User task list with filters and sorting | 3 | By status, priority, due date, entity; my tasks vs team tasks |
| E5-6 | Task reminders | Email and in-app reminders for due tasks | 2 | Configurable: 1h, 24h, 48h before due date |

---

## 8. Epic Detail: Workflow Automation

**Epic ID:** E6
**Business Value:** Key automation differentiator.
**Priority:** P1-high
**Dependencies:** E1, E2, E3
**Target Release:** R2
**Estimated SP:** 40
**Owner:** Workflow Team

### Stories

| ID | Title | Description | SP | Acceptance Criteria |
|----|-------|-------------|----|-------------------|
| E6-1 | Workflow CRUD | Create, list, view, update, enable/disable workflows | 8 | Name, description, trigger type, conditions, actions; versioned |
| E6-2 | Event triggers | Trigger workflow on domain events | 5 | All domain events available as triggers, event payload accessible in conditions |
| E6-3 | Scheduled triggers | Time/schedule-based workflow triggers | 5 | Cron expression, timezone-aware, one-time or recurring |
| E6-4 | Condition evaluator | Evaluate conditions with AND/OR nesting | 8 | AND/OR nesting, field comparison, date math, user attribute access |
| E6-5 | Action executor | Execute actions (send email, create task, update field, assign) | 8 | All action types, retry on failure, action logging |
| E6-6 | Execution history | Log every workflow execution with result | 3 | Status (success/failure), input/output, duration, error message, retry count |
| E6-7 | Loop detection | Prevent infinite workflow loops | 3 | Max execution depth (10), cycle detection, circuit breaker |

---

## 9. Epic Detail: AI Platform

**Epic ID:** E7
**Business Value:** AI-first differentiator — core of TZAHU's value proposition.
**Priority:** P1-high
**Dependencies:** E1, E2, E3, AI Gateway
**Target Release:** R2
**Estimated SP:** 55
**Owner:** AI Team

### Stories

| ID | Title | Description | SP | Acceptance Criteria |
|----|-------|-------------|----|-------------------|
| E7-1 | AI Gateway setup | FastAPI sidecar for LLM proxy, provider routing | 8 | OpenAI + Anthropic providers, provider fallback, token tracking, cost logging |
| E7-2 | AI chat assistant | Conversational AI within CRM context | 8 | Chat UI, CRM-aware (search leads, get summary, create task), tool-calling via MCP |
| E7-3 | AI lead scoring | ML-based lead scoring using embeddings + rules | 8 | Score 0-100, explainable factors, configurable model, batch scoring via Celery |
| E7-4 | Smart suggestions | AI-suggested next actions for leads/opportunities | 5 | Based on lead data + historical patterns, context-aware, dismiss/accept |
| E7-5 | Email composition | AI-generated email drafts from templates + context | 5 | Lead/contact context, tone selection (formal/casual), editable before send |
| E7-6 | Sentiment analysis | Analyze call and email sentiment | 5 | Positive/neutral/negative + score, trend tracking per contact |
| E7-7 | Entity extraction | Auto-extract entities from emails and notes | 5 | Contact info, company, dates, amounts; link to CRM entities |
| E7-8 | MCP tool protocol | Standardized tool interface for AI | 5 | Tool registration, schema generation, execution, result formatting |
| E7-9 | Prompt management | Manage prompt templates with variables | 3 | CRUD for prompts, versioned, A/B testing, usage analytics |
| E7-10 | AI usage dashboard | Track token usage, cost, and quality metrics | 3 | Per-org, per-user, per-model breakdown; cost alerts |

---

## 10. Epic Detail: Voice AI

**Epic ID:** E8
**Business Value:** Innovative AI-powered voice feature.
**Priority:** P2-medium
**Dependencies:** E7
**Target Release:** R3
**Estimated SP:** 34
**Owner:** AI Team

### Stories

| ID | Title | Description | SP | Acceptance Criteria |
|----|-------|-------------|----|-------------------|
| E8-1 | Call logging | Log incoming and outgoing calls with metadata | 5 | Twilio integration, caller ID, duration, direction, link to contact |
| E8-2 | Call transcription | Real-time and post-call transcription | 8 | Whisper/Deepgram integration, speaker diarization, searchable transcripts |
| E8-3 | Sentiment analysis | Real-time call sentiment monitoring | 5 | Per-speaker sentiment, overall call score, sentiment trends |
| E8-4 | Call coaching | AI-suggested talking points during calls | 5 | Based on lead data, opportunity stage, previous interactions |
| E8-5 | Call summaries | Auto-generated call summaries with action items | 5 | Key points, next steps, follow-up tasks created automatically |
| E8-6 | Call analytics | Dashboard of call metrics and trends | 3 | Call volume, duration, sentiment trends, outcome distribution |

---

## 11. Epic Detail: Notifications

**Epic ID:** E9
**Business Value:** Cross-channel user engagement.
**Priority:** P1-high
**Dependencies:** E1, E2, E3
**Target Release:** R2
**Estimated SP:** 21
**Owner:** Platform Team

### Stories

| ID | Title | Description | SP | Acceptance Criteria |
|----|-------|-------------|----|-------------------|
| E9-1 | Email notifications | Send transactional emails via SendGrid/SES | 8 | Templates (welcome, password reset, invitation), HTML+text, tracking |
| E9-2 | In-app notifications | Real-time notifications via WebSocket | 5 | Notification bell, dropdown list, mark-as-read, pagination |
| E9-3 | SMS notifications | Send SMS via Twilio | 3 | Templates, opt-in/opt-out per user, rate-limited |
| E9-4 | Push notifications | Mobile push via Firebase Cloud Messaging | 5 | iOS + Android, device registration, targeted by user |
| E9-5 | Slack notifications | Send notifications to Slack channels | 3 | Integration per org, configurable channel, event-filtered |
| E9-6 | Notification preferences | Per-user channel preferences per notification type | 3 | UI for preferences, defaults per org, channel opt-in |

---

## 12. Epic Detail: Reports & Analytics

**Epic ID:** E10
**Business Value:** Enterprise requirement for data-driven decisions.
**Priority:** P1-high
**Dependencies:** E3, E4
**Target Release:** R2
**Estimated SP:** 34
**Owner:** Data Team

### Stories

| ID | Title | Description | SP | Acceptance Criteria |
|----|-------|-------------|----|-------------------|
| E10-1 | Report builder | Drag-and-drop report builder | 13 | Add/remove fields, filters, grouping, aggregations; preview; save as named report |
| E10-2 | Report templates | Pre-built reports (pipeline summary, lead sources, activity) | 5 | 5 standard templates, cloned from template, customize and save |
| E10-3 | Report scheduling | Schedule reports for periodic email delivery | 5 | Daily/weekly/monthly, CSV/PDF/Excel format, recipient list |
| E10-4 | Dashboard creation | Create dashboards with multiple widgets | 5 | Drag-drop layout, widget types (chart, table, metric, KPI), share with team |
| E10-5 | Dashboard sharing | Share dashboards with users and teams | 3 | View-only or edit, expiration date, public link option |
| E10-6 | Export formats | CSV, Excel, PDF export for all reports | 3 | Consistent formatting, large file handling (streaming), email notification |

---

## 13. Epic Detail: Integration Hub

**Epic ID:** E11
**Business Value:** Ecosystem expansion and data exchange.
**Priority:** P2-medium
**Dependencies:** E3, E4, E5
**Target Release:** R3
**Estimated SP:** 40
**Owner:** Integration Team

### Stories

| ID | Title | Description | SP | Acceptance Criteria |
|----|-------|-------------|----|-------------------|
| E11-1 | Connector SDK | SDK for building third-party integrations | 8 | Auth (OAuth2, API key), sync direction, field mapping, retry logic |
| E11-2 | Google Contacts sync | Two-way contact sync with Google Contacts | 5 | Initial sync, incremental sync, conflict resolution, frequency config |
| E11-3 | Google Calendar sync | Two-way calendar event sync | 5 | Create from CRM, show in Google Calendar, sync changes |
| E11-4 | Microsoft 365 sync | Contacts + Calendar sync with Microsoft Graph | 5 | Same as Google but via Microsoft Graph API |
| E11-5 | HubSpot migration | Import leads, contacts, deals from HubSpot | 5 | Full migration, field mapping UI, progress tracking, validation report |
| E11-6 | Mailchimp sync | Sync contacts to Mailchimp lists | 3 | One-direction (CRM to Mailchimp), list selection, field mapping |
| E11-7 | Webhook engine | Send and receive webhooks for real-time integration | 8 | Outgoing: event-based, custom payload, retry, logging. Incoming: signature verification, auth |
| E11-8 | OAuth vault | Secure storage of OAuth tokens | 3 | AES-256 encrypted storage, token refresh, rotation alerts |

---

## 14. Epic Detail: Settings & Administration

**Epic ID:** E12
**Business Value:** Foundation for configuration and control.
**Priority:** P1-high
**Dependencies:** E1, E2
**Target Release:** R1
**Estimated SP:** 13
**Owner:** Platform Team

### Stories

| ID | Title | Description | SP | Acceptance Criteria |
|----|-------|-------------|----|-------------------|
| E12-1 | User profile management | Edit profile, preferences, notification settings | 3 | Name, email, avatar, timezone, locale, theme |
| E12-2 | Organization settings | Configure org-level settings | 5 | Name, domain, branding, security policies (password, MFA, session), tier |
| E12-3 | Feature flags management | Enable/disable features per org or globally | 3 | Admin UI, percentage rollout, targeting by org/user, kill switch |
| E12-4 | Audit log viewer | View organization audit log | 2 | Filterable by event type, actor, date range; read-only |

---

## 15. Epic Detail: Audit & Compliance

**Epic ID:** E13
**Business Value:** Enterprise compliance requirement.
**Priority:** P2-medium
**Dependencies:** E1, E2, E12
**Target Release:** R4
**Estimated SP:** 21
**Owner:** Platform Team

### Stories

| ID | Title | Description | SP | Acceptance Criteria |
|----|-------|-------------|----|-------------------|
| E13-1 | Immutable audit log | Append-only audit event log with hash chain | 8 | All security events logged, SHA-256 chain, monthly partitions, 3yr retention |
| E13-2 | GDPR data export | Export all data for a user | 5 | JSON export, all PII, linked entities, activity history; async, email notification |
| E13-3 | GDPR right to erasure | Delete user + anonymize linked data | 5 | Hard delete user, anonymize created/updated by, keep audit trail, compliance report |
| E13-4 | Compliance reporting | SOC2/GDPR compliance reports | 3 | RLS verification report, access review report, data retention report |

---

## 16. Technical Debt

| ID | Item | Impact | Effort | Priority | Target |
|----|------|--------|--------|----------|--------|
| TD-1 | Remove unused fields from LeadModel | Cleaner schema, smaller table | 2 | Medium | R2 |
| TD-2 | Consolidate duplicate indexes | Performance improvement, reduced write overhead | 3 | Low | R2 |
| TD-3 | Replace custom pagination with DRF standard | Maintenance burden | 2 | Low | R2 |
| TD-4 | Migrate from UUID v4 to UUID v7 across all tables | Index fragmentation reduction | 5 | Medium | R2 |
| TD-5 | Remove deprecated GET /reports/legacy-summary/ | Clean API surface | 1 | Low | R3 |
| TD-6 | Upgrade Celery to 6.x when stable | Performance + features | 3 | Low | R3 |
| TD-7 | Query optimization pass on all list endpoints | Performance | 8 | Medium | R3 |
| TD-8 | Remove django-debug-toolbar from staging | Security | 1 | High | R1 |
| TD-9 | Replace os.path with pathlib everywhere | Modern Python | 3 | Low | R2 |
| TD-10 | Add missing type hints to infrastructure layer | Type safety | 5 | Medium | R2 |
| TD-11 | Split monolithic Celery worker into dedicated queues | Reliability | 5 | Medium | R2 |
| TD-12 | Implement connection pooling for Celery tasks | Performance | 3 | Low | R3 |

---

## 17. Known Bugs

| ID | Description | Severity | Status | Found | Target |
|----|-------------|----------|--------|-------|--------|
| BUG-1 | Pagination count returns wrong total when using search | Medium | Open | 2026-07-20 | R1-patch |
| BUG-2 | Lead export fails for > 10000 rows | Medium | Open | 2026-07-22 | R1-patch |
| BUG-3 | Activity timeline shows duplicate entries for bulk updates | Low | Open | 2026-07-24 | R2 |
| BUG-4 | Opportunity stage probability not recalculated on stage change | Low | Open | 2026-07-25 | R2 |
| BUG-5 | Password reset link expires before email is delivered | Medium | Open | 2026-07-26 | R1-patch |
| BUG-6 | Timezone not applied correctly in report date filters | Low | Open | 2026-07-27 | R2 |

---

## 18. Future Ideas / Icebox

| ID | Idea | Value | Effort | Notes |
|----|------|-------|--------|-------|
| IB-1 | Mobile app (React Native) | High | 55+ | Phase 2, post-R4 |
| IB-2 | Marketplace for community connectors | Medium | 34 | Post-R4 |
| IB-3 | AI-generated report insights | High | 21 | Needs AI platform first |
| IB-4 | Predictive lead scoring with custom ML models | Medium | 21 | Needs data volume |
| IB-5 | Territory management and routing | Medium | 13 | Enterprise feature |
| IB-6 | Contract management and e-signature | Medium | 21 | Partner integration |
| IB-7 | Customer portal (self-service) | Medium | 21 | Phase 2 |
| IB-8 | Gamification (leaderboards, badges) | Low | 13 | Post-R4 |
| IB-9 | CPQ (Configure, Price, Quote) | High | 34 | Major new module |
| IB-10 | Partner relationship management (PRM) | Medium | 21 | Separate product line |
| IB-11 | Marketing automation (email campaigns, drip sequences) | High | 34 | Natural extension |
| IB-12 | Dark mode UI | Low | 5 | Design polish |
| IB-13 | Keyboard shortcuts for power users | Low | 8 | UX improvement |
