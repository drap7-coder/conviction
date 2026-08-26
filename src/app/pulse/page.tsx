"use client";

import { useEffect, useState } from "react";
import type { PulseData } from "@/app/api/market/pulse/route";
import { PageLoadingMotion } from "@/components/PageLoadingMotion";
import { MarketMovesPanel } from "@/components/market/MarketMovesPanel";
import {
  CommodityScoreboard,
  IndexScoreboard,
} from "@/components/market/IndexScoreboard";
import { CryptoBoard } from "@/components/market/CryptoBoard";
import { PulseMacroGauges } from "@/components/market/PulseMacroGauges";

export default function MarketPulsePage() {
  const [data, setData] = useState<PulseData | null>(null);
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

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

  return (
    <main className="markets-page pulse-page">
      <h1 className="sr-only">Pulse</h1>

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

      {data ? (
        <>
          <PulseMacroGauges indicators={data.indicators} />
          <IndexScoreboard
            markets={majorIndexes}
            sessionLabel={data.sessionLabel}
          />
          <section id="market-moves" className="pulse-market-moves" aria-label="Trending stocks">
            <MarketMovesPanel showDecisionCard={false} />
          </section>
          <CommodityScoreboard markets={commodities} />

          <div className="pulse-more-markets" aria-label="More markets">
            <p className="pulse-more-markets-label">More markets</p>
            <CryptoBoard markets={cryptoMarkets} />
          </div>
        </>
      ) : null}
    </main>
  );
}
