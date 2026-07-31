"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { PulseData, PulseGlobalMarket, PulseIndicator, PulseSector } from "@/app/api/market/pulse/route";
import { isFiniteNumber } from "@/lib/display/format";
import { PageLoadingMotion } from "@/components/PageLoadingMotion";
import { MarketNarrativePulse } from "@/components/market/MarketNarrativePulse";
import { MacroChainChart, type MacroChainSeries } from "@/components/market/MacroChainChart";
import { MarketMovesPanel } from "@/components/market/MarketMovesPanel";

const COLORS = {
  green: "#4ade80",
  red: "#f87171",
  yellow: "#facc15",
  orange: "#fb923c",
  blue: "#60a5fa",
};

const VIX_GAUGE = {
  min: 10,
  max: 40,
  zones: [
    { label: "Calm", end: 15, color: "#245b43" },
    { label: "Normal", end: 20, color: COLORS.green },
    { label: "Elevated", end: 25, color: COLORS.yellow },
    { label: "Danger", end: 40, color: COLORS.red },
  ],
};

const TEN_YEAR_GAUGE = {
  min: 2.5,
  max: 6,
  zones: [
    { label: "Normal", end: 4.25, color: COLORS.green },
    { label: "Elevated", end: 5, color: COLORS.yellow },
    { label: "High", end: 6, color: COLORS.red },
  ],
};

const HEATMAP_SPANS = { largeWeight: 15, mediumWeight: 8 };

const PULSE_TABS = [
  {
    id: "indexes",
    label: "Indexes",
    labelTop: "Indexes",
    labelBottom: null,
    description: "Major indexes and market leadership",
  },
  {
    id: "trending",
    label: "Trending Stocks",
    labelTop: "Trending",
    labelBottom: "Stocks",
    description: "Where conviction is changing fastest",
  },
] as const;

type PulseTab = (typeof PULSE_TABS)[number]["id"];

const MACRO_SERIES = [
  { ticker: "SPY", key: "equities", label: "Equities", color: COLORS.green },
  { ticker: "^TNX", key: "yield", label: "10Y Yield", color: COLORS.red },
  { ticker: "^VIX", key: "vix", label: "Volatility", color: COLORS.yellow },
  { ticker: "USO", key: "oil", label: "Oil", color: COLORS.orange },
  { ticker: "UUP", key: "dollar", label: "Dollar", color: COLORS.blue },
] as const;

