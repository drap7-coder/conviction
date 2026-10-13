"use client";
import { useEffect, useState } from "react";
import { PersonalDailyBrief } from "@/components/PersonalDailyBrief";
import { HomeMarketStrip } from "@/components/market/HomeMarketStrip";
import { loadHomeNames, type HomeNames } from "@/lib/market/home-names";

/**
 * Home = mission HUD (VIX/10Y + indexes) then personal brief.
 * Full Markets / Movers / Crypto / Intl depth stays on /pulse.
 */
export function HomeOverview() {
  const [names, setNames] = useState<HomeNames>({ held: [], watched: [], portfolioError: false, watchlistError: false });
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    void loadHomeNames(controller.signal).then((next) => {
      if (controller.signal.aborted) return;
      setNames(next);
      setLoading(false);
    });
    return () => controller.abort();
  }, [retry]);
  const retryNames = () => setRetry((value) => value + 1);
  return (
    <div className="pulse-dashboard pulse-home home-overview">
      <HomeMarketStrip />
      <PersonalDailyBrief tickers={names.watched} held={names.held} loading={loading}
        portfolioError={names.portfolioError} watchlistError={names.watchlistError} onRetryWatchlist={retryNames} />
    </div>
  );
}
