import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#1976D2", light: "#42A5F5", dark: "#0D47A1" },
    secondary: { main: "#7B1FA2", light: "#BA68C8", dark: "#4A148C" },
    success: { main: "#2E7D32", light: "#4CAF50", dark: "#1B5E20" },
    warning: { main: "#ED6C02", light: "#FF9800", dark: "#E65100" },
    error: { main: "#D32F2F", light: "#EF5350", dark: "#C62828" },
    info: { main: "#0288D1", light: "#03A9F4", dark: "#01579B" },
    background: { default: "#FAFAFA", paper: "#FFFFFF" },
    text: { primary: "#212121", secondary: "#757575", disabled: "#9E9E9E" },
    divider: "#E0E0E0",
  },
  typography: {
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    h4: { fontSize: "1.5rem", fontWeight: 700, lineHeight: 1.35, letterSpacing: "-0.01em" },
    h5: { fontSize: "1.125rem", fontWeight: 600, lineHeight: 1.4 },
    h6: { fontSize: "1rem", fontWeight: 600, lineHeight: 1.5 },
    body1: { fontSize: "1rem", lineHeight: 1.5 },
    body2: { fontSize: "0.875rem", lineHeight: 1.5 },
    caption: { fontSize: "0.75rem", lineHeight: 1.5 },
  },
  shape: { borderRadius: 8 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { textTransform: "none", fontWeight: 600, borderRadius: 8 },
        sizeLarge: { padding: "12px 24px", fontSize: "1rem" },
        sizeMedium: { padding: "8px 20px", fontSize: "0.875rem" },
        sizeSmall: { padding: "6px 16px", fontSize: "0.8125rem" },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: "0px 1px 2px rgba(0,0,0,0.06), 0px 1px 3px rgba(0,0,0,0.1)",
          backgroundImage: "none",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: "none" },
      },
    },
    MuiTable: {
      styleOverrides: {
        root: {
          "& .MuiTableCell-root": {
            padding: "12px 16px",
            fontSize: "0.875rem",
            borderBottom: "1px solid #EEEEEE",
          },
          "& .MuiTableCell-head": {
            fontWeight: 600,
            fontSize: "0.75rem",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: "#757575",
            backgroundColor: "#FAFAFA",
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            borderRadius: 8,
            backgroundColor: "#FFF",
            "&:hover": { backgroundColor: "#FFF" },
            "&.Mui-focused": { backgroundColor: "#FFF" },
          },
          "& .MuiInputLabel-root": { color: "#757575" },
          "& .MuiOutlinedInput-notchedOutline": { borderColor: "#E0E0E0" },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 6, fontWeight: 500 },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { borderRadius: 6, fontSize: "0.75rem", padding: "6px 10px" },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: { borderRight: "none" },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: { boxShadow: "0px 1px 0px #E0E0E0" },
      },
    },
  },
});
