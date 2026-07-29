# TZAHU CRM — Frontend Implementation Plan

> **Version:** 0.1.0
> **Last Updated:** 2026-07-27
> **Status:** Foundational Design Phase
> **Owner:** Platform Architecture Team

---

## Table of Contents

1. [Frontend Architecture](#1-frontend-architecture)
2. [Directory Structure](#2-directory-structure)
3. [Tech Stack & Rationale](#3-tech-stack--rationale)
4. [Cross-Cutting Concerns](#4-cross-cutting-concerns)
5. [Auth & Identity Module](#5-auth--identity-module)
6. [Organization Module](#6-organization-module)
7. [RBAC Module](#7-rbac-module)
8. [Lead Management Module](#8-lead-management-module)
9. [Contact Management Module](#9-contact-management-module)
10. [Account Management Module](#10-account-management-module)
11. [Pipeline & Opportunity Module](#11-pipeline--opportunity-module)
12. [Activity Module](#12-activity-module)
13. [Task Module](#13-task-module)
14. [Calendar Module](#14-calendar-module)
15. [Workflow Module](#15-workflow-module)
16. [Notification Module](#16-notification-module)
17. [Reports & Dashboard Module](#17-reports--dashboard-module)
18. [AI Module](#18-ai-module)
19. [Voice AI Module](#19-voice-ai-module)
20. [Integration Module](#20-integration-module)
21. [Settings Module](#21-settings-module)
22. [Search Module](#22-search-module)
23. [Implementation Order by Phase](#23-implementation-order-by-phase)
24. [Theme & Accessibility](#24-theme--accessibility)

---

## 1. Frontend Architecture

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    React SPA (Vite + TS)                         │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  Layouts     │  │   Pages     │  │  Feature Components      │  │
│  │  (AppShell,  │  │  (Routes)   │  │  (Leads, Contacts, ...) │  │
│  │   Sidebar,   │  │             │  │                         │  │
│  │   Topbar)    │  │             │  │                         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Shared Components                       │   │
│  │  (DataTable, FormDialog, Kanban, Chart, Timeline, ...)     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────────┐  │
│  │  TanStack  │  │  Zustand │  │  Axios   │  │  React Router  │  │
│  │  Query     │  │  Store   │  │  Client  │  │  v6            │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Service Layer (API Clients)                   │   │
│  │  (AuthService, LeadService, ContactService, ...)           │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Utils & Types (Shared)                       │   │
│  │  (Formatters, Validators, Constants, TypeScript Types)    │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Data Flow

```
User Action -> React Component -> TanStack Query mutation
    -> API Service (Axios) -> Django REST API
    -> TanStack Query cache update -> UI re-render

Real-time: WebSocket -> Zustand store update -> UI re-render
    (notifications, activity feed, collaboration)

Auth: Axios interceptor -> check token expiry
    -> refresh token -> retry original request
    -> redirect to login if refresh fails
```

### 1.3 State Management Strategy

| Concern | Tool | Rationale |
|---------|------|-----------|
| Server state (API data) | TanStack Query (React Query) | Caching, deduplication, background refetch, optimistic updates, pagination |
| Client state (UI-only) | Zustand | Lightweight, no boilerplate, easy to use for global UI state |
| Form state | React Hook Form + Zod | Performance (uncontrolled), validation with Zod schemas |
| URL state | React Router v6 | Search params, path params |
| Auth state | Zustand (persisted to localStorage) | JWT tokens, user info, org context |

---

## 2. Directory Structure

```
frontend/
├── public/
│   ├── favicon.ico
│   └── manifest.json
├── src/
│   ├── main.tsx                          # App entry point
│   ├── App.tsx                           # Root component with providers
│   ├── routes.tsx                        # Route definitions
│   ├── vite-env.d.ts
│   │
│   ├── components/                       # Reusable UI components
│   │   ├── common/                       # Generic components
│   │   │   ├── DataTable.tsx             # Sortable, filterable, paginated table
│   │   │   ├── DataTable.types.ts
│   │   │   ├── ConfirmDialog.tsx         # Confirmation modal
│   │   │   ├── EmptyState.tsx            # Empty state with illustration
│   │   │   ├── ErrorBoundary.tsx         # React error boundary
│   │   │   ├── LoadingSkeleton.tsx       # Skeleton loading placeholder
│   │   │   ├── PageHeader.tsx            # Page title + actions
│   │   │   ├── SearchInput.tsx           # Debounced search input
│   │   │   ├── StatusBadge.tsx           # Color-coded status badge
│   │   │   ├── Avatar.tsx                # User avatar
│   │   │   ├── Breadcrumbs.tsx           # Navigation breadcrumbs
│   │   │   ├── Tabs.tsx                  # Tab navigation
│   │   │   ├── FilterPanel.tsx           # Sidebar filter drawer
│   │   │   └── CopyButton.tsx            # Copy to clipboard
│   │   │
│   │   ├── forms/                        # Form components
│   │   │   ├── FormField.tsx             # Wrapper for form fields with error
│   │   │   ├── FormSelect.tsx            # Select dropdown
│   │   │   ├── FormDatePicker.tsx        # Date picker
│   │   │   ├── FormPhoneInput.tsx        # Phone input with country code
│   │   │   ├── FormRichText.tsx          # Rich text editor
│   │   │   ├── FormMultiSelect.tsx       # Multi-select chip input
│   │   │   └── FormAutocomplete.tsx      # Autocomplete with API search
│   │   │
│   │   ├── layout/                       # Layout components
│   │   │   ├── AppShell.tsx              # Main app shell with sidebar
│   │   │   ├── Sidebar.tsx               # Navigation sidebar
│   │   │   ├── Topbar.tsx                # Top bar with search, notifications, profile
│   │   │   ├── Sidebar.types.ts
│   │   │   └── Sidebar.config.ts         # Menu items with permission checks
│   │   │
│   │   ├── charts/                       # Chart components (using Recharts)
│   │   │   ├── BarChart.tsx
│   │   │   ├── LineChart.tsx
│   │   │   ├── PieChart.tsx
│   │   │   ├── FunnelChart.tsx           # Pipeline funnel
│   │   │   ├── KPICard.tsx               # KPI metric card
│   │   │   └── ChartContainer.tsx        # Responsive chart wrapper
│   │   │
│   │   └── feedback/                     # User feedback components
│   │       ├── Toast.tsx                 # Toast notification container
│   │       ├── Toast.types.ts
│   │       ├── ConfirmDialog.tsx
│   │       └── LoadingOverlay.tsx
│   │
│   ├── features/                         # Feature modules
│   │   ├── auth/
│   │   ├── organization/
│   │   ├── rbac/
│   │   ├── leads/
│   │   ├── contacts/
│   │   ├── accounts/
│   │   ├── pipeline/
│   │   ├── opportunities/
│   │   ├── activities/
│   │   ├── tasks/
│   │   ├── calendar/
│   │   ├── workflows/
│   │   ├── notifications/
│   │   ├── reports/
│   │   ├── dashboards/
│   │   ├── ai/
│   │   ├── voice/
│   │   ├── integrations/
│   │   └── settings/
│   │       └── [module]/
│   │           ├── components/           # Feature-specific components
│   │           ├── hooks/                # Feature-specific hooks
│   │           ├── services/             # API service functions
│   │           ├── types.ts              # Feature-specific types
│   │           └── index.ts              # Public exports
│   │
│   ├── store/                            # Zustand stores
│   │   ├── authStore.ts                  # Auth state (user, tokens, org)
│   │   ├── uiStore.ts                    # UI state (sidebar, theme, modals)
│   │   ├── notificationStore.ts          # In-app notification state
│   │   └── tenantStore.ts                # Current tenant/org context
│   │
│   ├── services/                         # API client & service layer
│   │   ├── apiClient.ts                  # Axios instance with interceptors
│   │   ├── apiClient.types.ts            # API response types
│   │   ├── authService.ts               # Auth endpoints
│   │   ├── leadService.ts               # Lead endpoints
│   │   ├── contactService.ts            # Contact endpoints
│   │   ├── accountService.ts            # Account endpoints
│   │   ├── opportunityService.ts         # Opportunity endpoints
│   │   ├── activityService.ts            # Activity endpoints
│   │   ├── taskService.ts               # Task endpoints
│   │   ├── workflowService.ts            # Workflow endpoints
│   │   ├── notificationService.ts        # Notification endpoints
│   │   ├── reportService.ts              # Report endpoints
│   │   ├── dashboardService.ts           # Dashboard endpoints
│   │   ├── searchService.ts              # Search endpoint
│   │   ├── integrationService.ts         # Integration endpoints
│   │   └── settingsService.ts            # Settings endpoints
│   │
│   ├── hooks/                            # Global custom hooks
│   │   ├── useAuth.ts                    # Auth state & actions
│   │   ├── usePermissions.ts             # Permission checking
│   │   ├── useTenant.ts                  # Current tenant context
│   │   ├── useDebounce.ts                # Debounced value
│   │   ├── usePagination.ts              # Pagination state
│   │   ├── useToast.ts                   # Toast notification trigger
│   │   └── useWebSocket.ts              # WebSocket connection
│   │
│   ├── layouts/                          # Page layouts
│   │   ├── AuthLayout.tsx                # Login/register pages
│   │   ├── AppLayout.tsx                 # Main app (sidebar + content)
│   │   ├── SettingsLayout.tsx            # Settings pages (nested nav)
│   │   └── PublicLayout.tsx              # Public pages (landing, etc.)
│   │
│   ├── pages/                            # Route page components
│   │   ├── LoginPage.tsx
│   │   ├── RegisterPage.tsx
│   │   ├── ForgotPasswordPage.tsx
│   │   ├── ResetPasswordPage.tsx
│   │   ├── VerifyEmailPage.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── LeadListPage.tsx
│   │   ├── LeadDetailPage.tsx
│   │   ├── ContactListPage.tsx
│   │   ├── ContactDetailPage.tsx
│   │   ├── AccountListPage.tsx
│   │   ├── AccountDetailPage.tsx
│   │   ├── PipelinePage.tsx
│   │   ├── OpportunityListPage.tsx
│   │   ├── OpportunityDetailPage.tsx
│   │   ├── TaskListPage.tsx
│   │   ├── CalendarPage.tsx
│   │   ├── WorkflowListPage.tsx
│   │   ├── WorkflowEditorPage.tsx
│   │   ├── ReportBuilderPage.tsx
│   │   ├── DashboardViewPage.tsx
│   │   ├── SettingsPage.tsx
│   │   ├── IntegrationListPage.tsx
│   │   ├── IntegrationDetailPage.tsx
│   │   ├── AIPage.tsx
│   │   ├── VoicePage.tsx
│   │   ├── NotFoundPage.tsx
│   │   └── UnauthorizedPage.tsx
│   │
│   ├── utils/                            # Utility functions
│   │   ├── formatters.ts                 # Date, currency, percentage formatters
│   │   ├── validators.ts                 # Form validation helpers
│   │   ├── constants.ts                  # App-wide constants
│   │   ├── permissions.ts                # Permission helpers
│   │   ├── chartColors.ts               # Consistent chart color palette
│   │   └── treeUtils.ts                  # Tree data structure helpers
│   │
│   ├── types/                            # TypeScript type definitions
│   │   ├── api.ts                        # API response/request types
│   │   ├── auth.ts                       # Auth-related types
│   │   ├── lead.ts                       # Lead types
│   │   ├── contact.ts                    # Contact types
│   │   ├── account.ts                    # Account types
│   │   ├── opportunity.ts                # Opportunity types
│   │   ├── activity.ts                   # Activity types
│   │   ├── task.ts                       # Task types
│   │   ├── pipeline.ts                   # Pipeline types
│   │   ├── workflow.ts                   # Workflow types
│   │   ├── notification.ts               # Notification types
│   │   ├── report.ts                     # Report types
│   │   ├── integration.ts                # Integration types
│   │   ├── settings.ts                   # Settings types
│   │   └── common.ts                     # Shared types (pagination, etc.)
│   │
│   └── theme/                            # MUI theme
│       ├── theme.ts                      # Main theme config
│       ├── palette.ts                    # Color palette
│       ├── typography.ts                 # Typography scale
│       ├── components.ts                 # MUI component overrides
│       └── darkTheme.ts                  # Dark mode variant
│
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── Dockerfile
└── .dockerignore
```

---

## 3. Tech Stack & Rationale

| Technology | Purpose | Rationale |
|------------|---------|-----------|
| **React 18** | UI framework | Functional components, hooks, concurrent mode |
| **TypeScript** | Type safety | Strict mode, discriminated unions for API responses |
| **Vite** | Build tool | Fast HMR, optimized production builds, ESM-native |
| **MUI v5** | Component library | Responsive design system, accessibility, theme support |
| **MUI X** | Data grid, date pickers | Enterprise-grade data table with inline editing |
| **TanStack Query v5** | Server state | Caching, deduplication, optimistic updates, pagination |
| **TanStack Table** | Headless table | Flexible table with sorting, filtering, selection |
| **Zustand** | Client state | Minimal boilerplate, persist middleware, devtools |
| **React Hook Form** | Forms | Uncontrolled inputs, performant, integrations |
| **Zod** | Validation | TypeScript-first schema validation |
| **Axios** | HTTP client | Interceptors for auth, retry, error handling |
| **React Router v6** | Routing | Nested routes, loaders, guards |
| **Recharts** | Charts | Composable, responsive, MUI-compatible |
| **date-fns** | Date handling | Tree-shakeable, comprehensive |
| **react-beautiful-dnd** | Drag & drop | Kanban boards, reorderable lists |
| **i18next** | Internationalization | Translation, pluralization, date/number formatting |

---

## 4. Cross-Cutting Concerns

### 4.1 Auth Flow

```
┌──────────┐     ┌──────────┐     ┌──────────────┐     ┌──────────────┐
│  Login    │────►│  Axios   │────►│  Zustand     │────►│  Axios        │
│  Page     │     │  Call    │     │  authStore    │     │  Interceptor  │
└──────────┘     └──────────┘     └──────┬───────┘     └──────┬───────┘
                                          │                     │
                                          │ store:              │ attach:
                                          │  accessToken        │ Authorization:
                                          │  refreshToken       │ Bearer {token}
                                          │  user               │
                                          │  orgId              │ on 401:
                                          │                     │  refresh token
                                          │                     │  retry request
                                          └─────────────────────┘
```

**Auth Provider (App.tsx):**
- Wraps entire app with `AuthContext`
- On mount: check localStorage for stored auth state
- If token exists: set Axios default header, validate token expiry
- If token expired: attempt silent refresh
- If refresh fails: redirect to login

**Route Guards:**
```typescript
// routes.tsx
<Route element={<AuthGuard />}>
  <Route element={<PermissionGuard permission="lead.read" />}>
    <Route path="/leads" element={<LeadListPage />} />
  </Route>
</Route>
```

### 4.2 Tenant Context

- Current `organization_id` is extracted from JWT on login
- Stored in `authStore` alongside user info
- Passed as header `X-Org-ID` on every API request
- Axios interceptor ensures it's always present
- Switched when user changes organization (multi-org feature)

### 4.3 Error Boundaries

- `ErrorBoundary` component catches React render errors
- Displays fallback UI with "Try Again" button
- Logs error details to Sentry
- Each feature module can have its own error boundary

### 4.4 Toast Notifications

- Global toast container in `AppShell`
- Zustand `uiStore` manages toast queue
- Auto-dismiss after configurable duration
- Types: success, error, warning, info
- WebSocket listener adds real-time notifications

### 4.5 Search

- Global search in topbar (debounced, 300ms)
- TanStack Query with `keepPreviousData` for smooth UX
- Results grouped by entity type (Leads, Contacts, Accounts, Opportunities)
- Keyboard shortcuts: `Cmd+K` or `Ctrl+K` to focus
- Navigate to detail page on selection

### 4.6 Permission-Based UI Rendering

```typescript
// usePermissions hook
const { hasPermission } = usePermissions();

// Usage in component
{hasPermission('lead.create') && (
  <Button onClick={handleCreate}>New Lead</Button>
)}

// Conditional column hiding
const columns = useMemo(() => [
  { accessorKey: 'name', header: 'Name' },
  ...(hasPermission('lead.delete') ? [{
    accessorKey: 'actions',
    header: 'Actions',
    cell: () => <DeleteButton />
  }] : []),
], [hasPermission]);
```

### 4.7 Axios Client Configuration

```typescript
// services/apiClient.ts
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor — attach JWT + org ID
apiClient.interceptors.request.use((config) => {
  const { accessToken, orgId } = useAuthStore.getState();
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  if (orgId) {
    config.headers['X-Org-ID'] = orgId;
  }
  return config;
});

// Response interceptor — refresh on 401
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;
      try {
        const { refreshToken } = useAuthStore.getState();
        const { data } = await axios.post('/auth/refresh', { refreshToken });
        useAuthStore.getState().setTokens(data.accessToken, data.refreshToken);
        error.config.headers.Authorization = `Bearer ${data.accessToken}`;
        return apiClient(error.config);
      } catch {
        useAuthStore.getState().logout();
        window.location.href = '/login';
      }
    }
    return Promise.reject(normalizeError(error));
  }
);
```

### 4.8 TanStack Query Configuration

```typescript
// main.tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,        // 30 seconds before refetch
      gcTime: 5 * 60_000,       // 5 minutes in cache
      retry: 1,                 // Retry once on failure
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 0,                 // No retry on mutations
    },
  },
});
```

### 4.9 WebSocket Connection

```typescript
// hooks/useWebSocket.ts
const useWebSocket = () => {
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const { accessToken, orgId } = useAuthStore.getState();
    if (!accessToken) return;

    const ws = new WebSocket(`wss://api.tzahu.com/ws/notifications/?token=${accessToken}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const notification = JSON.parse(event.data);
      useNotificationStore.getState().addNotification(notification);
      useToastStore.getState().show({
        message: notification.message,
        type: notification.type,
      });
    };

    return () => ws.close();
  }, []);

  return wsRef;
};
```

---

## 5. Auth & Identity Module

### Pages

| Route | Component | Public | Description |
|-------|-----------|--------|-------------|
| /login | LoginPage | Yes | Email + password login form |
| /register | RegisterPage | Yes | Registration form |
| /forgot-password | ForgotPasswordPage | Yes | Email input for reset |
| /reset-password | ResetPasswordPage | Yes | New password form (token) |
| /verify-email | VerifyEmailPage | Yes | Email verification status |
| /auth/sessions | SessionsPage | No | Active sessions management |
| /profile | ProfilePage | No | User profile edit |
| /profile/password | ChangePasswordPage | No | Password change form |

### Components

| Component | Description |
|-----------|-------------|
| `LoginForm` | Email + password + "Remember me" + MFA field |
| `RegisterForm` | Name, email, password, timezone |
| `ForgotPasswordForm` | Email input + submit |
| `ResetPasswordForm` | New password + confirm |
| `VerifyEmailBanner` | Banner shown when email unverified |
| `SessionCard` | Device session with revoke button |
| `ProfileForm` | User profile edit form |
| `ChangePasswordForm` | Old + new + confirm password |

### Hooks

| Hook | Description |
|------|-------------|
| `useAuth` | Login, register, logout, refresh, user state |
| `useSession` | Session management |

### API Integration (TanStack Query)

```typescript
// Query keys
['user', 'me']             // GET /auth/me
['user', 'sessions']       // GET /auth/sessions

// Mutations
useMutation(login)         // POST /auth/login
useMutation(register)      // POST /auth/register
useMutation(refreshToken)  // POST /auth/refresh
useMutation(logout)        // POST /auth/logout
useMutation(changePassword) // PATCH /auth/me/password
useMutation(updateProfile) // PATCH /auth/me
```

### Forms (React Hook Form + Zod)

```typescript
const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().default(false),
});

const registerSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string()
    .min(12, 'Password must be at least 12 characters')
    .regex(/[A-Z]/, 'Must contain uppercase')
    .regex(/[a-z]/, 'Must contain lowercase')
    .regex(/[0-9]/, 'Must contain digit')
    .regex(/[^A-Za-z0-9]/, 'Must contain special character'),
  confirmPassword: z.string(),
  timezone: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});
```

---

## 6. Organization Module

### Pages

| Route | Component | Permission |
|-------|-----------|------------|
| /settings/org | OrgSettingsPage | organization.read |
| /settings/org/members | OrgMembersPage | user.read |

### Components

| Component | Description |
|-----------|-------------|
| `OrgSettingsForm` | Org name, slug, timezone, currency, logo |
| `MemberList` | Members table with roles |
| `InviteMemberDialog` | Invite email + role select |
| `MemberRow` | Member with status badge + actions |

### API Integration

```typescript
['org', settings]       // GET /orgs/{id}/settings
['org', members]        // GET /orgs/{id}/members

useMutation(inviteMember) // POST /orgs/{id}/members/invite
useMutation(removeMember) // DELETE /orgs/{id}/members/{user_id}
useMutation(updateOrg)    // PATCH /orgs/{id}
useMutation(updateSettings) // PUT /orgs/{id}/settings
```

---

## 7. RBAC Module

### Pages

| Route | Component | Permission |
|-------|-----------|------------|
| /settings/roles | RoleListPage | role.read |
| /settings/roles/new | RoleCreatePage | role.create |
| /settings/roles/:id | RoleDetailPage | role.read |

### Components

| Component | Description |
|-----------|-------------|
| `RoleTable` | List of roles with permission count, user count |
| `RoleForm` | Name, description, permission checkboxes |
| `PermissionTree` | Hierarchical permission selector (grouped by module) |
| `RoleAssignmentPanel` | Add/remove users from role |
| `RoleCard` | Role summary card (for dashboard) |

### State

```typescript
// Permission tree structure
interface PermissionGroup {
  module: string;
  icon: string;
  permissions: {
    entity: string;
    actions: { key: string; label: string }[];
  }[];
}
```

---

## 8. Lead Management Module

### Pages

| Route | Component | Permission |
|-------|-----------|------------|
| /leads | LeadListPage | lead.read |
| /leads/new | LeadCreatePage | lead.create |
| /leads/:id | LeadDetailPage | lead.read |
| /leads/import | LeadImportPage | lead.import |

### Components

| Component | Description |
|-----------|-------------|
| `LeadTable` | DataTable with columns: name, company, email, status, score, owner, created |
| `LeadFilters` | Filter panel: status, source, owner, date range, score range |
| `LeadForm` | Create/edit form: name, company, email, phone, source, notes |
| `LeadDetailHeader` | Header with status badge, score, owner, source |
| `LeadTimeline` | Activity timeline for this lead |
| `LeadStatusStepper` | Visual status progression (New -> Contacted -> Qualified -> Converted) |
| `LeadConversionDialog` | Convert lead to Contact + Account + Opportunity |
| `LeadScoreIndicator` | Circular score visualization (0-100) |
| `LeadDuplicateBanner` | Warning banner when duplicate detected |
| `LeadAssignmentSelect` | Owner assignment dropdown |
| `LeadImportDialog` | Drag-and-drop CSV/Excel upload with column mapping |
| `LeadMergeDialog` | Select master record, review field conflicts |
| `EmailPreview` | Email preview in timeline |
| `CallLogDialog` | Log a call against this lead |

### Hooks

| Hook | Description |
|------|-------------|
| `useLeads` | Lead list with filters, sorting, pagination |
| `useLead` | Single lead detail |
| `useLeadMutations` | Create, update, delete, convert, assign |
| `useLeadScore` | Lead score with factors breakdown |
| `useLeadImport` | File upload, parsing, mapping, import |

### API Integration

```typescript
// Queries
useQuery({ queryKey: ['leads', filters], queryFn: () => leadService.list(filters) })
useQuery({ queryKey: ['lead', id], queryFn: () => leadService.get(id) })
useInfiniteQuery({ queryKey: ['leads', 'timeline', id], ... })

// Mutations
useMutation({ mutationFn: leadService.create })
useMutation({ mutationFn: leadService.update })
useMutation({ mutationFn: leadService.delete })
useMutation({ mutationFn: leadService.convert })
useMutation({ mutationFn: leadService.assign })
useMutation({ mutationFn: leadService.qualify })
useMutation({ mutationFn: leadService.disqualify })
useMutation({ mutationFn: leadService.bulkCreate })

// Optimistic updates
useMutation({
  mutationFn: leadService.update,
  onMutate: async (data) => {
    await queryClient.cancelQueries(['lead', data.id]);
    const previous = queryClient.getQueryData(['lead', data.id]);
    queryClient.setQueryData(['lead', data.id], { ...previous, ...data });
    return { previous };
  },
  onError: (err, data, context) => {
    queryClient.setQueryData(['lead', data.id], context?.previous);
    showErrorToast('Failed to update lead');
  },
  onSettled: () => {
    queryClient.invalidateQueries(['lead']);
  },
});
```

### Loading & Error States

```typescript
// LeadListPage
if (isLoading) return <LoadingSkeleton rows={10} columns={5} />;
if (isError) return <ErrorState message="Failed to load leads" onRetry={() => refetch()} />;
if (data?.length === 0) return <EmptyState
  title="No leads yet"
  description="Create your first lead or import from CSV"
  action={<Button onClick={handleCreate}>Create Lead</Button>}
/>;
```

---

## 9. Contact Management Module

### Pages

| Route | Component | Permission |
|-------|-----------|------------|
| /contacts | ContactListPage | contact.read |
| /contacts/new | ContactCreatePage | contact.create |
| /contacts/:id | ContactDetailPage | contact.read |

### Components

| Component | Description |
|-----------|-------------|
| `ContactTable` | DataTable: name, email, phone, company, owner, status |
| `ContactFilters` | Filter: lifecycle stage, owner, tags, date range |
| `ContactForm` | Name, email, phone, address, company, title, preferences |
| `ContactDetailHeader` | Contact info with quick actions (call, email) |
| `CommunicationPreferences` | Opt-in/out per channel, quiet hours |
| `GDPRExportDialog` | Export all contact data (JSON) |
| `GDPRForgetDialog` | Anonymize contact data |
| `ContactMergeDialog` | Merge duplicates |
| `ContactTimeline` | Activity timeline |

---

## 10. Account Management Module

### Pages

| Route | Component | Permission |
|-------|-----------|------------|
| /accounts | AccountListPage | account.read |
| /accounts/new | AccountCreatePage | account.create |
| /accounts/:id | AccountDetailPage | account.read |

### Components

| Component | Description |
|-----------|-------------|
| `AccountTable` | DataTable: name, domain, industry, territory, owner |
| `AccountForm` | Name, domain, industry, size, territory, address, parent |
| `AccountHierarchyTree` | Parent/child account tree visualization |
| `AccountDetailHeader` | Account info with related contacts/opportunities |

---

## 11. Pipeline & Opportunity Module

### Pages

| Route | Component | Permission |
|-------|-----------|------------|
| /pipeline | PipelinePage | pipeline.read |
| /pipeline/settings | PipelineSettingsPage | pipeline.update |
| /opportunities | OpportunityListPage | opportunity.read |
| /opportunities/new | OpportunityCreatePage | opportunity.create |
| /opportunities/:id | OpportunityDetailPage | opportunity.read |
| /forecast | ForecastPage | opportunity.read |

### Components

| Component | Description |
|-----------|-------------|
| `PipelineKanban` | Kanban board with draggable cards per stage |
| `PipelineSelector` | Select active pipeline (dropdown) |
| `OpportunityCard` | Card with amount, probability, close date, owner |
| `OpportunityTable` | DataTable: name, amount, stage, probability, close date, owner |
| `OpportunityFilters` | Filter: pipeline, stage, owner, date range, amount range |
| `OpportunityForm` | Name, amount, currency, pipeline, stage, close date, competitor |
| `OpportunityDetailHeader` | Key metrics: amount, expected revenue, stage, probability |
| `StageChangeDialog` | Move to stage with validation |
| `WinLossDialog` | Win/loss reason, amount, notes |
| `ForecastChart` | Forecast visualization: expected vs. commit by period |
| `ForecastTable` | Forecast by owner/pipeline/territory |
| `FunnelChart` | Pipeline funnel: count and value per stage |
| `PipelineForm` | Pipeline name, description, stages reorderable |

### Hooks

| Hook | Description |
|------|-------------|
| `usePipeline` | Pipeline with stages |
| `useOpportunities` | Opportunity list with filters |
| `useOpportunity` | Single opportunity detail |
| `useForecast` | Forecast data for period |

### API Integration

```typescript
// Queries
useQuery(['pipeline', id])
useQuery(['stages', pipelineId])
useQuery(['opportunities', filters])
useQuery(['opportunity', id])
useQuery(['forecast', { period, groupBy }])

// Mutations
useMutation(createOpportunity)
useMutation(updateOpportunity)
useMutation(changeStage)
useMutation(winOpportunity)
useMutation(loseOpportunity)
```

---

## 12. Activity Module

### Pages

No dedicated page — activities are inline components on entity detail pages.

### Components

| Component | Description |
|-----------|-------------|
| `ActivityTimeline` | Chronological activity list with icons by type |
| `ActivityItem` | Single activity: type icon, subject, date, description |
| `LogCallDialog` | Log call: duration, outcome, notes |
| `LogEmailDialog` | Log email: to, subject, body, attachments |
| `LogMeetingDialog` | Log meeting: date, duration, attendees, notes |
| `LogNoteDialog` | Quick note: subject, body |
| `ActivityFilter` | Filter by type, date range, user |

---

## 13. Task Module

### Pages

| Route | Component | Permission |
|-------|-----------|------------|
| /tasks | TaskListPage | task.read |

### Components

| Component | Description |
|-----------|-------------|
| `TaskTable` | DataTable: subject, status, priority, due date, assignee, related to |
| `TaskFilters` | Filter: status, priority, assignee, due date range |
| `TaskForm` | Subject, description, status, priority, due date, assignee, related entity |
| `TaskQuickCreate` | Inline quick create (subject + due date + assignee) |
| `TaskStatusChip` | Color-coded status chip |
| `TaskPriorityIcon` | Priority icon (urgency indicator) |
| `TaskDashboardWidget` | My tasks, overdue tasks, today's tasks |

---

## 14. Calendar Module

### Pages

| Route | Component | Permission |
|-------|-----------|------------|
| /calendar | CalendarPage | activity.read |

### Components

| Component | Description |
|-----------|-------------|
| `CalendarView` | Monthly/weekly/daily calendar (MUI X Date Calendar) |
| `CalendarEvent` | Event chip/block with title, time |
| `MeetingForm` | Create meeting from CRM (subject, date, duration, attendees, entity link) |
| `CalendarSyncStatus` | Google/Outlook sync status indicator |
| `EventDetailDialog` | Event details with entity links |

---

## 15. Workflow Module

### Pages

| Route | Component | Permission |
|-------|-----------|------------|
| /workflows | WorkflowListPage | workflow.read |
| /workflows/new | WorkflowEditorPage | workflow.create |
| /workflows/:id | WorkflowEditorPage | workflow.update |
| /workflows/:id/executions | WorkflowExecutionsPage | workflow.read |
| /workflows/templates | WorkflowTemplatesPage | workflow.read |

### Components

| Component | Description |
|-----------|-------------|
| `WorkflowTable` | List with name, trigger, status, execution count, last run |
| `WorkflowEditor` | Visual workflow builder |
| `WorkflowTriggerSelect` | Select event trigger from catalog |
| `ConditionBuilder` | Visual AND/OR condition tree builder |
| `ConditionRow` | Single condition: field, operator, value |
| `ActionConfigurator` | Action type selection + parameter form |
| `ActionCard` | Action block in workflow editor |
| `ExecutionHistoryTable` | Log of executions: triggered by, result, duration |
| `ExecutionDetailDialog` | Step-by-step execution trace |
| `TestRunResult` | Simulated execution result (no side effects) |
| `TemplateCard` | Template gallery with install button |
| `WorkflowStatusToggle` | Enable/disable toggle |
| `WorkflowLoopWarning` | Warning when potential loop detected |

### State

```typescript
// Zustand store for workflow editor
interface WorkflowEditorStore {
  workflow: WorkflowDraft;
  selectedNode: string | null;
  addCondition: (parentId: string, condition: Condition) => void;
  removeCondition: (id: string) => void;
  addAction: (action: Action) => void;
  reorderActions: (from: number, to: number) => void;
  validate: () => ValidationResult;
  isDirty: boolean;
}
```

---

## 16. Notification Module

### Pages

No dedicated page — notifications appear in topbar and popover.

### Components

| Component | Description |
|-----------|-------------|
| `NotificationBell` | Topbar icon with unread count badge |
| `NotificationPopover` | Recent notifications list (10 items) |
| `NotificationItem` | Icon, message, timestamp, read/unread |
| `NotificationPreferencesForm` | Per-channel opt-in/out, quiet hours, digest |
| `NotificationCenterPage` | Full notification history (paginated) |
| `NotificationChannelIndicator` | Channel status (connected/disconnected) |

### State (Zustand)

```typescript
interface NotificationStore {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (n: Notification) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
}
```

---

## 17. Reports & Dashboard Module

### Pages

| Route | Component | Permission |
|-------|-----------|------------|
| /reports | ReportListPage | report.read |
| /reports/new | ReportBuilderPage | report.create |
| /reports/:id/edit | ReportBuilderPage | report.update |
| /reports/:id/view | ReportViewPage | report.read |
| /dashboards | DashboardListPage | report.read |
| /dashboards/new | DashboardEditPage | report.create |
| /dashboards/:id | DashboardViewPage | report.read |
| /dashboards/:id/edit | DashboardEditPage | report.update |

### Components

| Component | Description |
|-----------|-------------|
| `ReportBuilder` | Visual report builder: select source, dimensions, measures, filters |
| `ReportTable` | Report data table with sorting |
| `ReportChart` | Chart visualization based on chart type |
| `ReportFiltersBar` | Active filters with removable chips |
| `ReportExportMenu` | Export dropdown (CSV, PDF, XLSX) |
| `ReportScheduleForm` | Schedule: frequency, recipients, format |
| `DashboardGrid` | Responsive grid layout (react-grid-layout) |
| `DashboardWidget` | Widget container: title, chart/table, refresh |
| `WidgetConfigPanel` | Widget settings: type, size, linked report |
| `KPICard` | Single metric with trend indicator |
| `ChartSelector` | Chart type picker (bar, line, pie, funnel, table) |
| `DateRangePicker` | Predefined ranges + custom range |
| `SavedReportCard` | Report card in list view |
| `ForecastChart` | Forecast with expected vs. committed |
| `ForecastBreakdown` | Forecast by owner, pipeline, territory |

### Hooks

| Hook | Description |
|------|-------------|
| `useReports` | Report list |
| `useReport` | Report detail with data |
| `useReportExecute` | Execute report (async for large sets) |
| `useDashboard` | Dashboard with widgets data |
| `useForecast` | Forecast data |

---

## 18. AI Module

### Pages

| Route | Component | Permission |
|-------|-----------|------------|
| /ai/leads/:id/score | LeadScorePage | lead.read |
| /ai/rag | RAGQueryPage | ai.read |
| /ai/usage | AIUsagePage | ai.read |
| /ai/prompts | PromptManagementPage | ai.read |

### Components

| Component | Description |
|-----------|-------------|
| `ScoreBreakdown` | Lead score with explainable factors (SHAP waterfall) |
| `ScoreGauge` | Visual score gauge (0-100) |
| `NextBestActionPanel` | Recommended actions with rationale |
| `SentimentIndicator` | Sentiment trend chart |
| `ConversationSummary` | AI-generated summary with entity extraction |
| `RAGQueryInput` | Question input with context selector |
| `RAGResponse` | Answer with source citations |
| `AICostChart` | Token usage by feature, by org |
| `PromptEditor` | Versioned prompt template editor |
| `PromptVersionHistory` | Prompt version diff viewer |
| `AIInsightCard` | Generic AI insight display |

---

## 19. Voice AI Module

### Pages

| Route | Component | Permission |
|-------|-----------|------------|
| /calls | CallListPage | activity.read |
| /calls/:id | CallDetailPage | activity.read |

### Components

| Component | Description |
|-----------|-------------|
| `CallTable` | DataTable: from, to, duration, outcome, linked entity |
| `CallDetailHeader` | Phone numbers, duration, recording player |
| `TranscriptionView` | Scrollable transcript with speaker labels, timestamps |
| `CallAnalysisPanel` | Sentiment score, talk ratio, objections detected |
| `CoachingTipsPanel` | Real-time coaching suggestions |
| `CallOutcomeForm` | Outcome, notes, follow-up task creation |
| `DialerButton` | Click-to-call button on contacts |

---

## 20. Integration Module

### Pages

| Route | Component | Permission |
|-------|-----------|------------|
| /integrations | IntegrationListPage | integration.read |
| /integrations/new | IntegrationCreatePage | integration.create |
| /integrations/:id | IntegrationDetailPage | integration.read |

### Components

| Component | Description |
|-----------|-------------|
| `IntegrationCard` | Connector card: logo, name, status, last sync |
| `OAuthConnectButton` | Provider OAuth flow initiation |
| `IntegrationConfigForm` | API keys, endpoints, settings |
| `SyncStatusIndicator` | Sync progress, last sync time, records synced |
| `SyncJobHistory` | List of sync jobs with status, duration, record count |
| `WebhookTable` | Webhook subscriptions list |
| `WebhookForm` | Create webhook: event type, target URL, filters |
| `ConnectorLogViewer` | Integration log with filtering |

---

## 21. Settings Module

### Pages

| Route | Component | Permission |
|-------|-----------|------------|
| /settings | SettingsPage (redirect to profile) | authenticated |
| /settings/org | OrgSettingsTab | organization.update |
| /settings/roles | RoleListTab | role.read |
| /settings/members | MemberListTab | user.read |
| /settings/notifications | NotificationPreferencesTab | authenticated |
| /settings/integrations | IntegrationListTab | integration.read |
| /settings/billing | BillingTab | organization.read (future) |
| /settings/security | SecurityTab | authenticated |

### Components

| Component | Description |
|-----------|-------------|
| `SettingsSidebar` | Navigation for settings sections |
| `OrgSettingsForm` | Organization name, timezone, locale, currency |
| `FeatureFlagList` | Enabled/disabled features for org |
| `BillingPlanCard` | Current plan, usage, upgrade button |

---

## 22. Search Module

### Components

| Component | Description |
|-----------|-------------|
| `GlobalSearchInput` | Topbar search with keyboard shortcut |
| `SearchResultsDropdown` | Results grouped by entity type |
| `SearchResultItem` | Entity name, type icon, matched field highlight |
| `SearchPage` | Full search results page with filters |

### API Integration

```typescript
// Debounced search query
useQuery({
  queryKey: ['search', debouncedQuery, filters],
  queryFn: () => searchService.search(debouncedQuery, filters),
  enabled: debouncedQuery.length >= 2,
  keepPreviousData: true,
});
```

---

## 23. Implementation Order by Phase

### Phase 0-1 (Foundation + Auth)

| Week | Deliverable |
|------|-------------|
| 1 | Vite + React + TS project scaffold, MUI theme, routing, Axios client |
| 2 | Auth pages (login, register, forgot/reset password), auth store, route guards |
| 3 | Permission system, API interceptors, error handling, toast notifications |

### Phase 2 (Multi-Tenancy)

| Week | Deliverable |
|------|-------------|
| 4 | Org context persistence, org switcher UI (if multi-org) |

### Phase 3 (Leads, Contacts, Accounts)

| Week | Deliverable |
|------|-------------|
| 5-6 | Lead list + detail + form pages, lead table with filters |
| 7 | Lead scoring visualization, conversion dialog, import page |
| 8 | Contact list + detail + form, merge dialog, GDPR dialogs |
| 9 | Account list + detail + form, hierarchy tree, territory assignment |

### Phase 4 (Pipeline, Opportunities, Activities, Tasks)

| Week | Deliverable |
|------|-------------|
| 10 | Pipeline kanban board, stage management, pipeline settings |
| 11 | Opportunity list + detail + form, stage change, win/loss |
| 12 | Forecast page with charts, activity timeline component |
| 13 | Task list + quick create, calendar page |

### Phase 5-6 (Workflow, Notifications)

| Week | Deliverable |
|------|-------------|
| 14-15 | Workflow visual editor (drag & drop conditions/actions) |
| 16 | Workflow execution history, test-run, templates gallery |
| 17 | Notification center, preferences, real-time WebSocket integration |

### Phase 7 (Reports, Dashboards)

| Week | Deliverable |
|------|-------------|
| 18-19 | Report builder (visual dimension/measure selection) |
| 20 | Dashboard grid with widgets, chart library integration |
| 21 | Forecasting charts, report scheduling UI, export |

### Phase 8 (AI)

| Week | Deliverable |
|------|-------------|
| 22 | AI score breakdown panel, next-best-action widget |
| 23 | Sentiment indicators, conversation summary view, RAG query page |
| 24 | AI usage dashboard, prompt management UI |

### Phase 9 (Voice AI)

| Week | Deliverable |
|------|-------------|
| 25 | Call log table, transcription view, recording player |
| 26 | Call analysis panel, coaching tips, click-to-dial |

### Phase 10 (Integrations)

| Week | Deliverable |
|------|-------------|
| 27 | Integration list/gallery, OAuth connect flow, config forms |
| 28 | Sync status, job history, webhook management, log viewer |

### Phase 11 (Enterprise)

| Week | Deliverable |
|------|-------------|
| 29 | SSO login page, field-level permission controls in forms |
| 30 | Data residency indicator, performance optimization (lazy loading, code splitting) |

---

## 24. Theme & Accessibility

### MUI Theme Configuration

```typescript
// theme.ts
const theme = createTheme({
  palette: {
    primary: {
      main: '#1A73E8',       // Google Blue-inspired
      light: '#4A9AF5',
      dark: '#0D47A1',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#00BFA5',       // Teal accent
      light: '#5DF2D6',
      dark: '#008E76',
    },
    success: { main: '#2E7D32' },
    warning: { main: '#ED6C02' },
    error: { main: '#D32F2F' },
    info: { main: '#0288D1' },
    background: {
      default: '#F5F5F5',
      paper: '#FFFFFF',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontSize: '2rem', fontWeight: 600 },
    h2: { fontSize: '1.5rem', fontWeight: 600 },
    h3: { fontSize: '1.25rem', fontWeight: 600 },
    body1: { fontSize: '0.875rem' },
    body2: { fontSize: '0.75rem' },
    button: { textTransform: 'none', fontWeight: 500 },
  },
  shape: { borderRadius: 8 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 8, padding: '8px 16px' },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: { borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' },
      },
    },
    MuiDataGrid: {
      styleOverrides: {
        root: { border: 'none', fontSize: '0.875rem' },
      },
    },
  },
});
```

### Dark Mode

- `darkTheme.ts` extends base theme with dark palette
- Toggle stored in Zustand `uiStore` with persist middleware
- System preference respected via `prefers-color-scheme` media query
- MUI's `CssBaseline` and `ThemeProvider` wrap the app

### Accessibility

| Requirement | Implementation |
|-------------|----------------|
| Keyboard navigation | MUI components are keyboard-accessible by default |
| Screen readers | ARIA labels on all interactive elements, `role` attributes |
| Color contrast | WCAG AA minimum (4.5:1 for text, 3:1 for large text) |
| Focus indicators | Visible focus ring on all interactive elements |
| Reduced motion | `prefers-reduced-motion` media query disables animations |
| Font scaling | Relative units (rem) for all text sizes |
| Error announcements | `aria-live="polite"` for form validation errors |
| Skip links | "Skip to main content" link at top of page |
| Language | `lang` attribute on HTML element, i18n for all UI text |
