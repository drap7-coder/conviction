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
  const scopeLocked = linkLabel === "Scope locked";
  // Decorative ops readouts — derived from scope so the strip stays alive with the brief.
  const nodeLatencyMs = loading ? null : 12 + ((scopeCount * 17) % 78);
  const batchThru = loading ? null : Math.max(1, Math.min(6, scopeCount || 1));
  const syncEpoch = loading ? "——" : String(1000 + ((scopeCount * 41) % 899)).padStart(4, "0");

  return (
    <div className="pulse-dashboard pulse-home home-overview home-command">
      <div className="home-telemetry-stream" aria-hidden="true">
        <div className="home-telemetry-track">
          {[0, 1].map((loop) => (
            <span key={loop} className="home-telemetry-pass">
              <span>NODE.SYNC {nodeLatencyMs == null ? "··ms" : `${nodeLatencyMs}ms`}</span>
              <span>BATCH.THRU {batchThru == null ? "·/6" : `${batchThru}/6`}</span>
              <span>SCOPE.N {loading ? "··" : String(scopeCount).padStart(2, "0")}</span>
              <span>WIN.48H LOCK</span>
              <span>CLK.{syncEpoch}</span>
              <span>UPLINK {scopeLocked ? "NOMINAL" : loading ? "HANDSHAKE" : "STANDBY"}</span>
              <span>GRID.AZ {loading ? "——" : `${(scopeCount * 13) % 360}°`}</span>
              <span>PKT.OK {loading ? "··" : String(94 + (scopeCount % 5)).padStart(2, "0")}%</span>
            </span>
          ))}
        </div>
      </div>
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
          <span className={`home-status-pill${scopeLocked ? " is-locked" : ""}`}>
            <i className="home-status-radar" aria-hidden="true" />
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