function fmtPct(value: number | null): string {
  if (!isFiniteNumber(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function fmtPrice(value: number | null, isPercent: boolean): string {
  if (!isFiniteNumber(value)) return "—";
  if (isPercent) return `${value.toFixed(2)}%`;
  if (value >= 1000) return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return value >= 10 ? value.toFixed(2) : value.toFixed(3);
}

function Gauge({
  label,
  value,
  suffix = "",
  config,
}: {
  label: string;
  value: number | null;
  suffix?: string;
  config: typeof VIX_GAUGE | typeof TEN_YEAR_GAUGE;
}) {
  const bounded = isFiniteNumber(value) ? Math.min(config.max, Math.max(config.min, value)) : config.min;
  const marker = ((bounded - config.min) / (config.max - config.min)) * 100;
  let previousEnd = config.min;

  return (
    <article className="market-gauge-card">
      <div className="market-card-heading">
        <span>{label}</span><span className="market-live">LIVE</span>
      </div>
      <strong className="market-gauge-value">{isFiniteNumber(value) ? value.toFixed(2) : "—"}{suffix}</strong>
      <div className="market-gauge" aria-label={`${label} risk gauge`}>
        {config.zones.map((zone) => {
          const width = ((zone.end - previousEnd) / (config.max - config.min)) * 100;
          previousEnd = zone.end;
          return <span key={zone.label} title={zone.label} style={{ width: `${width}%`, background: zone.color }} />;
        })}
        {isFiniteNumber(value) && <i className="market-gauge-marker" style={{ left: `${marker}%` }} />}
      </div>
      <div className="market-gauge-labels"><span>{config.zones[0].label}</span><span>{config.zones.at(-1)?.label}</span></div>
    </article>
  );
}

function tileSpan(weight: number): number {
  if (weight > HEATMAP_SPANS.largeWeight) return 3;
  if (weight > HEATMAP_SPANS.mediumWeight) return 2;
  return 1;
}

function heatColor(change: number | null, maxAbs: number): string {
  if (!isFiniteNumber(change) || maxAbs === 0) return "hsl(220 5% 22%)";
  const magnitude = Math.min(Math.abs(change) / maxAbs, 1);
  const hue = change >= 0 ? 150 : 0;
  const saturation = 44 + magnitude * 30;
  const lightness = 16 + magnitude * 17;
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

function GlobalMarketsHeatmap({
  markets,
  title,
  subtitle,
  uniformTiles = false,
  sessionLabel = null,
  linkBase = null,
}: {
  markets: PulseGlobalMarket[];
  title: string;
  subtitle: string;
  uniformTiles?: boolean;
  sessionLabel?: string | null;
  linkBase?: string | null;
}) {
  const [selected, setSelected] = useState<PulseGlobalMarket | null>(markets[0] ?? null);
  const maxAbs = Math.max(...markets.map((market) => Math.abs(market.changePercent ?? 0)), 0);

  return (
    <section className="market-panel market-sector-panel" aria-label={`${title} leadership`} aria-description={subtitle}>
      <div className="market-panel-header">
        <div><h2>{title}</h2></div>
        {sessionLabel ? (
          <span className="market-session-badge" aria-label={`${sessionLabel} session`}>
            <i className="market-session-dot" aria-hidden="true" />
            {sessionLabel}
          </span>
        ) : null}
      </div>
      <div className="market-sector-detail" aria-live="polite">
        {selected ? (
          <>
            <span>{selected.name}</span>
            <b className={(selected.changePercent ?? 0) >= 0 ? "positive" : "negative"}>{fmtPct(selected.changePercent)}</b>
            <span>{selected.category} · {selected.ticker}</span>
            <span className="market-detail-price">{fmtPrice(selected.price, false)}</span>
          </>
        ) : (
          <span>Hover or tap a market</span>
        )}
      </div>
      <div className={`market-heatmap${markets.length <= 3 ? " compact" : ""}`}>
        {markets.map((market) => {
          const tile = (
            <button
              key={market.ticker}
              type="button"
              className={`market-heat-tile${selected?.ticker === market.ticker ? " selected" : ""}`}
              style={{
                gridColumn: uniformTiles ? "span 1 / span 1" : `span ${tileSpan(market.weight)} / span ${tileSpan(market.weight)}`,
                background: heatColor(market.changePercent, maxAbs),
              }}
              onMouseEnter={() => setSelected(market)}
              onFocus={() => setSelected(market)}
              onClick={() => setSelected(market)}
              aria-label={`${market.name}, ${fmtPct(market.changePercent)}, ${market.category}, ${market.ticker}`}
            >
              <span>{market.name}</span><strong>{fmtPct(market.changePercent)}</strong>
            </button>
          );

          if (!linkBase) return tile;

          return (
            <Link
              key={market.ticker}
              href={`${linkBase}/${market.ticker}`}
              className={`market-heat-tile${selected?.ticker === market.ticker ? " selected" : ""}`}
              style={{
                gridColumn: uniformTiles ? "span 1 / span 1" : `span ${tileSpan(market.weight)} / span ${tileSpan(market.weight)}`,
                background: heatColor(market.changePercent, maxAbs),
              }}
              onMouseEnter={() => setSelected(market)}
              onFocus={() => setSelected(market)}
              aria-label={`${market.name}, ${fmtPct(market.changePercent)}, ${market.category}, ${market.ticker}`}
            >
              <span>{market.name}</span><strong>{fmtPct(market.changePercent)}</strong>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function sectorsToMarkets(sectors: PulseSector[]): PulseGlobalMarket[] {
  return sectors.map((sector) => ({
    ticker: sector.ticker,
    name: sector.name,
    changePercent: sector.changePercent,
    price: null,
    weight: sector.weight,
    category: "Sector",
  }));
}

function indicatorsToMacroSeries(indicators: PulseIndicator[]): MacroChainSeries[] {
  const lookup = new Map(indicators.map((item) => [item.ticker, item]));
  return MACRO_SERIES.map((series) => ({
    key: series.key,
    label: series.label,
    color: series.color,
    values: (lookup.get(series.ticker)?.history ?? []).slice(-15).map((point) => point.close),
  })).filter((series) => series.values.length >= 2);
}

export default function MarketPulsePage() {
  const [data, setData] = useState<PulseData | null>(null);
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [activeTab, setActiveTab] = useState<PulseTab>("indexes");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/market/pulse")
      .then((response) => { if (!response.ok) throw new Error("Market data unavailable"); return response.json() as Promise<PulseData>; })
      .then((payload) => { if (!cancelled) { setData(payload); setStatus("success"); } })
      .catch(() => { if (!cancelled) setStatus("error"); });
    return () => { cancelled = true; };
  }, []);

  const macroSeries = useMemo(
    () => (data ? indicatorsToMacroSeries(data.indicators) : []),
    [data],
  );

  if (status === "loading") return <PageLoadingMotion label="Loading pulse" />;
  if (status === "error" || !data) return <div className="markets-page"><div className="market-empty">Market data is temporarily unavailable.</div></div>;

  const indicatorMap = new Map(data.indicators.map((indicator) => [indicator.ticker, indicator]));
  const vix = indicatorMap.get("^VIX")?.price ?? null;
  const tenYear = indicatorMap.get("^TNX")?.price ?? null;
  const indexMarkets = data.globalMarkets.filter((market) => market.category !== "International");
  const internationalMarkets = data.globalMarkets.filter((market) => market.category === "International");
  const industryMarkets = sectorsToMarkets(data.sectors);

  return (
    <main className="markets-page">
      <section className="market-regime-lede" aria-label="Market regime">
        <span className="market-regime-eyebrow">Pulse</span>
        <strong className="market-regime-label">{data.macroRegime.label}</strong>
        <p className="market-regime-summary">{data.macroRegime.summary}</p>
      </section>

      <section className="market-region-picker" aria-label="Pulse views">
        <div className="market-region-copy">
          <span>Pulse views</span>
          <p>Switch between index leadership and the stocks moving conviction right now.</p>
        </div>
        <div className="market-region-tabs" role="tablist" aria-label="Choose a Pulse view">
          {PULSE_TABS.map((option) => (
            <button
              key={option.id}
              id={`pulse-tab-${option.id}`}
              type="button"
              role="tab"
              aria-label={`${option.label}: ${option.description}`}
              aria-selected={activeTab === option.id}
              aria-controls={`pulse-panel-${option.id}`}
              className={activeTab === option.id ? "active" : ""}
              onClick={() => setActiveTab(option.id)}
            >
              <strong>
                {option.labelTop}
                {option.labelBottom ? (
                  <>
                    <br className="market-region-title-break" aria-hidden="true" />{" "}
                    {option.labelBottom}
                  </>
                ) : null}
              </strong>
              <span>{option.description}</span>
            </button>
          ))}
        </div>
      </section>

      <div
        id="pulse-panel-indexes"
        role="tabpanel"
        aria-labelledby="pulse-tab-indexes"
        hidden={activeTab !== "indexes"}
      >
        {activeTab === "indexes" ? (
          <>
            <GlobalMarketsHeatmap
              markets={indexMarkets}
              title="Indexes"
              subtitle="U.S. equities, Bitcoin, and macro assets · color reflects current session move"
              uniformTiles
              sessionLabel={data.sessionLabel ?? null}
            />
            <GlobalMarketsHeatmap
              markets={internationalMarkets}
              title="International"
              subtitle="Country ETF proxies · tile size reflects relative equity-market weight"
            />
            <div id="industries">
              <GlobalMarketsHeatmap
                markets={industryMarkets}
                title="Industries"
                subtitle="Sector ETF proxies · color reflects current session move"
                sessionLabel={data.sessionLabel ?? null}
                linkBase="/industries"
              />
            </div>
            <MarketNarrativePulse pulse={data.marketNarratives} />
            <section className="market-gauge-grid" aria-label="Market danger zones">
              <Gauge label="VIX" value={vix} config={VIX_GAUGE} />
              <Gauge label="10Y Yield" value={tenYear} suffix="%" config={TEN_YEAR_GAUGE} />
            </section>
            <MacroChainChart series={macroSeries} />
          </>
        ) : null}
      </div>

      <div
        id="pulse-panel-trending"
        role="tabpanel"
        aria-labelledby="pulse-tab-trending"
        hidden={activeTab !== "trending"}
      >
        {activeTab === "trending" ? (
          <section id="market-moves" className="pulse-market-moves" aria-label="Trending stocks">
            <div className="page-purpose" style={{ marginTop: 8 }}>
              <span className="page-purpose-eyebrow">Trending Stocks</span>
              <h2 className="page-purpose-title">Where is conviction changing fastest?</h2>
            </div>
            <MarketMovesPanel />
          </section>
        ) : null}
      </div>
    </main>
  );
}
