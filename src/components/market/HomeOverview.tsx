"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PersonalDailyBrief } from "@/components/PersonalDailyBrief";
import { loadHomeNames, type HomeNames } from "@/lib/market/home-names";

/**
 * Home = one command brief (brand + graphs + reports).
 * Pulse owns the vertical market tape.
 */
export function HomeOverview() {
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

  const retryNames = () => setRetry((value) => value + 1);
  const scopeCount = names.held.length + names.watched.length;
  const linkLabel = loading
    ? "Syncing scope"
    : names.portfolioError || names.watchlistError
      ? "Scope partial"
      : scopeCount > 0
        ? "Scope locked"
        : "Awaiting companies";

  return (
    <div className="pulse-dashboard pulse-home home-overview home-command">
      <header className="home-command-hero">
        <div className="home-command-rail" aria-hidden="true" />
        <p className="pulse-product-label">
          <span className="home-live-dot" aria-hidden="true" />
          IQBulls / Personal intelligence
        </p>
        <div className="home-command-title-row">
          <p className="home-command-display">Your world. In focus.</p>
          <p className="pulse-seo-lede">
            Coverage graphs and sourced reporting on the companies you care about.
            Markets tape lives on Pulse.
          </p>
        </div>
        <div className="home-command-status" role="status">
          <span>
            <em>Window</em> 48h
          </span>
          <span>
            <em>Scope</em> {loading ? "…" : scopeCount}
          </span>
          <span>
            <em>Status</em> {linkLabel}
          </span>
          <Link className="home-pulse-link" href="/pulse">
            Open Pulse ↗
          </Link>
        </div>
      </header>

      <PersonalDailyBrief
        tickers={names.watched}
        held={names.held}
        loading={loading}
        portfolioError={names.portfolioError}
        watchlistError={names.watchlistError}
        onRetryWatchlist={retryNames}
      />
    </div>
  );
}
