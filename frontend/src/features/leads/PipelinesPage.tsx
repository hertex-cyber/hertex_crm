import { useCallback, useEffect, useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardActions from "@mui/material/CardActions";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import ListItemSecondaryAction from "@mui/material/ListItemSecondaryAction";
import Paper from "@mui/material/Paper";
import Snackbar from "@mui/material/Snackbar";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import {
  createPipeline,
  deletePipeline,
  listPipelines,
  updatePipeline,
  listStages,
  createStage,
  updateStage,
  deleteStage,
  reorderStages,
  type Pipeline,
  type Stage,
} from "./api";

// Helper: generate a random hex color
function randomColor(): string {
  const hue = Math.floor(Math.random() * 360);
  return `hsl(${hue}, 65%, 50%)`;
}

function randomHexColor(): string {
  return `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0")}`;
}

// ─── Stage Editor ──────────────────────────────────────────────────
function StageEditor({
  pipelineId,
  stages,
  onChange,
}: {
  pipelineId: string;
  stages: Stage[];
  onChange: () => void;
}) {
  const [newName, setNewName] = useState("");

  const handleCreate = async () => {
    if (!newName.trim() || !pipelineId) return;
    await createStage({ name: newName.trim(), color: randomHexColor(), pipeline_id: pipelineId });
    setNewName("");
    onChange();
  };

  const handleToggleTerminal = async (stage: Stage) => {
    await updateStage(stage.id, { is_terminal: !stage.is_terminal });
    onChange();
  };

  const handleDelete = async (stage: Stage) => {
    await deleteStage(stage.id);
    onChange();
  };

  const handleMoveUp = async (index: number) => {
    if (index === 0) return;
    const ids = stages.map((s) => s.id);
    [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
    await reorderStages(ids);
    onChange();
  };

  const handleMoveDown = async (index: number) => {
    if (index === stages.length - 1) return;
    const ids = stages.map((s) => s.id);
    [ids[index], ids[index + 1]] = [ids[index + 1], ids[index]];
    await reorderStages(ids);
    onChange();
  };

  return (
    <Box>
      <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
        <TextField
          size="small"
          placeholder="New stage name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          sx={{ flex: 1 }}
          slotProps={{ input: { sx: { borderRadius: 2 } } }}
        />
        <Button variant="contained" size="small" onClick={handleCreate} disabled={!newName.trim()} sx={{ borderRadius: 2, textTransform: "none" }}>
          <AddIcon sx={{ fontSize: "1rem", mr: 0.5 }} /> Add
        </Button>
      </Box>
      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
        <List disablePadding>
          {stages.map((stage, i) => (
            <ListItem
              key={stage.id}
              divider={i < stages.length - 1}
              sx={{
                bgcolor: i % 2 === 0 ? "transparent" : "grey.50",
                minHeight: 48,
              }}
            >
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  bgcolor: stage.color,
                  mr: 1.5,
                  flexShrink: 0,
                }}
              />
              <ListItemText
                primary={stage.name}
                secondary={`Order: ${stage.order}${stage.is_terminal ? " \u2022 Terminal" : ""}`}
                primaryTypographyProps={{ fontWeight: 600, fontSize: "0.85rem" }}
                secondaryTypographyProps={{ fontSize: "0.7rem" }}
              />
              <ListItemSecondaryAction sx={{ display: "flex", gap: 0.25, alignItems: "center" }}>
                <IconButton size="small" disabled={i === 0} onClick={() => handleMoveUp(i)} sx={{ fontSize: "0.8rem", color: "text.disabled" }}>
                  ↑
                </IconButton>
                <IconButton size="small" disabled={i === stages.length - 1} onClick={() => handleMoveDown(i)} sx={{ fontSize: "0.8rem", color: "text.disabled" }}>
                  ↓
                </IconButton>
                <ToggleButton
                  value="terminal"
                  selected={stage.is_terminal}
                  size="small"
                  onChange={() => handleToggleTerminal(stage)}
                  sx={{ border: 0, borderRadius: 1, px: 0.5, fontSize: "0.7rem", textTransform: "none" }}
                >
                  Terminal
                </ToggleButton>
                <IconButton size="small" edge="end" color="error" onClick={() => handleDelete(stage)}>
                  <DeleteForeverIcon sx={{ fontSize: "1rem" }} />
                </IconButton>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      </Paper>
    </Box>
  );
}

// ─── Pipeline Card ──────────────────────────────────────────────────
function PipelineCard({
  pipeline,
  selected,
  onSelect,
  onEdit,
  onDelete,
}: {
  pipeline: Pipeline;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Card
      elevation={0}
      sx={{
        borderRadius: 3,
        border: 2,
        borderColor: selected ? "primary.main" : "divider",
        cursor: "pointer",
        transition: "border-color 0.15s, box-shadow 0.15s",
        "&:hover": { borderColor: selected ? "primary.main" : "primary.light", boxShadow: 1 },
      }}
      onClick={onSelect}
    >
      <CardContent sx={{ pb: 0 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{pipeline.name}</Typography>
        {pipeline.description && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{pipeline.description}</Typography>
        )}
      </CardContent>
      <CardActions sx={{ px: 2, pb: 1.5, pt: 0.5 }}>
        <Button size="small" startIcon={<EditOutlinedIcon />} onClick={(e) => { e.stopPropagation(); onEdit(); }} sx={{ borderRadius: 2, textTransform: "none", fontSize: "0.75rem" }}>
          Rename
        </Button>
        <Button size="small" color="error" startIcon={<DeleteForeverIcon />} onClick={(e) => { e.stopPropagation(); onDelete(); }} sx={{ borderRadius: 2, textTransform: "none", fontSize: "0.75rem" }}>
          Delete
        </Button>
      </CardActions>
    </Card>
  );
}

// ─── Main PipelinesPage ─────────────────────────────────────────────
export function PipelinesPage() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createDialog, setCreateDialog] = useState(false);
  const [renameDialog, setRenameDialog] = useState<{ pipeline: Pipeline } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Pipeline | null>(null);
  const [toast, setToast] = useState<{ message: string; severity: "success" | "error" } | null>(null);

  const loadPipelines = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listPipelines();
      setPipelines(data);
      if (data.length > 0 && !selectedPipelineId) {
        setSelectedPipelineId(data[0].id);
      }
    } catch { setError("Failed to load pipelines"); }
    finally { setLoading(false); }
  }, [selectedPipelineId]);

  const loadStages = useCallback(async () => {
    if (!selectedPipelineId) { setStages([]); return; }
    try {
      const data = await listStages(selectedPipelineId);
      setStages(data);
    } catch { setStages([]); }
  }, [selectedPipelineId]);

  useEffect(() => { loadPipelines(); }, []);
  useEffect(() => { loadStages(); }, [loadStages]);

  const selectedPipeline = pipelines.find((p) => p.id === selectedPipelineId) || null;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, height: "100%" }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <AutoAwesomeIcon sx={{ color: "primary.main", fontSize: "1.5rem" }} />
          <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: "-0.02em" }}>Pipelines</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateDialog(true)} sx={{ borderRadius: 3, textTransform: "none", fontWeight: 600 }}>
          Create pipeline
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", p: 6 }}><CircularProgress /></Box>
      ) : pipelines.length === 0 ? (
        <Paper elevation={0} sx={{ p: 8, textAlign: "center", border: 1, borderColor: "divider", borderRadius: 3 }}>
          <AutoAwesomeIcon sx={{ fontSize: 56, color: "text.disabled", mb: 1.5 }} />
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>No pipelines yet</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Create your first lead pipeline to organize your sales process.</Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateDialog(true)} sx={{ borderRadius: 3, textTransform: "none" }}>
            Create pipeline
          </Button>
        </Paper>
      ) : (
        <Box sx={{ display: "flex", gap: 3, flex: 1 }}>
          {/* Pipeline list (left sidebar) */}
          <Box sx={{ width: 280, flexShrink: 0, display: "flex", flexDirection: "column", gap: 1.5 }}>
            {pipelines.map((p) => (
              <PipelineCard
                key={p.id}
                pipeline={p}
                selected={p.id === selectedPipelineId}
                onSelect={() => setSelectedPipelineId(p.id)}
                onEdit={() => setRenameDialog({ pipeline: p })}
                onDelete={() => setDeleteConfirm(p)}
              />
            ))}
          </Box>

          {/* Stage editor (right area) */}
          <Paper elevation={0} sx={{ flex: 1, border: 1, borderColor: "divider", borderRadius: 3, p: 3 }}>
            {selectedPipeline ? (
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                  {selectedPipeline.name} — Stages
                </Typography>
                <StageEditor pipelineId={selectedPipeline.id} stages={stages} onChange={loadStages} />
              </Box>
            ) : (
              <Box sx={{ p: 6, textAlign: "center" }}>
                <Typography variant="body2" color="text.secondary">Select a pipeline to manage its stages</Typography>
              </Box>
            )}
          </Paper>
        </Box>
      )}

      {/* Create dialog */}
      <Dialog open={createDialog} onClose={() => setCreateDialog(false)} fullWidth maxWidth="xs" slotProps={{ paper: { sx: { borderRadius: 3 } } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Create pipeline</DialogTitle>
        <CreatePipelineForm onClose={() => setCreateDialog(false)} onCreated={() => { loadPipelines(); setCreateDialog(false); }} setToast={setToast} />
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={!!renameDialog} onClose={() => setRenameDialog(null)} fullWidth maxWidth="xs" slotProps={{ paper: { sx: { borderRadius: 3 } } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Rename pipeline</DialogTitle>
        {renameDialog && (
          <RenamePipelineForm pipeline={renameDialog.pipeline} onClose={() => setRenameDialog(null)} onSaved={() => { loadPipelines(); setRenameDialog(null); }} setToast={setToast} />
        )}
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} slotProps={{ paper: { sx: { borderRadius: 3 } } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Delete pipeline?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Remove <strong>{deleteConfirm?.name}</strong>? Leads in this pipeline will be unassigned.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setDeleteConfirm(null)} sx={{ borderRadius: 2, textTransform: "none" }}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={async () => {
              if (!deleteConfirm) return;
              try { await deletePipeline(deleteConfirm.id); setToast({ message: "Pipeline deleted", severity: "success" }); loadPipelines(); } catch { setToast({ message: "Delete failed", severity: "error" }); }
              setDeleteConfirm(null);
            }}
            sx={{ borderRadius: 2, textTransform: "none" }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={toast !== null} autoHideDuration={4000} onClose={() => setToast(null)} anchorOrigin={{ vertical: "bottom", horizontal: "right" }}>
        {toast ? <Alert severity={toast.severity} variant="filled" sx={{ borderRadius: 2 }} onClose={() => setToast(null)}>{toast.message}</Alert> : undefined}
      </Snackbar>
    </Box>
  );
}

// ─── Create Pipeline Form ───────────────────────────────────────────
function CreatePipelineForm({ onClose, onCreated, setToast }: { onClose: () => void; onCreated: () => void; setToast: (t: { message: string; severity: "success" | "error" } | null) => void }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await createPipeline({ name: name.trim(), description: desc.trim() });
      setToast({ message: "Pipeline created", severity: "success" });
      onCreated();
    } catch { setToast({ message: "Failed to create", severity: "error" }); } finally { setSaving(false); }
  };
  return (
    <DialogContent sx={{ pt: "16px !important" }}>
      <TextField label="Pipeline name" value={name} onChange={(e) => setName(e.target.value)} fullWidth required size="medium" sx={{ mb: 2 }} slotProps={{ input: { sx: { borderRadius: 2 } } }} />
      <TextField label="Description (optional)" value={desc} onChange={(e) => setDesc(e.target.value)} fullWidth multiline rows={2} size="medium" slotProps={{ input: { sx: { borderRadius: 2 } } }} />
      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, mt: 2 }}>
        <Button onClick={onClose} sx={{ borderRadius: 2, textTransform: "none" }}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={!name.trim() || saving} sx={{ borderRadius: 2, textTransform: "none" }}>
          {saving ? <CircularProgress size={18} /> : "Create"}
        </Button>
      </Box>
    </DialogContent>
  );
}

