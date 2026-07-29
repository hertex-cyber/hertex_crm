import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import Box from "@mui/material/Box";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import DashboardIcon from "@mui/icons-material/Dashboard";
import PeopleIcon from "@mui/icons-material/People";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import BusinessIcon from "@mui/icons-material/Business";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import InventoryIcon from "@mui/icons-material/Inventory";
import DescriptionIcon from "@mui/icons-material/Description";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import ReceiptIcon from "@mui/icons-material/Receipt";
import AssignmentIcon from "@mui/icons-material/Assignment";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import SupportAgentIcon from "@mui/icons-material/SupportAgent";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import CampaignIcon from "@mui/icons-material/Campaign";
import FolderIcon from "@mui/icons-material/Folder";
import AssessmentIcon from "@mui/icons-material/Assessment";
import PsychologyIcon from "@mui/icons-material/Psychology";
import RecordVoiceOverIcon from "@mui/icons-material/RecordVoiceOver";
import SecurityIcon from "@mui/icons-material/Security";
import GroupIcon from "@mui/icons-material/Group";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import SettingsIcon from "@mui/icons-material/Settings";
import ExtensionIcon from "@mui/icons-material/Extension";
import NotificationsIcon from "@mui/icons-material/Notifications";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import LogoutIcon from "@mui/icons-material/Logout";
import { useAuthStore } from "@store/authStore";
import { useNavigate } from "react-router-dom";
import { usePermissions } from "@features/rbac/usePermissions";

interface SidebarProps {
  open: boolean;
  width: number;
}

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  permission?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: "Main Menu",
    items: [
      { label: "Dashboard", path: "/dashboard", icon: <DashboardIcon /> },
    ],
  },
  {
    title: "CRM",
    items: [
      { label: "Leads", path: "/leads", icon: <PersonAddIcon /> },
      { label: "Contacts", path: "/contacts", icon: <PeopleIcon /> },
      { label: "Accounts", path: "/accounts", icon: <BusinessIcon /> },
      { label: "Opportunities", path: "/opportunities", icon: <AccountTreeIcon /> },
      { label: "Pipelines", path: "/pipelines", icon: <TrendingUpIcon /> },
    ],
  },
  {
    title: "Sales",
    items: [
      { label: "Products", path: "/products", icon: <InventoryIcon /> },
      { label: "Quotes", path: "/quotes", icon: <DescriptionIcon /> },
      { label: "Orders", path: "/orders", icon: <ShoppingCartIcon /> },
      { label: "Invoices", path: "/invoices", icon: <ReceiptIcon /> },
      { label: "Contracts", path: "/contracts", icon: <AssignmentIcon /> },
    ],
  },
  {
    title: "Operations",
    items: [
      { label: "Tasks", path: "/tasks", icon: <CheckCircleIcon /> },
      { label: "Calendar", path: "/calendar", icon: <CalendarMonthIcon /> },
      { label: "Workflows", path: "/workflows", icon: <AutoAwesomeIcon /> },
      { label: "Approvals", path: "/approvals", icon: <CheckCircleIcon /> },
      { label: "Support Tickets", path: "/tickets", icon: <SupportAgentIcon /> },
      { label: "Knowledge Base", path: "/knowledge-base", icon: <MenuBookIcon /> },
      { label: "Campaigns", path: "/campaigns", icon: <CampaignIcon /> },
      { label: "Documents", path: "/documents", icon: <FolderIcon /> },
    ],
  },
  {
    title: "Intelligence",
    items: [
      { label: "Reports", path: "/reports", icon: <AssessmentIcon /> },
      { label: "AI", path: "/ai", icon: <PsychologyIcon /> },
      { label: "Voice AI", path: "/voice", icon: <RecordVoiceOverIcon /> },
      { label: "Audit Log", path: "/audit", icon: <SecurityIcon /> },
    ],
  },
  {
    title: "Administration",
    items: [
      { label: "Users", path: "/users", icon: <GroupIcon /> },
      { label: "Roles & Permissions", path: "/roles", icon: <AdminPanelSettingsIcon />, permission: "organization.manage" },
      { label: "Organization", path: "/orgs", icon: <BusinessIcon /> },
      { label: "Integrations", path: "/integrations", icon: <ExtensionIcon /> },
      { label: "Settings", path: "/settings", icon: <SettingsIcon /> },
      { label: "Custom Fields", path: "/custom-fields", icon: <ExtensionIcon /> },
      { label: "Notifications", path: "/notifications", icon: <NotificationsIcon /> },
    ],
  },
];

function isActive(path: string, currentPath: string): boolean {
  if (path === "/") return currentPath === "/";
  return currentPath.startsWith(path);
}

function sectionIsActive(section: NavSection, currentPath: string): boolean {
  return section.items.some((item) => isActive(item.path, currentPath));
}

