"use client";

import { useEffect, useState } from "react";
import { PageLoadingMotion } from "@/components/PageLoadingMotion";
import { PulseNewsFeed } from "@/components/market/PulseNewsFeed";
import type { MarketNarrativePulse } from "@/lib/market/market-narratives";

interface NewsResponse {
  marketNarratives: MarketNarrativePulse;
  fetchedAt: string;
}

/**
 * News daily view. Category slicer (All + narrative themes) is owned by
 * PulseNewsFeed via shared SurfaceSlicer — horizontal scroll on mobile.
 */
export default function NewsPage() {
  const [data, setData] = useState<NewsResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    fetch("/api/market/news", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("News unavailable");
        return response.json() as Promise<NewsResponse>;
      })
      .then((payload) => {
        if (!cancelled) {
          setData(payload);
          setStatus("success");
        }
      })
      .catch((error: unknown) => {
        if (!cancelled && !(error instanceof DOMException && error.name === "AbortError")) {
          setStatus("error");
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  return (
    <main className="markets-page news-page">
      <h1 className="sr-only">News</h1>

      {status === "loading" ? (
        <PageLoadingMotion
          label="Loading news intelligence"
          compact
          showLabel={false}
          showSubtitle={false}
          speed="slow"
        />
      ) : null}
      {status === "error" || (status === "success" && !data) ? (
        <div className="market-empty">News intelligence is temporarily unavailable.</div>
      ) : null}

      {data ? (
        <PulseNewsFeed
          themes={data.marketNarratives.themes}
          status={data.marketNarratives.status}
          section="all"
        />
      ) : null}
    </main>
  );
}
