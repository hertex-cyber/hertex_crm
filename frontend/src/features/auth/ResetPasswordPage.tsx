import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import api from "@services/api";

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const data = new FormData(e.currentTarget);
    try {
      await api.post("/auth/reset-password", {
        token: searchParams.get("token"),
        new_password: data.get("new_password"),
      });
      setDone(true);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Reset failed. The link may be expired.");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <Box>
        <Typography variant="h5" fontWeight={700} mb={0.5}>
          Password reset
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={3}>
          Your password has been reset successfully.
        </Typography>
        <Button href="/login" variant="contained" fullWidth size="large">
          Back to Sign In
        </Button>
      </Box>
    );
  }

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Typography variant="h5" fontWeight={700} mb={0.5}>
        Set new password
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Enter your new password below.
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}
      <TextField
        name="new_password"
        label="New Password"
        type={showPassword ? "text" : "password"}
        fullWidth
        required
        sx={{ mb: 3 }}
        slotProps={{
          input: {
            endAdornment: (
              <InputAdornment position="end">
                <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" size="small">
                  {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
      />
      <Button type="submit" variant="contained" fullWidth size="large" disabled={loading} sx={{ py: 1.4 }}>
        {loading ? <CircularProgress size={22} /> : "Reset Password"}
      </Button>
    </Box>
  );
}
