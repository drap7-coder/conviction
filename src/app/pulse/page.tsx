"use client";

import { Suspense, useEffect, useState } from "react";
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

type PulseView = "markets" | "movers" | "commodities" | "international" | "crypto";

const PULSE_VIEWS: SurfaceSlicerOption[] = [
  { id: "markets", label: "Markets" },
  { id: "movers", label: "Movers" },
  { id: "commodities", label: "Commodities" },
  { id: "international", label: "Intl" },
  { id: "crypto", label: "Crypto" },
];

function parsePulseView(value: string | null | undefined): PulseView {
  if (value === "movers" || value === "commodities" || value === "international" || value === "crypto") {
    return value;
  }
  // Legacy `?view=sectors` bookmarks land on Markets (indexes + sectors).
  return "markets";
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
    regularPrice: sector.price,
    regularChange: sector.change ?? null,
    regularChangePercent: sector.changePercent,
  }));
}

function pulseHeading(view: PulseView): string {
  if (view === "movers") return "Market Movers";
  if (view === "commodities") return "Commodities";
  if (view === "international") return "International";
  if (view === "crypto") return "Crypto";
  return "Pulse";
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

  useEffect(() => {
    let cancelled = false;
    fetch("/api/market/pulse")
      .then((response) => {
        if (!response.ok) throw new Error("Market data unavailable");
        return response.json() as Promise<PulseData>;
      })
      .then((payload) => {
        if (!cancelled) {
          setData(payload);
          setStatus("success");
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
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
    <main className="markets-page pulse-page">
      <h1 className="sr-only">{pulseHeading(view)}</h1>

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

      {data && view === "markets" ? (
        <>
          <PulseMacroGauges indicators={data.indicators} />
          <IndexScoreboard
            markets={majorIndexes}
            sessionLabel={data.sessionLabel}
          />
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

      {data && view === "commodities" ? (
        <CommodityScoreboard markets={commodities} />
      ) : null}

      {data && view === "international" ? (
        <InternationalScoreboard markets={internationalMarkets} />
      ) : null}

      {data && view === "crypto" ? (
        <CryptoBoard markets={cryptoMarkets} />
      ) : null}
    </main>
  );
}

export default function MarketPulsePage() {
  return (
    <Suspense
      fallback={(
        <main className="markets-page pulse-page">
          <h1 className="sr-only">Pulse</h1>
          <PageLoadingMotion
            label="Loading pulse"
            compact
            showLabel={false}
            showSubtitle={false}
            speed="slow"
          />
        </main>
      )}
    >
      <PulsePageInner />
    </Suspense>
  );
}
