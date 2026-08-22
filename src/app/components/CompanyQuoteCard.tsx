"use client";

import { useEffect, useMemo, useState } from "react";
import { getLivePrice } from "@/lib/market/live-quote";
import type { StockQuote } from "@/lib/market/quotes";
import type { SectorProfile } from "@/lib/market/sector-profile";
import { PriceTrendCard } from "@/app/components/PriceTrendCard";
import { WatchlistTrackControl } from "@/app/components/WatchlistTrackControl";
import { useWatchlistTracking } from "@/app/components/use-watchlist-tracking";
import { rangePosition } from "@/lib/market/quote-gauges";
import { fmtCompactCurrency, fmtMarketCap } from "@/lib/display/format";

interface CompanyQuoteCardProps {
  ticker: string;
  companyName: string;
  sectorName: string | null;
  logoUrl: string | null;
}

function formatPrice(value: number | null): string {
  if (value === null) return "—";
  return value.toLocaleString(undefined, {
    maximumFractionDigits: value >= 100 ? 2 : 3,
    minimumFractionDigits: value >= 1 ? 2 : 3,
  });
}

function formatChange(value: number | null, percent: number | null) {
  if (value === null || percent === null) return null;
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return {
    dollars: `${sign}$${Math.abs(value).toFixed(2)}`,
    percent: `${percent > 0 ? "+" : ""}${percent.toFixed(2)}%`,
  };
}

