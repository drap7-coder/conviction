"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PulseData } from "@/app/api/market/pulse/route";
import { fetchJsonWithTimeout } from "@/app/components/evidence-request";
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

  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    let inFlight = false;
    let lastAttempt = 0;
    async function load() {
      if (inFlight || (lastAttempt && Date.now() - lastAttempt < 60_000)) return;
      inFlight = true;
      lastAttempt = Date.now();
      try {
        const payload = await fetchJsonWithTimeout<PulseData>("/api/market/pulse", 10000, controller.signal);
        if (cancelled) return;
        setData(payload);
        setStatus("ready");
      } catch (error) {
        if (cancelled) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        setStatus("error");
      } finally {
        inFlight = false;
      }
    }
    void load();
    const refreshVisible = () => { if (document.visibilityState === "visible") void load(); };
    const interval = window.setInterval(refreshVisible, 60_000);
    document.addEventListener("visibilitychange", refreshVisible);
    window.addEventListener("focus", refreshVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshVisible);
      window.removeEventListener("focus", refreshVisible);
      cancelled = true;
      controller.abort();
    };
  }, [retry]);

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
        <div className="pulse-home-state" role="status">
          <p>{data ? "Market refresh failed. Showing the last successful snapshot below." : "Market context is temporarily unavailable."}</p>
          <button type="button" onClick={() => setRetry((value) => value + 1)}>Retry market data</button>
        </div>
      ) : null}

      {data != null ? (
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

        {data != null && indexes.length > 0 ? (
          <IndexScoreboard
            hideHeading
            markets={indexes}
            sessionLabel={data?.sessionLabel ?? null}
          />
        ) : null}
        {data != null && indexes.length === 0 ? (
          <p className="pulse-home-state">No index quotes available right now.</p>
        ) : null}
      </section>
    </div>
  );
}
