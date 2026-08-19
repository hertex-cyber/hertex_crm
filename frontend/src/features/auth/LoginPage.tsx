import { useState } from "react";
import { Link as RouterLink, useNavigate, useSearchParams } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import InputAdornment from "@mui/material/InputAdornment";
import Link from "@mui/material/Link";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import EmailIcon from "@mui/icons-material/Email";
import GoogleIcon from "@mui/icons-material/Google";
import LockIcon from "@mui/icons-material/Lock";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import api from "@services/api";
import { useAuthStore } from "@store/authStore";

const labelSx = {
  display: "block",
  mb: 0.8,
  color: "#554437",
  fontSize: "0.85rem",
  fontWeight: 700,
};

const iconSx = { color: "#A59480", fontSize: 20 };

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setTokens = useAuthStore((state) => state.setTokens);
  const setUser = useAuthStore((state) => state.setUser);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    const data = new FormData(event.currentTarget);

    try {
      const { data: tokens } = await api.post("/auth/login", {
        email: data.get("email"),
        password: data.get("password"),
      });
      setTokens(tokens.access_token, tokens.refresh_token);
      const { data: user } = await api.get("/auth/me");
      setUser(user);
      navigate(searchParams.get("redirect") || "/", { replace: true });
    } catch (requestError: any) {
      const message = requestError.response?.data?.error?.message;
      if (message?.toLowerCase().includes("email")) {
        setError("No account found with this email address.");
      } else if (message?.toLowerCase().includes("password")) {
        setError("Incorrect password. Please try again.");
      } else {
        setError(message || "Unable to sign in. Please check your credentials.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Box sx={{ mb: 3.25, textAlign: "center" }}>
        <Typography
          variant="h4"
          sx={{
            color: "#38291F",
            fontFamily: '"DM Serif Display", Georgia, serif',
            fontSize: { xs: "1.65rem", sm: "1.85rem" },
            fontWeight: 500,
            letterSpacing: "-0.05em",
            lineHeight: 1.06,
          }}
        >
          <Box component="span" sx={{ color: "#5F725D" }}>Welcome back</Box>, sign in
        </Typography>
        <Typography sx={{ color: "#756555", fontSize: "0.9rem", lineHeight: 1.6, mt: 1.1 }}>
          Continue cultivating stronger customer relationships.
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2, "& .MuiAlert-message": { fontSize: "0.85rem", fontWeight: 600 } }}>
          {error}
        </Alert>
      )}

      <Box component="form" noValidate onSubmit={handleSubmit}>
        <Typography component="label" htmlFor="login-email" sx={labelSx}>Email address</Typography>
        <TextField
          id="login-email"
          name="email"
          type="email"
          placeholder="you@company.com"
          fullWidth
          required
          sx={{ mb: 2.5 }}
          slotProps={{
            input: {
              startAdornment: <InputAdornment position="start"><EmailIcon sx={iconSx} /></InputAdornment>,
            },
          }}
        />

        <Box sx={{ alignItems: "center", display: "flex", justifyContent: "space-between", mb: 0.8 }}>
          <Typography component="label" htmlFor="login-password" sx={{ ...labelSx, mb: 0 }}>Password</Typography>
          <Link component={RouterLink} to="/forgot-password" underline="hover" sx={{ color: "#5F725D", fontSize: "0.8rem", fontWeight: 700 }}>
            Forgot password?
          </Link>
        </Box>
        <TextField
          id="login-password"
          name="password"
          type={showPassword ? "text" : "password"}
          placeholder="Enter your password"
          fullWidth
          required
          sx={{ mb: 2.25 }}
          slotProps={{
            input: {
              startAdornment: <InputAdornment position="start"><LockIcon sx={iconSx} /></InputAdornment>,
              endAdornment: (
                <InputAdornment position="end">
                  <Box
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    component="button"
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    sx={{ alignItems: "center", bgcolor: "transparent", border: 0, color: "#A59480", cursor: "pointer", display: "flex", p: 0.5, "&:hover": { color: "#554437" } }}
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
            bgcolor: "#49362A",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(73,54,42,0.16)",
            color: "#FFFDF8",
            fontSize: "0.95rem",
            fontWeight: 700,
            py: 1.5,
            transition: "transform 160ms cubic-bezier(0.23, 1, 0.32, 1), box-shadow 160ms cubic-bezier(0.23, 1, 0.32, 1), background-color 160ms cubic-bezier(0.23, 1, 0.32, 1)",
            "&:hover": { bgcolor: "#35251C", boxShadow: "0 8px 22px rgba(73,54,42,0.22)", transform: "translateY(-1px)" },
            "&:active": { transform: "scale(0.98)" },
            "&.Mui-disabled": { bgcolor: "#49362A", color: "#FFFDF8", opacity: 0.6 },
          }}
        >
          {loading ? <Box sx={{ alignItems: "center", display: "flex", gap: 1.5 }}><CircularProgress size={18} sx={{ color: "#FFFDF8" }} />Signing in...</Box> : "Sign in"}
        </Button>
      </Box>

      <Box sx={{ alignItems: "center", display: "flex", gap: 1.5, my: 3 }}>
        <Divider sx={{ borderColor: "#E4D9C9", flex: 1 }} />
        <Typography sx={{ color: "#A59480", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
          Or continue with
        </Typography>
        <Divider sx={{ borderColor: "#E4D9C9", flex: 1 }} />
      </Box>

      <Button
        variant="outlined"
        fullWidth
        size="large"
        startIcon={<GoogleIcon sx={{ fontSize: 20 }} />}
        sx={{
          bgcolor: "rgba(255,253,248,0.65)",
          borderColor: "#D7C9B6",
          borderRadius: "8px",
          color: "#554437",
          fontSize: "0.9rem",
          fontWeight: 700,
          gap: 1.5,
          justifyContent: "center",
          py: 1.3,
          "&:hover": { bgcolor: "#FFFDF8", borderColor: "#9A876E" },
        }}
      >
        Continue with Google
      </Button>

      <Typography sx={{ color: "#756555", fontSize: "0.85rem", mt: 3.5, textAlign: "center" }}>
        Don&apos;t have an account? {" "}
        <Link component={RouterLink} to="/register" underline="hover" sx={{ color: "#5F725D", fontWeight: 700 }}>
          Create one now
        </Link>
      </Typography>
    </Box>
  );
}
