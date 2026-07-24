"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { DataStatus } from "@/app/api/market/pulse/route";

interface PulseIndicator {
  ticker: string;
  label: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  status: DataStatus;
  isPercentValue: boolean;
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

function fmtPrice(value: number | null, isPercent: boolean): string {
  if (value === null) return "—";
  if (isPercent) return `${value.toFixed(2)}%`;
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

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning.";
  if (h < 17) return "Good afternoon.";
  return "Good evening.";
}

// Derive meaningful changes from indicators and sectors (max 3)
function deriveChanges(
  indicators: PulseIndicator[],
  sectors: PulseSector[],
  watchlistCount: number,
): { icon: string; text: string; why: string; affected: string }[] {
  const items: { icon: string; text: string; why: string; affected: string }[] = [];
  const map = new Map(indicators.map((i) => [i.ticker, i]));

  const oil = map.get("USO");
  if (oil && oil.changePercent !== null && Math.abs(oil.changePercent) > 2) {
    items.push({
      icon: oil.changePercent > 0 ? "▲" : "▼",
      text: oil.changePercent > 0 ? "Oil broke higher" : "Oil fell sharply",
      why: oil.changePercent > 0
        ? `Crude oil futures are up ${fmtPct(oil.changePercent)}. Rising energy costs feed into input prices across transport and manufacturing.`
        : `Crude oil futures are down ${fmtPct(oil.changePercent)}. Lower energy costs relieve margin pressure on industrials and transport.`,
      affected: `${watchlistCount} total holdings monitored`,
    });
  }

  const vix = map.get("^VIX");
  if (vix && vix.changePercent !== null && Math.abs(vix.changePercent) > 5) {
    items.push({
      icon: vix.changePercent > 0 ? "▲" : "▼",
      text: vix.changePercent > 0 ? "Volatility spiked" : "Volatility collapsed",
      why: vix.changePercent > 0
        ? `The VIX jumped ${fmtPct(vix.changePercent)}. Elevated volatility typically correlates with broad risk-off positioning.`
        : `The VIX fell ${fmtPct(vix.changePercent)}. Declining volatility supports risk-on positioning across equity sectors.`,
      affected: `${watchlistCount} total holdings monitored`,
    });
  }

  const tnx = map.get("^TNX");
  if (tnx && tnx.changePercent !== null && Math.abs(tnx.changePercent) > 1) {
    items.push({
      icon: tnx.changePercent > 0 ? "▲" : "▼",
      text: tnx.changePercent > 0 ? "Yields rose sharply" : "Yields fell sharply",
      why: tnx.changePercent > 0
        ? `The 10-year Treasury yield is up ${fmtPct(tnx.changePercent)}. Rising yields pressure growth and duration-sensitive equities.`
        : `The 10-year Treasury yield is down ${fmtPct(tnx.changePercent)}. Falling yields support growth stocks and longer-duration assets.`,
      affected: `${watchlistCount} total holdings monitored`,
    });
  }

  if (sectors.length > 0) {
    const top = sectors[0];
    const bot = sectors[sectors.length - 1];
    if (top && top.changePercent !== null && top.changePercent > 1) {
      items.push({
        icon: "▲",
        text: `${top.name} leads`,
        why: `${top.name} is the top-performing sector today at ${fmtPct(top.changePercent)}. This signals sector rotation toward this part of the market.`,
        affected: `${watchlistCount} total holdings monitored`,
      });
    }
    if (bot && bot.changePercent !== null && bot.changePercent < -1 && bot.ticker !== top?.ticker) {
      items.push({
        icon: "▼",
        text: `${bot.name} lags`,
        why: `${bot.name} is the worst-performing sector today at ${fmtPct(bot.changePercent)}. Consider reviewing exposure to this sector.`,
        affected: `${watchlistCount} total holdings monitored`,
      });
    }
  }

  return items.slice(0, 3);
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

  const changesList = deriveChanges(data.indicators, data.sectors, data.watchlist.length);
  const sortedByChange = [...data.watchlist].sort((a, b) => Math.abs(b.changePercent ?? 0) - Math.abs(a.changePercent ?? 0));
  const alertItems = sortedByChange.filter((w) => Math.abs(w.changePercent ?? 0) > 1);
  const noActionItems = sortedByChange.filter((w) => Math.abs(w.changePercent ?? 0) <= 1);

  return (
    <div className="pulse">

      {/* ── 1. Greeting ── */}
      <section className="pulse-brief" aria-label="Today's market brief">
        <p className="pulse-brief-greeting">{greeting()}</p>
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
                  <span className="pulse-diff-hint">{item.why.split(".")[0]}.</span>
                </summary>
                <div className="pulse-diff-body">
                  <p className="pulse-diff-why">
                    {item.why} <span className="pulse-diff-affected">{item.affected}</span>
                  </p>
                </div>
              </details>
            ))}
          </div>
        ) : (
          <p className="pulse-muted">No material changes today.</p>
        )}
      </section>

      {/* ── 3. Needs Attention ── */}
      <section className="pulse-card pulse-attention" aria-label="Needs attention">
        <div className="pulse-card-header">
          <h2 className="pulse-card-title">Needs Attention</h2>
        </div>

        {/* Alerts (orange-accented) */}
        {alertItems.length > 0 ? (
          <div className="pulse-attn-list">
            {alertItems.map((item) => {
              const isGain = (item.changePercent ?? 0) > 0;
              return (
                <Link key={item.ticker} href={`/companies/${item.ticker}`} className="pulse-attn-item">
                  <span className="pulse-attn-ticker">Review {item.ticker}</span>
                  <span className="pulse-attn-reason">
                    {isGain ? "Significant gain" : "Significant drop"} · {fmtPct(item.changePercent)}
                    {isGain ? " · Consider whether thesis still holds" : " · Review thesis risk"}
                  </span>
                </Link>
              );
            })}
          </div>
        ) : (
          <p className="pulse-muted" style={{ marginBottom: 12 }}>All clear — no alerts.</p>
        )}

        {/* No Action Needed (collapsed, muted) */}
        {noActionItems.length > 0 && (
          <details className="pulse-attn-done">
            <summary className="pulse-attn-done-summary">
              <span className="pulse-attn-done-trigger">No action needed</span>
              <span className="pulse-attn-done-count">{noActionItems.length}</span>
            </summary>
            <p className="pulse-attn-done-list">
              {noActionItems.map((w) => w.ticker).join(", ")} · unchanged
            </p>
          </details>
        )}
      </section>

      {/* ── 4. Market ── */}
      <section className="pulse-card" aria-label="Market indicators">
        <div className="pulse-card-header">
          <h2 className="pulse-card-title">Market</h2>
        </div>
        <div className="pulse-strip">
          {data.indicators.map((ind) => {
            const displayPrice = ind.price != null ? fmtPrice(ind.price, ind.isPercentValue) : "—";
            const statusLabel = ind.status === "proxy" ? "ETF proxy" : "ready";
            return (
              <div key={ind.ticker} className="pulse-strip-item">
                <span className="pulse-strip-label">{ind.label}</span>
                <span className="pulse-strip-value">{displayPrice}</span>
                <span className={`pulse-strip-change ${cls(ind.changePercent)}`}>
                  {arrow(ind.changePercent)} {fmtPct(ind.changePercent)}
                </span>
                {ind.status === "proxy" && (
                  <span className="pulse-strip-note">{statusLabel}</span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── 5. Sectors ── */}
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

      {/* ── 6. Watchlist ── */}
      <section className="pulse-card" aria-label="Your watchlist">
        <div className="pulse-card-header">
          <h2 className="pulse-card-title">Watchlist</h2>
        </div>
        {data.watchlist.length > 0 ? (
          <div className="pulse-wl">
            {data.watchlist.map((item) => {
              const dir = item.change === null || item.change === 0 ? "neutral" : item.change > 0 ? "positive" : "negative";
              return (
                <Link key={item.ticker} href={`/companies/${item.ticker}`} className="pulse-wl-row">
                  <div className="pulse-wl-top">
                    <span className="pulse-wl-ticker">{item.ticker}</span>
                    <span className={`pulse-wl-badge ${dir}`}>
                      {dir === "positive" ? "Strengthening" : dir === "negative" ? "Weakening" : "Stable"}
                    </span>
                  </div>
                  <div className="pulse-wl-meta">
                    <span>{item.price != null ? `$${fmtPrice(item.price, false)}` : "—"}</span>
                    <span className={dir}> · {fmtPct(item.changePercent)}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <p className="pulse-muted">No holdings on watchlist.</p>
        )}
      </section>
    </div>
  );
}