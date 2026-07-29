import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Stepper from "@mui/material/Stepper";
import Step from "@mui/material/Step";
import StepLabel from "@mui/material/StepLabel";
import BusinessIcon from "@mui/icons-material/Business";
import PeopleIcon from "@mui/icons-material/People";
import CheckCircle from "@mui/icons-material/CheckCircle";
import { useAuthStore } from "@store/authStore";
import { createOrg, listMyOrgs, inviteMember } from "./api";

const steps = ["Create Workspace", "Invite Team", "Done"];

export function OrgSetupWizard() {
  const navigate = useNavigate();
  const setOrganizations = useAuthStore((s) => s.setOrganizations);
  const setCurrentOrganization = useAuthStore((s) => s.setCurrentOrganization);
  const user = useAuthStore((s) => s.user);

  const [activeStep, setActiveStep] = useState(0);
  const [name, setName] = useState(`${user?.first_name || "My"}'s Workspace`);
  const [slug, setSlug] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [createdOrg, setCreatedOrg] = useState<any>(null);
  const [invited, setInvited] = useState(false);

  const generateSlug = (val: string) => {
    return val.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || `workspace-${Date.now()}`;
  };

  const handleNameChange = (val: string) => {
    setName(val);
    if (!slug || slug === generateSlug(name)) {
      setSlug(generateSlug(val));
    }
  };

  const handleCreate = async () => {
    setError("");
    setLoading(true);
    try {
      const org = await createOrg({ name, slug: slug || generateSlug(name) });
      setCreatedOrg(org);
      setCurrentOrganization(org);
      const orgs = await listMyOrgs();
      setOrganizations(orgs);
      setActiveStep(1);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || "Failed to create workspace");
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail) return;
    setError("");
    setLoading(true);
    try {
      await inviteMember(createdOrg.id, { email: inviteEmail, role: "MEMBER" });
      setInvited(true);
      setInviteEmail("");
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Failed to send invite");
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = () => {
    setActiveStep(2);
    setTimeout(() => navigate("/"), 1200);
  };

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "grey.50", p: 2 }}>
      <Paper sx={{ p: 4, maxWidth: 520, width: "100%", borderRadius: 3 }}>
        <Box sx={{ textAlign: "center", mb: 4 }}>
          <Box sx={{ width: 56, height: 56, borderRadius: 2, bgcolor: "primary.main", display: "flex", alignItems: "center", justifyContent: "center", mx: "auto", mb: 2 }}>
            <BusinessIcon sx={{ fontSize: 28, color: "#fff" }} />
          </Box>
          <Typography variant="h5" sx={{ color: "text.primary", fontWeight: 700, mb: 0.5 }}>
            Set Up Your Workspace
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Get started by creating your organization workspace
          </Typography>
        </Box>

        <Stepper activeStep={activeStep} sx={{ mb: 4, "& .MuiStepLabel-label": { fontSize: "0.8rem", fontWeight: 600 } }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 1.5 }}>{error}</Alert>}

        {activeStep === 0 && (
          <Box>
            <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "text.secondary", mb: 0.75, textTransform: "uppercase", letterSpacing: "0.4px" }}>
              Workspace Name
            </Typography>
            <TextField fullWidth value={name} onChange={(e) => handleNameChange(e.target.value)} placeholder="My Workspace" size="small" sx={{ mb: 2.5 }} />
            <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "text.secondary", mb: 0.75, textTransform: "uppercase", letterSpacing: "0.4px" }}>
              Workspace URL
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 3 }}>
              <Typography sx={{ fontSize: "0.85rem", color: "text.disabled", fontWeight: 500 }}>tzahu.app/</Typography>
              <TextField fullWidth value={slug} onChange={(e) => setSlug(e.target.value.replace(/[^a-z0-9-]/g, ""))} placeholder="my-workspace" size="small" sx={{ "& .MuiOutlinedInput-root": { fontSize: "0.85rem" } }} />
            </Box>
            <Button variant="contained" fullWidth size="large" onClick={handleCreate} disabled={loading || !name.trim()}>
              {loading ? <CircularProgress size={20} sx={{ mr: 1 }} /> : null}
              {loading ? "Creating..." : "Create Workspace"}
            </Button>
          </Box>
        )}

        {activeStep === 1 && (
          <Box>
            <Typography variant="body2" sx={{ color: "text.secondary", mb: 2.5 }}>
              Invite your team members to collaborate. You can always invite more later.
            </Typography>
            <Box sx={{ display: "flex", gap: 1.5, mb: 3 }}>
              <TextField
                fullWidth
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@company.com"
                size="small"
              />
              <Button variant="outlined" onClick={handleInvite} disabled={loading || !inviteEmail.trim()} sx={{ whiteSpace: "nowrap", flexShrink: 0 }}>
                {loading ? <CircularProgress size={16} /> : "Send Invite"}
              </Button>
            </Box>
            {invited && (
              <Alert severity="success" sx={{ mb: 2.5, borderRadius: 1.5 }}>
                Invitation sent! They'll receive an email to join.
              </Alert>
            )}
            <Box sx={{ display: "flex", gap: 1.5 }}>
              <Button variant="outlined" onClick={() => setInviteEmail("")} sx={{ flex: 1 }}>
                Skip
              </Button>
              <Button variant="contained" onClick={handleFinish} sx={{ flex: 1 }}>
                Done
              </Button>
            </Box>
          </Box>
        )}

        {activeStep === 2 && (
          <Box sx={{ textAlign: "center", py: 3 }}>
            <CheckCircle sx={{ fontSize: 48, color: "success.main", mb: 2 }} />
            <Typography variant="h6" sx={{ color: "text.primary", fontWeight: 600, mb: 0.5 }}>
              All Set!
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Your workspace is ready. Redirecting to dashboard...
            </Typography>
          </Box>
        )}
      </Paper>
    </Box>
  );
}
