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
  className?: string;
}

export function ConvictionScoreOverview({
  score,
  label,
  tone,
  detail,
  meta = null,
  loading = false,
  className,
}: ConvictionScoreOverviewProps) {
  return (
    <section
      className={`quote-card quote-conviction-card ink-panel${className ? ` ${className}` : ""}`}
      aria-label="Conviction score"
    >
      <div className="quote-card-header">
        <span className="quote-card-title">Conviction score</span>
        <span className="quote-card-meta">
          {loading ? "LOADING" : meta ?? "LIVE"}
        </span>
      </div>

      <div className="quote-conviction-ring-wrap">
        <GaugeRing
          size="lg"
          value={loading ? null : score}
          label={loading ? "…" : score !== null ? String(score) : "—"}
          sublabel={loading ? "SCORING" : label.toUpperCase()}
          caption=""
          tone={tone}
          loading={loading}
          ariaLabel={
            loading
              ? "Conviction score computing"
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
        {loading && score === null
          ? "Loading institutional, technical, and short-interest evidence…"
          : detail}
      </p>
    </section>
  );
}
