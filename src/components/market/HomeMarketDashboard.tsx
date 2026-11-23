"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { PulseData } from "@/app/api/market/pulse/route";
import { fetchJsonWithTimeout } from "@/app/components/evidence-request";
import { fetchMarketQuotes } from "@/lib/market/client-market-data";
import { getLivePrice } from "@/lib/market/live-quote";
import { pulseMacroGauges } from "@/lib/market/pulse-gauges";
import type { StockHistoryPoint } from "@/lib/market/quotes";
import { homeChart, briefingLead, signalTakeaway, oilSignalContext, shouldShowOilSignal } from "@/lib/market/home-editorial";
import styles from "./HomeEditorial.module.css";

const HOME_MARKETS = [
  { ticker: "SPY", symbol: "SPY", name: "S&P 500", note: "Tradable S&P 500 proxy" },
  { ticker: "QQQ", symbol: "QQQ", name: "Growth stocks", note: "QQQ tracks large Nasdaq-listed nonfinancial companies, with substantial technology exposure." },
  { ticker: "GLD", symbol: "GLD", name: "Gold", note: "GLD offers exposure to gold prices. Its move alone does not explain investor motives." },
  { ticker: "USO", symbol: "USO", name: "Oil", note: "Oil ETF proxy · not the spot price of crude." },
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
  const [selected, setSelected] = useState<number | null>(null);
  const chart = homeChart(history);
  if (!chart) return <p className={styles.chartEmpty}>Chart unavailable</p>;
  const index = Math.min(selected ?? chart.points.length - 1, chart.points.length - 1);
  const point = chart.points[index];
  const markerX = (Date.parse(point.date) - Date.parse(chart.first)) / (Date.parse(chart.last) - Date.parse(chart.first)) * 100;
  return <figure className={compact ? styles.smallChart : styles.chart}>
    {!compact ? <div className={styles.chartLabels}><span>Intraday</span><span>Price range {formatPrice(chart.low)}–{formatPrice(chart.high)}</span></div> : null}
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={`${label}, ${chartTime(chart.first)} to ${chartTime(chart.last)} ET. Range ${formatPrice(chart.low)} to ${formatPrice(chart.high)}.`}>
      {[10, 50, 90].map(y => <path key={y} d={`M0 ${y} L100 ${y}`} className={styles.gridline} />)}
      <path d={`${chart.path} L100 100 L0 100 Z`} className={styles.chartFill} />
      <path d={chart.path} className={styles.chartLine} />
      {!compact && selected !== null ? <path d={`M${markerX} 0 L${markerX} 100`} className={styles.chartMarker} /> : null}
    </svg>
    {!compact ? <div className={styles.chartExplorer}>
      <label>Explore the chart
        <input type="range" min={0} max={chart.points.length - 1} value={index} onChange={event => setSelected(Number(event.target.value))} aria-valuetext={`${chartTime(point.date)} ET, $${formatPrice(point.close)}`} />
      </label>
      <output>{chartTime(point.date)} ET · ${formatPrice(point.close)}</output>
      <p>Slide to see a price. Use arrow keys when the slider is selected.</p>
    </div> : null}
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
        const [payloadResult, quotesResult] = await Promise.allSettled([
          fetchJsonWithTimeout<PulseData>("/api/market/pulse", 10000, controller.signal),
          fetchMarketQuotes(HOME_MARKETS.map((market) => market.ticker), {
            reason: "initial",
            signal: controller.signal,
          }),
        ]);
        if (controller.signal.aborted) return;
        const payload = payloadResult.status === "fulfilled" ? payloadResult.value : null;
        const quotes = quotesResult.status === "fulfilled" ? quotesResult.value : [];
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
        if (payload) setData(payload);
        if (payload || quotes.length > 0) setStatus("ready");
        else setStatus("error");
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
  const oil = markets.find(m => m.ticker === "USO");
  const growth = markets.find(m => m.ticker === "QQQ");
  const showOil = shouldShowOilSignal(oil?.changePercent, lead?.changePercent);
  const gauges = pulseMacroGauges(data?.indicators ?? []);
  const yieldGauge = gauges.find(g => g.id === "yield");
  const yieldIndicator = data?.indicators.find(g => g.ticker === "^TNX");
  const fetched = data?.fetchedAt ? Date.parse(data.fetchedAt) : NaN;
  const stale = Number.isFinite(fetched) && now - fetched > 15 * 60_000;

  return <section className={styles.overview} aria-labelledby="home-market-command-heading">
    <header className={styles.storyHeader}>
      <p className={styles.eyebrow}>The daily scene · markets in 60 seconds</p>
      <h2 id="home-market-command-heading">{status === "loading" ? "The day’s market story is taking shape." : briefingLead(lead?.changePercent, lead?.session)}</h2>
      <p className={styles.dek}>The money story behind the mood—clear enough to follow before the next meeting.</p>
      {data ? <div className={styles.briefingStrip} aria-label="Your quick briefing">
        <span><small>Broad market</small><strong>{signalTakeaway(lead?.changePercent)}</strong></span>
        <span><small>Growth stocks</small><strong>{signalTakeaway(growth?.changePercent)}</strong></span>
        <span><small>10-year yield</small><strong>{yieldGauge?.value ?? "Unavailable"}</strong></span>
      </div> : null}
      <div className={styles.status}>
        <span>{data?.sessionLabel ?? "Market snapshot"}</span>
        <span>Quotes may be delayed</span>
        {Number.isFinite(fetched) ? <time dateTime={data!.fetchedAt}>Snapshot fetched {chartTime(data!.fetchedAt)} ET</time> : null}
      </div>
    </header>
    {status === "loading" ? <p className={styles.empty} role="status">Loading the market picture…</p> : null}
    {status === "error" || stale ? <p className={styles.notice} role="status">{data ? "This snapshot may be out of date. A fresh update is not available yet." : "Market data is temporarily unavailable. You can still read the headlines below."}</p> : null}
    {data ? <>
      <section className={styles.marketGlance} aria-labelledby="home-glance-heading">
      <header className={styles.glanceHeading}><div><p className={styles.eyebrow}>What’s shaping the day</p><h2 id="home-glance-heading">The story behind the numbers</h2></div><p>A quick read on the forces setting the market’s tone.</p></header>
      <div className={styles.marketLayout}>
        <article className={styles.lead}>
          <div className={styles.panelHeading}><div><p className={styles.eyebrow}>The big picture</p><h3>S&P 500 <span className={styles.symbol}>SPY</span></h3></div><Link href="/pulse" className={styles.textLink}>Explore Pulse →</Link></div>
          <div className={styles.quote}><strong>{signalTakeaway(lead?.changePercent)}</strong></div>
          <p className={styles.signalDetail}>S&P 500 proxy · <span className={tone(lead?.changePercent)}>{formatChange(lead?.changePercent)}</span> · {lead?.session ?? "Unavailable"}</p>
          <p className={styles.price}>SPY share price <b>${formatPrice(lead?.price)}</b> · USD</p>
          <Chart history={lead?.history ?? []} label="SPY share price" />
          <p className={styles.caption}>Tradable S&P 500 proxy. Chart shows available intraday prices; the change above uses the labeled quote session.</p>
        </article>
        <aside className={styles.signals} aria-label="What is shaping the market story">
          {markets.filter(m => m.ticker !== "SPY" && m.ticker !== "USO").map(m => <article key={m.ticker} className={styles.signal}>
            <div className={styles.signalTop}><h3>{m.name}</h3><span className={styles.symbol}>{m.symbol}</span></div>
            <div className={styles.signalValue}><strong>{signalTakeaway(m.changePercent)}</strong></div>
            <p className={styles.signalDetail}><span className={tone(m.changePercent)}>{formatChange(m.changePercent)}</span> · {m.session}</p>
            <Chart history={m.history} label={m.name} compact />
            <p>{m.note}</p>
          </article>)}
          <article className={styles.signal}>
            <div className={styles.signalTop}><h3>Borrowing costs</h3><span className={styles.symbol}>10Y</span></div>
            <div className={styles.signalValue}><strong>The interest-rate backdrop</strong></div>
            <p className={styles.signalDetail}>10-year Treasury yield: <span>{yieldGauge?.value ?? "—"}</span></p>
            <Chart history={yieldIndicator?.history ?? []} label="10-year Treasury yield" compact />
            <p>A benchmark for interest rates across the economy.</p>
          </article>
        </aside>
      </div>
      </section>
      {showOil && oil?.changePercent != null ? <aside className={styles.oilContext} aria-label="Material oil move"><div><span>Oil · USO</span><strong className={tone(oil.changePercent)}>{formatChange(oil.changePercent)}</strong><small>{oil.session}</small></div><p>{oilSignalContext(oil.changePercent, lead?.changePercent)} USO is an ETF proxy, not spot crude.</p><Link href="/pulse" className={styles.oilLink}>Oil in Pulse →</Link></aside> : null}
      <section className={styles.learnPanel} aria-labelledby="learn-market-heading">
        <div><p className={styles.eyebrow}>The quick explainer</p><h2 id="learn-market-heading">What is SPY, exactly?</h2><p>The plain-English version, without the finance lecture.</p></div>
        <details><summary>Show me the answer</summary><p><strong>SPY is a fund designed to track the S&amp;P 500.</strong> It gives us a convenient snapshot of large U.S. companies without pretending every stock moved the same way.</p><p>It is a useful starting point, not the whole market.</p><Link href="/pulse" className={styles.textLink}>Explore the full market in Pulse →</Link></details>
      </section>
      <details className={styles.details}><summary>Sources, timing & how to read this</summary><p>Market quotes and charts: Yahoo Finance. SPY, QQQ, GLD and the conditional USO oil signal are funds, not index levels or spot prices. The 10-year figure is a Treasury yield. Each chart uses its own price scale, so line steepness is not comparable.</p><p>Regular-session changes use the previous close; pre-market and after-hours changes use the regular-session close. Snapshot fetch time is not the time of a trade. Quotes may be delayed, and charts may end before the displayed quote. Refresh checks run about once a minute while this page is visible.</p><Link href="/pulse" className={styles.textLink}>Open the complete market workspace →</Link></details>
    </> : null}
  </section>;
}
