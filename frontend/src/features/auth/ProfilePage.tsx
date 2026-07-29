import { useState, useRef } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Chip from "@mui/material/Chip";
import Avatar from "@mui/material/Avatar";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Badge from "@mui/material/Badge";
import CameraAlt from "@mui/icons-material/CameraAlt";
import CalendarToday from "@mui/icons-material/CalendarToday";
import AccessTime from "@mui/icons-material/AccessTime";
import Security from "@mui/icons-material/Security";
import Edit from "@mui/icons-material/Edit";
import Shield from "@mui/icons-material/Shield";
import Devices from "@mui/icons-material/Devices";
import LoginIcon from "@mui/icons-material/Login";
import NotificationsActive from "@mui/icons-material/NotificationsActive";
import Language from "@mui/icons-material/Language";
import DarkMode from "@mui/icons-material/DarkMode";
import Key from "@mui/icons-material/Key";
import CheckCircle from "@mui/icons-material/CheckCircle";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import ArrowForward from "@mui/icons-material/ArrowForward";
import { useAuthStore } from "@store/authStore";
import api from "@services/api";

const cardHover = {
  transition: "transform 0.25s ease, box-shadow 0.25s ease",
  "&:hover": {
    transform: "translateY(-2px)",
    boxShadow: "0 8px 25px rgba(0,0,0,0.08)",
  },
};

function StatBadge({ icon, value, label, color }: { icon: React.ReactNode; value: string; label: string; color: string }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, p: 1.5, borderRadius: 2, bgcolor: `${color}08`, border: 1, borderColor: `${color}20` }}>
      <Box sx={{ width: 36, height: 36, borderRadius: 1.5, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: `${color}15`, color }}>
        {icon}
      </Box>
      <Box>
        <Typography sx={{ fontSize: "0.9rem", fontWeight: 700, color: "text.primary", lineHeight: 1.2 }}>{value}</Typography>
        <Typography sx={{ fontSize: "0.65rem", color: "text.disabled", fontWeight: 500 }}>{label}</Typography>
      </Box>
    </Box>
  );
}

