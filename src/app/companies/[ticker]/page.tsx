import Link from "next/link";
import { notFound } from "next/navigation";
import { FIXTURE_COMPANIES, FIXTURE_TICKERS } from "@/lib/evidence/fixtures";
import { InsiderActivitySection } from "@/app/components/InsiderActivitySection";
import { MoveExplanationSection } from "@/app/components/MoveExplanationSection";
import { PoliticalTradesSection } from "@/app/components/PoliticalTradesSection";
import { validateTicker } from "@/lib/watchlist/validate";

export async function generateStaticParams() {
  return FIXTURE_TICKERS.map((ticker) => ({ ticker }));
}

export default async function CompanyPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;
  const upperTicker = ticker.toUpperCase();
  const company = FIXTURE_COMPANIES[upperTicker];
  let companyName = company?.name;
  if (!company) {
    const resolvedCompany = await validateTicker(upperTicker);
    if (!resolvedCompany.valid) notFound();
    companyName = resolvedCompany.companyName ?? upperTicker;
  }

  const positiveEvents = company?.events.filter(
    (e) => !e.isContradiction && e.direction === "positive"
  ) ?? [];
  const contradictions = company?.events.filter((e) => e.isContradiction) ?? [];

  const strengthLabel = (s: number) => {
    if (s >= 0.7) return "strong";
    if (s >= 0.5) return "moderate";
    return "weak";
  };

  return (
    <div>
      <div className="detail-header">
        <div className="detail-nav">
          <Link href="/" className="detail-back">
            ← Watchlist
          </Link>
          <span className="demo-badge">SEC 13F</span>
        </div>
        <h1 className="detail-ticker">{upperTicker}</h1>
        <p className="detail-name">{companyName}</p>
      </div>

      <MoveExplanationSection ticker={upperTicker} />
      <PoliticalTradesSection ticker={upperTicker} />

      {company ? (
      <details className="legacy-context">
        <summary>Supporting context</summary>
        <div className="detail-overview mt-8">
          <div className="detail-overview-item">
            <h3>What changed before</h3>
            <p>{company.latestChange}</p>
          </div>
          <div className="detail-overview-item">
            <h3>Why it mattered</h3>
            <p>{company.implication}</p>
          </div>
          <div className="detail-overview-item">
            <h3>Legacy strength</h3>
            <p>
              {(company.evidenceStrength * 100).toFixed(0)}% —{" "}
              {strengthLabel(company.evidenceStrength)}
            </p>
          </div>
          <div className="detail-overview-item">
            <h3>Next catalyst</h3>
            <p>{company.nextCatalyst}</p>
          </div>
          {company.contradiction ? (
            <div className="detail-overview-item">
              <h3>Strongest contradiction</h3>
              <p className="contradiction">{company.contradiction}</p>
            </div>
          ) : null}
          <div className="detail-overview-item">
            <h3>Invalidation signals</h3>
            <p>{`Contradiction events: ${contradictions.length}. Watch for reversal of institutional accumulation or insider selling.`}</p>
          </div>
        </div>

        <div className="section-header">
          <h2 className="section-title">Legacy evidence</h2>
          <span className="section-count">{positiveEvents.length} events</span>
        </div>

        <div className="timeline">
          {positiveEvents.map((e) => (
            <div key={e.id} className={`timeline-item ${e.direction}`}>
              <div className="timeline-date">{e.date}</div>
              <div className="timeline-title">{e.title}</div>
              <div className="timeline-source">{e.source}</div>
              <div className="timeline-strength">
                Strength: {(e.strength * 100).toFixed(0)}%
              </div>
              <div className="timeline-explanation">{e.aiExplanation}</div>
            </div>
          ))}
        </div>

        {contradictions.length > 0 ? (
          <>
            <div className="section-header mt-16">
              <h2 className="section-title">Contradicting evidence</h2>
              <span className="section-count">
                {contradictions.length} events
              </span>
            </div>
            <div className="timeline">
              {contradictions.map((e) => (
                <div key={e.id} className={`timeline-item ${e.direction}`}>
                  <div className="timeline-date">{e.date}</div>
                  <div className="timeline-title">{e.title}</div>
                  <div className="timeline-source">{e.source}</div>
                  <div className="timeline-strength">
                    Strength: {(e.strength * 100).toFixed(0)}%
                  </div>
                  <div className="timeline-explanation">{e.aiExplanation}</div>
                </div>
              ))}
            </div>
          </>
        ) : null}

        {/* What to watch next */}
        <div className="section-header mt-16">
          <h2 className="section-title">What to watch next</h2>
        </div>
        <div className="evidence-grid">
          <div className="evidence-panel">
            <h3>Upcoming catalyst</h3>
            <p>{company.nextCatalyst}</p>
          </div>
          <div className="evidence-panel">
            <h3>Invalidation watch</h3>
            <p>
              {contradictions.length > 0
                ? `Monitor: ${contradictions.map((c) => c.title).join("; ")}`
                : "No active contradictions. Monitor for insider selling or guidance changes."}
            </p>
          </div>
        </div>
      </details>
      ) : null}

      <div className="secondary-evidence">
        <div className="section-header mt-16">
          <h2 className="section-title">Secondary signal</h2>
          <span className="section-count">Form 4</span>
        </div>
        <InsiderActivitySection ticker={upperTicker} />
      </div>

      {company && company.journalEntries.length > 0 ? (
        <>
          <div className="section-header mt-16">
            <h2 className="section-title">Decision journal</h2>
            <span className="section-count">
              {company.journalEntries.length} entries
            </span>
          </div>
          <div className="journal-list">
            {company.journalEntries.map((entry) => (
              <div key={entry.id} className="journal-card">
                <div className="journal-header">
                  <span className="card-ticker">{entry.ticker}</span>
                  <span className={`status-badge ${entry.status}`}>
                    {entry.status}
                  </span>
                </div>
                <p className="journal-thesis">{entry.thesis}</p>
                <div className="journal-details">
                  <div className="journal-detail">
                    <div className="journal-detail-label">Catalyst</div>
                    <div className="journal-detail-value">
                      {entry.expectedCatalyst}
                    </div>
                  </div>
                  <div className="journal-detail">
                    <div className="journal-detail-label">Horizon</div>
                    <div className="journal-detail-value">
                      {entry.timeHorizon}
                    </div>
                  </div>
                  <div className="journal-detail">
                    <div className="journal-detail-label">Invalidation</div>
                    <div className="journal-detail-value">
                      {entry.invalidationCondition}
                    </div>
                  </div>
                  <div className="journal-detail">
                    <div className="journal-detail-label">Size</div>
                    <div className="journal-detail-value">
                      {entry.positionSize}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}

    </div>
  );
}
