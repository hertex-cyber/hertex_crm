import { useState, useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Chip from "@mui/material/Chip";
import Avatar from "@mui/material/Avatar";
import AvatarGroup from "@mui/material/AvatarGroup";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";
import TrendingUp from "@mui/icons-material/TrendingUp";
import TrendingDown from "@mui/icons-material/TrendingDown";
import PeopleAlt from "@mui/icons-material/PeopleAlt";
import AccountBalanceWallet from "@mui/icons-material/AccountBalanceWallet";
import Handshake from "@mui/icons-material/Handshake";
import ContactMail from "@mui/icons-material/ContactMail";
import MoreHoriz from "@mui/icons-material/MoreHoriz";
import Add from "@mui/icons-material/Add";
import ArrowForward from "@mui/icons-material/ArrowForward";
import CheckCircle from "@mui/icons-material/CheckCircle";
import Schedule from "@mui/icons-material/Schedule";
import WarningAmber from "@mui/icons-material/WarningAmber";
import Speed from "@mui/icons-material/Speed";
import CurrencyExchange from "@mui/icons-material/CurrencyExchange";
import Groups from "@mui/icons-material/Groups";
import RocketLaunch from "@mui/icons-material/RocketLaunch";
import Refresh from "@mui/icons-material/Refresh";
import { useAuthStore } from "@store/authStore";
import {
  AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartTooltip, ResponsiveContainer,
} from "recharts";

const revenueData = [
  { month: "Jan", revenue: 28000, target: 25000 },
  { month: "Feb", revenue: 32000, target: 30000 },
  { month: "Mar", revenue: 29000, target: 35000 },
  { month: "Apr", revenue: 38000, target: 35000 },
  { month: "May", revenue: 42000, target: 40000 },
  { month: "Jun", revenue: 45000, target: 40000 },
  { month: "Jul", revenue: 51000, target: 45000 },
];

const leadsBySource = [
  { source: "Website", count: 420, fill: "#1976D2" },
  { source: "Referral", count: 280, fill: "#42A5F5" },
  { source: "LinkedIn", count: 190, fill: "#7B1FA2" },
  { source: "Email", count: 150, fill: "#BA68C8" },
  { source: "Events", count: 110, fill: "#2E7D32" },
];

const pipelineData = [
  { name: "Qualified", value: 85, fill: "#1976D2" },
  { name: "Proposal", value: 52, fill: "#42A5F5" },
  { name: "Negotiation", value: 28, fill: "#7B1FA2" },
  { name: "Closed Won", value: 18, fill: "#2E7D32" },
];

const conversionData = [
  { stage: "Lead", rate: 100, fill: "#E3F2FD" },
  { stage: "Contacted", rate: 72, fill: "#BBDEFB" },
  { stage: "Qualified", rate: 48, fill: "#90CAF9" },
  { stage: "Proposal", rate: 31, fill: "#64B5F6" },
  { stage: "Closed", rate: 18, fill: "#1976D2" },
];

const recentActivity = [
  { action: "Deal closed — Acme Corp", user: "Sarah Chen", time: "12 min ago", type: "success", amount: "$24,000" },
  { action: "New lead assigned — John Miller", user: "You", time: "28 min ago", type: "info" },
  { action: "Contract signed — TechFlow Inc", user: "Mike Ross", time: "1 hour ago", type: "success", amount: "$52,000" },
  { action: "Task completed — Q3 Review", user: "You", time: "2 hours ago", type: "success" },
  { action: "Meeting scheduled — Product Demo", user: "Lisa Park", time: "3 hours ago", type: "pending" },
  { action: "Invoice paid — $12,500", user: "Finance", time: "5 hours ago", type: "success" },
];

const upcomingTasks = [
  { task: "Follow up with GlobalTech", priority: "High", due: "Today", assignee: "SC" },
  { task: "Review Q3 pipeline forecast", priority: "High", due: "Today", assignee: "MR" },
  { task: "Prepare board presentation", priority: "Medium", due: "Tomorrow", assignee: "LP" },
  { task: "Update product pricing sheet", priority: "Low", due: "In 3 days", assignee: "AK" },
];

const teamAvatars = [
  { name: "Sarah Chen", initials: "SC", sales: "$124K" },
  { name: "Mike Ross", initials: "MR", sales: "$98K" },
  { name: "Lisa Park", initials: "LP", sales: "$87K" },
  { name: "Alex Kim", initials: "AK", sales: "$76K" },
  { name: "Jordan Lee", initials: "JL", sales: "$52K" },
];

const getScoreColor = (score: number) => {
  if (score >= 80) return "#2E7D32";
  if (score >= 60) return "#ED6C02";
  return "#D32F2F";
};

function CountUp({ value, suffix = "", decimals = 0 }: { value: number; suffix?: string; decimals?: number }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<number | null>(null);

  useEffect(() => {
    const start = performance.now();
    const duration = 1200;
    const from = 0;
    const to = value;

    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (progress < 1) ref.current = requestAnimationFrame(animate);
    };

    ref.current = requestAnimationFrame(animate);
    return () => { if (ref.current) cancelAnimationFrame(ref.current); };
  }, [value]);

  return <>{display.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}</>;
}

