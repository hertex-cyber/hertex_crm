import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";

import AddIcon from "@mui/icons-material/Add";
import SettingsIcon from "@mui/icons-material/Settings";
import CallIcon from "@mui/icons-material/Call";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import EmailIcon from "@mui/icons-material/Email";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import FilterListOutlinedIcon from "@mui/icons-material/FilterListOutlined";
import GridViewOutlinedIcon from "@mui/icons-material/GridViewOutlined";
import MessageIcon from "@mui/icons-material/Message";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import PersonAddAlt1Icon from "@mui/icons-material/PersonAddAlt1";
import SearchIcon from "@mui/icons-material/Search";
import TableRowsOutlinedIcon from "@mui/icons-material/TableRowsOutlined";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Skeleton from "@mui/material/Skeleton";
import Snackbar from "@mui/material/Snackbar";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import {
  assignLead,
  changeLeadStage,
  createLead,
  createStage,
  deleteLead,
  deleteStage,
  listLeads,
  listPipelines,
  listStages,
  updateLead,
  type Lead,
  type LeadCreate,
  type Stage,
  type Pipeline,
} from "./api";

function getStatusColor(status: string, stages: Stage[]): string {
  const s = stages.find((st) => st.name === status);
  return s?.color || "#6b7280";
}

function getStatusLabel(status: string, stages: Stage[]): string {
  const s = stages.find((st) => st.name === status);
  return s?.name || status;
}

