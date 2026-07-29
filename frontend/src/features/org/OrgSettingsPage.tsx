import { useState, useEffect, useCallback } from "react";
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
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import MenuItem from "@mui/material/MenuItem";
import BusinessIcon from "@mui/icons-material/Business";
import PeopleIcon from "@mui/icons-material/People";
import ContentCopy from "@mui/icons-material/ContentCopy";
import Add from "@mui/icons-material/Add";
import DeleteForever from "@mui/icons-material/DeleteForever";
import AdminPanelSettings from "@mui/icons-material/AdminPanelSettings";
import Person from "@mui/icons-material/Person";
import WorkspacePremium from "@mui/icons-material/WorkspacePremium";
import CheckCircle from "@mui/icons-material/CheckCircle";
import { useAuthStore } from "@store/authStore";
import { getCurrentOrg, updateOrg, listMembers, inviteMember, changeMemberRole, removeMember, getCurrentTenant, changePlan } from "./api";
import { listRoles } from "@features/rbac/api";
import type { Member, OrgResponse, TenantResponse } from "./api";
import type { Role } from "@features/rbac/api";

const cardHover = {
  transition: "transform 0.25s ease, box-shadow 0.25s ease",
  "&:hover": { transform: "translateY(-2px)", boxShadow: "0 8px 25px rgba(0,0,0,0.08)" },
};

const roleIcons: Record<string, React.ReactNode> = {
  OWNER: <WorkspacePremium sx={{ fontSize: 16 }} />,
  ADMIN: <AdminPanelSettings sx={{ fontSize: 16 }} />,
  MEMBER: <Person sx={{ fontSize: 16 }} />,
};

const roleColors: Record<string, string> = {
  OWNER: "#FFB300",
  ADMIN: "#1976D2",
  MEMBER: "#2E7D32",
};

