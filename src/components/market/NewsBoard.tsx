"use client";

import { useEffect, useState } from "react";
import { PageLoadingMotion } from "@/components/PageLoadingMotion";
import { PulseNewsFeed } from "@/components/market/PulseNewsFeed";
import type { NewsData } from "@/lib/market/news-data";

/** Soft refresh cadence — matches Pulse / quote TTL. */
const NEWS_REFRESH_MS = 5 * 60_000;

/**
 * News daily view. Category slicer (All + narrative themes) is owned by
 * PulseNewsFeed via shared SurfaceSlicer — horizontal scroll on mobile.
 */
export function NewsBoard({ initialData }: { initialData: NewsData | null }) {
  const [data, setData] = useState<NewsData | null>(initialData);
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    initialData ? "success" : "loading",
  );

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function softRefresh() {
      try {
        const response = await fetch("/api/market/news", { signal: controller.signal });
        if (!response.ok) throw new Error("News unavailable");
        const payload = (await response.json()) as NewsData;
        if (!cancelled) {
          setData(payload);
          setStatus("success");
        }
      } catch (error: unknown) {
        if (
          !cancelled
          && !(error instanceof DOMException && error.name === "AbortError")
          && !initialData
        ) {
          setStatus("error");
        }
      }
    }

    if (!initialData) {
      void softRefresh();
    }

    const onVisibility = () => {
      if (document.visibilityState === "visible") void softRefresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void softRefresh();
    }, NEWS_REFRESH_MS);

    return () => {
      cancelled = true;
      controller.abort();
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(timer);
    };
  }, [initialData]);

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