export function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [showPw, setShowPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append("avatar", file);
      const { data: updated } = await api.put("/auth/me", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setUser(updated);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Avatar upload failed");
    } finally {
      setAvatarUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    const data = new FormData(e.currentTarget);
    try {
      const { data: updated } = await api.put("/auth/me", {
        first_name: data.get("first_name"),
        last_name: data.get("last_name"),
        timezone: data.get("timezone"),
        locale: data.get("locale"),
      });
      setUser(updated);
      setSuccess("Profile updated successfully");
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Update failed");
    } finally {
      setLoading(false);
    }
  };

  const [pwLoading, setPwLoading] = useState(false);
  const [pwSuccess, setPwSuccess] = useState("");
  const [pwError, setPwError] = useState("");

  const handleChangePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPwError("");
    setPwSuccess("");
    setPwLoading(true);
    const data = new FormData(e.currentTarget);
    try {
      await api.post("/auth/change-password", {
        current_password: data.get("current_password"),
        new_password: data.get("new_password"),
      });
      setPwSuccess("Password changed successfully");
      e.currentTarget.reset();
    } catch (err: any) {
      setPwError(err.response?.data?.error?.message || "Failed to change password");
    } finally {
      setPwLoading(false);
    }
  };

  const initials = user
    ? `${user.first_name.charAt(0)}${user.last_name.charAt(0)}`.toUpperCase()
    : "?";

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long" })
    : "—";

  const lastLogin = user?.last_login
    ? new Date(user.last_login).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {/* Header */}
      <Box>
        <Typography variant="h4" sx={{ color: "text.primary", mb: 0.25 }}>
          Profile Settings
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Manage your account details, security, and preferences
        </Typography>
      </Box>

      {/* Bento Row 1: Profile Header + Security Status */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "2fr 1fr" }, gap: 2.5 }}>
        {/* Profile Header Card */}
        <Paper sx={{
          p: 3, display: "flex", gap: 3, ...cardHover,
          position: "relative", overflow: "hidden",
          "&::before": {
            content: '""', position: "absolute", top: 0, left: 0, right: 0, height: 4,
            background: "linear-gradient(90deg, #1976D2, #7B1FA2, #2E7D32)",
          },
        }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarUpload}
            style={{ display: "none" }}
          />
          <Tooltip title={avatarUploading ? "Uploading..." : "Change photo"}>
            <Box
              onClick={() => !avatarUploading && fileInputRef.current?.click()}
              sx={{ position: "relative", cursor: avatarUploading ? "default" : "pointer", borderRadius: "50%", flexShrink: 0 }}
            >
              <Badge
                overlap="circular"
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                badgeContent={
                  <Box sx={{ width: 18, height: 18, borderRadius: "50%", bgcolor: "success.main", border: 2, borderColor: "background.paper", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <CheckCircle sx={{ fontSize: 12, color: "#fff" }} />
                  </Box>
                }
              >
                <Box sx={{ position: "relative", width: 80, height: 80 }}>
                  <Avatar
                    src={user?.avatar_url || undefined}
                    sx={{
                      width: 80,
                      height: 80,
                      bgcolor: "primary.main",
                      color: "#fff",
                      fontSize: "2rem",
                      fontWeight: 700,
                      boxShadow: "0 4px 14px rgba(25,118,210,0.3)",
                      transition: "all 0.2s",
                      opacity: avatarUploading ? 0.6 : 1,
                    }}
                  >
                    {initials}
                  </Avatar>
                  <Box
                    sx={{
                      position: "absolute", inset: 0, borderRadius: "50%",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      bgcolor: "rgba(0,0,0,0.4)", opacity: 0, transition: "opacity 0.2s",
                      "&:hover": { opacity: 1 },
                    }}
                  >
                    {avatarUploading
                      ? <CircularProgress size={24} sx={{ color: "#fff" }} />
                      : <CameraAlt sx={{ fontSize: 22, color: "#fff" }} />
                    }
                  </Box>
                </Box>
              </Badge>
            </Box>
          </Tooltip>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.5 }}>
              <Typography variant="h5" sx={{ color: "text.primary", fontWeight: 700 }}>
                {user?.first_name} {user?.last_name}
              </Typography>
              <Chip
                label={user?.status || ""}
                size="small"
                sx={(theme) => ({
                  height: 22,
                  bgcolor: user?.status === "ACTIVE" ? `${theme.palette.success.light}15` : `${theme.palette.error.light}15`,
                  color: user?.status === "ACTIVE" ? "success.main" : "error.main",
                  fontWeight: 600,
                  fontSize: "0.65rem",
                  borderRadius: 1,
                })}
              />
              <IconButton size="small" sx={{ color: "text.disabled", ml: "auto", "&:hover": { color: "primary.main" } }}>
                <Edit sx={{ fontSize: 18 }} />
              </IconButton>
            </Box>
            <Typography variant="body2" sx={{ color: "text.secondary", mb: 0.5 }}>
              {user?.email}
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2, mt: 1 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <CalendarToday sx={{ fontSize: 13, color: "text.disabled" }} />
                <Typography variant="caption" sx={{ color: "text.disabled" }}>Joined {memberSince}</Typography>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <AccessTime sx={{ fontSize: 13, color: "text.disabled" }} />
                <Typography variant="caption" sx={{ color: "text.disabled" }}>Last login {lastLogin}</Typography>
              </Box>
            </Box>
          </Box>
        </Paper>

        {/* Security Status */}
        <Paper sx={{ p: 2.5, ...cardHover }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Shield sx={{ fontSize: 18, color: "success.main" }} />
              <Typography variant="h6" sx={{ color: "text.primary", fontSize: "0.9rem" }}>Security</Typography>
            </Box>
            <Chip label="Secure" size="small" sx={{ bgcolor: (t) => `${t.palette.success.light}15`, color: "success.main", fontWeight: 600, fontSize: "0.6rem", borderRadius: 1, height: 20 }} />
          </Box>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", p: 1, borderRadius: 1.5, bgcolor: "grey.50" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Key sx={{ fontSize: 16, color: "text.secondary" }} />
                <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 500 }}>Password</Typography>
              </Box>
              <Typography variant="caption" sx={{ color: "success.main", fontWeight: 600, fontSize: "0.6rem" }}>Last changed 3mo ago</Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", p: 1, borderRadius: 1.5, bgcolor: "grey.50" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Devices sx={{ fontSize: 16, color: "text.secondary" }} />
                <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 500 }}>Two-Factor</Typography>
              </Box>
              <Chip label="Enabled" size="small" sx={{ height: 20, bgcolor: (t) => `${t.palette.success.light}15`, color: "success.main", fontWeight: 600, fontSize: "0.6rem", borderRadius: 1 }} />
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", p: 1, borderRadius: 1.5, bgcolor: "grey.50" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <LoginIcon sx={{ fontSize: 16, color: "text.secondary" }} />
                <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 500 }}>Active Sessions</Typography>
              </Box>
              <Typography variant="caption" sx={{ color: "text.primary", fontWeight: 600, fontSize: "0.65rem" }}>2 devices</Typography>
            </Box>
          </Box>
        </Paper>
      </Box>

      {/* Bento Row 2: Account Details + Activity Stats */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "2fr 1fr" }, gap: 2.5 }}>
        {/* Account Details Form */}
        <Paper sx={{ p: 3, ...cardHover }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
            <Box>
              <Typography variant="h6" sx={{ color: "text.primary", mb: 0.25 }}>Account Details</Typography>
              <Typography variant="caption" sx={{ color: "text.disabled" }}>Update your personal information</Typography>
            </Box>
            <Box sx={{ display: "flex", gap: 1 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "primary.main" }} />
              <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "grey.300" }} />
              <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "grey.300" }} />
            </Box>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 1.5 }}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ mb: 3, borderRadius: 1.5 }}>{success}</Alert>}

          <Box component="form" onSubmit={handleUpdate}>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2.5, mb: 3 }}>
              <Box>
                <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "text.secondary", mb: 0.75, textTransform: "uppercase", letterSpacing: "0.4px" }}>
                  First Name
                </Typography>
                <TextField name="first_name" defaultValue={user?.first_name || ""} fullWidth placeholder="First name" size="small" />
              </Box>
              <Box>
                <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "text.secondary", mb: 0.75, textTransform: "uppercase", letterSpacing: "0.4px" }}>
                  Last Name
                </Typography>
                <TextField name="last_name" defaultValue={user?.last_name || ""} fullWidth placeholder="Last name" size="small" />
              </Box>
              <Box>
                <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "text.secondary", mb: 0.75, textTransform: "uppercase", letterSpacing: "0.4px" }}>
                  Email
                </Typography>
                <TextField value={user?.email || ""} fullWidth disabled size="small" />
              </Box>
              <Box>
                <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "text.secondary", mb: 0.75, textTransform: "uppercase", letterSpacing: "0.4px" }}>
                  Timezone
                </Typography>
                <TextField name="timezone" defaultValue={user?.timezone || "UTC"} fullWidth placeholder="UTC" size="small" />
              </Box>
              <Box>
                <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "text.secondary", mb: 0.75, textTransform: "uppercase", letterSpacing: "0.4px" }}>
                  Locale
                </Typography>
                <TextField name="locale" defaultValue={user?.locale || "en"} fullWidth placeholder="en" size="small" />
              </Box>
              <Box>
                <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "text.secondary", mb: 0.75, textTransform: "uppercase", letterSpacing: "0.4px" }}>
                  Role
                </Typography>
                <TextField value={user?.role || "Admin"} fullWidth disabled size="small" />
              </Box>
            </Box>

            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <Button type="submit" variant="contained" disabled={loading} size="medium" sx={{ px: 3, borderRadius: 1.5, fontWeight: 600 }}>
                {loading ? <CircularProgress size={18} sx={{ mr: 1 }} /> : null}
                {loading ? "Saving..." : "Save Changes"}
              </Button>
              <Button variant="outlined" size="medium" sx={{ px: 3, borderRadius: 1.5, borderColor: "divider", color: "text.secondary" }}>
                Cancel
              </Button>
            </Box>
          </Box>
        </Paper>

        {/* Activity Stats */}
        <Paper sx={{ p: 2.5, ...cardHover }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
            <NotificationsActive sx={{ fontSize: 18, color: "primary.main" }} />
            <Typography variant="h6" sx={{ color: "text.primary", fontSize: "0.9rem" }}>Account Activity</Typography>
          </Box>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <StatBadge icon={<LoginIcon sx={{ fontSize: 16 }} />} value="147" label="Total Logins" color="#1976D2" />
            <StatBadge icon={<AccessTime sx={{ fontSize: 16 }} />} value="12h 30m" label="Avg Session" color="#2E7D32" />
            <StatBadge icon={<Devices sx={{ fontSize: 16 }} />} value="3" label="Linked Devices" color="#7B1FA2" />
            <StatBadge icon={<Language sx={{ fontSize: 16 }} />} value="en-US" label="Locale" color="#ED6C02" />
          </Box>
          <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: "divider" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, cursor: "pointer", "&:hover": { "& .MuiSvgIcon-root": { transform: "translateX(3px)" } } }}>
              <Typography variant="caption" sx={{ color: "primary.main", fontWeight: 600, fontSize: "0.75rem" }}>View full activity history</Typography>
              <ArrowForward sx={{ fontSize: 14, color: "primary.main", transition: "transform 0.2s" }} />
            </Box>
          </Box>
        </Paper>
      </Box>

      {/* Bento Row 3: Change Password + Preferences */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "2fr 1fr" }, gap: 2.5 }}>
        {/* Change Password */}
        <Paper sx={{ p: 3, ...cardHover }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
            <Box sx={{ width: 36, height: 36, borderRadius: 1.5, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: (t) => `${t.palette.warning.light}15`, color: "warning.main" }}>
              <Key sx={{ fontSize: 18 }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ color: "text.primary", mb: 0.15 }}>Change Password</Typography>
              <Typography variant="caption" sx={{ color: "text.disabled" }}>Update your account password regularly for security</Typography>
            </Box>
          </Box>

          {pwError && <Alert severity="error" sx={{ mb: 3, borderRadius: 1.5 }}>{pwError}</Alert>}
          {pwSuccess && <Alert severity="success" sx={{ mb: 3, borderRadius: 1.5 }}>{pwSuccess}</Alert>}

          <Box component="form" onSubmit={handleChangePassword}>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2.5, mb: 3 }}>
              <Box>
                <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "text.secondary", mb: 0.75, textTransform: "uppercase", letterSpacing: "0.4px" }}>
                  Current Password
                </Typography>
                <TextField
                  name="current_password"
                  type={showPw ? "text" : "password"}
                  fullWidth
                  placeholder="Enter current password"
                  size="small"
                  slotProps={{
                    input: {
                      endAdornment: (
                        <IconButton size="small" onClick={() => setShowPw(!showPw)} sx={{ color: "text.disabled" }}>
                          {showPw ? <VisibilityOff sx={{ fontSize: 18 }} /> : <Visibility sx={{ fontSize: 18 }} />}
                        </IconButton>
                      ),
                    },
                  }}
                />
              </Box>
              <Box>
                <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "text.secondary", mb: 0.75, textTransform: "uppercase", letterSpacing: "0.4px" }}>
                  New Password
                </Typography>
                <TextField
                  name="new_password"
                  type={showNewPw ? "text" : "password"}
                  fullWidth
                  placeholder="Enter new password"
                  size="small"
                  slotProps={{
                    input: {
                      endAdornment: (
                        <IconButton size="small" onClick={() => setShowNewPw(!showNewPw)} sx={{ color: "text.disabled" }}>
                          {showNewPw ? <VisibilityOff sx={{ fontSize: 18 }} /> : <Visibility sx={{ fontSize: 18 }} />}
                        </IconButton>
                      ),
                    },
                  }}
                />
              </Box>
            </Box>

            <Button type="submit" variant="contained" disabled={pwLoading} size="medium" sx={{ px: 3, borderRadius: 1.5, fontWeight: 600, bgcolor: "warning.main", "&:hover": { bgcolor: "warning.dark" } }}>
              {pwLoading ? <CircularProgress size={18} sx={{ mr: 1 }} /> : null}
              {pwLoading ? "Updating..." : "Update Password"}
            </Button>
          </Box>
        </Paper>

        {/* Preferences */}
        <Paper sx={{ p: 2.5, ...cardHover }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
            <DarkMode sx={{ fontSize: 18, color: "text.secondary" }} />
            <Typography variant="h6" sx={{ color: "text.primary", fontSize: "0.9rem" }}>Preferences</Typography>
          </Box>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", p: 1.5, borderRadius: 1.5, bgcolor: "grey.50", border: 1, borderColor: "divider" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <NotificationsActive sx={{ fontSize: 16, color: "primary.main" }} />
                <Box>
                  <Typography variant="caption" sx={{ color: "text.primary", fontWeight: 600, display: "block", fontSize: "0.75rem" }}>Email Notifications</Typography>
                  <Typography variant="caption" sx={{ color: "text.disabled", fontSize: "0.65rem" }}>Weekly digest, alerts</Typography>
                </Box>
              </Box>
              <Chip label="On" size="small" sx={{ height: 22, bgcolor: (t) => `${t.palette.success.light}15`, color: "success.main", fontWeight: 600, fontSize: "0.6rem", borderRadius: 1 }} />
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", p: 1.5, borderRadius: 1.5, bgcolor: "grey.50", border: 1, borderColor: "divider" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <DarkMode sx={{ fontSize: 16, color: "warning.main" }} />
                <Box>
                  <Typography variant="caption" sx={{ color: "text.primary", fontWeight: 600, display: "block", fontSize: "0.75rem" }}>Dark Mode</Typography>
                  <Typography variant="caption" sx={{ color: "text.disabled", fontSize: "0.65rem" }}>System preference</Typography>
                </Box>
              </Box>
              <Chip label="Auto" size="small" variant="outlined" sx={{ height: 22, borderColor: "divider", color: "text.secondary", fontWeight: 600, fontSize: "0.6rem", borderRadius: 1 }} />
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", p: 1.5, borderRadius: 1.5, bgcolor: "grey.50", border: 1, borderColor: "divider" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <Language sx={{ fontSize: 16, color: "secondary.main" }} />
                <Box>
                  <Typography variant="caption" sx={{ color: "text.primary", fontWeight: 600, display: "block", fontSize: "0.75rem" }}>Language</Typography>
                  <Typography variant="caption" sx={{ color: "text.disabled", fontSize: "0.65rem" }}>English (US)</Typography>
                </Box>
              </Box>
              <Tooltip title="Coming soon">
                <Chip label="Edit" size="small" variant="outlined" sx={{ height: 22, borderColor: "divider", color: "text.disabled", fontWeight: 600, fontSize: "0.6rem", borderRadius: 1 }} />
              </Tooltip>
            </Box>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}
