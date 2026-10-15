"use client";

import { useEffect, useState } from "react";
import { PersonalDailyBrief } from "@/components/PersonalDailyBrief";
import { loadHomeNames, type HomeNames } from "@/lib/market/home-names";

/**
 * Personal daily brief (coverage radar, report timeline, quant overlay).
 * Mounted on Home and Portfolio → Watchlist. Never on Pulse.
 */
export function PortfolioPersonalBrief() {
  const [names, setNames] = useState<HomeNames>({
    held: [],
    watched: [],
    portfolioError: false,
    watchlistError: false,
  });
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

  return (
    <PersonalDailyBrief
      tickers={names.watched}
      held={names.held}
      loading={loading}
      portfolioError={names.portfolioError}
      watchlistError={names.watchlistError}
      onRetryWatchlist={() => setRetry((value) => value + 1)}
    />
  );
}
