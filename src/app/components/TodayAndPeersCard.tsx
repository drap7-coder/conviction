"use client";

import { useEffect, useState } from "react";
import { getSectorForCompany } from "@/lib/market/industries";
import { fetchJsonWithTimeout } from "./evidence-request";

interface StockQuote {
  ticker: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function TodayAndIndustryCard({ ticker }: { ticker: string }) {
  const [quotes, setQuotes] = useState<Record<string, StockQuote>>({});
  const [loading, setLoading] = useState(true);
  const sector = getSectorForCompany(ticker);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      try {
        const allTickers = [ticker, sector?.ticker].filter(Boolean).join(",");
        const data = await fetchJsonWithTimeout<{ quotes?: StockQuote[] }>(
          `/api/market/quotes?tickers=${encodeURIComponent(allTickers)}`,
          8_000,
          controller.signal,
        );
        if (!cancelled) {
          const map: Record<string, StockQuote> = {};
          for (const q of data.quotes ?? []) map[q.ticker] = q;
          setQuotes(map);
        }
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; controller.abort(); };
  }, [ticker, sector?.ticker]);

  const quote = quotes[ticker];
  const sectorQuote = sector ? quotes[sector.ticker] : undefined;

  if (loading) {
    return (
      <div className="today-peers-card">
        <div className="today-peers-slot">
          <span className="move-eyebrow">Today</span>
          <strong>Loading...</strong>
        </div>
      </div>
    );
  }

  return (
    <div className="today-peers-card">
      <div className="today-peers-slot">
        <span className="move-eyebrow">Today</span>
        <strong>{ticker} {formatPercent(quote?.changePercent)}</strong>
      </div>
      <div className="today-peers-slot">
        <span className="move-eyebrow">Industry change</span>
        <strong>
          {sector
            ? `${sector.name} (${sector.ticker}) ${formatPercent(sectorQuote?.changePercent)}`
            : "Industry unavailable"}
        </strong>
      </div>
    </div>
  );
}
