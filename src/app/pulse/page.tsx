"use client";

import { useEffect, useMemo, useState } from "react";
import type { PulseData, PulseGlobalMarket, PulseIndicator, PulseSector } from "@/app/api/market/pulse/route";
import { isFiniteNumber } from "@/lib/display/format";
import { PageLoadingMotion } from "@/components/PageLoadingMotion";
import { HeatTile } from "@/components/HeatTile";
import { MacroChainChart, type MacroChainSeries } from "@/components/market/MacroChainChart";
import { MarketMovesPanel } from "@/components/market/MarketMovesPanel";
import { MarketNarrativeDriversPanel } from "@/components/market/MarketNarrativeDriversPanel";
import {
  themesForHeatmapGroup,
  type MarketNarrativeTheme,
  type NarrativeHeatmapGroup,
} from "@/lib/market/market-narratives";

const COLORS = {
  green: "#0D9488",
  red: "#DC2626",
  yellow: "#D97706",
  orange: "#EA580C",
  blue: "#0D9488",
};

const VIX_GAUGE = {
  min: 10,
  max: 40,
  zones: [
    { label: "Calm", end: 15, color: "#0D9488" },
    { label: "Normal", end: 20, color: "#5EEAD4" },
    { label: "Elevated", end: 25, color: "#D97706" },
    { label: "Danger", end: 40, color: "#DC2626" },
  ],
};

const TEN_YEAR_GAUGE = {
  min: 2.5,
  max: 6,
  zones: [
    { label: "Normal", end: 4.25, color: "#0D9488" },
    { label: "Elevated", end: 5, color: "#D97706" },
    { label: "High", end: 6, color: "#DC2626" },
  ],
};

const HEATMAP_SPANS = { largeWeight: 15, mediumWeight: 8 };

