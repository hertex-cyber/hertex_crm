import { Outlet, Navigate } from "react-router-dom";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useAuthStore } from "@store/authStore";

const lightTheme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#7C5CFC", light: "#9B7FFD", dark: "#5A3FD6" },
    text: { primary: "#1A1A2E", secondary: "#6B7280" },
    background: { default: "#F8F9FC", paper: "#FFFFFF" },
    divider: "rgba(0,0,0,0.06)",
  },
  typography: { fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif' },
  shape: { borderRadius: 12 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { textTransform: "none", fontWeight: 600, borderRadius: 10, fontSize: "0.9rem" },
        contained: { boxShadow: "none", "&:hover": { boxShadow: "none" } },
        outlined: { borderColor: "rgba(0,0,0,0.1)" },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            borderRadius: 10,
            backgroundColor: "#F9FAFB",
            "&:hover": { backgroundColor: "#FFF" },
            "&.Mui-focused": { backgroundColor: "#FFF" },
          },
        },
      },
    },
    MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
    MuiCheckbox: { styleOverrides: { root: { "&.Mui-checked": { color: "#7C5CFC" } } } },
    MuiLink: { styleOverrides: { root: { color: "#7C5CFC" } } },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 10 },
        standardError: { backgroundColor: "#FEF2F2", color: "#991B1B" },
      },
    },
    MuiDivider: { styleOverrides: { root: { borderColor: "rgba(0,0,0,0.08)" } } },
    MuiFormHelperText: { styleOverrides: { root: { color: "#9CA3AF" } } },
  },
});

export function AuthLayout() {
  const isAuthenticated = useAuthStore((s) => !!s.accessToken);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <ThemeProvider theme={lightTheme}>
      <Box
        sx={{
          display: "flex",
          minHeight: "100vh",
          bgcolor: "#FAFAFA",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <style>{`
          @keyframes float-slow {
            0%, 100% { transform: translate(0, 0) scale(1); }
            33% { transform: translate(15px, -15px) scale(1.02); }
            66% { transform: translate(-10px, 10px) scale(0.98); }
          }
          @keyframes slideInLeft {
            from { opacity: 0; transform: translateX(-60px); }
            to { opacity: 1; transform: translateX(0); }
          }
          @keyframes slideInRight {
            from { opacity: 0; transform: translateX(60px); }
            to { opacity: 1; transform: translateX(0); }
          }
        `}</style>

        <Box
          sx={{
            position: "absolute",
            inset: 0,
            background: `
              radial-gradient(ellipse 70% 50% at 0% 20%, rgba(124,92,252,0.06) 0%, transparent 60%),
              radial-gradient(ellipse 50% 60% at 100% 80%, rgba(236,72,153,0.04) 0%, transparent 60%),
              radial-gradient(ellipse 60% 40% at 50% 50%, rgba(6,182,212,0.03) 0%, transparent 50%)
            `,
          }}
        />

        <Box
          sx={{
            position: "absolute",
            top: "5%",
            left: "3%",
            width: 180,
            height: 180,
            borderRadius: "40% 60% 70% 30% / 40% 50% 60% 50%",
            background: "linear-gradient(135deg, rgba(124,92,252,0.08), rgba(236,72,153,0.05))",
            animation: "float-slow 12s ease-in-out infinite",
          }}
        />
        <Box
          sx={{
            position: "absolute",
            bottom: "8%",
            right: "5%",
            width: 220,
            height: 220,
            borderRadius: "60% 40% 30% 70% / 60% 30% 70% 40%",
            background: "linear-gradient(135deg, rgba(6,182,212,0.06), rgba(124,92,252,0.04))",
            animation: "float-slow 15s ease-in-out infinite reverse",
          }}
        />
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            right: "15%",
            width: 100,
            height: 100,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(251,191,36,0.06) 0%, transparent 70%)",
            animation: "float-slow 10s ease-in-out infinite",
          }}
        />

        <Box
          sx={{
            position: "absolute",
            inset: 0,
            backgroundImage: `
              linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)
            `,
            backgroundSize: "60px 60px",
          }}
        />

        <Box
          sx={{
            display: "flex",
            width: "100%",
            position: "relative",
            zIndex: 1,
          }}
        >
          <Box
            sx={{
              flex: 1,
              display: { xs: "none", lg: "flex" },
              flexDirection: "column",
              justifyContent: "center",
              px: 12,
              py: 6,
              animation: "slideInLeft 0.7s ease-out",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 4 }}>
              <Box
                component="img"
                src="/tzaho.png"
                alt="TZAHU CRM"
                sx={{ width: 44, height: 44 }}
              />
              <Typography
                sx={{
                  fontSize: "1.4rem",
                  fontWeight: 800,
                  color: "#1A1A2E",
                  letterSpacing: "0.3px",
                }}
              >
                TZAHU CRM
              </Typography>
            </Box>

            <Box sx={{ maxWidth: 500 }}>
              <Typography
                sx={{
                  fontSize: "2.8rem",
                  fontWeight: 800,
                  color: "#1A1A2E",
                  lineHeight: 1.15,
                  letterSpacing: "-1.5px",
                  mb: 1.5,
                }}
              >
                Your business,
              </Typography>
              <Typography
                sx={{
                  fontSize: "2.8rem",
                  fontWeight: 800,
                  lineHeight: 1.15,
                  letterSpacing: "-1.5px",
                  mb: 3,
                  background: "linear-gradient(135deg, #7C5CFC, #EC4899)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                intelligently organized.
              </Typography>

              <Typography
                sx={{
                  color: "#6B7280",
                  fontSize: "1rem",
                  lineHeight: 1.7,
                  mb: 5,
                }}
              >
                    TZAHU CRM brings together your sales, marketing, and customer data in one beautiful platform.
              </Typography>
            </Box>

            <Box sx={{ display: "flex", gap: 4 }}>
              {[
                { value: "10x", label: "Faster pipeline" },
                { value: "99.9%", label: "Uptime SLA" },
                { value: "50+", label: "Integrations" },
              ].map((stat) => (
                <Box key={stat.label}>
                  <Typography
                    sx={{
                      fontSize: "1.5rem",
                      fontWeight: 700,
                      color: "#7C5CFC",
                      lineHeight: 1.2,
                    }}
                  >
                    {stat.value}
                  </Typography>
                  <Typography sx={{ color: "#9CA3AF", fontSize: "0.8rem", mt: 0.5 }}>
                    {stat.label}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>

          <Box
            sx={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              px: 4,
              py: 6,
              animation: "slideInRight 0.7s ease-out 0.15s both",
            }}
          >
            <Box
              sx={{
                display: { xs: "flex", lg: "none" },
                flexDirection: "column",
                alignItems: "center",
                mb: 4,
              }}
            >
              <Box
                component="img"
                src="/tzaho.png"
                alt="TZAHU CRM"
                sx={{ width: 40, height: 40, mb: 1 }}
              />
              <Typography sx={{ fontSize: "1.2rem", fontWeight: 700, color: "#1A1A2E" }}>
                TZAHU CRM
              </Typography>
            </Box>

            <Box
              sx={{
                width: "100%",
                maxWidth: 420,
                bgcolor: "#FFF",
                borderRadius: 3,
                p: 4,
                boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)",
                border: "1px solid rgba(0,0,0,0.04)",
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
