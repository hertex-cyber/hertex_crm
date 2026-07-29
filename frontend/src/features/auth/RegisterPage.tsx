import { useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Link from "@mui/material/Link";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import InputAdornment from "@mui/material/InputAdornment";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import PersonIcon from "@mui/icons-material/Person";
import EmailIcon from "@mui/icons-material/Email";
import LockIcon from "@mui/icons-material/Lock";
import GoogleIcon from "@mui/icons-material/Google";
import GitHubIcon from "@mui/icons-material/GitHub";
import MicrosoftIcon from "@mui/icons-material/Microsoft";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import api from "@services/api";

export function RegisterPage() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    if (!agreed) {
      setError("Please agree to the Terms of Service and Privacy Policy to continue.");
      return;
    }
    setLoading(true);
    const data = new FormData(e.currentTarget);
    const payload = {
      email: data.get("email"),
      password: data.get("password"),
      first_name: data.get("first_name"),
      last_name: data.get("last_name"),
    };
    try {
      await api.post("/auth/register", payload);
      navigate("/login", { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Unable to create account. Please try again.");
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
          Create your account
        </Typography>
        <Typography variant="body2" sx={{ color: "#6B7280", mt: 0.5, fontSize: "0.9rem" }}>
          Start your free trial — no credit card required
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
          sx={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#374151", mb: 0.5 }}
        >
          Full name
        </Typography>
        <Box sx={{ display: "flex", gap: 2, mb: 2.5 }}>
          <TextField
            name="first_name"
            placeholder="First name"
            fullWidth
            required
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonIcon sx={{ color: "#9CA3AF", fontSize: 20 }} />
                  </InputAdornment>
                ),
              },
            }}
          />
          <TextField
            name="last_name"
            placeholder="Last name"
            fullWidth
            required
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonIcon sx={{ color: "#9CA3AF", fontSize: 20 }} />
                  </InputAdornment>
                ),
              },
            }}
          />
        </Box>

        <Typography
          component="label"
          htmlFor="reg-email"
          sx={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#374151", mb: 0.5 }}
        >
          Work email
        </Typography>
        <TextField
          id="reg-email"
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

        <Typography
          component="label"
          htmlFor="reg-password"
          sx={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#374151", mb: 0.5 }}
        >
          Password
        </Typography>
        <TextField
          id="reg-password"
          name="password"
          type={showPassword ? "text" : "password"}
          fullWidth
          required
          placeholder="Create a strong password"
          helperText="Must be at least 12 characters"
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

        <FormControlLabel
          control={
            <Checkbox
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              size="small"
              sx={{
                color: "#D1D5DB",
                "&.Mui-checked": { color: "#7C5CFC" },
              }}
            />
          }
          label={
            <Typography sx={{ fontSize: "0.82rem", color: "#6B7280", fontWeight: 500 }}>
              I agree to the{" "}
              <Box component="span" sx={{ color: "#7C5CFC", cursor: "pointer", fontWeight: 600 }}>
                Terms of Service
              </Box>{" "}
              and{" "}
              <Box component="span" sx={{ color: "#7C5CFC", cursor: "pointer", fontWeight: 600 }}>
                Privacy Policy
              </Box>
            </Typography>
          }
          sx={{ mb: 2.5, alignItems: "flex-start" }}
        />

        <Button
          type="submit"
          variant="contained"
          fullWidth
          size="large"
          disabled={loading}
          sx={{
            py: 1.5,
            bgcolor: "#7C5CFC",
            color: "#fff",
            fontSize: "0.95rem",
            fontWeight: 700,
            borderRadius: 1.5,
            "&:hover": { bgcolor: "#6B4CE6", boxShadow: "0 4px 12px rgba(124,92,252,0.3)" },
            "&.Mui-disabled": { bgcolor: "#7C5CFC", opacity: 0.6, color: "#fff" },
          }}
        >
          {loading ? (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <CircularProgress size={18} sx={{ color: "#fff" }} />
              <span>Creating account...</span>
            </Box>
          ) : (
            "Create account"
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
          Or sign up with
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
            borderRadius: 1.5,
            "&:hover": { borderColor: "#9CA3AF", bgcolor: "#F9FAFB" },
            justifyContent: "center",
            gap: 1.5,
          }}
        >
          Sign up with Google
        </Button>
        <Box sx={{ display: "flex", gap: 1.5 }}>
          <Button
            variant="outlined"
            fullWidth
            size="large"
            startIcon={<GitHubIcon sx={{ fontSize: 20 }} />}
            sx={{
              py: 1.3,
              borderColor: "#D1D5DB",
              color: "#374151",
              bgcolor: "#FFF",
              fontSize: "0.9rem",
              fontWeight: 600,
              borderRadius: 1.5,
              "&:hover": { borderColor: "#9CA3AF", bgcolor: "#F9FAFB" },
              justifyContent: "center",
              gap: 1.5,
            }}
          >
            GitHub
          </Button>
          <Button
            variant="outlined"
            fullWidth
            size="large"
            startIcon={<MicrosoftIcon sx={{ fontSize: 20 }} />}
            sx={{
              py: 1.3,
              borderColor: "#D1D5DB",
              color: "#374151",
              bgcolor: "#FFF",
              fontSize: "0.9rem",
              fontWeight: 600,
              borderRadius: 1.5,
              "&:hover": { borderColor: "#9CA3AF", bgcolor: "#F9FAFB" },
              justifyContent: "center",
              gap: 1.5,
            }}
          >
            Microsoft
          </Button>
        </Box>
      </Box>

      <Typography
        sx={{
          textAlign: "center",
          mt: 3.5,
          fontSize: "0.85rem",
          color: "#6B7280",
        }}
      >
        Already have an account?{" "}
        <Link
          component={RouterLink}
          to="/login"
          underline="hover"
          sx={{ color: "#7C5CFC", fontWeight: 700 }}
        >
          Sign in
        </Link>
      </Typography>
    </Box>
  );
}
