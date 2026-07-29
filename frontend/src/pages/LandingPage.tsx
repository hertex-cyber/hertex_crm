import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@features/auth/AuthProvider";

/* ─── Styles ─────────────────────────────────────────────── */
const styles = `
/* ═══════════════════════════════════════════════════════════
   RESET & BASE — CRM Light Theme
═══════════════════════════════════════════════════════════ */
#landing-page *, #landing-page *::before, #landing-page *::after { margin: 0; padding: 0; box-sizing: border-box; }
#landing-page { scroll-behavior: smooth; -webkit-font-smoothing: antialiased; }
#landing-page a { text-decoration: none; color: inherit; }
#landing-page ul { list-style: none; }
#landing-page img { max-width: 100%; height: auto; display: block; }
#landing-page .container { max-width: 1280px; margin: 0 auto; padding: 0 32px; }
#landing-page ::selection { background: #bbdefb; color: #0d47a1; }

/* ═══════════════════════════════════════════════════════════
   CRM COLOR SYSTEM
═══════════════════════════════════════════════════════════ */
#landing-page {
  --primary-50: #e3f2fd;
  --primary-100: #bbdefb;
  --primary-200: #90caf9;
  --primary-300: #64b5f6;
  --primary-400: #42a5f5;
  --primary-500: #1976D2;
  --primary-600: #1565c0;
  --primary-700: #0d47a1;
  --primary-800: #0a3d91;
  --primary-900: #072a61;

  --secondary-50: #f3e5f5;
  --secondary-100: #e1bee7;
  --secondary-200: #ce93d8;
  --secondary-300: #ba68c8;
  --secondary-400: #ab47bc;
  --secondary-500: #7B1FA2;
  --secondary-600: #6a1b9a;
  --secondary-700: #4a148c;
  --secondary-800: #38006b;
  --secondary-900: #25004a;

  --neutral-0: #FFFFFF;
  --neutral-50: #FAFAFA;
  --neutral-100: #F5F5F5;
  --neutral-200: #EEEEEE;
  --neutral-300: #E0E0E0;
  --neutral-400: #BDBDBD;
  --neutral-500: #9E9E9E;
  --neutral-600: #757575;
  --neutral-700: #616161;
  --neutral-800: #424242;
  --neutral-900: #212121;

  --success: #2E7D32;
  --warning: #ED6C02;
  --error: #D32F2F;
  --info: #0288D1;

  --text-primary: #212121;
  --text-secondary: #757575;
  --text-disabled: #9E9E9E;
  --divider: #E0E0E0;
  --bg-default: #FAFAFA;
  --bg-paper: #FFFFFF;

  --shadow-sm: 0px 1px 2px rgba(0,0,0,0.06), 0px 1px 3px rgba(0,0,0,0.1);
  --shadow-md: 0px 2px 4px rgba(0,0,0,0.06), 0px 4px 6px rgba(0,0,0,0.1);
  --shadow-lg: 0px 4px 8px rgba(0,0,0,0.06), 0px 8px 16px rgba(0,0,0,0.1);
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
}

/* ═══════════════════════════════════════════════════════════
   TYPOGRAPHY
═══════════════════════════════════════════════════════════ */
#landing-page .section-tag {
  display: inline-flex; align-items: center; gap: 8px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem; font-weight: 600;
  letter-spacing: 0.05em; text-transform: uppercase;
  color: var(--primary-500);
  padding: 6px 16px; border-radius: 100px;
  background: var(--primary-50);
  border: 1px solid var(--primary-100);
  margin-bottom: 20px;
}
#landing-page .section-title {
  font-family: 'Space Grotesk', sans-serif;
  font-size: clamp(1.75rem, 3.5vw, 2.5rem); font-weight: 700;
  line-height: 1.2; letter-spacing: -0.02em;
  margin-bottom: 16px; color: var(--text-primary);
}
#landing-page .section-title .accent {
  background: linear-gradient(135deg, var(--primary-500), var(--secondary-500));
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  background-clip: text;
}
#landing-page .section-desc {
  font-size: 1rem; color: var(--text-secondary);
  line-height: 1.7; max-width: 480px;
}

/* ═══════════════════════════════════════════════════════════
   NAVIGATION
═══════════════════════════════════════════════════════════ */
#landing-page .lp-nav {
  position: fixed; top: 0; left: 0; right: 0; z-index: 1000;
  padding: 16px 0; transition: all 0.3s ease;
  background: transparent;
}
#landing-page .lp-nav.scrolled {
  background: rgba(255,255,255,0.92);
  backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
  box-shadow: var(--shadow-sm);
  padding: 10px 0;
}
#landing-page .nav-inner {
  display: flex; align-items: center; justify-content: space-between;
  max-width: 1280px; margin: 0 auto; padding: 0 32px;
}
#landing-page .nav-logo {
  display: flex; align-items: center; gap: 10px;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 1.375rem; font-weight: 700; letter-spacing: -0.02em;
  color: var(--text-primary);
}
#landing-page .nav-logo img { width: 32px; height: 32px; border-radius: 6px; }
#landing-page .nav-links { display: flex; align-items: center; gap: 32px; }
#landing-page .nav-links a {
  font-size: 0.875rem; font-weight: 500;
  color: var(--text-secondary);
  transition: color 0.2s ease; position: relative;
}
#landing-page .nav-links a:hover { color: var(--primary-500); }
#landing-page .nav-links a span { position: relative; }
#landing-page .nav-links a span::after {
  content: ''; position: absolute; bottom: -4px; left: 0; right: 0;
  height: 1.5px; background: var(--primary-500);
  transform: scaleX(0); transition: transform 0.3s ease;
  border-radius: 1px;
}
#landing-page .nav-links a:hover span::after { transform: scaleX(1); }
#landing-page .nav-cta {
  font-size: 0.8125rem; font-weight: 600; padding: 10px 24px;
  background: linear-gradient(135deg, var(--primary-500), var(--secondary-500));
  color: #fff !important; border-radius: var(--radius-md);
  transition: all 0.3s ease;
}
#landing-page .nav-cta:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(25,118,210,0.25); }

#landing-page .mobile-btn {
  display: none; background: none; border: none; cursor: pointer;
  width: 28px; height: 20px; position: relative; z-index: 1001;
}
#landing-page .mobile-btn span {
  display: block; width: 100%; height: 2px; background: var(--text-primary);
  position: absolute; left: 0; transition: all 0.3s ease;
  border-radius: 2px;
}
#landing-page .mobile-btn span:nth-child(1) { top: 0; }
#landing-page .mobile-btn span:nth-child(2) { top: 50%; transform: translateY(-50%); width: 70%; }
#landing-page .mobile-btn span:nth-child(3) { bottom: 0; }
#landing-page .mobile-btn.active span:nth-child(1) { top: 50%; transform: translateY(-50%) rotate(45deg); }
#landing-page .mobile-btn.active span:nth-child(2) { opacity: 0; width: 0; }
#landing-page .mobile-btn.active span:nth-child(3) { top: 50%; transform: translateY(-50%) rotate(-45deg); }

/* ═══════════════════════════════════════════════════════════
   HERO
═══════════════════════════════════════════════════════════ */
#landing-page .hero {
  min-height: 100vh; display: flex; align-items: center;
  position: relative; overflow: hidden;
  padding: 140px 0 80px;
  background: linear-gradient(180deg, #e3f2fd 0%, #FAFAFA 100%);
}
#landing-page .hero-bg {
  position: absolute; inset: 0; overflow: hidden; pointer-events: none;
}
#landing-page .hero-grid {
  position: absolute; inset: 0;
  background-image:
    linear-gradient(rgba(25,118,210,0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(25,118,210,0.04) 1px, transparent 1px);
  background-size: 64px 64px;
  mask-image: radial-gradient(ellipse 70% 60% at 50% 40%, black, transparent 70%);
  -webkit-mask-image: radial-gradient(ellipse 70% 60% at 50% 40%, black, transparent 70%);
}
#landing-page .hero-orb {
  position: absolute; border-radius: 50%; filter: blur(100px); pointer-events: none;
}
#landing-page .hero-orb-1 { width: 500px; height: 500px; top: -200px; right: -100px; background: rgba(25,118,210,0.06); }
#landing-page .hero-orb-2 { width: 400px; height: 400px; bottom: -150px; left: -100px; background: rgba(123,31,162,0.04); }
#landing-page .hero .container { position: relative; z-index: 1; }
#landing-page .hero-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 80px;
  align-items: center;
}
#landing-page .hero-badge {
  display: inline-flex; align-items: center; gap: 8px;
  font-size: 0.75rem; font-weight: 500; color: var(--primary-600);
  background: var(--primary-50);
  padding: 6px 14px 6px 8px; border-radius: 100px;
  border: 1px solid var(--primary-100);
  margin-bottom: 28px;
}
#landing-page .hero-badge-icon {
  display: inline-flex; align-items: center; justify-content: center;
  width: 22px; height: 22px; border-radius: 6px;
  background: linear-gradient(135deg, var(--primary-500), var(--secondary-500));
  color: #fff; font-size: 0.625rem; font-weight: 700;
}
#landing-page .hero-title {
  font-family: 'Space Grotesk', sans-serif;
  font-size: clamp(2.5rem, 5vw, 4rem); font-weight: 700;
  line-height: 1.05; letter-spacing: -0.04em;
  margin-bottom: 20px; color: var(--text-primary);
}
#landing-page .hero-title .accent {
  background: linear-gradient(135deg, var(--primary-500), var(--secondary-500), var(--info));
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  background-clip: text;
}
#landing-page .hero-desc {
  font-size: 1.05rem; color: var(--text-secondary);
  line-height: 1.8; max-width: 480px; margin-bottom: 36px;
}
#landing-page .hero-actions { display: flex; gap: 16px; flex-wrap: wrap; }
#landing-page .btn-primary {
  display: inline-flex; align-items: center; gap: 10px;
  font-size: 0.9375rem; font-weight: 600; padding: 14px 32px;
  background: linear-gradient(135deg, var(--primary-500), var(--secondary-500));
  color: #fff; border: none; border-radius: var(--radius-md);
  cursor: pointer; transition: all 0.3s ease;
}
#landing-page .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(25,118,210,0.25); }
#landing-page .btn-secondary {
  display: inline-flex; align-items: center; gap: 10px;
  font-size: 0.9375rem; font-weight: 600; padding: 14px 32px;
  background: var(--neutral-0); color: var(--text-primary);
  border: 2px solid var(--neutral-300);
  border-radius: var(--radius-md); cursor: pointer;
  transition: all 0.3s ease;
}
#landing-page .btn-secondary:hover { border-color: var(--primary-500); color: var(--primary-500); transform: translateY(-2px); }
#landing-page .btn-secondary svg { stroke: currentColor; }
#landing-page .btn-primary svg { stroke: #fff; }
#landing-page .hero-metrics {
  display: flex; gap: 40px; margin-top: 48px; padding-top: 28px;
  border-top: 2px solid var(--primary-100);
}
#landing-page .hero-metric-value {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 1.75rem; font-weight: 700; color: var(--primary-600);
  letter-spacing: -0.02em;
}
#landing-page .hero-metric-label { font-size: 0.8125rem; color: var(--text-secondary); margin-top: 2px; }

/* Hero Mockup */
#landing-page .hero-mockup-wrap { position: relative; display: flex; align-items: center; justify-content: center; }
#landing-page .hero-mockup {
  width: 100%; max-width: 520px; aspect-ratio: 4/3;
  border-radius: var(--radius-xl);
  background: var(--neutral-0);
  box-shadow: var(--shadow-lg), 0 0 0 1px var(--neutral-200);
  overflow: hidden;
}
#landing-page .hero-mockup-inner { padding: 20px; height: 100%; display: flex; flex-direction: column; }
#landing-page .mockup-top {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 14px;
}
#landing-page .mockup-brand {
  display: flex; align-items: center; gap: 8px;
  font-size: 0.75rem; font-weight: 600; color: var(--text-secondary);
}
#landing-page .mockup-brand img { width: 16px; height: 16px; border-radius: 4px; }
#landing-page .mockup-dots { display: flex; gap: 6px; }
#landing-page .mockup-dots span { width: 8px; height: 8px; border-radius: 50%; }
#landing-page .mockup-dots span:nth-child(1) { background: #ef4444; }
#landing-page .mockup-dots span:nth-child(2) { background: #f59e0b; }
#landing-page .mockup-dots span:nth-child(3) { background: #10b981; }
#landing-page .mockup-board { display: flex; gap: 6px; flex: 1; margin-bottom: 10px; }
#landing-page .mockup-col {
  flex: 1; background: var(--neutral-50);
  border-radius: var(--radius-sm);
  padding: 8px 6px;
  border: 1px solid var(--neutral-200);
}
#landing-page .mockup-col-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.5rem; font-weight: 600; color: var(--text-secondary);
  text-transform: uppercase; letter-spacing: 0.06em;
  text-align: center; margin-bottom: 4px;
}
#landing-page .mockup-col-count {
  font-size: 0.5rem; color: var(--text-disabled);
  text-align: center; margin-bottom: 4px;
}
#landing-page .mockup-card {
  background: var(--neutral-0); border-radius: 4px;
  padding: 5px; margin-bottom: 3px;
  border: 1px solid var(--neutral-200);
  cursor: pointer; transition: all 0.2s ease;
}
#landing-page .mockup-card:hover { border-color: var(--primary-300); box-shadow: 0 1px 4px rgba(25,118,210,0.08); }
#landing-page .mockup-card-name {
  font-size: 0.5rem; font-weight: 600; color: var(--text-primary);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
#landing-page .mockup-card-val { font-size: 0.4375rem; color: var(--text-disabled); }
#landing-page .mockup-card-ai {
  border-color: var(--primary-200);
  background: linear-gradient(135deg, var(--primary-50), #fff);
}
#landing-page .mockup-ai {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px;
  background: var(--primary-50);
  border: 1px solid var(--primary-100);
  border-radius: var(--radius-sm);
}
#landing-page .mockup-ai-pulse {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--primary-500);
}
#landing-page .mockup-ai-text {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.6rem; color: var(--text-secondary);
}
#landing-page .mockup-ai-text strong { color: var(--primary-600); }

/* ═══════════════════════════════════════════════════════════
   FEATURES
═══════════════════════════════════════════════════════════ */
#landing-page .features { padding: 100px 0; }
#landing-page .features-head { margin-bottom: 60px; }
#landing-page .features-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}
#landing-page .feature-card {
  display: grid;
  grid-template-columns: 48px 1fr;
  gap: 20px;
  padding: 28px;
  border-radius: var(--radius-xl);
  background: var(--neutral-0);
  border: 1px solid var(--neutral-200);
  transition: all 0.3s ease;
  position: relative; overflow: hidden;
}
#landing-page .feature-card::before {
  content: ''; position: absolute; top: 0; left: 0; right: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--primary-500), var(--secondary-500));
  transform: scaleX(0); transition: transform 0.4s ease;
}
#landing-page .feature-card:hover { transform: translateY(-4px); box-shadow: var(--shadow-md); border-color: var(--primary-200); }
#landing-page .feature-card:hover::before { transform: scaleX(1); }
#landing-page .feature-icon {
  width: 48px; height: 48px; border-radius: var(--radius-md);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  background: var(--primary-50);
  border: 1px solid var(--primary-100);
  color: var(--primary-500);
}
#landing-page .feature-icon svg { width: 24px; height: 24px; stroke: currentColor; fill: none; stroke-width: 1.5; }
#landing-page .feature-body { min-width: 0; }
#landing-page .feature-name {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 1.1rem; font-weight: 600; color: var(--text-primary);
  margin-bottom: 8px;
}
#landing-page .feature-text {
  font-size: 0.875rem; color: var(--text-secondary);
  line-height: 1.7; margin-bottom: 14px;
}
#landing-page .feature-pills { display: flex; flex-wrap: wrap; gap: 6px; }
#landing-page .feature-pill {
  font-size: 0.6875rem; font-weight: 500;
  padding: 4px 10px; border-radius: 4px;
  background: var(--primary-50);
  color: var(--primary-600);
  border: 1px solid var(--primary-100);
}

/* ═══════════════════════════════════════════════════════════
   CTA
═══════════════════════════════════════════════════════════ */
#landing-page .cta { padding: 100px 0; position: relative; }
#landing-page .cta-bg {
  position: absolute; inset: 0;
  background: linear-gradient(135deg, var(--primary-700), var(--secondary-700));
  pointer-events: none;
}
#landing-page .cta-grid {
  position: absolute; inset: 0; opacity: 0.04; pointer-events: none;
  background-image:
    linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px);
  background-size: 48px 48px;
}
#landing-page .cta .container { position: relative; z-index: 1; }
#landing-page .cta-layout {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 60px;
  align-items: center;
}
#landing-page .cta-title {
  font-family: 'Space Grotesk', sans-serif;
  font-size: clamp(2rem, 3.5vw, 2.75rem); font-weight: 700;
  color: #fff; letter-spacing: -0.03em; margin-bottom: 14px;
  line-height: 1.1;
}
#landing-page .cta-desc {
  font-size: 1rem; color: rgba(255,255,255,0.7);
  line-height: 1.7; margin-bottom: 28px;
}
#landing-page .cta-actions { display: flex; gap: 16px; flex-wrap: wrap; }
#landing-page .cta-btn {
  display: inline-flex; align-items: center; gap: 10px;
  font-size: 0.9375rem; font-weight: 600; padding: 16px 36px;
  border-radius: var(--radius-md); cursor: pointer; transition: all 0.3s ease;
}
#landing-page .cta-btn.primary { background: #fff; color: var(--primary-700); border: none; }
#landing-page .cta-btn.primary:hover { box-shadow: 0 8px 24px rgba(0,0,0,0.15); }
#landing-page .cta-btn.ghost {
  background: rgba(255,255,255,0.08); color: #fff;
  border: 1px solid rgba(255,255,255,0.15);
}
#landing-page .cta-btn.ghost:hover { background: rgba(255,255,255,0.12); }
#landing-page .cta-btn svg { stroke: currentColor; }
#landing-page .cta-card {
  width: 100%; max-width: 400px;
  padding: 28px; border-radius: var(--radius-xl);
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  backdrop-filter: blur(12px);
}
#landing-page .cta-card-item {
  display: flex; align-items: center; gap: 14px;
  padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.06);
}
#landing-page .cta-card-item:last-child { border-bottom: none; }
#landing-page .cta-card-check {
  width: 26px; height: 26px; border-radius: 6px;
  background: rgba(255,255,255,0.08);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; font-size: 0.7rem; color: #4CAF50;
}
#landing-page .cta-card-text { font-size: 0.8125rem; color: rgba(255,255,255,0.65); }
#landing-page .cta-card-text strong { color: #fff; }

/* ═══════════════════════════════════════════════════════════
   FOOTER
═══════════════════════════════════════════════════════════ */
#landing-page .lp-footer {
  padding: 48px 0 32px;
  border-top: 1px solid var(--neutral-200);
  background: var(--neutral-0);
}
#landing-page .footer-inner {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  gap: 40px; margin-bottom: 40px;
}
#landing-page .footer-brand img { width: 28px; height: 28px; border-radius: 6px; margin-bottom: 12px; }
#landing-page .footer-brand-name {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 1rem; font-weight: 600; color: var(--text-primary); margin-bottom: 8px;
}
#landing-page .footer-brand-desc { font-size: 0.8rem; color: var(--text-secondary); line-height: 1.7; max-width: 280px; }
#landing-page .footer-col-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.6875rem; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--text-disabled); margin-bottom: 16px;
}
#landing-page .footer-col a {
  display: block; font-size: 0.85rem; color: var(--text-secondary);
  padding: 5px 0; transition: color 0.2s ease;
}
#landing-page .footer-col a:hover { color: var(--primary-500); }
#landing-page .footer-bottom {
  padding-top: 24px; border-top: 1px solid var(--neutral-200);
  display: flex; justify-content: space-between; align-items: center;
  font-size: 0.8rem; color: var(--text-disabled);
}
#landing-page .footer-socials { display: flex; gap: 12px; }
#landing-page .footer-socials a {
  width: 34px; height: 34px; border-radius: var(--radius-sm);
  background: var(--neutral-100); display: flex;
  align-items: center; justify-content: center;
  transition: all 0.2s ease;
}
#landing-page .footer-socials a:hover { background: var(--primary-50); }
#landing-page .footer-socials svg { width: 15px; height: 15px; fill: var(--text-secondary); transition: fill 0.2s ease; }
#landing-page .footer-socials a:hover svg { fill: var(--primary-500); }

/* ═══════════════════════════════════════════════════════════
   ANIMATIONS
═══════════════════════════════════════════════════════════ */
#landing-page .reveal {
  opacity: 0; transform: translateY(30px);
  transition: opacity 0.6s ease, transform 0.6s ease;
}
#landing-page .reveal.visible { opacity: 1; transform: translateY(0); }
#landing-page .reveal-l {
  opacity: 0; transform: translateX(-30px);
  transition: opacity 0.6s ease, transform 0.6s ease;
}
#landing-page .reveal-l.visible { opacity: 1; transform: translateX(0); }
#landing-page .reveal-r {
  opacity: 0; transform: translateX(30px);
  transition: opacity 0.6s ease, transform 0.6s ease;
}
#landing-page .reveal-r.visible { opacity: 1; transform: translateX(0); }
#landing-page .stagger > * {
  opacity: 0; transform: translateY(20px);
}
#landing-page .stagger.visible > *:nth-child(1) { animation: lpStIn 0.5s ease 0s forwards; }
#landing-page .stagger.visible > *:nth-child(2) { animation: lpStIn 0.5s ease 0.06s forwards; }
#landing-page .stagger.visible > *:nth-child(3) { animation: lpStIn 0.5s ease 0.12s forwards; }
#landing-page .stagger.visible > *:nth-child(4) { animation: lpStIn 0.5s ease 0.18s forwards; }
#landing-page .stagger.visible > *:nth-child(5) { animation: lpStIn 0.5s ease 0.24s forwards; }
#landing-page .stagger.visible > *:nth-child(6) { animation: lpStIn 0.5s ease 0.3s forwards; }
#landing-page .stagger.visible > *:nth-child(7) { animation: lpStIn 0.5s ease 0.36s forwards; }
#landing-page .stagger.visible > *:nth-child(8) { animation: lpStIn 0.5s ease 0.42s forwards; }
#landing-page .stagger.visible > *:nth-child(9) { animation: lpStIn 0.5s ease 0.48s forwards; }
#landing-page .stagger.visible > *:nth-child(10) { animation: lpStIn 0.5s ease 0.54s forwards; }
#landing-page .stagger.visible > *:nth-child(11) { animation: lpStIn 0.5s ease 0.6s forwards; }
#landing-page .stagger.visible > *:nth-child(12) { animation: lpStIn 0.5s ease 0.66s forwards; }
#landing-page .stagger.visible > *:nth-child(13) { animation: lpStIn 0.5s ease 0.72s forwards; }
#landing-page .stagger.visible > *:nth-child(14) { animation: lpStIn 0.5s ease 0.78s forwards; }
#landing-page .stagger.visible > *:nth-child(15) { animation: lpStIn 0.5s ease 0.84s forwards; }
#landing-page .stagger.visible > *:nth-child(16) { animation: lpStIn 0.5s ease 0.9s forwards; }
@keyframes lpStIn { to { opacity: 1; transform: translateY(0); } }
#landing-page .count-up { display: inline-block; }

@media (prefers-reduced-motion: reduce) {
  #landing-page *, #landing-page *::before, #landing-page *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }
}

/* ═══════════════════════════════════════════════════════════
   RESPONSIVE
═══════════════════════════════════════════════════════════ */
@media (max-width: 1024px) {
  #landing-page .hero-layout { grid-template-columns: 1fr; gap: 48px; }
  #landing-page .hero-mockup-wrap { order: -1; }
  #landing-page .hero-mockup { max-width: 100%; }
  #landing-page .cta-layout { grid-template-columns: 1fr; gap: 40px; }
  #landing-page .cta-visual { justify-content: flex-start; }
  #landing-page .cta-card { max-width: 100%; }
}
@media (max-width: 768px) {
  #landing-page .nav-links { display: none; }
  #landing-page .nav-links.open {
    display: flex; flex-direction: column; position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(255,255,255,0.98); backdrop-filter: blur(40px);
    padding: 100px 40px 40px; gap: 24px;
    align-items: flex-start; justify-content: flex-start;
    z-index: 1000;
  }
  #landing-page .nav-links.open a { font-size: 1.25rem; }
  #landing-page .nav-links.open .nav-cta { margin-top: 16px; font-size: 1rem; padding: 14px 32px; display: inline-flex; }
  #landing-page .mobile-btn { display: block; }
  #landing-page .container { padding: 0 20px; }
  #landing-page .hero-title { font-size: clamp(2rem, 8vw, 2.75rem); }
  #landing-page .hero-metrics { gap: 20px; flex-wrap: wrap; }
  #landing-page .features-grid { grid-template-columns: 1fr; }
  #landing-page .feature-card { grid-template-columns: 1fr; gap: 12px; }
  #landing-page .footer-inner { grid-template-columns: 1fr 1fr; }
  #landing-page .footer-bottom { flex-direction: column; gap: 16px; text-align: center; }
}
@media (max-width: 480px) {
  #landing-page .hero-actions { flex-direction: column; }
  #landing-page .hero-actions .btn-primary, #landing-page .hero-actions .btn-secondary { width: 100%; justify-content: center; }
  #landing-page .cta-actions { flex-direction: column; }
  #landing-page .cta-actions .cta-btn { width: 100%; justify-content: center; }
  #landing-page .footer-inner { grid-template-columns: 1fr; }
}

/* ═══════════════════════════════════════════════════════════
   INTEGRATIONS SHOWCASE
═══════════════════════════════════════════════════════════ */
#landing-page .integrations {
  position: relative; overflow: hidden; padding: 112px 0;
  background: var(--neutral-50); color: var(--text-primary);
}
#landing-page .integrations .container { position: relative; z-index: 1; }
#landing-page .integrations-head { max-width: 730px; margin-bottom: 42px; }
#landing-page .integrations .section-title { color: var(--text-primary); font-size: clamp(2.15rem, 4vw, 3.55rem); max-width: 650px; }
#landing-page .integrations .section-desc { color: var(--text-secondary); max-width: 600px; }
#landing-page .meta-connection {
  display: grid; grid-template-columns: 1.08fr .92fr; gap: 36px; align-items: center;
  padding: clamp(28px, 5vw, 54px); margin-bottom: 48px; border-radius: 24px;
  background: linear-gradient(135deg, rgba(27,85,173,.62), rgba(28,19,85,.77));
  border: 1px solid rgba(167,207,255,.24); box-shadow: 0 24px 60px rgba(0,0,0,.25);
}
#landing-page .meta-kicker { display: flex; align-items: center; gap: 10px; margin-bottom: 15px; color: #a9d2ff; font-size: .75rem; font-weight: 700; letter-spacing: .11em; text-transform: uppercase; }
#landing-page .meta-kicker i { width: 8px; height: 8px; border-radius: 50%; background: #70e5a0; box-shadow: 0 0 0 5px rgba(112,229,160,.13); }
#landing-page .meta-title { max-width: 560px; font-family: 'Space Grotesk', sans-serif; font-size: clamp(1.7rem, 3.1vw, 2.65rem); line-height: 1.12; letter-spacing: -.035em; color: #fff; }
#landing-page .meta-copy { max-width: 510px; margin: 18px 0 25px; color: #c4d5ee; line-height: 1.65; }
#landing-page .meta-benefits { display: flex; flex-wrap: wrap; gap: 10px; }
#landing-page .meta-benefit { padding: 8px 11px; border: 1px solid rgba(190,220,255,.2); border-radius: 100px; color: #dceaff; background: rgba(255,255,255,.06); font-size: .78rem; }
#landing-page .meta-visual { position: relative; min-height: 268px; display: grid; place-items: center; }
#landing-page .meta-orbit { position: absolute; width: min(290px, 70vw); aspect-ratio: 1; border: 1px solid rgba(178,214,255,.25); border-radius: 50%; }
#landing-page .meta-orbit::before, #landing-page .meta-orbit::after { content: ""; position: absolute; inset: 26px; border: 1px solid rgba(178,214,255,.15); border-radius: 50%; }
#landing-page .meta-orbit::after { inset: 57px; }
#landing-page .meta-core, #landing-page .meta-node { position: absolute; display: grid; place-items: center; border-radius: 18px; }
#landing-page .meta-core { z-index: 2; width: 92px; height: 92px; background: #fff; box-shadow: 0 12px 34px rgba(0,0,0,.28); color: #1877f2; }
#landing-page .meta-node { z-index: 1; width: 57px; height: 57px; border-radius: 16px; background: rgba(255,255,255,.13); border: 1px solid rgba(255,255,255,.23); color: white; backdrop-filter: blur(10px); }
#landing-page .meta-node.facebook { top: 10px; left: 50%; transform: translateX(-50%); color: #77b6ff; }
#landing-page .meta-node.instagram { right: 3px; bottom: 38px; color: #f9a8d4; }
#landing-page .meta-node.whatsapp { left: 3px; bottom: 38px; color: #86efac; }
#landing-page .integrations-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
#landing-page .integration-card {
  display: flex; align-items: center; gap: 12px; min-width: 0; padding: 15px;
  border-radius: 14px; background: var(--neutral-0); border: 1px solid var(--neutral-200);
  transition: transform .25s ease, background .25s ease, border-color .25s ease; text-align: left;
}
#landing-page .integration-card:hover { transform: translateY(-3px); background: var(--neutral-0); border-color: var(--primary-200); box-shadow: var(--shadow-md); }
#landing-page .integration-icon {
  width: 42px; height: 42px; border-radius: 12px; display: flex; align-items: center; justify-content: center;
  background: var(--neutral-100); border: 1px solid var(--neutral-200); font-size: 1.3rem; font-weight: 700; color: var(--text-primary); flex-shrink: 0;
}
#landing-page .integration-icon.meta {
  background: #e8f4ff;
  border-color: #cce7ff;
  color: #1877F2;
}
#landing-page .integration-icon.instagram {
  background: #fce4ec;
  border-color: #f8d0db;
  color: #E4405F;
}
#landing-page .integration-icon.whatsapp {
  background: #e8f5e9;
  border-color: #c8e6c9;
  color: #25D366;
}
#landing-page .integration-icon.api {
  background: #f3e8ff;
  border-color: #e9d5ff;
  color: #7C3AED;
}
#landing-page .integration-icon.google {
  background: #e6f4ea;
  border-color: #ceead6;
  color: #4285F4;
}
#landing-page .integration-icon.microsoft { background: #e8eaf6; border-color: #d1d5ed; color: #2b579a; }
#landing-page .integration-icon.slack { background: #e8f5f5; border-color: #cceaea; color: #4A154B; }
#landing-page .integration-icon.twilio { background: #fce4ec; border-color: #f8d0db; color: #F22F46; }
#landing-page .integration-icon.github { background: #f5f5f5; border-color: #e0e0e0; color: #24292e; }
#landing-page .integration-icon.shopify { background: #e8f5e9; border-color: #c8e6c9; color: #7AB55C; }
#landing-page .integration-icon.hubspot { background: #fff3e0; border-color: #ffe0b2; color: #FF7A59; }
#landing-page .integration-icon.sendgrid { background: #e3f2fd; border-color: #bbdefb; color: #1A82E2; }
#landing-page .integration-icon.mailchimp { background: #fff8e1; border-color: #ffecb3; color: #FFE01B; }
#landing-page .integration-icon.linkedin { background: #e0f2fe; border-color: #bae6fd; color: #0A66C2; }
#landing-page .integration-icon.zoom { background: #f0fdf4; border-color: #dcfce7; color: #2D8CFF; }
#landing-page .integration-icon.salesforce { background: #fff0f0; border-color: #ffd6d6; color: #00A1E0; }
#landing-page .integration-name { font-size: .8125rem; font-weight: 600; color: var(--text-primary); }
#landing-page .integration-name span {
  display: block; font-size: .6875rem; font-weight: 400; color: var(--text-secondary); margin-top: 2px;
}

@media (max-width: 1024px) {
  #landing-page .integrations-grid { grid-template-columns: repeat(3, 1fr); }
  #landing-page .meta-connection { gap: 18px; }
}
@media (max-width: 768px) {
  #landing-page .integrations-grid { grid-template-columns: repeat(2, 1fr); }
  #landing-page .integrations { padding: 72px 0; }
  #landing-page .meta-connection { grid-template-columns: 1fr; }
  #landing-page .meta-visual { min-height: 235px; order: -1; }
}
@media (max-width: 480px) {
  #landing-page .integrations-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
}
`;