const cardHover = {
  transition: "transform 0.25s ease, box-shadow 0.25s ease",
  "&:hover": {
    transform: "translateY(-3px)",
    boxShadow: "0 8px 25px rgba(0,0,0,0.1)",
  },
};

const fadeInUp = {
  "@keyframes fadeInUp": {
    "0%": { opacity: 0, transform: "translateY(20px)" },
    "100%": { opacity: 1, transform: "translateY(0)" },
  },
};

const pulse = {
  "@keyframes pulse": {
    "0%, 100%": { opacity: 1 },
    "50%": { opacity: 0.4 },
  },
};

const shimmer = {
  "@keyframes shimmer": {
    "0%": { backgroundPosition: "-200% 0" },
    "100%": { backgroundPosition: "200% 0" },
  },
};

function AnimatedBox({ children, delay = 0, sx, ...props }: any) {
  return (
    <Box
      sx={{
        animation: "fadeInUp 0.5s ease forwards",
        animationDelay: `${delay}s`,
        opacity: 0,
        ...fadeInUp,
        ...sx,
      }}
      {...props}
    >
      {children}
    </Box>
  );
}

function StatCard({ icon, value, label, trend, trendLabel, trendUp, color, delay }: {
  icon: React.ReactNode; value: React.ReactNode; label: string; trend: string; trendLabel: string; trendUp: boolean; color: string; delay: number;
}) {
  return (
    <AnimatedBox delay={delay}>
      <Paper sx={{ p: 2.5, display: "flex", flexDirection: "column", gap: 1.5, height: "100%", position: "relative", overflow: "hidden", ...cardHover,
        "&::after": {
          content: '""', position: "absolute", top: 0, left: 0, right: 0, height: 3,
          bgcolor: color, opacity: 0.6,
        },
      }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Box sx={{ width: 40, height: 40, borderRadius: 2, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: `${color}12`, color, transition: "transform 0.2s", "&:hover": { transform: "scale(1.1)" } }}>
            {icon}
          </Box>
          <Tooltip title="View details">
            <IconButton size="small" sx={{ color: "text.disabled", opacity: 0.5, "&:hover": { opacity: 1, color } }}>
              <MoreHoriz sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Box>
        <Typography variant="h4" sx={{ color: "text.primary", fontWeight: 700, fontSize: "1.75rem", lineHeight: 1.2 }}>
          {value}
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary", fontWeight: 500 }}>
          {label}
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: "auto" }}>
          <Box sx={(theme) => ({ display: "flex", alignItems: "center", gap: 0.25, px: 0.75, py: 0.25, borderRadius: 1, bgcolor: trendUp ? `${theme.palette.success.light}12` : `${theme.palette.error.light}12` })}>
            {trendUp ? <TrendingUp sx={{ fontSize: 14, color: "success.main" }} /> : <TrendingDown sx={{ fontSize: 14, color: "error.main" }} />}
            <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: trendUp ? "success.main" : "error.main" }}>
              {trend}
            </Typography>
          </Box>
          <Typography sx={{ fontSize: "0.7rem", color: "text.disabled" }}>{trendLabel}</Typography>
        </Box>
      </Paper>
    </AnimatedBox>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <Paper sx={{ px: 2, py: 1.5, border: 1, borderColor: "divider", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
        <Typography sx={{ fontSize: "0.75rem", color: "text.secondary", mb: 0.5 }}>{label}</Typography>
        {payload.map((p: any, i: number) => (
          <Typography key={i} sx={{ fontSize: "0.8rem", fontWeight: 600, color: "text.primary" }}>
            {p.name}: ${p.value.toLocaleString()}
          </Typography>
        ))}
      </Paper>
    );
  }
  return null;
}