function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${hash % 360}, 55%, 45%)`;
}

function getInitials(first: string, last: string): string {
  return `${(first[0] || "").toUpperCase()}${(last[0] || "").toUpperCase()}`;
}

// ─── Context menu ──────────────────────────────────────────────────
function LeadMenu({
  lead,
  anchorEl,
  onClose,
  onEdit,
  onDelete,
  onAssign,
}: {
  lead: Lead | null;
  anchorEl: HTMLElement | null;
  onClose: () => void;
  onEdit: (lead: Lead) => void;
  onDelete: (lead: Lead) => void;
  onAssign: (lead: Lead) => void;
}) {
  if (!lead) return null;
  return (
    <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={onClose} onClick={onClose} transformOrigin={{ horizontal: "right", vertical: "top" }} anchorOrigin={{ horizontal: "right", vertical: "bottom" }}>
      <MenuItem onClick={() => onEdit(lead)}><EditOutlinedIcon fontSize="small" sx={{ mr: 1 }} /> Edit</MenuItem>
      <MenuItem onClick={() => onAssign(lead)}><PersonAddAlt1Icon fontSize="small" sx={{ mr: 1 }} /> Assign</MenuItem>
      <MenuItem onClick={() => onDelete(lead)} sx={{ color: "error.main" }}><DeleteForeverIcon fontSize="small" sx={{ mr: 1 }} /> Delete</MenuItem>
    </Menu>
  );
}

// ─── Lead Dialog (Create / Edit) ───────────────────────────────────
function LeadFormDialog({ lead, open, onClose, onSaved, pipelines, selectedPipelineId }: { lead?: Lead | null; open: boolean; onClose: () => void; onSaved: () => void; pipelines: Pipeline[]; selectedPipelineId: string }) {
  const [form, setForm] = useState<LeadCreate>({ first_name: "", last_name: "", email: "", phone: "", company: "", title: "", source: "OTHER", notes: "" });
  const [formPipeline, setFormPipeline] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (lead) {
      setForm({ first_name: lead.first_name, last_name: lead.last_name, email: lead.email, phone: lead.phone, company: lead.company, title: lead.title, source: lead.source, notes: lead.notes });
      setFormPipeline(lead.pipeline?.id || "");
    } else {
      setForm({ first_name: "", last_name: "", email: "", phone: "", company: "", title: "", source: "OTHER", notes: "" });
      setFormPipeline(selectedPipelineId);
    }
    setError("");
  }, [lead, open, selectedPipelineId]);

  const update = (f: keyof LeadCreate, v: string) => setForm((p) => ({ ...p, [f]: v }));

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      if (lead) {
        const p: Record<string, unknown> = {};
        for (const k of Object.keys(form) as (keyof LeadCreate)[]) if (form[k] !== lead[k as keyof Lead]) p[k] = form[k];
        if (Object.keys(p).length) await updateLead(lead.id, p);
      } else await createLead({ ...form, pipeline_id: formPipeline || undefined });
      onSaved();
      onClose();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : "Failed to save"); } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" slotProps={{ paper: { sx: { borderRadius: 3, p: 1 } } }}>
      <DialogTitle sx={{ fontWeight: 700 }}>{lead ? "Edit lead" : "Create lead"}</DialogTitle>
      <DialogContent sx={{ pt: "16px !important" }}>
        {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError("")}>{error}</Alert>}
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
          <TextField label="First name" value={form.first_name} onChange={(e) => update("first_name", e.target.value)} required size="medium" slotProps={{ input: { sx: { borderRadius: 2 } } }} />
          <TextField label="Last name" value={form.last_name} onChange={(e) => update("last_name", e.target.value)} required size="medium" slotProps={{ input: { sx: { borderRadius: 2 } } }} />
          <TextField label="Email" value={form.email} onChange={(e) => update("email", e.target.value)} required type="email" size="medium" sx={{ gridColumn: { sm: "span 2" } }} slotProps={{ input: { sx: { borderRadius: 2 } } }} />
          <TextField label="Phone" value={form.phone} onChange={(e) => update("phone", e.target.value)} size="medium" slotProps={{ input: { sx: { borderRadius: 2 } } }} />
          <TextField label="Company" value={form.company} onChange={(e) => update("company", e.target.value)} size="medium" slotProps={{ input: { sx: { borderRadius: 2 } } }} />
          <TextField label="Title" value={form.title} onChange={(e) => update("title", e.target.value)} size="medium" slotProps={{ input: { sx: { borderRadius: 2 } } }} />
          <TextField label="Source" select value={form.source} onChange={(e) => update("source", e.target.value)} size="medium" slotProps={{ input: { sx: { borderRadius: 2 } } }}>
            {["WEB_FORM", "REFERRAL", "COLD_CALL", "EMAIL", "SOCIAL_MEDIA", "PARTNER", "OTHER"].map((o) => <MenuItem key={o} value={o}>{o.replace(/_/g, " ")}</MenuItem>)}
          </TextField>
          {!lead && (
            <TextField label="Pipeline" select value={formPipeline} onChange={(e) => setFormPipeline(e.target.value)} size="medium" slotProps={{ input: { sx: { borderRadius: 2 } } }}>
              {pipelines.map((p) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
            </TextField>
          )}
          <TextField label="Notes" value={form.notes} onChange={(e) => update("notes", e.target.value)} multiline rows={3} size="medium" sx={{ gridColumn: "span 2" }} slotProps={{ input: { sx: { borderRadius: 2 } } }} />
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2, pt: 0 }}>
        <Button onClick={onClose} sx={{ borderRadius: 2, textTransform: "none" }}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={!form.first_name.trim() || !form.last_name.trim() || !form.email.trim() || saving} sx={{ borderRadius: 2, textTransform: "none", px: 3 }}>
          {saving ? <CircularProgress size={18} /> : lead ? "Update" : "Create lead"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Confirm Delete ────────────────────────────────────────────────
function ConfirmDelete({ lead, open, onClose, onConfirm }: { lead: Lead | null; open: boolean; onClose: () => void; onConfirm: () => void }) {
  if (!lead) return null;
  return (
    <Dialog open={open} onClose={onClose} slotProps={{ paper: { sx: { borderRadius: 3 } } }}>
      <DialogTitle sx={{ fontWeight: 700 }}>Delete lead?</DialogTitle>
      <DialogContent><DialogContentText>Remove <strong>{lead.first_name} {lead.last_name}</strong>? This cannot be undone.</DialogContentText></DialogContent>
      <DialogActions sx={{ p: 2, pt: 0 }}>
        <Button onClick={onClose} sx={{ borderRadius: 2, textTransform: "none" }}>Cancel</Button>
        <Button onClick={onConfirm} color="error" variant="contained" sx={{ borderRadius: 2, textTransform: "none" }}>Delete</Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── CSV Import Dialog ─────────────────────────────────────────────
function ImportDialog({ open, onClose, onSaved, pipelines, selectedPipelineId }: { open: boolean; onClose: () => void; onSaved: () => void; pipelines: Pipeline[]; selectedPipelineId: string }) {
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [importPipeline, setImportPipeline] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ created: number; errors: number } | null>(null);

  useEffect(() => { setImportPipeline(selectedPipelineId); }, [selectedPipelineId]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split("\n").filter(Boolean);
      if (lines.length < 2) return;
      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
      const parsed = lines.slice(1).map((line) => {
        const vals = line.split(",").map((v) => v.trim());
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => { obj[h] = vals[i] || ""; });
        return obj;
      });
      setRows(parsed);
      setResult(null);
    };
    reader.readAsText(file);
  };

  const doImport = async () => {
    setImporting(true);
    let created = 0, errors = 0;
    for (const row of rows) {
      try {
        await createLead({
          first_name: row.first_name || row.firstname || "",
          last_name: row.last_name || row.lastname || "",
          email: row.email || "",
          phone: row.phone || "",
          company: row.company || "",
          title: row.title || "",
          source: row.source?.toUpperCase() || "OTHER",
          notes: row.notes || "",
          pipeline_id: importPipeline || undefined,
        });
        created++;
      } catch { errors++; }
    }
    setResult({ created, errors });
    setImporting(false);
    if (created > 0) onSaved();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" slotProps={{ paper: { sx: { borderRadius: 3, p: 1 } } }}>
      <DialogTitle sx={{ fontWeight: 700 }}>Import leads from CSV</DialogTitle>
      <DialogContent>
        {rows.length === 0 ? (
          <Box>
            <Box sx={{ mb: 2 }}>
              <TextField label="Pipeline" select value={importPipeline} onChange={(e) => setImportPipeline(e.target.value)} size="medium" fullWidth slotProps={{ input: { sx: { borderRadius: 2 } } }}>
                {pipelines.map((p) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
              </TextField>
            </Box>
            <Box sx={{ border: "2px dashed", borderColor: "divider", borderRadius: 3, p: 6, textAlign: "center", cursor: "pointer" }} component="label">
              <CloudUploadOutlinedIcon sx={{ fontSize: 48, color: "text.disabled", mb: 1 }} />
              <Typography variant="body2" color="text.secondary">Click to upload CSV file</Typography>
              <Typography variant="caption" color="text.disabled">Expected columns: first_name, last_name, email, phone, company, title, source, notes</Typography>
              <input type="file" hidden accept=".csv" onChange={handleFile} />
            </Box>
          </Box>
        ) : (
          <Box>
            <Typography variant="body2" sx={{ mb: 1 }}>{rows.length} rows found</Typography>
            <Box sx={{ maxHeight: 300, overflow: "auto", border: 1, borderColor: "divider", borderRadius: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {Object.keys(rows[0]).map((h) => <TableCell key={h} sx={{ fontWeight: 700, textTransform: "uppercase", fontSize: "0.7rem" }}>{h}</TableCell>)}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.slice(0, 50).map((row, i) => (
                    <TableRow key={i}>
                      {Object.values(row).map((v, j) => <TableCell key={j} sx={{ fontSize: "0.8rem" }}>{v}</TableCell>)}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
            {result && (
              <Alert severity={result.errors === 0 ? "success" : "warning"} sx={{ mt: 2, borderRadius: 2 }}>
                {result.created} created, {result.errors} failed
              </Alert>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2, pt: 0 }}>
        <Button onClick={() => { setRows([]); setResult(null); onClose(); }} sx={{ borderRadius: 2, textTransform: "none" }}>Cancel</Button>
        {rows.length > 0 && !result && (
          <Button variant="contained" onClick={doImport} disabled={importing} sx={{ borderRadius: 2, textTransform: "none", px: 3 }}>
            {importing ? <CircularProgress size={18} /> : `Import ${rows.length} leads`}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

// ─── Assign Dialog ─────────────────────────────────────────────────
function AssignDialog({ lead, open, onClose, onSaved }: { lead: Lead | null; open: boolean; onClose: () => void; onSaved: () => void }) {
  const [userId, setUserId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { setUserId(lead?.assigned_to_id || ""); setError(""); }, [lead, open]);
  const save = async () => {
    if (!lead) return;
    setSaving(true);
    setError("");
    try { await assignLead(lead.id, userId || null); onSaved(); onClose(); } catch (err: unknown) { setError(err instanceof Error ? err.message : "Failed"); } finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" slotProps={{ paper: { sx: { borderRadius: 3 } } }}>
      <DialogTitle sx={{ fontWeight: 700 }}>Assign lead</DialogTitle>
      <DialogContent sx={{ pt: "16px !important" }}>
        {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}
        <TextField label="User ID" value={userId} onChange={(e) => setUserId(e.target.value)} fullWidth placeholder="User UUID or empty" size="medium" slotProps={{ input: { sx: { borderRadius: 2 } } }} />
      </DialogContent>
      <DialogActions sx={{ p: 2, pt: 0 }}>
        <Button onClick={onClose} sx={{ borderRadius: 2, textTransform: "none" }}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={saving} sx={{ borderRadius: 2, textTransform: "none" }}>{saving ? <CircularProgress size={18} /> : "Save"}</Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Stage Manager Dialog ──────────────────────────────────────────
function StageManagerDialog({ open, onClose, pipelineId, stages, onChanged }: { open: boolean; onClose: () => void; pipelineId: string; stages: Stage[]; onChanged: () => void }) {
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [stageList, setStageList] = useState<Stage[]>(stages);

  useEffect(() => { setStageList(stages); }, [stages]);

  const handleAdd = async () => {
    if (!newName.trim() || !pipelineId) return;
    setSaving(true);
    setError("");
    try {
      await createStage({ name: newName.trim(), pipeline_id: pipelineId });
      setNewName("");
      onChanged();
    } catch { setError("Failed to create stage"); } finally { setSaving(false); }
  };

  const handleDelete = async (stageId: string) => {
    setError("");
    try {
      await deleteStage(stageId);
      onChanged();
    } catch { setError("Failed to delete stage"); }
  };

  const stageColors = ["#3b82f6", "#f59e0b", "#10b981", "#8b5cf6", "#ef4444", "#6366f1", "#ec4899", "#14b8a6"];

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" slotProps={{ paper: { sx: { borderRadius: 3 } } }}>
      <DialogTitle sx={{ fontWeight: 700 }}>Manage Stages</DialogTitle>
      <DialogContent sx={{ pt: "16px !important" }}>
        {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError("")}>{error}</Alert>}
        <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
          <TextField size="small" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Stage name" fullWidth slotProps={{ input: { sx: { borderRadius: 2 } } }} />
          <Button variant="contained" onClick={handleAdd} disabled={!newName.trim() || saving} sx={{ borderRadius: 2, textTransform: "none", flexShrink: 0 }}>Add</Button>
        </Box>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
          {stageList.map((s, i) => (
            <Paper key={s.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2, display: "flex", alignItems: "center", gap: 1.5 }}>
              <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: s.color || stageColors[i % stageColors.length], flexShrink: 0 }} />
              <Typography variant="body2" sx={{ flex: 1, fontWeight: 600 }}>{s.name}</Typography>
              <IconButton size="small" color="error" onClick={() => handleDelete(s.id)}><DeleteForeverIcon sx={{ fontSize: "1rem" }} /></IconButton>
            </Paper>
          ))}
          {stageList.length === 0 && <Typography variant="body2" color="text.disabled" sx={{ py: 2, textAlign: "center" }}>No stages yet. Add one above.</Typography>}
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2, pt: 0 }}>
        <Button onClick={onClose} sx={{ borderRadius: 2, textTransform: "none" }}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Status badge ──────────────────────────────────────────────────
function StatusBadge({ status, stages, size = "small" }: { status: string; stages: Stage[]; size?: "small" | "medium" }) {
  const color = getStatusColor(status, stages);
  return (
    <Chip
      label={getStatusLabel(status, stages)}
      size={size}
      sx={{
        bgcolor: `${color}14`,
        color,
        fontWeight: 600,
        fontSize: size === "small" ? "0.7rem" : "0.75rem",
        height: size === "small" ? 22 : 28,
        borderRadius: 1.5,
        "& .MuiChip-label": { px: 1 },
      }}
    />
  );
}

// ─── Kanban Card ───────────────────────────────────────────────────
function LeadCard({ lead, index, stages, onEdit, onDelete, onAssign }: { lead: Lead; index: number; stages: Stage[]; onEdit: (l: Lead) => void; onDelete: (l: Lead) => void; onAssign: (l: Lead) => void }) {
  const stageColor = getStatusColor(lead.status, stages);
  const [menuEl, setMenuEl] = useState<HTMLElement | null>(null);
  return (
    <Draggable draggableId={lead.id} index={index}>
      {(provided, snapshot) => (
        <Paper
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          elevation={snapshot.isDragging ? 12 : 1}
          sx={{
            p: 0,
            borderRadius: 2.5,
            border: "1px solid",
            borderColor: snapshot.isDragging ? "primary.main" : "#e5e7eb",
            boxShadow: snapshot.isDragging ? "0 8px 24px rgba(0,0,0,0.12)" : "0 1px 3px rgba(0,0,0,0.04)",
            transition: "border-color 0.15s, box-shadow 0.15s",
            "&:hover": { borderColor: stageColor, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" },
            mb: 1.25,
            cursor: "grab",
            overflow: "hidden",
          }}
        >
          <Box sx={{ height: 3, bgcolor: stageColor }} />
          <Box sx={{ p: 1.5 }}>
            <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", mb: 0.75 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
                <Avatar sx={{ width: 28, height: 28, fontSize: "0.7rem", bgcolor: stringToColor(lead.email), fontWeight: 700, flexShrink: 0 }}>
                  {getInitials(lead.first_name, lead.last_name)}
                </Avatar>
                <Box sx={{ minWidth: 0 }}>
                  <Link to={`/leads/${lead.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                    <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.3, "&:hover": { color: "primary.main" } }} noWrap>
                      {lead.first_name} {lead.last_name}
                    </Typography>
                  </Link>
                  <Typography variant="caption" color="text.secondary" noWrap>{lead.email}</Typography>
                </Box>
              </Box>
              <IconButton size="small" sx={{ mt: -0.5, mr: -0.5, flexShrink: 0 }} onClick={(e) => setMenuEl(e.currentTarget)}>
                <MoreHorizIcon sx={{ fontSize: "1rem" }} />
              </IconButton>
              <LeadMenu lead={lead} anchorEl={menuEl} onClose={() => setMenuEl(null)} onEdit={onEdit} onDelete={onDelete} onAssign={onAssign} />
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
              <StatusBadge status={lead.status} stages={stages} />
              {lead.score > 0 && (
                <Box sx={{ flex: 1, maxWidth: 80 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <Box sx={{ flex: 1, height: 5, bgcolor: "grey.100", borderRadius: 2, overflow: "hidden" }}>
                      <Box sx={{ width: `${lead.score}%`, height: "100%", bgcolor: lead.score >= 80 ? "#10b981" : lead.score >= 50 ? "#f59e0b" : "#ef4444", borderRadius: 2, transition: "width 0.3s" }} />
                    </Box>
                    <Typography variant="caption" sx={{ fontWeight: 700, fontSize: "0.65rem", color: lead.score >= 80 ? "#10b981" : lead.score >= 50 ? "#f59e0b" : "#ef4444" }}>{lead.score}%</Typography>
                  </Box>
                </Box>
              )}
            </Box>
            {lead.company && (
              <Typography variant="caption" color="text.disabled" sx={{ display: "flex", alignItems: "center", gap: 0.5 }} noWrap>
                {lead.company}
              </Typography>
            )}
          </Box>
          <Box sx={{ borderTop: "1px solid", borderColor: "#f3f4f6", px: 1.5, py: 0.5, display: "flex", gap: 0.25, justifyContent: "flex-end", bgcolor: "#fafbfc" }}>
            <IconButton size="small" title="Email" component="a" href={`mailto:${lead.email}`} onClick={(e) => e.stopPropagation()} sx={{ color: "text.disabled", "&:hover": { color: "primary.main" } }}>
              <EmailIcon sx={{ fontSize: "0.85rem" }} />
            </IconButton>
            <IconButton size="small" title="WhatsApp" component="a" href={`https://wa.me/${lead.phone?.replace(/\D/g, "")}`} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()} sx={{ color: "text.disabled", "&:hover": { color: "#25d366" } }}>
              <MessageIcon sx={{ fontSize: "0.85rem" }} />
            </IconButton>
            <IconButton size="small" title="Call" component="a" href={`tel:${lead.phone}`} onClick={(e) => e.stopPropagation()} sx={{ color: "text.disabled", "&:hover": { color: "success.main" } }}>
              <CallIcon sx={{ fontSize: "0.85rem" }} />
            </IconButton>
          </Box>
        </Paper>
      )}
    </Draggable>
  );
}

