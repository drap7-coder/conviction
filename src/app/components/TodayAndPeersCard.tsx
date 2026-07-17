"use client";

import { useEffect, useState } from "react";
import { getPeerTickers } from "@/lib/market/peers";
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

export function TodayAndPeersCard({ ticker }: { ticker: string }) {
  const [quotes, setQuotes] = useState<Record<string, StockQuote>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      try {
        const peerTickers = getPeerTickers(ticker);
        const allTickers = [ticker, ...peerTickers].join(",");
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
  }, [ticker]);

  const quote = quotes[ticker];
  const peerTickers = getPeerTickers(ticker);
  const peerQuotes = peerTickers
    .map((pt) => quotes[pt])
    .filter((q): q is StockQuote => !!q);

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
        <span className="move-eyebrow">Peers</span>
        <strong>
          {peerQuotes.length
            ? peerQuotes.map((pq) => `${pq.ticker} ${formatPercent(pq.changePercent)}`).join(" · ")
            : "Peer quotes unavailable"}
        </strong>
      </div>
      <p className="today-peers-explain">Separation from group pressure helps identify company-specific signals vs. broad market moves.</p>
    </div>
  );
}