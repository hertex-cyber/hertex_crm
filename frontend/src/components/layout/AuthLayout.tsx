import { Outlet, Navigate } from "react-router-dom";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import CheckIcon from "@mui/icons-material/Check";
import { useAuthStore } from "@store/authStore";
import Background from "./Background";

const lightTheme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#49362A", light: "#C9BBA4", dark: "#302017" },
    text: { primary: "#38291F", secondary: "#756555" },
    background: { default: "#F8F4EC", paper: "#FFFDF8" },
    divider: "#E4D9C9",
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontFamily: '"DM Serif Display", Georgia, serif', fontWeight: 400, letterSpacing: "-0.04em" },
    h2: { fontFamily: '"DM Serif Display", Georgia, serif', fontWeight: 400, letterSpacing: "-0.035em" },
    h3: { fontFamily: '"DM Serif Display", Georgia, serif', fontWeight: 400, letterSpacing: "-0.03em" },
    h4: { fontFamily: '"DM Serif Display", Georgia, serif', fontWeight: 400, letterSpacing: "-0.025em" },
    h5: { fontFamily: '"DM Serif Display", Georgia, serif', fontWeight: 400, letterSpacing: "-0.02em" },
    h6: { fontFamily: '"DM Sans", "Inter", sans-serif', fontWeight: 600 },
  },
  shape: { borderRadius: 10 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { textTransform: "none", fontWeight: 600, borderRadius: 8, fontSize: "0.9rem" },
        contained: { boxShadow: "none", "&:hover": { boxShadow: "none" } },
        outlined: { borderColor: "#DED2C0" },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            borderRadius: 8,
            backgroundColor: "rgba(255,253,248,0.9)",
            "&:hover": { backgroundColor: "#FFFDF8" },
            "&.Mui-focused": { backgroundColor: "#FFFDF8" },
          },
          "& .MuiInputLabel-root": { color: "#756555" },
          "& .MuiOutlinedInput-notchedOutline": { borderColor: "#DED2C0" },
          "& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: "#BBAA93",
          },
          "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: "#5F725D",
            borderWidth: 2,
          },
        },
      },
    },
    MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
    MuiCheckbox: { styleOverrides: { root: { "&.Mui-checked": { color: "#5F725D" } } } },
    MuiLink: { styleOverrides: { root: { color: "#5F725D" } } },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 10 },
      },
    },
    MuiDivider: { styleOverrides: { root: { borderColor: "#E4D9C9" } } },
    MuiFormHelperText: { styleOverrides: { root: { color: "#9B8B7A" } } },
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
          position: "relative",
          overflow: "hidden",
        }}
      >
        <Background />
        <Box
          sx={{
            flex: "1 1 50%",
            display: { xs: "none", md: "flex" },
            flexDirection: "column",
            justifyContent: "center",
            gap: { md: 5, lg: 6 },
            p: { md: 5, lg: 8 },
            position: "relative",
            zIndex: 1,
            overflow: "hidden",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, position: "relative" }}>
            <Box component="img" src="/business-person.svg" alt="hertex cultivate" sx={{ width: 36, height: 36 }} />
            <Typography
              sx={{
                fontSize: "1.05rem",
                fontWeight: 700,
                fontFamily: '"DM Serif Display", Georgia, serif',
                color: "#38291F",
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
                  fontSize: { md: "2.35rem", lg: "2.85rem" },
                  fontWeight: 500,
                  fontFamily: '"DM Serif Display", Georgia, serif',
                  color: "#38291F",
                  lineHeight: 1.05,
                  letterSpacing: "-0.045em",
                  mb: 2.5,
                }}
              >
                Grow with a clearer
                <br />
                <Box component="span" sx={{ color: "#5F725D" }}>point of view.</Box>
              </Typography>
              <Typography
                sx={{
                  color: "#756555",
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
                      bgcolor: "#5F725D",
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
                      fontFamily: '"DM Serif Display", Georgia, serif',
                      color: "#38291F",
                      mb: 0.25,
                    }}
                  >
                    {h.title}
                  </Typography>
                  <Typography sx={{ fontSize: "0.85rem", color: "#756555", lineHeight: 1.5 }}>
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
              position: "relative",
              zIndex: 1,
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
                  fontSize: "1.05rem",
                  fontWeight: 700,
                  fontFamily: '"DM Sans", "Inter", sans-serif',
                color: "#38291F",
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
                bgcolor: "rgba(255,253,248,0.78)",
                backdropFilter: "blur(18px)",
                borderRadius: 3,
                p: { xs: 3, sm: 4 },
                border: "1px solid rgba(127, 101, 76, 0.18)",
                boxShadow: "0 24px 64px rgba(73, 54, 42, 0.10), 0 2px 8px rgba(73, 54, 42, 0.04)",
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
