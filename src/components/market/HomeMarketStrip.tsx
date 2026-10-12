"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PulseData } from "@/app/api/market/pulse/route";
import { PageLoadingMotion } from "@/components/PageLoadingMotion";
import { IndexScoreboard } from "@/components/market/IndexScoreboard";
import { PulseMacroGauges } from "@/components/market/PulseMacroGauges";

/**
 * Home market context: VIX + 10Y above markets, then DIA/SPY/QQQ/IWM.
 * Full Markets / Movers / Crypto / Intl lives at /pulse.
 */
export function HomeMarketStrip() {
  const [data, setData] = useState<PulseData | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch("/api/market/pulse", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("unavailable");
        const payload = (await response.json()) as PulseData;
        if (cancelled) return;
        setData(payload);
        setStatus("ready");
      } catch (error) {
        if (cancelled) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        setStatus("error");
      }
    }
    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const indexes =
    data?.globalMarkets.filter((market) => market.category === "Major Index") ??
    [];
  const updated = data?.fetchedAt
    ? new Date(data.fetchedAt).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="home-market-strip">
      {status === "loading" ? (
        <PageLoadingMotion
          label="Loading market context"
          compact
          showLabel={false}
          showSubtitle={false}
          speed="slow"
        />
      ) : null}
      {status === "error" ? (
        <p className="pulse-home-state">
          Market context is temporarily unavailable.
        </p>
      ) : null}

      {status === "ready" ? (
        <section
          className="pulse-home-section home-macro-gauges"
          aria-labelledby="home-macro-gauges-heading"
        >
          <header className="pulse-home-section-head">
            <div>
              <p className="pulse-home-eyebrow">Regime</p>
              <h2 id="home-macro-gauges-heading">VIX &amp; 10Y</h2>
            </div>
          </header>
          <PulseMacroGauges
            indicators={data?.indicators ?? []}
            showShareTools={false}
          />
        </section>
      ) : null}

      <section
        className="pulse-home-section home-market-indexes"
        aria-labelledby="home-market-strip-heading"
      >
        <header className="pulse-home-section-head">
          <div>
            <p className="pulse-home-eyebrow">
              {data?.sessionLabel ?? "Markets"}
              {updated ? ` · Updated ${updated}` : ""}
            </p>
            <h2 id="home-market-strip-heading">Major indexes</h2>
          </div>
          <Link href="/pulse" className="pulse-home-next">
            Open Pulse <span aria-hidden="true">→</span>
          </Link>
        </header>

        {status === "ready" && indexes.length > 0 ? (
          <IndexScoreboard
            markets={indexes}
            sessionLabel={data?.sessionLabel ?? null}
          />
        ) : null}
        {status === "ready" && indexes.length === 0 ? (
          <p className="pulse-home-state">No index quotes available right now.</p>
        ) : null}
      </section>
    </div>
  );
}
