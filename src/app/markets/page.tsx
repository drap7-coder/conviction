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

function fmtPct(value: number | null): string {
  if (value === null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function fmtPrice(value: number | null): string {
  if (value === null) return "—";
  if (value >= 1000) return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (value >= 10) return value.toFixed(2);
  return value.toFixed(3);
}

function arrow(value: number | null): string {
  if (value === null || value === 0) return "—";
  return value > 0 ? "▲" : "▼";
}

function cls(value: number | null): string {
  if (value === null || value === 0) return "";
  return value > 0 ? "up" : "down";
}

function brief(indicatorMap: Map<string, PulseIndicator>): string {
  const spy = indicatorMap.get("SPY");
  const vix = indicatorMap.get("^VIX");
  const tnx = indicatorMap.get("^TNX");
  if (!spy || !vix) return "Loading markets...";
  const sUp = (spy.changePercent ?? 0) > 0.3;
  const sDn = (spy.changePercent ?? 0) < -0.3;
  const vDn = (vix.changePercent ?? 0) < -3;
  const vUp = (vix.changePercent ?? 0) > 3;
  const yDn = (tnx?.changePercent ?? 0) < -0.5;
  const yUp = (tnx?.changePercent ?? 0) > 0.5;
  if (sUp && vDn) return "Risk on. Volatility declining, equities advancing.";
  if (sUp && yDn) return "Rallying. Yields falling, growth stocks bid.";
  if (sDn && vUp) return "Risk off. Volatility spiking, broad selling.";
  if (sDn && yUp) return "Under pressure. Yields rising, equities weighed.";
  if (sUp) return "Positive. Broad-based gains across sectors.";
  if (sDn) return "Red. Broad-based selling pressure.";
  return "Mixed. No clear directional bias.";
}

function changes(indicatorMap: Map<string, PulseIndicator>, sectors: PulseSector[]): { icon: string; text: string; detail: string }[] {
  const items: { icon: string; text: string; detail: string }[] = [];
  const oil = indicatorMap.get("USO");
  const vix = indicatorMap.get("^VIX");
  const tnx = indicatorMap.get("^TNX");
  if (oil && (oil.changePercent ?? 0) > 2) items.push({ icon: "▲", text: "Oil broke higher", detail: `Crude ${fmtPct(oil.changePercent)}` });
  if (oil && (oil.changePercent ?? 0) < -2) items.push({ icon: "▼", text: "Oil fell sharply", detail: `Crude ${fmtPct(oil.changePercent)}` });
  if (vix && (vix.changePercent ?? 0) > 5) items.push({ icon: "▲", text: "Volatility spiked", detail: `VIX ${fmtPct(vix.changePercent)}` });
  if (vix && (vix.changePercent ?? 0) < -5) items.push({ icon: "▼", text: "Volatility collapsed", detail: `VIX ${fmtPct(vix.changePercent)}` });
  if (tnx && (tnx.changePercent ?? 0) > 1) items.push({ icon: "▲", text: "Yields rose sharply", detail: "10Y up" });
  if (tnx && (tnx.changePercent ?? 0) < -1) items.push({ icon: "▼", text: "Yields fell sharply", detail: "10Y down" });
  if (sectors.length > 0) {
    const top = sectors[0];
    const bot = sectors[sectors.length - 1];
    if (top && (top.changePercent ?? 0) > 1) items.push({ icon: "▲", text: `${top.name} leads`, detail: fmtPct(top.changePercent) });
    if (bot && (bot.changePercent ?? 0) < -1 && bot !== top) items.push({ icon: "▼", text: `${bot.name} lags`, detail: fmtPct(bot.changePercent) });
  }
  return items.slice(0, 3);
}

function greeting(): string {
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
        if (!cancelled) { setData(json); setStatus("success"); }
      } catch {
        if (!cancelled) setStatus("error");
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  if (status === "loading" || status === "idle") {
    return <div className="pulse"><div className="empty-state compact"><p>Loading market pulse...</p></div></div>;
  }
  if (status === "error" || !data) {
    return <div className="pulse"><div className="empty-state"><p>Market data is temporarily unavailable.</p></div></div>;
  }

  const indicatorMap = new Map(data.indicators.map((i) => [i.ticker, i]));
  const briefSentence = brief(indicatorMap);
  const changesList = changes(indicatorMap, data.sectors);
  const changedWatchlist = data.watchlist.filter((w) => w.change !== null && Math.abs(w.change ?? 0) > 0.01);
  const unchangedWatchlist = data.watchlist.filter((w) => w.change === null || Math.abs(w.change ?? 0) <= 0.01);

  return (
    <div className="pulse">

      {/* ── Brief ── */}
      <section className="pulse-brief" aria-label="Today's market brief">
        <p className="pulse-brief-greeting">{greeting()}</p>
        <p className="pulse-brief-sentence">{briefSentence}</p>
        {changesList.length > 0 && (
          <div className="pulse-brief-items">
            {changesList.map((item) => (
              <div key={item.text} className={`pulse-brief-item ${item.icon === "▲" ? "up" : "down"}`}>
                <span className="pulse-brief-item-icon">{item.icon}</span>
                <span className="pulse-brief-item-text">{item.text}</span>
                <span className="pulse-brief-item-detail">{item.detail}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── 1. Market ── */}
      <section className="pulse-card" aria-label="Market indicators">
        <div className="pulse-card-header">
          <h2 className="pulse-card-title">Market</h2>
        </div>
        <div className="pulse-strip">
          {data.indicators.map((ind) => (
            <div key={ind.ticker} className="pulse-strip-item">
              <span className="pulse-strip-label">{ind.name}</span>
              <span className="pulse-strip-value">{ind.price != null ? fmtPrice(ind.price) : "—"}</span>
              <span className={`pulse-strip-change ${cls(ind.changePercent)}`}>
                {arrow(ind.changePercent)} {fmtPct(ind.changePercent)}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── 2. What's Different ── */}
      <section className="pulse-card" aria-label="What changed today">
        <div className="pulse-card-header">
          <h2 className="pulse-card-title">What&rsquo;s Different</h2>
        </div>
        {changesList.length > 0 ? (
          <div className="pulse-diff-list">
            {changesList.map((item) => (
              <details key={item.text} className="pulse-diff-item">
                <summary className={`pulse-diff-summary ${item.icon === "▲" ? "up" : "down"}`}>
                  <span className="pulse-diff-arrow">{item.icon}</span>
                  <span>{item.text}</span>
                  <span className="pulse-diff-hint">{item.detail}</span>
                </summary>
                <div className="pulse-diff-body">
                  <p className="pulse-diff-why">{item.detail} · {data.watchlist.length} holdings monitored</p>
                </div>
              </details>
            ))}
          </div>
        ) : (
          <p className="pulse-muted">No material changes today.</p>
        )}
      </section>

      {/* ── 3. Sector Leaders ── */}
      <section className="pulse-card" aria-label="Sector leaders">
        <div className="pulse-card-header">
          <h2 className="pulse-card-title">Sectors</h2>
        </div>
        <div className="pulse-sectors">
          {data.sectors.map((sector) => {
            const pct = sector.changePercent;
            const absPct = Math.abs(pct ?? 0);
            const strength = pct === null ? "flat" : absPct > 1 ? "strong" : absPct > 0.3 ? "moderate" : "flat";
            const dir = pct === null ? "" : pct > 0 ? "up" : "down";
            return (
              <Link key={sector.ticker} href={`/industries/${sector.ticker}`} className="pulse-sector-row">
                <span className={`pulse-sector-arrow ${strength} ${dir}`}>{arrow(pct)}</span>
                <span className="pulse-sector-name">{sector.name}</span>
                <span className={`pulse-sector-pct ${strength} ${dir}`}>{fmtPct(pct)}</span>
                <span className="pulse-sector-track">
                  <span className={`pulse-sector-fill ${strength} ${dir}`} style={{ width: `${Math.min(absPct * 10, 100)}%` }} />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── 4. Your Watchlist ── */}
      <section className="pulse-card" aria-label="Your watchlist">
        <div className="pulse-card-header">
          <h2 className="pulse-card-title">Watchlist</h2>
        </div>
        {changedWatchlist.length > 0 ? (
          <div className="pulse-wl">
            {changedWatchlist.map((item) => {
              const dir = item.change === null || item.change === 0 ? "neutral" : item.change > 0 ? "positive" : "negative";
              const badge = dir === "positive" ? "Strengthening" : dir === "negative" ? "Weakening" : "Stable";
              return (
                <Link key={item.ticker} href={`/companies/${item.ticker}`} className="pulse-wl-row">
                  <div className="pulse-wl-top">
                    <span className="pulse-wl-ticker">{item.ticker}</span>
                    <span className={`pulse-wl-badge ${dir}`}>{badge}</span>
                  </div>
                  <div className="pulse-wl-meta">
                    <span>{item.price != null ? `$${fmtPrice(item.price)}` : "—"}</span>
                    <span className={dir}> · {fmtPct(item.changePercent)}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <p className="pulse-muted">No significant movement.</p>
        )}
        {unchangedWatchlist.length > 0 && (
          <p className="pulse-wl-unchanged">{unchangedWatchlist.map((w) => w.ticker).join(", ")} · unchanged</p>
        )}
      </section>

      {/* ── 5. Needs Attention ── */}
      <section className="pulse-card pulse-attention" aria-label="Needs attention">
        <div className="pulse-card-header">
          <h2 className="pulse-card-title">Needs Attention</h2>
        </div>
        <div className="pulse-attn-list">
          {data.watchlist.length > 0 ? (
            data.watchlist.slice(0, 3).map((item) => {
              const absChange = Math.abs(item.changePercent ?? 0);
              if (absChange > 2) {
                return (
                  <Link key={item.ticker} href={`/companies/${item.ticker}`} className="pulse-attn-item">
                    <span className="pulse-attn-ticker">Review {item.ticker}</span>
                    <span className="pulse-attn-reason">{item.changePercent! > 0 ? "Significant gain" : "Significant drop"} · {fmtPct(item.changePercent)}</span>
                  </Link>
                );
              }
              if (absChange > 1) {
                return (
                  <Link key={item.ticker} href={`/companies/${item.ticker}`} className="pulse-attn-item">
                    <span className="pulse-attn-ticker">Review {item.ticker}</span>
                    <span className="pulse-attn-reason">Notable move · {fmtPct(item.changePercent)}</span>
                  </Link>
                );
              }
              return (
                <div key={item.ticker} className="pulse-attn-item done">
                  <span className="pulse-attn-ticker muted">No action — {item.ticker}</span>
                </div>
              );
            })
          ) : (
            <p className="pulse-muted">All clear.</p>
          )}
        </div>
      </section>
    </div>
  );
}