/* ─── Hook for scroll-reveal animations ─────────────────── */
function useScrollReveal() {
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("visible");
            obs.unobserve(e.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" },
    );
    document
      .querySelectorAll("#landing-page .reveal, #landing-page .reveal-l, #landing-page .reveal-r, #landing-page .stagger")
      .forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  });
}

/* ─── Hook for counter-up animation ─────────────────────── */
function useCounterAnimation() {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>("#landing-page .count-up");
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement;
            const target = parseFloat(el.dataset.target ?? "0");
            const isFloat = target % 1 !== 0;
            const duration = 2000;
            const start = performance.now();

            function animate(now: number) {
              const elapsed = now - start;
              const progress = Math.min(elapsed / duration, 1);
              const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
              const current = target * eased;
              el.textContent = isFloat ? current.toFixed(2) : Math.round(current).toString();
              if (progress < 1) requestAnimationFrame(animate);
            }
            requestAnimationFrame(animate);
            obs.unobserve(el);
          }
        });
      },
      { threshold: 0.5 },
    );
    els      .forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  });
}

/* ─── Component ──────────────────────────────────────────── */
export default function LandingPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // All hooks MUST be called before any early return (Rules of Hooks)
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  useScrollReveal();

  useCounterAnimation();

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  // Auth guard — after all hooks
  if (isLoading) return null;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  const closeMobile = () => {
    setMobileOpen(false);
  };

  return (
    <div id="landing-page">
      <style>{styles}</style>

      {/* ─── NAV ─────────────────────────────────────────── */}
      <nav
        className={`lp-nav${scrolled ? " scrolled" : ""}`}
        role="banner"
      >
        <div className="nav-inner">
          <a href="/" className="nav-logo" onClick={closeMobile}>
            <img src="/tzaho.png" alt="TZAHU CRM" />
            TZAHU
          </a>
          <div className={`nav-links${mobileOpen ? " open" : ""}`} id="lpNavLinks">
            <a href="#features" onClick={closeMobile}>
              <span>Features</span>
            </a>
            <a href="#integrations" onClick={closeMobile}>
              <span>Integrations</span>
            </a>
            <a href="/login" onClick={closeMobile}>
              <span>Sign In</span>
            </a>
            <a href="/register" className="nav-cta" onClick={closeMobile}>
              Sign Up Free
            </a>
          </div>
          <button
            className={`mobile-btn${mobileOpen ? " active" : ""}`}
            onClick={() => setMobileOpen((p) => !p)}
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
          >
            <span /><span /><span />
          </button>
        </div>
      </nav>

      <main id="lp-main-content">
        {/* ─── HERO ──────────────────────────────────────── */}
        <section className="hero">
          <div className="hero-bg">
            <div className="hero-grid" />
            <div className="hero-orb hero-orb-1" />
            <div className="hero-orb hero-orb-2" />
          </div>
          <div className="container">
            <div className="hero-layout">
              {/* Left */}
              <div className="reveal-l">
                <div className="hero-badge">
                  <span className="hero-badge-icon">✦</span>
                  Now in Private Beta
                </div>
                <h1 className="hero-title">
                  Your Sales Process.<br />
                  <span className="accent">Supercharged by AI.</span>
                </h1>
                <p className="hero-desc">
                  TZAHU is the CRM that adapts to your workflow — not the other way around.
                  Built AI-native from day one, it combines visual automation, semantic intelligence,
                  and enterprise-grade security in a single platform.
                </p>
                <div className="hero-actions">
                  <a href="/register" className="btn-primary">
                    Start Free Trial
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
                  </a>
                  <a href="/login" className="btn-secondary">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    Sign In
                  </a>
                </div>
                <div className="hero-metrics">
                  <div>
                    <div className="hero-metric-value"><span className="count-up" data-target="99.95">0</span>%</div>
                    <div className="hero-metric-label">Uptime SLA</div>
                  </div>
                  <div>
                    <div className="hero-metric-value">&lt;<span className="count-up" data-target="200">0</span>ms</div>
                    <div className="hero-metric-label">P95 Latency</div>
                  </div>
                  <div>
                    <div className="hero-metric-value"><span className="count-up" data-target="70">0</span>%</div>
                    <div className="hero-metric-label">Cost Savings</div>
                  </div>
                </div>
              </div>
              {/* Right — Mockup */}
              <div className="hero-mockup-wrap reveal-r">
                <div className="hero-mockup">
                  <div className="hero-mockup-inner">
                    <div className="mockup-top">
                      <div className="mockup-brand">
                        <img src="/tzaho.png" alt="" />
                        Pipeline View
                      </div>
                      <div className="mockup-dots">
                        <span /><span /><span />
                      </div>
                    </div>
                    <div className="mockup-board">
                      <div className="mockup-col">
                        <div className="mockup-col-label">New</div>
                        <div className="mockup-col-count">12</div>
                        <div className="mockup-card">
                          <div className="mockup-card-name">Acme Corp</div>
                          <div className="mockup-card-val">Web · J. Smith</div>
                        </div>
                        <div className="mockup-card mockup-card-ai">
                          <div className="mockup-card-name">AI: Hot Lead</div>
                          <div className="mockup-card-val">Score 94</div>
                        </div>
                        <div className="mockup-card">
                          <div className="mockup-card-name">TechStart</div>
                          <div className="mockup-card-val">Referral</div>
                        </div>
                      </div>
                      <div className="mockup-col">
                        <div className="mockup-col-label">Contacted</div>
                        <div className="mockup-col-count">8</div>
                        <div className="mockup-card">
                          <div className="mockup-card-name">BetaCorp</div>
                          <div className="mockup-card-val">$25K</div>
                        </div>
                        <div className="mockup-card mockup-card-ai">
                          <div className="mockup-card-name">DataPulse</div>
                          <div className="mockup-card-val">Score 82</div>
                        </div>
                      </div>
                      <div className="mockup-col">
                        <div className="mockup-col-label">Proposal</div>
                        <div className="mockup-col-count">4</div>
                        <div className="mockup-card">
                          <div className="mockup-card-name">GlobalTech</div>
                          <div className="mockup-card-val">$50K</div>
                        </div>
                        <div className="mockup-card">
                          <div className="mockup-card-name">DataInc</div>
                          <div className="mockup-card-val">$45K</div>
                        </div>
                      </div>
                      <div className="mockup-col">
                        <div className="mockup-col-label">Closing</div>
                        <div className="mockup-col-count">3</div>
                        <div className="mockup-card mockup-card-ai">
                          <div className="mockup-card-name">MegaCorp</div>
                          <div className="mockup-card-val">Win: 87%</div>
                        </div>
                      </div>
                    </div>
                    <div className="mockup-ai">
                      <span className="mockup-ai-pulse" />
                      <span className="mockup-ai-text"><strong>AI:</strong> 3 deals at risk — <span style={{ color: "var(--primary-500)" }}>View</span></span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── FEATURES ──────────────────────────────────── */}
        <section className="features" id="features">
          <div className="container">
            <div className="features-head reveal">
              <span className="section-tag">Platform Capabilities</span>
              <h2 className="section-title">
                Everything a Modern Sales Team<br /><span className="accent">Needs to Close Deals Faster.</span>
              </h2>
              <p className="section-desc">
                From AI-powered lead scoring to visual workflow automation —
                TZAHU gives your team superpowers without the complexity.
              </p>
            </div>
            <div className="features-grid stagger">

              <div className="feature-card">
                <div className="feature-icon">
                  <svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 0 0-2 19.7V17h-1v-4h1v-1a3 3 0 0 1 3-3h1v4h-1v1h1a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2v3.7A10 10 0 1 0 12 2z" /></svg>
                </div>
                <div className="feature-body">
                  <div className="feature-name">AI-Native Intelligence</div>
                  <p className="feature-text">Every entity has embedding vectors. Every search is semantic. Every workflow can invoke an AI decision. No add-ons, no extra costs, no bolt-ons.</p>
                  <div className="feature-pills">
                    <span className="feature-pill">LLM Scoring</span>
                    <span className="feature-pill">Semantic Search</span>
                    <span className="feature-pill">RAG Pipeline</span>
                  </div>
                </div>
              </div>

              <div className="feature-card">
                <div className="feature-icon">
                  <svg viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" fill="none" /><polyline points="14 2 14 8 20 8" stroke="currentColor" fill="none" /><line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" /><line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" /></svg>
                </div>
                <div className="feature-body">
                  <div className="feature-name">Visual Workflow Builder</div>
                  <p className="feature-text">Drag, drop, automate. Build multi-step workflows with triggers, conditions, and actions — no coding required. AI-powered decision nodes included.</p>
                  <div className="feature-pills">
                    <span className="feature-pill">Event Triggers</span>
                    <span className="feature-pill">AI Nodes</span>
                    <span className="feature-pill">Approvals</span>
                  </div>
                </div>
              </div>

              <div className="feature-card">
                <div className="feature-icon">
                  <svg viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" /><rect x="14" y="3" width="7" height="4" rx="1" stroke="currentColor" /><rect x="14" y="10" width="7" height="4" rx="1" stroke="currentColor" /><rect x="3" y="13" width="7" height="8" rx="1" stroke="currentColor" /><rect x="14" y="17" width="7" height="4" rx="1" stroke="currentColor" /></svg>
                </div>
                <div className="feature-body">
                  <div className="feature-name">Pipeline &amp; Opportunity Management</div>
                  <p className="feature-text">Visualize your entire sales pipeline with kanban boards, customizable stages, and weighted forecasting. Drag deals between stages with a single click.</p>
                  <div className="feature-pills">
                    <span className="feature-pill">Kanban View</span>
                    <span className="feature-pill">Forecasting</span>
                    <span className="feature-pill">Win/Loss</span>
                  </div>
                </div>
              </div>

              <div className="feature-card">
                <div className="feature-icon">
                  <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" /><path d="M2 12h20" stroke="currentColor" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" stroke="currentColor" /></svg>
                </div>
                <div className="feature-body">
                  <div className="feature-name">Deep Integrations</div>
                  <p className="feature-text">Connect with Google Workspace, Microsoft 365, Slack, SendGrid, and Twilio out of the box. Open API and webhook-native for anything else.</p>
                  <div className="feature-pills">
                    <span className="feature-pill">REST API</span>
                    <span className="feature-pill">Webhooks</span>
                    <span className="feature-pill">OAuth 2.0</span>
                  </div>
                </div>
              </div>

              <div className="feature-card">
                <div className="feature-icon">
                  <svg viewBox="0 0 24 24" fill="none"><rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" /><path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" /></svg>
                </div>
                <div className="feature-body">
                  <div className="feature-name">Enterprise-Grade Security</div>
                  <p className="feature-text">PostgreSQL Row-Level Security ensures tenant isolation at the database level. JWT with RS256 signing, refresh rotation, and bcrypt password hashing.</p>
                  <div className="feature-pills">
                    <span className="feature-pill">RLS</span>
                    <span className="feature-pill">RBAC</span>
                    <span className="feature-pill">Audit Log</span>
                  </div>
                </div>
              </div>

              <div className="feature-card">
                <div className="feature-icon">
                  <svg viewBox="0 0 24 24" fill="none"><path d="M18 20V10" stroke="currentColor" /><path d="M12 20V4" stroke="currentColor" /><path d="M6 20v-6" stroke="currentColor" /></svg>
                </div>
                <div className="feature-body">
                  <div className="feature-name">Reports &amp; Dashboards</div>
                  <p className="feature-text">Build custom reports with drag-and-drop. Track pipeline velocity, conversion rates, and team performance. Schedule delivery to email or Slack.</p>
                  <div className="feature-pills">
                    <span className="feature-pill">Report Builder</span>
                    <span className="feature-pill">Dashboards</span>
                    <span className="feature-pill">Exports</span>
                  </div>
                </div>
              </div>

              <div className="feature-card">
                <div className="feature-icon">
                  <svg viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" /></svg>
                </div>
                <div className="feature-body">
                  <div className="feature-name">Activity &amp; Communication Hub</div>
                  <p className="feature-text">Log calls, emails, and meetings against any entity. Sync with Google Calendar and Outlook. AI-powered summarization on every conversation.</p>
                  <div className="feature-pills">
                    <span className="feature-pill">Email Sync</span>
                    <span className="feature-pill">Calendar</span>
                    <span className="feature-pill">Activity Log</span>
                  </div>
                </div>
              </div>

              <div className="feature-card">
                <div className="feature-icon">
                  <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="5" stroke="currentColor" /><path d="M3 21v-2a7 7 0 0 1 7-7h4a7 7 0 0 1 7 7v2" stroke="currentColor" /></svg>
                </div>
                <div className="feature-body">
                  <div className="feature-name">Lead Scoring &amp; Conversion</div>
                  <p className="feature-text">AI-driven lead scoring with explainable factors. Auto-assign leads via round-robin, territory, or skill-based rules. Convert seamlessly to contacts.</p>
                  <div className="feature-pills">
                    <span className="feature-pill">Scoring</span>
                    <span className="feature-pill">Auto-Assign</span>
                    <span className="feature-pill">Dedup</span>
                  </div>
                </div>
              </div>

              {/* ── New Feature Cards ── */}

              <div className="feature-card">
                <div className="feature-icon">
                  <svg viewBox="0 0 24 24" fill="none"><path d="M4 6h16M4 12h16M4 18h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><circle cx="20" cy="18" r="3" stroke="currentColor"/><path d="M22 18h-4" stroke="currentColor"/></svg>
                </div>
                <div className="feature-body">
                  <div className="feature-name">Unified Inbox</div>
                  <p className="feature-text">Connect WhatsApp Cloud API, Instagram DM, and Facebook Messenger via Meta Business Account. Unified conversation view with reply, assign, close, and automatic contact linking.</p>
                  <div className="feature-pills">
                    <span className="feature-pill">WhatsApp</span>
                    <span className="feature-pill">Instagram DM</span>
                    <span className="feature-pill">Messenger</span>
                  </div>
                </div>
              </div>

              <div className="feature-card">
                <div className="feature-icon">
                  <svg viewBox="0 0 24 24" fill="none"><path d="M12 2a4 4 0 0 0-4 4v2M12 2a4 4 0 0 1 4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M8 8h8v10a4 4 0 0 1-4 4 4 4 0 0 1-4-4V8z" stroke="currentColor"/><path d="M12 18v-4" stroke="currentColor" strokeWidth="1.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>
                </div>
                <div className="feature-body">
                  <div className="feature-name">Voice AI &amp; Calling</div>
                  <p className="feature-text">Twilio-powered call logging, recording, and real-time transcription via Deepgram. Post-call analysis with sentiment detection, talk ratio, objection identification, and AI coaching suggestions.</p>
                  <div className="feature-pills">
                    <span className="feature-pill">Call Logging</span>
                    <span className="feature-pill">Transcription</span>
                    <span className="feature-pill">AI Coaching</span>
                  </div>
                </div>
              </div>

              <div className="feature-card">
                <div className="feature-icon">
                  <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8" stroke="currentColor"/><path d="M12 8v4l3 3" stroke="currentColor"/></svg>
                </div>
                <div className="feature-body">
                  <div className="feature-name">AI Agents &amp; Assistant</div>
                  <p className="feature-text">Natural language query engine for CRM data. AI assistant that creates tasks, updates fields, and generates summaries. RAG pipeline for document Q&amp;A. Next-best-action recommendations.</p>
                  <div className="feature-pills">
                    <span className="feature-pill">AI Assistant</span>
                    <span className="feature-pill">RAG Pipeline</span>
                    <span className="feature-pill">NBA Engine</span>
                  </div>
                </div>
              </div>

              <div className="feature-card">
                <div className="feature-icon">
                  <svg viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor"/><polyline points="14 2 14 8 20 8" stroke="currentColor"/><path d="M8 13h2l2 3 2-3h2" stroke="currentColor"/></svg>
                </div>
                <div className="feature-body">
                  <div className="feature-name">Document Management</div>
                  <p className="feature-text">MinIO-powered file storage with upload, preview, versioning, and folder organization. Attach documents to any entity. Storage quota enforcement per tenant.</p>
                  <div className="feature-pills">
                    <span className="feature-pill">Upload</span>
                    <span className="feature-pill">Versioning</span>
                    <span className="feature-pill">Preview</span>
                  </div>
                </div>
              </div>

              <div className="feature-card">
                <div className="feature-icon">
                  <svg viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor"/><path d="M3 9h18" stroke="currentColor"/><path d="M9 3v18" stroke="currentColor"/></svg>
                </div>
                <div className="feature-body">
                  <div className="feature-name">Custom Fields &amp; Objects</div>
                  <p className="feature-text">Extend any entity with custom fields: text, number, date, picklist, lookup, checkbox, and formula. Create entirely custom object types with relationships, views, and permissions.</p>
                  <div className="feature-pills">
                    <span className="feature-pill">Custom Fields</span>
                    <span className="feature-pill">Custom Objects</span>
                    <span className="feature-pill">Formulas</span>
                  </div>
                </div>
              </div>

              <div className="feature-card">
                <div className="feature-icon">
                  <svg viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor"/><path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor"/><circle cx="12" cy="15" r="1" fill="currentColor"/><circle cx="16" cy="15" r="1" fill="currentColor"/><circle cx="8" cy="15" r="1" fill="currentColor"/></svg>
                </div>
                <div className="feature-body">
                  <div className="feature-name">Calendar &amp; Meeting Sync</div>
                  <p className="feature-text">Bidirectional sync with Google Calendar and Outlook. Create meetings directly from CRM entities. Conflict detection, attendee management, and automatic activity logging.</p>
                  <div className="feature-pills">
                    <span className="feature-pill">Google Sync</span>
                    <span className="feature-pill">Outlook Sync</span>
                    <span className="feature-pill">Meeting Logs</span>
                  </div>
                </div>
              </div>

              <div className="feature-card">
                <div className="feature-icon">
                  <svg viewBox="0 0 24 24" fill="none"><path d="M4 4h16v4H4z" stroke="currentColor"/><path d="M4 10h16v4H4z" stroke="currentColor"/><path d="M4 16h16v4H4z" stroke="currentColor"/></svg>
                </div>
                <div className="feature-body">
                  <div className="feature-name">Marketing Campaigns</div>
                  <p className="feature-text">Design and execute multi-channel campaigns with email, SMS, and social. Audience segmentation, A/B testing, automated triggers, and detailed ROI analytics per campaign.</p>
                  <div className="feature-pills">
                    <span className="feature-pill">Segmentation</span>
                    <span className="feature-pill">Automation</span>
                    <span className="feature-pill">Analytics</span>
                  </div>
                </div>
              </div>

              <div className="feature-card">
                <div className="feature-icon">
                  <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor"/><path d="M12 6v6l4 2" stroke="currentColor"/></svg>
                </div>
                <div className="feature-body">
                  <div className="feature-name">Workflow Automation</div>
                  <p className="feature-text">Advanced approval workflows with single, sequential, and parallel chains. Escalation on timeout, cron-based triggers, workflow templates, and test-run mode.</p>
                  <div className="feature-pills">
                    <span className="feature-pill">Approvals</span>
                    <span className="feature-pill">Cron Triggers</span>
                    <span className="feature-pill">Escalation</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ─── INTEGRATIONS ──────────────────────────────── */}
        <section className="integrations" id="integrations">
          <div className="container">
            <div className="integrations-head reveal">
              <span className="section-tag">Connect Everything</span>
              <h2 className="section-title">
                <span className="accent">50+ Integrations</span> &amp; Growing
              </h2>
              <p className="section-desc">
                Turn every message, comment, and conversation into a customer relationship — then
                connect the rest of the tools your team relies on.
              </p>
            </div>
            <div className="meta-connection reveal">
              <div>
                <div className="meta-kicker"><i /> Meta Business connection</div>
                <h3 className="meta-title">One inbox for every customer conversation.</h3>
                <p className="meta-copy">
                  Connect your Meta Business account once and give your team one shared view of
                  Facebook Messenger, Instagram, and WhatsApp — with every conversation linked to the right contact.
                </p>
                <div className="meta-benefits">
                  <span className="meta-benefit">Unified team inbox</span>
                  <span className="meta-benefit">Instant contact matching</span>
                  <span className="meta-benefit">Reply, assign &amp; resolve</span>
                </div>
              </div>
              <div className="meta-visual" aria-label="Meta platforms connected to TZAHU">
                <div className="meta-orbit" />
                <div className="meta-node facebook" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="25" height="25" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                </div>
                <div className="meta-node instagram" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="23" height="23" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 010-2.881z" /></svg>
                </div>
                <div className="meta-node whatsapp" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884" /></svg>
                </div>
                <div className="meta-core" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12c2.6-5.6 5.5-5.6 7 0 1.5 5.6 4.4 5.6 7 0" /><path d="M4 16c2.7-4.2 5.7-4.2 8 0 2.3 4.2 5.3 4.2 8 0" /></svg>
                </div>
              </div>
            </div>
            <div className="integrations-grid stagger">
              <div className="integration-card">
                <div className="integration-icon meta">
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                </div>
                <div className="integration-name">Facebook<span>Messenger · Pages · Ads</span></div>
              </div>
              <div className="integration-card">
                <div className="integration-icon instagram">
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                </div>
                <div className="integration-name">Instagram<span>DM · Comments · Stories</span></div>
              </div>
              <div className="integration-card">
                <div className="integration-icon whatsapp">
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                </div>
                <div className="integration-name">WhatsApp<span>Cloud API · Templates</span></div>
              </div>
              <div className="integration-card">
                <div className="integration-icon google">
                  <svg viewBox="0 0 24 24" width="24" height="24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                </div>
                <div className="integration-name">Google<span>Calendar · Contacts · Workspace</span></div>
              </div>
              <div className="integration-card">
                <div className="integration-icon microsoft">
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><rect x="2" y="2" width="9.5" height="9.5" fill="#F25022"/><rect x="12.5" y="2" width="9.5" height="9.5" fill="#7FBA00"/><rect x="2" y="12.5" width="9.5" height="9.5" fill="#00A4EF"/><rect x="12.5" y="12.5" width="9.5" height="9.5" fill="#FFB900"/></svg>
                </div>
                <div className="integration-name">Microsoft<span>365 · Outlook · Teams</span></div>
              </div>
              <div className="integration-card">
                <div className="integration-icon slack">
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M5.042 15.165a2.528 2.528 0 01-2.52 2.523A2.528 2.528 0 010 15.165a2.527 2.527 0 012.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 012.52-2.52 2.527 2.527 0 012.52 2.52v6.313A2.528 2.528 0 018.833 24a2.528 2.528 0 01-2.52-2.522v-6.313zM8.833 5.042a2.528 2.528 0 01-2.52-2.52A2.528 2.528 0 018.833 0a2.528 2.528 0 012.52 2.522v2.52H8.833zM8.833 6.313a2.527 2.527 0 012.52 2.52 2.527 2.527 0 01-2.52 2.52H2.52A2.527 2.527 0 010 8.833a2.527 2.527 0 012.522-2.52h6.311zM18.958 8.833a2.528 2.528 0 012.52-2.52A2.528 2.528 0 0124 8.833a2.528 2.528 0 01-2.522 2.52h-2.52v-2.52zM17.687 8.833a2.527 2.527 0 01-2.52 2.52 2.527 2.527 0 01-2.52-2.52V2.52A2.527 2.527 0 0115.167 0a2.527 2.527 0 012.52 2.522v6.311zM15.167 18.958a2.528 2.528 0 012.52 2.52A2.528 2.528 0 0115.167 24a2.528 2.528 0 01-2.52-2.522v-2.52h2.52zM15.167 17.687a2.527 2.527 0 01-2.52-2.52 2.527 2.527 0 012.52-2.52h6.313A2.528 2.528 0 0124 15.167a2.528 2.528 0 01-2.522 2.52h-6.311z"/></svg>
                </div>
                <div className="integration-name">Slack<span>Notifications · Commands</span></div>
              </div>
              <div className="integration-card">
                <div className="integration-icon twilio">
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 21.6A9.6 9.6 0 1112 2.4a9.6 9.6 0 010 19.2zM8.4 9.6a1.2 1.2 0 110-2.4 1.2 1.2 0 010 2.4zM12 9.6a1.2 1.2 0 110-2.4 1.2 1.2 0 010 2.4zm3.6 0a1.2 1.2 0 110-2.4 1.2 1.2 0 010 2.4zm-7.2 4.8a1.2 1.2 0 11-2.4 0 1.2 1.2 0 012.4 0zm3.6 0a1.2 1.2 0 11-2.4 0 1.2 1.2 0 012.4 0zm3.6 0a1.2 1.2 0 11-2.4 0 1.2 1.2 0 012.4 0z"/></svg>
                </div>
                <div className="integration-name">Twilio<span>SMS · Voice · WhatsApp API</span></div>
              </div>
              <div className="integration-card">
                <div className="integration-icon hubspot">
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M18.2 9.99V6.77c.91-.5 1.54-1.47 1.54-2.6 0-1.65-1.34-2.99-2.99-2.99a3.006 3.006 0 00-2.44 4.73l-3.97 2.3a.987.987 0 00-.41-.15V5.68c.89-.45 1.52-1.35 1.52-2.4a2.72 2.72 0 00-2.72-2.72A2.72 2.72 0 006 3.28c0 1.07.64 1.99 1.55 2.43v5.56c-.27.08-.53.21-.78.37L4.05 8.15c.24-.4.38-.87.38-1.37 0-1.5-1.22-2.72-2.72-2.72A2.715 2.715 0 00-.98 7.3c.88.53 2.01.31 2.62-.4l2.6 2.59c-.58.74-.51 1.76.21 2.42l-2.42 6.53c-.15.05-.31.08-.47.08A1.46 1.46 0 00.1 20c.81.8 2.1.8 2.9 0a2.05 2.05 0 000-2.9l2.29-6.19c.11-.01.22-.03.33-.05l3.96 4.21c.02.18.08.34.16.5l-2.04 5.5c-.13.05-.27.07-.41.07-1.05 0-1.9.85-1.9 1.9s.85 1.9 1.9 1.9 1.9-.85 1.9-1.9c0-.04-.01-.07-.01-.11l2.02-5.45c.37-.06.73-.16 1.06-.3l4.15 2.56c-.08.37-.13.76-.13 1.16 0 2.43 1.97 4.4 4.4 4.4s4.4-1.97 4.4-4.4-1.97-4.4-4.4-4.4c-1.59 0-2.99.85-3.76 2.11l-4.19-2.58c.13-.34.2-.7.2-1.08 0-.2-.02-.39-.05-.58l3.97-2.3c.5.53 1.21.87 1.99.87 1.5 0 2.72-1.22 2.72-2.72 0-.27-.05-.53-.12-.77zm.28-7.48c.9 0 1.63.73 1.63 1.63 0 .9-.73 1.63-1.63 1.63-.9 0-1.63-.73-1.63-1.63 0-.9.73-1.63 1.63-1.63z"/></svg>
                </div>
                <div className="integration-name">HubSpot<span>Import · Contact Sync</span></div>
              </div>
              <div className="integration-card">
                <div className="integration-icon salesforce">
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M10.6 2.5c-2.4 0-4.3 1.6-4.8 3.8C3.9 7 2.5 8.8 2.5 11c0 1.6.7 3 1.8 4-.2.5-.3 1-.3 1.5 0 2.2 1.6 4 3.7 4.4.6 1.3 1.9 2.2 3.4 2.2 1.1 0 2.1-.5 2.8-1.2.5.1 1 .2 1.5.2 3 0 5.5-2.5 5.5-5.5 0-1-.3-2-.8-2.8.2-.5.3-1.1.3-1.7 0-3-2.5-5.5-5.5-5.5-.9 0-1.7.2-2.5.6-.7-.7-1.7-1.2-2.8-1.2z"/></svg>
                </div>
                <div className="integration-name">Salesforce<span>Import · Bidirectional</span></div>
              </div>
              <div className="integration-card">
                <div className="integration-icon sendgrid">
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M4 4h16v2H4V4zm0 5h16v2H4V9zm0 5h16v2H4v-2zm0 5h10v2H4v-2z"/></svg>
                </div>
                <div className="integration-name">SendGrid<span>Email · Templates</span></div>
              </div>
              <div className="integration-card">
                <div className="integration-icon mailchimp">
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M21.2 9.6c-.2-.6-.6-1.2-1.1-1.6-.5-.5-1.1-.8-1.7-1-.7-.2-1.4-.3-2.2-.3H7.8c-.7 0-1.5.1-2.2.3-.7.2-1.2.5-1.7 1-.5.4-.9 1-1.1 1.6-.2.6-.3 1.2-.3 1.8 0 .6.1 1.2.3 1.8.2.6.6 1.2 1.1 1.6s1.1.8 1.7 1c.7.2 1.4.3 2.2.3h8.4c.7 0 1.5-.1 2.2-.3.7-.2 1.2-.5 1.7-1 .5-.5.9-1 1.1-1.6.2-.6.3-1.2.3-1.8 0-.6-.1-1.2-.3-1.8zM12 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg>
                </div>
                <div className="integration-name">Mailchimp<span>Campaigns · Audiences</span></div>
              </div>
              <div className="integration-card">
                <div className="integration-icon github">
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
                </div>
                <div className="integration-name">GitHub<span>Issues · Deployments</span></div>
              </div>
              <div className="integration-card">
                <div className="integration-icon linkedin">
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                </div>
                <div className="integration-name">LinkedIn<span>Lead Gen · Pages</span></div>
              </div>
              <div className="integration-card">
                <div className="integration-icon zoom">
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M22.746 3.891a1.715 1.715 0 00-.934-.501c-.759-.123-6.529-.39-9.812-.39-3.273 0-9.054.267-9.812.39a1.717 1.717 0 00-.934.501C.339 4.936.059 5.368.044 6.252c-.015.884-.044 3.497-.044 5.748 0 2.251.029 4.864.044 5.748.015.884.295 1.316.21 2.361.066.208.2.391.379.526.395.268 1.152.445 1.755.519.759.123 6.529.39 9.812.39 3.273 0 9.054-.267 9.812-.39.603-.074 1.36-.251 1.755-.519.179-.135.313-.318.379-.526.566-1.045.295-1.477.21-2.361-.015-.884-.044-3.497-.044-5.748 0-2.251.029-4.864-.044-5.748-.015-.884-.295-1.316-.21-2.361zm-2.49 10.124c0 .538-.432.574-.432.574l-6.418.026c-.432 0-.575-.233-.575-.575v-3.104l-4.666 4.666c-.611.583-.865.172-.865.172-.359-.431-.324-.936-.324-.936l.008-4.563-4.666 4.666c-.611.583-.865.172-.865.172-.359-.431-.324-.936-.324-.936l.008-6.151c0-.432.396-.576.575-.576s.575.144.575.575v3.105l4.666-4.666c.33-.33.865-.172.865-.172.359.431.324.936.324.936l-.008 4.563 4.666-4.666c.33-.33.865-.172.865-.172.359.431.324.936.324.936l.008 6.151z"/></svg>
                </div>
                <div className="integration-name">Zoom<span>Meetings · Recordings</span></div>
              </div>
              <div className="integration-card">
                <div className="integration-icon shopify">
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M15.025 5.055c-.343-1.062-1.078-1.74-2.034-2.003.438.534.657 1.205.665 1.914.006.47-.164.933-.472 1.279.135.033.274.051.416.051 1.062 0 1.884-.7 1.936-1.593.01-.213.001-.427-.028-.637L15.025 5.055zm-2.286-1.53a3.522 3.522 0 00-.494-.037c-1.139 0-2.068.566-2.47 1.468l.646 1.952c.568-.607 1.332-.94 2.168-.94.068 0 .135.003.203.009-.196-.75-.37-1.473-.053-2.452zm-4.761 1.02c-.06.055-.115.116-.162.183l.571 1.726c.532-.532 1.134-.8 1.694-.947-.455-.56-1.08-.862-2.103-.962zM15.807 7.23a1.8 1.8 0 00-.388-.045c-1.386 0-2.487 1.108-2.487 2.585 0 .322.045.637.133.937.81.048 2.332-3.195 2.742-3.477z"/><path d="M19.175 6.504c-.398-.493-1.216-.782-2.072-.782-.803 0-1.571.165-2.192.44-1.398-1.281-3.382-1.506-5.085-.733.165-.066.388-.109.625-.109.643 0 1.279.181 1.741.508.798.567 1.395 1.56 1.533 2.562.146 1.065-.044 2.013-.555 2.735a2.05 2.05 0 01-.435.467c-.107.08-.1.139.004.168.206.058.458.092.746.092 1.095 0 1.977-.894 1.977-1.997 0-.085-.005-.169-.015-.251.944 1.138 2.417 1.138 3.646 1.138 1.476 0 2.406-.258 3.103-.604.657-.327.985-.749.912-1.045-.073-.297-.524-.434-1.196-.438l-1.443-.008c-.145 0-.283-.007-.406-.019 1.03-1.105 1.749-2.668 1.749-4.217 0-.728-.153-1.384-.445-1.881zM8.342 6.428c-.134.172-.583.677-1.2.888.373-1.004 1.202-1.446 1.898-1.69l-.698.802z"/></svg>
                </div>
                <div className="integration-name">Shopify<span>Orders · Customers</span></div>
              </div>
              <div className="integration-card">
                <div className="integration-icon api">
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M18 10h2a2 2 0 012 2v4a2 2 0 01-2 2h-2M8 10H6a2 2 0 00-2 2v4a2 2 0 002 2h2m4-10v10m-2-6l2 2-2 2"/></svg>
                </div>
                <div className="integration-name">Open API<span>REST · Webhooks · SDK</span></div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── CTA ───────────────────────────────────────── */}
        <section className="cta" id="cta">
          <div className="cta-bg" />
          <div className="cta-grid" />
          <div className="container">
            <div className="cta-layout">
              <div className="reveal-l">
                <h2 className="cta-title">Ready to Transform<br />Your Sales Pipeline?</h2>
                <p className="cta-desc">
                  Join hundreds of forward-thinking sales teams already using TZAHU.
                  No consultants. No lock-in. Just a CRM that finally works the way you do.
                </p>
                <div className="cta-actions">
                  <a href="/register" className="cta-btn primary">
                    Get Started Free
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
                  </a>
                  <a href="/login" className="cta-btn ghost">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    Sign In
                  </a>
                </div>
              </div>
              <div className="cta-visual reveal-r">
                <div className="cta-card">
                  <div className="cta-card-item">
                    <div className="cta-card-check">&#10003;</div>
                    <div className="cta-card-text"><strong>Free</strong> for up to 5 users</div>
                  </div>
                  <div className="cta-card-item">
                    <div className="cta-card-check">&#10003;</div>
                    <div className="cta-card-text"><strong>No credit card</strong> required</div>
                  </div>
                  <div className="cta-card-item">
                    <div className="cta-card-check">&#10003;</div>
                    <div className="cta-card-text"><strong>Full CRM features</strong> included</div>
                  </div>
                  <div className="cta-card-item">
                    <div className="cta-card-check">&#10003;</div>
                    <div className="cta-card-text"><strong>AI features</strong> enabled from day one</div>
                  </div>
                  <div className="cta-card-item">
                    <div className="cta-card-check">&#10003;</div>
                    <div className="cta-card-text"><strong>Cancel anytime</strong> — no lock-in</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ─── FOOTER ──────────────────────────────────────── */}
      <footer className="lp-footer" role="contentinfo">
        <div className="container">
          <div className="footer-inner">
            <div className="footer-brand">
              <img src="/tzaho.png" alt="TZAHU CRM" />
              <div className="footer-brand-name">TZAHU CRM</div>
              <p className="footer-brand-desc">
                The most adaptable AI-first enterprise CRM platform. Your process, powered by AI.
              </p>
            </div>
            <div className="footer-col">
              <div className="footer-col-label">Product</div>
              <a href="#features">Features</a>
              <a href="#">Integrations</a>
              <a href="#">Changelog</a>
              <a href="#">Documentation</a>
            </div>
            <div className="footer-col">
              <div className="footer-col-label">Company</div>
              <a href="#">About</a>
              <a href="#">Blog</a>
              <a href="#">Careers</a>
              <a href="#">Contact</a>
            </div>
            <div className="footer-col">
              <div className="footer-col-label">Developers</div>
              <a href="#">API Reference</a>
              <a href="#">SDK</a>
              <a href="#">Status</a>
              <a href="#">Security</a>
            </div>
          </div>
          <div className="footer-bottom">
            <span>&copy; 2026 TZAHU CRM. All rights reserved.</span>
            <div className="footer-socials">
              <a href="#" aria-label="GitHub"><svg viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg></a>
              <a href="#" aria-label="Twitter"><svg viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg></a>
              <a href="#" aria-label="LinkedIn"><svg viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg></a>
              <a href="#" aria-label="Slack"><svg viewBox="0 0 24 24"><path d="M5.042 15.165a2.528 2.528 0 01-2.52 2.523A2.528 2.528 0 010 15.165a2.527 2.527 0 012.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 012.52-2.52 2.527 2.527 0 012.52 2.52v6.313A2.528 2.528 0 018.833 24a2.528 2.528 0 01-2.52-2.522v-6.313zM8.833 5.042a2.528 2.528 0 01-2.52-2.52A2.528 2.528 0 018.833 0a2.528 2.528 0 012.52 2.522v2.52H8.833zM8.833 6.313a2.527 2.527 0 012.52 2.52 2.527 2.527 0 01-2.52 2.52H2.52A2.527 2.527 0 010 8.833a2.527 2.527 0 012.522-2.52h6.311zM18.958 8.833a2.528 2.528 0 012.52-2.52A2.528 2.528 0 0124 8.833a2.528 2.528 0 01-2.522 2.52h-2.52v-2.52zM17.687 8.833a2.527 2.527 0 01-2.52 2.52 2.527 2.527 0 01-2.52-2.52V2.52A2.527 2.527 0 0115.167 0a2.527 2.527 0 012.52 2.522v6.311zM15.167 18.958a2.528 2.528 0 012.52 2.52A2.528 2.528 0 0115.167 24a2.528 2.528 0 01-2.52-2.522v-2.52h2.52zM15.167 17.687a2.527 2.527 0 01-2.52-2.52 2.527 2.527 0 012.52-2.52h6.313A2.528 2.528 0 0124 15.167a2.528 2.528 0 01-2.522 2.52h-6.311z"/></svg></a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
