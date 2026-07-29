import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Snackbar from "@mui/material/Snackbar";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CallIcon from "@mui/icons-material/Call";
import EmailIcon from "@mui/icons-material/Email";
import MessageIcon from "@mui/icons-material/Message";
import {
  assignLead,
  changeLeadStatus,
  convertLead,
  deleteLead,
  getLead,
  sendEmail,
  sendWhatsApp,
  logCall,
  listCommunications,
  scoreLead,
  updateLead,
  type Lead,
  type Communication,
  STATUS_LABELS,
  STATUS_COLORS,
} from "./api";

function DetailRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <Grid size={{ xs: 12, sm: 6, md: 4 }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="body2" sx={{ fontWeight: 500 }}>{value || "-"}</Typography>
    </Grid>
  );
}

export function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ first_name: "", last_name: "", email: "", phone: "", company: "", title: "" });

  const [statusTarget, setStatusTarget] = useState("");
  const [statusReason, setStatusReason] = useState("");
  const [scoreValue, setScoreValue] = useState("");
  const [assignTo, setAssignTo] = useState("");
  const [convertContactId, setConvertContactId] = useState("");

  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{ message: string; severity: "success" | "error" } | null>(null);

  const [comms, setComms] = useState<Communication[]>([]);
  const [emailDialog, setEmailDialog] = useState(false);
  const [whatsAppDialog, setWhatsAppDialog] = useState(false);
  const [callDialog, setCallDialog] = useState(false);
  const [sending, setSending] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [whatsAppTo, setWhatsAppTo] = useState("");
  const [whatsAppBody, setWhatsAppBody] = useState("");
  const [callPhone, setCallPhone] = useState("");
  const [callDuration, setCallDuration] = useState("");
  const [callNotes, setCallNotes] = useState("");

  const loadComms = useCallback(async () => {
    if (!id) return;
    try {
      const data = await listCommunications(id);
      setComms(data);
    } catch { /* ignore */ }
  }, [id]);

  const handleSendEmail = async () => {
    if (!id) return;
    setSending(true);
    try {
      await sendEmail(id, { subject: emailSubject, body: emailBody, to_address: emailTo || undefined });
      setToast({ message: "Email sent", severity: "success" });
      setEmailDialog(false);
      setEmailSubject(""); setEmailBody("");
      loadComms();
    } catch { setToast({ message: "Failed to send email", severity: "error" }); } finally { setSending(false); }
  };

  const handleSendWhatsApp = async () => {
    if (!id) return;
    setSending(true);
    try {
      await sendWhatsApp(id, { message: whatsAppBody, to_phone: whatsAppTo || undefined });
      setToast({ message: "WhatsApp sent", severity: "success" });
      setWhatsAppDialog(false);
      setWhatsAppBody("");
      loadComms();
    } catch { setToast({ message: "Failed to send WhatsApp", severity: "error" }); } finally { setSending(false); }
  };

  const handleLogCall = async () => {
    if (!id) return;
    setSending(true);
    try {
      await logCall(id, { duration: parseInt(callDuration) || 0, notes: callNotes });
      setToast({ message: "Call logged", severity: "success" });
      setCallDialog(false);
      setCallDuration(""); setCallNotes("");
      loadComms();
    } catch { setToast({ message: "Failed to log call", severity: "error" }); } finally { setSending(false); }
  };

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const data = await getLead(id);
      setLead(data);
      setEditForm({
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        phone: data.phone,
        company: data.company,
        title: data.title,
      });
    } catch {
      setError("Lead not found");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadComms(); }, [loadComms]);

  const handleSave = async () => {
    if (!lead) return;
    try {
      const updated = await updateLead(lead.id, editForm);
      setLead(updated);
      setEditing(false);
      setToast({ message: "Lead updated", severity: "success" });
    } catch (err: unknown) {
      setToast({ message: err instanceof Error ? err.message : "Update failed", severity: "error" });
    }
  };

  const handleStatusChange = async () => {
    if (!lead || !statusTarget) return;
    try {
      const updated = await changeLeadStatus(lead.id, statusTarget, statusReason);
      setLead(updated);
      setStatusTarget("");
      setStatusReason("");
      setToast({ message: `Status changed to ${STATUS_LABELS[statusTarget]}`, severity: "success" });
    } catch (err: unknown) {
      setToast({ message: err instanceof Error ? err.message : "Status change failed", severity: "error" });
    }
  };

  const handleScore = async () => {
    if (!lead) return;
    const score = parseInt(scoreValue, 10);
    if (isNaN(score) || score < 0 || score > 100) {
      setToast({ message: "Score must be between 0 and 100", severity: "error" });
      return;
    }
    try {
      const updated = await scoreLead(lead.id, score);
      setLead(updated);
      setScoreValue("");
      setToast({ message: `Score set to ${score}`, severity: "success" });
    } catch (err: unknown) {
      setToast({ message: err instanceof Error ? err.message : "Score failed", severity: "error" });
    }
  };

  const handleAssign = async () => {
    if (!lead) return;
    try {
      const updated = await assignLead(lead.id, assignTo || null);
      setLead(updated);
      setAssignTo("");
      setToast({ message: "Lead assigned", severity: "success" });
    } catch (err: unknown) {
      setToast({ message: err instanceof Error ? err.message : "Assign failed", severity: "error" });
    }
  };

  const handleConvert = async () => {
    if (!lead) return;
    try {
      const updated = await convertLead(lead.id, convertContactId);
      setLead(updated);
      setConvertContactId("");
      setToast({ message: "Lead converted successfully", severity: "success" });
    } catch (err: unknown) {
      setToast({ message: err instanceof Error ? err.message : "Conversion failed", severity: "error" });
    }
  };

  const handleDelete = async () => {
    if (!lead) return;
    try {
      await deleteLead(lead.id);
      navigate("/leads", { replace: true });
    } catch {
      setToast({ message: "Failed to delete lead", severity: "error" });
    }
  };

  const validTransitions: Record<string, string[]> = {
    NEW: ["CONTACTED", "DISQUALIFIED"],
    CONTACTED: ["QUALIFIED", "DISQUALIFIED"],
    QUALIFIED: ["CONVERTED", "DISQUALIFIED"],
    DISQUALIFIED: ["RECYCLED", "NEW"],
    RECYCLED: ["CONTACTED", "QUALIFIED", "DISQUALIFIED"],
    CONVERTED: [],
  };

  if (loading) return <Box sx={{ display: "flex", justifyContent: "center", pt: 12 }}><CircularProgress /></Box>;
  if (error || !lead) return <Alert severity="error">{error || "Lead not found"}</Alert>;

  const statusColor = STATUS_COLORS[lead.status] || "#999";
  const transitions = validTransitions[lead.status] || [];

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
        <IconButton onClick={() => navigate("/leads")}><ArrowBackIcon /></IconButton>
        <Typography variant="h4" sx={{ flex: 1 }}>{lead.first_name} {lead.last_name}</Typography>
        <Button variant="outlined" startIcon={<EditOutlinedIcon />} onClick={() => setEditing(!editing)}>Edit</Button>
        <Button variant="outlined" color="error" startIcon={<DeleteForeverIcon />} onClick={() => setDeleting(true)}>Delete</Button>
      </Box>

      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: "flex", gap: 2, alignItems: "center", mb: 3 }}>
          <Chip label={STATUS_LABELS[lead.status] || lead.status} sx={{ bgcolor: statusColor, color: "#fff", fontWeight: 600 }} />
          <Chip label={`Score: ${lead.score}%`} variant="outlined" size="small" />
          <Chip label={`Source: ${lead.source}`} variant="outlined" size="small" />
        </Box>

        {editing ? (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 6 }}><TextField label="First name" fullWidth size="small" value={editForm.first_name} onChange={(e) => setEditForm((f) => ({ ...f, first_name: e.target.value }))} /></Grid>
              <Grid size={{ xs: 6 }}><TextField label="Last name" fullWidth size="small" value={editForm.last_name} onChange={(e) => setEditForm((f) => ({ ...f, last_name: e.target.value }))} /></Grid>
              <Grid size={{ xs: 12 }}><TextField label="Email" fullWidth size="small" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} /></Grid>
              <Grid size={{ xs: 6 }}><TextField label="Phone" fullWidth size="small" value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} /></Grid>
              <Grid size={{ xs: 6 }}><TextField label="Company" fullWidth size="small" value={editForm.company} onChange={(e) => setEditForm((f) => ({ ...f, company: e.target.value }))} /></Grid>
              <Grid size={{ xs: 6 }}><TextField label="Title" fullWidth size="small" value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} /></Grid>
            </Grid>
            <Box sx={{ display: "flex", gap: 1 }}>
              <Button variant="contained" onClick={handleSave}>Save</Button>
              <Button onClick={() => setEditing(false)}>Cancel</Button>
            </Box>
          </Box>
        ) : (
          <Grid container spacing={2}>
            <DetailRow label="Email" value={lead.email} />
            <DetailRow label="Phone" value={lead.phone} />
            <DetailRow label="Company" value={lead.company} />
            <DetailRow label="Title" value={lead.title} />
            <DetailRow label="Source" value={lead.source} />
            <DetailRow label="Assigned to" value={lead.assigned_to_id} />
            <DetailRow label="Created" value={new Date(lead.created_at).toLocaleString()} />
            <DetailRow label="Updated" value={new Date(lead.updated_at).toLocaleString()} />
          </Grid>
        )}

        {lead.notes && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="caption" color="text.secondary">Notes</Typography>
            <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{lead.notes}</Typography>
          </Box>
        )}
      </Paper>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Status</Typography>
            {transitions.length > 0 ? (
              <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
                <TextField select size="small" value={statusTarget} onChange={(e) => setStatusTarget(e.target.value)} sx={{ minWidth: 160 }} label="New status">
                  {transitions.map((t) => (
                    <MenuItem key={t} value={t}>{STATUS_LABELS[t]}</MenuItem>
                  ))}
                </TextField>
                {statusTarget === "DISQUALIFIED" && (
                  <TextField size="small" value={statusReason} onChange={(e) => setStatusReason(e.target.value)} label="Reason" />
                )}
                <Button variant="contained" size="small" onClick={handleStatusChange} disabled={!statusTarget}>Apply</Button>
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">No transitions available (terminal status).</Typography>
            )}
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Score</Typography>
            <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
              <TextField size="small" type="number" value={scoreValue} onChange={(e) => setScoreValue(e.target.value)} label="Score (0-100)" sx={{ minWidth: 120 }} slotProps={{ htmlInput: { min: 0, max: 100 } }} />
              <Button variant="contained" size="small" onClick={handleScore} disabled={!scoreValue}>Set score</Button>
            </Box>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Assignment</Typography>
            <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
              <TextField size="small" value={assignTo} onChange={(e) => setAssignTo(e.target.value)} label="User ID" sx={{ minWidth: 200 }} placeholder="UUID or empty to unassign" />
              <Button variant="contained" size="small" onClick={handleAssign}>Assign</Button>
            </Box>
          </Paper>
        </Grid>

        {lead.status === "QUALIFIED" && (
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper sx={{ p: 2, borderColor: "success.main" }}>
              <Typography variant="h6" sx={{ mb: 2, color: "success.main" }}>Convert</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                This lead is qualified and ready for conversion.
              </Typography>
              <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
                <TextField size="small" value={convertContactId} onChange={(e) => setConvertContactId(e.target.value)} label="Contact ID (required)" sx={{ minWidth: 200 }} />
                <Button variant="contained" color="success" size="small" onClick={handleConvert} disabled={!convertContactId}>Convert</Button>
              </Box>
            </Paper>
          </Grid>
        )}
      </Grid>

      {/* ─── Communications ──────────────────────────────────────── */}
      <Paper elevation={0} sx={{ border: 1, borderColor: "divider", borderRadius: 3, p: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Communication</Typography>
          <Box sx={{ display: "flex", gap: 0.5 }}>
            <Button size="small" variant="outlined" startIcon={<EmailIcon />} onClick={() => setEmailDialog(true)} sx={{ borderRadius: 2, textTransform: "none", fontSize: "0.75rem" }}>Email</Button>
            <Button size="small" variant="outlined" startIcon={<MessageIcon />} onClick={() => setWhatsAppDialog(true)} sx={{ borderRadius: 2, textTransform: "none", fontSize: "0.75rem" }}>WhatsApp</Button>
            <Button size="small" variant="outlined" startIcon={<CallIcon />} onClick={() => setCallDialog(true)} sx={{ borderRadius: 2, textTransform: "none", fontSize: "0.75rem" }}>Call</Button>
          </Box>
        </Box>
        {comms.length === 0 ? (
          <Typography variant="body2" color="text.disabled" sx={{ py: 2, textAlign: "center" }}>No communications yet. Use the buttons above to send an email, WhatsApp message, or log a call.</Typography>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1, maxHeight: 300, overflow: "auto" }}>
            {comms.map((c) => (
              <Paper key={c.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                  <Chip label={c.type} size="small" color={c.type === "EMAIL" ? "primary" : c.type === "WHATSAPP" ? "success" : "warning"} sx={{ height: 20, fontSize: "0.65rem", fontWeight: 700 }} />
                  <Chip label={c.direction} size="small" variant="outlined" sx={{ height: 20, fontSize: "0.65rem" }} />
                  <Typography variant="caption" color="text.disabled" sx={{ ml: "auto" }}>{new Date(c.created_at).toLocaleString()}</Typography>
                </Box>
                {c.subject && <Typography variant="body2" sx={{ fontWeight: 600 }}>{c.subject}</Typography>}
                <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "pre-wrap" }}>{c.body}</Typography>
                <Box sx={{ display: "flex", gap: 1, mt: 0.5 }}>
                  <Typography variant="caption" color="text.disabled">To: {c.to_address || "-"}</Typography>
                  {c.metadata?.duration_seconds ? <Typography variant="caption" color="text.disabled">Duration: {String(c.metadata.duration_seconds)}s</Typography> : null}
                </Box>
              </Paper>
            ))}
          </Box>
        )}
      </Paper>

      {/* Email dialog */}
      <Dialog open={emailDialog} onClose={() => setEmailDialog(false)} fullWidth maxWidth="sm" slotProps={{ paper: { sx: { borderRadius: 3 } } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Send Email</DialogTitle>
        <DialogContent sx={{ pt: "16px !important" }}>
          <TextField label="To" value={emailTo} onChange={(e) => setEmailTo(e.target.value)} fullWidth size="small" sx={{ mb: 2 }} slotProps={{ input: { sx: { borderRadius: 2 } } }} placeholder={lead?.email || ""} />
          <TextField label="Subject" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} fullWidth size="small" sx={{ mb: 2 }} slotProps={{ input: { sx: { borderRadius: 2 } } }} />
          <TextField label="Body" value={emailBody} onChange={(e) => setEmailBody(e.target.value)} fullWidth multiline rows={6} size="small" slotProps={{ input: { sx: { borderRadius: 2 } } }} />
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setEmailDialog(false)} sx={{ borderRadius: 2, textTransform: "none" }}>Cancel</Button>
          <Button variant="contained" onClick={handleSendEmail} disabled={!emailSubject.trim() || !emailBody.trim() || sending} sx={{ borderRadius: 2, textTransform: "none" }}>
            {sending ? <CircularProgress size={18} /> : "Send"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* WhatsApp dialog */}
      <Dialog open={whatsAppDialog} onClose={() => setWhatsAppDialog(false)} fullWidth maxWidth="sm" slotProps={{ paper: { sx: { borderRadius: 3 } } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Send WhatsApp</DialogTitle>
        <DialogContent sx={{ pt: "16px !important" }}>
          <TextField label="To (phone)" value={whatsAppTo} onChange={(e) => setWhatsAppTo(e.target.value)} fullWidth size="small" sx={{ mb: 2 }} slotProps={{ input: { sx: { borderRadius: 2 } } }} placeholder={lead?.phone || ""} />
          <TextField label="Message" value={whatsAppBody} onChange={(e) => setWhatsAppBody(e.target.value)} fullWidth multiline rows={6} size="small" slotProps={{ input: { sx: { borderRadius: 2 } } }} />
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setWhatsAppDialog(false)} sx={{ borderRadius: 2, textTransform: "none" }}>Cancel</Button>
          <Button variant="contained" color="success" onClick={handleSendWhatsApp} disabled={!whatsAppBody.trim() || sending} sx={{ borderRadius: 2, textTransform: "none" }}>
            {sending ? <CircularProgress size={18} /> : "Send"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Call dialog */}
      <Dialog open={callDialog} onClose={() => setCallDialog(false)} fullWidth maxWidth="sm" slotProps={{ paper: { sx: { borderRadius: 3 } } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Log Call</DialogTitle>
        <DialogContent sx={{ pt: "16px !important" }}>
          <TextField label="Phone" value={callPhone} onChange={(e) => setCallPhone(e.target.value)} fullWidth size="small" sx={{ mb: 2 }} slotProps={{ input: { sx: { borderRadius: 2 } } }} placeholder={lead?.phone || ""} />
          <TextField label="Duration (seconds)" value={callDuration} onChange={(e) => setCallDuration(e.target.value)} type="number" fullWidth size="small" sx={{ mb: 2 }} slotProps={{ input: { sx: { borderRadius: 2 } } }} />
          <TextField label="Notes" value={callNotes} onChange={(e) => setCallNotes(e.target.value)} fullWidth multiline rows={4} size="small" slotProps={{ input: { sx: { borderRadius: 2 } } }} />
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setCallDialog(false)} sx={{ borderRadius: 2, textTransform: "none" }}>Cancel</Button>
          <Button variant="contained" color="warning" onClick={handleLogCall} disabled={sending} sx={{ borderRadius: 2, textTransform: "none" }}>
            {sending ? <CircularProgress size={18} /> : "Log Call"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleting} onClose={() => setDeleting(false)}>
        <DialogTitle>Delete {lead.first_name} {lead.last_name}?</DialogTitle>
        <DialogContent><DialogContentText>This action cannot be undone.</DialogContentText></DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleting(false)}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained">Delete</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={toast !== null} autoHideDuration={4000} onClose={() => setToast(null)} anchorOrigin={{ vertical: "bottom", horizontal: "right" }}>
        {toast ? <Alert severity={toast.severity} variant="filled" onClose={() => setToast(null)}>{toast.message}</Alert> : undefined}
      </Snackbar>
    </Box>
  );
}
