import Box from "@mui/material/Box";

/**
 * Shared ambient background for Hertex authentication routes.
 * It intentionally sits behind route content and never captures interaction.
 */
export default function Background() {
  return (
    <Box
      aria-hidden="true"
      sx={{
        position: "absolute",
        inset: 0,
        zIndex: 0,
        overflow: "hidden",
        pointerEvents: "none",
        bgcolor: "#F8F5EF",
      }}
    >
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse at 50% 10%, rgba(224, 218, 203, 0.5), transparent 55%)",
        }}
      />
      <Box
        sx={{
          position: "absolute",
          left: "50%",
          top: -80,
          width: 900,
          height: 420,
          transform: "translateX(-50%)",
          borderRadius: "50%",
          filter: "blur(55px)",
          background: "radial-gradient(ellipse at center, rgba(198, 211, 205, 0.58) 0%, rgba(220, 218, 205, 0.4) 35%, rgba(248, 245, 239, 0) 72%)",
        }}
      />
      <Box
        sx={{
          position: "absolute",
          left: -180,
          top: -100,
          width: 650,
          height: 450,
          borderRadius: "50%",
          filter: "blur(65px)",
          background: "radial-gradient(ellipse at center, rgba(224, 202, 172, 0.42) 0%, rgba(241, 226, 204, 0.22) 45%, transparent 75%)",
        }}
      />
      <Box
        sx={{
          position: "absolute",
          right: -160,
          top: -70,
          width: 600,
          height: 430,
          borderRadius: "50%",
          filter: "blur(70px)",
          background: "radial-gradient(ellipse at center, rgba(224, 207, 185, 0.38) 0%, rgba(244, 232, 215, 0.2) 45%, transparent 75%)",
        }}
      />
      <Box
        sx={{
          position: "absolute",
          left: "50%",
          top: 230,
          width: 1100,
          height: 480,
          transform: "translateX(-50%)",
          borderRadius: "50%",
          filter: "blur(75px)",
          background: "radial-gradient(ellipse at center, rgba(235, 229, 216, 0.8) 0%, rgba(248, 245, 239, 0.6) 45%, transparent 75%)",
        }}
      />
      <Box
        sx={{
          position: "absolute",
          left: -250,
          top: 420,
          width: 750,
          height: 420,
          borderRadius: "50%",
          filter: "blur(80px)",
          background: "radial-gradient(ellipse at center, rgba(237, 229, 215, 0.55), transparent 70%)",
        }}
      />
      <Box
        sx={{
          position: "absolute",
          right: -250,
          top: 450,
          width: 750,
          height: 450,
          borderRadius: "50%",
          filter: "blur(85px)",
          background: "radial-gradient(ellipse at center, rgba(231, 224, 213, 0.48), transparent 70%)",
        }}
      />
      <Box
        sx={{
          position: "absolute",
          left: "50%",
          top: 80,
          width: 750,
          height: 330,
          transform: "translateX(-50%)",
          borderRadius: "50%",
          filter: "blur(85px)",
          background: "radial-gradient(ellipse at center, rgba(191, 208, 202, 0.2), transparent 68%)",
        }}
      />
      <Box
        sx={{
          position: "absolute",
          left: "50%",
          bottom: -200,
          width: 1200,
          height: 500,
          transform: "translateX(-50%)",
          borderRadius: "50%",
          filter: "blur(70px)",
          background: "radial-gradient(ellipse at center, rgba(255, 253, 249, 0.9), transparent 70%)",
        }}
      />
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          opacity: 0.045,
          mixBlendMode: "multiply",
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse at center, transparent 35%, rgba(210, 194, 170, 0.08) 100%)",
        }}
      />
    </Box>
  );
}
