import {
  fmtDollarPrice,
  fmtPercent,
  fmtSignedDollar,
  isFiniteNumber,
} from "@/lib/display/format";

export type SessionQuoteTone = "up" | "down" | "flat";

export function sessionQuoteTone(change: number | null | undefined): SessionQuoteTone {
  if (!isFiniteNumber(change) || Math.abs(change) < 0.005) return "flat";
  return change > 0 ? "up" : "down";
}

function SessionIcon({ kind }: { kind: "Pre-Market" | "After Hours" }) {
  if (kind === "Pre-Market") {
    return (
      <svg className="session-quote-icon" viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r="3.1" fill="currentColor" />
        <path
          d="M8 1.2v1.6M8 13.2v1.6M1.2 8h1.6M13.2 8h1.6M3.05 3.05l1.13 1.13M11.82 11.82l1.13 1.13M3.05 12.95l1.13-1.13M11.82 4.18l1.13-1.13"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  return (
    <svg className="session-quote-icon" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M10.6 2.2a5.6 5.6 0 1 0 3.2 9.8A6.2 6.2 0 1 1 10.6 2.2Z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * TradingView-style quote stack:
 * last price → primary $ + % → optional Pre/AH (or prior-close) icon line.
 */
export function SessionQuoteStack({
  lastPrice,
  change,
  changePercent,
  extendedLabel = null,
  extendedPrice = null,
  extendedChange = null,
  extendedChangePercent = null,
  extendedNoTrades = false,
  /** Secondary line shows prior RTH close (Gainers/Losers/Volume in pre/AH). */
  priorCloseSecondary = false,
  compact = false,
  onHeat = false,
}: {
  lastPrice: number | null;
  change: number | null;
  changePercent: number | null;
  extendedLabel?: "Pre-Market" | "After Hours" | null;
  extendedPrice?: number | null;
  extendedChange?: number | null;
  extendedChangePercent?: number | null;
  extendedNoTrades?: boolean;
  priorCloseSecondary?: boolean;
  /** Tighter type for Market Movers columns. */
  compact?: boolean;
  /** Dark heatmap tile foot — left-aligned, light-on-fill colors. */
  onHeat?: boolean;
}) {
  const tone = sessionQuoteTone(change);
  const extendedTone = sessionQuoteTone(extendedChange);
  const showExtended = Boolean(extendedLabel);
  const secondaryName = priorCloseSecondary ? "Prior close" : extendedLabel;
  const classes = [
    "session-quote",
    compact ? "is-compact" : null,
    onHeat ? "is-on-heat" : null,
  ].filter(Boolean).join(" ");

  return (
    <span className={classes}>
      <strong className="session-quote-last tnum">{fmtDollarPrice(lastPrice)}</strong>
      <span className={`session-quote-change tnum is-${tone}`}>
        <span>{fmtSignedDollar(change)}</span>
        <span>{fmtPercent(changePercent, 2)}</span>
      </span>
      {showExtended && extendedLabel ? (
        <span
          className={`session-quote-extended tnum is-${extendedNoTrades ? "flat" : extendedTone}`}
          aria-label={
            extendedNoTrades
              ? `${secondaryName}: No trades`
              : `${secondaryName} ${fmtDollarPrice(extendedPrice)}, ${fmtSignedDollar(extendedChange)} ${fmtPercent(extendedChangePercent, 2)}`
          }
        >
          <SessionIcon kind={extendedLabel} />
          {extendedNoTrades ? (
            <em>No trades</em>
          ) : (
            <>
              <span>{fmtDollarPrice(extendedPrice)}</span>
              <span>{fmtSignedDollar(extendedChange)}</span>
              <span>{fmtPercent(extendedChangePercent, 2)}</span>
            </>
          )}
        </span>
      ) : null}
    </span>
  );
}