// ─── Kanban Column ─────────────────────────────────────────────────
function KanbanColumn({ status, stages, leads, onEdit, onDelete, onAssign }: { status: string; stages: Stage[]; leads: Lead[]; onEdit: (l: Lead) => void; onDelete: (l: Lead) => void; onAssign: (l: Lead) => void }) {
  const color = getStatusColor(status, stages);
  return (
    <Box sx={{ minWidth: 290, maxWidth: 330, flex: "1 1 0", display: "flex", flexDirection: "column" }}>
      <Paper elevation={0} sx={{ p: 1.25, borderRadius: 2.5, border: "1px solid", borderColor: `${color}40`, bgcolor: `${color}06`, mb: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
        <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: color, flexShrink: 0 }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: "uppercase", fontSize: "0.75rem", letterSpacing: "0.04em", color }}>
          {getStatusLabel(status, stages)}
        </Typography>
        <Box sx={{ ml: "auto", bgcolor: color, color: "#fff", borderRadius: 1.5, px: 1, py: 0.2, fontSize: "0.7rem", fontWeight: 800, lineHeight: 1.4 }}>
          {leads.length}
        </Box>
      </Paper>
      <Droppable droppableId={status}>
        {(provided, snapshot) => (
          <Box
            ref={provided.innerRef}
            {...provided.droppableProps}
            sx={{
              flex: 1,
              minHeight: 200,
              p: 0.75,
              borderRadius: 2.5,
              bgcolor: snapshot.isDraggingOver ? `${color}08` : "#f8f9fc",
              border: "1px solid",
              borderColor: snapshot.isDraggingOver ? color : "#e5e7eb",
              transition: "background-color 0.2s, border-color 0.2s",
              overflowY: "auto",
            }}
          >
            {leads.map((lead, i) => (
              <LeadCard key={lead.id} lead={lead} index={i} stages={stages} onEdit={onEdit} onDelete={onDelete} onAssign={onAssign} />
            ))}
            {provided.placeholder}
            {leads.length === 0 && !snapshot.isDraggingOver && (
              <Box sx={{ p: 3, textAlign: "center" }}>
                <Typography variant="caption" color="text.disabled">Drop leads here</Typography>
              </Box>
            )}
          </Box>
        )}
      </Droppable>
    </Box>
  );
}

