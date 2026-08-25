"use client";

import { useEffect, useState } from "react";
import { classifyClientError, fetchJsonWithTimeout, type EvidenceStatus } from "@/app/components/evidence-request";
import type { StockQuote } from "@/lib/market/quotes";
import type { StockHistoryPoint } from "@/lib/market/quotes";
import { getLivePrice } from "@/lib/market/live-quote";
import { shortenCompanyName } from "@/lib/display/company-name";
import { PageLoadingMotion } from "@/components/PageLoadingMotion";
import { PulseDecisionCard } from "@/components/market/PulseDecisionCard";
import { MarketMoversBoard } from "@/components/market/MarketMoversBoard";
import { buildMomentumBrief } from "@/lib/market/pulse-brief";
import { splitMarketMovers } from "@/lib/market/market-movers";

interface TrendingCompany {
  ticker: string;
  companyName: string;
  cik?: string;
  quote: StockQuote;
  sparkline?: StockHistoryPoint[];
  activityRank: number;
  activityLabel: string;
}

export function MarketMovesPanel({
  showDecisionCard = true,
}: {
  /** When false, skip the stacked momentum brief (Pulse Trending already has breadth). */
  showDecisionCard?: boolean;
}) {
  const [trending, setTrending] = useState<TrendingCompany[]>([]);
  const [trendingStatus, setTrendingStatus] = useState<EvidenceStatus>("idle");
  const [requestKey, setRequestKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function loadTrending() {
      setTrendingStatus("loading");
      try {
        const data = await fetchJsonWithTimeout<{ companies?: TrendingCompany[] }>(
          "/api/market/trending?limit=24",
          10_000,
          controller.signal,
        );
        if (!cancelled) {
          const companies = data.companies ?? [];
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

  const momentumBrief = showDecisionCard
    ? buildMomentumBrief(trending.map((idea) => {
        const live = getLivePrice(idea.quote);
        return {
          ticker: idea.ticker,
          companyName: idea.companyName,
          changePercent: live.changePercent,
        };
      }))
    : null;

  const movers = splitMarketMovers(
    trending.map((idea) => {
      const live = getLivePrice(idea.quote);
      return {
        ticker: idea.ticker,
        name: shortenCompanyName(idea.companyName),
        changePercent: live.changePercent,
        price: live.price,
      };
    }),
    5,
  );

  const sessionLabel =
    trending
      .map((idea) => getLivePrice(idea.quote).label)
      .find((label): label is string => Boolean(label)) ?? null;

  return (
    <div className="market-moves-panel">
      {momentumBrief ? <PulseDecisionCard brief={momentumBrief} compact /> : null}

      <MarketMoversBoard
        title="Market Movers"
        top={movers.top}
        bottom={movers.bottom}
        sessionLabel={sessionLabel}
      />
    </div>
  );
}
