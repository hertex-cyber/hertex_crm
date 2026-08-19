import { useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import InputAdornment from "@mui/material/InputAdornment";
import Link from "@mui/material/Link";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import EmailIcon from "@mui/icons-material/Email";
import GoogleIcon from "@mui/icons-material/Google";
import LockIcon from "@mui/icons-material/Lock";
import PersonIcon from "@mui/icons-material/Person";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import api from "@services/api";

const iconSx = { color: "#A59480", fontSize: 20 };

export function RegisterPage() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [values, setValues] = useState({ first_name: "", last_name: "", email: "", password: "" });

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) =>
    setValues((current) => ({ ...current, [event.target.name]: event.target.value }));

  const formFilled = Object.values(values).every((field) => field.trim().length > 0);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (!agreed) {
      setError("Please agree to the Terms of Service and Privacy Policy to continue.");
      return;
    }

    setLoading(true);
    const data = new FormData(event.currentTarget);
    try {
      await api.post("/auth/register", {
        email: data.get("email"),
        password: data.get("password"),
        first_name: data.get("first_name"),
        last_name: data.get("last_name"),
      });
      navigate("/login", { replace: true });
    } catch (requestError: any) {
      setError(requestError.response?.data?.error?.message || "Unable to create account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Box sx={{ mb: 2.75, textAlign: "center" }}>
        <Typography variant="h4" sx={{ color: "#38291F", fontFamily: '"DM Serif Display", Georgia, serif', fontSize: { xs: "1.65rem", sm: "1.85rem" }, fontWeight: 400, letterSpacing: "-0.05em", lineHeight: 1.06 }}>
          <Box component="span" sx={{ color: "#5F725D" }}>Create your account</Box>
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2, "& .MuiAlert-message": { fontSize: "0.85rem", fontWeight: 600 } }}>{error}</Alert>}

      <Box component="form" noValidate onSubmit={handleSubmit}>
        <Box sx={{ display: "flex", gap: 1.5, mb: 2.5 }}>
          <TextField name="first_name" placeholder="First name" value={values.first_name} onChange={handleChange} fullWidth required slotProps={{ input: { startAdornment: <InputAdornment position="start"><PersonIcon sx={iconSx} /></InputAdornment> } }} />
          <TextField name="last_name" placeholder="Last name" value={values.last_name} onChange={handleChange} fullWidth required slotProps={{ input: { startAdornment: <InputAdornment position="start"><PersonIcon sx={iconSx} /></InputAdornment> } }} />
        </Box>

        <TextField id="reg-email" name="email" type="email" placeholder="you@company.com" value={values.email} onChange={handleChange} fullWidth required sx={{ mb: 2.5 }} slotProps={{ input: { startAdornment: <InputAdornment position="start"><EmailIcon sx={iconSx} /></InputAdornment> } }} />

        <TextField
          id="reg-password"
          name="password"
          type={showPassword ? "text" : "password"}
          placeholder="Create a strong password"
          value={values.password}
          onChange={handleChange}
          fullWidth
          required
          sx={{ mb: 2 }}
          slotProps={{
            input: {
              startAdornment: <InputAdornment position="start"><LockIcon sx={iconSx} /></InputAdornment>,
              endAdornment: <InputAdornment position="end"><Box aria-label={showPassword ? "Hide password" : "Show password"} component="button" type="button" onClick={() => setShowPassword((visible) => !visible)} sx={{ alignItems: "center", bgcolor: "transparent", border: 0, color: "#A59480", cursor: "pointer", display: "flex", p: 0.5, "&:hover": { color: "#554437" } }}>{showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}</Box></InputAdornment>,
            },
          }}
        />

        <FormControlLabel
          sx={{ alignItems: "flex-start", mb: 2.5 }}
          control={<Checkbox checked={agreed} onChange={(event) => setAgreed(event.target.checked)} size="small" sx={{ color: "#C7B9A5", "&.Mui-checked": { color: "#5F725D" } }} />}
          label={<Typography sx={{ color: "#756555", fontSize: "0.82rem", fontWeight: 500, lineHeight: 1.5 }}>I agree to the <Box component="span" sx={{ color: "#5F725D", cursor: "pointer", fontWeight: 700 }}>Terms of Service</Box> and <Box component="span" sx={{ color: "#5F725D", cursor: "pointer", fontWeight: 700 }}>Privacy Policy</Box></Typography>}
        />

        <Button
          type="submit"
          variant="contained"
          fullWidth
          size="large"
          disabled={loading || !formFilled}
          sx={{
            bgcolor: "#49362A", borderRadius: "8px", boxShadow: "0 4px 12px rgba(73,54,42,0.16)", color: "#FFFDF8", fontSize: "0.95rem", fontWeight: 700, py: 1.5,
            transition: "transform 160ms cubic-bezier(0.23, 1, 0.32, 1), box-shadow 160ms cubic-bezier(0.23, 1, 0.32, 1), background-color 160ms cubic-bezier(0.23, 1, 0.32, 1)",
            "&:hover": { bgcolor: "#35251C", boxShadow: "0 8px 22px rgba(73,54,42,0.22)", transform: "translateY(-1px)" }, "&:active": { transform: "scale(0.98)" }, "&.Mui-disabled": { bgcolor: "#49362A", color: "#FFFDF8", opacity: 0.6 },
          }}
        >
          {loading ? <Box sx={{ alignItems: "center", display: "flex", gap: 1.5 }}><CircularProgress size={18} sx={{ color: "#FFFDF8" }} />Creating account...</Box> : "Create account"}
        </Button>
      </Box>

      <Box sx={{ alignItems: "center", display: "flex", gap: 1.5, my: 3 }}>
        <Divider sx={{ borderColor: "#E4D9C9", flex: 1 }} />
        <Typography sx={{ color: "#A59480", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", whiteSpace: "nowrap" }}>Or continue with</Typography>
        <Divider sx={{ borderColor: "#E4D9C9", flex: 1 }} />
      </Box>

      <Button variant="outlined" fullWidth size="large" startIcon={<GoogleIcon sx={{ fontSize: 20 }} />} sx={{ bgcolor: "rgba(255,253,248,0.65)", borderColor: "#D7C9B6", borderRadius: "8px", color: "#554437", fontSize: "0.9rem", fontWeight: 700, gap: 1.5, justifyContent: "center", py: 1.3, "&:hover": { bgcolor: "#FFFDF8", borderColor: "#9A876E" } }}>
        Continue with Google
      </Button>

      <Typography sx={{ color: "#756555", fontSize: "0.85rem", mt: 3.5, textAlign: "center" }}>
        Already have an account? {" "}<Link component={RouterLink} to="/login" underline="hover" sx={{ color: "#5F725D", fontWeight: 700 }}>Sign in</Link>
      </Typography>
    </Box>
  );
}
