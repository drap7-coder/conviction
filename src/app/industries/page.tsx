"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchJsonWithTimeout, type EvidenceStatus } from "@/app/components/evidence-request";
import { LogoDisplay } from "@/app/components/LogoDisplay";
import { getLivePrice } from "@/lib/market/live-quote";
import { PageLoadingMotion } from "@/components/PageLoadingMotion";

interface StockHistoryPoint {
  date: string;
  close: number;
}

interface SectorCard {
  ticker: string;
  name: string;
  description: string;
  representativeTickers: string[];
  quote: {
    price: number | null;
    change: number | null;
    changePercent: number | null;
    marketState: string | null;
    preMarketPrice: number | null;
    preMarketChange: number | null;
    preMarketChangePercent: number | null;
    postMarketPrice: number | null;
    postMarketChange: number | null;
    postMarketChangePercent: number | null;
  } | null;
  sparkline: StockHistoryPoint[];
  representativeQuotes: Array<{
    ticker: string;
    price: number | null;
    change: number | null;
    changePercent: number | null;
  }>;
}

interface IndustriesResponse {
  sectors: SectorCard[];
  fetchedAt: string;
}

const SECTOR_WEIGHTS: Record<string, number> = {
  XLK: 29.8,
  XLF: 14.2,
  XLV: 11.1,
  XLY: 10.3,
  XLC: 9.4,
  XLI: 8.7,
  XLP: 5.6,
  XLE: 3.1,
  XLU: 2.5,
  XLRE: 2.1,
  XLB: 2.0,
};

const HEATMAP_SPANS = { largeWeight: 15, mediumWeight: 8 };

function sectorMove(sector: SectorCard): number | null {
  if (!sector.quote) return null;
  return getLivePrice(sector.quote).changePercent;
}

