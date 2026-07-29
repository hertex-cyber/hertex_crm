# Key Screens — Wireframe Descriptions

## 1. Login Screen

**Purpose:** Authenticate users and redirect to their tenant workspace.

**Layout:**
```
┌──────────────────────────────────────┐
│  ┌──────────────────────────────┐    │
│  │         ┌────────┐          │    │
│  │         │ TZAHU  │          │    │
│  │         │ LOGO   │          │    │
│  │         └────────┘          │    │
│  │   Welcome back              │    │
│  │   Sign in to your account   │    │
│  │                              │    │
│  │   Email _________________   │    │
│  │   Password ______________   │    │
│  │                              │    │
│  │   [ ] Remember me           │    │
│  │                              │    │
│  │   [Sign In] ──────── full   │    │
│  │                              │    │
│  │   Forgot password?          │    │
│  │   Don't have an account?    │    │
│  │   Register                  │    │
│  └──────────────────────────────┘    │
│                                      │
│  © 2025 TZAHU CRM. All rights      │
│  reserved.                          │
└──────────────────────────────────────┘
```

**Elements:** Logo, email input, password input, remember-me checkbox, sign-in button, forgot password link, register link, tenant hint (optional), social login buttons (Google, Microsoft).

**States:** Loading spinner on submit, error message on invalid credentials, disabled button during submission.

---

## 2. Dashboard

**Purpose:** Provide at-a-glance overview of pipeline, recent activity, and AI insights.

**Layout:**
```
┌──────────────────────────────────────────────────────────────┐
│ Dashboard                                     [AI Insights]  │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                        │
│ │$125K │ │$87.5K│ │ 12   │ │6.5% │  │ Periodic: This Month │
│ │Total │ │Wtd   │ │Deals │ │Conv. │  │ [Previous] [Next]    │
│ │Pipe  │ │Pipe  │ │Won   │ │Rate  │  │                      │
│ └──────┘ └──────┘ └──────┘ └──────┘                        │
│                                                              │
│ ┌─── Pipeline Chart ──────────────────────────────────┐     │
│ │  [Bar chart: deals by stage with amounts]            │     │
│ │  Discovery ████████ $50K   ●                         │     │
│ │  Qualified ██████████████ $80K  ●                    │     │
│ │  Proposal  ████████████████████ $120K                │     │
│ │  Closing   ██████████ $60K     ● ← active deals     │     │
│ └─────────────────────────────────────────────────────┘     │
│                                                              │
│ ┌─ My Tasks ────────────┐ ┌─ AI Insights ─────────────┐     │
│ │ ☐ Follow up with     │ │ 💡 3 deals at risk of     │     │
│ │   Acme Corp (due 2h) │ │    slipping this month     │     │
│ │ ☑ Send proposal to   │ │ 💡 Acme Corp lead score   │     │
│ │   TechCo ✅           │ │    increased to 85        │     │
│ │ ☐ Call John re:      │ │ 💡 Best time to contact   │     │
│ │   enterprise deal     │ │    leads: Tue 10-11am     │     │
│ │                      │ │                            │     │
│ │ [+ Add Task]         │ │   [View All Insights →]   │     │
│ └──────────────────────┘ └────────────────────────────┘     │
│                                                              │
│ ┌─ Recent Activity ─────────────────────────────────────┐   │
│ │ • Acme Corp moved to Proposal stage     10:32 AM      │   │
│ │ • New lead: John Smith (TechConf)       9:15 AM       │   │
│ │ • Deal won: $45K — BetaCorp             Yesterday     │   │
│ └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

**States:** Loading skeleton, empty state (no data — onboarding prompt), error state with retry.

---

## 3. Lead List

**Purpose:** Browse, search, filter, and manage leads in a data table.

**Layout:**
```
┌──────────────────────────────────────────────────────────────┐
│ Leads                              [+ New] [Import] [Export] │
│                                                              │
│ [Search leads...  ⌘K]                                       │
│                                                              │
│ Filters: [All Status ▼] [All Source ▼] [Owner ▼] [More ▼]   │
│ Active filters: Status: QUALIFIED  ×  Source: WEBSITE  ×    │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐  │
│ │ ☐ │ Name         │ Email           │ Status   │ Score │  │
│ ├───┼──────────────┼─────────────────┼──────────┼───────┤  │
│ │ ☐ │ Jane Cooper  │ jane@acme.com   │ QUALIF.  │ 85🔥  │  │
│ │ ☐ │ John Smith   │ john@tech.com   │ NEW      │ 12    │  │
│ │ ☐ │ Bob Johnson  │ bob@co.com      │ CONTACT. │ 45😐  │  │
│ │ ☐ │ Alice Wang   │ alice@startup   │ QUALIF.  │ 92🔥  │  │
│ └─────────────────────────────────────────────────────────┘  │
│                                                        ← →  │
│ Showing 1-25 of 1,542                                  25/Page│
└──────────────────────────────────────────────────────────────┘
```

**Interactions:** Row click → navigates to detail; checkbox + bulk actions bar; column sorting; column visibility toggle; inline status change; drag-select rows.

**Filters panel (slide-out):** Status (multi-select), Source, Rating, Score range, Created date range, Owner, Tags.

---

## 4. Lead Detail

**Purpose:** View and manage a single lead with full information and actions.

**Layout:**
```
┌──────────────────────────────────────────────────────────────┐
│  ← Leads                          Status: QUALIFIED   [...] │
│                                                              │
│ ┌─ Contact Info ──────────┐ ┌─ Quick Actions ────────────┐  │
│ │ Jane Cooper             │ │ [Change Status ▼]          │  │
│ │ jane@acme.com           │ │ [Assign to...]             │  │
│ │ +1 (202) 555-1234       │ │ [Convert to Contact]       │  │
│ │ CTO at Acme Corp        │ │ [Add Activity]             │  │
│ │                         │ │ [✔ Merge Duplicates]       │  │
│ └─────────────────────────┘ └────────────────────────────┘  │
│                                                              │
│ ┌─ Lead Details ─────────────────────────────────────────┐  │
│ │ Source:    Website (tzahu.com)  Created: Jul 15, 2025 │  │
│ │ Owner:     You                 Score: 85 (HOT)         │  │
│ │ Team:      Enterprise Sales    Last Contacted: 2d ago │  │
│ │ Tags:      [enterprise] [saas] [decision-maker]       │  │
│ │ Notes:     Met at TechConf 2025. Interested in        │  │
│ │            enterprise plan for 500+ employees.        │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                              │
│ ┌── Tabs ───────────────────────────────────────────────┐   │
│ │ [Info] [Activity] [Related] [AI Insights] [Timeline]  │   │
│ │                                                        │   │
│ │ ┌─ Activity Feed ─────────────────────────┐            │   │
│ │ │ ● Jul 26 — Called, left voicemail       │            │   │
│ │ │   by Jane Smith                          │            │   │
│ │ │ ● Jul 25 — Email sent: Meeting followup │            │   │
│ │ │ ● Jul 24 — Stage: NEW → CONTACTED       │            │   │
│ │ │ ● Jul 20 — Lead created from website    │            │   │
│ │ │                                          │            │   │
│ │ │ [+ Log Activity]                         │            │   │
│ │ └──────────────────────────────────────────┘            │   │
│ └────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

