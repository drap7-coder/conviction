"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { SurfaceSlicer } from "@/components/SurfaceSlicer";
import { loadPositions } from "@/lib/portfolio/persist";
import { loadPortfolioForViewer } from "@/lib/portfolio/client";
import type {
  MarketNarrativeHeadline,
  MarketNarrativeTheme,
} from "@/lib/market/market-narratives";
import {
  editorialThemeScore,
  orderNewsBriefThemes,
  pickHeroHeadline,
  primaryHeadline,
  usableHeadlineImage,
} from "@/lib/market/news-hero";

type ThemeFilter = "all" | "yours" | string;

type FeedItem = {
  id: string;
  themeId: string;
  themeLabel: string;
  title: string;
  url: string | null;
  date: string;
  publisher: string | null;
  marketTone: MarketNarrativeTheme["marketTone"];
};

const PRIMARY_FILTERS = [
  { id: "all", label: "All" },
  { id: "yours", label: "Your Stocks" },
] as const;

function isPrimaryNewsFilter(filter: ThemeFilter): filter is "all" | "yours" {
  return filter === "all" || filter === "yours";
}

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

function publisherLabel(headline: MarketNarrativeHeadline): string {
  return headline.publisher?.trim() || "Market source";
}

function buildMoreFeed(
  themes: MarketNarrativeTheme[],
  filter: ThemeFilter,
  personalThemeIds?: ReadonlySet<string>,
): FeedItem[] {
  const eligible = filter === "all"
    ? themes
    : filter === "yours"
      ? themes.filter((theme) => personalThemeIds?.has(theme.id))
      : themes.filter((theme) => theme.id === filter);
  const items: FeedItem[] = [];
  const maxRounds = filter === "all" || filter === "yours" ? 3 : 9;

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
        marketTone: theme.marketTone,
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
  alt = false,
  personal = false,
  featured = false,
}: {
  theme: MarketNarrativeTheme;
  alt?: boolean;
  personal?: boolean;
  featured?: boolean;
}) {
  const pictured = pickHeroHeadline(theme);
  const fallback = primaryHeadline(theme);
  const hasPicture = Boolean(usableHeadlineImage(pictured?.imageUrl));
  // Same-story rule: when a card shows a photo, title and image stay on one headline.
  const headline = featured || hasPicture ? (pictured ?? fallback) : fallback;
  const [imageFailed, setImageFailed] = useState(false);
  if (!headline) return null;

  const imageUrl = usableHeadlineImage(headline.imageUrl);
  const showImage = Boolean(imageUrl) && !imageFailed;
  const copy = (
    <>
      <div className="pulse-news-narrative-top">
        <span className="pulse-news-narrative-label">{theme.label}</span>
        <div className="pulse-news-narrative-tags">
          {featured ? <span className="pulse-news-lead-chip">Lead</span> : null}
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
        {theme.assets.slice(0, 3).map((asset) => (
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
    </>
  );

  return (
    <article
      className={[
        "pulse-news-narrative",
        alt ? "is-alt" : "",
        featured ? "is-featured" : "",
        showImage ? "is-media-hero has-media" : "",
        `tone-${theme.marketTone}`,
      ].filter(Boolean).join(" ")}
    >
      {showImage ? (
        <div className="pulse-news-hero-media">
          <Image
            src={imageUrl!}
            alt=""
            width={960}
            height={540}
            sizes="(max-width: 767px) 100vw, (max-width: 1100px) 92vw, 860px"
            className="pulse-news-hero-img"
            priority={featured}
            onError={() => setImageFailed(true)}
            referrerPolicy="no-referrer"
          />
        </div>
      ) : null}
      {showImage ? <div className="pulse-news-hero-copy">{copy}</div> : copy}
    </article>
  );
}

function HeadlineCard({
  item,
  alt = false,
}: {
  item: FeedItem;
  alt?: boolean;
}) {
  return (
    <article className={`pulse-news-narrative${alt ? " is-alt" : ""} tone-${item.marketTone}`}>
      <div className="pulse-news-narrative-top">
        <span className="pulse-news-narrative-label">{item.themeLabel}</span>
      </div>

      {item.url ? (
        <a
          className="pulse-news-narrative-title"
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {item.title}
        </a>
      ) : (
        <h3 className="pulse-news-narrative-title">{item.title}</h3>
      )}

      <footer className="pulse-news-narrative-source">
        <span>{item.publisher?.trim() || "Market source"}</span>
        <time dateTime={item.date}>{formatTime(item.date)}</time>
        {item.url ? <span aria-hidden="true">Read ↗</span> : null}
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

  const themeIsPersonal = (theme: MarketNarrativeTheme) => {
    const relatedTickers = [theme.newsTicker, ...theme.assets.map((asset) => asset.ticker)];
    return relatedTickers.some((ticker) => personalTickers.has(ticker.toUpperCase()));
  };

  const personalThemeIds = useMemo(() => {
    const ids = new Set<string>();
    for (const theme of rankedThemes) {
      if (themeIsPersonal(theme)) ids.add(theme.id);
    }
    return ids;
  }, [rankedThemes, personalTickers]);

  const filteredThemes = useMemo(() => {
    if (activeTheme === "all") return rankedThemes;
    if (activeTheme === "yours") {
      return rankedThemes.filter((theme) => personalThemeIds.has(theme.id));
    }
    return rankedThemes.filter((theme) => theme.id === activeTheme);
  }, [rankedThemes, activeTheme, personalThemeIds]);

  const visibleThemes = useMemo(
    () => orderNewsBriefThemes(filteredThemes),
    [filteredThemes],
  );
  const moreItems = useMemo(
    () => buildMoreFeed(rankedThemes, activeTheme, personalThemeIds),
    [rankedThemes, activeTheme, personalThemeIds],
  );

  useEffect(() => {
    let cancelled = false;
    const localTickers = new Set([
      ...loadPositions().map((position) => position.ticker.toUpperCase()),
      ...readBrowserWatchlistTickers(),
    ]);
    setPersonalTickers(localTickers);

    Promise.all([
      fetch("/api/watchlist").then((response) => response.ok ? response.json() : null),
      loadPortfolioForViewer(),
    ])
      .then(([data, portfolio]: [
        { authenticated?: boolean; entries?: Array<{ ticker: string }> } | null,
        Awaited<ReturnType<typeof loadPortfolioForViewer>>,
      ]) => {
        if (cancelled) return;
        const entries = data?.authenticated ? data.entries ?? [] : [];
        setPersonalTickers(new Set([
          ...localTickers,
          ...entries.map((entry) => entry.ticker.toUpperCase()),
          ...portfolio.positions.map((position) => position.ticker.toUpperCase()),
        ]));
      })
      .catch(() => undefined);

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    setExpanded(false);
  }, [activeTheme]);

  const connectedTheme = rankedThemes.find(
    (theme) => themeIsPersonal(theme) && !visibleThemes.some((lead) => lead.id === theme.id),
  ) ?? null;

  const primaryFilterId = isPrimaryNewsFilter(activeTheme) ? activeTheme : "";
  const themeMenuValue = isPrimaryNewsFilter(activeTheme) ? "" : activeTheme;

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
  const yoursEmpty = activeTheme === "yours" && visibleThemes.length === 0 && moreItems.length === 0;

  return (
    <section className="pulse-news-feed" aria-label="Market news">
      <div className="pulse-news-filter-bar">
        <SurfaceSlicer
          label="Filter news"
          options={[...PRIMARY_FILTERS]}
          activeId={primaryFilterId}
          onChange={(id) => setActiveTheme(id === "yours" ? "yours" : "all")}
          className="pulse-news-filters"
          role="group"
        />
        <label className="pulse-news-theme-menu">
          <span className="sr-only">Filter by theme</span>
          <select
            value={themeMenuValue}
            onChange={(event) => {
              const next = event.target.value;
              setActiveTheme(next || "all");
            }}
            aria-label="Filter by theme"
          >
            <option value="">Themes</option>
            {rankedThemes.map((theme) => (
              <option key={theme.id} value={theme.id}>
                {theme.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {yoursEmpty ? (
        <div className="pulse-news-empty">
          No stories tied to your book or watchlist yet. Add names in Manage, or browse All.
        </div>
      ) : (
        <div className="pulse-news-brief-grid" role="feed" aria-busy="false">
          {showBrief
            ? visibleThemes.map((theme, index) => (
              <NarrativeCard
                key={theme.id}
                theme={theme}
                alt={index % 2 === 1}
                personal={themeIsPersonal(theme)}
                featured={index === 0}
              />
            ))
            : null}

          {showHeadlines
            ? visibleItems.map((item, index) => (
              <HeadlineCard
                key={item.id}
                item={item}
                alt={(visibleThemes.length + index) % 2 === 1}
              />
            ))
            : null}
        </div>
      )}

      {showBrief && connectedTheme && activeTheme === "all" ? (
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

      {showHeadlines && !yoursEmpty && moreItems.length > 8 ? (
        <button
          type="button"
          className="pulse-news-expand"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
        >
          {expanded ? "Show fewer stories" : `Show ${Math.min(18, moreItems.length) - 8} more stories`}
        </button>
      ) : null}
    </section>
  );
}
