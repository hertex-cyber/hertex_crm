import { create } from "zustand";

interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  display_name: string;
  status: string;
  timezone: string;
  locale: string;
  avatar_url?: string | null;
  created_at: string;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  description?: string;
  status: string;
  created_at: string;
}

interface Session {
  id: string;
  device_name: string | null;
  device_type: string | null;
  ip_address: string | null;
  created_at: string;
  last_used_at: string | null;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  organizations: Organization[] | null;
  currentOrganization: Organization | null;
  setTokens: (access: string, refresh: string) => void;
  setUser: (user: User) => void;
  setOrganizations: (orgs: Organization[]) => void;
  setCurrentOrganization: (org: Organization) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: localStorage.getItem("access_token"),
  refreshToken: localStorage.getItem("refresh_token"),
  user: null,
  organizations: null,
  currentOrganization: null,
  setTokens: (access, refresh) => {
    localStorage.setItem("access_token", access);
    localStorage.setItem("refresh_token", refresh);
    set({ accessToken: access, refreshToken: refresh });
  },
  setUser: (user) => set({ user }),
  setOrganizations: (orgs) => {
    const stored = localStorage.getItem("current_org_id");
    const current = orgs.length ? (stored ? orgs.find((o) => o.id === stored) || orgs[0] : orgs[0]) : null;
    if (current) {
      localStorage.setItem("current_org_id", current.id);
    }
    set({ organizations: orgs, currentOrganization: current || null });
  },
  setCurrentOrganization: (org) => {
    localStorage.setItem("current_org_id", org.id);
    set({ currentOrganization: org });
  },
  logout: () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("current_org_id");
    set({ accessToken: null, refreshToken: null, user: null, organizations: null, currentOrganization: null });
  },
}));

export type { User, Organization, Session };
