# UI/UX Design — Overview

## Design Philosophy

TZAHU CRM's user interface prioritizes **clarity**, **efficiency**, and **intelligence**. The design system serves sales professionals who spend hours daily in the CRM. Every pixel is optimized for quick data access, minimal clicks, and smart defaults.

### Core Principles

1. **Content First:** Data density optimized for professional users. Minimal chrome, maximum information.
2. **Progressive Disclosure:** Show essential information upfront, reveal complexity on demand.
3. **Consistency:** Single design language across all screens via MUI 5 Design System.
4. **Intelligence Augmentation:** AI-powered suggestions, predictions, and automations embedded contextually.
5. **Performance:** Instant interactions — sub-100ms perceived latency, optimistic updates, skeleton screens.
6. **Accessibility:** WCAG 2.1 AA compliance minimum, keyboard-navigable, screen-reader friendly.

## Component Hierarchy

```
App
├── Shell
│   ├── TopBar (global search, quick actions, notifications, user menu)
│   ├── Sidebar (navigation, module switching)
│   └── Main Content Area
├── Common Components
│   ├── DataTable (sortable, filterable, selectable, virtualized)
│   ├── DetailPanel (entity view with tabs)
│   ├── FormBuilder (dynamic forms based on schema)
│   ├── KanbanBoard (drag-and-drop pipeline)
│   ├── Timeline (activity feed)
│   └── SmartSuggestions (AI-powered contextual tips)
├── Module Screens
│   ├── LeadModule (list, detail, create, import)
│   ├── OpportunityModule (list, detail, pipeline kanban)
│   ├── ContactModule (list, detail)
│   ├── AccountModule (list, detail)
│   ├── WorkflowModule (editor, list, execution log)
│   ├── ReportModule (builder, viewer, dashboard)
│   └── AIChat (conversational interface)
└── Shared
    ├── ErrorBoundary
    ├── LoadingState
    ├── EmptyState
    └── PermissionGate
```

## Layout Patterns

### Primary Layout (Workspace)
```
┌─────────────────────────────────────────────────────┐
│  TopBar (64px)                                      │
│  [☰ Menu] [Search ⌘K] [AI Chat] [🔔] [Avatar ▼]    │
├────────┬────────────────────────────────────────────┤
│        │                                            │
│ Nav    │  Main Content                              │
│ (240px)│  - Page Header (breadcrumb + actions)      │
│        │  - Data Table / Detail Panel               │
│ Icons  │  - Floating Action Button (AI)             │
│ only   │                                            │
│ (64px) │                                            │
│        │                                            │
├────────┴────────────────────────────────────────────┤
│  Status Bar                                         │
└─────────────────────────────────────────────────────┘
```

### Detail Layout (Split View)
```
┌─────────────────────────────────────────────────────┐
│  TopBar                                             │
├────────┬──────────────────────────┬─────────────────┤
│        │  Detail (Left)           │  Sidebar        │
│ Nav    │  - Header (name, status) │  - Quick Info   │
│        │  - Tabs: Info, Activity, │  - Top Actions  │
│        │    Related, AI Insights  │  - Smart Suggest│
│        │  - Content               │  - Related Items │
│        │                          │                 │
│        │                          │                 │
└────────┴──────────────────────────┴─────────────────┘
```

## Responsive Breakpoints

| Breakpoint | Width | Layout | Behavior |
|------------|-------|--------|----------|
| xs | <600px | Single column | Sidebar hidden, bottom nav |
| sm | 600-900px | Single column | Sidebar collapsible drawer |
| md | 900-1200px | Two column | Sidebar collapsed to icons |
| lg | 1200-1536px | Full layout | Sidebar expanded (240px) |
| xl | >1536px | Full layout + max-width 1440px | Extra whitespace |

## User Flow Patterns

### Primary Workflows
1. **Login → Dashboard:** 2 seconds, sees pipeline summary + recent activity + AI insights
2. **Lead Creation → List:** 3 clicks, inline form with smart defaults
3. **Lead → Convert → Opportunity:** 4 clicks with guided conversion
4. **Opportunity Stage Move:** Drag-and-drop on kanban, confirmation only for Closed Won/Lost
5. **Report Builder:** Pick metric → pick dimension → pick chart → save; AI suggests insights

### Navigation Architecture
```
Level 1 (TopBar):  Search, AI Chat, Notifications, User
Level 2 (Sidebar): Dashboard, Leads, Opportunities, Contacts, Accounts
                     └── Reports, Workflows, Settings
Level 3 (Tab Bar): Within detail views (Info, Activity, Related, AI)
```

## Accessibility Standards

- **WCAG 2.1 AA** compliance target
- All interactive elements focusable and keyboard-operable
- Proper ARIA labels on all icons and interactive controls
- Color contrast ratio ≥ 4.5:1 for normal text, ≥ 3:1 for large text
- Focus indicators visible (2px outline, not removed)
- Screen reader announcements for dynamic content changes
- Motion reduction support (`prefers-reduced-motion`)
- Dark mode support (automatic based on system preference)

## Design System

See `Design_System.md` for complete color palette, typography, spacing, elevation, and MUI 5 theme configuration.

## Key Screens

See `Key_Screens.md` for wireframe descriptions of all primary screens.

## Frontend Architecture

See `Frontend_Architecture.md` for React component architecture, state management, data fetching, and routing.

## Related Documents

- `Design_System.md` — MUI 5 theme, colors, typography, spacing
- `Key_Screens.md` — Wireframe descriptions for all screens
- `Frontend_Architecture.md` — React architecture, stores, API layer
- `APIContracts/README.md` — API design overview
