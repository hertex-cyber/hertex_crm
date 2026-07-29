import { useState } from "react";
import { Outlet } from "react-router-dom";
import Box from "@mui/material/Box";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

const SIDEBAR_WIDTH = 240;

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <Box sx={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <TopBar onToggle={() => setSidebarOpen(!sidebarOpen)} />
      <Box sx={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <Sidebar open={sidebarOpen} width={SIDEBAR_WIDTH} />
        <Box component="main" sx={{ flex: 1, overflow: "auto", px: 6, py: 5 }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
