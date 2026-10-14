"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PulseData, PulseGlobalMarket, PulseSector } from "@/app/api/market/pulse/route";
import { fetchJsonWithTimeout } from "@/app/components/evidence-request";
import { PageLoadingMotion } from "@/components/PageLoadingMotion";
import {
  CommodityScoreboard,
  IndexScoreboard,
  SectorScoreboard,
} from "@/components/market/IndexScoreboard";
import { PulseMacroGauges } from "@/components/market/PulseMacroGauges";

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

/** Bracketed ops eyebrow: `[ 01 / REGIME ]` with status ticks. */
function HomeSectionCoord({
  code,
  label,
  meta,
}: {
  code: string;
  label: string;
  meta?: string | null;
}) {
  return (
    <p className="pulse-home-eyebrow home-section-coord">
      <span className="home-coord-mark" aria-hidden="true">
        [
      </span>
      <span className="home-coord-code">{code}</span>
      <span className="home-coord-sep" aria-hidden="true">
        /
      </span>
      <span className="home-coord-label">{label}</span>
      {meta ? (
        <>
          <span className="home-coord-dot" aria-hidden="true">
            ·
          </span>
          <span className="home-coord-meta tnum">{meta}</span>
        </>
      ) : null}
      <span className="home-coord-mark" aria-hidden="true">
        ]
      </span>
      <i className="home-coord-ticks" aria-hidden="true" />
    </p>
  );
}

/**
 * Home market telemetry: VIX/10Y, major indexes, commodities, US sectors.
 * Personal holdings never appear here — Portfolio owns that. Full Movers /
 * Crypto / Intl live on /pulse.
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
        const payload = await fetchJsonWithTimeout<PulseData>(
          "/api/market/pulse",
          10000,
          controller.signal,
        );
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
    const refreshVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
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
    data?.globalMarkets.filter((market) => market.category === "Major Index") ?? [];
  const commodities =
    data?.globalMarkets.filter((market) => market.category === "Commodity") ?? [];
  const sectors = sectorsToMarkets(data?.sectors ?? []);
  const updated = data?.fetchedAt
    ? new Date(data.fetchedAt).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  const linkStatus =
    status === "ready" || data != null
      ? "live"
      : status === "loading"
        ? "sync"
        : "offline";

  return (
    <div className="home-market-strip home-mission-hud" data-link={linkStatus}>
      <div className="home-mission-rail" aria-hidden="true" />
      <header className="home-mission-hero">
        <p className="pulse-product-label">
          <span className={`home-live-dot home-live-dot--${linkStatus}`} aria-hidden="true" />
          IQBulls / Market telemetry
        </p>
        <div className="home-mission-title-row">
          <p className="home-mission-display">The tape. In focus.</p>
          <p className="pulse-seo-lede">
            Macro regime, major indexes, commodities, and sector leadership — public market
            context only. Your holdings and watchlist live on Portfolio.
          </p>
        </div>
        <div className="home-mission-status" role="status">
          <p className="home-mission-status-label">
            {linkStatus === "live"
              ? "Market link active"
              : linkStatus === "sync"
                ? "Syncing market link"
                : "Market link offline"}
          </p>
          {updated ? (
            <p className="home-mission-status-meta tnum">Snap {updated}</p>
          ) : null}
          {data?.sessionLabel ? (
            <p className="home-mission-status-meta">{data.sessionLabel}</p>
          ) : null}
          <Link href="/pulse" className="home-pulse-link">
            Open full Pulse ↗
          </Link>
        </div>
      </header>

      {status === "loading" && data == null ? (
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
          <p>
            {data
              ? "Market refresh failed. Showing the last successful snapshot below."
              : "Market context is temporarily unavailable."}
          </p>
          <button type="button" onClick={() => setRetry((value) => value + 1)}>
            Retry market data
          </button>
        </div>
      ) : null}

      {data != null ? (
        <section
          className="pulse-home-section home-macro-gauges"
          aria-labelledby="home-macro-gauges-heading"
        >
          <header className="pulse-home-section-head">
            <div>
              <HomeSectionCoord code="01" label="Regime" />
              <h2 id="home-macro-gauges-heading">VIX &amp; 10Y</h2>
            </div>
          </header>
          <PulseMacroGauges indicators={data.indicators ?? []} showShareTools={false} />
        </section>
      ) : null}

      <section
        className="pulse-home-section home-market-indexes"
        aria-labelledby="home-market-strip-heading"
      >
        <header className="pulse-home-section-head">
          <div>
            <HomeSectionCoord
              code="02"
              label={data?.sessionLabel ?? "Markets"}
              meta={updated ? `SNAP ${updated}` : null}
            />
            <h2 id="home-market-strip-heading">Major indexes</h2>
          </div>
          <Link href="/pulse" className="pulse-home-next">
            Markets · Movers · Crypto · Intl <span aria-hidden="true">→</span>
          </Link>
        </header>

        {data != null && indexes.length > 0 ? (
          <IndexScoreboard
            hideHeading
            markets={indexes}
            sessionLabel={data.sessionLabel ?? null}
          />
        ) : null}
        {data != null && indexes.length === 0 ? (
          <p className="pulse-home-state">No index quotes available right now.</p>
        ) : null}
      </section>

      {data != null && commodities.length > 0 ? (
        <section
          className="pulse-home-section home-market-commodities"
          aria-labelledby="home-commodities-heading"
        >
          <header className="pulse-home-section-head">
            <div>
              <HomeSectionCoord code="03" label="Cross-asset" />
              <h2 id="home-commodities-heading">Commodities</h2>
            </div>
          </header>
          <CommodityScoreboard markets={commodities} hideHeading />
        </section>
      ) : null}

      {data != null && sectors.length > 0 ? (
        <section
          className="pulse-home-section home-market-sectors"
          aria-labelledby="home-sectors-heading"
        >
          <header className="pulse-home-section-head">
            <div>
              <HomeSectionCoord code="04" label="Leadership" />
              <h2 id="home-sectors-heading">US sectors</h2>
            </div>
            <Link href="/pulse" className="pulse-home-next">
              Open Pulse <span aria-hidden="true">→</span>
            </Link>
          </header>
          <SectorScoreboard
            hideHeading
            markets={sectors}
            sessionLabel={data.sessionLabel ?? null}
          />
        </section>
      ) : null}
    </div>
  );
}