**AI Insights Tab:** "High conversion probability (85%). Recommend contacting within 24 hours. Similar deals avg $45K."

---

## 5. Pipeline Kanban

**Purpose:** Visualize and manage opportunities across pipeline stages via drag-and-drop.

**Layout:**
```
┌──────────────────────────────────────────────────────────────┐
│ Pipeline: Default Sales Pipeline             [Edit Pipeline] │
│                                                   [View All] │
│ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ ┌──────┐ │
│ │Discovery││Qualifi.││Proposal││Nego..││Won   ││Lost  │ │
│ │ $50K   │ │ $80K  │ │$120K  │ │$60K  │ │$200K │ │$30K  │ │
│ │ (5)    │ │ (8)   │ │ (4)   │ │ (3)   │ │ (12)  │ │ (6)  │ │
│ ├────────┤ ├────────┤ ├────────┤ ├────────┤ ├───────┤ ├──────┤ │
│ │AcmeCorp│ │TechCo  │ │DataInc │ │GlobCorp│ │ ...   │ │ ...  │ │
│ │$25K    │ │$15K    │ │$50K    │ │$30K    │ │       │ │      │ │
│ │J. Smith│ │A. Wang │ │B. Lee  │ │J. Doe  │ │       │ │      │ │
│ ├────────┤ ├────────┤ ├────────┤ ├────────┤ │       │ │      │ │
│ │Startup │ │BetaCorp│ │ ...    │ │ ...    │ │       │ │      │ │
│ │$15K    │ │$35K    │ │        │ │        │ │       │ │      │ │
│ │B. John │ │S. Kim  │ │        │ │        │ │       │ │      │ │
│ ├────────┤ ├────────┤ │        │ │        │ │       │ │      │ │
│ │ ...    │ │ ...    │ │        │ │        │ │       │ │      │ │
│ │        │ │        │ │        │ │        │ │       │ │      │ │
│ │[+Add]  │ │[+Add]  │ │[+Add]  │ │[+Add]  │ │       │ │      │ │
│ └────────┘ └────────┘ └────────┘ └────────┘ └───────┘ └──────┘ │
│                                                                  │
│ Filters: [Owner: All ▼] [Expected Close: This Quarter ▼]       │
└──────────────────────────────────────────────────────────────────┘
```

