"use client";
import { useEffect, useMemo, useState } from "react";
import { PersonalDailyBrief } from "@/components/PersonalDailyBrief";
import { HomeMarketStrip } from "@/components/market/HomeMarketStrip";
import { PulseYourStocks } from "@/components/market/PulseYourStocks";
import { loadHomeNames, type HomeNames } from "@/lib/market/home-names";
import { personalSnapshotTickers } from "@/lib/market/pulse-home";

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
  const tickers = useMemo(() => personalSnapshotTickers(names.held, names.watched, 6), [names.held, names.watched]);
  const error = names.portfolioError || names.watchlistError;
  return (
    <div className="pulse-dashboard pulse-home home-overview">
      <PersonalDailyBrief tickers={names.watched} held={names.held} loading={loading}
        portfolioError={names.portfolioError} watchlistError={names.watchlistError} onRetryWatchlist={retryNames} />
      <HomeMarketStrip />
      {loading || error || tickers.length > 0 ? (
        <PulseYourStocks tickers={tickers} loading={loading} error={error} onRetry={retryNames} />
      ) : null}
    </div>
  );
}
