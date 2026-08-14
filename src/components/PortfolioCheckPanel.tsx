"use client";

import { AlertTriangle } from "lucide-react";
import type { SampleBook } from "@/lib/portfolio/sample-books";
import type { PortfolioRiskFlags } from "@/lib/portfolio/types";
import {
  buildPortfolioInsightBrief,
  type InsightFinding,
  type PortfolioInsightBrief,
  type StrategyDesignBrief,
} from "@/lib/portfolio/insight-brief";

function FindingIcon({ tone }: { tone: InsightFinding["tone"] }) {
  if (tone === "attention") return <AlertTriangle size={15} strokeWidth={2.2} />;
  return <span aria-hidden="true" className="portfolio-check-dot" />;
}

function StrategyDesignCard({ brief }: { brief: StrategyDesignBrief }) {
  return (
    <section className="portfolio-insight-card is-strategy" aria-labelledby="portfolio-insight-title">
      <header className="portfolio-insight-header">
        <span className="portfolio-insight-kicker">Design</span>
        <h2 id="portfolio-insight-title">{brief.label}</h2>
        <p className="portfolio-insight-principle">{brief.principle}</p>
      </header>

      <div className="portfolio-insight-machine">
        <div>
          <span>How it’s built</span>
          <p>{brief.design}</p>
        </div>
        <div>
          <span>What breaks it</span>
          <p>{brief.stress}</p>
        </div>
      </div>

      <div className="portfolio-insight-sleeves" aria-label={`${brief.label} sleeves`}>
        {brief.sleeves.map((sleeve) => (
          <div key={sleeve.ticker} className="portfolio-insight-sleeve">
            <strong>{sleeve.ticker}</strong>
            <b>{`${sleeve.weight}%`}</b>
            <span>{sleeve.role}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function PersonalFindingsCard({
  brief,
  onReviewPositions,
}: {
  brief: Extract<PortfolioInsightBrief, { mode: "personal" }>;
  onReviewPositions?: (ticker?: string) => void;
}) {
  const primaryTicker = brief.findings.find((item) => item.ticker)?.ticker;

  return (
    <section className="portfolio-insight-card is-personal" aria-labelledby="portfolio-insight-title">
      <header className="portfolio-insight-header">
        <span className="portfolio-insight-kicker">Pressure points</span>
        <h2 id="portfolio-insight-title">{brief.headline}</h2>
        <p>{brief.summary}</p>
      </header>

      {brief.findings.length > 0 ? (
        <div className="portfolio-check-findings">
          <div className="portfolio-check-findings-heading">
            <span>Act on these</span>
            {onReviewPositions ? (
              <button type="button" onClick={() => onReviewPositions(primaryTicker)}>
                Review positions <span aria-hidden="true">→</span>
              </button>
            ) : null}
          </div>
          <div className="portfolio-check-list">
            {brief.findings.map((item) => {
              const interactive = Boolean(onReviewPositions && item.ticker);
              const body = (
                <>
                  <div className="portfolio-check-item-icon" aria-hidden="true">
                    <FindingIcon tone={item.tone} />
                  </div>
                  <div className="portfolio-check-item-copy">
                    <span>{item.label}</span>
                    <strong>{item.title}</strong>
                    <p>{item.detail}</p>
                  </div>
                  <b>{item.value}</b>
                </>
              );

              if (interactive) {
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`portfolio-check-item is-${item.tone} is-action`}
                    onClick={() => onReviewPositions?.(item.ticker)}
                  >
                    {body}
                  </button>
                );
              }

              return (
                <article key={item.id} className={`portfolio-check-item is-${item.tone}`}>
                  {body}
                </article>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="portfolio-insight-clear">Nothing here needs a trim rule today.</p>
      )}
    </section>
  );
}

/**
 * Insights hero: teach strategy design, or surface personal pressure points.
 * No resilience score — that was theater.
 */
export function PortfolioCheckPanel({
  riskFlags,
  sampleBook = null,
  onReviewPositions,
}: {
  riskFlags: PortfolioRiskFlags;
  sampleBook?: SampleBook | null;
  onReviewPositions?: (ticker?: string) => void;
}) {
  const brief = buildPortfolioInsightBrief(riskFlags, sampleBook);

  if (brief.mode === "strategy") {
    return <StrategyDesignCard brief={brief} />;
  }

  return <PersonalFindingsCard brief={brief} onReviewPositions={onReviewPositions} />;
}
