"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchJsonWithTimeout, type EvidenceStatus } from "./evidence-request";
import {
  type OwnershipInputInstitutional,
  type OwnershipInputInsider,
  type VectorResult,
  ETF_TICKERS,
  resolveOwnershipVector,
  resolveFundamentalsVector,
  resolvePriceVector,
} from "@/lib/evidence/vectorResolvers";
import { computeSma } from "@/lib/utils/technical";

// ── Response types (matching existing API routes) ─────────────────────────

interface InstitutionalAccumulation {
  status: "New" | "Increased" | "Unchanged" | "Reduced" | "Exited";
  filingDate: string;
  shareChange: number;
}

interface InstitutionalResponse {
  results: InstitutionalAccumulation[];
  status?: "success" | "timeout" | "error";
}

interface InsiderEvent {
  type: string;
  date: string;
  metadata?: {
    transactionType?: string | null;
  };
}

interface InsiderResponse {
  events: InsiderEvent[];
}

interface StockHistoryPoint {
  date: string;
  close: number;
}

interface StockHistory {
  points: StockHistoryPoint[];
  endPrice: number | null;
}

interface HistoryResponse {
  history: StockHistory;
}

// ── Props ─────────────────────────────────────────────────────────────────

interface MultiVectorSummaryProps {
  ticker: string;
}

// ── State pill styling ────────────────────────────────────────────────────

function statePillClass(state: string): string {
  switch (state) {
    case "strong":
      return "pill-positive";
    case "mixed":
      return "pill-mixed";
    case "weak":
      return "pill-negative";
    case "awaiting":
      return "pill-neutral";
    case "unsupported":
      return "pill-neutral";
    case "error":
      return "pill-negative";
    default:
      return "pill-neutral";
  }
}

function VectorCard({ result }: { result: VectorResult }) {
  if (result.state === "unsupported") return null;

  return (
    <div className="vector-card">
      <div className="vector-card-header">
        <span className="vector-card-label">{result.label}</span>
        <span className={`vector-card-state ${statePillClass(result.state)}`}>
          {result.state}
        </span>
      </div>
      <p className="vector-card-reason">{result.reason}</p>
      <div className="vector-card-meta">
        {result.asOf ? (
          <span className="vector-card-asof">As of {result.asOf}</span>
        ) : null}
        {result.sourceCount > 0 ? (
          <span className="vector-card-count">{result.sourceCount} source{result.sourceCount === 1 ? "" : "s"}</span>
        ) : null}
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────

export function MultiVectorSummary({ ticker }: MultiVectorSummaryProps) {
  const upperTicker = ticker.toUpperCase();
  const isEtf = ETF_TICKERS.has(upperTicker);

  const [institutional, setInstitutional] = useState<InstitutionalAccumulation[] | null>(null);
  const [institutionalStatus, setInstitutionalStatus] = useState<string | null>(null);
  const [insiderEvents, setInsiderEvents] = useState<InsiderEvent[] | null>(null);
  const [insiderStatus, setInsiderStatus] = useState<string | null>(null);
  const [history, setHistory] = useState<StockHistory | null>(null);
  const [historyStatus, setHistoryStatus] = useState<EvidenceStatus>("idle");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      const [instResult, insiderResult, histResult] = await Promise.allSettled([
        fetchJsonWithTimeout<InstitutionalResponse>(
          `/api/evidence/institutional?ticker=${ticker}`,
          14_000,
          controller.signal,
        ),
        fetchJsonWithTimeout<InsiderResponse>(
          `/api/evidence/insider?ticker=${ticker}`,
          14_000,
          controller.signal,
        ),
        fetchJsonWithTimeout<HistoryResponse>(
          `/api/market/history?ticker=${encodeURIComponent(ticker)}&range=1y`,
          8_000,
          controller.signal,
        ),
      ]);

      if (cancelled) return;

      if (instResult.status === "fulfilled") {
        setInstitutional(instResult.value.results ?? []);
        setInstitutionalStatus(instResult.value.status ?? "success");
      } else {
        setInstitutional([]);
        setInstitutionalStatus("error");
      }

      if (insiderResult.status === "fulfilled") {
        setInsiderEvents(insiderResult.value.events ?? []);
        setInsiderStatus("success");
      } else {
        setInsiderEvents([]);
        setInsiderStatus("error");
      }

      if (histResult.status === "fulfilled") {
        setHistory(histResult.value.history);
        setHistoryStatus(
          histResult.value.history.points.length >= 2 ? "success" : "empty",
        );
      } else {
        setHistory(null);
        setHistoryStatus("error");
      }

      setLoaded(true);
    }

    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [ticker]);

  const ownershipResult: VectorResult | null = useMemo(() => {
    if (!loaded) return null;
    return resolveOwnershipVector({
      isEft: isEtf,
      institutional: (institutional ?? []) as OwnershipInputInstitutional[],
      insider: (insiderEvents ?? []).map((e) => ({
        transactionType: e.metadata?.transactionType ?? null,
        date: e.date,
      })) as OwnershipInputInsider[],
      institutionalStatus,
      insiderStatus,
    });
  }, [loaded, isEtf, institutional, insiderEvents, institutionalStatus, insiderStatus]);

  const fundamentalsResult: VectorResult | null = useMemo(() => {
    if (!loaded) return null;
    // No dedicated earnings/guidance endpoint exists; always return awaiting
    return resolveFundamentalsVector({
      isEft: isEtf,
      earnings: null,
      guidance: null,
      earningsStatus: null,
      guidanceStatus: null,
    });
  }, [loaded, isEtf]);

  const priceResult: VectorResult | null = useMemo(() => {
    if (!loaded) return null;

    let sma50: number | null = null;
    let sma200: number | null = null;

    if (history && history.points.length >= 200) {
      const closes = history.points.map((p) => p.close);
      const sma50Vals = computeSma(closes, 50);
      const sma200Vals = computeSma(closes, 200);
      sma50 = sma50Vals[sma50Vals.length - 1] ?? null;
      sma200 = sma200Vals[sma200Vals.length - 1] ?? null;
    }

    return resolvePriceVector({
      currentPrice: history?.endPrice ?? null,
      sma50,
      sma200,
      priceStatus: historyStatus,
    });
  }, [loaded, history, historyStatus]);

  if (!loaded) {
    return (
      <div className="multi-vector-summary">
        <div className="vector-card vector-card-loading">
          <span className="vector-card-label">Loading vectors</span>
          <p className="vector-card-reason">Fetching ownership, fundamentals, and price data...</p>
        </div>
      </div>
    );
  }

  const vectors = [ownershipResult, fundamentalsResult, priceResult].filter(
    (v): v is VectorResult => v !== null && v.state !== "unsupported",
  );

  if (vectors.length === 0) return null;

  return (
    <div className="multi-vector-summary">
      {vectors.map((v) => (
        <VectorCard key={v.label} result={v} />
      ))}
    </div>
  );
}