const insights = [
  {
    icon: <RocketLaunch sx={{ fontSize: 24 }} />,
    title: "Revenue Surge 🚀",
    message: "Revenue up 22.4% this quarter. You're on track to exceed annual targets by $180K.",
    color: "#2E7D32",
    bgGrad: "linear-gradient(135deg, #E8F5E9, #C8E6C9)",
    border: "#A5D6A7",
    trend: "+$47K",
    trendUp: true,
  },
  {
    icon: <WarningAmber sx={{ fontSize: 24 }} />,
    title: "Lead Conversion Alert ⚠️",
    message: "Lead conversion dropped 5% this week. Consider reviewing your sales qualification process.",
    color: "#ED6C02",
    bgGrad: "linear-gradient(135deg, #FFF3E0, #FFE0B2)",
    border: "#FFB74D",
    trend: "-5%",
    trendUp: false,
  },
  {
    icon: <PeopleAlt sx={{ fontSize: 24 }} />,
    title: "Team Performance 👥",
    message: "Sarah Chen closed $52K deal today. Team on track for record July with $847K closed won.",
    color: "#1976D2",
    bgGrad: "linear-gradient(135deg, #E3F2FD, #BBDEFB)",
    border: "#64B5F6",
    trend: "+$52K",
    trendUp: true,
  },
  {
    icon: <Speed sx={{ fontSize: 24 }} />,
    title: "Pipeline Velocity 📈",
    message: "Avg deal cycle reduced to 45 days (was 52 days). Pipeline value at $2.4M across 183 deals.",
    color: "#7B1FA2",
    bgGrad: "linear-gradient(135deg, #F3E5F5, #E1BEE7)",
    border: "#CE93D8",
    trend: "-7 days",
    trendUp: true,
  },
  {
    icon: <CurrencyExchange sx={{ fontSize: 24 }} />,
    title: "Deal Size Growing 💰",
    message: "Average deal size up to $14.7K from $12.1K last quarter. Enterprise segment growing 34%.",
    color: "#00695C",
    bgGrad: "linear-gradient(135deg, #E0F2F1, #B2DFDB)",
    border: "#4DB6AC",
    trend: "+21%",
    trendUp: true,
  },
  {
    icon: <CheckCircle sx={{ fontSize: 24 }} />,
    title: "Target Progress ✅",
    message: "Q3 target at 68% completion. On track to close 42 deals worth $1.2M by end of quarter.",
    color: "#1565C0",
    bgGrad: "linear-gradient(135deg, #E8EAF6, #C5CAE9)",
    border: "#7986CB",
    trend: "68%",
    trendUp: true,
  },
];

