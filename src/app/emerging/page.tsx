import Link from "next/link";
import { FIXTURE_EMERGING, DEMO_LABEL } from "@/lib/evidence/fixtures";

export default function EmergingPage() {
  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">Emerging evidence</h2>
        <span className="section-count">
          {FIXTURE_EMERGING.length} companies
        </span>
      </div>

      {FIXTURE_EMERGING.length === 0 ? (
        <div className="empty-state">
          <p>No emerging ideas right now.</p>
          <small>New evidence is evaluated daily.</small>
        </div>
      ) : (
        <div className="emerging-list">
          {FIXTURE_EMERGING.map((idea) => (
            <div key={idea.ticker} className="emerging-card">
              <div className="emerging-header">
                <span className="card-ticker">{idea.ticker}</span>
                <span className="card-name">{idea.name} · {idea.sector}</span>
              </div>

              <div className="reason-codes">
                {idea.reasonCodes.map((rc) => (
                  <span
                    key={rc.code}
                    className={`reason-code ${rc.positive ? "positive" : "negative"}`}
                  >
                    {rc.positive ? "+" : "−"} {rc.label}
                  </span>
                ))}
              </div>

              <div className="emerging-event">
                <strong>Top signal:</strong> {idea.topEvent.title}
              </div>
              {idea.topEvent.aiExplanation ? (
                <div className="emerging-event mt-8">
                  {idea.topEvent.aiExplanation}
                </div>
              ) : null}

              <div className="flex items-center gap-8 mt-8">
                <span className="metric">
                  <span className="metric-label">strength</span>
                  <span className="metric-value strong">
                    {(
                      idea.reasonCodes
                        .filter((r) => r.positive)
                        .reduce((s, r) => s + r.strength, 0) /
                      Math.max(idea.reasonCodes.filter((r) => r.positive).length, 1) *
                      100
                    ).toFixed(0)}
                    %
                  </span>
                </span>
                <Link
                  href={`/companies/${idea.ticker}`}
                  className="detail-back"
                >
                  View company →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "0.55rem",
          color: "var(--quiet)",
          textAlign: "center",
          marginTop: 16,
        }}
      >
        {DEMO_LABEL}
      </p>
    </div>
  );
}