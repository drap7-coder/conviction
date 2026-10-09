"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { PulseData, PulseGlobalMarket, PulseSector } from "@/app/api/market/pulse/route";
import { PageLoadingMotion } from "@/components/PageLoadingMotion";
import { SurfaceSlicer, type SurfaceSlicerOption } from "@/components/SurfaceSlicer";
import { MarketMovesPanel } from "@/components/market/MarketMovesPanel";
import {
  CommodityScoreboard,
  IndexScoreboard,
  InternationalScoreboard,
  SectorScoreboard,
} from "@/components/market/IndexScoreboard";
import { CryptoBoard } from "@/components/market/CryptoBoard";
import { PulseMacroGauges } from "@/components/market/PulseMacroGauges";
import { WorkspaceViewContext } from "@/components/WorkspaceViewContext";
import { trackProductEvent } from "@/lib/product-analytics";
import { activeSessionPercent } from "@/lib/display/active-session";
import { scoreboardIndexes, scoreboardCommodities } from "@/lib/market/index-scoreboard";

type PulseView = "markets" | "movers" | "crypto" | "international";

const PULSE_VIEWS: SurfaceSlicerOption[] = [
  { id: "markets", label: "Markets" },
  { id: "movers", label: "Movers" },
  { id: "crypto", label: "Crypto" },
  { id: "international", label: "Intl" },
];

function parsePulseView(value: string | null | undefined): PulseView {
  if (value === "movers" || value === "crypto" || value === "international") return value;
  // Legacy `?view=sectors` / `?view=commodities` land on Markets.
  return "markets";
}

function sectorsToMarkets(sectors: PulseSector[]): PulseGlobalMarket[] {
  return sectors.map((sector) => ({
    ticker: sector.ticker,
    name: sector.name,
    changePercent: sector.changePercent,
    price: sector.regularPrice ?? sector.price,
    weight: sector.weight,
    category: "Sector",
    history: sector.history ?? [],
    regularPrice: sector.regularPrice ?? sector.price,
    regularChange: sector.regularChange ?? null,
    regularChangePercent: sector.regularChangePercent ?? null,
    extendedPrice: sector.extendedPrice ?? null,
    extendedChange: sector.extendedChange ?? null,
    extendedChangePercent: sector.extendedChangePercent ?? null,
    extendedNoTrades: sector.extendedNoTrades ?? false,
    sessionLabel: sector.sessionLabel ?? null,
  }));
}

const PULSE_REFRESH_MS = 60_000;

function signedPercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function PulseAtAGlance({
  indexes,
  sectors,
  commodities,
}: {
  indexes: PulseGlobalMarket[];
  sectors: PulseGlobalMarket[];
  commodities: PulseGlobalMarket[];
}) {
  const sessionMoves = (markets: PulseGlobalMarket[]) => markets
    .map((market) => ({ ...market, changePercent: activeSessionPercent(market) }))
    .filter((market) => market.changePercent != null);
  const movingIndexes = sessionMoves(scoreboardIndexes(indexes));
  const rising = movingIndexes.filter((market) => (market.changePercent ?? 0) > 0).length;
  const falling = movingIndexes.filter((market) => (market.changePercent ?? 0) < 0).length;
  const leadingSector = sessionMoves(sectors).sort(
    (a, b) => (b.changePercent ?? Number.NEGATIVE_INFINITY) - (a.changePercent ?? Number.NEGATIVE_INFINITY),
  )[0];
  const biggestCommodity = sessionMoves(scoreboardCommodities(commodities)).sort(
    (a, b) => Math.abs(b.changePercent ?? 0) - Math.abs(a.changePercent ?? 0),
  )[0];
  const breadthTone = rising > falling ? "positive" : falling > rising ? "negative" : "neutral";

  return (
    <section className="pulse-glance" aria-labelledby="pulse-glance-heading">
      <div className="pulse-glance-heading">
        <h2 id="pulse-glance-heading" className="sr-only">Current session at a glance</h2>
      </div>
      <div className="pulse-glance-grid">
        <article className={`pulse-glance-item tone-${breadthTone}`}>
          <span>Index direction</span>
          <strong>{movingIndexes.length ? `${rising} of ${movingIndexes.length} indexes rising` : "No session trades yet"}</strong>
          <small>{movingIndexes.length < scoreboardIndexes(indexes).length ? "Available session prints" : "Current session"}</small>
        </article>
        <article className={`pulse-glance-item tone-${leadingSector && (leadingSector.changePercent ?? 0) > 0 ? "positive" : leadingSector && (leadingSector.changePercent ?? 0) < 0 ? "negative" : "neutral"}`}>
          <span>Leading sector</span>
          <strong>{leadingSector ? `${leadingSector.name} ${signedPercent(leadingSector.changePercent)}` : "No session trades yet"}</strong>
          <small>Strongest available move</small>
        </article>
        <article className="pulse-glance-item tone-amber">
          <span>Largest commodity move</span>
          <strong>{biggestCommodity ? `${biggestCommodity.name} ${signedPercent(biggestCommodity.changePercent)}` : "No session trades yet"}</strong>
          <small>By absolute session change</small>
        </article>
      </div>
    </section>
  );
}

