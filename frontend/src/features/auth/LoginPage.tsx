import { useState } from "react";
import { Link as RouterLink, useNavigate, useSearchParams } from "react-router-dom";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Link from "@mui/material/Link";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import InputAdornment from "@mui/material/InputAdornment";
import EmailIcon from "@mui/icons-material/Email";
import LockIcon from "@mui/icons-material/Lock";
import GoogleIcon from "@mui/icons-material/Google";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import api from "@services/api";
import { useAuthStore } from "@store/authStore";

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setTokens = useAuthStore((s) => s.setTokens);
  const setUser = useAuthStore((s) => s.setUser);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const data = new FormData(e.currentTarget);
    try {
      const { data: tokens } = await api.post("/auth/login", {
        email: data.get("email"),
        password: data.get("password"),
      });
      setTokens(tokens.access_token, tokens.refresh_token);
      const { data: user } = await api.get("/auth/me");
      setUser(user);
      navigate(searchParams.get("redirect") || "/", { replace: true });
    } catch (err: any) {
      const msg = err.response?.data?.error?.message;
      if (msg?.toLowerCase().includes("email")) {
        setError("No account found with this email address.");
      } else if (msg?.toLowerCase().includes("password")) {
        setError("Incorrect password. Please try again.");
      } else {
        setError(msg || "Unable to sign in. Please check your credentials.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Box sx={{ textAlign: "center", mb: 3 }}>
        <Typography
          variant="h4"
          sx={{ fontWeight: 800, color: "#111827", fontSize: "1.6rem", letterSpacing: "-0.5px" }}
        >
          <Box component="span" sx={{ color: "#F97316" }}>
            Welcome back
          </Box>
          {", "}
          <Box component="span" sx={{ color: "#111827" }}>
            sign in
          </Box>
        </Typography>
      </Box>

      {error && (
        <Alert
          severity="error"
          sx={{ mb: 2.5, borderRadius: 1.5, "& .MuiAlert-message": { fontWeight: 500, fontSize: "0.85rem" } }}
        >
          {error}
        </Alert>
      )}

      <Box component="form" onSubmit={handleSubmit} noValidate>
        <Typography
          component="label"
          htmlFor="login-email"
          sx={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#374151", mb: 0.5 }}
        >
          Email address
        </Typography>
        <TextField
          id="login-email"
          name="email"
          type="email"
          fullWidth
          required
          placeholder="you@company.com"
          sx={{ mb: 2.5 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <EmailIcon sx={{ color: "#9CA3AF", fontSize: 20 }} />
                </InputAdornment>
              ),
            },
          }}
        />

        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}>
          <Typography
            component="label"
            htmlFor="login-password"
            sx={{ fontSize: "0.85rem", fontWeight: 600, color: "#374151" }}
          >
            Password
          </Typography>
          <Link
            component={RouterLink}
            to="/forgot-password"
            underline="hover"
            sx={{ fontSize: "0.8rem", fontWeight: 500, color: "#EA580C" }}
          >
            Forgot password?
          </Link>
        </Box>
        <TextField
          id="login-password"
          name="password"
          type={showPassword ? "text" : "password"}
          fullWidth
          required
          placeholder="Enter your password"
          sx={{ mb: 2 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <LockIcon sx={{ color: "#9CA3AF", fontSize: 20 }} />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <Box
                    component="button"
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    sx={{
                      border: "none",
                      bgcolor: "transparent",
                      cursor: "pointer",
                      p: 0.5,
                      display: "flex",
                      color: "#9CA3AF",
                      "&:hover": { color: "#4B5563" },
                    }}
                  >
                    {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                  </Box>
                </InputAdornment>
              ),
            },
          }}
        />

        <Button
          type="submit"
          variant="contained"
          fullWidth
          size="large"
          disabled={loading}
          sx={{
            py: 1.5,
            bgcolor: "#EA580C",
            color: "#fff",
            fontSize: "0.95rem",
            fontWeight: 700,
            borderRadius: 1,
            boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
            "&:hover": { bgcolor: "#C2410C", boxShadow: "0 4px 12px rgba(234,88,12,0.25)" },
            "&.Mui-disabled": { bgcolor: "#EA580C", opacity: 0.6, color: "#fff" },
          }}
        >
          {loading ? (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <CircularProgress size={18} sx={{ color: "#fff" }} />
              <span>Signing in...</span>
            </Box>
          ) : (
            "Sign in"
          )}
        </Button>
      </Box>

      <Box sx={{ my: 3, display: "flex", alignItems: "center", gap: 1.5 }}>
        <Divider sx={{ flex: 1, borderColor: "#E5E7EB" }} />
        <Typography
          sx={{
            fontSize: "0.75rem",
            color: "#9CA3AF",
            fontWeight: 600,
            letterSpacing: "0.5px",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}
        >
          Or continue with
        </Typography>
        <Divider sx={{ flex: 1, borderColor: "#E5E7EB" }} />
      </Box>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        <Button
          variant="outlined"
          fullWidth
          size="large"
          startIcon={<GoogleIcon sx={{ fontSize: 20 }} />}
          sx={{
            py: 1.3,
            borderColor: "#D1D5DB",
            color: "#374151",
            bgcolor: "#FFF",
              fontSize: "0.9rem",
              fontWeight: 600,
              borderRadius: 1,
              "&:hover": { borderColor: "#9CA3AF", bgcolor: "#F9FAFB" },
            justifyContent: "center",
            gap: 1.5,
          }}
        >
          Continue with Google
        </Button>
      </Box>

      <Typography
        sx={{
          textAlign: "center",
          mt: 3.5,
          fontSize: "0.85rem",
          color: "#6B7280",
        }}
      >
        Don&apos;t have an account?{" "}
        <Link
          component={RouterLink}
          to="/register"
          underline="hover"
          sx={{ color: "#EA580C", fontWeight: 700 }}
        >
          Create one now
        </Link>
      </Typography>
    </Box>
  );
}
