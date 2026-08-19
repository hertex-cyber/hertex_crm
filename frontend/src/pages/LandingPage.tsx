import ArrowOutwardRoundedIcon from "@mui/icons-material/ArrowOutwardRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import InsightsOutlinedIcon from "@mui/icons-material/InsightsOutlined";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import ViewKanbanOutlinedIcon from "@mui/icons-material/ViewKanbanOutlined";
import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@features/auth/AuthProvider";
import Background from "@components/layout/Background";
import "./LandingPage.css";

const proofPoints = [
  "A single source of truth for every relationship",
  "Clear next steps across your whole pipeline",
  "Built for the way your team actually works",
];

const features = [
  {
    icon: <GroupsOutlinedIcon />,
    number: "01",
    title: "Relationships, remembered.",
    body: "Bring every conversation, contact, and account into one calm, connected workspace.",
  },
  {
    icon: <ViewKanbanOutlinedIcon />,
    number: "02",
    title: "A clearer way to grow.",
    body: "Move opportunities forward with a visual pipeline that keeps momentum easy to see.",
  },
  {
    icon: <InsightsOutlinedIcon />,
    number: "03",
    title: "Insight with intention.",
    body: "See what is working, where to focus, and the next useful action without the noise.",
  },
];

function LandingPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  if (!isLoading && isAuthenticated) return <Navigate to="/dashboard" replace />;

  return (
    <main id="landing-page">
      <section className="lp-hero" id="top">
        <Background />
        <nav className="lp-nav" aria-label="Primary navigation">
          <div className="lp-container lp-nav-inner">
            <a className="lp-brand" href="#top" aria-label="Hertex Cultivate home">
              <img src="/business-person.svg" alt="" />
              <span>hertex cultivate</span>
            </a>

            <div className="lp-desktop-nav">
              <a href="#product">Product</a>
              <a href="#how-it-works">How it works</a>
              <a href="#story">Our approach</a>
            </div>

            <div className="lp-nav-actions">
              <Link className="lp-login-link" to="/login">Log in</Link>
              <Link className="lp-button lp-button--small" to="/register">Start growing <ArrowOutwardRoundedIcon /></Link>
            </div>

            <button
              className="lp-menu-button"
              type="button"
              aria-label="Toggle navigation menu"
              aria-expanded={isMenuOpen}
              onClick={() => setIsMenuOpen((open) => !open)}
            >
              <MenuRoundedIcon />
            </button>
          </div>

          {isMenuOpen && (
            <div className="lp-mobile-nav">
              <a href="#product" onClick={() => setIsMenuOpen(false)}>Product</a>
              <a href="#how-it-works" onClick={() => setIsMenuOpen(false)}>How it works</a>
              <a href="#story" onClick={() => setIsMenuOpen(false)}>Our approach</a>
              <Link to="/login" onClick={() => setIsMenuOpen(false)}>Log in</Link>
              <Link className="lp-button" to="/register" onClick={() => setIsMenuOpen(false)}>Start growing <ArrowOutwardRoundedIcon /></Link>
            </div>
          )}
        </nav>

        <div className="lp-container lp-hero-grid">
          <div className="lp-hero-copy">
            <p className="lp-eyebrow"><span /> Relationship intelligence, made human</p>
            <h1>Grow with a <em>clearer</em><br />point of view.</h1>
            <p className="lp-lead">Hertex Cultivate brings your people, opportunities, and customer history into focus—so your team can spend less time searching and more time building lasting relationships.</p>
            <div className="lp-hero-actions">
              <Link className="lp-button" to="/register">Start growing <ArrowOutwardRoundedIcon /></Link>
              <a className="lp-text-action" href="#product"><PlayArrowRoundedIcon /> Explore the workspace</a>
            </div>
            <div className="lp-proof-list">
              {proofPoints.map((point) => <div key={point}><CheckRoundedIcon /> <span>{point}</span></div>)}
            </div>
          </div>

          <div className="lp-product-frame" aria-label="A preview of the Hertex Cultivate workspace">
            <div className="lp-window-bar">
              <div className="lp-window-brand"><img src="/business-person.svg" alt="" /> cultivate</div>
              <div className="lp-window-dots"><span /><span /><span /></div>
            </div>
            <div className="lp-dashboard-preview">
              <aside className="lp-preview-sidebar">
                <span className="lp-preview-mark">h</span>
                <span className="lp-preview-active" />
                <span /><span /><span /><span />
              </aside>
              <div className="lp-preview-content">
                <div className="lp-preview-header"><div><p>Good morning, Jordan</p><strong>Your cultivation overview</strong></div><span className="lp-avatar">JH</span></div>
                <div className="lp-preview-metrics">
                  <article><span>Open opportunities</span><strong>24</strong><small><TrendingUpRoundedIcon /> 18% this month</small></article>
                  <article><span>Relationship health</span><strong>86<span>%</span></strong><small className="olive"><AutoAwesomeRoundedIcon /> Looking good</small></article>
                </div>
                <div className="lp-preview-split">
                  <section className="lp-pipeline-card">
                    <div className="lp-card-heading"><strong>Pipeline</strong><span>View all</span></div>
                    {["Discovery", "Proposal", "Growing"].map((stage, index) => <div className="lp-pipeline-row" key={stage}><span className={`lp-stage-dot dot-${index}`} /><span>{stage}</span><div><i style={{ width: `${[72, 48, 30][index]}%` }} /></div><b>{[8, 5, 3][index]}</b></div>)}
                  </section>
                  <section className="lp-focus-card"><div className="lp-card-heading"><strong>Today&apos;s focus</strong><AutoAwesomeRoundedIcon /></div><p>Reconnect with people who have gone quiet.</p><div className="lp-contact"><span>SR</span><div><strong>Sam Rivera</strong><small>Haven Studio</small></div></div><button type="button">Send a note <ArrowOutwardRoundedIcon /></button></section>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="lp-container lp-hero-footnote"><span>Thoughtfully designed for teams that value the relationship behind the revenue.</span><a href="#product">Scroll to explore <span>↓</span></a></div>
      </section>

      <section className="lp-intro" id="story">
        <div className="lp-container lp-intro-grid">
          <p className="lp-eyebrow lp-eyebrow--dark"><span /> Less software. More clarity.</p>
          <h2>Your customer story should feel <em>connected</em>, not scattered.</h2>
          <div><p>Most CRM tools make you adapt to their system. Cultivate is designed around the natural rhythm of building trust: noticing the details, staying present, and knowing what needs care next.</p><a className="lp-text-action lp-text-action--dark" href="#how-it-works">See how it works <ArrowOutwardRoundedIcon /></a></div>
        </div>
      </section>

      <section className="lp-features" id="product">
        <div className="lp-container">
          <div className="lp-section-heading"><div><p className="lp-eyebrow lp-eyebrow--dark"><span /> The cultivation system</p><h2>Everything you need<br />to nurture momentum.</h2></div><p>One considered workspace for the day-to-day work of knowing your customers well.</p></div>
          <div className="lp-feature-grid">
            {features.map((feature) => <article className="lp-feature-card" key={feature.number}><div className="lp-feature-top"><span className="lp-feature-icon">{feature.icon}</span><small>{feature.number}</small></div><h3>{feature.title}</h3><p>{feature.body}</p><a href="#how-it-works">Learn more <ArrowOutwardRoundedIcon /></a></article>)}
          </div>
        </div>
      </section>

      <section className="lp-workflow" id="how-it-works">
        <div className="lp-container lp-workflow-grid">
          <div className="lp-workflow-copy"><p className="lp-eyebrow lp-eyebrow--dark"><span /> Built for continuity</p><h2>See the whole relationship. <em>Know the next move.</em></h2><p>From the first introduction to the next renewal, Cultivate gives every teammate a shared understanding of what matters now.</p><Link className="lp-button" to="/register">Build a better rhythm <ArrowOutwardRoundedIcon /></Link></div>
          <div className="lp-relationship-card"><div className="lp-relationship-line" /><div className="lp-relationship-person"><span>AE</span><div><small>Relationship lead</small><strong>Avery Ellis</strong><p>Introduced a new opportunity</p></div></div><div className="lp-relationship-person lp-relationship-person--offset"><span>NP</span><div><small>Decision maker</small><strong>Nora Patel</strong><p>Ready to revisit the proposal</p></div></div><div className="lp-relationship-note"><AutoAwesomeRoundedIcon /><p><strong>A thoughtful prompt</strong>It has been 14 days since the last conversation. A brief check-in may be useful.</p></div></div>
        </div>
      </section>

      <section className="lp-closing">
        <Background />
        <div className="lp-container lp-closing-content"><p className="lp-eyebrow"><span /> Make space for better work</p><h2>Customer relationships<br />deserve <em>more care.</em></h2><p>Build a CRM practice your team will actually want to return to.</p><Link className="lp-button" to="/register">Start with Hertex Cultivate <ArrowOutwardRoundedIcon /></Link></div>
      </section>

      <footer className="lp-footer"><div className="lp-container lp-footer-inner"><a className="lp-brand" href="#top"><img src="/business-person.svg" alt="" /><span>hertex cultivate</span></a><p>Designed for deeper customer relationships.</p><div><Link to="/login">Log in</Link><Link to="/register">Create an account</Link></div></div></footer>
    </main>
  );
}

export default LandingPage;
