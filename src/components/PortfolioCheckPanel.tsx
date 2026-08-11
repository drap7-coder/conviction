"use client";

import type { CSSProperties } from "react";
import { AlertTriangle, Check, ShieldCheck } from "lucide-react";
import type { PortfolioRiskFlags } from "@/lib/portfolio/types";
import { isFiniteNumber } from "@/lib/display/format";

type CheckTone = "clear" | "watch" | "attention" | "data";

type CheckItem = {
  id: string;
  label: string;
  title: string;
  detail: string;
  value: string;
  tone: CheckTone;
};

function weight(value: number | null): string {
  if (!isFiniteNumber(value)) return "—";
  return `${value.toFixed(0)}%`;
}

function buildCheckItems(flags: PortfolioRiskFlags): CheckItem[] {
  const items: CheckItem[] = [];

  for (const position of flags.singleConcentration) {
    items.push({
      id: `concentration-${position.ticker}`,
      label: "Position size",
      title: `${position.ticker} is carrying the book`,
      detail: `A 20% move in ${position.ticker} would move the portfolio by roughly ${(position.weight * 0.2).toFixed(1)}%.`,
      value: weight(position.weight),
      tone: "attention",
    });
  }

  for (const sector of flags.sectorConcentration) {
    items.push({
      id: `sector-${sector.sector}`,
      label: "Sector exposure",
      title: `${sector.sector} risk is clustered`,
      detail: "These holdings may react to the same earnings, rates, and policy shocks.",
      value: weight(sector.weight),
      tone: "attention",
    });
  }

  if (flags.topThreeExceedsSixty) {
    items.push({
      id: "top-three",
      label: "Top three",
      title: "Most outcomes hinge on three names",
      detail: "Stress-test the biggest positions together, not one at a time.",
      value: weight(flags.topThreeCombinedWeight),
      tone: "attention",
    });
  }

  for (const position of flags.elevatedPositions) {
    items.push({
      id: `elevated-${position.ticker}`,
      label: "Watch closely",
      title: `${position.ticker} is becoming meaningful`,
      detail: "The position is below the concentration line, but large enough to shape results.",
      value: weight(position.weight),
      tone: "watch",
    });
  }

  if (flags.missingPriceCount > 0) {
    items.push({
      id: "missing-price",
      label: "Price coverage",
      title: `${flags.missingPriceCount} position${flags.missingPriceCount === 1 ? " is" : "s are"} not marked`,
      detail: "Portfolio value and daily movement exclude positions without a current price.",
      value: "Fix data",
      tone: "data",
    });
  }

  if (flags.missingCostCount > 0) {
    items.push({
      id: "missing-cost",
      label: "Cost coverage",
      title: `${flags.missingCostCount} cost basis ${flags.missingCostCount === 1 ? "is" : "are"} missing`,
      detail: "Add average cost to see the full unrealized return of the book.",
      value: "Complete",
      tone: "data",
    });
  }

  if (items.length === 0) {
    items.push({
      id: "all-clear",
      label: "Portfolio structure",
      title: "No obvious pressure points",
      detail: "Position and sector weights are inside the current concentration guardrails.",
      value: "Clear",
      tone: "clear",
    });
  }

  return items;
}

function getScore(flags: PortfolioRiskFlags): number {
  const concentrationSignals =
    flags.singleConcentration.length +
    flags.sectorConcentration.length +
    (flags.topThreeExceedsSixty ? 1 : 0);
  const dataGaps = flags.missingCostCount + flags.missingPriceCount;
  const penalty =
    concentrationSignals * 14 +
    flags.elevatedPositions.length * 6 +
    Math.min(dataGaps * 3, 12);

  return Math.max(34, Math.min(100, 100 - penalty));
}

