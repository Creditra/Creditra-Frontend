import { Link } from "react-router-dom";

const SECTIONS: { id?: string; title: string; body: string; to?: string; cta?: string }[] = [
  {
    title: "What is Creditra?",
    body: "Creditra is a decentralized, risk-priced credit protocol on Stellar. Credit lines are underwritten from on-chain behaviour rather than overcollateralization, and priced dynamically by risk score.",
  },
  {
    title: "Dashboard",
    body: "Your total limit, utilization, available credit, recent activity and the risk gauge for each credit line at a glance.",
    to: "/",
    cta: "Open dashboard",
  },
  {
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
    title: "Draw and repay",
    body: "Draw credit through a guided three-step wizard (with a default-risk education gate), and repay in full or in part with a preview before you confirm.",
    to: "/draw-credit",
    cta: "Draw credit",
  },
  {
    title: "Transactions",
    body: "Full history with filters for type, amount, date range and status, plus CSV and PDF export.",
    to: "/transactions",
    cta: "View transactions",
  },
  {
    title: "Demo mode",
    body: "This deployment runs entirely on built-in sample data. No backend or wallet is required, and nothing you do here moves real funds. Connecting a real backend is a matter of replacing the mock data layer in src/data/mockData.ts.",
  },
  {
    title: "Keyboard shortcuts",
    body: "Press Ctrl/Cmd + K for the command palette and ? for the shortcut overlay.",
  },
];

export default function Docs() {
  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <h1>Documentation</h1>
      <p style={{ color: "var(--muted)" }}>
        A quick guide to the Creditra frontend.{" "}
        <a href="https://github.com/Creditra/Creditra-Frontend#readme" target="_blank" rel="noreferrer">
          Full docs on GitHub
        </a>
        .
      </p>
      {SECTIONS.map((s) => (
        <section
          key={s.title}
          id={s.id}
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: "1.25rem 1.5rem",
            marginTop: "1rem",
          }}
        >
          <h2 style={{ marginTop: 0, fontSize: "1.15rem" }}>{s.title}</h2>
          <p style={{ color: "var(--muted)", margin: "0.5rem 0" }}>{s.body}</p>
          {s.to && (
            <Link to={s.to} style={{ color: "var(--accent)", fontWeight: 500 }}>
              {s.cta} &rarr;
            </Link>
          )}
        </section>
      ))}
    </div>
  );
}
