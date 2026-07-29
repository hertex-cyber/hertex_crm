# Frontend Architecture — React Application Design

## Technology Stack

| Technology | Purpose | Version |
|------------|---------|---------|
| React | UI Framework | 18.x |
| TypeScript | Type Safety | 5.x |
| Vite | Build Tool | 5.x |
| MUI 5 | Component Library | 5.x |
| TanStack Query | Server State / Data Fetching | 5.x |
| Zustand | Client State Management | 4.x |
| React Router 6 | Routing | 6.x |
| Axios | HTTP Client | 1.x |
| React Hook Form | Form Management | 7.x |
| Zod | Schema Validation | 3.x |
| Playwright | E2E Testing | latest |

## Project Structure

```
src/
├── app/
│   ├── App.tsx                    — Root component with providers
│   ├── router.tsx                 — Route configuration
│   ├── theme.ts                   — MUI theme customization
│   └── providers.tsx              — Context providers stack
├── features/                      — Feature-based modules
│   ├── auth/
│   │   ├── api/                   — Auth API functions
│   │   ├── components/            — Login, Register, ForgotPassword
│   │   ├── hooks/                 — useLogin, useRegister, useAuth
│   │   ├── stores/                — authStore (Zustand)
│   │   └── types/                 — Auth types
│   ├── leads/
│   │   ├── api/
│   │   ├── components/
│   │   │   ├── LeadTable.tsx
│   │   │   ├── LeadDetail.tsx
│   │   │   ├── LeadForm.tsx
│   │   │   ├── LeadStatusBadge.tsx
│   │   │   ├── LeadScoreIndicator.tsx
│   │   │   ├── LeadKanban.tsx
│   │   │   ├── LeadTimeline.tsx
│   │   │   ├── LeadDuplicateWarning.tsx
│   │   │   └── LeadImportDialog.tsx
│   │   ├── hooks/
│   │   │   ├── useLeads.ts
│   │   │   ├── useLead.ts
│   │   │   ├── useLeadMutations.ts
│   │   │   └── useLeadDuplicates.ts
│   │   ├── stores/
│   │   │   └── leadFilterStore.ts
│   │   └── types/
│   ├── opportunities/
│   ├── contacts/
│   ├── accounts/
│   ├── pipeline/
│   ├── workflows/
│   ├── reports/
│   ├── ai-chat/
│   └── settings/
├── shared/                        — Shared components and utilities
│   ├── components/
│   │   ├── DataTable/
│   │   │   ├── DataTable.tsx      — Generic virtualized data table
│   │   │   ├── DataTablePagination.tsx
│   │   │   ├── DataTableFilters.tsx
│   │   │   ├── ColumnHeader.tsx
│   │   │   └── useDataTableSort.ts
│   │   ├── DetailPanel/
│   │   │   ├── DetailPanel.tsx    — Entity detail container
│   │   │   ├── DetailTabs.tsx
│   │   │   └── DetailActions.tsx
│   │   ├── FormBuilder/
│   │   │   ├── FormBuilder.tsx    — Dynamic form from schema
│   │   │   ├── FormField.tsx
│   │   │   └── FormErrors.tsx
│   │   ├── Layout/
│   │   │   ├── Shell.tsx          — App shell (sidebar + topbar + content)
│   │   │   ├── Sidebar.tsx
│   │   │   ├── TopBar.tsx
│   │   │   ├── Breadcrumbs.tsx
│   │   │   ├── StatusBar.tsx
│   │   │   └── GlobalSearch.tsx
│   │   ├── Feedback/
│   │   │   ├── LoadingSkeleton.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   ├── ErrorBoundary.tsx
│   │   │   ├── ErrorFallback.tsx
│   │   │   ├── Toast.tsx
│   │   │   └── ConfirmDialog.tsx
│   │   ├── Permissions/
│   │   │   ├── PermissionGate.tsx — Conditional render by permission
│   │   │   └── usePermissions.ts
│   │   └── AI/
│   │       ├── SmartSuggestion.tsx
│   │       ├── AIInsightCard.tsx
│   │       └── AIScoreIndicator.tsx
│   ├── hooks/
│   │   ├── useDebounce.ts
│   │   ├── useLocalStorage.ts
│   │   ├── useBreakpoint.ts
│   │   ├── useKeyboardShortcut.ts
│   │   └── useOptimisticUpdate.ts
│   ├── lib/
│   │   ├── api.ts                 — Axios instance, interceptors
│   │   ├── queryClient.ts         — TanStack Query client config
│   │   ├── pagination.ts          — Cursor/Page pagination helpers
│   │   ├── permissions.ts         — Permission helpers
│   │   └── utils.ts               — Date formatting, currency, etc.
│   ├── types/
│   │   ├── api.ts                 — Generic API types (PaginatedResponse, etc.)
│   │   ├── models.ts              — Shared entity types
│   │   └── common.ts              — Utility types
│   └── constants/
│       ├── routes.ts
│       ├── permissions.ts
│       └── enums.ts
└── index.tsx                      — Entry point
```

