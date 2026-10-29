"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { PulseData } from "@/app/api/market/pulse/route";
import { fetchJsonWithTimeout } from "@/app/components/evidence-request";
import { fetchMarketQuotes } from "@/lib/market/client-market-data";
import { getLivePrice } from "@/lib/market/live-quote";
import { pulseMacroGauges } from "@/lib/market/pulse-gauges";
import type { StockHistoryPoint } from "@/lib/market/quotes";
import { homeChart, marketTakeaway } from "@/lib/market/home-editorial";
import styles from "./HomeEditorial.module.css";

const HOME_MARKETS = [
  { ticker: "SPY", symbol: "SPY", name: "S&P 500", note: "Tradable S&P 500 proxy" },
  { ticker: "QQQ", symbol: "QQQ", name: "Growth stocks", note: "Nasdaq-100 ETF · a view of large growth companies." },
  { ticker: "GLD", symbol: "GLD", name: "Gold", note: "Gold ETF · another perspective beyond stocks." },
] as const;

interface DashboardMarket {
  ticker: string;
  symbol: string;
  name: string;
  note: string;
  price: number | null;
  changePercent: number | null;
  session: string;
  history: StockHistoryPoint[];
}

function formatPrice(value: number | null | undefined) {
  return value != null && Number.isFinite(value)
    ? value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—";
}
function formatChange(value: number | null | undefined) {
  return value != null && Number.isFinite(value)
    ? `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(2)}%` : "—";
}
function tone(value: number | null | undefined) {
  return value != null && value > 0 ? styles.up : value != null && value < 0 ? styles.down : "";
}
function chartTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
}
function Chart({ history, label, compact = false }: { history: StockHistoryPoint[]; label: string; compact?: boolean }) {
  const chart = homeChart(history);
  if (!chart) return <p className={styles.chartEmpty}>Chart unavailable</p>;
  return <figure className={compact ? styles.smallChart : styles.chart}>
    {!compact ? <div className={styles.chartLabels}><span>Intraday</span><span>Price range {formatPrice(chart.low)}–{formatPrice(chart.high)}</span></div> : null}
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={`${label}, ${chartTime(chart.first)} to ${chartTime(chart.last)} ET. Range ${formatPrice(chart.low)} to ${formatPrice(chart.high)}.`}>
      {[10, 50, 90].map(y => <path key={y} d={`M0 ${y} L100 ${y}`} className={styles.gridline} />)}
      <path d={`${chart.path} L100 100 L0 100 Z`} className={styles.chartFill} />
      <path d={chart.path} className={styles.chartLine} />
    </svg>
    {compact ? <figcaption>Through {chartTime(chart.last)} ET</figcaption> : <figcaption><span>{chartTime(chart.first)}</span><span>{chartTime(chart.last)} ET</span></figcaption>}
  </figure>;
}

