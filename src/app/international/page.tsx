"use client";

import { useEffect, useState } from "react";
import type { PulseData } from "@/app/api/market/pulse/route";
import { PageLoadingMotion } from "@/components/PageLoadingMotion";
import { InternationalScoreboard } from "@/components/market/IndexScoreboard";

export default function InternationalPage() {
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

  const internationalMarkets =
    data?.globalMarkets.filter((market) => market.category === "International") ?? [];

  return (
    <main className="markets-page international-page">
      <h1 className="sr-only">International</h1>

      {status === "loading" ? (
        <PageLoadingMotion
          label="Loading international markets"
          compact
          showLabel={false}
          showSubtitle={false}
          speed="slow"
        />
      ) : null}
      {status === "error" || (status === "success" && !data) ? (
        <div className="market-empty">Market data is temporarily unavailable.</div>
      ) : null}

      {data ? <InternationalScoreboard markets={internationalMarkets} /> : null}
    </main>
  );
}
