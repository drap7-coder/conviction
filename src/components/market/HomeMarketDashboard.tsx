"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import type { PulseData, PulseGlobalMarket } from "@/app/api/market/pulse/route";
import { fetchJsonWithTimeout } from "@/app/components/evidence-request";
import { pulseMacroGauges } from "@/lib/market/pulse-gauges";

function formatPrice(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatChange(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  if (value === 0) return "0.00%";
  return `${value > 0 ? "+" : "−"}${Math.abs(value).toFixed(2)}%`;
}

function liveValues(market: PulseGlobalMarket) {
  const extended = market.extendedPrice != null && !market.extendedNoTrades;
  return {
    price: extended ? market.extendedPrice : market.price,
    change: extended ? market.extendedChangePercent : market.changePercent,
    session: extended ? market.sessionLabel : "Regular",
  };
}

function sparklinePath(history: PulseGlobalMarket["history"]): string {
  const values = history.map((point) => point.close).filter(Number.isFinite);
  if (values.length < 2) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 100;
      const y = 30 - ((value - min) / span) * 26;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

function IndexTile({ market, order }: { market: PulseGlobalMarket; order: number }) {
  const values = liveValues(market);
  const tone = (values.change ?? 0) > 0 ? "up" : (values.change ?? 0) < 0 ? "down" : "flat";
  const shortName = market.ticker === "DIA" ? "Dow" : market.ticker === "SPY" ? "S&P 500" : market.ticker === "QQQ" ? "Nasdaq 100" : "Russell 2000";
  const path = sparklinePath(market.history);

  return (
    <Link
      href={`/companies/${market.ticker}`}
      className={`home-index-tile is-${tone}`}
      style={{ "--tile-order": order } as CSSProperties}
      aria-label={`${shortName}, ${formatPrice(values.price)}, ${formatChange(values.change)}`}
    >
      <header>
        <div>
          <span className="home-index-symbol">{market.ticker}</span>
          <span className="home-index-name">{shortName}</span>
        </div>
        <span className="home-index-session">{values.session}</span>
      </header>
      <div className="home-index-quote">
        <strong className="tnum">{formatPrice(values.price)}</strong>
        <span className="tnum">{formatChange(values.change)}</span>
      </div>
      <div className="home-index-spark" aria-hidden="true">
        <svg viewBox="0 0 100 34" preserveAspectRatio="none">
          <path className="home-index-spark-baseline" d="M0 17 L100 17" />
          {path ? <path className="home-index-spark-line" d={path} /> : null}
        </svg>
      </div>
    </Link>
  );
}

export function HomeMarketDashboard() {
  const [data, setData] = useState<PulseData | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const controller = new AbortController();
    let lastAttempt = 0;
    let inFlight = false;
    async function load() {
      if (inFlight || (lastAttempt && Date.now() - lastAttempt < 60_000)) return;
      inFlight = true;
      lastAttempt = Date.now();
      try {
        const payload = await fetchJsonWithTimeout<PulseData>("/api/market/pulse", 10000, controller.signal);
        if (controller.signal.aborted) return;
        setData(payload);
        setStatus("ready");
      } catch (error) {
        if (controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) return;
        setStatus("error");
      } finally {
        inFlight = false;
      }
    }
    void load();
    const refresh = () => {
      if (document.visibilityState === "visible") void load();
    };
    const interval = window.setInterval(refresh, 60_000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      controller.abort();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const indexes = data?.globalMarkets.filter((market) => market.category === "Major Index") ?? [];
  const gauges = pulseMacroGauges(data?.indicators ?? []);
  const sectors = data?.sectors ?? [];
  const advancing = sectors.filter((sector) => (sector.changePercent ?? 0) > 0).length;
  const declining = sectors.filter((sector) => (sector.changePercent ?? 0) < 0).length;
  const ranked = [...sectors].sort((a, b) => (b.changePercent ?? -Infinity) - (a.changePercent ?? -Infinity));
  const leader = ranked[0];
  const laggard = ranked.at(-1);
  const updated = data?.fetchedAt
    ? new Date(data.fetchedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : null;

  return (
    <section className="home-market-command" aria-labelledby="home-market-command-heading">
      <header className="home-market-command-head">
        <div>
          <p className="home-command-kicker"><span aria-hidden="true" /> Live market command</p>
          <h2 id="home-market-command-heading">The market, right now.</h2>
        </div>
        <div className="home-command-meta">
          <span>{data?.sessionLabel ?? "Market snapshot"}</span>
          {updated ? <time dateTime={data?.fetchedAt}>Updated {updated}</time> : null}
          <Link href="/pulse">Open full Pulse <span aria-hidden="true">→</span></Link>
        </div>
      </header>

      {status === "loading" && !data ? <div className="home-command-loading" role="status">Syncing live market telemetry…</div> : null}
      {status === "error" && !data ? <div className="home-command-loading" role="status">Market telemetry is temporarily unavailable.</div> : null}

      {data ? (
        <>
          <div className="home-index-grid" aria-label="Major index performance">
            {indexes.map((market, index) => <IndexTile key={market.ticker} market={market} order={index} />)}
          </div>

          <div className="home-command-context">
            {gauges.map((gauge) => (
              <article className={`home-context-card is-${gauge.tone}`} key={gauge.id}>
                <span>{gauge.label}</span>
                <strong className="tnum">{gauge.value}</strong>
                <em>{gauge.status}</em>
                <small>{gauge.caption}</small>
              </article>
            ))}
            <article className="home-context-card home-breadth-card">
              <span>Sector breadth</span>
              <strong className="tnum">{advancing}↑ <b>/</b> {declining}↓</strong>
              <em>{advancing > declining ? "RISK ON" : advancing < declining ? "DEFENSIVE" : "MIXED"}</em>
              <small>Advancing vs. declining</small>
            </article>
            <article className="home-context-card home-leadership-card">
              <span>Leadership</span>
              <strong>{leader?.name ?? "—"}</strong>
              <em className="tnum">{formatChange(leader?.changePercent)}</em>
              <small>{laggard ? `Laggard: ${laggard.name} ${formatChange(laggard.changePercent)}` : "Sector rotation"}</small>
            </article>
          </div>
        </>
      ) : null}
    </section>
  );
}
