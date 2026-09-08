"use client";

import { useEffect, useState } from "react";
import { classifyClientError, type EvidenceStatus } from "@/app/components/evidence-request";
import type { StockQuote } from "@/lib/market/quotes";
import type { StockHistoryPoint } from "@/lib/market/quotes";
import { getExtendedSessionQuote, getLivePrice } from "@/lib/market/live-quote";
import { shortenCompanyName } from "@/lib/display/company-name";
import { PageLoadingMotion } from "@/components/PageLoadingMotion";
import { MarketMoversBoard } from "@/components/market/MarketMoversBoard";
import {
  isOffHoursMoversSession,
  moversInsufficientDataLabel,
  moversSessionDisplayLabel,
  rankByVolume,
  resolveMoversActiveSession,
  splitMarketMovers,
} from "@/lib/market/market-movers";
import { fetchMarketTrending, subscribeMarketData } from "@/lib/market/client-market-data";

interface TrendingCompany {
  ticker: string;
  companyName: string;
  cik?: string;
  quote: StockQuote;
  sparkline?: StockHistoryPoint[];
  activityRank: number;
  activityLabel: string;
}

function asTrendingCompanies(
  companies: Array<{ ticker: string; quote?: StockQuote; companyName?: string }> | undefined,
): TrendingCompany[] {
  return (companies ?? []) as TrendingCompany[];
}

export function MarketMovesPanel() {
  const [trending, setTrending] = useState<TrendingCompany[]>([]);
  const [trendingStatus, setTrendingStatus] = useState<EvidenceStatus>("idle");
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setTrendingStatus((prev) => (prev === "success" ? prev : "loading"));

    const apply = (companies: TrendingCompany[]) => {
      if (cancelled) return;
      setTrending(companies);
      setTrendingStatus(companies.length > 0 ? "success" : "empty");
    };

    const subscription = subscribeMarketData({
      trendingLimit: 24,
      onTrending: (payload) => apply(asTrendingCompanies(payload.companies)),
    });

    // subscribeMarketData swallows errors to keep last-good UI; surface the
    // first-paint failure (deduped with the subscriber refresh via cachedFetch).
    void fetchMarketTrending(24, {
      reason: refreshNonce === 0 ? "initial" : "manual",
      force: refreshNonce > 0,
      signal: controller.signal,
    })
      .then((data) => apply(asTrendingCompanies(data.companies)))
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setTrendingStatus((prev) => (prev === "success" ? prev : classifyClientError(err)));
      });

    return () => {
      cancelled = true;
      controller.abort();
      subscription.unsubscribe();
    };
  }, [refreshNonce]);

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
          <button
            className="retry-button mt-8"
            type="button"
            onClick={() => {
              setTrendingStatus("loading");
              setRefreshNonce((key) => key + 1);
            }}
          >
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
      // RTH fields kept as the regular-session baseline / prior-close secondary.
      changePercent: quote.changePercent ?? live.changePercent,
      change: quote.change ?? null,
      price: inExtended ? (quote.price ?? null) : (live.price ?? quote.price ?? null),
      // Off-hours print — mapped from preMarket* / postMarket* inside getExtendedSessionQuote.
      extendedPrice: extended.price,
      extendedChange: extended.change,
      extendedChangePercent: extended.changePercent,
      extendedNoTrades: extended.noTrades,
      sessionLabel: extended.sessionLabel,
      volume: quote.volume ?? null,
      dollarVolume: quote.dollarVolume ?? null,
    };
  });

  const sessionHint =
    trending
      .map((idea) => {
        const extended = getExtendedSessionQuote(idea.quote);
        const live = getLivePrice(idea.quote);
        return {
          sessionLabel: extended.sessionLabel ?? live.label,
          clockSession: live.session,
        };
      })
      .find((entry) => Boolean(entry.sessionLabel) || entry.clockSession !== "regular")
    ?? null;

  const session = resolveMoversActiveSession({
    sessionLabel: sessionHint?.sessionLabel ?? null,
    clockSession: sessionHint?.clockSession ?? null,
  });
  const sessionLabel = moversSessionDisplayLabel(session);
  const movers = splitMarketMovers(mapped, 5, { session });
  const volume = rankByVolume(mapped, 5, { session });
  const insufficient = isOffHoursMoversSession(session)
    ? moversInsufficientDataLabel(session)
    : undefined;

  return (
    <div className="market-moves-panel">
      <MarketMoversBoard
        title="Market Movers"
        top={movers.top}
        bottom={movers.bottom}
        volume={volume}
        showVolume
        sessionLabel={sessionLabel}
        topEmptyLabel={insufficient ?? "No gainers yet."}
        bottomEmptyLabel={insufficient ?? "No losers yet."}
        volumeEmptyLabel={insufficient ?? "No volume leaders yet."}
      />
    </div>
  );
}
