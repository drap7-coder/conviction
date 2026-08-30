"use client";

import { useEffect, useState } from "react";
import { classifyClientError, type EvidenceStatus } from "@/app/components/evidence-request";
import type { StockQuote } from "@/lib/market/quotes";
import type { StockHistoryPoint } from "@/lib/market/quotes";
import { getExtendedSessionQuote, getLivePrice } from "@/lib/market/live-quote";
import { shortenCompanyName } from "@/lib/display/company-name";
import { PageLoadingMotion } from "@/components/PageLoadingMotion";
import { MarketMoversBoard } from "@/components/market/MarketMoversBoard";
import { rankByVolume, splitMarketMovers } from "@/lib/market/market-movers";
import { fetchMarketTrending } from "@/lib/market/client-market-data";

interface TrendingCompany {
  ticker: string;
  companyName: string;
  cik?: string;
  quote: StockQuote;
  sparkline?: StockHistoryPoint[];
  activityRank: number;
  activityLabel: string;
}

export function MarketMovesPanel() {
  const [trending, setTrending] = useState<TrendingCompany[]>([]);
  const [trendingStatus, setTrendingStatus] = useState<EvidenceStatus>("idle");
  const [requestKey, setRequestKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function loadTrending() {
      setTrendingStatus("loading");
      try {
        const data = await fetchMarketTrending(24, {
          reason: requestKey === 0 ? "initial" : "manual",
          signal: controller.signal,
        });
        if (!cancelled) {
          const companies = (data.companies ?? []) as TrendingCompany[];
          setTrending(companies);
          setTrendingStatus(companies.length > 0 ? "success" : "empty");
        }
      } catch (err) {
        console.warn("[market-moves] Failed to load trending companies:", err);
        if (!cancelled) setTrendingStatus(classifyClientError(err));
      }
    }

    void loadTrending();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [requestKey]);

  if (trendingStatus === "loading" || trendingStatus === "idle") {
    return (
      <div className="market-moves-panel">
        <PageLoadingMotion
          label="Finding active names"
          showLabel={false}
          showSubtitle={false}
          speed="slow"
        />
      </div>
    );
  }

  if (trending.length === 0) {
    return (
      <div className="market-moves-panel">
        <div className="empty-state">
          <p>No market moves loaded right now.</p>
          <small>Market activity is temporarily unavailable.</small>
          <button className="retry-button mt-8" type="button" onClick={() => setRequestKey((key) => key + 1)}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const mapped = trending.map((idea) => {
      const quote = idea.quote;
      const live = getLivePrice(quote);
      const extended = getExtendedSessionQuote(quote);
      const inExtended = Boolean(extended.sessionLabel);
      return {
        ticker: idea.ticker,
        name: shortenCompanyName(idea.companyName),
        // Rank Top/Bottom on the regular session move; extended sits on its own row.
        changePercent: quote.changePercent ?? live.changePercent,
        change: quote.change ?? null,
        price: inExtended ? (quote.price ?? null) : (live.price ?? quote.price ?? null),
        extendedPrice: extended.price,
        extendedChange: extended.change,
        extendedChangePercent: extended.changePercent,
        extendedNoTrades: extended.noTrades,
        sessionLabel: extended.sessionLabel,
        volume: quote.volume ?? null,
        dollarVolume: quote.dollarVolume ?? null,
      };
    });
  const movers = splitMarketMovers(mapped, 5);
  const volume = rankByVolume(mapped, 5);

  const sessionLabel =
    trending
      .map((idea) => {
        const extended = getExtendedSessionQuote(idea.quote);
        return extended.sessionLabel ?? getLivePrice(idea.quote).label;
      })
      .find((label): label is string => Boolean(label)) ?? null;

  return (
    <div className="market-moves-panel">
      <MarketMoversBoard
        title="Market Movers"
        top={movers.top}
        bottom={movers.bottom}
        volume={volume}
        showVolume
        sessionLabel={sessionLabel}
      />
    </div>
  );
}