function PulseViewContext({ view, data }: { view: PulseView; data: PulseData | null }) {
  const updated = data?.fetchedAt
    ? new Date(data.fetchedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : null;
  let context: { kicker: string; title: string; detail: string; tone: PulseView };
  switch (view) {
    case "markets":
      context = {
        kicker: data?.sessionLabel ?? "Regular Market",
        title: data?.sessionLabel === "Pre-Market" ? "Before the bell" : data?.sessionLabel === "After Hours" ? "After the bell" : "The market now",
        detail: data?.sessionLabel ? "Session moves · Previous close below each quote" : "Prices and moves for the regular session",
        tone: "markets",
      };
      break;
    case "movers":
      context = { kicker: "Action", title: "Leaders, laggards & volume", detail: "See where attention and price are moving fastest.", tone: "movers" };
      break;
    case "crypto":
      context = { kicker: "24 / 7", title: "Always-on markets", detail: "A quick read on the largest digital assets in the mix.", tone: "crypto" };
      break;
    default:
      context = { kicker: "Global lens", title: "Markets around the world", detail: "Country funds offer one comparable view across different local sessions.", tone: "international" };
  }

  return <WorkspaceViewContext {...context} meta={updated && context.tone === "markets" ? <time dateTime={data?.fetchedAt}>Updated {updated}</time> : undefined} />;
}


function PulsePageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [view, setView] = useState<PulseView>(() => parsePulseView(searchParams.get("view")));
  const [data, setData] = useState<PulseData | null>(null);
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    setView(parsePulseView(searchParams.get("view")));
  }, [searchParams]);

  const moversTracked = useRef(false);
  useEffect(() => {
    if (view === "movers" && !moversTracked.current) {
      moversTracked.current = true;
      trackProductEvent("movers_opened");
    } else if (view !== "movers") moversTracked.current = false;
  }, [view, moversTracked]);

  useEffect(() => {
    let cancelled = false;
    let controller: AbortController | null = null;
    async function load() {
      controller?.abort();
      controller = new AbortController();
      try {
        const response = await fetch("/api/market/pulse", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Market data unavailable");
        const payload = await response.json() as PulseData;
        if (!cancelled) {
          setData(payload);
          setStatus("success");
        }
      } catch (error) {
        if (!cancelled && !(error instanceof DOMException && error.name === "AbortError")) setStatus("error");
      }
    }
    void load();
    const interval = window.setInterval(() => void load(), PULSE_REFRESH_MS);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("focus", refreshWhenVisible);
    return () => {
      cancelled = true;
      controller?.abort();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("focus", refreshWhenVisible);
    };
  }, []);

  function selectView(next: PulseView) {
    setView(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next === "markets") params.delete("view");
    else params.set("view", next);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  const marketsByCategory = (category: string) =>
    data?.globalMarkets.filter((market) => market.category === category) ?? [];
  const majorIndexes = marketsByCategory("Major Index");
  const commodities = marketsByCategory("Commodity");
  const cryptoMarkets = marketsByCategory("Crypto");
  const internationalMarkets = marketsByCategory("International");
  const sectorMarkets = sectorsToMarkets(data?.sectors ?? []);

  return (
    <div className="pulse-dashboard">
      <SurfaceSlicer
        label="Pulse market view"
        options={PULSE_VIEWS}
        activeId={view}
        onChange={(id) => selectView(parsePulseView(id))}
        className="pulse-view-slicer"
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

      {status !== "loading" ? <PulseViewContext view={view} data={data} /> : null}

      {data && view === "markets" ? (
        <>
          <PulseAtAGlance
            indexes={majorIndexes}
            sectors={sectorMarkets}
            commodities={commodities}
          />
          <PulseMacroGauges indicators={data.indicators} />
          <IndexScoreboard
            markets={majorIndexes}
            sessionLabel={data.sessionLabel}
          />
          <CommodityScoreboard markets={commodities} />
          <SectorScoreboard
            markets={sectorMarkets}
            sessionLabel={data.sessionLabel}
          />
        </>
      ) : null}

      {view === "movers" && status !== "loading" ? (
        <section id="market-moves" className="pulse-market-moves" aria-label="Market movers">
          <MarketMovesPanel />
        </section>
      ) : null}

      {data && view === "crypto" ? (
        <CryptoBoard markets={cryptoMarkets} />
      ) : null}

      {data && view === "international" ? (
        <InternationalScoreboard markets={internationalMarkets} />
      ) : null}
    </div>
  );
}

export function PulseDashboard() {
  return (
    <Suspense
      fallback={(
        <div className="pulse-dashboard">
<PageLoadingMotion
            label="Loading pulse"
            compact
            showLabel={false}
            showSubtitle={false}
            speed="slow"
          />
        </div>
      )}
    >
      <PulsePageInner />
    </Suspense>
  );
}
