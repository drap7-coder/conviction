"use client";

import { useEffect, useMemo, useState } from "react";
import { PageLoadingMotion } from "@/components/PageLoadingMotion";
import { ProductStage } from "@/components/ProductStage";
import { ViewSwitcher } from "@/components/ViewSwitcher";
import { PulseNewsFeed } from "@/components/market/PulseNewsFeed";
import type { MarketNarrativePulse } from "@/lib/market/market-narratives";
import { buildNewsPageBrief } from "@/lib/market/news-brief";

interface NewsResponse {
  marketNarratives: MarketNarrativePulse;
  fetchedAt: string;
}

const NEWS_TABS = [
  {
    id: "brief",
    label: "Brief",
    tabId: "news-tab-brief",
    panelId: "news-panel-brief",
  },
  {
    id: "headlines",
    label: "Headlines",
    tabId: "news-tab-headlines",
    panelId: "news-panel-headlines",
  },
] as const;

type NewsTab = (typeof NEWS_TABS)[number]["id"];

export default function NewsPage() {
  const [data, setData] = useState<NewsResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [activeTab, setActiveTab] = useState<NewsTab>("brief");

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
      <ViewSwitcher
        label="Choose a News view"
        options={[...NEWS_TABS]}
        activeId={activeTab}
        onChange={(id) => setActiveTab(id as NewsTab)}
      />

      <ProductStage
        variant="news"
        aria-label="News intelligence"
        eyebrow={`News · ${brief?.statusLabel ?? (status === "loading" ? "Reading the tape" : "Temporarily unavailable")}`}
        headline={activeTab === "brief" ? "Know what changed." : "The wire."}
        summary={
          activeTab === "brief" && brief?.leadTheme
            ? `Lead: ${brief.leadTheme}.`
            : activeTab === "brief"
              ? "Start with the market brief, then open the evidence behind the story."
              : "Scan the latest market headlines without losing the larger signal."
        }
      />

      {status === "loading" ? <PageLoadingMotion label="Loading news intelligence" compact /> : null}
      {status === "error" || (status === "success" && (!data || !brief)) ? (
        <div className="market-empty">News intelligence is temporarily unavailable.</div>
      ) : null}

      <div
        id="news-panel-brief"
        role="tabpanel"
        aria-labelledby="news-tab-brief"
        hidden={activeTab !== "brief"}
      >
        {activeTab === "brief" && data ? (
          <PulseNewsFeed
            themes={data.marketNarratives.themes}
            status={data.marketNarratives.status}
            section="brief"
          />
        ) : null}
      </div>

      <div
        id="news-panel-headlines"
        role="tabpanel"
        aria-labelledby="news-tab-headlines"
        hidden={activeTab !== "headlines"}
      >
        {activeTab === "headlines" && data ? (
          <PulseNewsFeed
            themes={data.marketNarratives.themes}
            status={data.marketNarratives.status}
            section="headlines"
          />
        ) : null}
      </div>
    </main>
  );
}
