import Link from "next/link";
import { FIXTURE_JOURNAL_ENTRIES, FIXTURE_COMPANIES, DEMO_LABEL } from "@/lib/evidence/fixtures";

export default function JournalPage() {
  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">Decision journal</h2>
        <span className="section-count">
          {FIXTURE_JOURNAL_ENTRIES.length} entries
        </span>
      </div>

      {FIXTURE_JOURNAL_ENTRIES.length === 0 ? (
        <div className="empty-state">
          <p>No journal entries yet.</p>
          <small>Record a thesis when you act on evidence.</small>
        </div>
      ) : (
        <div className="journal-list">
          {FIXTURE_JOURNAL_ENTRIES.map((entry) => (
            <div key={entry.id} className="journal-card">
              <div className="journal-header">
                <div className="flex items-center gap-8">
                  <Link
                    href={`/companies/${entry.ticker}`}
                    className="card-ticker"
                  >
                    {entry.ticker}
                  </Link>
                  <span className="card-name">
                    {FIXTURE_COMPANIES[entry.ticker]?.name ?? ""}
                  </span>
                </div>
                <span className={`status-badge ${entry.status}`}>
                  {entry.status}
                </span>
              </div>

              <p className="journal-thesis">{entry.thesis}</p>

              <div className="journal-details">
                <div className="journal-detail">
                  <div className="journal-detail-label">Expected catalyst</div>
                  <div className="journal-detail-value">
                    {entry.expectedCatalyst}
                  </div>
                </div>
                <div className="journal-detail">
                  <div className="journal-detail-label">Time horizon</div>
                  <div className="journal-detail-value">
                    {entry.timeHorizon}
                  </div>
                </div>
                <div className="journal-detail">
                  <div className="journal-detail-label">
                    Invalidation condition
                  </div>
                  <div className="journal-detail-value">
                    {entry.invalidationCondition}
                  </div>
                </div>
                <div className="journal-detail">
                  <div className="journal-detail-label">Position size</div>
                  <div className="journal-detail-value">
                    {entry.positionSize}
                  </div>
                </div>
                <div className="journal-detail">
                  <div className="journal-detail-label">Risks</div>
                  <div className="journal-detail-value">{entry.risks}</div>
                </div>
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