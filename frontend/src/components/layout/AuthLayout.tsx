import { Outlet, Navigate } from "react-router-dom";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import CheckIcon from "@mui/icons-material/Check";
import { useAuthStore } from "@store/authStore";

const lightTheme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#F97316", light: "#FDBA74", dark: "#EA580C" },
    text: { primary: "#111827", secondary: "#6B7280" },
    background: { default: "#FFFFFF", paper: "#FFFFFF" },
    divider: "#E5E7EB",
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontFamily: '"DM Sans", "Inter", sans-serif', fontWeight: 700, letterSpacing: "-0.03em" },
    h2: { fontFamily: '"DM Sans", "Inter", sans-serif', fontWeight: 700, letterSpacing: "-0.025em" },
    h3: { fontFamily: '"DM Sans", "Inter", sans-serif', fontWeight: 700, letterSpacing: "-0.02em" },
    h4: { fontFamily: '"DM Sans", "Inter", sans-serif', fontWeight: 700, letterSpacing: "-0.02em" },
    h5: { fontFamily: '"DM Sans", "Inter", sans-serif', fontWeight: 700, letterSpacing: "-0.01em" },
    h6: { fontFamily: '"DM Sans", "Inter", sans-serif', fontWeight: 600 },
  },
  shape: { borderRadius: 10 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { textTransform: "none", fontWeight: 600, borderRadius: 8, fontSize: "0.9rem" },
        contained: { boxShadow: "none", "&:hover": { boxShadow: "none" } },
        outlined: { borderColor: "#E5E7EB" },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            borderRadius: 6,
            backgroundColor: "#FFFFFF",
            "&:hover": { backgroundColor: "#FFFFFF" },
            "&.Mui-focused": { backgroundColor: "#FFFFFF" },
          },
          "& .MuiInputLabel-root": { color: "#6B7280" },
          "& .MuiOutlinedInput-notchedOutline": { borderColor: "#E5E7EB" },
          "& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: "#D1D5DB",
          },
          "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: "#F97316",
            borderWidth: 2,
          },
        },
      },
    },
    MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
    MuiCheckbox: { styleOverrides: { root: { "&.Mui-checked": { color: "#F97316" } } } },
    MuiLink: { styleOverrides: { root: { color: "#EA580C" } } },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 10 },
      },
    },
    MuiDivider: { styleOverrides: { root: { borderColor: "#E5E7EB" } } },
    MuiFormHelperText: { styleOverrides: { root: { color: "#9CA3AF" } } },
  },
});

const highlights = [
  {
    title: "Streamlined sales pipeline",
    desc: "Track every deal from first touch to close in a single view.",
  },
  {
    title: "AI-powered insights",
    desc: "Let automation surface the next best action for your team.",
  },
  {
    title: "Everything in one place",
    desc: "Contacts, opportunities, and activity, unified across your org.",
  },
];

export function AuthLayout() {
  const isAuthenticated = useAuthStore((s) => !!s.accessToken);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <ThemeProvider theme={lightTheme}>
      <Box
        sx={{
          minHeight: "100dvh",
          display: "flex",
          background: `
            radial-gradient(ellipse 80% 60% at 0% 0%, rgba(234,88,12,0.06) 0%, transparent 60%),
            radial-gradient(ellipse 60% 50% at 100% 100%, rgba(251,146,60,0.05) 0%, transparent 55%),
            #FFF9F5
          `,
        }}
      >
        <Box
          sx={{
            flex: "1 1 50%",
            display: { xs: "none", md: "flex" },
            flexDirection: "column",
            justifyContent: "center",
            gap: { md: 5, lg: 6 },
            p: { md: 5, lg: 8 },
            position: "relative",
            overflow: "hidden",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Box component="img" src="/business-person.svg" alt="hertex cultivate" sx={{ width: 36, height: 36 }} />
            <Typography
              sx={{
                fontSize: "1.15rem",
                fontWeight: 700,
                fontFamily: '"DM Sans", "Inter", sans-serif',
                color: "#111827",
                letterSpacing: "-0.02em",
                textTransform: "uppercase",
              }}
            >
              hertex cultivate
            </Typography>
          </Box>

          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: { md: 4, lg: 5 },
            }}
          >
            <Box sx={{ maxWidth: 440 }}>
              <Typography
                sx={{
                  fontSize: { md: "2.4rem", lg: "2.8rem" },
                  fontWeight: 700,
                  fontFamily: '"DM Sans", "Inter", sans-serif',
                  color: "#111827",
                  lineHeight: 1.12,
                  letterSpacing: "-0.035em",
                  mb: 2.5,
                }}
              >
                Your business,
                <br />
                <Box component="span" sx={{ color: "#F97316" }}>
                  intelligently
                </Box>{" "}
                organized.
              </Typography>
              <Typography
                sx={{
                  color: "#6B7280",
                  fontSize: "1rem",
                  lineHeight: 1.7,
                }}
              >
                hertex cultivate brings together your sales, marketing, and customer data in one
                beautiful platform.
              </Typography>
            </Box>

            <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {highlights.map((h) => (
                <Box key={h.title} sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
                  <Box
                    sx={{
                      width: 24,
                      height: 24,
                      mt: 0.2,
                      borderRadius: "50%",
                      bgcolor: "#F97316",
                      color: "#FFFFFF",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    <CheckIcon sx={{ fontSize: 14 }} />
                  </Box>
                  <Box>
                  <Typography
                    sx={{
                      fontSize: "0.95rem",
                      fontWeight: 600,
                      fontFamily: '"DM Sans", "Inter", sans-serif',
                      color: "#111827",
                      mb: 0.25,
                    }}
                  >
                    {h.title}
                  </Typography>
                  <Typography sx={{ fontSize: "0.85rem", color: "#6B7280", lineHeight: 1.5 }}>
                    {h.desc}
                  </Typography>
                </Box>
              </Box>
            ))}
            </Box>
          </Box>
        </Box>

          <Box
            sx={{
              flex: "1 1 50%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              px: { xs: 2, sm: 4 },
              py: { xs: 4, sm: 6 },
            }}
          >
          <Box
            sx={{
              width: "100%",
              maxWidth: 420,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <Box
              sx={{
                display: { xs: "flex", md: "none" },
                alignItems: "center",
                gap: 1.5,
                mb: 4,
              }}
            >
              <Box component="img" src="/business-person.svg" alt="hertex cultivate" sx={{ width: 36, height: 36 }} />
              <Typography
                sx={{
                  fontSize: "1.15rem",
                  fontWeight: 700,
                  fontFamily: '"DM Sans", "Inter", sans-serif',
                  color: "#111827",
                  letterSpacing: "-0.02em",
                  textTransform: "uppercase",
                }}
              >
                hertex cultivate
              </Typography>
            </Box>

            <Box
              sx={{
                width: "100%",
                bgcolor: "#FFFFFF",
                borderRadius: 2,
                p: { xs: 3, sm: 4 },
                border: "1px solid #E5E7EB",
                boxShadow: "0 1px 2px rgba(16,24,40,0.04)",
              }}
            >
              <Outlet />
            </Box>
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  );
}