// ─── Rename Pipeline Form ───────────────────────────────────────────
function RenamePipelineForm({ pipeline, onClose, onSaved, setToast }: { pipeline: Pipeline; onClose: () => void; onSaved: () => void; setToast: (t: { message: string; severity: "success" | "error" } | null) => void }) {
  const [name, setName] = useState(pipeline.name);
  const [desc, setDesc] = useState(pipeline.description);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await updatePipeline(pipeline.id, { name: name.trim(), description: desc.trim() });
      setToast({ message: "Pipeline updated", severity: "success" });
      onSaved();
    } catch { setToast({ message: "Update failed", severity: "error" }); } finally { setSaving(false); }
  };
  return (
    <DialogContent sx={{ pt: "16px !important" }}>
      <TextField label="Pipeline name" value={name} onChange={(e) => setName(e.target.value)} fullWidth required size="medium" sx={{ mb: 2 }} slotProps={{ input: { sx: { borderRadius: 2 } } }} />
      <TextField label="Description (optional)" value={desc} onChange={(e) => setDesc(e.target.value)} fullWidth multiline rows={2} size="medium" slotProps={{ input: { sx: { borderRadius: 2 } } }} />
      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, mt: 2 }}>
        <Button onClick={onClose} sx={{ borderRadius: 2, textTransform: "none" }}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={!name.trim() || saving} sx={{ borderRadius: 2, textTransform: "none" }}>
          {saving ? <CircularProgress size={18} /> : "Save"}
        </Button>
      </Box>
    </DialogContent>
  );
}
