"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import type { PulseData } from "@/app/api/market/pulse/route";
import { fetchJsonWithTimeout } from "@/app/components/evidence-request";
import { fetchMarketQuotes } from "@/lib/market/client-market-data";
import {
  homeIndexSessionLabel,
  resolveHomeIndexLiveQuote,
} from "@/lib/market/home-index-quote";
import { pulseMacroGauges } from "@/lib/market/pulse-gauges";
import type { StockHistoryPoint } from "@/lib/market/quotes";

const HOME_MARKETS = [
  /** Cash SPX has no Yahoo pre/AH print — SPY carries the live session move. */
  { ticker: "^GSPC", proxyTicker: "SPY", symbol: "SPX", name: "S&P 500" },
  { ticker: "USO", symbol: "OIL", name: "Crude Oil · USO" },
  { ticker: "GLD", symbol: "GOLD", name: "Gold · GLD" },
] as const;

interface DashboardMarket {
  ticker: string;
  symbol: string;
  name: string;
  price: number | null;
  changePercent: number | null;
  session: string;
  history: StockHistoryPoint[];
}

function formatPrice(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatChange(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  if (value === 0) return "0.00%";
  return `${value > 0 ? "+" : "−"}${Math.abs(value).toFixed(2)}%`;
}

function sparklinePath(history: StockHistoryPoint[]): string {
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

function MarketTile({ market, order }: { market: DashboardMarket; order: number }) {
  const tone = (market.changePercent ?? 0) > 0 ? "up" : (market.changePercent ?? 0) < 0 ? "down" : "flat";
  const path = sparklinePath(market.history);

  return (
    <Link
      href="/pulse"
      className={`home-index-tile asset-${market.symbol.toLowerCase()} is-${tone}`}
      style={{ "--tile-order": order } as CSSProperties}
      aria-label={`${market.name}, ${formatPrice(market.price)}, ${formatChange(market.changePercent)}`}
    >
      <header>
        <div>
          <span className="home-index-symbol">{market.symbol}</span>
          <span className="home-index-name">{market.name}</span>
        </div>
        <span className="home-index-session">{market.session}</span>
      </header>
      <div className="home-index-quote">
        <strong className="home-index-move tnum">{formatChange(market.changePercent)}</strong>
        <span className="home-index-level tnum">Level {formatPrice(market.price)}</span>
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
  const [markets, setMarkets] = useState<DashboardMarket[]>([]);
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
        const quoteTickers = HOME_MARKETS.flatMap((market) =>
          "proxyTicker" in market && market.proxyTicker
            ? [market.ticker, market.proxyTicker]
            : [market.ticker],
        );
        const [payload, quotes] = await Promise.all([
          fetchJsonWithTimeout<PulseData>("/api/market/pulse", 10000, controller.signal),
          fetchMarketQuotes(quoteTickers, {
            reason: "initial",
            signal: controller.signal,
          }),
        ]);
        if (controller.signal.aborted) return;
        const quoteByTicker = new Map(quotes.map((quote) => [quote.ticker.toUpperCase(), quote]));
        setMarkets(HOME_MARKETS.flatMap((asset) => {
          const quote = quoteByTicker.get(asset.ticker.toUpperCase());
          if (!quote) return [];
          const proxyTicker =
            "proxyTicker" in asset && asset.proxyTicker
              ? asset.proxyTicker.toUpperCase()
              : null;
          const proxy = proxyTicker ? quoteByTicker.get(proxyTicker) : null;
          const live = resolveHomeIndexLiveQuote(quote, proxy);
          const historySource =
            live.label && proxy && proxy.sparkline.length >= 2 ? proxy : quote;
          return [{
            ticker: asset.ticker,
            symbol: asset.symbol,
            name: asset.name,
            price: live.price,
            changePercent: live.changePercent,
            session: homeIndexSessionLabel(live),
            history: historySource.sparkline,
          }];
        }));
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
          <div className="home-index-grid home-index-grid--cross-asset" aria-label="S&P 500, oil, and gold performance">
            {markets.map((market, index) => <MarketTile key={market.ticker} market={market} order={index} />)}
          </div>

          <div className="home-command-context">
            {gauges.map((gauge) => (
              <article className={`home-context-card is-${gauge.tone} is-${gauge.id}`} key={gauge.id}>
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
