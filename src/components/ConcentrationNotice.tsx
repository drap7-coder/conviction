/**
 * Quiet Live notice when any position crosses the shared 12% / 20% marks.
 * Read-only telemetry — does not change allocation math or Study moves.
 * Thresholds match computeRiskFlags: watch >12%, concentrated >20%.
 */

"use client";

export type ConcentrationNoticeHolding = {
  ticker: string;
  name: string;
  weight: number;
};

export type ConcentrationNoticeProps = {
  holdings: ConcentrationNoticeHolding[];
  /** Shared with Concentration ladder / computeRiskFlags (12% watch). */
  watchThreshold?: number;
  /** Shared with Concentration ladder / computeRiskFlags (20% concentrated). */
  concentratedThreshold?: number;
};

export type FlaggedConcentrationHolding = ConcentrationNoticeHolding & {
  severity: "watch" | "concentrated";
};

export function formatConcentrationWeight(weight: number): string {
  const rounded = Math.round(weight * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded.toFixed(0)}%` : `${rounded.toFixed(1)}%`;
}

/** Positions above the watch mark, heaviest first — empty when the book is balanced. */
export function flagConcentrationHoldings(
  holdings: ConcentrationNoticeHolding[],
  watchThreshold = 12,
  concentratedThreshold = 20,
): FlaggedConcentrationHolding[] {
  return holdings
    .filter((holding) => Number.isFinite(holding.weight) && holding.weight > watchThreshold)
    .slice()
    .sort((a, b) => b.weight - a.weight)
    .map((holding) => ({
      ...holding,
      severity: holding.weight > concentratedThreshold ? "concentrated" : "watch",
    }));
}

export function ConcentrationNotice({
  holdings,
  watchThreshold = 12,
  concentratedThreshold = 20,
}: ConcentrationNoticeProps) {
  const flagged = flagConcentrationHoldings(holdings, watchThreshold, concentratedThreshold);

  if (flagged.length === 0) return null;

  return (
    <aside
      className="pf-concentration-notice"
      aria-label="Concentration notice"
    >
      <div className="pf-concentration-notice-head">
        <span className="pf-concentration-notice-label">
          <i className="pf-concentration-notice-dot" aria-hidden="true" />
          Concentration notice
        </span>
        <span className="pf-concentration-notice-marks tnum">
          Watch {watchThreshold}% · Concentrated {concentratedThreshold}%
        </span>
      </div>
      <ul className="pf-concentration-notice-chips">
        {flagged.map((holding) => (
          <li
            key={holding.ticker}
            className={`pf-concentration-notice-chip is-${holding.severity}`}
          >
            <strong>{holding.ticker}</strong>
            <span className="tnum">{formatConcentrationWeight(holding.weight)}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
