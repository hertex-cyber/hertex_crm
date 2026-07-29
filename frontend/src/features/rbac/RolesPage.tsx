import { useCallback, useEffect, useMemo, useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Snackbar from "@mui/material/Snackbar";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { createRole, deleteRole, listPermissions, listRoles, updateRole, type Permission, type Role } from "./api";

function RoleDialog({ role, permissions, open, onClose, onSaved }: { role: Role | null; permissions: Permission[]; open: boolean; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setName(role?.name || "");
    setDescription(role?.description || "");
    setSelected(role?.permissions || []);
    setError("");
  }, [role, open]);

  const toggle = (code: string) =>
    setSelected((current) => (current.includes(code) ? current.filter((item) => item !== code) : [...current, code]));

  const grouped = useMemo(
    () => permissions.reduce<Record<string, Permission[]>>(
      (groups, permission) => ({
        ...groups,
        [permission.module]: [...(groups[permission.module] || []), permission],
      }),
      {},
    ),
    [permissions],
  );

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const payload = { name, description, permissions: selected };
      if (role) await updateRole(role.id, role.is_system ? { description, permissions: selected } : payload);
      else await createRole(payload);
      onSaved();
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save role";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{role ? `Edit ${role.name}` : "Create role"}</DialogTitle>
      <DialogContent sx={{ pt: "16px !important" }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
            {error}
          </Alert>
        )}
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 2fr" }, gap: 2, mb: 3 }}>
          <TextField label="Role name" value={name} disabled={role?.is_system} onChange={(event) => setName(event.target.value)} required />
          <TextField label="Description" value={description} onChange={(event) => setDescription(event.target.value)} />
        </Box>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>Permissions</Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1 }}>
          {Object.entries(grouped).map(([module, items]) => (
            <Paper key={module} variant="outlined" sx={{ p: 1.25 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", textTransform: "uppercase" }}>
                {module}
              </Typography>
              {items.map((permission) => (
                <FormControlLabel
                  key={permission.code}
                  control={<Checkbox size="small" checked={selected.includes(permission.code)} onChange={() => toggle(permission.code)} />}
                  label={
                    <Box>
                      <Typography variant="body2">{permission.label}</Typography>
                      <Typography variant="caption" color="text.secondary">{permission.description}</Typography>
                    </Box>
                  }
                  sx={{ display: "flex", alignItems: "flex-start", my: 0.25 }}
                />
              ))}
            </Paper>
          ))}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={!name.trim() || saving}>
          {saving ? <CircularProgress size={18} /> : "Save role"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function ConfirmDeleteDialog({ role, open, onClose, onConfirm }: { role: Role | null; open: boolean; onClose: () => void; onConfirm: () => void }) {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Delete {role?.name}?</DialogTitle>
      <DialogContent>
        <DialogContentText>
          This action cannot be undone. The role will be removed from all assigned members.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={onConfirm} color="error" variant="contained">Delete</Button>
      </DialogActions>
    </Dialog>
  );
}

export function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Role | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<Role | null>(null);
  const [toast, setToast] = useState<{ message: string; severity: "success" | "error" } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [roleData, permissionData] = await Promise.all([listRoles(), listPermissions()]);
      setRoles(roleData);
      setPermissions(permissionData);
    } catch {
      setError("Failed to load roles and permissions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await deleteRole(deleting.id);
      setToast({ message: `Role "${deleting.name}" deleted successfully`, severity: "success" });
      setDeleting(null);
      load();
    } catch {
      setToast({ message: `Failed to delete "${deleting.name}"`, severity: "error" });
    }
  };

  if (loading) return <Box sx={{ display: "flex", justifyContent: "center", pt: 12 }}><CircularProgress /></Box>;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <Box>
          <Typography variant="h4">Roles & Permissions</Typography>
          <Typography variant="body2" color="text.secondary">Control what each workspace role can see and do.</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing(null)}>Create role</Button>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" }, gap: 2 }}>
        {roles.map((role) => (
          <Paper key={role.id} sx={{ p: 2.5, border: 1, borderColor: "divider" }}>
            <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
              <AdminPanelSettingsIcon color={role.is_system ? "primary" : "action"} />
              <Box sx={{ flex: 1 }}>
                <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                  <Typography variant="h6">{role.name}</Typography>
                  {role.is_system && <Chip label="System" size="small" />}
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ minHeight: 40, mt: 0.5 }}>
                  {role.description || "Custom workspace role"}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {role.permissions.length} permissions · {role.member_count} members
                </Typography>
              </Box>
              <IconButton size="small" onClick={() => setEditing(role)}><EditOutlinedIcon fontSize="small" /></IconButton>
              {!role.is_system && (
                <IconButton size="small" color="error" onClick={() => setDeleting(role)}>
                  <DeleteForeverIcon fontSize="small" />
                </IconButton>
              )}
            </Box>
          </Paper>
        ))}
      </Box>

      <RoleDialog
        role={editing === undefined ? null : editing}
        permissions={permissions}
        open={editing !== undefined}
        onClose={() => setEditing(undefined)}
        onSaved={load}
      />

      <ConfirmDeleteDialog
        role={deleting}
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
      />

      <Snackbar
        open={toast !== null}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        {toast ? (
          <Alert severity={toast.severity} variant="filled" onClose={() => setToast(null)}>
            {toast.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  );
}
