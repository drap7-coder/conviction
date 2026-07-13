import Link from "next/link";
import { FIXTURE_COMPANIES, FIXTURE_TICKERS, DEMO_LABEL } from "@/lib/evidence/fixtures";

export default function WatchlistPage() {
  const companies = FIXTURE_TICKERS.map((t) => FIXTURE_COMPANIES[t]);

  const strengthLabel = (s: number) => {
    if (s >= 0.7) return "strong";
    if (s >= 0.5) return "moderate";
    return "weak";
  };

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">Watchlist</h2>
        <span className="section-count">{companies.length} companies</span>
      </div>

      <div className="company-grid">
        {companies.map((c) => (
          <Link key={c.ticker} href={`/companies/${c.ticker}`} className="company-card">
            <div className="card-header">
              <span className="card-ticker">{c.ticker}</span>
              <span className="card-name">{c.name}</span>
            </div>
            <div className="card-change">{c.latestChange}</div>
            <div className="card-implication">{c.implication}</div>
            <div className="card-metrics">
              <span className="metric">
                <span className="metric-label">strength</span>
                <span className={`metric-value ${strengthLabel(c.evidenceStrength)}`}>
                  {(c.evidenceStrength * 100).toFixed(0)}%
                </span>
              </span>
              <span className="metric">
                <span className="strength-bar">
                  <div
                    className={`strength-bar-fill strength-bar-fill positive`}
                    style={{ width: `${c.evidenceStrength * 100}%` }}
                  />
                </span>
              </span>
              <span className="event-count">{c.newEventCount} events</span>
            </div>
            {c.contradiction ? (
              <div className="card-metrics mt-8">
                <span className="metric">
                  <span className="metric-label warning">contradiction</span>
                  <span className="metric-value warning">{c.contradiction}</span>
                </span>
              </div>
            ) : null}
            <div className="card-metrics mt-8">
              <span className="metric">
                <span className="metric-label">next</span>
                <span className="metric-value">{c.nextCatalyst}</span>
              </span>
            </div>
          </Link>
        ))}
      </div>

      <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.55rem", color: "var(--quiet)", textAlign: "center", marginTop: 16 }}>
        {DEMO_LABEL}
      </p>
    </div>
  );
}