export function HomeMarketDashboard() {
  const [data, setData] = useState<PulseData | null>(null);
  const [markets, setMarkets] = useState<DashboardMarket[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    let lastAttempt = 0;
    let inFlight = false;
    async function load() {
      if (inFlight || (lastAttempt && Date.now() - lastAttempt < 60_000)) return;
      inFlight = true;
      lastAttempt = Date.now();
      try {
        const [payload, quotes] = await Promise.all([
          fetchJsonWithTimeout<PulseData>("/api/market/pulse", 10000, controller.signal),
          fetchMarketQuotes(HOME_MARKETS.map((market) => market.ticker), {
            reason: "initial",
            signal: controller.signal,
          }),
        ]);
        if (controller.signal.aborted) return;
        const quoteByTicker = new Map(quotes.map((quote) => [quote.ticker.toUpperCase(), quote]));
        setMarkets(HOME_MARKETS.flatMap((asset) => {
          const quote = quoteByTicker.get(asset.ticker);
          if (!quote) return [{ ...asset, price: null, changePercent: null, session: "Unavailable", history: [] }];
          const live = getLivePrice(quote);
          return [{
            ...asset,
            price: live.price,
            changePercent: live.changePercent,
            session: live.label ?? (live.session === "closed" ? "Closed" : "Regular"),
            history: quote.sparkline,
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

  const lead = markets.find(m => m.ticker === "SPY");
  const gauges = pulseMacroGauges(data?.indicators ?? []);
  const yieldGauge = gauges.find(g => g.id === "yield");
  const yieldIndicator = data?.indicators.find(g => g.ticker === "^TNX");
  const sectors = (data?.sectors ?? []).filter(s => s.changePercent != null && Number.isFinite(s.changePercent));
  const advancing = sectors.filter(s => s.changePercent! > 0).length;
  const declining = sectors.filter(s => s.changePercent! < 0).length;
  const fetched = data?.fetchedAt ? Date.parse(data.fetchedAt) : NaN;
  const stale = Number.isFinite(fetched) && now - fetched > 15 * 60_000;

  return <section className={styles.overview} aria-labelledby="home-market-command-heading">
    <header className={styles.storyHeader}>
      <span className={styles.motionWash} aria-hidden="true" />
      <p className={styles.eyebrow}>The market in perspective</p>
      <h2 id="home-market-command-heading">{status === "loading" ? "Your market day, made clearer." : marketTakeaway(lead?.changePercent)}</h2>
      <p className={styles.dek}>Start with the broad market. See the context. Follow what matters to you.</p>
      <div className={styles.status}>
        <span>{data?.sessionLabel ?? "Market snapshot"}</span>
        <span>Quotes may be delayed</span>
        {Number.isFinite(fetched) ? <time dateTime={data!.fetchedAt}>Snapshot fetched {chartTime(data!.fetchedAt)} ET</time> : null}
      </div>
    </header>
    {status === "loading" ? <p className={styles.empty} role="status">Loading the market picture…</p> : null}
    {status === "error" || stale ? <p className={styles.notice} role="status">{data ? "This snapshot may be out of date. A fresh update is not available yet." : "Market data is temporarily unavailable. You can still read the headlines below."}</p> : null}
    {data ? <>
      <div className={styles.marketLayout}>
        <article className={styles.lead}>
          <div className={styles.panelHeading}><div><p className={styles.eyebrow}>The broad market</p><h3>S&P 500 <span className={styles.symbol}>SPY</span></h3></div><Link href="/pulse" className={styles.textLink}>Explore Pulse →</Link></div>
          <div className={styles.quote}><strong className={tone(lead?.changePercent)}>{formatChange(lead?.changePercent)}</strong><span>{lead?.session ?? "Unavailable"} change</span></div>
          <p className={styles.price}>SPY share price <b>${formatPrice(lead?.price)}</b> · USD</p>
          <Chart history={lead?.history ?? []} label="SPY share price" />
          <p className={styles.caption}>Tradable S&P 500 proxy. Chart shows available intraday prices; the change above uses the labeled quote session.</p>
        </article>
        <aside className={styles.signals} aria-label="Three supporting signals">
          {markets.filter(m => m.ticker !== "SPY").map(m => <article key={m.ticker} className={styles.signal}>
            <div className={styles.signalTop}><h3>{m.name}</h3><span className={styles.symbol}>{m.symbol}</span></div>
            <div className={styles.signalValue}><strong className={tone(m.changePercent)}>{formatChange(m.changePercent)}</strong><span>{m.session}</span></div>
            <Chart history={m.history} label={m.name} compact />
            <p>{m.note}</p>
          </article>)}
          <article className={styles.signal}>
            <div className={styles.signalTop}><h3>Borrowing costs</h3><span className={styles.symbol}>10Y</span></div>
            <div className={styles.signalValue}><strong>{yieldGauge?.value ?? "—"}</strong><span>Treasury yield</span></div>
            <Chart history={yieldIndicator?.history ?? []} label="10-year Treasury yield" compact />
            <p>A benchmark for interest rates across the economy.</p>
          </article>
        </aside>
      </div>
      <div className={styles.explainer}>
        <article><p className={styles.eyebrow}>What changed</p><h3>{lead?.changePercent == null ? "The broad-market quote is unavailable." : `SPY ${formatChange(lead.changePercent)} in the ${lead.session.toLowerCase()} session.`}</h3><p>{sectors.length ? `${advancing} of ${sectors.length} available sectors are higher and ${declining} are lower. Sector readings can cover different quote sessions.` : "Sector coverage is unavailable; we cannot assess how widely the move is shared."}</p></article>
        <article><p className={styles.eyebrow}>Why it matters</p><h3>One index is only part of the story.</h3><p>SPY tracks large U.S. companies. Compare growth stocks, gold and rates to put its move in context. These signals describe prices; they do not establish what caused a move.</p></article>
      </div>
      <details className={styles.details}><summary>Sources, timing & how to read this</summary><p>Market quotes and charts: Yahoo Finance. SPY, QQQ and GLD are funds, not index levels or spot prices. The 10-year figure is a Treasury yield. Each chart uses its own price scale, so line steepness is not comparable.</p><p>Regular-session changes use the previous close; pre-market and after-hours changes use the regular-session close. Snapshot fetch time is not the time of a trade. Quotes may be delayed, and charts may end before the displayed quote. Refresh checks run about once a minute while this page is visible.</p><Link href="/pulse" className={styles.textLink}>Open the complete market workspace →</Link></details>
    </> : null}
  </section>;
}
