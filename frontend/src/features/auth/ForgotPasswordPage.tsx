import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Link from "@mui/material/Link";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import MarkEmailReadIcon from "@mui/icons-material/MarkEmailRead";
import api from "@services/api";

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const data = new FormData(e.currentTarget);
    try {
      await api.post("/auth/forgot-password", { email: data.get("email") });
      setSent(true);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Request failed");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <Box sx={{ textAlign: "center" }}>
        <Box sx={{ display: "flex", justifyContent: "center", mb: 2 }}>
          <MarkEmailReadIcon sx={{ fontSize: 48, color: "primary.main" }} />
        </Box>
        <Typography variant="h5" fontWeight={700} mb={0.5}>
          Check your email
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={3}>
          If an account with that email exists, we&apos;ve sent a password reset link.
        </Typography>
        <Button component={RouterLink} to="/login" variant="contained" fullWidth size="large">
          Back to Sign In
        </Button>
      </Box>
    );
  }

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Typography variant="h5" fontWeight={700} mb={0.5}>
        Reset password
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Enter your email address and we&apos;ll send you a link to reset your password.
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}
      <TextField name="email" label="Email address" type="email" fullWidth required sx={{ mb: 3 }} />
      <Button type="submit" variant="contained" fullWidth size="large" disabled={loading} sx={{ py: 1.4 }}>
        {loading ? <CircularProgress size={22} /> : "Send Reset Link"}
      </Button>
      <Box sx={{ mt: 2, textAlign: "center" }}>
        <Link component={RouterLink} to="/login" underline="hover" sx={{ color: "text.secondary", display: "inline-flex", alignItems: "center", gap: 0.5 }}>
          <ArrowBackIcon fontSize="small" />
          Back to Sign In
        </Link>
      </Box>
    </Box>
  );
}
