/**
 * Quotes-style institutional conviction ring + added/reduced/new stats.
 * Presentational: parent supplies scoreInstitutionalConviction output.
 */

"use client";

import { GaugeRing } from "@/components/GaugeRing";
import type { ConvictionRingScore } from "@/lib/market/quote-gauges";

interface InstitutionalConvictionOverviewProps {
  conviction: ConvictionRingScore;
  loading?: boolean;
  className?: string;
}

export function InstitutionalConvictionOverview({
  conviction,
  loading = false,
  className,
}: InstitutionalConvictionOverviewProps) {
  return (
    <section
      className={`quote-card quote-conviction-card${className ? ` ${className}` : ""}`}
      aria-label="Institutional conviction"
    >
      <div className="quote-card-header">
        <span className="quote-card-title">Institutional conviction</span>
        <span className="quote-card-meta">
          {conviction.filingQuarter
            ? `${conviction.filingQuarter} 13F FILINGS`
            : "13F FILINGS"}
        </span>
      </div>

      <div className="quote-conviction-ring-wrap">
        <GaugeRing
          size="lg"
          value={conviction.score}
          label={
            loading
              ? "…"
              : conviction.score !== null
                ? String(conviction.score)
                : "—"
          }
          sublabel={loading ? "LOADING" : conviction.label.toUpperCase()}
          caption=""
          tone={conviction.tone}
          ariaLabel={`Institutional conviction ${conviction.score ?? "unavailable"}: ${conviction.label}`}
        />
      </div>

      <div className="quote-conviction-legend" aria-hidden="true">
        <span><i className="quote-dot red" /> Distribution</span>
        <span><i className="quote-dot amber" /> Holding</span>
        <span><i className="quote-dot green" /> Accumulating</span>
      </div>

      <p className="quote-conviction-detail">
        {loading ? "Loading institutional filings…" : conviction.detail}
      </p>

      <div className="quote-conviction-stats">
        <div className="quote-stat">
          <strong className="up">{conviction.added}</strong>
          <span>Institutions added</span>
        </div>
        <div className="quote-stat">
          <strong className="down">{conviction.reduced}</strong>
          <span>Institutions reduced</span>
        </div>
        <div className="quote-stat">
          <strong className="teal">{conviction.newPositions}</strong>
          <span>New positions</span>
        </div>
      </div>
    </section>
  );
}
