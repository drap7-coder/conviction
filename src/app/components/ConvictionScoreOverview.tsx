/**
 * Composite Conviction Score ring on a 0–100 display scale.
 * Internal math stays signed [-100, +100]; the dial/label show the mapped 0–100 value.
 */

"use client";

import { GaugeRing } from "@/components/GaugeRing";
import type { ConvictionScoreResult } from "@/lib/conviction/score";
import {
  dialValueFromScore,
  displayLabelForComposite,
  displayScoreFromSigned,
  formatCoverageSources,
  toneForComposite,
} from "@/lib/conviction/score";

interface ConvictionScoreOverviewProps {
  result: ConvictionScoreResult;
  loading?: boolean;
  className?: string;
}

export function ConvictionScoreOverview({
  result,
  loading = false,
  className,
}: ConvictionScoreOverviewProps) {
  const displayLabel = displayLabelForComposite(result.label);
  const tone = toneForComposite(result.label);
  const dialValue = dialValueFromScore(result.score);
  const displayScore = displayScoreFromSigned(result.score);
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
          {loading
            ? "LOADING"
            : result.coverage > 0
              ? `${Math.round(result.coverage * 100)}% COVERAGE`
              : "COMPOSITE"}
        </span>
      </div>

      <div className="quote-conviction-ring-wrap">
        <GaugeRing
          size="lg"
          value={dialValue}
          label={loading ? "…" : displayScore !== null ? String(displayScore) : "—"}
          sublabel={loading ? "LOADING" : displayLabel.toUpperCase()}
          caption=""
          tone={tone}
          ariaLabel={`Conviction score ${displayScore ?? "unavailable"} of 100: ${displayLabel}`}
        />
      </div>

      <div className="quote-conviction-legend" aria-hidden="true">
        <span><i className="quote-dot red" /> Distribution</span>
        <span><i className="quote-dot amber" /> Holding</span>
        <span><i className="quote-dot green" /> Accumulating</span>
      </div>

      <p className="quote-conviction-detail">
        {loading && result.score === null
          ? "Loading evidence across earnings, technicals, short interest, and political…"
          : loading && result.score !== null
            ? "Updating score with institutional 13F filings…"
          : result.label === "insufficient_evidence"
            ? "Need at least 50% category coverage for a score."
            : `Score ${displayScore}/100 · ${result.includedCategories.length} categor${result.includedCategories.length === 1 ? "y" : "ies"} included.`}
      </p>

      {coverageNote && !loading ? (
        <p className="quote-conviction-coverage">{coverageNote}</p>
      ) : null}
    </section>
  );
}
