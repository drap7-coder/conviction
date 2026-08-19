"use client";

import { useEffect, useState } from "react";
import type { PulseData, PulseGlobalMarket, PulseSector } from "@/app/api/market/pulse/route";
import { isFiniteNumber } from "@/lib/display/format";
import { PageLoadingMotion } from "@/components/PageLoadingMotion";
import { HeatTile } from "@/components/HeatTile";
import { MarketMovesPanel } from "@/components/market/MarketMovesPanel";
import { MarketNarrativeDriversPanel } from "@/components/market/MarketNarrativeDriversPanel";
import {
  themesForHeatmapGroup,
  type MarketNarrativeTheme,
  type NarrativeHeatmapGroup,
} from "@/lib/market/market-narratives";
import type { InkTone } from "@/lib/display/ink-tone";
import { companyDetailHref } from "@/lib/market/company-detail-href";
import { ProductStage } from "@/components/ProductStage";
import { ViewSwitcher } from "@/components/ViewSwitcher";

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

function regimeDecisionHeadline(label: string | undefined): string {
  switch (label) {
    case "Risk-on": return "Risk appetite is broadening.";
    case "Risk-off": return "Risk is coming out of the market.";
    case "Defensive rotation": return "Defensives are taking the lead.";
    case "Growth-led": return "Growth is leading the market.";
    case "Cyclical rotation": return "Cyclicals are taking the lead.";
    case "Volatility expansion": return "Volatility is rising beneath a steady market.";
    case "Volatility compression": return "Volatility is easing while stocks wait.";
    case "Rates pressure": return "Higher yields are pressuring risk.";
    case "Mixed Signals": return "The market is sending mixed signals.";
    case "Insufficient data": return "The market read is still forming.";
    default: return "Read the market at a glance.";
  }
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

  const indicatorMap = new Map((data?.indicators ?? []).map((indicator) => [indicator.ticker, indicator]));
  const vix = indicatorMap.get("^VIX")?.price ?? null;
  const tenYear = indicatorMap.get("^TNX")?.price ?? null;
  const marketsByCategory = (category: string) =>
    data?.globalMarkets.filter((market) => market.category === category) ?? [];
  const majorIndexes = marketsByCategory("Major Index");
  const themeMarkets = marketsByCategory("Themes");
  const commodities = marketsByCategory("Commodity");
  const cryptoMarkets = marketsByCategory("Crypto");
  const internationalMarkets = marketsByCategory("International");
  const industryMarkets = sectorsToMarkets(data?.sectors ?? []);

  const changeFor = (ticker: string) =>
    data?.globalMarkets.find((market) => market.ticker === ticker)?.changePercent ?? null;
  const spyChange = changeFor("SPY");

  return (
    <main className="markets-page">
      <ViewSwitcher
        label="Choose a Pulse view"
        options={[...PULSE_TABS]}
        activeId={activeTab}
        onChange={(id) => setActiveTab(id as PulseTab)}
      />

      <ProductStage
        variant="pulse"
        aria-label="Market regime"
        loading={status === "loading"}
        eyebrow={`Pulse · ${data ? "Live data" : "Market read"} · ${data?.sessionLabel ?? (status === "loading" ? "Reading market" : "Temporarily unavailable")}`}
        headline={regimeDecisionHeadline(data?.macroRegime.label)}
        summary={data?.macroRegime.summary ?? "See the regime first, then scan the indexes, sectors, and stocks driving the day."}
        metrics={
          <>
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
          </>
        }
      />

      {status === "loading" ? (
        <PageLoadingMotion
          label="Loading pulse"
          compact
          showLabel={false}
          showSubtitle={false}
          speed="slow"
        />
      ) : null}
      {status === "error" || (status === "success" && !data) ? (
        <div className="market-empty">Market data is temporarily unavailable.</div>
      ) : null}

      <div
        id="pulse-panel-indexes"
        role="tabpanel"
        aria-labelledby="pulse-tab-indexes"
        hidden={activeTab !== "indexes"}
      >
        {activeTab === "indexes" && data ? (
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

            <div className="pulse-more-markets" aria-label="More markets">
              <p className="pulse-more-markets-label">More markets</p>
              <GlobalMarketsHeatmap
                markets={themeMarkets}
                title="Themes"
                subtitle=""
                narrativeGroup="Themes"
                narratives={data.marketNarratives.themes}
                uniformTiles
                showDrivers={false}
              />
              <GlobalMarketsHeatmap
                markets={commodities}
                title="Commodities"
                subtitle=""
                narrativeGroup="Commodity"
                narratives={data.marketNarratives.themes}
                uniformTiles
                showDrivers={false}
              />
              <GlobalMarketsHeatmap
                markets={cryptoMarkets}
                title="Crypto"
                subtitle=""
                narrativeGroup="Crypto"
                narratives={data.marketNarratives.themes}
                uniformTiles
                showDrivers={false}
              />
              <GlobalMarketsHeatmap
                markets={internationalMarkets}
                title="International"
                subtitle=""
                narrativeGroup="International"
                narratives={data.marketNarratives.themes}
                showDrivers={false}
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
        {activeTab === "trending" && data ? (
          <section id="market-moves" className="pulse-market-moves" aria-label="Trending stocks">
            <MarketMovesPanel showDecisionCard={false} />
          </section>
        ) : null}
      </div>
    </main>
  );
}