function formatDividendYield(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(value >= 10 ? 1 : 2)}%`;
}

/**
 * One card for who it is, what it costs, and how it moves.
 * Identity + quote above a pencil rule; chart below.
 */
export function CompanyQuoteCard({
  ticker,
  companyName,
  sectorName,
  logoUrl,
}: CompanyQuoteCardProps) {
  const [quote, setQuote] = useState<StockQuote | null>(null);
  const [profile, setProfile] = useState<SectorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const { trackedTickers, addingTicker, addToWatchlist } = useWatchlistTracking();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [quoteRes, profileRes] = await Promise.all([
          fetch(`/api/market/quotes?tickers=${encodeURIComponent(ticker)}`),
          fetch(`/api/market/sector-profile?tickers=${encodeURIComponent(ticker)}`),
        ]);

        if (quoteRes.ok) {
          const data = (await quoteRes.json()) as { quotes?: StockQuote[] };
          if (!cancelled) setQuote((data.quotes ?? [])[0] ?? null);
        }

        if (profileRes.ok) {
          const data = (await profileRes.json()) as { profiles?: SectorProfile[] };
          if (!cancelled) setProfile((data.profiles ?? [])[0] ?? null);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  const live = useMemo(() => (quote ? getLivePrice(quote) : null), [quote]);
  const isExtendedSession = live?.session === "pre_market" || live?.session === "after_hours";
  // Chart meta often omits marketCap — quoteSummary price module fills the gap.
  const marketCap = quote?.marketCap ?? profile?.marketCap ?? null;
  const dividendYield = profile?.dividendYield ?? null;

  let changeText: ReturnType<typeof formatChange> = null;
  let arrow: string | null = null;
  if (live) {
    changeText = live.change !== null && live.changePercent !== null
      ? formatChange(live.change, live.changePercent)
      : null;
    arrow = live.change !== null
      ? (live.change > 0 ? "▲" : live.change < 0 ? "▼" : null)
      : null;
  }

  let regularChangeText: ReturnType<typeof formatChange> = null;
  if (quote) {
    regularChangeText = quote.change !== null && quote.changePercent !== null
      ? formatChange(quote.change, quote.changePercent)
      : null;
  }

  const direction = live?.change != null
    ? live.change > 0 ? "up" : live.change < 0 ? "down" : ""
    : "";
  const regularDirection = quote?.change != null
    ? quote.change > 0 ? "up" : quote.change < 0 ? "down" : ""
    : "";
  const rangePercent = quote
    ? rangePosition(live?.price ?? quote.price, quote.fiftyTwoWeekLow, quote.fiftyTwoWeekHigh)
    : null;
  const sessionLabel = quote?.marketState === "REGULAR"
    ? "Market open"
    : quote?.marketState === "PRE"
      ? "Pre-market"
      : quote?.marketState === "POST"
        ? "After hours"
        : "Latest close";

  const extendedSessionTone = (() => {
    if (!isExtendedSession) return "quiet";
    if (direction === "up") return "up";
    if (direction === "down") return "down";
    return "quiet";
  })();

  return (
    <section className="company-quote-card ink-panel" aria-label={`${ticker} quote and chart`}>
      <header className="company-quote-top">
        <div className="company-quote-identity">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="company-quote-logo" />
          ) : (
            <div className="logo-badge logo-badge-detail" aria-hidden="true">
              {ticker.charAt(0)}
            </div>
          )}
          <div className="company-quote-copy">
            <div className="company-quote-ticker-row">
              <h1 className="company-quote-ticker">
                {ticker}
                <span className="sr-only">{` ${companyName}`}</span>
              </h1>
              <WatchlistTrackControl
                ticker={ticker}
                companyName={companyName}
                tracked={trackedTickers.has(ticker.toUpperCase())}
                adding={addingTicker === ticker}
                onAdd={addToWatchlist}
                size="quote"
                surface="paper"
              />
            </div>
            <p className="company-quote-name">
              {companyName}
              {sectorName ? (
                <>
                  <span className="company-quote-sep" aria-hidden="true">·</span>
                  <span className="company-quote-sector">{sectorName}</span>
                </>
              ) : null}
            </p>
          </div>
        </div>

        <div className="company-quote-price" aria-label={`${ticker} price`}>
          <span className={`evidence-live-pill company-live-pill${loading ? " is-updating" : ""}`}>
            <span className="company-live-dot" aria-hidden="true">
              <i className="company-live-ping" />
              <i className="company-live-core" />
            </span>
            {loading ? "Updating" : "Live"}
          </span>
          {loading ? (
            <span className="company-quote-price-loading">—</span>
          ) : live?.price != null ? (
            <>
              <div className="company-quote-price-row">
                <span className={`company-quote-arrow ${direction}`}>{arrow}</span>
                <span className="company-quote-price-big tnum">${formatPrice(live.price)}</span>
              </div>
              {changeText ? (
                <span className={`company-quote-change ${direction}`}>
                  <span className={`company-quote-change-chip tnum ${direction}`}>
                    {changeText.dollars}
                    <span aria-hidden="true"> · </span>
                    {changeText.percent}
                  </span>
                  {live.label ? (
                    <span
                      className={`company-quote-session-pill ${extendedSessionTone === "up" ? "is-up" : extendedSessionTone === "down" ? "is-down" : "is-quiet"}${isExtendedSession ? " is-extended" : ""}`}
                      aria-label={`${live.label} session`}
                    >
                      <span className="company-quote-session-dot" aria-hidden="true" />
                      {live.label}
                    </span>
                  ) : null}
                </span>
              ) : live.label ? (
                <span
                  className={`company-quote-session-pill ${extendedSessionTone === "up" ? "is-up" : extendedSessionTone === "down" ? "is-down" : "is-quiet"}${isExtendedSession ? " is-extended" : ""}`}
                  aria-label={`${live.label} session`}
                >
                  <span className="company-quote-session-dot" aria-hidden="true" />
                  {live.label}
                </span>
              ) : null}
              {isExtendedSession && quote ? (
                <span
                  className={`company-quote-close${regularDirection ? ` ${regularDirection}` : ""}`}
                  aria-label={
                    regularChangeText
                      ? `Regular close $${formatPrice(quote.price)}, ${regularChangeText.dollars} (${regularChangeText.percent}) on the day`
                      : `Regular close $${formatPrice(quote.price)}`
                  }
                >
                  <span className="company-quote-close-label">
                    Close ${formatPrice(quote.price)}
                  </span>
                  {regularChangeText ? (
                    <strong className="company-quote-close-change">
                      {regularChangeText.dollars}
                      <span aria-hidden="true"> · </span>
                      {regularChangeText.percent}
                    </strong>
                  ) : null}
                </span>
              ) : null}
            </>
          ) : (
            <span className="company-quote-price-na">Price unavailable</span>
          )}
        </div>
      </header>

      <div className="company-quote-chart-surface">
        <PriceTrendCard ticker={ticker} showQuote={false} embedded />
      </div>

      <div className="company-quote-context" aria-label="Trading context">
        <article>
          <span>Market value</span>
          <strong className="tnum">{loading ? "—" : fmtMarketCap(marketCap)}</strong>
          <small>{quote?.exchange ?? "Exchange unavailable"}</small>
        </article>
        <article>
          <span>Dividend yield</span>
          <strong className="tnum">{loading ? "—" : formatDividendYield(dividendYield)}</strong>
          <small>{dividendYield === null && !loading ? "No trailing yield" : "Trailing twelve months"}</small>
        </article>
        <article>
          <span>Dollar volume</span>
          <strong className="tnum">{loading ? "—" : fmtCompactCurrency(quote?.dollarVolume ?? null)}</strong>
          <small>{sessionLabel}</small>
        </article>
        <article className="company-range-stat">
          <span>52-week position</span>
          <strong className="tnum">{rangePercent === null ? "—" : `${Math.round(rangePercent)}%`}</strong>
          <small>
            {quote?.fiftyTwoWeekLow == null || quote?.fiftyTwoWeekHigh == null
              ? "Range unavailable"
              : `$${formatPrice(quote.fiftyTwoWeekLow)} low · $${formatPrice(quote.fiftyTwoWeekHigh)} high`}
          </small>
          <div className="company-range-track" aria-hidden="true">
            <i style={{ width: rangePercent === null ? "0%" : `${rangePercent}%` }} />
          </div>
        </article>
      </div>
    </section>
  );
}
