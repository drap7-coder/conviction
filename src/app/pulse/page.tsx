"use client";

import { useEffect, useState } from "react";
import type { PulseData, PulseGlobalMarket, PulseSector } from "@/app/api/market/pulse/route";
import { isFiniteNumber } from "@/lib/display/format";
import { PageLoadingMotion } from "@/components/PageLoadingMotion";
import { HeatTile } from "@/components/HeatTile";
import { MarketMovesPanel } from "@/components/market/MarketMovesPanel";
import { PulseDecisionCard } from "@/components/market/PulseDecisionCard";
import { MarketNarrativeDriversPanel } from "@/components/market/MarketNarrativeDriversPanel";
import {
  themesForHeatmapGroup,
  type MarketNarrativeTheme,
  type NarrativeHeatmapGroup,
} from "@/lib/market/market-narratives";
import type { InkTone } from "@/lib/display/ink-tone";
import { companyDetailHref } from "@/lib/market/company-detail-href";
import { ViewSwitcher } from "@/components/ViewSwitcher";
import { buildTrendingBreadthBrief } from "@/lib/market/pulse-brief";

type GaugeConfig = {
  min: number;
  max: number;
  zones: Array<{ label: string; end: number; color: string }>;
  decimals?: number;
  signed?: boolean;
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

const HEATMAP_SPANS = { largeWeight: 15, mediumWeight: 8 };

const PULSE_TABS = [
  {
    id: "indexes",
    label: "Indexes",
    tabId: "pulse-tab-indexes",
    panelId: "pulse-panel-indexes",
  },
  {
    id: "trending",
    label: "Trending",
    tabId: "pulse-tab-trending",
    panelId: "pulse-panel-trending",
  },
] as const;

type PulseTab = (typeof PULSE_TABS)[number]["id"];

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
  sessionBadge = "Live",
}: {
  label: string;
  value: number | null;
  suffix?: string;
  config: GaugeConfig;
  sessionBadge?: string;
}) {
  const bounded = isFiniteNumber(value) ? Math.min(config.max, Math.max(config.min, value)) : config.min;
  const marker = ((bounded - config.min) / (config.max - config.min)) * 100;
  let previousEnd = config.min;

  return (
    <article className="market-gauge-card">
      <div className="market-card-heading">
        <span>{label}</span>
        <span className="market-live">{sessionBadge}</span>
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

function groupDayTone(markets: PulseGlobalMarket[]): InkTone {
  const values = markets
    .map((market) => market.changePercent)
    .filter((value): value is number => isFiniteNumber(value));
  if (values.length === 0) return "quiet";
  const up = values.filter((value) => value > 0.05).length;
  const down = values.filter((value) => value < -0.05).length;
  if (up > 0 && down > 0) return "amber";
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (mean > 0.05) return "up";
  if (mean < -0.05) return "down";
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
  showDrivers = true,
  tileSubtitle,
}: {
  markets: PulseGlobalMarket[];
  title: string;
  subtitle: string;
  narrativeGroup: NarrativeHeatmapGroup;
  narratives: MarketNarrativeTheme[];
  uniformTiles?: boolean;
  showDrivers?: boolean;
  /** Override tile subtitle (default: ticker). */
  tileSubtitle?: (market: PulseGlobalMarket) => string;
}) {
  if (markets.length === 0) return null;
  const groupThemes = showDrivers ? themesForHeatmapGroup(narratives, narrativeGroup) : [];
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
        </div>
        {subtitle.trim() ? <p className="market-heatmap-subtitle">{subtitle}</p> : null}
      </div>
      {showDrivers ? (
        <div className="stock-heat-footer">
          <MarketNarrativeDriversPanel themes={groupThemes} groupLabel={title} />
        </div>
      ) : null}
      <div className={`market-heatmap${markets.length <= 3 ? " compact" : ""}`}>
        {markets.map((market) => {
          const span = uniformTiles ? 1 : tileSpan(market.weight);
          const sub = tileSubtitle ? tileSubtitle(market) : market.ticker;
          return (
            <HeatTile
              key={`${market.category}-${market.ticker}`}
              label={market.name}
              subtitle={sub}
              changePercent={market.changePercent}
              href={companyDetailHref(market.ticker)}
              ariaLabel={`${market.name}, ${fmtPct(market.changePercent)}, ${market.category}, ${market.ticker}`}
              style={{ gridColumn: `span ${span} / span ${span}` }}
              live
              sparkline={(market.history ?? []).map((point) => point.close)}
            />
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
    history: sector.history ?? [],
  }));
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

  if (status === "loading") return <PageLoadingMotion label="Loading pulse" />;
  if (status === "error" || !data) return <div className="markets-page"><div className="market-empty">Market data is temporarily unavailable.</div></div>;

  const indicatorMap = new Map(data.indicators.map((indicator) => [indicator.ticker, indicator]));
  const vix = indicatorMap.get("^VIX")?.price ?? null;
  const tenYear = indicatorMap.get("^TNX")?.price ?? null;
  const marketsByCategory = (category: string) =>
    data.globalMarkets.filter((market) => market.category === category);
  const majorIndexes = marketsByCategory("Major Index");
  const crossAssetMarkets = [
    ...marketsByCategory("Themes"),
    ...marketsByCategory("Commodity"),
    ...marketsByCategory("Crypto"),
    ...marketsByCategory("International"),
  ];
  const industryMarkets = sectorsToMarkets(data.sectors);

  const changeFor = (ticker: string) =>
    data.globalMarkets.find((market) => market.ticker === ticker)?.changePercent ?? null;
  const spyChange = changeFor("SPY");
  const equalWeightLead = relativeSpread(changeFor("RSP"), spyChange);
  const smallCapLead = relativeSpread(changeFor("IWM"), spyChange);
  const cyclicalAvg = avg(data.sectorLeadership.characteristics.cyclical);
  const defensiveAvg = avg(data.sectorLeadership.characteristics.defensive);
  const trendingBreadthBrief = buildTrendingBreadthBrief(equalWeightLead, smallCapLead);
  const gaugeSessionBadge = data.sessionLabel ?? "Live";

  return (
    <main className="markets-page">
      <ViewSwitcher
        label="Choose a Pulse view"
        options={[...PULSE_TABS]}
        activeId={activeTab}
        onChange={(id) => setActiveTab(id as PulseTab)}
      >
        <p className="view-switch-context-line">
          {activeTab === "indexes"
            ? "Regime map — indexes, sectors, cross-asset."
            : "Active names — breadth, then the board."}
        </p>
      </ViewSwitcher>

      <section className="product-stage product-stage--pulse" aria-label="Market regime">
        <div className="product-stage-copy">
          <span className="product-stage-eyebrow">
            <i aria-hidden="true" /> Pulse · {data.sessionLabel ?? "Live market"}
          </span>
          <h1>{data.macroRegime.label}</h1>
          <p>{data.macroRegime.summary}</p>
        </div>
        <div className="product-stage-metrics" aria-label="Key market readings">
          <div className={spyChange !== null && spyChange < 0 ? "is-negative" : ""}>
            <strong>{fmtPct(spyChange)}</strong>
            <span>S&amp;P 500</span>
          </div>
          <div className={vix !== null && vix >= 25 ? "is-alert" : ""}>
            <strong>{vix !== null ? vix.toFixed(1) : "—"}</strong>
            <span>VIX</span>
          </div>
          <div>
            <strong>{tenYear !== null ? `${tenYear.toFixed(2)}%` : "—"}</strong>
            <span>10Y yield</span>
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
            <GlobalMarketsHeatmap
              markets={majorIndexes}
              title="Major Indexes"
              subtitle=""
              narrativeGroup="Major Index"
              narratives={data.marketNarratives.themes}
              uniformTiles
            />
            <div id="industries">
              <GlobalMarketsHeatmap
                markets={industryMarkets}
                title="Sectors"
                subtitle=""
                narrativeGroup="Industries"
                narratives={data.marketNarratives.themes}
              />
            </div>
            <section className="market-gauge-grid pulse-gauge-section" aria-label="Sector leadership">
              <Gauge label="Cyclical" value={cyclicalAvg} suffix="%" config={SECTOR_MOVE_GAUGE} sessionBadge={gaugeSessionBadge} />
              <Gauge label="Defensive" value={defensiveAvg} suffix="%" config={SECTOR_MOVE_GAUGE} sessionBadge={gaugeSessionBadge} />
            </section>
            <GlobalMarketsHeatmap
              markets={crossAssetMarkets}
              title="Cross-asset"
              subtitle="Themes, commodities, crypto, and international."
              narrativeGroup="Themes"
              narratives={data.marketNarratives.themes}
              uniformTiles
              showDrivers={false}
              tileSubtitle={(market) => market.category}
            />
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
            <PulseDecisionCard brief={trendingBreadthBrief} />
            <section id="market-moves" className="pulse-market-moves" aria-label="Trending stocks">
              <MarketMovesPanel showDecisionCard={false} />
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
