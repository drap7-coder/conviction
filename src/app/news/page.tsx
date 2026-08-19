"use client";

import { useEffect, useMemo, useState } from "react";
import { PageLoadingMotion } from "@/components/PageLoadingMotion";
import { ProductStage } from "@/components/ProductStage";
import { PulseNewsFeed } from "@/components/market/PulseNewsFeed";
import type { MarketNarrativePulse } from "@/lib/market/market-narratives";
import { buildNewsPageBrief } from "@/lib/market/news-brief";

interface NewsResponse {
  marketNarratives: MarketNarrativePulse;
  fetchedAt: string;
}

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

  const brief = useMemo(
    () => data
      ? buildNewsPageBrief(data.marketNarratives.themes, data.marketNarratives.status)
      : null,
    [data],
  );

  return (
    <main className="markets-page news-page">
      <ProductStage
        variant="news"
        aria-label="News intelligence"
        eyebrow={`News · ${brief?.statusLabel === "Live" ? "Live data" : brief?.statusLabel ?? (status === "loading" ? "Reading the tape" : "Temporarily unavailable")}`}
        headline={
          brief
            ? `${brief.leadTheme} is today’s lead.`
            : "Today’s market story is still forming."
        }
        summary={
          brief
            ? `${brief.storyCount} recent stories distilled into ${brief.activeNarratives} active market narrative${brief.activeNarratives === 1 ? "" : "s"}. Scroll for the brief, then the wire.`
            : "Start with the market brief, then open the evidence behind the story."
        }
        metrics={
          <>
            <div>
              <strong>{brief?.storyCount ?? "—"}</strong>
              <span>Recent stories</span>
            </div>
            <div className={brief && brief.activeNarratives > 0 ? "is-alert" : undefined}>
              <strong>{brief?.activeNarratives ?? "—"}</strong>
              <span>Active narratives</span>
            </div>
            <div>
              <strong>{brief?.statusLabel ?? "—"}</strong>
              <span>Feed status</span>
            </div>
          </>
        }
      />

      {status === "loading" ? <PageLoadingMotion label="Loading news intelligence" compact /> : null}
      {status === "error" || (status === "success" && (!data || !brief)) ? (
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