function scoreCopy(score: number) {
  if (score >= 88) {
    return {
      tone: "clear" as const,
      verdict: "Built to endure.",
      summary: "No single exposure is doing too much of the work.",
    };
  }
  if (score >= 70) {
    return {
      tone: "watch" as const,
      verdict: "Strong, with pressure points.",
      summary: "The book is sound, but a few exposures deserve your attention.",
    };
  }
  return {
    tone: "attention" as const,
    verdict: "Too much rides on too little.",
    summary: "A small number of outcomes can dominate the portfolio.",
  };
}

function CheckIcon({ tone }: { tone: CheckTone }) {
  if (tone === "clear") return <Check size={15} strokeWidth={2.5} />;
  if (tone === "attention") return <AlertTriangle size={15} strokeWidth={2.2} />;
  return <span aria-hidden="true" className="portfolio-check-dot" />;
}

export function PortfolioCheckPanel({
  riskFlags,
  onReviewPositions,
}: {
  riskFlags: PortfolioRiskFlags;
  onReviewPositions?: () => void;
}) {
  const items = buildCheckItems(riskFlags);
  const score = getScore(riskFlags);
  const copy = scoreCopy(score);
  const positionAlerts = riskFlags.elevatedPositions.length + riskFlags.singleConcentration.length;
  const sectorAlerts = riskFlags.sectorConcentration.length;
  const dataGapCount = riskFlags.missingCostCount + riskFlags.missingPriceCount;

  return (
    <section
      className={`portfolio-check-card portfolio-check-${copy.tone}`}
      aria-labelledby="portfolio-check-title"
    >
      <header className="portfolio-check-header">
        <div className="portfolio-check-intro">
          <span className="portfolio-check-kicker">
            <ShieldCheck size={15} strokeWidth={2.2} />
            Portfolio Check
          </span>
          <h2 id="portfolio-check-title">{copy.verdict}</h2>
          <p>{copy.summary}</p>
        </div>

        <div
          className="portfolio-check-score"
          style={{ "--portfolio-score": score } as CSSProperties}
          aria-label={`Portfolio resilience score ${score} out of 100`}
        >
          <div className="portfolio-check-score-core">
            <strong>{score}</strong>
            <span>/ 100</span>
          </div>
          <small>Resilience</small>
        </div>
      </header>

      <div className="portfolio-check-stats" aria-label="Portfolio check summary">
        <div>
          <span>Position risk</span>
          <strong>{positionAlerts === 0 ? "In range" : `${positionAlerts} flagged`}</strong>
        </div>
        <div>
          <span>Sector risk</span>
          <strong>{sectorAlerts === 0 ? "In range" : `${sectorAlerts} flagged`}</strong>
        </div>
        <div>
          <span>Data quality</span>
          <strong>{dataGapCount === 0 ? "Complete" : `${dataGapCount} gap${dataGapCount === 1 ? "" : "s"}`}</strong>
        </div>
      </div>

      <div className="portfolio-check-findings">
        <div className="portfolio-check-findings-heading">
          <span>What matters now</span>
          {onReviewPositions ? (
            <button type="button" onClick={onReviewPositions}>
              Review positions <span aria-hidden="true">→</span>
            </button>
          ) : null}
        </div>
        <div className="portfolio-check-list">
          {items.slice(0, 5).map((item) => (
            <article key={item.id} className={`portfolio-check-item is-${item.tone}`}>
              <div className="portfolio-check-item-icon" aria-hidden="true">
                <CheckIcon tone={item.tone} />
              </div>
              <div className="portfolio-check-item-copy">
                <span>{item.label}</span>
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
              </div>
              <b>{item.value}</b>
            </article>
          ))}
        </div>
        {items.length > 5 ? (
          <p className="portfolio-check-more">
            +{items.length - 5} more signal{items.length - 5 === 1 ? "" : "s"} reflected in the score.
          </p>
        ) : null}
      </div>

      <footer className="portfolio-check-footer">
        <span>Rules-based snapshot</span>
        <span>Concentration · sector exposure · data coverage</span>
      </footer>
    </section>
  );
}
