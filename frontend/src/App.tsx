import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@features/auth/AuthProvider";
import { AppLayout } from "@components/layout/AppLayout";
import { AuthLayout } from "@components/layout/AuthLayout";
import { LoginPage } from "@features/auth/LoginPage";
import { RegisterPage } from "@features/auth/RegisterPage";
import { ForgotPasswordPage } from "@features/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "@features/auth/ResetPasswordPage";
import { ProfilePage } from "@features/auth/ProfilePage";
import { UsersPage, UserDetailPage } from "@features/auth/UsersPage";
import { DashboardPage } from "@pages/DashboardPage";
import LandingPage from "@pages/LandingPage";
import { OrgSettingsPage } from "@features/org/OrgSettingsPage";
import { OrgSetupWizard } from "@features/org/OrgSetupWizard";
import { JoinPage } from "@features/org/JoinPage";
import { RolesPage } from "@features/rbac/RolesPage";
import { usePermissions } from "@features/rbac/usePermissions";
import { LeadsPage } from "@features/leads/LeadsPage";
import { LeadDetailPage } from "@features/leads/LeadDetailPage";
import { PipelinesPage } from "@features/leads/PipelinesPage";
import { useAuthStore } from "@store/authStore";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <div>Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function OrgRoute({ children }: { children: React.ReactNode }) {
  const organizations = useAuthStore((s) => s.organizations);
  const accessToken = useAuthStore((s) => s.accessToken);
  if (!accessToken) return <Navigate to="/login" replace />;
  if (organizations === null) return <div>Loading organizations...</div>;
  if (organizations.length === 0) return <Navigate to="/setup-workspace" replace />;
  return <>{children}</>;
}

function PermissionRoute({ children, permission }: { children: React.ReactNode; permission: string }) {
  const { isLoading, hasPermission } = usePermissions();
  if (isLoading) return <div>Loading permissions...</div>;
  if (!hasPermission(permission)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/join" element={<JoinPage />} />

      {/* Landing page at root — public, no auth needed */}
      <Route path="/" element={<LandingPage />} />

      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
      </Route>
      <Route path="/setup-workspace" element={
        <ProtectedRoute>
          <OrgSetupWizard />
        </ProtectedRoute>
      } />
      <Route
        element={
          <ProtectedRoute>
            <OrgRoute>
              <AppLayout />
            </OrgRoute>
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/users/:id" element={<UserDetailPage />} />
        <Route path="/orgs" element={<OrgSettingsPage />} />
        <Route path="/roles" element={<PermissionRoute permission="organization.manage"><RolesPage /></PermissionRoute>} />
        <Route path="/leads" element={<LeadsPage />} />
        <Route path="/leads/:id" element={<LeadDetailPage />} />
        <Route path="/pipelines" element={<PipelinesPage />} />
      </Route>
    </Routes>
  );
}
