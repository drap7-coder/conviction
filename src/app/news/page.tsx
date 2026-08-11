"use client";

import { useEffect, useMemo, useState } from "react";
import { PageLoadingMotion } from "@/components/PageLoadingMotion";
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

  if (status === "loading") return <PageLoadingMotion label="Loading news intelligence" />;
  if (status === "error" || !data || !brief) {
    return (
      <main className="markets-page news-page">
        <div className="market-empty">News intelligence is temporarily unavailable.</div>
      </main>
    );
  }

  return (
    <main className="markets-page news-page">
      <section className="product-stage product-stage--news" aria-label="News intelligence">
        <div className="product-stage-copy">
          <span className="product-stage-eyebrow">
            <i aria-hidden="true" /> News · {brief.statusLabel}
          </span>
          <h1>What changed. Why it matters.</h1>
          <p>
            A ranked market brief built around the stories with the clearest investing consequence—not a firehose of headlines.
          </p>
        </div>
        <div className="product-stage-metrics product-stage-metrics--text" aria-label="News coverage readings">
          <div>
            <strong>{brief.leadTheme}</strong>
            <span>Lead narrative</span>
          </div>
          <div>
            <strong>{brief.activeNarratives}</strong>
            <span>Active themes</span>
          </div>
          <div>
            <strong>{brief.storyCount}</strong>
            <span>Ranked stories</span>
          </div>
        </div>
      </section>

      <PulseNewsFeed
        themes={data.marketNarratives.themes}
        status={data.marketNarratives.status}
      />
    </main>
  );
}
