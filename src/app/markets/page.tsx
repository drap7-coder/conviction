"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface PulseIndicator {
  ticker: string;
  name: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
}

interface PulseSector {
  ticker: string;
  name: string;
  changePercent: number | null;
}

interface PulseWatchlistItem {
  ticker: string;
  companyName: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
}

interface PulseData {
  indicators: PulseIndicator[];
  sectors: PulseSector[];
  watchlist: PulseWatchlistItem[];
  fetchedAt: string;
}

// ── Helpers ──

function formatChange(value: number | null): string {
  if (value === null) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function formatPrice(value: number | null): string {
  if (value === null) return "—";
  if (value >= 1000) return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (value >= 10) return value.toFixed(2);
  return value.toFixed(3);
}

function arrow(value: number | null): string {
  if (value === null || value === 0) return "—";
  return value > 0 ? "▲" : "▼";
}

function arrowClass(value: number | null): string {
  if (value === null || value === 0) return "";
  return value > 0 ? "up" : "down";
}

interface BriefItem {
  icon: string;
  text: string;
  positive: boolean;
  detail?: string;
}

function buildBrief(indicatorMap: Map<string, PulseIndicator>): string {
  const spy = indicatorMap.get("SPY");
  const vix = indicatorMap.get("^VIX");
  const tnx = indicatorMap.get("^TNX");

  if (!spy || !vix) return "Markets are loading.";

  const spyUp = (spy.changePercent ?? 0) > 0.3;
  const spyDown = (spy.changePercent ?? 0) < -0.3;
  const vixDown = (vix.changePercent ?? 0) < -3;
  const vixUp = (vix.changePercent ?? 0) > 3;
  const yieldsDown = (tnx?.changePercent ?? 0) < -0.5;
  const yieldsUp = (tnx?.changePercent ?? 0) > 0.5;

  if (spyUp && vixDown) return "Markets are risk-on as volatility declines and equities advance.";
  if (spyUp && yieldsDown) return "Markets are rallying as yields fall, supporting growth stocks.";
  if (spyDown && vixUp) return "Markets are risk-off with rising volatility and broad selling.";
  if (spyDown && yieldsUp) return "Markets are under pressure as yields rise, weighing on equities.";
  if (spyUp) return "Markets are positive with broad-based gains across sectors.";
  if (spyDown) return "Markets are in the red with broad-based selling pressure.";
  return "Markets are mixed with no clear directional bias.";
}

function buildWhatChanged(indicatorMap: Map<string, PulseIndicator>, sectors: PulseSector[]): BriefItem[] {
  const items: BriefItem[] = [];

  // Check oil
  const oil = indicatorMap.get("USO");
  if (oil && (oil.changePercent ?? 0) > 2) {
    items.push({ icon: "▲", text: "Oil broke higher", positive: false, detail: `Crude oil +${oil.changePercent?.toFixed(1)}%` });
  }
  if (oil && (oil.changePercent ?? 0) < -2) {
    items.push({ icon: "▼", text: "Oil fell sharply", positive: false, detail: `Crude oil ${oil.changePercent?.toFixed(1)}%` });
  }

  // Check VIX
  const vix = indicatorMap.get("^VIX");
  if (vix && (vix.changePercent ?? 0) > 5) {
    items.push({ icon: "▲", text: "Volatility spiked", positive: false, detail: `VIX +${vix.changePercent?.toFixed(1)}%` });
  }
  if (vix && (vix.changePercent ?? 0) < -5) {
    items.push({ icon: "▼", text: "Volatility collapsed", positive: true, detail: `VIX ${vix.changePercent?.toFixed(1)}%` });
  }

  // Check yields
  const tnx = indicatorMap.get("^TNX");
  if (tnx && (tnx.changePercent ?? 0) > 1) {
    items.push({ icon: "▲", text: "Treasury yields rose sharply", positive: false, detail: "10Y yield up" });
  }
  if (tnx && (tnx.changePercent ?? 0) < -1) {
    items.push({ icon: "▼", text: "Treasury yields fell sharply", positive: true, detail: "10Y yield down" });
  }

  // Check leading/lagging sectors
  if (sectors.length > 0) {
    const top = sectors[0];
    const bottom = sectors[sectors.length - 1];
    if (top && (top.changePercent ?? 0) > 1) {
      items.push({ icon: "▲", text: `${top.name} became the leading sector`, positive: true, detail: `${top.ticker} ${formatChange(top.changePercent)}` });
    }
    if (bottom && (bottom.changePercent ?? 0) < -1 && bottom !== top) {
      items.push({ icon: "▼", text: `${bottom.name} is the lagging sector`, positive: false, detail: `${bottom.ticker} ${formatChange(bottom.changePercent)}` });
    }
  }

  return items.slice(0, 3);
}

function buildBriefTime(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning.";
  if (h < 17) return "Good afternoon.";
  return "Good evening.";
}

// ── Page ──

export default function MarketPulsePage() {
  const [data, setData] = useState<PulseData | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setStatus("loading");
      try {
        const res = await fetch("/api/market/pulse");
        if (!res.ok) throw new Error("Failed");
        const json = (await res.json()) as PulseData;
        if (!cancelled) {
          setData(json);
          setStatus("success");
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  if (status === "loading" || status === "idle") {
    return (
      <div className="pulse-page">
        <div className="empty-state compact">
          <p>Loading market pulse...</p>
        </div>
      </div>
    );
  }

  if (status === "error" || !data) {
    return (
      <div className="pulse-page">
        <div className="empty-state">
          <p>Market data is temporarily unavailable.</p>
          <small>Data provider may be rate-limited. Retry in a moment.</small>
        </div>
      </div>
    );
  }

  const indicatorMap = new Map(data.indicators.map((i) => [i.ticker, i]));
  const briefSentence = buildBrief(indicatorMap);
  const whatChanged = buildWhatChanged(indicatorMap, data.sectors);
  const greeting = buildBriefTime();

  // Watchlist: show only non-zero-change items, then a "no change" group
  const changedWatchlist = data.watchlist.filter((w) => w.change !== null && Math.abs(w.change ?? 0) > 0.01);
  const unchangedWatchlist = data.watchlist.filter((w) => w.change === null || Math.abs(w.change ?? 0) <= 0.01);

  return (
    <div className="pulse-page">

      {/* ── Today's Brief ── */}
      <section className="pulse-brief" aria-label="Today's market brief">
        <p className="pulse-brief-greeting">{greeting}</p>
        <p className="pulse-brief-sentence">{briefSentence}</p>
        {whatChanged.length > 0 && (
          <ul className="pulse-brief-changes">
            {whatChanged.map((item) => (
              <li key={item.text} className={`pulse-brief-change ${item.positive ? "positive" : "negative"}`}>
                <span className="pulse-brief-arrow">{item.icon}</span>
                <span className="pulse-brief-text">{item.text}</span>
                {item.detail && <span className="pulse-brief-detail">{item.detail}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── 1. Market ── */}
      <section className="pulse-card" aria-label="Market indicators">
        <div className="pulse-card-header">
          <h2 className="pulse-card-title">Market</h2>
        </div>
        <div className="pulse-market-grid">
          {data.indicators.map((ind) => (
            <div key={ind.ticker} className="pulse-market-item">
              <span className="pulse-market-name">{ind.name}</span>
              <span className="pulse-market-price">{ind.price != null ? formatPrice(ind.price) : "—"}</span>
              <span className={`pulse-market-change ${arrowClass(ind.changePercent)}`}>
                {arrow(ind.changePercent)} {formatChange(ind.changePercent)}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── 2. What's Different Today ── */}
      <section className="pulse-card" aria-label="What changed today">
        <div className="pulse-card-header">
          <h2 className="pulse-card-title">What&rsquo;s Different Today</h2>
        </div>
        {whatChanged.length > 0 ? (
          <div className="pulse-diff-list">
            {whatChanged.map((item) => (
              <details key={item.text} className="pulse-diff-item">
                <summary className={`pulse-diff-summary ${item.positive ? "positive" : "negative"}`}>
                  <span className="pulse-diff-arrow">{item.icon}</span>
                  <span className="pulse-diff-text">{item.text}</span>
                </summary>
                <div className="pulse-diff-body">
                  <p className="pulse-diff-why">Why? {item.detail}</p>
                  <p className="pulse-diff-evidence">Evidence · {item.detail}</p>
                  <p className="pulse-diff-affected">Affected watchlist · {data.watchlist.length} holdings</p>
                </div>
              </details>
            ))}
          </div>
        ) : (
          <p className="pulse-empty-text">No material changes detected today.</p>
        )}
      </section>

      {/* ── 3. Sector Leaders ── */}
      <section className="pulse-card" aria-label="Sector leaders">
        <div className="pulse-card-header">
          <h2 className="pulse-card-title">Sector Leaders</h2>
        </div>
        <div className="pulse-sector-list">
          {data.sectors.map((sector) => {
            const pct = sector.changePercent;
            const bars = pct === null ? 0 : Math.round(Math.abs(pct) / 0.5);
            const direction = pct === null ? "—" : pct > 0 ? "▲" : pct < 0 ? "▼" : "—";
            const absPct = Math.abs(pct ?? 0);
            const strength = pct === null ? "neutral" : absPct > 1 ? "strong" : absPct > 0.3 ? "moderate" : "flat";
            const dirClass = pct === null || pct === 0 ? "" : pct > 0 ? "up" : "down";
            return (
              <Link key={sector.ticker} href={`/industries/${sector.ticker}`} className="pulse-sector-row">
                <span className={`pulse-sector-arrow ${strength} ${dirClass}`}>{direction}</span>
                <span className="pulse-sector-name">{sector.name}</span>
                <span className={`pulse-sector-pct ${strength} ${dirClass}`}>{formatChange(pct)}</span>
                <span className="pulse-sector-bar" aria-hidden="true">
                  <span className={`pulse-sector-bar-fill ${strength} ${dirClass}`} style={{ width: `${Math.min(bars * 8, 100)}%` }} />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── 4. Your Watchlist ── */}
      <section className="pulse-card" aria-label="Your watchlist changes">
        <div className="pulse-card-header">
          <h2 className="pulse-card-title">Your Watchlist</h2>
        </div>
        <div className="pulse-watchlist-list">
          {changedWatchlist.length > 0 ? (
            changedWatchlist.map((item) => {
              const dir = item.change === null || item.change === 0 ? "neutral" : item.change > 0 ? "positive" : "negative";
              const strength = item.changePercent !== null
                ? Math.abs(item.changePercent) > 2 ? "strong" : Math.abs(item.changePercent) > 0.5 ? "moderate" : "minor"
                : "neutral";
              return (
                <Link key={item.ticker} href={`/companies/${item.ticker}`} className="pulse-watchlist-row">
                  <div className="pulse-watchlist-top">
                    <span className="pulse-watchlist-ticker">{item.ticker}</span>
                    <span className={`pulse-watchlist-badge ${dir} ${strength}`}>
                      {dir === "positive" ? "▲ Strengthening" : dir === "negative" ? "▼ Weakening" : "— Stable"}
                    </span>
                  </div>
                  <span className="pulse-watchlist-detail">
                    {item.price != null ? `$${formatPrice(item.price)}` : "—"}
                    {" · "}
                    <span className={dir}>{formatChange(item.changePercent)}</span>
                  </span>
                </Link>
              );
            })
          ) : (
            <p className="pulse-empty-text">No holdings with significant movement.</p>
          )}
          {unchangedWatchlist.length > 0 && (
            <p className="pulse-watchlist-unchanged">
              {unchangedWatchlist.map((w) => w.ticker).join(", ")} · No material change
            </p>
          )}
        </div>
      </section>

      {/* ── 5. Needs Attention ── */}
      <section className="pulse-card pulse-card-attention" aria-label="Needs attention">
        <div className="pulse-card-header">
          <h2 className="pulse-card-title">Needs Attention</h2>
        </div>
        <div className="pulse-attention-list">
          {data.watchlist.length > 0 ? (
            data.watchlist.slice(0, 3).map((item) => {
              // Derive attention items from the most changed holdings
              const absChange = Math.abs(item.changePercent ?? 0);
              if (absChange > 2) {
                return (
                  <Link key={item.ticker} href={`/companies/${item.ticker}`} className="pulse-attention-item">
                    <span className="pulse-attention-ticker">Review {item.ticker}</span>
                    <span className="pulse-attention-reason">{item.changePercent! > 0 ? "Significant gain" : "Significant drop"} · {formatChange(item.changePercent)}</span>
                  </Link>
                );
              }
              if (absChange > 1) {
                return (
                  <Link key={item.ticker} href={`/companies/${item.ticker}`} className="pulse-attention-item">
                    <span className="pulse-attention-ticker">Review {item.ticker}</span>
                    <span className="pulse-attention-reason">Notable move · {formatChange(item.changePercent)}</span>
                  </Link>
                );
              }
              return (
                <div key={item.ticker} className="pulse-attention-item pulse-attention-item-done">
                  <span className="pulse-attention-ticker">No action required for {item.ticker}</span>
                </div>
              );
            })
          ) : (
            <p className="pulse-empty-text">No items need attention.</p>
          )}
        </div>
      </section>

    </div>
  );
}