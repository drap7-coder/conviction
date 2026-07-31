/**
 * Conviction Score ring shared with Trending / Watchlist cards.
 */

"use client";

import { GaugeRing, type GaugeTone } from "@/components/GaugeRing";

export interface ConvictionScoreOverviewProps {
  score: number | null;
  label: string;
  tone: GaugeTone;
  detail: string;
  meta?: string | null;
  loading?: boolean;
  /** Static placeholder until institutional + earnings composite ships. */
  unavailable?: boolean;
  className?: string;
}

const UNAVAILABLE_DETAIL =
  "Score requires institutional + earnings data (coming soon)";

export function ConvictionScoreOverview({
  score,
  label,
  tone,
  detail,
  meta = null,
  loading = false,
  unavailable = false,
  className,
}: ConvictionScoreOverviewProps) {
  const showUnavailable = unavailable || (loading && score === null);
  const ringLabel = showUnavailable
    ? "—"
    : loading
      ? "…"
      : score !== null
        ? String(score)
        : "—";
  const ringSublabel = showUnavailable
    ? "COMING SOON"
    : loading
      ? "LOADING"
      : label.toUpperCase();

  return (
    <section
      className={`quote-card quote-conviction-card ink-panel${className ? ` ${className}` : ""}`}
      aria-label="Conviction score"
    >
      <div className="quote-card-header">
        <span className="quote-card-title">Conviction score</span>
        <span className="quote-card-meta">
          {showUnavailable ? "SOON" : loading ? "LOADING" : meta ?? "LIVE"}
        </span>
      </div>

      <div className="quote-conviction-ring-wrap">
        <GaugeRing
          size="lg"
          value={showUnavailable ? null : score}
          label={ringLabel}
          sublabel={ringSublabel}
          caption=""
          tone={showUnavailable ? "neutral" : tone}
          ariaLabel={
            showUnavailable
              ? UNAVAILABLE_DETAIL
              : `Conviction score ${score ?? "unavailable"} of 100: ${label}`
          }
        />
      </div>

      <div className="quote-conviction-legend" aria-hidden="true">
        <span><i className="quote-dot red" /> Distribution</span>
        <span><i className="quote-dot amber" /> Holding</span>
        <span><i className="quote-dot green" /> Accumulating</span>
      </div>

      <p className="quote-conviction-detail">
        {showUnavailable ? UNAVAILABLE_DETAIL : detail}
      </p>
    </section>
  );
}
