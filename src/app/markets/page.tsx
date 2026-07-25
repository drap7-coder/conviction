"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { PulseData } from "@/app/api/market/pulse/route";
import type { MacroDriverInsight } from "@/lib/market/macro-regime";
import { isFiniteNumber } from "@/lib/display/format";
import { SECTOR_CHARACTERISTICS } from "@/lib/market/sector-classification";

// ── Helpers ──

function fmtPct(value: number | null): string {
  if (!isFiniteNumber(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function fmtPrice(value: number | null, isPercent: boolean): string {
  if (!isFiniteNumber(value)) return "—";
  if (isPercent) return `${value.toFixed(2)}%`;
  if (value >= 1000) return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (value >= 10) return value.toFixed(2);
  return value.toFixed(3);
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning.";
  if (h < 17) return "Good afternoon.";
  return "Good evening.";
}

function confidenceLabel(c: "high" | "medium" | "low"): string {
  if (c === "high") return "High confidence";
  if (c === "medium") return "Moderate confidence";
  return "Low confidence";
}

function freshnessLabel(status: string): string {
  switch (status) {
    case "ready": return "LIVE";
    case "proxy": return "15m";
    case "delayed": return "DELAYED";
    case "stale": return "STALE";
    default: return "—";
  }
}

function sectorChars(name: string): string[] {
  return (SECTOR_CHARACTERISTICS[name] ?? []).map((c) => {
    switch (c) {
      case "cyclical": return "Cyclical";
      case "defensive": return "Defensive";
      case "growth-sensitive": return "Growth";
      case "rate-sensitive": return "Rate";
    }
  });
}

function arrowFromDir(d: MacroDriverInsight["direction"]): string {
  switch (d) {
    case "rising": return "↑";
    case "falling": return "↓";
    case "flat": return "→";
    case "mixed": return "↕";
    case "unavailable": return "—";
  }
}

// ── Fixed instrument config ──

interface InstrumentConfig {
  ticker: string;
  label: string;
  proxyLabel: string;
}

const INSTRUMENTS: InstrumentConfig[] = [
  { ticker: "SPY", label: "S&P 500", proxyLabel: "S&P 500 (ETF proxy)" },
  { ticker: "QQQ", label: "Nasdaq", proxyLabel: "Nasdaq (ETF proxy)" },
  { ticker: "^VIX", label: "VIX", proxyLabel: "VIX" },
  { ticker: "USO", label: "Oil", proxyLabel: "Oil (ETF proxy)" },
  { ticker: "^TNX", label: "10Y Yield", proxyLabel: "10Y Yield" },
  { ticker: "UUP", label: "Dollar", proxyLabel: "Dollar (ETF proxy)" },
];

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

  // ── Loading state ──
  if (status === "loading" || status === "idle") {
    return (
      <div className="pulse">
        <div className="pulse-empty">
          <p className="pulse-empty-text">Loading market pulse…</p>
        </div>
      </div>
    );
  }

  // ── Error state ──
  if (status === "error" || !data) {
    return (
      <div className="pulse">
        <div className="pulse-empty">
          <p className="pulse-empty-text">Market data is temporarily unavailable.</p>
          <p className="pulse-empty-sub">Check your connection and try again.</p>
        </div>
      </div>
    );
  }

  const { macroRegime, sectorLeadership, indicators, sectors } = data;

  // Build a lookup from the API indicators
  const indicatorMap = new Map(indicators.map((i) => [i.ticker, i]));

  // ── Render ──

  return (
    <div className="pulse">

      <style>{`
        /* ── Instrument strip ── */
        .pulse-instrument-greeting {
          font-size: 1.75rem;
          font-weight: 800;
          color: var(--ink);
          line-height: 1.2;
          margin: 0 0 12px;
        }
        .pulse-instrument-strip {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 8px;
          margin-bottom: 16px;
          min-width: 0;
        }
        .pulse-instrument-cell {
          display: flex;
          flex-direction: column;
          gap: 2px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 10px 10px 8px;
          font-family: var(--font-mono);
          font-variant-numeric: tabular-nums;
          min-width: 0;
          overflow: hidden;
        }
        .pulse-instrument-label {
          font-size: 0.5rem;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--quiet);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-bottom: 4px;
        }
        .pulse-instrument-value {
          font-size: 1.1rem;
          font-weight: 700;
          color: var(--ink);
          line-height: 1.2;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .pulse-instrument-change {
          font-size: 0.6rem;
          font-weight: 600;
          line-height: 1.3;
        }
        .pulse-instrument-change .up, .pulse-change-up { color: var(--green); }
        .pulse-instrument-change .down, .pulse-change-down { color: var(--red); }
        .pulse-instrument-change .flat, .pulse-change-flat { color: var(--quiet); }
        .pulse-instrument-fresh {
          font-size: 0.45rem;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          line-height: 1.3;
          margin-top: 2px;
        }
        .pulse-instrument-fresh.live { color: var(--green); }
        .pulse-instrument-fresh.proxy { color: var(--accent); }
        .pulse-instrument-fresh.delayed { color: var(--muted); }
        .pulse-instrument-fresh.stale { color: var(--red); }
        .pulse-instrument-fresh.none { color: var(--quiet); opacity: 0.4; }

        /* ── Macro regime bar ── */
        .pulse-macro-bar {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          margin-bottom: 16px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          font-family: var(--font-mono);
          flex-wrap: nowrap;
          width: 100%;
        }
        .pulse-macro-bar-wrapper {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }
        .pulse-macro-bar > .pulse-regime-badge {
          flex-shrink: 0;
          white-space: nowrap;
        }
        .pulse-macro-bar-conf {
          font-size: 0.58rem;
          color: var(--quiet);
          font-weight: 600;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .pulse-macro-bar-sep {
          color: var(--border);
          font-size: 0.75rem;
          flex-shrink: 0;
        }
        .pulse-macro-bar-drivers {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: nowrap;
          flex-shrink: 0;
        }
        .pulse-macro-driver {
          font-size: 0.62rem;
          font-weight: 600;
          font-family: var(--font-mono);
          white-space: nowrap;
        }
        .pulse-macro-bar-drivers .pulse-macro-driver.rising { color: #007844 !important; }
        .pulse-macro-bar-drivers .pulse-macro-driver.falling { color: #b3163f !important; }
        .pulse-macro-bar-drivers .pulse-macro-driver.flat { color: #888888 !important; }
        .pulse-macro-bar-drivers .pulse-macro-driver.unavailable { color: #88888888 !important; opacity: 0.5; }

        @media (max-width: 767px) {
          .pulse-instrument-greeting { font-size: 1.45rem; }
          .pulse-instrument-strip {
            grid-template-columns: repeat(3, 1fr);
          }
          .pulse-instrument-cell { padding: 8px 8px 6px; }
          .pulse-instrument-value { font-size: 0.85rem; }
          .pulse-instrument-label { font-size: 0.45rem; }
          .pulse-instrument-change { font-size: 0.5rem; }
          .pulse-macro-bar {
            gap: 6px;
            padding: 6px 10px;
            flex-wrap: nowrap;
          }
          .pulse-macro-bar-drivers {
            gap: 4px;
          }
          .pulse-macro-driver {
            font-size: 0.55rem;
          }
          .pulse-macro-bar-conf {
            font-size: 0.5rem;
          }
        }
      `}</style>

      {/* ════════════════ 1. GREETING ════════════════ */}
      <p className="pulse-instrument-greeting">{greeting()}</p>

      {/* ════════════════ 2. INSTRUMENT STRIP ════════════════ */}
      <section className="pulse-instrument-strip" aria-label="Market instruments">
        {INSTRUMENTS.map((cfg) => {
          const ind = indicatorMap.get(cfg.ticker);
          const price = ind?.price != null ? fmtPrice(ind.price, ind.isPercentValue) : "—";
          const changePct = ind?.changePercent != null ? fmtPct(ind.changePercent) : null;
          const isUp = ind?.changePercent !== null && ind?.changePercent !== undefined && (ind?.changePercent ?? 0) > 0;
          const isDown = ind?.changePercent !== null && ind?.changePercent !== undefined && (ind?.changePercent ?? 0) < 0;
          const dirArrow = isUp ? "▲" : isDown ? "▼" : null;
          const label = ind?.status === "proxy" ? cfg.proxyLabel : cfg.label;
          const fresh = freshnessLabel(ind?.status ?? "");
          return (
            <div key={cfg.ticker} className="pulse-instrument-cell">
              <span className="pulse-instrument-label">{label}</span>
              <span className="pulse-instrument-value">{price}</span>
              <span className="pulse-instrument-change">
                {dirArrow && changePct ? (
                  <span className={isUp ? "up" : "down"}>
                    {dirArrow} {changePct}
                  </span>
                ) : (
                  <span className="flat">—</span>
                )}
              </span>
              <span className={`pulse-instrument-fresh ${fresh === "LIVE" ? "live" : fresh === "15m" ? "proxy" : fresh === "DELAYED" ? "delayed" : fresh === "STALE" ? "stale" : "none"}`}>
                {fresh}
              </span>
            </div>
          );
        })}
      </section>

      {/* ════════════════ 3. MACRO REGIME BAR ════════════════ */}
      <div className="pulse-macro-bar-wrapper" aria-label="Macro regime">
        <div className="pulse-macro-bar">
          <span className={`pulse-regime-badge pulse-regime-${macroRegime.confidence}`}>
            {macroRegime.label}
          </span>
          <span className="pulse-macro-bar-conf">{confidenceLabel(macroRegime.confidence)}</span>
          <span className="pulse-macro-bar-sep" aria-hidden="true">|</span>
          <div className="pulse-macro-bar-drivers">
            {macroRegime.drivers.length > 0 ? (
              macroRegime.drivers.map((d) => (
                <span
                  key={d.id}
                  className={`pulse-macro-driver ${d.direction}`}
                  title={d.explanation}
                >
                  {d.label} {arrowFromDir(d.direction)}
                </span>
              ))
            ) : (
              <span className="pulse-macro-driver unavailable">Mixed</span>
            )}
            {macroRegime.missingInputs.length > 0 && (
              <span className="pulse-macro-driver unavailable" title="Missing data">
                Insufficient data
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ════════════════ 4. SECTOR LEADERSHIP ════════════════ */}
      <section className="pulse-card" aria-label="Sector leadership">
        <div className="pulse-card-header">
          <h2 className="pulse-card-title">Sector Leadership</h2>
        </div>

        {sectorLeadership.interpretation && (
          <p className="pulse-sector-interp">{sectorLeadership.interpretation}</p>
        )}
        {sectorLeadership.missingCount > 0 && (
          <p className="pulse-muted-small">
            Sector data unavailable for {sectorLeadership.missingCount} sector{sectorLeadership.missingCount > 1 ? "s" : ""}.
          </p>
        )}

        <div className="pulse-sectors">
          {sectors.map((sector) => {
            const pct = sector.changePercent;
            const absPct = Math.abs(pct ?? 0);
            const strength = pct === null ? "flat" : absPct > 1 ? "strong" : absPct > 0.3 ? "moderate" : "flat";
            const dir = pct === null ? "" : pct > 0 ? "up" : "down";
            const chars = sectorChars(sector.name);
            return (
              <Link key={sector.ticker} href={`/industries/${sector.ticker}`} className="pulse-sector-row">
                <span className={`pulse-sector-arrow ${strength} ${dir}`}>
                  {pct === null ? "—" : pct > 0 ? "▲" : "▼"}
                </span>
                <span className="pulse-sector-name">
                  {sector.name}
                  {chars.length > 0 && (
                    <span className="pulse-sector-chars">
                      {chars.map((c) => (
                        <span key={c} className="pulse-sector-char-tag">{c}</span>
                      ))}
                    </span>
                  )}
                </span>
                <span className={`pulse-sector-pct ${strength} ${dir}`}>{fmtPct(pct)}</span>
                <span className="pulse-sector-track">
                  <span className={`pulse-sector-fill ${strength} ${dir}`} style={{ width: `${Math.min(absPct * 10, 100)}%` }} />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

    </div>
  );
}