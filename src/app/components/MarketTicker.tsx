"use client";

import { useEffect, useState } from "react";
import { fetchJsonWithTimeout } from "@/app/components/evidence-request";

interface MarketQuote {
  ticker: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
}

const MARKETS = [
  { ticker: "^DJI", label: "DOW" },
  { ticker: "^GSPC", label: "SPX" },
  { ticker: "QQQ", label: "QQQ" },
] as const;

function formatLevel(value: number | null) {
  if (value === null) return "—";
  return value.toLocaleString(undefined, {
    maximumFractionDigits: value >= 1_000 ? 0 : 2,
    minimumFractionDigits: value >= 1_000 ? 0 : 2,
  });
}

export function MarketTicker() {
  const [quotes, setQuotes] = useState<Record<string, MarketQuote>>({});

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      try {
        const data = await fetchJsonWithTimeout<{ quotes?: MarketQuote[] }>(
          `/api/market/quotes?tickers=${encodeURIComponent(MARKETS.map((market) => market.ticker).join(","))}`,
          8_000,
          controller.signal,
        );
        if (cancelled) return;
        setQuotes(Object.fromEntries((data.quotes ?? []).map((quote) => [quote.ticker, quote])));
      } catch (error) {
        console.error("[MarketTicker] provider request failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    void load();
    const refresh = window.setInterval(load, 60_000);
    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(refresh);
    };
  }, []);

  return (
    <div className="market-ticker" aria-label="Live market summary">
      {MARKETS.map((market) => {
        const quote = quotes[market.ticker];
        const direction = !quote?.change
          ? "neutral"
          : quote.change > 0
            ? "positive"
            : "negative";
        return (
          <div className="market-ticker-item" key={market.ticker}>
            <strong>{market.label}</strong>
            <span>{formatLevel(quote?.price ?? null)}</span>
            <b className={direction}>
              {quote?.changePercent != null
                ? `${quote.changePercent > 0 ? "+" : ""}${quote.changePercent.toFixed(2)}%`
                : "—"}
            </b>
          </div>
        );
      })}
    </div>
  );
}
