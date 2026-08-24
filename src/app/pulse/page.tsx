"use client";

import { useEffect, useState } from "react";
import type { PulseData, PulseGlobalMarket, PulseSector } from "@/app/api/market/pulse/route";
import { isFiniteNumber } from "@/lib/display/format";
import { PageLoadingMotion } from "@/components/PageLoadingMotion";
import { HeatTile } from "@/components/HeatTile";
import { HeatmapGrid } from "@/components/HeatmapGrid";
import { MarketMovesPanel } from "@/components/market/MarketMovesPanel";
import type { InkTone } from "@/lib/display/ink-tone";
import { companyDetailHref } from "@/lib/market/company-detail-href";
import { IndexScoreboard } from "@/components/market/IndexScoreboard";
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
  subtitle = "",
  uniformTiles = true,
  tileSubtitle,
  sessionLabel = null,
}: {
  markets: PulseGlobalMarket[];
  title: string;
  subtitle?: string;
  uniformTiles?: boolean;
  /** Override tile subtitle (default: ticker). */
  tileSubtitle?: (market: PulseGlobalMarket) => string;
  /** Watchlist/Trending session chip — Pre-Market / After Hours when extended hours are live. */
  sessionLabel?: string | null;
}) {
  if (markets.length === 0) return null;
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
            <span className="stock-heat-session ink-chip ink-chip--amber" aria-label={`${sessionLabel} session`}>
              <i className="stock-heat-session-dot" aria-hidden="true" />
              {sessionLabel}
            </span>
          ) : null}
        </div>
        {subtitle.trim() ? <p className="market-heatmap-subtitle">{subtitle}</p> : null}
      </div>
      <HeatmapGrid
        className={[
          "market-heatmap",
          uniformTiles ? "market-heatmap--uniform" : markets.length <= 3 ? "compact" : null,
        ].filter(Boolean).join(" ")}
        count={markets.length}
      >
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
              showLiveDot={false}
            />
          );
        })}
      </HeatmapGrid>
    </section>
  );
}

function sectorsToMarkets(sectors: PulseSector[]): PulseGlobalMarket[] {
  return sectors.map((sector) => ({
    ticker: sector.ticker,
    name: sector.name,
    changePercent: sector.changePercent,
    price: sector.price,
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

  const marketsByCategory = (category: string) =>
    data?.globalMarkets.filter((market) => market.category === category) ?? [];
  const majorIndexes = marketsByCategory("Major Index");
  const commodities = marketsByCategory("Commodity");
  const cryptoMarkets = marketsByCategory("Crypto");
  const internationalMarkets = marketsByCategory("International");
  const industryMarkets = sectorsToMarkets(data?.sectors ?? []);

  return (
    <main className="markets-page pulse-page">
      <h1 className="sr-only">Pulse</h1>
      <ViewSwitcher
        label="Choose a Pulse view"
        options={[...PULSE_TABS]}
        activeId={activeTab}
        onChange={(id) => setActiveTab(id as PulseTab)}
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
            <IndexScoreboard
              markets={majorIndexes}
              sessionLabel={data.sessionLabel}
            />
            <div id="industries">
              <GlobalMarketsHeatmap
                markets={industryMarkets}
                title="Sectors"
                uniformTiles
                sessionLabel={data.sessionLabel}
              />
            </div>

            <div className="pulse-more-markets" aria-label="More markets">
              <p className="pulse-more-markets-label">More markets</p>
              <GlobalMarketsHeatmap
                markets={commodities}
                title="Commodities"
                uniformTiles
              />
              <GlobalMarketsHeatmap
                markets={cryptoMarkets}
                title="Crypto"
                uniformTiles
              />
              <GlobalMarketsHeatmap
                markets={internationalMarkets}
                title="International"
                uniformTiles
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
