# TZAHU CRM — End-to-End Workflow for Founders

> **Purpose:** How our CRM works from the moment a lead enters until they become a lifelong customer. No technical jargon — just the flow.

---

## The Core Loop

```
Attract → Track → Nurture → Close → Serve → Retain → Grow
```

Every feature in TZAHU exists to move a person from left to right on this chain. If a feature doesn't accelerate this loop, we don't build it.

---

## Phase 1: Lead Capture (Getting People In)

**What happens when someone shows interest:**

A lead can enter the CRM from any of these channels:

- **Website form** — Visitor fills out "Contact Us" or "Get a Demo"
- **Email** — They email your sales team; CRM picks it up automatically
- **Import** — You upload an Excel/CSV from a trade show, purchased list, or old system
- **Manual entry** — Sales rep types in details from a business card or LinkedIn
- **Webhook/API** — Your website or partner system pushes leads automatically
- **Referral** — Existing customer sends someone your way

**The moment a lead enters, the CRM:**

1. Checks for duplicates — same email? same phone? merges if found
2. Assigns them to the right sales rep automatically
3. Sends a notification: "New lead assigned to you!"
4. Scores them Hot/Warm/Cold based on how they came in
5. Creates a timeline entry — their entire history starts here

---

## Phase 2: Lead Qualification (Separating Signal from Noise)

**What the sales rep does:**

- Calls the lead (call is logged — duration, outcome, notes)
- Sends emails from inside the CRM (opens and clicks are tracked)
- Takes notes about their needs, budget, timeline
- Marks them as Qualified or Disqualified

**What the CRM does automatically:**

- Builds an activity timeline — every call, email, and note in one place
- Creates follow-up tasks — "Call back Friday at 2pm"
- Escalates if the rep doesn't follow up within the SLA
- Re-scores the lead based on engagement (opened emails? visited pricing page?)
- If lead goes cold for 30 days, flags for re-engagement campaign

**Decision point:**
- **Qualified** → Moves to conversion
- **Disqualified** → Moves to nurture (they said "not now," not "never")

---

## Phase 3: Conversion (Stranger → Customer Record)

**When a lead is qualified, the CRM does a one-click conversion that creates:**

| Record | What it stores |
|--------|---------------|
| **Contact** | The person — name, email, phone, job title, LinkedIn |
| **Account** | Their company — name, industry, size, revenue, website |
| **Opportunity** | The deal — estimated value, close date, pipeline stage, products |

**Why three records?**
- A person can work at multiple companies (Contact stays, Account changes)
- A company can have multiple deals (Account stays, Opportunities change)
- A deal has its own lifecycle independent of the person

**Auto-triggers at this point:**
- Welcome email sent to the new contact
- Task created for the rep: "Prepare demo materials"
- Account assigned to an account manager (if enterprise)
- Pipeline stage set to "Prospecting"

---

## Phase 4: Pipeline & Deal Management (Closing the Sale)

**The sales pipeline is the heart of the CRM:**

```
Prospecting → Qualification → Proposal → Negotiation → Closed Won
                                                          → Closed Lost
```

**At each stage, the rep:**
- Logs calls, emails, meetings against the opportunity
- Updates the deal value (maybe it grew or shrank)
- Moves the deal forward with a drag-and-drop kanban board

**Quotes & Proposals:**
- Rep builds a quote inside the CRM — selects products, sets quantities, applies discounts
- If discount > 20% or deal > $50K, an approval request goes to the manager
- Manager approves/rejects from their phone or email
- Quote gets sent to the customer as a PDF

