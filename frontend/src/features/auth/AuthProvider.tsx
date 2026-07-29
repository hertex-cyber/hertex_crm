import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuthStore } from "@store/authStore";
import api from "@services/api";

interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: ReturnType<typeof useAuthStore.getState>["user"];
}

const AuthContext = createContext<AuthContextValue>({
  isAuthenticated: false,
  isLoading: true,
  user: null,
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [initialLoading, setInitialLoading] = useState(true);
  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const setTokens = useAuthStore((s) => s.setTokens);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (refreshToken && !accessToken) {
      api
        .post("/auth/refresh", { refresh_token: refreshToken })
        .then(({ data }) => {
          setTokens(data.access_token, data.refresh_token);
        })
        .catch(() => logout())
        .finally(() => setInitialLoading(false));
    } else {
      setInitialLoading(false);
    }
  }, []);

  const setOrganizations = useAuthStore((s) => s.setOrganizations);
  const [orgsLoaded, setOrgsLoaded] = useState(false);

  useEffect(() => {
    if (accessToken && !user) {
      api
        .get("/auth/me")
        .then(({ data }) => setUser(data))
        .catch(() => {});
    }
  }, [accessToken, user, setUser]);

  useEffect(() => {
    if (accessToken) {
      api
        .get("/orgs/")
        .then(({ data }) => {
          if (Array.isArray(data)) {
            setOrganizations(data);
          }
        })
        .catch(() => {})
        .finally(() => setOrgsLoaded(true));
    } else {
      setOrgsLoaded(true);
    }
  }, [accessToken, setOrganizations]);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: !!accessToken,
        isLoading: initialLoading || (!!accessToken && (!user || !orgsLoaded)),
        user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
