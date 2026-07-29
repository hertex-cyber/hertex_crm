import MuiAppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Avatar from "@mui/material/Avatar";
import Badge from "@mui/material/Badge";
import MenuIcon from "@mui/icons-material/Menu";
import NotificationsOutlined from "@mui/icons-material/NotificationsOutlined";
import SearchOutlined from "@mui/icons-material/SearchOutlined";
import { useAuthStore } from "@store/authStore";
import { useNavigate } from "react-router-dom";

interface TopBarProps {
  onToggle: () => void;
}

export function TopBar({ onToggle }: TopBarProps) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const initials = user
    ? `${user.first_name.charAt(0)}${user.last_name.charAt(0)}`.toUpperCase()
    : "?";
  const displayName = user?.display_name || [user?.first_name, user?.last_name].filter(Boolean).join(" ");

  return (
    <MuiAppBar
      position="static"
      sx={{
        zIndex: 1201,
        bgcolor: "grey.50",
        borderBottom: 1,
        borderColor: "divider",
      }}
    >
      <Toolbar sx={{ gap: 1 }}>
        <IconButton edge="start" color="inherit" onClick={onToggle} sx={{ color: "text.secondary" }}>
          <MenuIcon />
        </IconButton>

        <Box
          sx={{ display: "flex", alignItems: "center", gap: 1.5, color: "text.primary", textDecoration: "none", mr: 2, cursor: "pointer" }}
          onClick={() => navigate("/")}
        >
          <Box component="img" src="/tzaho.png" sx={{ width: 28, height: 28 }} />
          <Typography
            sx={{
              fontSize: "1rem",
              fontWeight: 700,
              letterSpacing: "0.3px",
              display: { xs: "none", sm: "block" },
            }}
          >
            TZAHU CRM
          </Typography>
        </Box>

        <Box sx={{ flex: 1 }} />

        <Box
          sx={{
            display: { xs: "none", md: "flex" },
            alignItems: "center",
            gap: 1,
            bgcolor: "grey.100",
            borderRadius: 1.5,
            px: 1.5,
            py: 0.5,
            minWidth: 240,
            border: 1,
            borderColor: "transparent",
            "&:focus-within": { borderColor: "primary.main" },
          }}
        >
          <SearchOutlined sx={{ fontSize: 18, color: "text.disabled" }} />
          <Box
            component="input"
            placeholder="Search anything..."
            sx={{
              border: "none",
              bgcolor: "transparent",
              color: "text.primary",
              outline: "none",
              width: "100%",
              fontSize: "0.85rem",
              py: 0.5,
              "&::placeholder": { color: "text.disabled" },
            }}
          />
          <Typography sx={{ fontSize: "0.7rem", color: "text.disabled", fontWeight: 600, letterSpacing: "0.5px" }}>
            ⌘K
          </Typography>
        </Box>

        <Box sx={{ flex: 1, display: { xs: "block", md: "none" } }} />

        <IconButton sx={{ color: "text.secondary" }}>
          <Badge badgeContent={3} color="error" sx={{ "& .MuiBadge-badge": { fontSize: "0.6rem", minWidth: 16, height: 16 } }}>
            <NotificationsOutlined />
          </Badge>
        </IconButton>

        <Box
          sx={{ display: "flex", alignItems: "center", gap: 1.5, ml: 1, cursor: "pointer", px: 1, py: 0.5, borderRadius: 1.5, "&:hover": { bgcolor: "action.hover" } }}
          onClick={() => navigate("/profile")}
        >
          <Box sx={{ display: { xs: "none", sm: "block" }, textAlign: "right" }}>
            <Typography sx={{ fontSize: "0.8rem", fontWeight: 600, color: "text.primary", lineHeight: 1.2 }}>
              {displayName}
            </Typography>
            <Typography sx={{ fontSize: "0.7rem", color: "text.disabled" }}>
              {user?.email}
            </Typography>
          </Box>
          <Avatar
            src={user?.avatar_url || undefined}
            alt={displayName || "Profile photo"}
            sx={{
              width: 34,
              height: 34,
              bgcolor: "primary.main",
              color: "#fff",
              fontSize: "0.8rem",
              fontWeight: 700,
            }}
          >
            {initials}
          </Avatar>
        </Box>
      </Toolbar>
    </MuiAppBar>
  );
}