export function Sidebar({ open, width }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const { isLoading: permissionsLoading, hasPermission } = usePermissions();
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    navSections.forEach((s) => {
      initial[s.title] = s.title === "Main Menu" || sectionIsActive(s, location.pathname);
    });
    return initial;
  });

  const toggleSection = (title: string) => {
    setExpanded((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <Box
      sx={{
        width: open ? width : 0,
        overflow: "hidden",
        overflowY: "auto",
        transition: "width 0.2s ease",
        flexShrink: 0,
        bgcolor: "grey.100",
        borderRight: 1,
        borderColor: "divider",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <List sx={{ px: 1.5, flex: 1, pt: 1.5, pb: 2 }}>
        {navSections.map((section, si) => {
          const visibleItems = section.items.filter((item) => !item.permission || (!permissionsLoading && hasPermission(item.permission)));
          if (!visibleItems.length) return null;
          const isMainMenu = section.title === "Main Menu";
          const isSectionExpanded = expanded[section.title] ?? true;

          return (
            <Box key={section.title}>
              {si > 0 && (
                <Divider
                  sx={{
                    my: 1.5,
                    opacity: open ? 1 : 0,
                    transition: "opacity 0.15s",
                  }}
                />
              )}

              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  px: 1.5,
                  py: 0.75,
                  cursor: isMainMenu ? "default" : "pointer",
                  borderRadius: 1,
                  "&:hover": isMainMenu ? {} : { bgcolor: "action.hover" },
                  opacity: open ? 1 : 0,
                  transition: "opacity 0.15s",
                }}
                onClick={() => !isMainMenu && toggleSection(section.title)}
              >
                <Typography
                  sx={{
                    fontSize: "0.65rem",
                    fontWeight: 700,
                    color: "text.disabled",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    userSelect: "none",
                  }}
                >
                  {section.title}
                </Typography>
                {!isMainMenu && (
                  <IconButton
                    size="small"
                    sx={{
                      color: "text.disabled",
                      p: 0.25,
                      "& .MuiSvgIcon-root": { fontSize: "0.9rem" },
                      transform: isSectionExpanded ? "rotate(0deg)" : "rotate(-90deg)",
                      transition: "transform 0.2s",
                    }}
                  >
                    <ExpandMoreIcon />
                  </IconButton>
                )}
              </Box>

              <Collapse in={isMainMenu || isSectionExpanded} timeout={200}>
                {visibleItems.map((item) => {
                  const active = isActive(item.path, location.pathname);
                  return (
                    <ListItemButton
                      key={item.path}
                      component={Link}
                      to={item.path}
                      selected={active}
                      sx={{
                        borderRadius: 1.5,
                        mb: 0.15,
                        py: 0.65,
                        "&.Mui-selected": {
                          bgcolor: (t) => `${t.palette.primary.main}12`,
                          "&:hover": { bgcolor: (t) => `${t.palette.primary.main}18` },
                          "& .MuiListItemIcon-root": { color: "primary.main" },
                          "& .MuiListItemText-primary": { color: "primary.main", fontWeight: 600 },
                        },
                        "&:hover": { bgcolor: "action.hover" },
                      }}
                    >
                      <ListItemIcon
                        sx={{
                          minWidth: 36,
                          color: active ? "primary.main" : "text.disabled",
                          transition: "color 0.15s",
                          "& .MuiSvgIcon-root": { fontSize: "1.15rem" },
                        }}
                      >
                        {item.icon}
                      </ListItemIcon>
                      <ListItemText
                        primary={item.label}
                        sx={{
                          opacity: open ? 1 : 0,
                          transition: "opacity 0.15s",
                          "& .MuiListItemText-primary": {
                            fontSize: "0.8rem",
                            fontWeight: active ? 600 : 500,
                            color: active ? "primary.main" : "text.secondary",
                            whiteSpace: "nowrap",
                          },
                        }}
                      />
                    </ListItemButton>
                  );
                })}
              </Collapse>
            </Box>
          );
        })}

        <Divider
          sx={{
            my: 1.5,
            opacity: open ? 1 : 0,
            transition: "opacity 0.15s",
          }}
        />

        <ListItemButton
          onClick={handleLogout}
          sx={{
            borderRadius: 1.5,
            py: 0.65,
            "&:hover": { bgcolor: (t) => `${t.palette.error.main}8` },
          }}
        >
          <ListItemIcon sx={{ minWidth: 36, color: "text.disabled" }}>
            <LogoutIcon sx={{ fontSize: "1.15rem" }} />
          </ListItemIcon>
          <ListItemText
            primary="Logout"
            sx={{
              opacity: open ? 1 : 0,
              transition: "opacity 0.15s",
              "& .MuiListItemText-primary": { fontSize: "0.8rem", color: "text.secondary", whiteSpace: "nowrap" },
            }}
          />
        </ListItemButton>
      </List>

      <Box sx={{ px: 2, py: 2, borderTop: 1, borderColor: "divider" }}>
        <Typography
          variant="caption"
          color="text.disabled"
          sx={{
            opacity: open ? 1 : 0,
            transition: "opacity 0.15s",
            display: "block",
            textAlign: "center",
            fontSize: "0.65rem",
            fontWeight: 600,
            letterSpacing: "0.3px",
          }}
        >
          TZAHU CRM v1.0
        </Typography>
      </Box>
    </Box>
  );
}
