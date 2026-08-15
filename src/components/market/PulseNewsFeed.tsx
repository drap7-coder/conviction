"use client";

import { useEffect, useMemo, useState } from "react";
import { loadPositions } from "@/lib/portfolio/persist";
import type {
  MarketNarrativeHeadline,
  MarketNarrativeTheme,
} from "@/lib/market/market-narratives";

type ThemeFilter = "all" | string;

type FeedItem = {
  id: string;
  themeId: string;
  themeLabel: string;
  title: string;
  url: string | null;
  date: string;
  publisher: string | null;
};

const WHY_IT_MATTERS: Record<string, string> = {
  "ai-compute": "Semiconductors and megacaps can determine whether index strength is broad or fragile.",
  "rates-fed": "Rates reset valuations across growth, real estate, dividends, and other long-duration assets.",
  "energy-oil": "Energy prices flow into inflation, transport costs, industrial margins, and consumer spending.",
  "crypto-liquidity": "Crypto often reveals changes in liquidity and speculative risk appetite before broader markets.",
  "trade-supply": "Trade policy can reprice supply chains, exporters, and internationally exposed companies quickly.",
  "consumer-demand": "Consumer and sector leadership show where demand is holding—and where margins may be under pressure.",
};

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const diff = Math.max(0, Date.now() - date.getTime());
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatMove(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function primaryHeadline(theme: MarketNarrativeTheme): MarketNarrativeHeadline | null {
  return theme.headline ?? theme.headlines[0] ?? null;
}

function publisherLabel(headline: MarketNarrativeHeadline): string {
  return headline.publisher?.trim() || "Market source";
}

function editorialThemeScore(theme: MarketNarrativeTheme): number {
  const headline = primaryHeadline(theme);
  if (!headline) return theme.score - 100;

  const publisher = headline.publisher?.toLowerCase() ?? "";
  const publisherBoost = /reuters|associated press|ap news|bloomberg|financial times|wall street journal/.test(publisher)
    ? 12
    : /cnbc|yahoo finance|marketwatch|barron|fortune|business insider/.test(publisher)
      ? 6
      : 2;
  const ageMs = Date.now() - new Date(headline.date).getTime();
  const ageDays = Number.isFinite(ageMs) ? Math.max(0, ageMs / 86_400_000) : 30;
  const freshness = ageDays <= 1 ? 8 : ageDays <= 2 ? 4 : ageDays <= 7 ? -8 : -28;
  const fillerPenalty = /sector update|stocks? moving|whale activity|millionaire maker|stock to buy|before you buy|moomoo/i.test(headline.title)
    ? 12
    : 0;

  return theme.score + publisherBoost + freshness - fillerPenalty;
}

function buildMoreFeed(themes: MarketNarrativeTheme[], filter: ThemeFilter): FeedItem[] {
  const eligible = filter === "all"
    ? themes
    : themes.filter((theme) => theme.id === filter);
  const items: FeedItem[] = [];
  const maxRounds = filter === "all" ? 3 : 9;

  for (let round = 1; round <= maxRounds; round += 1) {
    const roundItems = eligible
      .map((theme) => ({ theme, headline: theme.headlines[round] }))
      .filter((item): item is { theme: MarketNarrativeTheme; headline: MarketNarrativeHeadline } =>
        Boolean(item.headline),
      )
      .sort((a, b) => b.theme.score - a.theme.score);

    for (const { theme, headline } of roundItems) {
      items.push({
        id: `${theme.id}-${round}-${headline.title.slice(0, 32)}`,
        themeId: theme.id,
        themeLabel: theme.label,
        title: headline.title,
        url: headline.url,
        date: headline.date,
        publisher: headline.publisher ?? null,
      });
    }
  }

  return items;
}

function readBrowserWatchlistTickers(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem("conviction-watchlist");
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => typeof entry?.ticker === "string" ? entry.ticker.toUpperCase() : "")
      .filter(Boolean);
  } catch {
    return [];
  }
}