## State Management Architecture

### Three Layers of State

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Server State (TanStack Query)                             │
│    - API data: leads, opportunities, contacts, etc.          │
│    - Cached, stale-while-revalidate, automatic refetch       │
│    - Mutations with optimistic updates                       │
├─────────────────────────────────────────────────────────────┤
│ 2. Client State (Zustand)                                    │
│    - UI state: sidebar open, active filters, selected rows   │
│    - Auth state: current user, tokens                        │
│    - Transient state: form drafts, unsaved changes           │
├─────────────────────────────────────────────────────────────┤
│ 3. URL State (React Router)                                  │
│    - Current route, query params (filters, page, search)     │
│    - Source of truth for shareable/persistable state         │
└─────────────────────────────────────────────────────────────┘
```

### Zustand Stores

```typescript
// authStore — Authentication & user session
interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  permissions: string[];
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshTokens: () => Promise<void>;
  hasPermission: (codename: string) => boolean;
}

// leadFilterStore — Persistent lead list filters
interface LeadFilterState {
  filters: LeadFilters;
  sort: string;
  viewMode: 'table' | 'kanban';
  setFilter: (key: string, value: any) => void;
  resetFilters: () => void;
  setSort: (sort: string) => void;
  toggleViewMode: () => void;
}

// uiStore — Global UI state
interface UIState {
  sidebarOpen: boolean;
  sidebarWidth: number;
  globalSearchOpen: boolean;
  theme: 'light' | 'dark';
  toggleSidebar: () => void;
  toggleTheme: () => void;
  openGlobalSearch: () => void;
}

// notificationStore — Real-time notifications
interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (n: Notification) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
}
```

## Data Fetching (TanStack Query)

### Query Configuration

```typescript
// src/shared/lib/queryClient.ts
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,           // 30s until stale
      gcTime: 5 * 60_000,          // 5min in cache
      retry: 2,
      refetchOnWindowFocus: false,  // Disable for CRM (data changes slower)
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 0,
    },
  },
});
```

### Query Hooks Pattern

```typescript
// features/leads/hooks/useLeads.ts
const useLeads = (filters: LeadFilters, sort: string, cursor?: string) => {
  return useInfiniteQuery({
    queryKey: ['leads', filters, sort],
    queryFn: ({ pageParam }) => leadApi.listLeads({ ...filters, sort, cursor: pageParam }),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.meta.pagination.next_cursor,
  });
};

const useLead = (id: string) => {
  return useQuery({
    queryKey: ['lead', id],
    queryFn: () => leadApi.getLead(id),
    enabled: !!id,
  });
};
```

### Mutation Hooks Pattern

```typescript
// features/leads/hooks/useLeadMutations.ts
const useCreateLead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateLeadDTO) => leadApi.createLead(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Lead created successfully');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
};

const useUpdateLeadStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      leadApi.changeStatus(id, status),
    // Optimistic update
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ['lead', id] });
      const previous = queryClient.getQueryData(['lead', id]);
      queryClient.setQueryData(['lead', id], (old: any) => ({
        ...old, lead_status: status,
      }));
      return { previous };
    },
    onError: (err, vars, context) => {
      queryClient.setQueryData(['lead', vars.id], context?.previous);
      toast.error('Failed to update status');
    },
    onSettled: (data, err, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['lead', id] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });
};
```

### Optimistic Update Pattern

Optimistic updates are used for high-confidence, reversible operations:
- Stage changes (pipeline kanban drag-and-drop)
- Status changes
- Assignment changes
- Quick inline edits (score, rating, tags)

Optimistic updates are NOT used for:
- Deletions (too destructive to revert)
- Financial operations (amount, probability)
- Bulk operations (too many potential conflicts)

## Routing (React Router 6)

```typescript
// src/app/router.tsx
const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
      { path: '/reset-password/:token', element: <ResetPasswordPage /> },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <Navigate to="/dashboard" /> },
          { path: 'dashboard', element: <DashboardPage /> },
          {
            path: 'leads',
            children: [
              { index: true, element: <LeadListPage /> },
              { path: ':id', element: <LeadDetailPage /> },
              { path: 'new', element: <LeadCreatePage /> },
              { path: 'import', element: <LeadImportPage /> },
            ],
          },
          {
            path: 'opportunities',
            children: [
              { index: true, element: <OpportunityListPage /> },
              { path: ':id', element: <OpportunityDetailPage /> },
              { path: 'new', element: <OpportunityCreatePage /> },
            ],
          },
          { path: 'pipeline', element: <PipelineKanbanPage /> },
          { path: 'contacts', element: <ContactListPage /> },
          { path: 'contacts/:id', element: <ContactDetailPage /> },
          { path: 'accounts', element: <AccountListPage /> },
          { path: 'accounts/:id', element: <AccountDetailPage /> },
          { path: 'reports', element: <ReportListPage /> },
          { path: 'reports/builder', element: <ReportBuilderPage /> },
          { path: 'workflows', element: <WorkflowListPage /> },
          { path: 'workflows/:id/editor', element: <WorkflowEditorPage /> },
          { path: 'ai-chat', element: <AIChatPage /> },
          { path: 'settings/*', element: <SettingsPage /> },
        ],
      },
    ],
  },
]);
```

### Route Guards

```typescript
// Permission-based route guard
const ProtectedRoute = () => {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" />;
};

// Feature/Module guard
const ModuleRoute = ({ module, permission }: { module: string; permission: string }) => {
  const { hasPermission } = useAuthStore();
  if (!hasPermission(permission)) return <Navigate to="/403" />;
  return <Outlet />;
};

// Route usage:
<Route path="leads" element={<ModuleRoute module="lead" permission="lead.view_lead" />}>
  <Route index element={<LeadListPage />} />
</Route>
```

## Permission-Based Rendering

```typescript
// Component-level permission gate
const PermissionGate = ({ codename, fallback, children }: {
  codename: string;
  fallback?: ReactNode;
  children: ReactNode;
}) => {
  const { hasPermission } = useAuthStore();
  if (!hasPermission(codename)) return fallback ?? null;
  return <>{children}</>;
};

// Usage:
<PermissionGate codename="lead.add_lead" fallback={<DisabledButton tooltip="No permission" />}>
  <Button onClick={handleCreate}>Create Lead</Button>
</PermissionGate>

// Hook-based permission check
const usePermissions = () => {
  const { permissions } = useAuthStore();
  const can = useCallback((codename: string) => permissions.includes(codename), [permissions]);
  return { can, permissions };
};

