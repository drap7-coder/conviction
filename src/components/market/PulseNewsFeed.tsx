"use client";

import { useMemo } from "react";
import type { MarketNarrativeTheme } from "@/lib/market/market-narratives";
import { companyDetailHref } from "@/lib/market/company-detail-href";

type FeedItem = {
  id: string;
  themeId: string;
  themeLabel: string;
  heat: MarketNarrativeTheme["heat"];
  marketTone: MarketNarrativeTheme["marketTone"];
  ticker: string;
  title: string;
  url: string | null;
  date: string;
  summary: string | null;
  score: number;
};

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${Math.max(1, mins)}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function heatLabel(heat: FeedItem["heat"]): string {
  if (heat === "surging") return "Surging";
  if (heat === "building") return "Building";
  if (heat === "quiet") return "Quiet";
  return "Steady";
}

function buildFeed(themes: MarketNarrativeTheme[]): FeedItem[] {
  const items: FeedItem[] = [];
  for (const theme of themes) {
    const stack = theme.headlines?.length
      ? theme.headlines
      : theme.headline
        ? [theme.headline]
        : [];
    stack.forEach((headline, index) => {
      items.push({
        id: `${theme.id}-${index}-${headline.title.slice(0, 24)}`,
        themeId: theme.id,
        themeLabel: theme.label,
        heat: theme.heat,
        marketTone: theme.marketTone,
        ticker: theme.newsTicker || theme.assets[0]?.ticker || theme.id,
        title: headline.title,
        url: headline.url,
        date: headline.date,
        summary: index === 0 ? theme.summary : null,
        score: theme.score,
      });
    });
  }

  return items.sort((a, b) => {
    const aTime = new Date(a.date).getTime();
    const bTime = new Date(b.date).getTime();
    const aValid = Number.isFinite(aTime) ? aTime : 0;
    const bValid = Number.isFinite(bTime) ? bTime : 0;
    if (bValid !== aValid) return bValid - aValid;
    return b.score - a.score;
  });
}

export function PulseNewsFeed({
  themes,
  status,
}: {
  themes: MarketNarrativeTheme[];
  status: "live" | "partial" | "unavailable";
}) {
  const items = useMemo(() => buildFeed(themes), [themes]);

  if (status === "unavailable" || items.length === 0) {
    return (
      <section className="pulse-news-feed" aria-label="Market news">
        <div className="pulse-news-empty">
          Market news is quiet right now. Check Indexes for price action.
        </div>
      </section>
    );
  }

  return (
    <section className="pulse-news-feed" aria-label="Market news">
      <header className="pulse-news-heading">
        <h2 className="pulse-news-title">News</h2>
        <p className="pulse-news-lede">
          Live market chatter and headlines, newest first.
          {status === "partial" ? " Some themes are still catching up." : ""}
        </p>
      </header>

      <div className="pulse-news-stream" role="feed" aria-busy="false">
        {items.map((item) => {
          const companyHref = companyDetailHref(item.ticker);
          const href = item.url || companyHref;
          const external = Boolean(item.url);
          return (
            <article
              key={item.id}
              className={`pulse-news-card tone-${item.marketTone} heat-${item.heat}`}
            >
              <div className="pulse-news-card-top">
                {companyHref ? (
                  <a className="pulse-news-ticker" href={companyHref}>
                    {item.ticker}
                  </a>
                ) : (
                  <span className="pulse-news-ticker">{item.ticker}</span>
                )}
                <span className="pulse-news-theme">{item.themeLabel}</span>
                <span className={`pulse-news-heat heat-${item.heat}`}>
                  {heatLabel(item.heat)}
                </span>
                <time className="pulse-news-time" dateTime={item.date}>
                  {formatTime(item.date)}
                </time>
              </div>

              {href ? (
                <a
                  className="pulse-news-headline"
                  href={href}
                  {...(external
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                >
                  {item.title}
                </a>
              ) : (
                <p className="pulse-news-headline">{item.title}</p>
              )}

              {item.summary ? (
                <p className="pulse-news-summary">{item.summary}</p>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