// ─── Skeleton ──────────────────────────────────────────────────────
function LeadSkeleton() {
  return (
    <Box sx={{ display: "flex", gap: 2, overflow: "hidden" }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Box key={i} sx={{ minWidth: 280, flex: 1 }}>
          <Skeleton variant="rounded" height={22} sx={{ mb: 1.5, width: 100 }} />
          {[1, 2].map((j) => <Skeleton key={j} variant="rounded" height={100} sx={{ mb: 1, borderRadius: 2.5 }} />)}
        </Box>
      ))}
    </Box>
  );
}

// ─── Main LeadsPage ────────────────────────────────────────────────
export function LeadsPage() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);
  const [editing, setEditing] = useState<Lead | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<Lead | null>(null);
  const [assigning, setAssigning] = useState<Lead | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [stageDialogOpen, setStageDialogOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; severity: "success" | "error" } | null>(null);

  const loadPipelines = useCallback(async () => {
    try {
      const data = await listPipelines();
      setPipelines(data);
      if (data.length > 0 && !selectedPipelineId) {
        setSelectedPipelineId(data[0].id);
      }
    } catch { /* ignore */ }
  }, [selectedPipelineId]);

  const loadStages = useCallback(async () => {
    if (!selectedPipelineId) { setStages([]); return; }
    try {
      const data = await listStages(selectedPipelineId);
      setStages(data);
    } catch { setStages([]); }
  }, [selectedPipelineId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (selectedPipelineId) params.pipeline_id = selectedPipelineId;
      const data = await listLeads(params);
      setLeads(data);
    } catch { setError("Failed to load leads"); } finally { setLoading(false); }
  }, [search, statusFilter, selectedPipelineId]);

  useEffect(() => { loadPipelines(); }, []);
  useEffect(() => { loadStages(); }, [loadStages]);
  useEffect(() => { load(); }, [load]);

  const stageNames = useMemo(() => stages.map((s) => s.name), [stages]);
  const stageMap = useMemo(() => {
    const m: Record<string, Stage> = {};
    for (const s of stages) m[s.name] = s;
    return m;
  }, [stages]);

  const grouped = useMemo(() => {
    const groups: Record<string, Lead[]> = {};
    for (const s of stageNames) groups[s] = [];
    for (const lead of leads) {
      const key = lead.status;
      if (groups[key]) groups[key].push(lead);
    }
    return groups;
  }, [leads, stageNames]);

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination || result.source.droppableId === result.destination.droppableId) return;
    const newStatus = result.destination.droppableId;
    const leadId = result.draggableId;
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return;

    const targetStage = stageMap[newStatus];
    if (!targetStage) return;

    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, status: newStatus } : l)));
    try {
      await changeLeadStage(leadId, targetStage.id);
    } catch {
      setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, status: lead.status } : l)));
      setToast({ message: "Stage change failed", severity: "error" });
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await deleteLead(deleting.id);
      setLeads((prev) => prev.filter((l) => l.id !== deleting.id));
      setToast({ message: "Lead deleted", severity: "success" });
      setDeleting(null);
    } catch { setToast({ message: "Delete failed", severity: "error" }); }
  };

  const filteredByStatus = statusFilter ? leads.filter((l) => l.status === statusFilter) : leads;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, height: "100%" }}>
      {/* ─── Top bar ─────────────────────────────────────────────── */}
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "center", justifyContent: "space-between" }}>
        <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: "-0.02em" }}>Leads</Typography>
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <TextField
            placeholder="Search leads..."
            size="small"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            slotProps={{
              input: {
                startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: "1.1rem", color: "text.disabled" }} /></InputAdornment>,
                sx: { borderRadius: 3, bgcolor: "grey.50", "&:hover": { bgcolor: "grey.100" }, fontSize: "0.85rem", width: { xs: 140, sm: 220 } },
              },
            }}
          />
          <Select
            size="small"
            value={selectedPipelineId}
            onChange={(e) => setSelectedPipelineId(e.target.value)}
            sx={{ minWidth: 140, borderRadius: 2, fontSize: "0.8rem", bgcolor: "grey.50" }}
          >
            {pipelines.map((p) => (
              <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
            ))}
          </Select>
          <Tooltip title="Manage pipelines">
            <IconButton size="small" onClick={() => navigate("/pipelines")} sx={{ bgcolor: "grey.100", color: "text.secondary", borderRadius: 2 }}>
              <SettingsIcon sx={{ fontSize: "1.1rem" }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Toggle filters">
            <IconButton size="small" onClick={() => setShowFilters(!showFilters)} sx={{ bgcolor: showFilters ? "primary.main" : "grey.100", color: showFilters ? "#fff" : "text.secondary", borderRadius: 2 }}>
              <FilterListOutlinedIcon sx={{ fontSize: "1.1rem" }} />
            </IconButton>
          </Tooltip>
          <ToggleButtonGroup value={view} exclusive onChange={(_, v) => v && setView(v)} size="small" sx={{ "& .MuiToggleButton-root": { border: 0, borderRadius: 2, px: 1, py: 0.5 } }}>
            <ToggleButton value="kanban"><GridViewOutlinedIcon sx={{ fontSize: "1.1rem" }} /></ToggleButton>
            <ToggleButton value="list"><TableRowsOutlinedIcon sx={{ fontSize: "1.1rem" }} /></ToggleButton>
          </ToggleButtonGroup>
          <Button variant="outlined" startIcon={<FileDownloadOutlinedIcon />} onClick={() => setImportOpen(true)} sx={{ borderRadius: 3, textTransform: "none", fontSize: "0.8rem", borderColor: "divider", color: "text.secondary", "&:hover": { borderColor: "text.primary" } }}>
            Import
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing(null)} sx={{ borderRadius: 3, textTransform: "none", fontSize: "0.8rem", fontWeight: 600 }}>
            Create lead
          </Button>
        </Box>
      </Box>

      {/* ─── Active filters ──────────────────────────────────────── */}
      {showFilters && (
        <Paper elevation={0} sx={{ p: 1.5, borderRadius: 3, border: 1, borderColor: "divider", display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mr: 0.5 }}>Stage:</Typography>
          <Button size="small" variant="text" onClick={() => setStageDialogOpen(true)} sx={{ borderRadius: 2, textTransform: "none", fontSize: "0.7rem", minWidth: 0, px: 1 }}>+ Manage</Button>
          {["", ...stageNames].map((s) => (
            <Chip
              key={s || "all"}
              label={s || "All"}
              size="small"
              variant={statusFilter === s ? "filled" : "outlined"}
              onClick={() => setStatusFilter(s)}
              sx={{ borderRadius: 2, fontWeight: 600, fontSize: "0.7rem", "&.MuiChip-filled": s ? { bgcolor: `${getStatusColor(s, stages)}14`, color: getStatusColor(s, stages) } : { bgcolor: "primary.main", color: "#fff" } }}
            />
          ))}
          {statusFilter && <Chip label="Clear" size="small" onDelete={() => setStatusFilter("")} sx={{ borderRadius: 2, fontSize: "0.7rem" }} />}
        </Paper>
      )}

      {/* ─── KPI Cards ────────────────────────────────────────────── */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2,1fr)", sm: "repeat(3,1fr)", md: "repeat(6,1fr)" }, gap: 1.5 }}>
        {[
          { label: "Total Leads", value: leads.length, color: "#6366f1" },
          { label: stageNames[0] || "New", value: grouped[stageNames[0]]?.length || 0, color: "#3b82f6" },
          { label: stageNames[1] || "Contacted", value: grouped[stageNames[1]]?.length || 0, color: "#f59e0b" },
          { label: stageNames[2] || "Qualified", value: grouped[stageNames[2]]?.length || 0, color: "#10b981" },
          { label: stageNames[3] || "Converted", value: grouped[stageNames[3]]?.length || 0, color: "#8b5cf6" },
          { label: stageNames[4] || "Disqualified", value: grouped[stageNames[4]]?.length || 0, color: "#ef4444" },
        ].map((kpi) => (
          <Paper key={kpi.label} elevation={0} sx={{ p: 1.5, borderRadius: 2.5, border: "1px solid", borderColor: "divider", display: "flex", flexDirection: "column", gap: 0.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>{kpi.label}</Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, color: kpi.color, lineHeight: 1 }}>{kpi.value}</Typography>
            <Box sx={{ height: 3, width: "100%", bgcolor: `${kpi.color}18`, borderRadius: 2, overflow: "hidden", mt: 0.25 }}>
              <Box sx={{ width: `${leads.length > 0 ? (kpi.value / leads.length) * 100 : 0}%`, height: "100%", bgcolor: kpi.color, borderRadius: 2, transition: "width 0.5s" }} />
            </Box>
          </Paper>
        ))}
      </Box>

      {/* ─── Content ─────────────────────────────────────────────── */}
      {error && <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>}

      {loading ? (
        view === "kanban" ? <LeadSkeleton /> : <Box sx={{ p: 4 }}><Skeleton variant="rounded" height={300} sx={{ borderRadius: 3 }} /></Box>
      ) : leads.length === 0 ? (
        <Paper elevation={0} sx={{ p: 8, textAlign: "center", border: 1, borderColor: "divider", borderRadius: 3 }}>
          <PersonAddAlt1Icon sx={{ fontSize: 56, color: "text.disabled", mb: 1.5 }} />
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>No leads yet</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Create your first lead or import from a CSV file.</Typography>
          <Box sx={{ display: "flex", gap: 1, justifyContent: "center" }}>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing(null)} sx={{ borderRadius: 3, textTransform: "none" }}>Create lead</Button>
            <Button variant="outlined" startIcon={<FileDownloadOutlinedIcon />} onClick={() => setImportOpen(true)} sx={{ borderRadius: 3, textTransform: "none" }}>Import CSV</Button>
          </Box>
        </Paper>
      ) : view === "kanban" && stages.length > 0 ? (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Box sx={{ display: "flex", gap: 2, overflow: "auto", flex: 1, pb: 2, mx: -0.5, px: 0.5 }}>
            {stageNames.map((s) => (
              <KanbanColumn key={s} status={s} stages={stages} leads={grouped[s]} onEdit={(l) => setEditing(l)} onDelete={(l) => setDeleting(l)} onAssign={(l) => setAssigning(l)} />
            ))}
          </Box>
        </DragDropContext>
      ) : (
        <Paper elevation={0} sx={{ border: 1, borderColor: "divider", borderRadius: 3, overflow: "hidden" }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  {["Name", "Email", "Company", "Status", "Score", "Source", "Created", ""].map((h) => (
                    <TableCell key={h} sx={{ fontWeight: 700, fontSize: "0.7rem", textTransform: "uppercase", color: "text.secondary", letterSpacing: "0.05em", py: 1.5 }}>
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredByStatus.map((lead) => (
                  <TableRow
                    key={lead.id}
                    hover
                    sx={{ "&:hover": { bgcolor: "grey.50" }, "&:last-child td": { border: 0 }, cursor: "pointer" }}
                    onClick={() => window.location.href = `/leads/${lead.id}`}
                  >
                    <TableCell sx={{ py: 1.25 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <Avatar sx={{ width: 30, height: 30, fontSize: "0.75rem", bgcolor: stringToColor(lead.email), fontWeight: 700 }}>
                          {getInitials(lead.first_name, lead.last_name)}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.3 }}>{lead.first_name} {lead.last_name}</Typography>
                          {lead.title && <Typography variant="caption" color="text.disabled">{lead.title}</Typography>}
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell><Typography variant="body2" color="text.secondary">{lead.email}</Typography></TableCell>
                    <TableCell><Typography variant="body2">{lead.company || "-"}</Typography></TableCell>
                    <TableCell><StatusBadge status={lead.status} stages={stages} /></TableCell>
                    <TableCell>
                      {lead.score > 0 ? (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                          <Box sx={{ width: 48, height: 4, bgcolor: "grey.200", borderRadius: 2, overflow: "hidden" }}>
                            <Box sx={{ width: `${lead.score}%`, height: "100%", bgcolor: lead.score >= 80 ? "#10b981" : lead.score >= 50 ? "#f59e0b" : "#ef4444", borderRadius: 2 }} />
                          </Box>
                          <Typography variant="caption" color="text.secondary">{lead.score}%</Typography>
                        </Box>
                      ) : <Typography variant="caption" color="text.disabled">-</Typography>}
                    </TableCell>
                    <TableCell><Typography variant="body2" color="text.secondary">{lead.source.replace(/_/g, " ")}</Typography></TableCell>
                    <TableCell><Typography variant="caption" color="text.disabled">{new Date(lead.created_at).toLocaleDateString()}</Typography></TableCell>
                    <TableCell sx={{ py: 1.25 }}>
                      <Box sx={{ display: "flex", gap: 0.25 }} onClick={(e) => e.stopPropagation()}>
                        <IconButton size="small" title="Email" component="a" href={`mailto:${lead.email}`}><EmailIcon sx={{ fontSize: "0.85rem" }} /></IconButton>
                        <IconButton size="small" title="WhatsApp" component="a" href={`https://wa.me/${lead.phone?.replace(/\D/g, "")}`} target="_blank" rel="noopener"><MessageIcon sx={{ fontSize: "0.85rem" }} /></IconButton>
                        <IconButton size="small" title="Call" component="a" href={`tel:${lead.phone}`}><CallIcon sx={{ fontSize: "0.85rem" }} /></IconButton>
                        <IconButton size="small" onClick={() => setEditing(lead)}><EditOutlinedIcon sx={{ fontSize: "0.9rem" }} /></IconButton>
                        <IconButton size="small" color="error" onClick={() => setDeleting(lead)}><DeleteForeverIcon sx={{ fontSize: "0.9rem" }} /></IconButton>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* ─── Dialogs ──────────────────────────────────────────────── */}
      <LeadFormDialog lead={editing === undefined ? null : editing} open={editing !== undefined} onClose={() => setEditing(undefined)} onSaved={load} pipelines={pipelines} selectedPipelineId={selectedPipelineId} />
      <ConfirmDelete lead={deleting} open={deleting !== null} onClose={() => setDeleting(null)} onConfirm={handleDelete} />
      <AssignDialog lead={assigning} open={assigning !== null} onClose={() => setAssigning(null)} onSaved={load} />
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} onSaved={load} pipelines={pipelines} selectedPipelineId={selectedPipelineId} />
      <StageManagerDialog open={stageDialogOpen} onClose={() => setStageDialogOpen(false)} pipelineId={selectedPipelineId} stages={stages} onChanged={() => { loadStages(); load(); }} />

      <Snackbar open={toast !== null} autoHideDuration={4000} onClose={() => setToast(null)} anchorOrigin={{ vertical: "bottom", horizontal: "right" }}>
        {toast ? <Alert severity={toast.severity} variant="filled" sx={{ borderRadius: 2 }} onClose={() => setToast(null)}>{toast.message}</Alert> : undefined}
      </Snackbar>
    </Box>
  );
}
