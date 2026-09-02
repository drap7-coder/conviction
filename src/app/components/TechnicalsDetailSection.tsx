"use client";

import { useEffect, useState, type ReactNode } from "react";
import { TechnicalStateCard } from "@/app/components/TechnicalStateCard";
import { classifyClientError, fetchJsonWithTimeout, type EvidenceStatus } from "./evidence-request";
import { fetchMarketQuotes } from "@/lib/market/client-market-data";

interface StockHistoryPoint {
  date: string;
  close: number;
}

interface StockHistory {
  ticker: string;
  range: string;
  points: StockHistoryPoint[];
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  endPrice: number | null;
}

/** Detail panel for the Technicals Conviction Signals row. */
export function TechnicalsDetailSection({ ticker }: { ticker: string }) {
  const [history, setHistory] = useState<StockHistory | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [status, setStatus] = useState<EvidenceStatus>("idle");

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      setStatus("loading");
      try {
        const [historyRes, quotes] = await Promise.all([
          fetchJsonWithTimeout<{ history?: StockHistory | null }>(
            `/api/market/history?ticker=${encodeURIComponent(ticker)}&range=1y`,
            14_000,
            controller.signal,
          ),
          fetchMarketQuotes([ticker], { reason: "initial", signal: controller.signal }),
        ]);
        if (cancelled) return;
        // /api/market/history wraps the series as { history, fetchedAt }.
        const historyData = historyRes?.history ?? null;
        const points = Array.isArray(historyData?.points) ? historyData.points : [];
        setHistory(points.length > 0 && historyData ? { ...historyData, points } : null);
        setCurrentPrice(quotes[0]?.price ?? historyData?.endPrice ?? null);
        setStatus(points.length > 0 ? "success" : "empty");
      } catch (caught) {
        if (!cancelled) {
          const next = classifyClientError(caught);
          setStatus(next === "idle" ? "error" : next);
          setHistory(null);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [ticker]);

  return (
    <TechnicalsDetailShell>
      <TechnicalStateCard
        history={history}
        status={status === "empty" ? "error" : status}
        currentPrice={currentPrice}
      />
    </TechnicalsDetailShell>
  );
}

function TechnicalsDetailShell({ children }: { children: ReactNode }) {
  return <div className="conviction-signal-technicals-detail">{children}</div>;
}
