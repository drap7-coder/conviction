"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SplitFlapMetric } from "@/app/components/SplitFlapMetric";
import type { PulseData } from "@/app/api/market/pulse/route";
import type { MacroDriverInsight } from "@/lib/market/macro-regime";
import { SECTOR_CHARACTERISTICS } from "@/lib/market/sector-classification";

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

  const { macroRegime, sectorLeadership, triage, indicators, sectors } = data;

  // ── Render ──

  return (
    <div className="pulse">

      {/* ════════════════ 1. BRIEFING HEADER ════════════════ */}
      <section className="pulse-brief" aria-label="Market briefing">
        <p className="pulse-brief-greeting">{greeting()}</p>
        <p className="pulse-brief-summary">{macroRegime.summary}</p>
        {macroRegime.missingInputs.length > 0 && (
          <p className="pulse-brief-note">
            Limited data: {macroRegime.missingInputs.join(", ")} unavailable.
          </p>
        )}
      </section>

      {/* ════════════════ 2. MACRO REGIME ════════════════ */}
      <section className="pulse-card" aria-label="Macro regime">
        <div className="pulse-card-header">
          <h2 className="pulse-card-title">Macro Regime</h2>
          <span className={`pulse-regime-badge pulse-regime-${macroRegime.confidence}`}>
            {macroRegime.label}
          </span>
        </div>

        {/* Driver tags */}
        <div className="pulse-regime-drivers">
          {macroRegime.drivers.map((d) => (
            <span
              key={d.id}
              className={`pulse-regime-tag pulse-regime-${d.direction}`}
              title={d.explanation}
            >
              {d.label}: {arrowFromDir(d.direction)}
            </span>
          ))}
          {macroRegime.missingInputs.length > 0 && (
            <span className="pulse-regime-tag pulse-regime-unavailable" title="Missing data">
              {macroRegime.missingInputs.length} unavailable
            </span>
          )}
        </div>

        <p className="pulse-regime-conf">
          {confidenceLabel(macroRegime.confidence)} · {macroRegime.drivers.length} of 6 indicators available
        </p>
      </section>

      {/* ════════════════ 3. MARKET INDICATORS ════════════════ */}
      <section className="pulse-card" aria-label="Market indicators">
        <div className="pulse-card-header">
          <h2 className="pulse-card-title">Market</h2>
        </div>
        <div className="pulse-strip-grid">
          {indicators.map((ind) => {
            const displayPrice = ind.price != null ? fmtPrice(ind.price, ind.isPercentValue) : "—";
            const changeText = ind.changePercent != null ? fmtPct(ind.changePercent) : undefined;
            const isPos = ind.changePercent !== null && ind.changePercent > 0 ? true : ind.changePercent !== null && ind.changePercent < 0 ? false : undefined;
            const label = ind.status === "proxy" ? `${ind.label} (ETF proxy)` : ind.label;
            return (
              <SplitFlapMetric
                key={ind.ticker}
                value={displayPrice}
                label={label}
                change={changeText}
                isPositive={isPos}
              />
            );
          })}
        </div>
      </section>

      {/* ════════════════ 5. SECTOR LEADERSHIP ════════════════ */}
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

function arrowFromDir(d: MacroDriverInsight["direction"]): string {
  switch (d) {
    case "rising": return "↑";
    case "falling": return "↓";
    case "flat": return "→";
    case "mixed": return "↕";
    case "unavailable": return "—";
  }
}