**Forecasting (the manager's view):**
- "Your team has $2.1M in pipeline, expected to close $840K this quarter"
- Which deals are at risk? (stuck in a stage too long, no activity in 2 weeks)
- Which reps are on track? Who needs help?

**Decision point:**
- **Won** → Move to order fulfillment
- **Lost** → Record the reason (price, competitor, timing) — this data is gold for product/marketing

---

## Phase 5: Order-to-Revenue (Getting Paid)

**When a deal is won, the fulfillment process begins:**

```
Won Deal → Order Created → Fulfillment → Invoice Sent → Payment Received
```

**What happens step by step:**

1. **Order** is auto-created from the won quote — products, quantities, prices, delivery dates
2. **Team fulfills** — if product, ship it; if service, schedule onboarding
3. **Invoice** is generated and sent to the customer's billing contact
4. **Payment** is tracked — paid, overdue, or pending
5. **Contract** is created (for subscriptions) with start date, end date, renewal terms

**What the CRM tracks in real-time:**
- Revenue booked vs revenue delivered
- Invoices pending / overdue / paid
- Monthly Recurring Revenue (MRR) — the north star for SaaS businesses

---

## Phase 6: Post-Sale & Support (Keeping Customers Happy)

**The relationship doesn't end at the sale:**

**Support Tickets:**
- Customer emails support → Ticket auto-created in CRM
- Ticket assigned to the right agent based on skill/load
- SLA timer starts: "Respond within 4 hours"
- CRM suggests knowledge base articles that might answer the question
- Ticket resolved → Customer gets a CSAT survey

**Knowledge Base:**
- Your team writes help articles and FAQs
- When a ticket comes in, CRM suggests 3 relevant articles
- Customer might find their answer without ever talking to a human

**Customer Health Score:**
- CRM tracks: support tickets opened, feature usage, login frequency, payment history
- Green = healthy, Yellow = at risk, Red = churn risk
- When a customer turns yellow, an alert goes to the account manager

---

## Phase 7: Retention & Expansion (Growing the Account)

**For subscription businesses, renewals are everything:**

**Automatic renewal management:**
- Contract expiry is tracked from day one
- 90 days before: Notification to account manager — "Prepare renewal strategy"
- 60 days before: CRM generates a renewal quote with usage data
- 30 days before: Automated follow-up sequence begins
- Expired: Escalation to management

**Expansion opportunities the CRM flags:**
- "This customer added 50 new users last month — they might need an enterprise plan"
- "This customer's contract is up in 60 days and they've never used feature X — offer a training session"
- "This customer has 3 separate departments using us — propose a consolidated contract"

---

## Phase 8: Cross-Cutting (Works Everywhere, All the Time)

### Automation (The CRM Works While You Sleep)

| Instead of your team... | The CRM does it automatically |
|------------------------|-------------------------------|
| Manually routing leads | Assigns based on territory, skill, or load |
| Remembering follow-ups | Creates tasks, sends reminders, escalates if ignored |
| Chasing approvals | Sends approval requests, escalates if no response |
| Building reports | Updates dashboards in real-time |
| Checking for duplicates | Scans every new entry automatically |
| Sending welcome emails | Triggers sequences on conversion |
| Tracking renewals | Alerts 90/60/30 days before expiry |
| Noticing at-risk deals | Flags deals with no activity in 7+ days |

### Unified Inbox (Multi-Channel Messaging)

**The problem:** Your customers message you on WhatsApp, Instagram DM, and Facebook Messenger. Your team checks three different apps. Messages get missed, responses are slow, and customers get frustrated.

**The TZAHU solution:** A single inbox inside the CRM that connects all three platforms through one Meta Business Account.

**What you see:**
- Every message from WhatsApp, Instagram DM, and Facebook Messenger in one chronological feed
- Each message shows which platform it came from (channel badge)
- Sender's name, profile picture, and if they're an existing contact in your CRM
- Unread count per conversation

**What the CRM does:**
- Agent replies directly from the inbox — message goes to the right platform automatically
- Sender is auto-linked to existing contact/lead; if new, a contact is created
- Conversation can be assigned to a specific team member
- Internal notes for team collaboration (not sent to customer)
- Response time SLA tracking — alerts if reply takes too long
- Automatically close inactive conversations; reopen when customer replies
- Live chat widget for your website also feeds into the same inbox

**One Meta account to connect them all:**

```
Meta Business Account (one OAuth login)
  ├── WhatsApp Cloud API
  ├── Instagram DM (Graph API)
  └── Facebook Messenger (Graph API)
```

**Metrics to watch:**
- First response time (target: < 1 min for live chat, < 5 min for social)
- Messages per channel breakdown
- Conversation resolution rate
- Customer satisfaction per conversation

### AI Assistance

- **Lead scoring:** "This lead matches your 3 best customers — priority: high"
- **Sentiment analysis:** "Customer email tone is frustrated — flag for manager"
- **Email drafting:** "Reply suggesting a demo call next Tuesday"
- **Smart search:** Type "Show me all deals over $50K in the negotiation stage" — it just works
- **Call insights:** Recorded calls are transcribed, summarized, and action items extracted
- **Next-best-action:** For any lead or deal, the CRM suggests what to do next

### Reports & Dashboards

**Sales team sees every morning:**
- My pipeline value, my deals closing this week, my tasks overdue
- Who I need to call today (auto-prioritized)

**Managers see:**
- Team pipeline vs target, forecast accuracy, conversion rates
- Deals at risk, reps falling behind, coaching opportunities
- Revenue dashboard — this month, this quarter, this year

**Executives see:**
- MRR/ARR growth, churn rate, customer acquisition cost
- Sales by region, by product, by channel
- CSAT trends, support response times

---

## The Complete Customer Journey (One-Page Summary)

```
1. Visitor fills a form on your website
   → Lead created + assigned to rep → Notification sent

2. Rep calls and emails
   → Activity logged → Lead qualified → Opportunity opened

3. Demo given, proposal sent
   → Quote created → Manager approves (if needed) → Quote sent to customer

4. Customer says yes
   → Order created → Product shipped/service delivered → Invoice sent → Payment received

5. Contract signed (for subscriptions)
   → Renewal tracking begins → Customer goes live → Onboarding completed

6. Customer needs help
   → Support ticket created → Agent responds → KB suggests articles → Issue resolved

7. Contract renewal approaches
   → 90-day alert → 60-day quote generated → 30-day follow-up → Customer renews

8. Happy customer refers a friend
   → New lead enters at Step 1 → The flywheel spins faster
```

**Every step is tracked. Every interaction is logged. Nothing falls through the cracks.**

---

## What Makes TZAHU Different from Salesforce / HubSpot

| Dimension | Salesforce | HubSpot | TZAHU |
|-----------|-----------|---------|-------|
| Setup time | 3-6 months with consultants | 2-4 weeks | Hours to days |
| AI | Add-on (Einstein, $$$) | Add-on (Breeze, limited) | Built into every feature |
| Custom workflows | Complex (Process Builder) | Basic, linear | Visual, AI-augmented, unlimited depth |
| Data model | Rigid | Limited custom objects | Fully customizable from day one |
| Cost at scale | $150-300/user/mo | $50-150/user/mo | $29-79/user/mo |
| Multi-tenancy | Org-per-customer | Account-per-customer | Shared + dedicated (enterprise) |

---

## Founders' Cheat Sheet: The Numbers That Matter

| Metric | What It Tells You | Why It Matters |
|--------|-------------------|----------------|
| Leads created/week | Is marketing working? | Pipeline health |
| Lead-to-opportunity rate | Are we qualifying well? | Sales efficiency |
| Win rate | Are we closing well? | Product-market fit |
| Sales cycle length | How long to close? | Cash flow predictability |
| Pipeline value | Future revenue | Revenue forecasting |
| MRR/ARR | Healthy business? | Valuation |
| Churn rate | Are we retaining? | Product stickiness |
| CSAT score | Happy customers? | Referrals and retention |
| NPS | Would they recommend us? | Organic growth |