function InviteDialog({ open, onClose, orgId, onInvited, roles }: { open: boolean; onClose: () => void; orgId: string; onInvited: () => void; roles: Role[] }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open && roles.length && !role) {
      setRole(roles[0].name);
    }
  }, [open, roles, role]);

  const handleSubmit = async () => {
    setError("");
    setLoading(true);
    try {
      await inviteMember(orgId, { email, role });
      setEmail("");
      onInvited();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Failed to invite");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3, p: 1 } }}>
      <DialogTitle sx={{ fontWeight: 700, fontSize: "1.1rem" }}>Invite Team Member</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 1.5 }}>{error}</Alert>}
        <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "text.secondary", mb: 0.75, mt: 1, textTransform: "uppercase", letterSpacing: "0.4px" }}>
          Email Address
        </Typography>
        <TextField fullWidth value={email} onChange={(e) => setEmail(e.target.value)} placeholder="colleague@company.com" size="small" sx={{ mb: 2 }} />
        <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "text.secondary", mb: 0.75, textTransform: "uppercase", letterSpacing: "0.4px" }}>
          Role
        </Typography>
        <TextField select fullWidth value={role} onChange={(e) => setRole(e.target.value)} size="small">
          {roles.map((r) => (
            <MenuItem key={r.id} value={r.name}>{r.name}{r.description ? ` — ${r.description}` : ""}</MenuItem>
          ))}
        </TextField>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} variant="outlined" sx={{ borderRadius: 1.5 }}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={loading || !email.trim()} sx={{ borderRadius: 1.5 }}>
          {loading ? <CircularProgress size={18} /> : "Send Invite"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function RoleChangeDialog({ open, onClose, member, orgId, onChange, roles }: {
  open: boolean; onClose: () => void; member: Member | null; orgId: string; onChange: () => void; roles: Role[];
}) {
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (member && roles.length) {
      const matching = roles.find((r) => r.name === member.role || r.name.toUpperCase() === member.role);
      setRole(matching?.name || roles[0].name);
    }
  }, [member, roles]);

  const handleSave = async () => {
    if (!member) return;
    setError("");
    setLoading(true);
    try {
      await changeMemberRole(orgId, member.id, role);
      onChange();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Failed to update role");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3, p: 1 } }}>
      <DialogTitle sx={{ fontWeight: 700, fontSize: "1rem" }}>
        Change Role — {member?.first_name} {member?.last_name}
      </DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 1.5 }}>{error}</Alert>}
        <TextField select fullWidth value={role} onChange={(e) => setRole(e.target.value)} size="small" sx={{ mt: 1 }}>
          {roles.map((r) => (
            <MenuItem key={r.id} value={r.name}>{r.name}</MenuItem>
          ))}
        </TextField>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} variant="outlined" sx={{ borderRadius: 1.5 }}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" disabled={loading} sx={{ borderRadius: 1.5 }}>
          {loading ? <CircularProgress size={18} /> : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function OrgSettingsPage() {
  const currentOrg = useAuthStore((s) => s.currentOrganization);
  const setCurrentOrganization = useAuthStore((s) => s.setCurrentOrganization);

  const [org, setOrg] = useState<OrgResponse | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [tenant, setTenant] = useState<TenantResponse | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const [inviteOpen, setInviteOpen] = useState(false);
  const [roleDialogMember, setRoleDialogMember] = useState<Member | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!currentOrg) return;
    setLoading(true);
    try {
      const [orgData, membersData, tenantData, rolesData] = await Promise.all([
        getCurrentOrg(),
        listMembers(currentOrg.id),
        getCurrentTenant().catch(() => null),
        listRoles(),
      ]);
      setOrg(orgData);
      setMembers(membersData);
      setTenant(tenantData);
      setRoles(rolesData);
      setName(orgData.name);
      setDescription(orgData.description || "");
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [currentOrg]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!org) return;
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const updated = await updateOrg(org.id, { name, description });
      setOrg(updated);
      setCurrentOrganization(updated);
      setSuccess("Workspace updated successfully");
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveMember = async (membershipId: string) => {
    if (!org) return;
    try {
      await removeMember(org.id, membershipId);
      setMembers((prev) => prev.filter((m) => m.id !== membershipId));
      setConfirmDelete(null);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Failed to remove member");
    }
  };

  const handleCopyInviteLink = () => {
    // In a real app, this would generate a shareable invite link
    navigator.clipboard.writeText(window.location.origin + "/join");
  };

  if (loading) {
    return <Box sx={{ display: "flex", justifyContent: "center", pt: 12 }}><CircularProgress /></Box>;
  }

  if (!org) {
    return (
      <Box sx={{ textAlign: "center", pt: 12 }}>
        <Typography variant="h6" sx={{ color: "text.secondary" }}>No workspace selected</Typography>
      </Box>
    );
  }

  const currentUser = useAuthStore.getState().user;
  const currentMember = members.find((m) => m.user_id === currentUser?.id);
  const isAdmin = currentMember?.role === "OWNER" || currentMember?.role === "ADMIN";

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Box>
        <Typography variant="h4" sx={{ color: "text.primary", mb: 0.25 }}>
          Workspace Settings
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Manage your organization, members, and subscription
        </Typography>
      </Box>

      {/* Bento Row 1: Org Info + Plan */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "2fr 1fr" }, gap: 2.5 }}>
        <Paper sx={{ p: 3, ...cardHover }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
            <Box sx={{ width: 40, height: 40, borderRadius: 1.5, bgcolor: "primary.main", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <BusinessIcon sx={{ fontSize: 22, color: "#fff" }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ color: "text.primary" }}>Workspace Details</Typography>
              <Typography variant="caption" sx={{ color: "text.disabled" }}>tzahu.app/{org.slug}</Typography>
            </Box>
          </Box>
          {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 1.5 }}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ mb: 2, borderRadius: 1.5 }}>{success}</Alert>}
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2, mb: 3 }}>
            <Box>
              <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "text.secondary", mb: 0.75, textTransform: "uppercase", letterSpacing: "0.4px" }}>
                Workspace Name
              </Typography>
              <TextField fullWidth value={name} onChange={(e) => setName(e.target.value)} size="small" />
            </Box>
            <Box>
              <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "text.secondary", mb: 0.75, textTransform: "uppercase", letterSpacing: "0.4px" }}>
                Slug
              </Typography>
              <TextField fullWidth value={org.slug} size="small" disabled />
            </Box>
          </Box>
          <Box sx={{ mb: 3 }}>
            <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "text.secondary", mb: 0.75, textTransform: "uppercase", letterSpacing: "0.4px" }}>
              Description
            </Typography>
            <TextField fullWidth value={description} onChange={(e) => setDescription(e.target.value)} size="small" multiline rows={2} placeholder="What does your team do?" />
          </Box>
          <Button variant="contained" onClick={handleSave} disabled={saving} sx={{ borderRadius: 1.5 }}>
            {saving ? <CircularProgress size={18} sx={{ mr: 1 }} /> : null}
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </Paper>

        <Paper sx={{ p: 2.5, ...cardHover }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2.5 }}>
            <WorkspacePremium sx={{ fontSize: 22, color: "warning.main" }} />
            <Typography variant="h6" sx={{ color: "text.primary", fontSize: "0.9rem" }}>Plan & Billing</Typography>
          </Box>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            <Box sx={{ p: 1.5, borderRadius: 1.5, bgcolor: "grey.50", border: 1, borderColor: "divider" }}>
              <Typography variant="caption" sx={{ color: "text.disabled", fontSize: "0.65rem", textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.5px" }}>Current Plan</Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}>
                <Chip label={tenant?.plan || "free"} size="small" sx={{ bgcolor: (t) => `${t.palette.primary.main}12`, color: "primary.main", fontWeight: 700, textTransform: "capitalize", borderRadius: 1 }} />
                <Chip label={tenant?.status || "ACTIVE"} size="small" sx={{ bgcolor: (t) => `${t.palette.success.light}15`, color: "success.main", fontWeight: 600, fontSize: "0.6rem", borderRadius: 1 }} />
              </Box>
            </Box>
            <Box sx={{ p: 1.5, borderRadius: 1.5, bgcolor: "grey.50", border: 1, borderColor: "divider" }}>
              <Typography variant="caption" sx={{ color: "text.disabled", fontSize: "0.65rem", textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.5px" }}>Members</Typography>
              <Typography variant="h6" sx={{ color: "text.primary", fontWeight: 700, mt: 0.25 }}>{members.length}</Typography>
            </Box>
            <Button variant="outlined" fullWidth size="small" sx={{ borderRadius: 1.5, borderColor: "divider", color: "text.secondary", mt: 1 }}>
              Upgrade Plan
            </Button>
          </Box>
        </Paper>
      </Box>

      {/* Bento Row 2: Members */}
      <Paper sx={{ p: 3, ...cardHover }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <PeopleIcon sx={{ fontSize: 22, color: "primary.main" }} />
            <Box>
              <Typography variant="h6" sx={{ color: "text.primary" }}>Team Members</Typography>
              <Typography variant="caption" sx={{ color: "text.disabled" }}>{members.length} member{members.length !== 1 ? "s" : ""}</Typography>
            </Box>
          </Box>
          <Box sx={{ display: "flex", gap: 1 }}>
            <Tooltip title="Copy invite link">
              <IconButton size="small" onClick={handleCopyInviteLink} sx={{ color: "text.secondary" }}>
                <ContentCopy sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
            {isAdmin && (
              <Button variant="contained" size="small" startIcon={<Add />} onClick={() => setInviteOpen(true)} sx={{ borderRadius: 1.5 }}>
                Invite
              </Button>
            )}
          </Box>
        </Box>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          {members.map((m) => (
            <Box key={m.id} sx={{ display: "flex", alignItems: "center", gap: 2, p: 1.5, borderRadius: 1.5, "&:hover": { bgcolor: "action.hover" } }}>
              <Avatar sx={{ width: 36, height: 36, bgcolor: `${roleColors[m.role] || "primary.main"}`, color: "#fff", fontSize: "0.8rem", fontWeight: 700 }}>
                {m.first_name?.charAt(0)}{m.last_name?.charAt(0)}
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{ color: "text.primary", fontWeight: 500, fontSize: "0.85rem" }}>
                  {m.first_name} {m.last_name}
                  {m.user_id === currentUser?.id && (
                    <Typography component="span" variant="caption" sx={{ color: "text.disabled", ml: 0.5 }}>(you)</Typography>
                  )}
                </Typography>
                <Typography variant="caption" sx={{ color: "text.disabled" }}>{m.email}</Typography>
              </Box>
              <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                {m.rbac_roles?.length ? m.rbac_roles.map((rn) => (
                  <Chip
                    key={rn}
                    label={rn}
                    size="small"
                    sx={{ height: 22, fontWeight: 600, fontSize: "0.65rem", borderRadius: 1, bgcolor: (t) => `${t.palette.primary.main}15`, color: "primary.main" }}
                  />
                )) : (
                  <Chip
                    icon={roleIcons[m.role] || <Person sx={{ fontSize: 14 }} />}
                    label={m.role}
                    size="small"
                    sx={{
                      height: 24, fontWeight: 600, fontSize: "0.65rem", borderRadius: 1,
                      bgcolor: `${roleColors[m.role] || "#757575"}15`,
                      color: roleColors[m.role] || "text.secondary",
                      "& .MuiChip-icon": { ml: 0.5 },
                    }}
                  />
                )}
              </Box>
              {m.status === "INVITED" && (
                <Chip label="Invited" size="small" sx={{ height: 22, bgcolor: (t) => `${t.palette.warning.light}15`, color: "warning.main", fontWeight: 600, fontSize: "0.6rem", borderRadius: 1 }} />
              )}
              {isAdmin && m.role !== "OWNER" && (
                <Tooltip title="Change role">
                  <IconButton size="small" onClick={() => setRoleDialogMember(m)} sx={{ color: "text.disabled" }}>
                    <AdminPanelSettings sx={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
              )}
              {isAdmin && m.role !== "OWNER" && (
                <Tooltip title="Remove">
                  <IconButton size="small" onClick={() => setConfirmDelete(m.id)} sx={{ color: "text.disabled", "&:hover": { color: "error.main" } }}>
                    <DeleteForever sx={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
              )}
              {m.role === "OWNER" && (
                <CheckCircle sx={{ fontSize: 18, color: "warning.main" }} />
              )}
            </Box>
          ))}
        </Box>
      </Paper>

      <InviteDialog open={inviteOpen} onClose={() => setInviteOpen(false)} orgId={org.id} onInvited={load} roles={roles} />
      <RoleChangeDialog open={!!roleDialogMember} onClose={() => setRoleDialogMember(null)} member={roleDialogMember} orgId={org.id} onChange={load} roles={roles} />

      {/* Confirm Remove Dialog */}
      <Dialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)} maxWidth="xs" PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Remove Member</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Are you sure you want to remove this member from the workspace?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmDelete(null)} variant="outlined" sx={{ borderRadius: 1.5 }}>Cancel</Button>
          <Button onClick={() => confirmDelete && handleRemoveMember(confirmDelete)} variant="contained" color="error" sx={{ borderRadius: 1.5 }}>Remove</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
