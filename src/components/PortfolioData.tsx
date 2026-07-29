"use client";

import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { loadPositions } from "@/lib/portfolio/persist";
import { getLivePrice } from "@/lib/market/live-quote";
import { computePortfolioMetrics } from "@/lib/portfolio/calculations";
import type { PersistedPosition } from "@/lib/portfolio/persist";
import type { StockQuote } from "@/lib/market/quotes";
import { isFiniteNumber } from "@/lib/display/format";

const PORTFOLIO_CHANGED_EVENT = "conviction-portfolio-changed";

export function notifyPortfolioChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(PORTFOLIO_CHANGED_EVENT));
}

function currency(value: number | null): string {
  if (!isFiniteNumber(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function signedCurrency(value: number | null): string {
  if (!isFiniteNumber(value)) return "—";
  if (value === 0) return "$0.00";
  return `${value > 0 ? "+" : "−"}$${Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function percent(value: number | null): string {
  if (!isFiniteNumber(value)) return "—";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

interface PortfolioData {
  totalMarketValue: number | null;
  dailyChange: number | null;
  dailyChangePercent: number | null;
  totalUnrealizedGL: number | null;
  totalUnrealizedGLPercent: number | null;
  positionCount: number;
  hasData: boolean;
  loading: boolean;
  error: string | null;
  sessionLabel: string | null;
}

interface PortfolioDataContextValue {
  data: PortfolioData;
  quotes: StockQuote[];
  refresh: () => void;
  reloadPositions: () => void;
}

const PortfolioDataContext = createContext<PortfolioDataContextValue | null>(null);

export function usePortfolioData() {
  const ctx = useContext(PortfolioDataContext);
  if (!ctx) throw new Error("usePortfolioData must be used within PortfolioDataProvider");
  return ctx;
}

function enrichWithPrices(
  persisted: PersistedPosition[],
  quotes: StockQuote[],
): { companyId: string; shares: number; averageCost?: number; currentPrice: number | null; previousClose: number | null }[] {
  const quoteMap = new Map(quotes.map((q) => [q.ticker.toUpperCase(), q]));
  return persisted.map((p) => {
    const ticker = p.ticker.toUpperCase();
    const quote = quoteMap.get(ticker);
    const live = quote ? getLivePrice(quote) : null;
    return {
      companyId: ticker,
      shares: p.shares,
      averageCost: p.averageCost,
      currentPrice: live?.price ?? quote?.price ?? null,
      previousClose: quote?.previousClose ?? null,
    };
  });
}

function sessionLabelFromQuotes(quotes: StockQuote[]): string | null {
  for (const quote of quotes) {
    const label = getLivePrice(quote).label;
    if (label) return label;
  }
  return null;
}

export function PortfolioDataProvider({ children }: { children: React.ReactNode }) {
  const [positions, setPositions] = useState<PersistedPosition[]>([]);
  const [quotes, setQuotes] = useState<StockQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reloadPositions = useCallback(() => {
    setPositions(loadPositions());
  }, []);

  useEffect(() => {
    reloadPositions();
    function onChanged() {
      reloadPositions();
    }
    window.addEventListener(PORTFOLIO_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(PORTFOLIO_CHANGED_EVENT, onChanged);
  }, [reloadPositions]);

  const fetchQuotes = useCallback(async (tickers: string[]) => {
    if (tickers.length === 0) {
      setQuotes([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/market/quotes?tickers=${tickers.join(",")}`);
      if (!res.ok) throw new Error("Quote data is temporarily unavailable");
      const data = await res.json();
      setQuotes(data.quotes ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load prices");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const tickers = positions.map((p) => p.ticker).filter(Boolean);
    const unique = Array.from(new Set(tickers));
    if (unique.length > 0) {
      fetchQuotes(unique);
    } else {
      setQuotes([]);
      setLoading(false);
    }
  }, [positions, fetchQuotes]);

  const refresh = useCallback(() => {
    const tickers = positions.map((p) => p.ticker).filter(Boolean);
    fetchQuotes(Array.from(new Set(tickers)));
  }, [positions, fetchQuotes]);

  const data = useMemo(() => {
    const enriched = enrichWithPrices(positions, quotes);
    const metrics = computePortfolioMetrics(enriched);

    return {
      totalMarketValue: metrics.totalMarketValue,
      dailyChange: metrics.dailyChange,
      dailyChangePercent: metrics.dailyChangePercent,
      totalUnrealizedGL: metrics.totalUnrealizedGL,
      totalUnrealizedGLPercent: metrics.totalUnrealizedGLPercent,
      positionCount: enriched.length,
      hasData: enriched.length > 0,
      loading,
      error,
      sessionLabel: sessionLabelFromQuotes(quotes),
    };
  }, [positions, quotes, loading, error]);

  return (
    <PortfolioDataContext.Provider value={{ data, quotes, refresh, reloadPositions }}>
      {children}
    </PortfolioDataContext.Provider>
  );
}

export function PortfolioHero() {
  const { data } = usePortfolioData();

  if (data.loading) {
    return (
      <div className="pf-hero">
        <div className="pf-hero-value">
          <span className="pf-hero-total">—</span>
        </div>
      </div>
    );
  }

  if (!data.hasData) {
    return (
      <div className="pf-hero">
        <div className="pf-hero-value">
          <span className="pf-hero-total">$0.00</span>
          <span className="pf-hero-note">No positions yet</span>
        </div>
      </div>
    );
  }

  return (
    <div className="pf-hero">
      <div className="pf-hero-value">
        <span className="pf-hero-total">{currency(data.totalMarketValue)}</span>
        {data.dailyChange !== null && (
          <span className={`pf-hero-change ${data.dailyChange >= 0 ? "up" : "down"}`}>
            {signedCurrency(data.dailyChange)} {percent(data.dailyChangePercent)}
          </span>
        )}
        {data.sessionLabel ? (
          <span className="pf-hero-session-chip">{data.sessionLabel}</span>
        ) : null}
      </div>
      {data.totalUnrealizedGL !== null && (
        <div className={`pf-hero-secondary ${data.totalUnrealizedGL >= 0 ? "up" : "down"}`}>
          Unrealized {signedCurrency(data.totalUnrealizedGL)}
          {data.totalUnrealizedGLPercent !== null && (
            <> ({percent(data.totalUnrealizedGLPercent)})</>
          )}
        </div>
      )}
    </div>
  );
}
