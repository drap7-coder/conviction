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
import type { InkTone } from "@/lib/display/ink-tone";
import { companyDetailHref } from "@/lib/market/company-detail-href";

const COLORS = {
  green: "#0D9488",
  red: "#DC2626",
  yellow: "#D97706",
  orange: "#EA580C",
  blue: "#0D9488",
};

type GaugeConfig = {
  min: number;
  max: number;
  zones: Array<{ label: string; end: number; color: string }>;
  /** Digits after the decimal for the big number. */
  decimals?: number;
  /** Prefixed + for positive values (spreads / day moves). */
  signed?: boolean;
};

const VIX_GAUGE: GaugeConfig = {
  min: 10,
  max: 40,
  zones: [
    { label: "Calm", end: 15, color: "#0D9488" },
    { label: "Normal", end: 20, color: "#5EEAD4" },
    { label: "Elevated", end: 25, color: "#D97706" },
    { label: "Danger", end: 40, color: "#DC2626" },
  ],
};

const TEN_YEAR_GAUGE: GaugeConfig = {
  min: 2.5,
  max: 6,
  zones: [
    { label: "Normal", end: 4.25, color: "#0D9488" },
    { label: "Elevated", end: 5, color: "#D97706" },
    { label: "High", end: 6, color: "#DC2626" },
  ],
};

/** Average sector day-move for Cyclical / Defensive leadership. */
const SECTOR_MOVE_GAUGE: GaugeConfig = {
  min: -3,
  max: 3,
  decimals: 2,
  signed: true,
  zones: [
    { label: "Soft", end: -1, color: "#DC2626" },
    { label: "Mixed", end: 1, color: "#D97706" },
    { label: "Firm", end: 3, color: "#0D9488" },
  ],
};

/** Relative day-move vs SPY for breadth / small-cap risk appetite. */
const RELATIVE_SPREAD_GAUGE: GaugeConfig = {
  min: -2,
  max: 2,
  decimals: 2,
  signed: true,
  zones: [
    { label: "Lagging", end: -0.5, color: "#DC2626" },
    { label: "Inline", end: 0.5, color: "#D97706" },
    { label: "Leading", end: 2, color: "#0D9488" },
  ],
};

const HEATMAP_SPANS = { largeWeight: 15, mediumWeight: 8 };

