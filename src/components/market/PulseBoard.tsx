"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { PulseData, PulseGlobalMarket, PulseSector } from "@/lib/market/pulse-data";
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

type PulseView = "markets" | "movers" | "crypto" | "international";

const PULSE_VIEWS: SurfaceSlicerOption[] = [
  { id: "markets", label: "Markets" },
  { id: "movers", label: "Movers" },
  { id: "crypto", label: "Crypto" },
  { id: "international", label: "Intl" },
];

/** Soft refresh cadence — matches quote coordinator TTL; SSR seed keeps first paint instant. */
const PULSE_REFRESH_MS = 5 * 60_000;

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
  if (view === "crypto") return "Crypto";
  if (view === "international") return "International";
  return "Pulse";
}

function PulseBoardInner({
  initialData,
  initialView,
}: {
  initialData: PulseData | null;
  initialView: PulseView;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [view, setView] = useState<PulseView>(() =>
    parsePulseView(searchParams.get("view") ?? initialView),
  );
  const [data, setData] = useState<PulseData | null>(initialData);
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    initialData ? "success" : "loading",
  );

  useEffect(() => {
    setView(parsePulseView(searchParams.get("view")));
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    async function softRefresh() {
      try {
        const response = await fetch("/api/market/pulse");
        if (!response.ok) throw new Error("Market data unavailable");
        const payload = (await response.json()) as PulseData;
        if (!cancelled) {
          setData(payload);
          setStatus("success");
        }
      } catch {
        if (!cancelled && !initialData) setStatus("error");
      }
    }

    // Seeded SSR: refresh in the background. Cold client: fetch now.
    if (!initialData) {
      void softRefresh();
    }

    const onVisibility = () => {
      if (document.visibilityState === "visible") void softRefresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void softRefresh();
    }, PULSE_REFRESH_MS);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(timer);
    };
  }, [initialData]);

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
    </main>
  );
}

export function PulseBoard({
  initialData,
  initialView = "markets",
}: {
  initialData: PulseData | null;
  initialView?: PulseView;
}) {
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
      <PulseBoardInner initialData={initialData} initialView={initialView} />
    </Suspense>
  );
}
