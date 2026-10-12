"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PulseData } from "@/app/api/market/pulse/route";
import { PageLoadingMotion } from "@/components/PageLoadingMotion";
import { IndexScoreboard } from "@/components/market/IndexScoreboard";

/**
 * Compact DIA/SPY/QQQ/IWM strip on Home — not a second Pulse.
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
    <section
      className="pulse-home-section home-market-strip"
      aria-labelledby="home-market-strip-heading"
    >
      <header className="pulse-home-section-head">
        <div>
          <p className="pulse-home-eyebrow">
            {data?.sessionLabel ?? "Markets"}
            {updated ? ` · Updated ${updated}` : ""}
          </p>
          <h2 id="home-market-strip-heading">Market context</h2>
        </div>
        <Link href="/pulse" className="pulse-home-next">
          Open Pulse <span aria-hidden="true">→</span>
        </Link>
      </header>

      {status === "loading" ? (
        <PageLoadingMotion
          label="Loading indexes"
          compact
          showLabel={false}
          showSubtitle={false}
          speed="slow"
        />
      ) : null}
      {status === "error" ? (
        <p className="pulse-home-state">
          Index quotes are temporarily unavailable.
        </p>
      ) : null}
      {status === "ready" && indexes.length === 0 ? (
        <p className="pulse-home-state">No index quotes available right now.</p>
      ) : null}
      {status === "ready" && indexes.length > 0 ? (
        <IndexScoreboard
          markets={indexes}
          sessionLabel={data?.sessionLabel ?? null}
        />
      ) : null}
    </section>
  );
}
