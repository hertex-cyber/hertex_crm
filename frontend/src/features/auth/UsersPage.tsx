import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Avatar from "@mui/material/Avatar";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import Button from "@mui/material/Button";
import SearchIcon from "@mui/icons-material/Search";
import AddIcon from "@mui/icons-material/Add";
import api from "@services/api";
import { useAuthStore } from "@store/authStore";
import type { User } from "@store/authStore";

const statusConfig: Record<string, { color: string; bg: string }> = {
  ACTIVE: { color: "#4CAF50", bg: "rgba(76, 175, 80, 0.1)" },
  PENDING_VERIFICATION: { color: "#FF9800", bg: "rgba(255, 152, 0, 0.1)" },
  LOCKED: { color: "#EF5350", bg: "rgba(239, 83, 80, 0.1)" },
  DISABLED: { color: "#9E9E9E", bg: "rgba(158, 158, 158, 0.1)" },
};

export function UsersPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const currentOrg = useAuthStore((s) => s.currentOrganization);

  useEffect(() => {
    const params = currentOrg ? { org_id: currentOrg.id } : {};
    api.get("/auth/users/", { params })
      .then(({ data }) => setUsers(data.data || data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [currentOrg]);

  const filtered = users.filter((u) =>
    `${u.first_name} ${u.last_name} ${u.email}`.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", pt: 12 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ color: "text.primary", mb: 0.5 }}>
            Users
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {filtered.length} user{filtered.length !== 1 ? "s" : ""} total
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1.5 }}>
          <TextField
            placeholder="Search users..."
            size="small"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ minWidth: 260 }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ fontSize: 18, color: "text.disabled" }} />
                  </InputAdornment>
                ),
              },
            }}
          />
          <Button
            variant="contained"
            startIcon={<AddIcon />}
          >
            Add User
          </Button>
        </Box>
      </Box>

      <TableContainer
        component={Paper}
        sx={{ border: 1, borderColor: "divider" }}
      >
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>User</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Timezone</TableCell>
              <TableCell>Joined</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((user) => {
              const status = statusConfig[user.status] || { color: "#9E9E9E", bg: "rgba(158, 158, 158, 0.1)" };
              return (
                <TableRow
                  key={user.id}
                  hover
                  sx={{
                    cursor: "pointer",
                    "&:hover": { bgcolor: "action.hover" },
                    "&:last-child td": { border: 0 },
                  }}
                  onClick={() => navigate(`/users/${user.id}`)}
                >
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                      <Avatar
                        sx={{
                          width: 32,
                          height: 32,
                          bgcolor: "primary.main",
                          color: "#fff",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                        }}
                      >
                        {user.first_name.charAt(0)}{user.last_name.charAt(0)}
                      </Avatar>
                      <Typography variant="body2" sx={{ color: "text.primary", fontWeight: 500 }}>
                        {user.first_name} {user.last_name}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ color: "text.secondary" }}>{user.email}</TableCell>
                  <TableCell>
                    <Chip
                      label={user.status}
                      size="small"
                      sx={{
                        bgcolor: status.bg,
                        color: status.color,
                        fontWeight: 600,
                        fontSize: "0.7rem",
                        borderRadius: 1.5,
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ color: "text.secondary" }}>{user.timezone}</TableCell>
                  <TableCell sx={{ color: "text.disabled" }}>
                    {new Date(user.created_at).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 8 }}>
                  <Typography sx={{ color: "text.disabled" }}>No users found matching your search.</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

export function UserDetailPage() {
  return (
    <Box>
      <Typography variant="h4" sx={{ color: "text.primary", mb: 3 }}>
        User Details
      </Typography>
      <Paper sx={{ p: 4, textAlign: "center" }}>
        <Typography sx={{ color: "text.disabled" }}>
          Select a user from the list to view details.
        </Typography>
      </Paper>
    </Box>
  );
}