const PULSE_TABS = [
  {
    id: "indexes",
    label: "Indexes",
    description: "Market temperature",
  },
  {
    id: "sectors",
    label: "Sectors",
    description: "Industry leadership",
  },
  {
    id: "trending",
    label: "Trending",
    description: "Stock conviction moves",
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

function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function relativeSpread(
  lead: number | null | undefined,
  baseline: number | null | undefined,
): number | null {
  if (!isFiniteNumber(lead) || !isFiniteNumber(baseline)) return null;
  return lead - baseline;
}

function formatGaugeValue(value: number, config: GaugeConfig): string {
  const decimals = config.decimals ?? 2;
  const body = value.toFixed(decimals);
  if (config.signed && value > 0) return `+${body}`;
  return body;
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
  config: GaugeConfig;
}) {
  const bounded = isFiniteNumber(value) ? Math.min(config.max, Math.max(config.min, value)) : config.min;
  const marker = ((bounded - config.min) / (config.max - config.min)) * 100;
  let previousEnd = config.min;

  return (
    <article className="market-gauge-card">
      <div className="market-card-heading">
        <span>{label}</span><span className="market-live">LIVE</span>
      </div>
      <strong className="market-gauge-value">
        {isFiniteNumber(value) ? formatGaugeValue(value, config) : "—"}
        {suffix}
      </strong>
      <div className="market-gauge" aria-label={`${label} gauge`}>
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

/** Day-status square beside the asset-class title (up / down / mixed). */
function groupDayTone(markets: PulseGlobalMarket[]): InkTone {
  const values = markets
    .map((market) => market.changePercent)
    .filter((value): value is number => isFiniteNumber(value));
  if (values.length === 0) return "quiet";
  const up = values.filter((value) => value > 0.05).length;
  const down = values.filter((value) => value < -0.05).length;
  if (up > 0 && down > 0) return "amber";
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (avg > 0.05) return "up";
  if (avg < -0.05) return "down";
  return "quiet";
}

function groupDayStatusLabel(tone: InkTone): string {
  if (tone === "up") return "Up on the day";
  if (tone === "down") return "Down on the day";
  if (tone === "amber") return "Mixed on the day";
  return "Flat on the day";
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
  const dayTone = groupDayTone(markets);

  return (
    <section
      className="market-heatmap-shell market-sector-panel"
      aria-label={`${title} leadership`}
      aria-description={subtitle}
    >
      <div className="market-heatmap-copy">
        <div className="market-panel-header">
          <h2>
            <i
              className={`pulse-day-status pulse-day-status--${dayTone}`}
              aria-label={groupDayStatusLabel(dayTone)}
              title={groupDayStatusLabel(dayTone)}
            />
            {title}
          </h2>
          {sessionLabel ? (
            <span className="market-session-badge ink-chip ink-chip--amber" aria-label={`${sessionLabel} session`}>
              <i className="market-session-dot" aria-hidden="true" />
              {sessionLabel}
            </span>
          ) : null}
        </div>
        {subtitle.trim() ? <p className="market-heatmap-subtitle">{subtitle}</p> : null}
      </div>
      <div className={`market-heatmap${markets.length <= 3 ? " compact" : ""}`}>
        {markets.map((market) => {
          const span = uniformTiles ? 1 : tileSpan(market.weight);
          return (
            <HeatTile
              key={market.ticker}
              label={market.ticker}
              changePercent={market.changePercent}
              href={companyDetailHref(market.ticker)}
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

  const changeFor = (ticker: string) =>
    data.globalMarkets.find((market) => market.ticker === ticker)?.changePercent ?? null;
  const spyChange = changeFor("SPY");
  const equalWeightLead = relativeSpread(changeFor("RSP"), spyChange);
  const smallCapLead = relativeSpread(changeFor("IWM"), spyChange);
  const cyclicalAvg = avg(data.sectorLeadership.characteristics.cyclical);
  const defensiveAvg = avg(data.sectorLeadership.characteristics.defensive);

  return (
    <main className="markets-page">
      <section className="view-switch-shell" aria-label="Pulse">
        <div className="view-switch-lede market-regime-lede ink-panel">
          <span className="market-regime-eyebrow">Pulse</span>
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
        </div>

        <div className="view-switch-picker pulse-view-picker">
          <div
            className="pulse-view-tabs"
            role="tablist"
            aria-label="Choose a Pulse view"
          >
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
              </button>
            ))}
          </div>
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
              subtitle=""
              narrativeGroup="Major Index"
              narratives={data.marketNarratives.themes}
              uniformTiles
              sessionLabel={data.sessionLabel ?? null}
            />
            <GlobalMarketsHeatmap
              markets={commodities}
              title="Commodities"
              subtitle=""
              narrativeGroup="Commodity"
              narratives={data.marketNarratives.themes}
              uniformTiles
            />
            <GlobalMarketsHeatmap
              markets={cryptoMarkets}
              title="Crypto"
              subtitle=""
              narrativeGroup="Crypto"
              narratives={data.marketNarratives.themes}
              uniformTiles
            />
            {usMarkets.length > 0 ? (
              <GlobalMarketsHeatmap
                markets={usMarkets}
                title="U.S. Markets"
                subtitle=""
                narrativeGroup="U.S. Markets"
                narratives={data.marketNarratives.themes}
                uniformTiles
              />
            ) : null}
            <GlobalMarketsHeatmap
              markets={internationalMarkets}
              title="International"
              subtitle=""
              narrativeGroup="International"
              narratives={data.marketNarratives.themes}
            />
            <MacroChainChart series={macroSeries} />
          </>
        ) : null}
      </div>

      <div
        id="pulse-panel-sectors"
        role="tabpanel"
        aria-labelledby="pulse-tab-sectors"
        hidden={activeTab !== "sectors"}
      >
        {activeTab === "sectors" ? (
          <>
            <section className="market-gauge-grid" aria-label="Sector leadership gauges">
              <Gauge label="Cyclical" value={cyclicalAvg} suffix="%" config={SECTOR_MOVE_GAUGE} />
              <Gauge label="Defensive" value={defensiveAvg} suffix="%" config={SECTOR_MOVE_GAUGE} />
            </section>
            <div id="industries">
              <GlobalMarketsHeatmap
                markets={industryMarkets}
                title="Sectors"
                subtitle=""
                narrativeGroup="Industries"
                narratives={data.marketNarratives.themes}
                sessionLabel={data.sessionLabel ?? null}
              />
            </div>
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
          <>
            <section className="market-gauge-grid" aria-label="Trending breadth gauges">
              <Gauge label="Equal weight" value={equalWeightLead} suffix="%" config={RELATIVE_SPREAD_GAUGE} />
              <Gauge label="Small caps" value={smallCapLead} suffix="%" config={RELATIVE_SPREAD_GAUGE} />
            </section>
            <section id="market-moves" className="pulse-market-moves" aria-label="Trending stocks">
              <MarketMovesPanel />
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
