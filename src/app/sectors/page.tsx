"use client";

import { useEffect, useState } from "react";
import type { PulseData, PulseGlobalMarket, PulseSector } from "@/app/api/market/pulse/route";
import { PageLoadingMotion } from "@/components/PageLoadingMotion";
import { SectorScoreboard } from "@/components/market/IndexScoreboard";

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

export default function SectorsPage() {
  const [data, setData] = useState<PulseData | null>(null);
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

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

  const sectorMarkets = sectorsToMarkets(data?.sectors ?? []);

  return (
    <main className="markets-page sectors-page">
      <h1 className="sr-only">Sectors</h1>

      {status === "loading" ? (
        <PageLoadingMotion
          label="Loading sectors"
          compact
          showLabel={false}
          showSubtitle={false}
          speed="slow"
        />
      ) : null}
      {status === "error" || (status === "success" && !data) ? (
        <div className="market-empty">Market data is temporarily unavailable.</div>
      ) : null}

      {data ? (
        <SectorScoreboard
          markets={sectorMarkets}
          sessionLabel={data.sessionLabel}
        />
      ) : null}
    </main>
  );
}