**Interactions:** Drag card between columns (stage change), click card → open opportunity detail, horizontal scroll on mobile, card shows deal value + owner + probability badge.

---

## 6. Opportunity Detail

**Purpose:** Full deal management with line items, team, and stage progression.

**Layout:** Similar to Lead Detail but with additional sections:
- Line items table (product, quantity, price, discount, total)
- Team selling panel (member list + add member)
- Stage progression visual (horizontal stepper)
- Forecast category selector
- Competitor tracking section

---

## 7. Contact Detail

**Purpose:** View and manage a contact associated with an account.

**Layout:** Contact info card, linked account info, related opportunities list, activity timeline, communication history (calls, emails).

---

## 8. Account Detail

**Purpose:** View organization-level data with all associated contacts and deals.

**Layout:** Account header (name, industry, revenue, employees), related contacts list, open opportunities pipeline, closed deals summary, activity timeline, key contacts section.

---

## 9. Report Builder

**Purpose:** Create and customize reports with drag-and-drop configuration.

**Layout:**
```
┌──────────────────────────────────────────────────────────────┐
│ Report Builder                         [Save] [Run] [Export] │
│                                                              │
│ ┌─ Config Panel ───────────┐ ┌─ Preview ────────────────┐   │
│ │ Report Name: [________]  │ │                            │   │
│ │                           │ │ ┌─────────────────────┐  │   │
│ │ Source: [Leads ▼]        │ │ │  Leads by Status    │  │   │
│ │                           │ │ │                     │  │   │
│ │ Measures:                 │ │ │  NEW      ██ 500    │  │   │
│ │   ☑ Count                 │ │ │  CONTACT  ████ 400  │  │   │
│ │   ☐ Sum                   │ │ │  QUALIF   ██████ 300│  │   │
│ │   ☐ Average               │ │ │  CONVERT  ██ 100    │  │   │
│ │                           │ │ │                     │  │   │
│ │ Dimensions:               │ │ └─────────────────────┘  │   │
│ │   ☑ Status                │ │                            │   │
│ │   ☐ Source                │ │  Chart: [Bar ▼]           │   │
│ │   ☐ Owner                 │ │  Color: [Scheme ▼]        │   │
│ │   ☐ Created Date          │ │                            │   │
│ │                           │ └────────────────────────────┘   │
│ │ Filters:                   │                                 │
│ │   Created Date > last 30d  │                                 │
│ │   [Add Filter]             │                                 │
│ └───────────────────────────┘                                 │
│                                                                 │
│ AI Insight: "Lead conversion rate dropped 15% this month.     │
│  Source: WEBSITE leads have highest conversion (22%)."         │
└──────────────────────────────────────────────────────────────────┘
```

---

## 10. Workflow Editor

**Purpose:** Visual no-code workflow builder.

**Layout:** Canvas with drag-and-drop trigger, condition, and action blocks. Left panel with available blocks. Right panel for configuration. Test and publish controls at top.

---

## 11. Settings

**Purpose:** Tenant and user configuration.

**Layout:** Left navigation (General, Users & Roles, Teams, Integrations, AI Models, Billing, Notifications). Right content panel with forms and configuration sections.

---

## 12. AI Chat

**Purpose:** Conversational AI assistant for CRM queries and actions.

**Layout:** Full-page chat interface with message history, suggested prompts, code/table rendering for responses, action buttons ("Create lead", "Update opportunity"), and data visualization inline.

**Example prompts:** "Show me deals closing this month", "Create a new lead for John Smith from Acme Corp", "What's our win rate this quarter?", "Draft an email to Jane Cooper about the proposal".