function LiveInsights() {
  const [current, setCurrent] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setCurrent((prev) => (prev + 1) % insights.length);
        setVisible(true);
      }, 400);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  const insight = insights[current];

  return (
    <Paper
      sx={{
        position: "relative",
        overflow: "hidden",
        p: 2.5,
        background: insight.bgGrad,
        border: 1,
        borderColor: insight.border,
        transition: "all 0.4s ease",
        ...cardHover,
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          width: 4,
          height: "100%",
          bgcolor: insight.color,
          borderRadius: "4px 0 0 4px",
        },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 2.5 }}>
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: 2.5,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: `${insight.color}20`,
            color: insight.color,
            flexShrink: 0,
            transition: "transform 0.3s",
            animation: visible ? "insightPop 0.4s ease" : "insightFade 0.3s ease",
          }}
        >
          {insight.icon}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.25 }}>
            <Typography
              variant="body2"
              sx={{
                color: insight.color,
                fontWeight: 700,
                fontSize: "0.85rem",
                opacity: visible ? 1 : 0,
                transform: visible ? "translateY(0)" : "translateY(5px)",
                transition: "all 0.4s ease",
              }}
            >
              {insight.title}
            </Typography>
            <Chip
              label={insight.trend}
              size="small"
              icon={insight.trendUp ? <TrendingUp sx={{ fontSize: 12 }} /> : <TrendingDown sx={{ fontSize: 12 }} />}
              sx={(theme) => ({
                height: 22,
                bgcolor: insight.trendUp ? `${theme.palette.success.light}20` : `${theme.palette.error.light}20`,
                color: insight.trendUp ? "success.dark" : "error.dark",
                fontWeight: 700,
                fontSize: "0.65rem",
                borderRadius: 1,
                opacity: visible ? 1 : 0,
                transition: "opacity 0.4s ease 0.1s",
              })}
            />
          </Box>
          <Typography
            variant="body2"
            sx={{
              color: "text.secondary",
              fontSize: "0.8rem",
              lineHeight: 1.5,
              opacity: visible ? 1 : 0,
              transform: visible ? "translateY(0)" : "translateY(5px)",
              transition: "all 0.4s ease 0.05s",
            }}
          >
            {insight.message}
          </Typography>
        </Box>

        <Box
          sx={{
            display: "flex",
            gap: 0.75,
            flexShrink: 0,
            alignSelf: "center",
          }}
        >
          {insights.map((_, i) => (
            <Box
              key={i}
              sx={{
                width: i === current ? 18 : 8,
                height: 8,
                borderRadius: 4,
                bgcolor: i === current ? insight.color : "#E0E0E0",
                transition: "all 0.4s ease",
                cursor: "pointer",
                "&:hover": { bgcolor: insight.color, opacity: 0.7 },
              }}
              onClick={() => { setVisible(false); setTimeout(() => { setCurrent(i); setVisible(true); }, 400); }}
            />
          ))}
        </Box>
      </Box>

      <Box sx={{ mt: 1.5, display: "flex", alignItems: "center", gap: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {[
            { label: "Revenue", value: "$265K", color: "#2E7D32" },
            { label: "Pipeline", value: "$2.4M", color: "#7B1FA2" },
            { label: "Deals", value: "183", color: "#1976D2" },
            { label: "Win Rate", value: "21%", color: "#ED6C02" },
          ].map((m) => (
            <Box
              key={m.label}
              sx={{
                px: 1.25,
                py: 0.4,
                borderRadius: 1.5,
                bgcolor: `${m.color}10`,
                border: 1,
                borderColor: `${m.color}25`,
                opacity: visible ? 1 : 0,
                transition: "opacity 0.4s ease 0.15s",
              }}
            >
              <Typography sx={{ fontSize: "0.65rem", fontWeight: 700, color: m.color, lineHeight: 1.2 }}>{m.value}</Typography>
              <Typography sx={{ fontSize: "0.55rem", fontWeight: 500, color: "text.disabled", lineHeight: 1.2, mt: 0.15 }}>{m.label}</Typography>
            </Box>
          ))}
        </Box>
        <Box sx={{ ml: "auto", display: "flex", alignItems: "center", gap: 0.5 }}>
          <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "success.main", animation: "pulse 1.5s ease infinite" }} />
          <Typography sx={{ fontSize: "0.6rem", color: "text.disabled", fontWeight: 600 }}>LIVE</Typography>
        </Box>
      </Box>

      <style>{`
        @keyframes insightPop {
          0% { transform: scale(0.8); opacity: 0; }
          60% { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes insightFade {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(0.8); opacity: 0; }
        }
      `}</style>
    </Paper>
  );
}

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const [animate, setAnimate] = useState(false);

  useEffect(() => { setAnimate(true); }, []);

  const today = new Date();
  const dateStr = today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  const totalPipeline = pipelineData.reduce((a, b) => a + b.value, 0);
  const wonRate = Math.round((pipelineData[3].value / pipelineData[0].value) * 100);
  const healthScore = 78;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3, ...fadeInUp, ...pulse, ...shimmer }}>
      {/* Welcome Row */}
      <AnimatedBox delay={0}>
        <Box sx={{ display: "flex", alignItems: { sm: "center" }, justifyContent: "space-between", flexDirection: { xs: "column", sm: "row" }, gap: { xs: 1.5, sm: 0 } }}>
          <Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.25 }}>
              <Typography variant="h4" sx={{ color: "text.primary" }}>
                Welcome back{user ? `, ${user.first_name}` : ""}
              </Typography>
              <Box sx={{ animation: "pulse 2s ease infinite" }}>
                <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "success.main" }} />
              </Box>
            </Box>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>{dateStr}</Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Tooltip title="System is healthy">
              <Chip label="All systems operational" size="small" icon={<CheckCircle sx={{ fontSize: 14 }} />}
                sx={{ bgcolor: (t) => `${t.palette.success.light}15`, color: "success.main", fontWeight: 600, fontSize: "0.75rem", borderRadius: 1.5, border: 1, borderColor: (t) => `${t.palette.success.light}30`, animation: animate ? "none" : undefined }}
              />
            </Tooltip>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Refresh sx={{ fontSize: 16, animation: animate ? "none" : "spin 1s linear" }} />}
              sx={{ borderRadius: 1.5, fontSize: "0.75rem", borderColor: "divider", color: "text.secondary", "&:hover": { borderColor: "primary.main", color: "primary.main" } }}
              onClick={() => window.location.reload()}
            >
              Refresh
            </Button>
            <AvatarGroup max={4} sx={{ "& .MuiAvatar-root": { width: 32, height: 32, fontSize: "0.7rem", border: 2, borderColor: "background.paper", transition: "transform 0.2s", "&:hover": { transform: "scale(1.15)", zIndex: 10 } } }}>
              {teamAvatars.map((a) => (
                <Tooltip key={a.name} title={`${a.name} — ${a.sales}`}>
                  <Avatar sx={{ bgcolor: "primary.main", color: "#fff", fontSize: "0.65rem", fontWeight: 700 }}>{a.initials}</Avatar>
                </Tooltip>
              ))}
            </AvatarGroup>
          </Box>
        </Box>
      </AnimatedBox>

      {/* Rotating Business Insights */}
      <AnimatedBox delay={0.1}>
        <LiveInsights />
      </AnimatedBox>

      {/* Bento Grid - Row 1: Stats */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "1fr 1fr 1fr 1fr" }, gap: 2.5 }}>
        <StatCard icon={<PeopleAlt sx={{ fontSize: 20 }} />} value={<CountUp value={2847} />} label="Total Leads" trend="+18.2%" trendLabel="vs last month" trendUp color="#1976D2" delay={0.15} />
        <StatCard icon={<ContactMail sx={{ fontSize: 20 }} />} value={<CountUp value={1432} />} label="Active Contacts" trend="+12.5%" trendLabel="vs last month" trendUp color="#2E7D32" delay={0.2} />
        <StatCard icon={<CurrencyExchange sx={{ fontSize: 20 }} />} value="$2.4M" label="Pipeline Value" trend="+8.3%" trendLabel="vs last month" trendUp color="#7B1FA2" delay={0.25} />
        <StatCard icon={<AccountBalanceWallet sx={{ fontSize: 20 }} />} value="$847K" label="Closed Won" trend="+22.4%" trendLabel="vs last month" trendUp color="#ED6C02" delay={0.3} />
      </Box>

      {/* Bento Grid - Row 2: Revenue + Pipeline + Health */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "2fr 1fr" }, gap: 2.5 }}>
        <AnimatedBox delay={0.25}>
          <Paper sx={{ p: 2.5, ...cardHover }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
              <Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Typography variant="h6" sx={{ color: "text.primary" }}>Revenue Overview</Typography>
                  <Chip label="+22.4% YoY" size="small" sx={{ bgcolor: (t) => `${t.palette.success.light}15`, color: "success.main", fontWeight: 700, fontSize: "0.65rem", borderRadius: 1 }} />
                </Box>
                <Typography variant="caption" sx={{ color: "text.disabled" }}>Monthly revenue vs target</Typography>
              </Box>
              <Chip label="This year" size="small" variant="outlined" sx={{ borderRadius: 1.5, color: "text.secondary", borderColor: "divider", fontSize: "0.7rem" }} />
            </Box>
            <Box sx={{ display: "flex", gap: 3, mb: 1.5 }}>
              <Box>
                <Typography variant="caption" sx={{ color: "text.disabled", fontSize: "0.65rem", textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.5px" }}>Total Revenue</Typography>
                <Typography variant="h5" sx={{ color: "text.primary", fontWeight: 700 }}>$265,000</Typography>
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: "text.disabled", fontSize: "0.65rem", textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.5px" }}>Avg. Deal Size</Typography>
                <Typography variant="h5" sx={{ color: "text.primary", fontWeight: 700 }}>$14,722</Typography>
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: "text.disabled", fontSize: "0.65rem", textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.5px" }}>Win Rate</Typography>
                <Typography variant="h5" sx={{ color: "success.main", fontWeight: 700 }}>{wonRate}%</Typography>
              </Box>
            </Box>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1976D2" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#1976D2" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9E9E9E" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#9E9E9E" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <RechartTooltip content={<CustomTooltip />} cursor={{ stroke: "#1976D2", strokeWidth: 1, strokeDasharray: "4 4" }} />
                <Area type="monotone" dataKey="revenue" stroke="#1976D2" strokeWidth={2.5} fill="url(#revGrad)" animationDuration={1200} />
                <Area type="monotone" dataKey="target" stroke="#E0E0E0" strokeWidth={1.5} strokeDasharray="6 4" fill="none" dot={false} animationDuration={1200} />
              </AreaChart>
            </ResponsiveContainer>
          </Paper>
        </AnimatedBox>

        <AnimatedBox delay={0.35}>
          <Paper sx={{ p: 2.5, height: "100%", ...cardHover }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
              <Box>
                <Typography variant="h6" sx={{ color: "text.primary" }}>Pipeline Health</Typography>
                <Typography variant="caption" sx={{ color: "text.disabled" }}>{totalPipeline} active deals</Typography>
              </Box>
              <Tooltip title="View full pipeline">
                <IconButton size="small" sx={{ color: "text.disabled", "&:hover": { color: "primary.main" } }}>
                  <ArrowForward sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            </Box>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
              {pipelineData.map((s, idx) => (
                <Box key={s.name}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                    <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 500 }}>{s.name}</Typography>
                    <Typography variant="caption" sx={{ color: "text.primary", fontWeight: 600 }}>{s.value}</Typography>
                  </Box>
                  <Box sx={{ height: 8, bgcolor: "grey.100", borderRadius: 4, overflow: "hidden", position: "relative" }}>
                    <Box sx={{ height: "100%", width: `${(s.value / pipelineData[0].value) * 100}%`, bgcolor: s.fill, borderRadius: 4, transition: "width 1s ease-in-out", animation: animate ? `growWidth 1s ease forwards` : undefined, ...{ "@keyframes growWidth": { "0%": { width: "0%" }, "100%": { width: `${(s.value / pipelineData[0].value) * 100}%` } } } }} />
                  </Box>
                </Box>
              ))}
            </Box>
            <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: "divider", display: "flex", justifyContent: "space-around" }}>
              <Box sx={{ textAlign: "center" }}>
                <Typography variant="h6" sx={{ color: "success.main", fontWeight: 700, lineHeight: 1.2 }}>21%</Typography>
                <Typography variant="caption" sx={{ color: "text.disabled", fontSize: "0.6rem" }}>Win Rate</Typography>
              </Box>
              <Box sx={{ textAlign: "center" }}>
                <Typography variant="h6" sx={{ color: "text.primary", fontWeight: 700, lineHeight: 1.2 }}>45d</Typography>
                <Typography variant="caption" sx={{ color: "text.disabled", fontSize: "0.6rem" }}>Avg Cycle</Typography>
              </Box>
              <Box sx={{ textAlign: "center" }}>
                <Typography variant="h6" sx={{ color: "warning.main", fontWeight: 700, lineHeight: 1.2 }}>8</Typography>
                <Typography variant="caption" sx={{ color: "text.disabled", fontSize: "0.6rem" }}>At Risk</Typography>
              </Box>
            </Box>
          </Paper>
        </AnimatedBox>
      </Box>

      {/* Bento Grid - Row 3: Charts */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr 1fr" }, gap: 2.5 }}>
        <AnimatedBox delay={0.35}>
          <Paper sx={{ p: 2.5, ...cardHover }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
              <Typography variant="h6" sx={{ color: "text.primary" }}>Leads by Source</Typography>
              <Tooltip title="View all sources">
                <IconButton size="small" sx={{ color: "text.disabled", "&:hover": { color: "primary.main" } }}><MoreHoriz sx={{ fontSize: 18 }} /></IconButton>
              </Tooltip>
            </Box>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={leadsBySource} layout="vertical" barCategoryGap={12}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#9E9E9E" }} axisLine={false} tickLine={false} />
                <YAxis dataKey="source" type="category" tick={{ fontSize: 11, fill: "#9E9E9E" }} axisLine={false} tickLine={false} width={70} />
                <RechartTooltip cursor={{ fill: "transparent" }} contentStyle={{ borderRadius: 8, border: "1px solid #E0E0E0", boxShadow: "0 4px 12px rgba(0,0,0,0.08)", fontSize: "0.8rem" }} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={18} animationDuration={1000}>
                  {leadsBySource.map((e, i) => (
                    <Cell key={i} fill={e.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </AnimatedBox>

        <AnimatedBox delay={0.4}>
          <Paper sx={{ p: 2.5, ...cardHover }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
              <Typography variant="h6" sx={{ color: "text.primary" }}>Conversion Funnel</Typography>
              <Chip label={`${conversionData[4].rate}% close`} size="small" sx={{ bgcolor: (t) => `${t.palette.success.light}12`, color: "success.main", fontWeight: 600, fontSize: "0.65rem", borderRadius: 1 }} />
            </Box>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mt: 1 }}>
              {conversionData.map((s, idx) => (
                <Box key={s.stage} sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  <Typography variant="caption" sx={{ color: "text.secondary", minWidth: 60, fontWeight: 500, fontSize: "0.7rem" }}>{s.stage}</Typography>
                  <Box sx={{ flex: 1, height: 10, bgcolor: "grey.100", borderRadius: 5, overflow: "hidden", position: "relative" }}>
                    <Box sx={{ height: "100%", width: `${s.rate}%`, bgcolor: s.fill, borderRadius: 5, transition: "width 1s ease", position: "relative",
                      "&::after": { content: '""', position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)", backgroundSize: "200% 100%", animation: "shimmer 2s infinite" }
                    }} />
                  </Box>
                  <Typography variant="caption" sx={{ color: "text.primary", fontWeight: 600, minWidth: 28, textAlign: "right" }}>{s.rate}%</Typography>
                </Box>
              ))}
            </Box>
          </Paper>
        </AnimatedBox>

        <AnimatedBox delay={0.45}>
          <Paper sx={{ p: 2.5, ...cardHover }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
              <Box>
                <Typography variant="h6" sx={{ color: "text.primary" }}>Top Performers</Typography>
                <Typography variant="caption" sx={{ color: "text.disabled" }}>This month</Typography>
              </Box>
              <Tooltip title="View leaderboard">
                <IconButton size="small" sx={{ color: "text.disabled", "&:hover": { color: "primary.main" } }}><MoreHoriz sx={{ fontSize: 18 }} /></IconButton>
              </Tooltip>
            </Box>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mt: 1 }}>
              {teamAvatars.slice(0, 4).map((m, i) => {
                const maxSales = teamAvatars[0].sales;
                const pct = (parseInt(m.sales.replace("$", "").replace("K", "")) / parseInt(maxSales.replace("$", "").replace("K", ""))) * 100;
                return (
                  <Box key={m.name} sx={{ display: "flex", alignItems: "center", gap: 1.5, p: 1, borderRadius: 1.5, transition: "background 0.2s", "&:hover": { bgcolor: "action.hover" } }}>
                    <Avatar sx={{ width: 28, height: 28, bgcolor: i === 0 ? "warning.main" : "primary.main", color: "#fff", fontSize: "0.6rem", fontWeight: 700, transition: "transform 0.2s", "&:hover": { transform: "scale(1.2)" } }}>{m.initials}</Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.25 }}>
                        <Typography variant="body2" sx={{ color: "text.primary", fontWeight: 500, fontSize: "0.8rem" }}>{m.name}</Typography>
                        <Typography variant="caption" sx={{ color: "success.main", fontWeight: 700, fontSize: "0.75rem" }}>{m.sales}</Typography>
                      </Box>
                      <Box sx={{ height: 4, bgcolor: "grey.100", borderRadius: 2, overflow: "hidden" }}>
                        <Box sx={{ height: "100%", width: `${pct}%`, bgcolor: i === 0 ? "warning.main" : "primary.main", borderRadius: 2, transition: "width 1s ease 0.5s" }} />
                      </Box>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </Paper>
        </AnimatedBox>
      </Box>

      {/* Bento Grid - Row 4: Activity + Tasks */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "2fr 1fr" }, gap: 2.5 }}>
        <AnimatedBox delay={0.45}>
          <Paper sx={{ p: 2.5, ...cardHover }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
              <Box>
                <Typography variant="h6" sx={{ color: "text.primary" }}>Recent Activity</Typography>
                <Typography variant="caption" sx={{ color: "text.disabled" }}>Real-time business updates</Typography>
              </Box>
              <Button size="small" endIcon={<ArrowForward sx={{ fontSize: 16 }} />} sx={{ textTransform: "none", fontWeight: 600, fontSize: "0.75rem", color: "primary.main" }}>
                View all
              </Button>
            </Box>
            <Box>
              {recentActivity.map((item, i) => (
                <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 2, py: 1.5, borderBottom: i < recentActivity.length - 1 ? 1 : 0, borderColor: "divider", transition: "background 0.2s", borderRadius: 1, px: 1, mx: -1, "&:hover": { bgcolor: "action.hover" } }}>
                  <Box sx={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: "50%", flexShrink: 0, bgcolor: item.type === "success" ? "success.main" : item.type === "info" ? "primary.main" : "warning.main" }} />
                    {i < recentActivity.length - 1 && <Box sx={{ position: "absolute", top: 14, width: 1.5, height: 20, bgcolor: "divider" }} />}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ color: "text.primary", fontWeight: 500, fontSize: "0.8rem", mb: 0.15 }}>{item.action}</Typography>
                    <Typography variant="caption" sx={{ color: "text.disabled", fontSize: "0.7rem" }}>{item.user} · {item.time}</Typography>
                  </Box>
                  {item.amount && (
                    <Chip label={item.amount} size="small" sx={{ height: 22, bgcolor: (t) => `${t.palette.success.light}12`, color: "success.main", fontWeight: 600, fontSize: "0.65rem", borderRadius: 1 }} />
                  )}
                </Box>
              ))}
            </Box>
          </Paper>
        </AnimatedBox>

        <AnimatedBox delay={0.5}>
          <Paper sx={{ p: 2.5, ...cardHover }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
              <Box>
                <Typography variant="h6" sx={{ color: "text.primary" }}>Upcoming Tasks</Typography>
                <Typography variant="caption" sx={{ color: "text.disabled" }}>{upcomingTasks.filter((t) => t.priority === "High").length} high priority</Typography>
              </Box>
              <Tooltip title="Add task">
                <IconButton size="small" sx={{ color: "primary.main", bgcolor: (t) => `${t.palette.primary.main}10`, "&:hover": { bgcolor: (t) => `${t.palette.primary.main}20`, transform: "rotate(90deg)" }, transition: "transform 0.3s" }}>
                  <Add sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            </Box>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              {upcomingTasks.map((t, i) => (
                <Box key={i} sx={{ p: 1.5, borderRadius: 1.5, border: 1, borderColor: "divider", bgcolor: "grey.50", transition: "all 0.2s", "&:hover": { borderColor: "primary.light", bgcolor: "primary.main" + "04", transform: "translateX(3px)" }, cursor: "pointer" }}>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}>
                    <Typography variant="body2" sx={{ color: "text.primary", fontWeight: 500, fontSize: "0.8rem" }}>{t.task}</Typography>
                    <Chip label={t.priority} size="small" sx={(theme) => ({
                      height: 20, fontSize: "0.6rem", fontWeight: 600, borderRadius: 1,
                      bgcolor: t.priority === "High" ? `${theme.palette.error.light}15` : t.priority === "Medium" ? `${theme.palette.warning.light}15` : `${theme.palette.grey[500]}15`,
                      color: t.priority === "High" ? "error.light" : t.priority === "Medium" ? "warning.light" : "text.disabled",
                    })} />
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Schedule sx={{ fontSize: 12, color: "text.disabled" }} />
                    <Typography variant="caption" sx={{ color: "text.disabled", fontSize: "0.7rem" }}>{t.due}</Typography>
                    <Avatar sx={{ width: 18, height: 18, bgcolor: t.priority === "High" ? "error.light" : "grey.300", color: "#fff", fontSize: "0.5rem", fontWeight: 700, ml: "auto" }}>{t.assignee}</Avatar>
                  </Box>
                </Box>
              ))}
            </Box>
          </Paper>
        </AnimatedBox>
      </Box>
    </Box>
  );
}