// Usage in component:
const { can } = usePermissions();
if (can('lead.delete_lead')) { /* show delete button */ }
```

## Error Handling Strategy

### Error Boundary Hierarchy
```
App (Root Error Boundary)
├── Shell Error Boundary
│   ├── Sidebar Error Boundary
│   └── Content Area Error Boundary
│       ├── Page Error Boundary (per route)
│       └── Component Error Boundary (per widget/chart)
```

### Error Types & Handling
```typescript
// API Error Handler (Axios interceptor)
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorResponse>) => {
    const status = error.response?.status;
    const errorCode = error.response?.data?.errors?.[0]?.code;

    if (status === 401) {
      // Attempt token refresh
      try {
        await authStore.getState().refreshTokens();
        // Retry original request
        return api(error.config!);
      } catch {
        authStore.getState().logout();
        window.location.href = '/login';
      }
    }

    if (status === 403) {
      notify('You do not have permission to perform this action', 'error');
    }

    if (status === 429) {
      notify('Rate limit exceeded. Please wait.', 'warning');
    }

    return Promise.reject(error);
  }
);
```

## Form Handling

```typescript
// React Hook Form + Zod validation
const leadFormSchema = z.object({
  first_name: z.string().min(1, 'First name is required').max(255),
  last_name: z.string().min(1, 'Last name is required').max(255),
  email: z.string().email('Invalid email'),
  phone: z.string().regex(/^\+[1-9]\d{1,14}$/, 'Invalid phone format').optional(),
  company_name: z.string().optional(),
  lead_source: z.enum(['WEBSITE', 'REFERRAL', 'COLD_CALL', 'EVENT', 'PARTNER', 'OTHER']),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

type LeadFormData = z.infer<typeof leadFormSchema>;

const LeadCreateForm = () => {
  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<LeadFormData>({
      resolver: zodResolver(leadFormSchema),
      defaultValues: { lead_source: 'WEBSITE' },
    });

  return (
    <form onSubmit={handleSubmit(handleCreateLead)}>
      <TextField {...register('first_name')} error={!!errors.first_name} ... />
      <TextField {...register('email')} error={!!errors.email} ... />
      <Autocomplete {...register('lead_source')} options={LEAD_SOURCES} ... />
      <Button type="submit" loading={isSubmitting}>Create Lead</Button>
    </form>
  );
};
```

## Real-Time Updates

Real-time features use WebSocket connections managed through a custom hook:

```typescript
// WebSocket connection for real-time events
const useRealtimeUpdates = (eventTypes: string[], onEvent: (event: DomainEvent) => void) => {
  useEffect(() => {
    const ws = new WebSocket(`wss://api.tzahu.com/ws/events/?token=${accessToken}`);

    ws.onmessage = (msg) => {
      const event = JSON.parse(msg.data);
      if (eventTypes.includes(event.event_type)) {
        onEvent(event);
        // Optionally invalidate relevant TanStack Query caches
        queryClient.invalidateQueries({ queryKey: [event.aggregate_type] });
      }
    };

    return () => ws.close();
  }, [eventTypes.join(',')]);
};

// Usage in Pipeline Kanban (real-time stage updates)
useRealtimeUpdates(
  ['OpportunityStageChanged', 'OpportunityCreated'],
  (event) => {
    queryClient.invalidateQueries({ queryKey: ['opportunities'] });
  }
);
```

## Performance Optimization

| Technique | Usage | Impact |
|-----------|-------|--------|
| React.memo | DataTable rows, Kanban cards | Reduces re-renders |
| useMemo | Filtered/sorted lists | Avoids recomputation |
| useCallback | Event handlers passed to children | Stable references |
| Code Splitting | Route-level `lazy()` | Faster initial load |
| Virtual Scrolling | DataTable (react-window) | Renders only visible rows |
| Debounced Search | Global search (300ms) | Reduces API calls |
| Skeleton Loading | All async views | Perceived performance |
| Optimistic Updates | Status, stage, assignment | Instant UI feedback |
| Query Caching | TanStack Query staleTime | Redundant API calls |
| Bundle Analysis | `vite-bundle-analyzer` | Identifies large deps |

## Testing Strategy

| Layer | Tool | Focus |
|-------|------|-------|
| Unit | Vitest | Hooks, utils, store logic, validation |
| Component | Vitest + Testing Library | Component rendering, interactions, error states |
| Integration | Vitest + MSW (Mock Service Worker) | Feature workflows, API integration |
| E2E | Playwright | Critical user journeys, cross-browser |
| Visual | Chromatic / Storybook | Visual regression for components |

### Component Test Pattern
```typescript
// Component test example
describe('LeadTable', () => {
  it('displays leads from query', async () => {
    render(<LeadTable />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('Jane Cooper')).toBeInTheDocument();
    });
  });

  it('shows empty state when no leads', async () => {
    render(<LeadTable />);
    await waitFor(() => {
      expect(screen.getByText('No leads found')).toBeInTheDocument();
    });
  });
});
```

## Build & Deploy

```typescript
// vite.config.ts
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', '@mui/material'],
          query: ['@tanstack/react-query'],
          utils: ['date-fns', 'zod'],
        },
      },
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
});
```
