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
      <ViewSwitcher
        label="Choose a News view"
        options={[...NEWS_TABS]}
        activeId={activeTab}
        onChange={(id) => setActiveTab(id as NewsTab)}
      >
        <p className="view-switch-context-line">
          {activeTab === "brief"
            ? "The few stories that matter."
            : "Wire by theme. Skip filler."}
        </p>
      </ViewSwitcher>

      <ProductStage
        variant="news"
        aria-label="News intelligence"
        eyebrow={`News · ${brief.statusLabel}`}
        headline={activeTab === "brief" ? "What changed." : "The wire."}
        summary={
          activeTab === "brief"
            ? brief.leadTheme
              ? `Lead: ${brief.leadTheme}. Ranked by consequence.`
              : "Consequence over volume."
            : "Filter when you want depth."
        }
      />

      <div
        id="news-panel-brief"
        role="tabpanel"
        aria-labelledby="news-tab-brief"
        hidden={activeTab !== "brief"}
      >
        {activeTab === "brief" ? (
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
        {activeTab === "headlines" ? (
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