function fmtPct(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function tileSpan(weight: number): number {
  if (weight > HEATMAP_SPANS.largeWeight) return 3;
  if (weight > HEATMAP_SPANS.mediumWeight) return 2;
  return 1;
}

function heatColor(change: number | null, maxAbs: number): string {
  if (change === null || !Number.isFinite(change) || maxAbs === 0) return "hsl(220 5% 22%)";
  const magnitude = Math.min(Math.abs(change) / maxAbs, 1);
  const hue = change >= 0 ? 150 : 0;
  return `hsl(${hue} ${44 + magnitude * 30}% ${16 + magnitude * 17}%)`;
}

function buildSparklinePath(points: StockHistoryPoint[]) {
  if (points.length < 2) return "";
  const width = 320;
  const height = 96;
  const padding = 6;
  const closes = points.map((point) => point.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const spread = max - min || 1;
  return points.map((point, index) => {
    const x = padding + (index / (points.length - 1)) * (width - padding * 2);
    const y = padding + ((max - point.close) / spread) * (height - padding * 2);
    return (index === 0 ? "M" : "L") + " " + x.toFixed(2) + " " + y.toFixed(2);
  }).join(" ");
}

export default function IndustriesPage() {
  const [sectors, setSectors] = useState<SectorCard[]>([]);
  const [status, setStatus] = useState<EvidenceStatus>("idle");
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      setStatus("loading");
      try {
        const data = await fetchJsonWithTimeout<IndustriesResponse>(
          "/api/market/industries",
          15_000,
          controller.signal,
        );
        if (!cancelled) {
          setSectors(data.sectors);
          setSelectedTicker(data.sectors[0]?.ticker ?? null);
          setStatus(data.sectors.length > 0 ? "success" : "empty");
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    void load();
    return () => { cancelled = true; controller.abort(); };
  }, []);

  const selectedSector = sectors.find((sector) => sector.ticker === selectedTicker) ?? sectors[0] ?? null;
  const maxSectorMove = Math.max(...sectors.map((sector) => Math.abs(sectorMove(sector) ?? 0)), 0);

  return (
    <div>
      {status === "success" && sectors.length > 0 ? (
        <section className="industries-heat-panel" aria-label="Sector leadership heatmap" aria-description="Tile size reflects S&amp;P 500 weight; color reflects the current market move.">
          <style>{`
            .industries-heat-panel { margin:0 0 20px; padding:20px; background:#111214; border:1px solid #26282c; border-radius:12px; color:#f4f4f5; font-family:var(--font-mono); }
            .industries-heat-title { margin:0; font-size:.78rem; letter-spacing:.09em; text-transform:uppercase; }
            .industries-heat-subtitle { margin:6px 0 0; color:#8b8f97; font-size:.66rem; line-height:1.45; }
            .industries-heat-detail { min-height:28px; display:flex; align-items:center; flex-wrap:wrap; gap:7px 12px; margin:13px 0 9px; color:#8b8f97; font-size:.66rem; }
            .industries-heat-detail > span:first-child { color:#f4f4f5; }
            .industries-heat-detail b.positive { color:#4ade80; }.industries-heat-detail b.negative { color:#f87171; }
            .industries-heat-detail a { margin-left:auto; color:#2dd4bf; text-decoration:none; }
            .industries-heat-grid { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); grid-auto-flow:dense; gap:6px; }
            .industries-heat-tile { min-width:0; min-height:66px; padding:10px; border:1px solid rgba(244,244,245,.09); border-radius:8px; color:#f4f4f5; font:inherit; text-align:left; cursor:pointer; transition:filter .15s,border-color .15s,transform .15s; }
            .industries-heat-tile:hover,.industries-heat-tile:focus-visible { filter:brightness(1.16); outline:none; transform:translateY(-1px); }
            .industries-heat-tile.selected { border-color:rgba(244,244,245,.5); }
            .industries-heat-tile span { display:block; overflow:hidden; font-size:.63rem; font-weight:700; line-height:1.2; }
            .industries-heat-tile strong { display:block; margin-top:6px; font-size:.78rem; }
            @media (max-width:399px) { .industries-heat-panel { padding:16px 14px; }.industries-heat-grid { grid-template-columns:repeat(4,minmax(0,1fr)); }.industries-heat-tile { min-height:62px; padding:8px; }.industries-heat-detail a { width:100%; margin-left:0; } }
          `}</style>
          <h2 className="industries-heat-title">Sector Leadership</h2>
          <div className="industries-heat-detail" aria-live="polite">
            {selectedSector ? (
              <>
                <span>{selectedSector.name}</span>
                <b className={(sectorMove(selectedSector) ?? 0) >= 0 ? "positive" : "negative"}>{fmtPct(sectorMove(selectedSector))}</b>
                <span>{(SECTOR_WEIGHTS[selectedSector.ticker] ?? 0).toFixed(1)}% weight</span>
                <Link href={`/industries/${selectedSector.ticker}`}>Open sector →</Link>
              </>
            ) : <span>Hover or tap a sector</span>}
          </div>
          <div className="industries-heat-grid">
            {sectors.map((sector) => {
              const weight = SECTOR_WEIGHTS[sector.ticker] ?? 0;
              const change = sectorMove(sector);
              const span = tileSpan(weight);
              return (
                <button
                  key={sector.ticker}
                  type="button"
                  className={`industries-heat-tile${selectedSector?.ticker === sector.ticker ? " selected" : ""}`}
                  style={{ gridColumn: `span ${span} / span ${span}`, background: heatColor(change, maxSectorMove) }}
                  onMouseEnter={() => setSelectedTicker(sector.ticker)}
                  onFocus={() => setSelectedTicker(sector.ticker)}
                  onClick={() => setSelectedTicker(sector.ticker)}
                  aria-label={`${sector.name}, ${fmtPct(change)}, ${weight.toFixed(1)} percent index weight`}
                >
                  <span>{sector.name}</span>
                  <strong>{fmtPct(change)}</strong>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="industries-section" aria-label="S&P industry sectors">
        {status === "loading" || status === "idle" ? (
          <PageLoadingMotion label="Loading sector leadership" />
        ) : status === "error" || sectors.length === 0 ? (
          <div className="empty-state">
            <p>Sector data is temporarily unavailable.</p>
            <small>Market data provider may be rate-limited. Retry in a moment.</small>
          </div>
        ) : (
          <div className="watchlist-list">
            {sectors.map((sector) => {
              const quote = sector.quote;
              const live = quote ? getLivePrice(quote) : null;
              const livePrice = live?.price ?? null;
              const liveChange = live?.change ?? null;
              const liveChangePct = live?.changePercent ?? null;
              const sessionLabel = live?.label ?? null;
              const quoteDirection = !liveChange
                ? "neutral"
                : liveChange > 0
                  ? "positive"
                  : "negative";
              const sparklinePath = buildSparklinePath(sector.sparkline);
              const arrow = liveChange !== null
                ? (liveChange > 0 ? "▲" : liveChange < 0 ? "▼" : null)
                : null;
              const arrowClass = liveChange !== null && liveChange > 0 ? "up" : liveChange !== null && liveChange < 0 ? "down" : "";
              return (
                <div key={sector.ticker} className="terminal-card-wrap group">
                  <Link
                    href={"/industries/" + sector.ticker}
                    className="watchlist-row"
                  >
                    <div className="watchlist-row-main">
                      <div className="watchlist-row-company">
                        <LogoDisplay ticker={sector.ticker} size="card" />
                        <div>
                          <strong className="watchlist-row-ticker">{sector.ticker}</strong>
                          <span className="watchlist-row-name">{sector.name}</span>
                        </div>
                      </div>
                      <div className="watchlist-row-move">
                        <span className="watchlist-row-period">{sessionLabel ?? "Today"}</span>
                        <span className="watchlist-row-move-amounts">
                          <strong>
                            {arrow ? <span className={`watchlist-row-arrow ${arrowClass}`}>{arrow} </span> : null}
                            {livePrice != null ? `$${livePrice.toLocaleString(undefined, { maximumFractionDigits: livePrice >= 100 ? 2 : 3, minimumFractionDigits: livePrice >= 1 ? 2 : 3 })}` : "—"}
                          </strong>
                          <span className={"watchlist-row-change " + (liveChange !== null && liveChange > 0 ? "positive" : liveChange !== null && liveChange < 0 ? "negative" : "neutral")}>
                            {liveChange != null && liveChangePct != null
                              ? `${liveChange > 0 ? "+" : ""}$${Math.abs(liveChange).toFixed(2)} · ${liveChangePct > 0 ? "+" : ""}${liveChangePct.toFixed(2)}%`
                              : "—"}
                          </span>
                        </span>
                        {sessionLabel && quote?.price !== null && (
                          <span className="watchlist-row-session">
                            <span className="watchlist-row-session-label">At Close · Today</span>
                            <span className="watchlist-row-session-price">${quote?.price != null ? quote.price.toLocaleString(undefined, { maximumFractionDigits: quote.price >= 100 ? 2 : 3, minimumFractionDigits: quote.price >= 1 ? 2 : 3 }) : "—"}</span>
                            {quote?.changePercent != null ? (
                              <span className={`watchlist-row-session-change ${quote?.change !== null && quote.change > 0 ? "positive" : quote?.change !== null && quote.change < 0 ? "negative" : ""}`}>
                                {quote.changePercent > 0 ? "+" : ""}{quote.changePercent.toFixed(2)}%
                              </span>
                            ) : null}
                          </span>
                        )}
                      </div>
                      <span className="watchlist-row-state watchlist-row-state-quiet">Sector ETF</span>
                    </div>

                    {sparklinePath ? (
                      <div className={"watchlist-row-chart price-chart " + quoteDirection} aria-label={sector.ticker + " intraday chart"}>
                        <svg aria-hidden="true" preserveAspectRatio="none" viewBox="0 0 320 96">
                          <path className="price-chart-glow" d={sparklinePath} />
                          <path className="price-chart-line" d={sparklinePath} />
                        </svg>
                        <span>Today</span>
                      </div>
                    ) : null}

                    {sector.description ? (
                      <section className="news-driver-brief news-driver-brief-compact" aria-label={`${sector.ticker} sector story`}>
                        <div className="news-driver-heading">
                          <span className="news-driver-eyebrow">The story</span>
                          <span className="news-driver-horizon">Sector overview</span>
                        </div>
                        <p className="news-driver-copy">{sector.description}</p>
                      </section>
                    ) : null}

                    <div className="watchlist-row-evidence">
                      <span className="watchlist-row-evidence-item"><b>Leaders</b> · {sector.representativeTickers.slice(0, 4).join(", ")}</span>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
