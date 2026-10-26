import { useCallback, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useReducedMotion } from "../context/ReducedMotionContext";
import { useActiveSection } from "../hooks/useActiveSection";
import { useMediaQuery } from "../hooks/useMediaQuery";

const SECTIONS: { id: string; title: string; body: string; to?: string; cta?: string }[] = [
  {
    id: "what-is-creditra",
    title: "What is Creditra?",
    body: "Creditra is a decentralized, risk-priced credit protocol on Stellar. Credit lines are underwritten from on-chain behaviour rather than overcollateralization, and priced dynamically by risk score.",
  },
  {
    id: "dashboard",
    title: "Dashboard",
    body: "Your total limit, utilization, available credit, recent activity and the risk gauge for each credit line at a glance.",
    to: "/",
    cta: "Open dashboard",
  },
  {
    id: "credit-lines",
    title: "Credit lines",
    body: "Browse, filter, sort and compare your facilities. Each card shows limit, utilization, APR, risk score and a health-factor trend.",
    to: "/credit-lines",
    cta: "View credit lines",
  },
  {
    id: "risk-pricing",
    title: "Risk pricing",
    body: "Each credit line carries a risk score derived from on-chain repayment history, utilization and wallet activity. Lower risk earns a lower APR; the rate is re-priced as your score changes, and the risk gauge on the dashboard shows which band you are in.",
  },
  {
    id: "draw-and-repay",
    title: "Draw and repay",
    body: "Draw credit through a guided three-step wizard (with a default-risk education gate), and repay in full or in part with a preview before you confirm.",
    to: "/draw-credit",
    cta: "Draw credit",
  },
  {
    id: "transactions",
    title: "Transactions",
    body: "Full history with filters for type, amount, date range and status, plus CSV and PDF export.",
    to: "/transactions",
    cta: "View transactions",
  },
  {
    id: "demo-mode",
    title: "Demo mode",
    body: "This deployment runs entirely on built-in sample data. No backend or wallet is required, and nothing you do here moves real funds. Connecting a real backend is a matter of replacing the mock data layer in src/data/mockData.ts.",
  },
  {
    id: "keyboard-shortcuts",
    title: "Keyboard shortcuts",
    body: "Press Ctrl/Cmd + K for the command palette and ? for the shortcut overlay.",
  },
];

const SECTION_IDS = SECTIONS.map((s) => s.id);
const KNOWN_SLUGS = new Set(SECTION_IDS);

const headingId = (sectionId: string) => `${sectionId}-heading`;

export default function Docs() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isReducedMotionActive } = useReducedMotion();
  const activeSection = useActiveSection(SECTION_IDS);
  const isNarrow = useMediaQuery("(max-width: 767px)");

  // Read through a ref so toggling reduced motion doesn't re-run the hash effect.
  const reducedMotionRef = useRef(isReducedMotionActive);
  reducedMotionRef.current = isReducedMotionActive;

  /** Scrolls to a known section, then moves focus to its heading once. */
  const scrollToSection = useCallback((sectionId: string) => {
    if (!KNOWN_SLUGS.has(sectionId)) return;
    const section = document.getElementById(sectionId);
    if (!section) return;
    section.scrollIntoView({
      behavior: reducedMotionRef.current ? "instant" : "smooth",
      block: "start",
    });
    document.getElementById(headingId(sectionId))?.focus({ preventScroll: true });
  }, []);

  // Runs after the lazy route has rendered, so the target exists even on a
  // cold load where the browser's native hash scroll would have missed it.
  useEffect(() => {
    const targetId = location.hash.replace(/^#/, "");
    if (!targetId || !KNOWN_SLUGS.has(targetId)) return;

    const rafId = window.requestAnimationFrame(() => scrollToSection(targetId));
    return () => window.cancelAnimationFrame(rafId);
  }, [location.hash, scrollToSection]);

  const handleTocClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, sectionId: string) => {
      e.preventDefault();
      if (location.hash === `#${sectionId}`) {
        // Same hash: the effect won't re-run, so scroll directly.
        scrollToSection(sectionId);
      } else {
        navigate(`#${sectionId}`);
      }
    },
    [location.hash, navigate, scrollToSection],
  );

  const tocList = (
    <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "0.25rem" }}>
      {SECTIONS.map((s) => {
        const isCurrent = activeSection === s.id;
        return (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              onClick={(e) => handleTocClick(e, s.id)}
              aria-current={isCurrent ? "true" : undefined}
              style={{
                display: "block",
                padding: "0.35rem 0.5rem",
                borderRadius: 6,
                color: isCurrent ? "var(--accent)" : "var(--muted)",
                fontWeight: isCurrent ? 600 : 400,
                textDecoration: "none",
              }}
            >
              {s.title}
            </a>
          </li>
        );
      })}
    </ol>
  );

  const toc = (
    <nav
      aria-label="On this page"
      style={
        isNarrow
          ? { marginTop: "0.75rem" }
          : { position: "sticky", top: "1rem", alignSelf: "start" }
      }
    >
      {!isNarrow && (
        <p style={{ margin: "0 0 0.5rem", fontWeight: 600, fontSize: "0.9rem" }}>On this page</p>
      )}
      {tocList}
    </nav>
  );

  return (
    <div style={{ maxWidth: isNarrow ? 760 : 1000, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <h1>Documentation</h1>
      <p style={{ color: "var(--muted)" }}>
        A quick guide to the Creditra frontend.{" "}
        <a href="https://github.com/Creditra/Creditra-Frontend#readme" target="_blank" rel="noreferrer">
          Full docs on GitHub
        </a>
        .
      </p>
      <div
        style={
          isNarrow
            ? undefined
            : { display: "grid", gridTemplateColumns: "200px minmax(0, 1fr)", gap: "2rem", marginTop: "1rem" }
        }
      >
        {isNarrow ? (
          <details
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: "0.75rem 1rem",
              marginTop: "1rem",
            }}
          >
            <summary style={{ cursor: "pointer", fontWeight: 600 }}>On this page</summary>
            {toc}
          </details>
        ) : (
          toc
        )}
        <div>
          {SECTIONS.map((s, i) => (
            <section
              key={s.id}
              id={s.id}
              aria-labelledby={headingId(s.id)}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: "1.25rem 1.5rem",
                marginTop: i === 0 && !isNarrow ? 0 : "1rem",
                scrollMarginTop: "1rem",
              }}
            >
              <h2 id={headingId(s.id)} tabIndex={-1} style={{ marginTop: 0, fontSize: "1.15rem" }}>
                {s.title}
              </h2>
              <p style={{ color: "var(--muted)", margin: "0.5rem 0" }}>{s.body}</p>
              {s.to && (
                <Link to={s.to} style={{ color: "var(--accent)", fontWeight: 500 }}>
                  {s.cta} &rarr;
                </Link>
              )}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