function NarrativeCard({
  theme,
  featured = false,
  alt = false,
  personal = false,
}: {
  theme: MarketNarrativeTheme;
  featured?: boolean;
  alt?: boolean;
  personal?: boolean;
}) {
  const headline = primaryHeadline(theme);
  if (!headline) return null;

  return (
    <article
      className={`pulse-news-narrative${featured ? " is-featured" : ""}${alt ? " is-alt" : ""} tone-${theme.marketTone}`}
    >
      <div className="pulse-news-narrative-top">
        <span className="pulse-news-narrative-label">{theme.label}</span>
        <div className="pulse-news-narrative-tags">
          {personal ? <span className="pulse-news-personal-chip">For you</span> : null}
        </div>
      </div>

      {headline.url ? (
        <a
          className="pulse-news-narrative-title"
          href={headline.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {headline.title}
        </a>
      ) : (
        <h3 className="pulse-news-narrative-title">{headline.title}</h3>
      )}

      <p className="pulse-news-narrative-summary">{theme.summary}</p>
      <p className="pulse-news-why">
        <strong>Why it matters</strong>
        <span>{WHY_IT_MATTERS[theme.id] ?? "Coverage and price action are reinforcing the same market narrative."}</span>
      </p>

      <div className="pulse-news-assets" aria-label={`${theme.label} market moves`}>
        {theme.assets.slice(0, featured ? 4 : 3).map((asset) => (
          <span
            key={asset.ticker}
            className={
              asset.changePercent === null
                ? "is-flat"
                : asset.changePercent > 0
                  ? "is-up"
                  : asset.changePercent < 0
                    ? "is-down"
                    : "is-flat"
            }
          >
            <b>{asset.ticker}</b> {formatMove(asset.changePercent)}
          </span>
        ))}
      </div>

      <footer className="pulse-news-narrative-source">
        <span>{publisherLabel(headline)}</span>
        <time dateTime={headline.date}>{formatTime(headline.date)}</time>
        {headline.url ? <span aria-hidden="true">Read ↗</span> : null}
      </footer>
    </article>
  );
}

export function PulseNewsFeed({
  themes,
  status,
  section = "all",
}: {
  themes: MarketNarrativeTheme[];
  status: "live" | "partial" | "unavailable";
  /** Split Brief vs Headlines when the parent owns a ViewSwitcher. */
  section?: "all" | "brief" | "headlines";
}) {
  const [activeTheme, setActiveTheme] = useState<ThemeFilter>("all");
  const [expanded, setExpanded] = useState(false);
  const [personalTickers, setPersonalTickers] = useState<Set<string>>(new Set());

  const rankedThemes = useMemo(
    () => [...themes]
      .filter((theme) => Boolean(primaryHeadline(theme)))
      .sort((a, b) => editorialThemeScore(b) - editorialThemeScore(a)),
    [themes],
  );
  const leadThemes = rankedThemes.slice(0, 3);
  const moreItems = useMemo(
    () => buildMoreFeed(rankedThemes, activeTheme),
    [rankedThemes, activeTheme],
  );

  useEffect(() => {
    let cancelled = false;
    const localTickers = new Set([
      ...loadPositions().map((position) => position.ticker.toUpperCase()),
      ...readBrowserWatchlistTickers(),
    ]);
    setPersonalTickers(localTickers);

    fetch("/api/watchlist")
      .then((response) => response.ok ? response.json() : null)
      .then((data: { authenticated?: boolean; entries?: Array<{ ticker: string }>; guestEntries?: Array<{ ticker: string }> } | null) => {
        if (cancelled || !data) return;
        const entries = data.authenticated ? data.entries ?? [] : data.guestEntries ?? data.entries ?? [];
        setPersonalTickers(new Set([
          ...localTickers,
          ...entries.map((entry) => entry.ticker.toUpperCase()),
        ]));
      })
      .catch(() => undefined);

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    setExpanded(false);
  }, [activeTheme]);

  const themeIsPersonal = (theme: MarketNarrativeTheme) => {
    const relatedTickers = [theme.newsTicker, ...theme.assets.map((asset) => asset.ticker)];
    return relatedTickers.some((ticker) => personalTickers.has(ticker.toUpperCase()));
  };

  const connectedTheme = rankedThemes.find(
    (theme) => themeIsPersonal(theme) && !leadThemes.some((lead) => lead.id === theme.id),
  ) ?? null;

  if (status === "unavailable" || rankedThemes.length === 0) {
    return (
      <section className="pulse-news-feed" aria-label="Market news">
        <div className="pulse-news-empty">
          Market news is quiet right now. Check Pulse for price action.
        </div>
      </section>
    );
  }

  const visibleItems = moreItems.slice(0, expanded ? 18 : 8);
  const showBrief = section === "all" || section === "brief";
  const showHeadlines = section === "all" || section === "headlines";

  return (
    <section className="pulse-news-feed" aria-label="Market news">
      {showBrief ? (
        <>
          {section === "all" ? (
            <header className="pulse-news-brief-header">
              <div>
                <span className="pulse-news-brief-eyebrow">
                  News intelligence {status === "partial" ? "· Partial coverage" : "· Live"}
                </span>
                <h2>Three stories that matter now.</h2>
              </div>
              <p>Ranked by relevant coverage, source quality, freshness, and confirming price action.</p>
            </header>
          ) : null}

          <div className="pulse-news-brief-grid">
            {leadThemes.map((theme, index) => (
              <NarrativeCard
                key={theme.id}
                theme={theme}
                featured={index === 0}
                alt={index === 2}
                personal={themeIsPersonal(theme)}
              />
            ))}
          </div>

          {connectedTheme ? (
            <aside className="pulse-news-connected" aria-label="News connected to your portfolio or watchlist">
              <span>Connected to you</span>
              <div>
                <strong>{connectedTheme.label}</strong>
                <p>{connectedTheme.summary}</p>
              </div>
              {primaryHeadline(connectedTheme)?.url ? (
                <a href={primaryHeadline(connectedTheme)!.url!} target="_blank" rel="noopener noreferrer">
                  Read the lead story ↗
                </a>
              ) : null}
            </aside>
          ) : null}
        </>
      ) : null}

      {showHeadlines ? (
        <section className="pulse-news-more" aria-label="Headlines">
          {section === "all" ? (
            <header className="pulse-news-more-header">
              <div>
                <span>Deeper read</span>
                <h2>More headlines</h2>
              </div>
            </header>
          ) : null}

          <div className="pulse-news-filters" role="group" aria-label="Filter news by narrative">
            <button
              type="button"
              className={activeTheme === "all" ? "is-active" : ""}
              aria-pressed={activeTheme === "all"}
              onClick={() => setActiveTheme("all")}
            >
              All
            </button>
            {rankedThemes.map((theme) => (
              <button
                key={theme.id}
                type="button"
                className={activeTheme === theme.id ? "is-active" : ""}
                aria-pressed={activeTheme === theme.id}
                onClick={() => setActiveTheme(theme.id)}
              >
                {theme.label}
              </button>
            ))}
          </div>

          <div className="pulse-news-stream" role="feed" aria-busy="false">
            {visibleItems.map((item, index) => (
              <article
                key={item.id}
                className={`pulse-news-row${index % 2 === 1 ? " is-alt" : ""}`}
              >
                <div className="pulse-news-row-meta">
                  <span>{item.themeLabel}</span>
                  <span>{item.publisher || "Market source"}</span>
                  <time dateTime={item.date}>{formatTime(item.date)}</time>
                </div>
                {item.url ? (
                  <a href={item.url} target="_blank" rel="noopener noreferrer">
                    {item.title}
                    <span aria-hidden="true">↗</span>
                  </a>
                ) : (
                  <p>{item.title}</p>
                )}
              </article>
            ))}
          </div>

          {moreItems.length > 8 ? (
            <button
              type="button"
              className="pulse-news-expand"
              onClick={() => setExpanded((value) => !value)}
              aria-expanded={expanded}
            >
              {expanded ? "Show fewer headlines" : `Show ${Math.min(18, moreItems.length) - 8} more headlines`}
            </button>
          ) : null}
        </section>
      ) : null}
    </section>
  );
}
