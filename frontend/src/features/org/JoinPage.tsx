import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import { acceptInvite } from "./api";
import { useAuth } from "@features/auth/AuthProvider";

export function JoinPage() {
  const [searchParams] = useSearchParams();
  const membershipId = searchParams.get("membership_id");
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!membershipId) {
      setStatus("error");
      setMessage("Invalid invitation link — missing membership ID.");
      return;
    }
    if (!isAuthenticated) {
      navigate(`/login?redirect=/join?membership_id=${membershipId}`, { replace: true });
      return;
    }
    acceptInvite(membershipId)
      .then(() => {
        setStatus("success");
        setMessage("You've joined the workspace! Redirecting...");
        setTimeout(() => navigate("/dashboard", { replace: true }), 2000);
      })
      .catch((err: any) => {
        setStatus("error");
        setMessage(err.response?.data?.error?.message || "Failed to accept invitation.");
      });
  }, [authLoading, isAuthenticated, membershipId, navigate]);

  return (
    <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", bgcolor: "grey.50", p: 2 }}>
      <Paper sx={{ p: 4, maxWidth: 440, width: "100%", textAlign: "center", borderRadius: 3 }}>
        {status === "loading" && (
          <>
            <CircularProgress sx={{ mb: 2 }} />
            <Typography>Accepting invitation...</Typography>
          </>
        )}
        {status === "success" && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
        {status === "error" && (
          <>
            <Alert severity="error" sx={{ mb: 2 }}>{message}</Alert>
            <Button onClick={() => navigate("/dashboard")} variant="contained">Go to Dashboard</Button>
          </>
        )}
      </Paper>
    </Box>
  );
}
