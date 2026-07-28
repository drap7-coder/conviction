/**
 * Composite Conviction Score ring + institutional supporting stats.
 * Dial reflects calculateConvictionScore; added/reduced/new stay 13F-only.
 */

"use client";

import { GaugeRing } from "@/components/GaugeRing";
import type { ConvictionRingScore } from "@/lib/market/quote-gauges";
import type { ConvictionScoreResult } from "@/lib/conviction/score";
import {
  dialValueFromScore,
  displayLabelForComposite,
  formatCoverageSources,
  toneForComposite,
} from "@/lib/conviction/score";

interface ConvictionScoreOverviewProps {
  result: ConvictionScoreResult;
  institutional: Pick<
    ConvictionRingScore,
    "added" | "reduced" | "newPositions" | "filingQuarter" | "detail"
  >;
  loading?: boolean;
  className?: string;
}

function formatSignedScore(score: number | null): string {
  if (score === null) return "—";
  return `${score > 0 ? "+" : ""}${Math.round(score)}`;
}

export function ConvictionScoreOverview({
  result,
  institutional,
  loading = false,
  className,
}: ConvictionScoreOverviewProps) {
  const displayLabel = displayLabelForComposite(result.label);
  const tone = toneForComposite(result.label);
  const dialValue = dialValueFromScore(result.score);
  const coverageNote =
    result.coverage > 0 && result.coverage < 1
      ? `Based on ${formatCoverageSources(result.includedCategories)} (${Math.round(result.coverage * 100)}% coverage)`
      : result.coverage >= 1
        ? "Full category coverage"
        : null;

  return (
    <section
      className={`quote-card quote-conviction-card${className ? ` ${className}` : ""}`}
      aria-label="Conviction score"
    >
      <div className="quote-card-header">
        <span className="quote-card-title">Conviction score</span>
        <span className="quote-card-meta">
          {institutional.filingQuarter
            ? `${institutional.filingQuarter} · COMPOSITE`
            : "COMPOSITE"}
        </span>
      </div>

      <div className="quote-conviction-ring-wrap">
        <GaugeRing
          size="lg"
          value={dialValue}
          label={loading ? "…" : formatSignedScore(result.score)}
          sublabel={loading ? "LOADING" : displayLabel.toUpperCase()}
          caption=""
          tone={tone}
          ariaLabel={`Conviction score ${result.score ?? "unavailable"}: ${displayLabel}`}
        />
      </div>

      <div className="quote-conviction-legend" aria-hidden="true">
        <span><i className="quote-dot red" /> Distribution</span>
        <span><i className="quote-dot amber" /> Holding</span>
        <span><i className="quote-dot green" /> Accumulating</span>
      </div>

      <p className="quote-conviction-detail">
        {loading
          ? "Loading institutional and earnings evidence…"
          : result.label === "insufficient_evidence"
            ? "Need at least 50% category coverage (institutional + earnings) for a score."
            : `Composite ${formatSignedScore(result.score)} · ${result.includedCategories.length} categor${result.includedCategories.length === 1 ? "y" : "ies"} included.`}
      </p>

      {coverageNote && !loading ? (
        <p className="quote-conviction-coverage">{coverageNote}</p>
      ) : null}

      <div className="quote-conviction-stats">
        <div className="quote-stat">
          <strong className="up">{institutional.added}</strong>
          <span>Institutions added</span>
        </div>
        <div className="quote-stat">
          <strong className="down">{institutional.reduced}</strong>
          <span>Institutions reduced</span>
        </div>
        <div className="quote-stat">
          <strong className="teal">{institutional.newPositions}</strong>
          <span>New positions</span>
        </div>
      </div>
    </section>
  );
}
