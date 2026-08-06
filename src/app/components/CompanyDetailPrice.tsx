"use client";

import { useEffect, useMemo, useState } from "react";
import { getLivePrice } from "@/lib/market/live-quote";
import type { StockQuote } from "@/lib/market/quotes";

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

/** Live price + session delta for the company-detail briefing stack. */
export function CompanyDetailPrice({ ticker }: { ticker: string }) {
  const [quote, setQuote] = useState<StockQuote | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/market/quotes?tickers=${encodeURIComponent(ticker)}`);
        if (!res.ok) return;
        const data = (await res.json()) as { quotes?: StockQuote[] };
        if (!cancelled) {
          setQuote((data.quotes ?? [])[0] ?? null);
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

  return (
    <section className="cdh-price-module" aria-label={`${ticker} price`}>
      <div className="cdh-prices cdh-prices-standalone">
        <div className="cdh-live-price">
          {loading ? (
            <span className="cdh-price-loading">—</span>
          ) : live?.price != null ? (
            <>
              <span className={`cdh-arrow ${live.change !== null && live.change > 0 ? "up" : live.change !== null && live.change < 0 ? "down" : ""}`}>
                {arrow}
              </span>
              <span className="cdh-price-big">
                ${formatPrice(live.price)}
              </span>
              {live.label ? (
                <span className="cdh-price-session">{live.label}</span>
              ) : null}
              {changeText ? (
                <span className={`cdh-change ${live.change !== null && live.change > 0 ? "up" : live.change !== null && live.change < 0 ? "down" : ""}`}>
                  {changeText.dollars} ({changeText.percent})
                </span>
              ) : null}
            </>
          ) : (
            <span className="cdh-price-na">Price unavailable</span>
          )}
        </div>

        {isExtendedSession && quote ? (
          <div className="cdh-session-row">
            <span className="cdh-session-ref">
              <span className="cdh-ref-label">At close</span>
              <span className="cdh-ref-price">
                ${formatPrice(quote.price)}
              </span>
              {regularChangeText ? (
                <span className={`cdh-ref-change ${quote.change !== null && quote.change > 0 ? "up" : quote.change !== null && quote.change < 0 ? "down" : ""}`}>
                  {regularChangeText.percent}
                </span>
              ) : null}
            </span>
          </div>
        ) : null}
      </div>
    </section>
  );
}
