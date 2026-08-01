"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fetchJsonWithTimeout } from "@/app/components/evidence-request";
import { SignalBlock } from "@/components/display/SignalBlock";
import { deriveTodayCatalyst } from "@/lib/evidence/today-catalyst";
import type { NewsDriver } from "@/lib/evidence/news-driver";
import { isFiniteNumber } from "@/lib/display/format";

export type PortfolioDriverHolding = {
  ticker: string;
  companyName?: string | null;
  changePercent?: number | null;
  /** Dollar day P&L — used to rank which names are driving the book */
  dailyChange?: number | null;
};

type Headline = {
  headline: string;
  url: string | null;
  date: string;
};

type NewsItem = {
  driver: NewsDriver | null;
  headlines: Headline[];
};

function newestDate(headlines: Headline[]): string | null {
  if (headlines.length === 0) return null;
  const sorted = [...headlines].sort((a, b) => b.date.localeCompare(a.date));
  const raw = sorted[0]?.date;
  if (!raw) return null;
  const d = new Date(`${raw}T12:00:00`);
  if (!Number.isFinite(d.getTime())) return raw;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatMove(changePercent: number | null | undefined): string | null {
  if (!isFiniteNumber(changePercent)) return null;
  return `${changePercent > 0 ? "+" : ""}${changePercent.toFixed(1)}% today`;
}

/**
 * What’s driving the move — same news-batch wiring as Watchlist / Trending,
 * scoped to portfolio holdings and shown in the heatmap shell carousel.
 */
export function PortfolioDriversPanel({ holdings }: { holdings: PortfolioDriverHolding[] }) {
  const [newsByTicker, setNewsByTicker] = useState<Record<string, NewsItem>>({});
  const [loaded, setLoaded] = useState(false);

  const tickerKey = holdings.map((h) => h.ticker.toUpperCase()).join(",");

  useEffect(() => {
    if (!tickerKey) {
      setNewsByTicker({});
      setLoaded(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const tickers = tickerKey.split(",").filter(Boolean);

    async function loadNews() {
      const batches = Array.from(
        { length: Math.ceil(tickers.length / 10) },
        (_, index) => tickers.slice(index * 10, index * 10 + 10),
      );
      const responses = await Promise.all(
        batches.map((batch) =>
          fetchJsonWithTimeout<{
            news?: Record<string, { headlines?: Headline[]; driver?: NewsDriver | null }>;
          }>(
            `/api/evidence/news-batch?tickers=${batch.join(",")}`,
            10_000,
            controller.signal,
          ).catch(() => ({ news: {} })),
        ),
      );
      if (cancelled) return;

      const next: Record<string, NewsItem> = {};
      for (const response of responses) {
        const news = response.news as
          | Record<string, { headlines?: Headline[]; driver?: NewsDriver | null }>
          | undefined;
        for (const [ticker, item] of Object.entries(news ?? {})) {
          next[ticker.toUpperCase()] = {
            driver: item.driver ?? null,
            headlines: item.headlines ?? [],
          };
        }
      }
      setNewsByTicker(next);
      setLoaded(true);
    }

    void loadNews();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [tickerKey]);

  const ranked = useMemo(() => {
    return [...holdings]
      .map((holding) => {
        const ticker = holding.ticker.toUpperCase();
        const news = newsByTicker[ticker];
        return {
          ...holding,
          ticker,
          news,
          rank: Math.abs(holding.dailyChange ?? 0) || Math.abs(holding.changePercent ?? 0),
        };
      })
      .sort((a, b) => b.rank - a.rank)
      .slice(0, 8);
  }, [holdings, newsByTicker]);

  if (holdings.length === 0) return null;

  return (
    <section className="bcn-module stock-heat-drivers" aria-label="What’s driving the move">
      <div className="bcn-header">
        <span className="bcn-eyebrow">News</span>
        <h2 className="bcn-title">What’s driving the move</h2>
        <p className="bcn-lede">
          Headlines and themes behind your holdings’ session moves.
        </p>
      </div>
      <div
        className="bcn-list"
        role="region"
        aria-roledescription="carousel"
        aria-label="What’s driving the move cards"
        tabIndex={0}
      >
        {ranked.map((holding) => {
          const news = holding.news;
          const driver = news?.driver ?? null;
          const headlines = news?.headlines ?? [];
          const top = headlines.slice(0, 3);
          const catalyst = deriveTodayCatalyst(
            top.map((h) => ({ headline: h.headline, date: h.date })),
            driver?.label,
            { ticker: holding.ticker, companyName: holding.companyName ?? undefined },
          );
          const moveLabel = formatMove(holding.changePercent);
          const conclusion =
            driver?.label
            ?? top[0]?.headline
            ?? (loaded ? "No recent news loaded yet" : "Loading the story…");
          const evidence =
            driver?.explanation
            ?? (top[1] ? top.slice(0, 2).map((h) => h.headline).join(" · ") : moveLabel);

          return (
            <Link
              key={holding.ticker}
              href={`/companies/${encodeURIComponent(holding.ticker)}`}
              className="bcn-item"
            >
              <SignalBlock
                compact
                eyebrow={holding.ticker}
                conclusion={conclusion}
                evidence={evidence}
                dateLabel={newestDate(top) ?? (loaded ? "Recent" : "—")}
                source="material_news"
                badge={catalyst ? { label: catalyst.label, tone: catalyst.tone } : (
                  moveLabel ? { label: moveLabel, tone: (holding.changePercent ?? 0) >= 0 ? "positive" : "negative" } : null
                )}
              />
            </Link>
          );
        })}
      </div>
      <p className="bcn-footnote">
        News helps explain the move — check ownership filings before deciding.
      </p>
    </section>
  );
}
