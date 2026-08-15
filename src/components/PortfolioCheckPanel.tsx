"use client";

import { AlertTriangle } from "lucide-react";
import type { PortfolioRiskFlags } from "@/lib/portfolio/types";
import {
  buildPersonalInsightBrief,
  type InsightFinding,
} from "@/lib/portfolio/insight-brief";

function FindingIcon({ tone }: { tone: InsightFinding["tone"] }) {
  if (tone === "attention") return <AlertTriangle size={15} strokeWidth={2.2} />;
  return <span aria-hidden="true" className="portfolio-check-dot" />;
}

/**
 * Same pressure-point read for My Portfolio and sample books.
 * Size is the risk — designed concentration still shows as size.
 */
export function PortfolioCheckPanel({
  riskFlags,
  onReviewPositions,
}: {
  riskFlags: PortfolioRiskFlags;
  onReviewPositions?: (ticker?: string) => void;
}) {
  const brief = buildPersonalInsightBrief(riskFlags);
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