const PULSE_TABS = [
  {
    id: "indexes",
    label: "Indexes",
    description: "Major indexes and market leadership",
  },
  {
    id: "trending",
    label: "Trending",
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

function companyDashboardHref(ticker: string): string {
  return `/companies/${encodeURIComponent(ticker)}`;
}

function GlobalMarketsHeatmap({
  markets,
  title,
  subtitle,
  narrativeGroup,
  narratives,
  uniformTiles = false,
  sessionLabel = null,
}: {
  markets: PulseGlobalMarket[];
  title: string;
  subtitle: string;
  narrativeGroup: NarrativeHeatmapGroup;
  narratives: MarketNarrativeTheme[];
  uniformTiles?: boolean;
  sessionLabel?: string | null;
}) {
  if (markets.length === 0) return null;
  const groupThemes = themesForHeatmapGroup(narratives, narrativeGroup);

  return (
    <section
      className="market-heatmap-shell market-sector-panel"
      aria-label={`${title} leadership`}
      aria-description={subtitle}
    >
      <div className="market-heatmap-copy">
        <div className="market-panel-header">
          <h2>{title}</h2>
          {sessionLabel ? (
            <span className="market-session-badge ink-chip ink-chip--amber" aria-label={`${sessionLabel} session`}>
              <i className="market-session-dot" aria-hidden="true" />
              {sessionLabel}
            </span>
          ) : null}
        </div>
        <p className="market-heatmap-subtitle">{subtitle}</p>
      </div>
      <div className={`market-heatmap${markets.length <= 3 ? " compact" : ""}`}>
        {markets.map((market) => {
          const span = uniformTiles ? 1 : tileSpan(market.weight);
          return (
            <HeatTile
              key={market.ticker}
              label={market.ticker}
              changePercent={market.changePercent}
              href={companyDashboardHref(market.ticker)}
              ariaLabel={`${market.name}, ${fmtPct(market.changePercent)}, ${market.category}, ${market.ticker}`}
              style={{ gridColumn: `span ${span} / span ${span}` }}
            />
          );
        })}
      </div>
      <div className="stock-heat-footer">
        <MarketNarrativeDriversPanel themes={groupThemes} groupLabel={title} />
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
  const marketsByCategory = (category: string) =>
    data.globalMarkets.filter((market) => market.category === category);
  const majorIndexes = marketsByCategory("Major Index");
  const usMarkets = marketsByCategory("U.S. Markets");
  const commodities = marketsByCategory("Commodity");
  const cryptoMarkets = marketsByCategory("Crypto");
  const internationalMarkets = marketsByCategory("International");
  const industryMarkets = sectorsToMarkets(data.sectors);

  return (
    <main className="markets-page">
      <section className="market-regime-lede ink-panel" aria-label="Market regime">
        <strong className="market-regime-label">{data.macroRegime.label}</strong>
        <p className="market-regime-summary">{data.macroRegime.summary}</p>
        {data.macroRegime.drivers.length > 0 ? (
          <div className="market-regime-drivers" aria-label="What is driving this regime">
            {data.macroRegime.drivers.map((driver) => (
              <span
                key={driver.id}
                className={`market-regime-driver market-regime-driver-${driver.direction}`}
                title={driver.explanation}
              >
                <strong>{driver.label}</strong>
                <em className={`ink-chip ink-chip--${
                  driver.direction === "rising"
                    ? "up"
                    : driver.direction === "falling"
                      ? "down"
                      : driver.direction === "mixed"
                        ? "amber"
                        : "quiet"
                }`}>{driver.direction}</em>
              </span>
            ))}
          </div>
        ) : null}
      </section>

      <section className="pulse-view-picker" aria-label="Pulse views">
        <div className="pulse-view-tabs" role="tablist" aria-label="Choose a Pulse view">
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
              <strong>{option.label}</strong>
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
            <section className="market-gauge-grid" aria-label="Market danger zones">
              <Gauge label="VIX" value={vix} config={VIX_GAUGE} />
              <Gauge label="10Y Yield" value={tenYear} suffix="%" config={TEN_YEAR_GAUGE} />
            </section>
            <GlobalMarketsHeatmap
              markets={majorIndexes}
              title="Major Indexes"
              subtitle="Dow, S&P 500, and Nasdaq · tap any tile for the company dashboard"
              narrativeGroup="Major Index"
              narratives={data.marketNarratives.themes}
              uniformTiles
              sessionLabel={data.sessionLabel ?? null}
            />
            <GlobalMarketsHeatmap
              markets={commodities}
              title="Commodities"
              subtitle="Oil, gold, and silver · tap any tile for the company dashboard"
              narrativeGroup="Commodity"
              narratives={data.marketNarratives.themes}
              uniformTiles
            />
            <GlobalMarketsHeatmap
              markets={cryptoMarkets}
              title="Crypto"
              subtitle="Bitcoin, Ethereum, and Solana · tap any tile for the company dashboard"
              narrativeGroup="Crypto"
              narratives={data.marketNarratives.themes}
              uniformTiles
            />
            {usMarkets.length > 0 ? (
              <GlobalMarketsHeatmap
                markets={usMarkets}
                title="U.S. Markets"
                subtitle="Breadth, style, and dollar proxies · tap any tile for the company dashboard"
                narrativeGroup="U.S. Markets"
                narratives={data.marketNarratives.themes}
                uniformTiles
              />
            ) : null}
            <GlobalMarketsHeatmap
              markets={internationalMarkets}
              title="International"
              subtitle="Country ETF proxies · tap any tile for the company dashboard"
              narrativeGroup="International"
              narratives={data.marketNarratives.themes}
            />
            <div id="industries">
              <GlobalMarketsHeatmap
                markets={industryMarkets}
                title="Industries"
                subtitle="Sector ETF proxies · tap any tile for the company dashboard"
                narrativeGroup="Industries"
                narratives={data.marketNarratives.themes}
                sessionLabel={data.sessionLabel ?? null}
              />
            </div>
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
            <MarketMovesPanel />
          </section>
        ) : null}
      </div>
    </main>
  );
}
