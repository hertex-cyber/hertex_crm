# TZAHU CRM — Project Vision

> **Version:** 1.0.0
> **Last Updated:** 2026-07-27
> **Status:** Final
> **Owner:** Product Leadership

---

## Table of Contents

1. [Vision Statement](#1-vision-statement)
2. [The Problem We Solve](#2-the-problem-we-solve)
3. [Core Differentiators](#3-core-differentiators)
4. [Market Positioning](#4-market-positioning)
5. [Target Audience](#5-target-audience)
6. [Business Model](#6-business-model)
7. [Product Philosophy](#7-product-philosophy)
8. [Strategic Bets](#8-strategic-bets)
9. [Success Metrics](#9-success-metrics)
10. [Competitive Landscape](#10-competitive-landscape)
11. [Brand Principles](#11-brand-principles)

---

## 1. Vision Statement

> **TZAHU CRM will be the most adaptable AI-first enterprise CRM platform.**

Not the biggest. Not the most features. The most adaptable.

Adaptability means the CRM molds to any sales process rather than forcing the sales process to mold to the software. It means a 50-person B2B SaaS company and a 5,000-person manufacturing enterprise can use the same platform and have completely different experiences — because the platform adapts to their workflows, their data model, and their intelligence needs.

AI-first means artificial intelligence is not a feature tab in the sidebar. It is the fabric of the platform — every entity is embeddable, every action is automatable, every decision is augmentable. The CRM does not just store data; it understands it, acts on it, and gets smarter over time.

---

## 2. The Problem We Solve

### The CRM Status Quo Is Broken

| Problem | Manifestation | Cost |
|---------|--------------|------|
| **Rigid data models** | Salesforce requires consultants to customize; HubSpot's custom objects are limited | Months of implementation time, millions in consulting fees |
| **Stale architecture** | Most CRMs were built before AI, before cloud-native, before API-first design | No native embeddings, no LLM integration, no event-driven architecture |
| **Workflow lock-in** | Workflow automation is either basic (HubSpot) or requires coding (Salesforce) | Sales teams adapt to the software's workflow, not their own |
| **Data silos** | CRM doesn't integrate deeply with email, calendar, phone, Slack, ERP | Reps spend 40% of time on data entry, not selling |
| **AI is bolted on** | "AI features" are expensive add-ons that work on limited data | Low adoption, marginal value, no competitive advantage |
| **Cost at scale** | Enterprise CRM costs $150–$300/user/month for full functionality | Mid-market companies are priced out of good tools |

### The TZAHU Solution

TZAHU is built from the ground up to solve each of these:

1. **Custom objects and fields** from day one — users extend the data model without code
2. **AI-native architecture** — embeddings, prompts, and RAG are platform primitives
3. **Workflow-first design** — the entire CRM is programmable via visual workflows
4. **Deep integrations** — email sync, calendar sync, voice, Slack, and an open integration SDK
5. **AI as infrastructure** — every feature uses AI by default, not as an upsell
6. **Modular pricing** — pay for what you use, scale as you grow

---

## 3. Core Differentiators

### 1. AI-Native Architecture

Most CRM products add AI as a feature module in 2024–2025. TZAHU is built AI-native:

| Capability | Traditional CRM | TZAHU CRM |
|-----------|-----------------|------------|
| Entity data | Relational tables only | Relational + embedding vectors on every entity |
| Search | Keyword or basic full-text | Hybrid semantic + keyword with RLS-scoped vectors |
| Lead scoring | Rules-based or basic ML model | LLM-augmented scoring with explainable factors |
| Next-best-action | None or static suggestions | Real-time AI recommendations based on entity context |
| Email/communication | Stored as text | Sentiment-analyzed, summarized, action-item-extracted |
| Workflow triggers | Field changes only | Field changes + AI decisions + predicted outcomes |
| Prompt management | N/A | Versioned prompt templates with A/B testing |
| Custom AI agents | Not available | MCP-based tool-calling agents per tenant |

### 2. Workflow-First Design

TZAHU is a workflow engine that happens to have a CRM UI:

- **Triggers:** Entity events (created, updated, stage changed), schedule (cron), webhook, AI decision
- **Conditions:** Field comparison, date math, set membership, sub-queries, AI classification
- **Actions:** Update field, assign owner, send notification, trigger webhook, create task, call API, execute AI prompt
- **Templates:** Pre-built workflow templates for common patterns (auto-assign web leads, warm stale deals, follow-up after demo)

Every hardcoded business rule in a traditional CRM is a configurable workflow in TZAHU.

### 3. Modular Architecture

- **Modular monolith** — start simple, extract services when data proves the need
- **Bounded contexts** — each module owns its data, logic, and API
- **Event-driven** — modules communicate via domain events, not direct calls
- **Plug-and-play modules** — enable/disable features per tenant via feature flags

### 4. Enterprise-Grade Multi-Tenancy

- **Shared schema + RLS** — operational efficiency of a single database
- **Silo escape hatch** — dedicated database for enterprise/compliance tenants
- **Automated isolation testing** — every CI run validates cross-tenant isolation
- **Tenant lifecycle management** — provision → activate → suspend → reactivate → delete

### 5. Open Ecosystem

- **API-first** — all features available via REST API
- **Webhook-native** — every event can trigger outbound webhooks
- **Connector SDK** — build custom integrations in <100 lines of Python
- **Marketplace** — third-party apps and integrations (R4)

---

## 4. Market Positioning

### Positioning Statement

> For growth-minded sales organizations who need a CRM that adapts to their process,
> TZAHU is the AI-first CRM platform that combines enterprise-grade power with
> consumer-grade simplicity — unlike Salesforce that requires consultants to customize
> or HubSpot that limits your data model as you scale.

### Competitive Comparison

| Dimension | TZAHU | Salesforce | HubSpot | Dynamics 365 | Zoho | LeadSquared |
|-----------|-------|-----------|---------|-------------|------|-------------|
| **AI-native** | Built-in (embeddings, RAG, prompts) | Einstein (add-on, costly) | Breeze AI (limited, add-on) | Copilot (recent, limited) | Zia (basic) | Limited |
| **Workflow engine** | Visual, event-driven, AI-augmented | Process Builder (complex) | Simple, linear | Power Automate (complex) | Basic | Basic |
| **Custom objects** | First-class, API-managed | Custom objects (limits) | Limited (paid add-on) | Yes (complex) | Yes | No |
| **Multi-tenancy** | Pool + Silo (enterprise) | Org-per-customer | Account-per-customer | Tenant-based | Org-based | Single-tenant |
| **API design** | REST + OpenAPI + Webhooks | REST (complex, versioned) | REST + GraphQL | REST (SOAP legacy) | REST | REST |
| **Deployment** | Cloud + Private Cloud + K8s | Cloud-only | Cloud-only | Cloud + On-prem | Cloud + On-prem | Cloud |
| **SMB pricing** | $29/user/mo (Growth) | $25/user/mo (limited) | $50/user/mo | Not positioned | $14/user/mo | $25/user/mo |
| **Enterprise pricing** | $79/user/mo | $300+/user/mo | $150+/user/mo | Custom (high) | Custom | Custom |
| **Open source** | Core modules (future) | No | No | No | No | No |

### Why Customers Choose TZAHU

1. **"Salesforce is too expensive and complex"** — Mid-market companies outgrowing HubSpot but not ready for Salesforce consultants
2. **"HubSpot limits our growth"** — Companies hitting HubSpot's data model and customization ceilings
3. **"We want AI, not just AI branding"** — Organizations that see AI as a competitive advantage, not a checkbox
4. **"We need to own our data"** — Enterprises with compliance requirements for data residency and privacy
5. **"Our sales process is unique"** — Teams that need workflows customized to their exact process

---

## 5. Target Audience

### Primary Segments

#### SMB (10–100 Users)

| Attribute | Description |
|-----------|-------------|
| **Typical customer** | B2B SaaS startup, professional services firm, real estate agency |
| **Pain point** | Outgrown spreadsheets, HubSpot Starter too limited, Salesforce too expensive |
| **Needs** | Lead management, pipeline tracking, email integration, basic automation |
| **Buying process** | Self-service, credit card, < 2-week evaluation |
| **TZAHU offering** | Growth tier ($29/user/mo), pre-built templates, Stripe billing |
| **Sales approach** | Product-led growth, free trial, in-app onboarding |

#### Mid-Market (100–1,000 Users)

| Attribute | Description |
|-----------|-------------|
| **Typical customer** | Series A–C tech company, manufacturing mid-market, financial services |
| **Pain point** | HubSpot too expensive at scale, Salesforce requires consultants, Zoho lacks depth |
| **Needs** | Advanced workflows, custom reports, integrations (Slack, Google, Microsoft) |
| **Buying process** | Sales-led demo + POC, procurement involvement, security review |
| **TZAHU offering** | Pro tier ($59/user/mo), dedicated onboarding, SLA support |
| **Sales approach** | Demo-driven, ROI calculator, competitive displacement |

#### Enterprise (1,000+ Users)

| Attribute | Description |
|-----------|-------------|
| **Typical customer** | Global manufacturing, financial institution, healthcare, telecom |
| **Pain point** | Salesforce lock-in costs, Microsoft Dynamics UX, compliance requirements |
| **Needs** | SSO (SAML/OIDC), data residency, field-level permissions, audit, SLAs |
| **Buying process** | Long cycle (3–12 months), legal review, security audit, board approval |
| **TZAHU offering** | Enterprise tier ($79/user/mo), private cloud, dedicated support, custom SLAs |
| **Sales approach** | Executive engagement, proof-of-value, security documentation |

### Secondary Audiences

| Audience | Use Case | How TZAHU Serves Them |
|----------|----------|----------------------|
| **Sales Rep** | Daily lead/contact management, pipeline updates, activity logging | Fast UI, mobile, AI-assisted data entry, voice logging |
| **Sales Manager** | Pipeline oversight, forecast, coaching, team performance | Dashboards, reports, AI coaching suggestions, call review |
| **Sales Ops** | Workflow configuration, integration management, data quality | Workflow builder, integration SDK, dedup engine, import tools |
| **CRM Admin** | User management, permission setup, customization, reporting | Admin UI, custom fields/objects, role management, audit log |
| **System Admin** | Platform management, tenant provisioning, monitoring | Admin console, Grafana dashboards, tenant lifecycle API |
| **Developer** | Integration development, custom app building, API usage | API docs, SDK, webhook console, developer portal, playground |

---

## 6. Business Model

### Revenue Model

| Tier | Price | Users | Key Features | Target Segment |
|------|-------|-------|-------------|----------------|
| **Free** | $0 | Up to 5 | Core CRM, basic pipeline, 1 workflow | Micro-businesses, evaluation |
| **Growth** | $29/user/mo | Up to 100 | Full CRM, workflows, email integration, reports | SMB |
| **Pro** | $59/user/mo | Up to 1,000 | Advanced workflows, AI features, integrations, API | Mid-Market |
| **Enterprise** | $79/user/mo | Unlimited | Everything + SSO, data residency, field permissions, SLA | Enterprise |

### Unit Economics

| Metric | Target | Benchmark |
|--------|--------|-----------|
| ARPU (monthly) | $45 (blended) | $60–$100 (incumbent CRMs) |
| Gross margin | 75%+ | 70–80% (SaaS) |
| CAC payback | < 6 months | 12–24 months (enterprise SaaS) |
| LTV:CAC ratio | > 5:1 | > 3:1 (healthy SaaS) |
| Monthly churn (SMB) | < 3% | 3–5% (SMB SaaS) |
| Monthly churn (Mid-Market) | < 1.5% | 1–2% |
| Annual churn (Enterprise) | < 5% | 5–10% |
| Net revenue retention | > 120% | > 100% (best-in-class > 130%) |

### Go-to-Market Strategy

| Phase | Focus | Channel | Milestone |
|-------|-------|---------|-----------|
| R1 | Product-led growth | Self-service, content marketing, community | 50 orgs |
| R2 | Outbound + Partnerships | SDR team, integration partners, agencies | 200 orgs |
| R3 | Enterprise sales | Enterprise AE team, channel partners | 1,000 orgs |
| R4 | Ecosystem | Marketplace, developer community, global expansion | 5,000+ orgs |

---

## 7. Product Philosophy

### Seven Principles

#### 1. Workflow-First Architecture

The CRM is an engine first, a UI second. Every entity mutation publishes a domain event; the workflow engine is the subscriber that makes the system programmable. This principle prevents hardcoding lead assignment, notification, or stage transition logic into controllers — those are all workflow-driven.

#### 2. AI as a Platform Primitive

AI is not a separate product or feature tab. Every module exposes embedding vectors, semantic search, and prompt templates as first-class constructs. The AI context is a first-class concern alongside the relational model.

#### 3. Isolation by Default, Sharing by Contract

Tenants are isolated at the database row level (RLS), module internals by Python namespace (import-linter), and cross-module communication by domain events. Violating any of these boundaries requires explicit architectural review.

#### 4. Composability Over Configuration

Rather than building a monolithic "settings" page with 200 toggles, we decompose capabilities into composable modules (Workflow, Automation, Notification) that users assemble via the UI. This keeps each module's domain model coherent and testable.

#### 5. Bounded Contexts Are the Unit of Ownership

Each bounded context owns its data, its logic, and its public API. No cross-context joins. No shared tables. Every cross-context query goes through a well-defined API or event subscription.

#### 6. Observability Is a First-Class Feature

Every module emits structured logs, metrics, and traces. If it cannot be measured, it does not go to production. This is not optional — it is a delivery criterion for every sprint.

#### 7. Don't Build What You Can Buy

Use PostgreSQL, RabbitMQ, Redis, Celery, MinIO, OpenTelemetry, and Django Admin as commodity infrastructure. Build only the domain logic that differentiates the product. Every dependency is evaluated against total cost of ownership over 5 years.

---

## 8. Strategic Bets

### Bet 1: AI as a Platform Primitive

**The bet:** Organizations that deeply integrate AI into their sales process will outperform those that use AI as an add-on. By making embeddings, semantic search, prompt management, and RAG platform primitives rather than feature modules, TZAHU positions every interaction as an AI-augmented interaction.

**Why we win:** Competitors add AI as a feature tab (Salesforce Einstein, HubSpot Breeze). We build AI into the data model itself — every entity has an embedding vector, every search is semantic, every workflow can invoke an AI decision.

**Measured by:** 40%+ of users interact with AI features weekly. AI-driven lead scoring improves conversion rates by 20%+ for customers. AI saves 30 minutes per rep per day.

### Bet 2: Workflow as Operating System

**The bet:** The CRM of the future is a programmable platform, not a database UI. Workflow automation is the operating system that makes the CRM adaptable to any sales process. Every action in the system (assign lead, send email, update field, trigger webhook) is a workflow action.

**Why we win:** Salesforce has Process Builder (complex, limited) and Flow (better but steep learning curve). HubSpot workflows are linear and limited. TZAHU's workflow engine is event-driven, supports AND/OR conditions, branching, delays, loops (with safety limits), and AI decision nodes.

**Measured by:** 60%+ of active orgs use custom workflows. Average workflow complexity (nodes per workflow) > 5. Workflow execution success rate > 99.5%.

### Bet 3: Modular Monolith with Extraction Path

**The bet:** A 5-person startup should not start with microservices. A modular monolith with strict boundaries (import-linter, domain events, bounded contexts) gives us development speed of a monolith with the extraction path of microservices. When a module needs its own scaling, team, or tech stack, we extract it.

**Why we win:** Competing startups either build a monolith that becomes unmanageable (rewrite risk) or microservices that slow them down (coordination overhead). We start fast but structured.

**Measured by:** Module extraction (if needed) takes < 2 weeks. No module has circular dependencies. import-linter passes on every CI run.

### Bet 4: Open Ecosystem Before Proprietary Lock-in

**The bet:** Customers will choose a CRM with an open API, webhook-native architecture, and connector SDK over one that forces them into a proprietary ecosystem. By making integration a first-class feature (not an enterprise add-on), we capture customers who value data freedom.

**Why we win:** Salesforce locks data into its ecosystem. HubSpot charges premium for API access. We make integration free and open — customers own their data and can move it freely.

**Measured by:** 50+ integrations by R4. Average org uses 3+ integrations. Integration Hub is the #1 reason cited for choosing TZAHU in competitive deals.

---

## 9. Success Metrics

### Business Metrics

| Metric | R1 (6mo) | R2 (12mo) | R3 (18mo) | R4 (24mo) |
|--------|----------|-----------|-----------|-----------|
| Paying organizations | 50 | 200 | 1,000 | 5,000 |
| Active users | 2,500 | 20,000 | 100,000 | 500,000 |
| ARR | $200K | $1.5M | $8M | $25M |
| Net revenue retention | — | > 110% | > 120% | > 130% |
| Monthly churn (blended) | < 5% | < 3% | < 2% | < 1.5% |
| Customer acquisition cost | — | < $2K (SMB) | < $5K (MM) | < $15K (Enterprise) |

### Product Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| DAU/MAU ratio | > 30% | Product analytics |
| Time to first value | < 15 min | Time from signup to first lead created |
| Workflow adoption | > 40% of orgs | Workflow created & active |
| AI feature adoption | > 30% of users | AI feature interaction |
| API reliability | 99.95% uptime | Statuspage + monitoring |
| API p95 latency | < 200ms | Prometheus histograms |
| Search result relevance | > 80% click-through | User engagement with search results |

### Customer Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| NPS | > 50 | Quarterly survey |
| CSAT | > 4.5/5 | Post-interaction survey |
| Support ticket volume | < 0.5 tickets/user/month | Zendesk/Discourse |
| First response time | < 1 hour (business hours) | Support SLA tracking |
| Time to resolve (P0) | < 4 hours | Support SLA tracking |

---

## 10. Competitive Landscape

### Direct Competitors

| Competitor | Market Cap / Funding | Users | AI Maturity | TZAHU Advantage |
|-----------|---------------------|-------|-------------|-----------------|
| **Salesforce** | $200B+ | 150K+ companies | Einstein (add-on) | AI-native from day 1, lower TCO |
| **HubSpot** | $30B+ | 200K+ companies | Breeze AI (2024) | Open architecture, no limits |
| **Microsoft Dynamics** | $3T+ (parent) | 500K+ companies | Copilot (2023) | Modern UX, K8s-native, modular pricing |
| **Zoho** | Private | 80M+ users | Zia (basic NLP) | Enterprise-grade multi-tenancy, AI depth |
| **LeadSquared** | Private | 3K+ companies | Basic scoring | Global scale, AI platform, integrations |

### Adjacent Competitors

| Category | Players | TZAHU Positioning |
|----------|---------|-------------------|
| **Sales engagement** | Outreach, SalesLoft, Groove | TZAHU is CRM-first with engagement features, not the reverse |
| **Revenue intelligence** | Gong, Chorus, ZoomInfo | TZAHU provides AI insights natively, not as a $15K add-on |
| **Customer data platform** | Segment, mParticle | TZAHU focuses on sales workflow, not data unification |
| **Low-code automation** | Zapier, Make, n8n | TZAHU integrates with these; workflow engine is for CRM-specific automations |

### Our Competitive Advantage

1. **Integration of AI + Workflow + CRM in one platform** — competitors do 1 or 2 of these well, not all 3
2. **Lower total cost of ownership** — 50–70% less than Salesforce enterprise
3. **No consultants required** — self-service customization, visual workflows, open API
4. **Modern architecture** — K8s-native, event-driven, AI-native, API-first
5. **Data ownership** — no lock-in, open ecosystem, easy migration

---

## 11. Brand Principles

### Our Voice

| Attribute | Description | Example |
|-----------|-------------|---------|
| **Confident, not arrogant** | We know what we've built and why it matters | "We built the CRM that adapts to your process — not the other way around." |
| **Technical, not jargon-y** | We speak to developers and ops leaders as peers | "Event-driven architecture with PostgreSQL RLS for tenant isolation." |
| **Ambitious, not unrealistic** | We promise what we can deliver | "Start with our workflow engine, customize as you scale." |
| **Helpful, not pushy** | We educate before we sell | "Here's how workflow automation reduces lead response time by 60%." |

### Tagline Concepts

- *"The CRM That Adapts"* — Short, memorable, positions adaptability as core
- *"AI-First Enterprise CRM"* — Direct, technical, differentiates
- *"Your Process, Powered by AI"* — Customer-centric, benefit-focused
- *"Workflow Meets Intelligence"* — Product-centric, links the two differentiators

### Visual Identity Principles

- Clean, modern, minimal — not another blue CRM interface
- Data-forward — charts, pipelines, and AI insights are prominent
- Workflow-visual — the workflow builder is a hero feature in UI
- Accessible — WCAG 2.1 AA compliance from day one

---

> **This vision document is the north star for every product, engineering, and business decision.**
> When in doubt, ask: "Does this make TZAHU more adaptable? Does this make it more AI-native?"
> If the answer to both is no, reconsider.
