/**
 * ── MarketState (shared) ──
 *
 * Reusable presentation primitive for stock price, change, and session state.
 *
 * Handles missing values safely.
 * Does not own any data — renders props only.
 */

import type { QuoteDisplay } from "@/lib/display/types";
import {
  fmtPrice,
  fmtDollarPrice,
  fmtPercent,
  fmtFreshness,
  isFiniteNumber,
} from "@/lib/display/format";

interface MarketStateProps {
  quote: QuoteDisplay;
  /** Show extended hours info when available */
  showExtended?: boolean;
  className?: string;
}

export function MarketState({
  quote,
  showExtended = false,
  className = "",
}: MarketStateProps) {
  const hasPrice = isFiniteNumber(quote.currentPrice);
  const hasChange = isFiniteNumber(quote.dayChangePercent);
  const isUp = hasChange && (quote.dayChangePercent ?? 0) >= 0;
  const isDown = hasChange && (quote.dayChangePercent ?? 0) < 0;

  const hasExtended =
    showExtended &&
    isFiniteNumber(quote.extendedHoursPrice) &&
    quote.session !== "regular";

  return (
    <div className={`market-state ${className}`}>
      <span className="market-state-price">
        {hasPrice ? fmtDollarPrice(quote.currentPrice) : "—"}
      </span>

      {hasChange && (
        <span
          className={`market-state-change ${isUp ? "up" : isDown ? "down" : ""}`}
        >
          <span className="market-state-change-amount">
            {isFiniteNumber(quote.dayChangeAmount)
              ? (quote.dayChangeAmount! >= 0 ? "+" : "−") +
                "$" +
                Math.abs(quote.dayChangeAmount!).toFixed(2)
              : ""}
          </span>
          <span className="market-state-change-pct">
            {fmtPercent(quote.dayChangePercent)}
          </span>
          <span className={`market-state-freshness freshness-${quote.freshness}`}>
            {fmtFreshness(quote.freshness)}
          </span>
        </span>
      )}

      {!hasPrice && hasChange && (
        <span className="market-state-change muted">
          {fmtPercent(quote.dayChangePercent)}
        </span>
      )}

      {hasExtended && (
        <span
          className={`market-state-extended ${
            (quote.extendedHoursChangePercent ?? 0) >= 0 ? "up" : "down"
          }`}
        >
          {quote.sessionLabel} · {fmtDollarPrice(quote.extendedHoursPrice)}
          {isFiniteNumber(quote.extendedHoursChangePercent) &&
            ` (${fmtPercent(quote.extendedHoursChangePercent)})`}
        </span>
      )}

      {quote.session !== "regular" && !hasExtended && (
        <span className="market-state-session-label">
          {quote.sessionLabel}
        </span>
      )}
    </div>
  );
}