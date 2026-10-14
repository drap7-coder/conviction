"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
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

type ThemeFilter = string;

type FeedAsset = {
  ticker: string;
  changePercent: number | null;
};

type FeedItem = {
  id: string;
  themeId: string;
  themeLabel: string;
  title: string;
  url: string | null;
  date: string;
  publisher: string | null;
  marketTone: MarketNarrativeTheme["marketTone"];
  assets: FeedAsset[];
};

function AssetChips({
  assets,
  label,
}: {
  assets: FeedAsset[];
  label: string;
}) {
  if (assets.length === 0) return null;
  return (
    <div className="pulse-news-assets" aria-label={`${label} market moves`}>
      {assets.slice(0, 3).map((asset) => (
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
  );
}

const WHY_IT_MATTERS: Record<string, string> = {
  "ai-compute":
    "Semiconductors and megacaps can determine whether index strength is broad or fragile.",
  "rates-fed":
    "Rates reset valuations across growth, real estate, dividends, and other long-duration assets.",
  "energy-oil":
    "Energy prices flow into inflation, transport costs, industrial margins, and consumer spending.",
  "crypto-liquidity":
    "Crypto often reveals changes in liquidity and speculative risk appetite before broader markets.",
  "trade-supply":
    "Trade policy can reprice supply chains, exporters, and internationally exposed companies quickly.",
  "consumer-demand":
    "Consumer and sector leadership show where demand is holding—and where margins may be under pressure.",
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

function editorialFocalPoint(themeId: string): string {
  const focalPoints: Record<string, string> = {
    "ai-compute": "50% 42%",
    "rates-fed": "50% 36%",
    "energy-oil": "50% 48%",
    "crypto-liquidity": "50% 44%",
    "trade-supply": "50% 46%",
    "consumer-demand": "50% 40%",
  };
  return focalPoints[themeId] ?? "50% 42%";
}

function buildMoreFeed(
  themes: MarketNarrativeTheme[],
  filter: ThemeFilter,
): FeedItem[] {
  const eligible =
    filter === "all"
      ? themes
      : themes.filter((theme) => theme.id === filter);
  const items: FeedItem[] = [];
  const maxRounds = filter === "all" ? 3 : 9;

  for (let round = 1; round <= maxRounds; round += 1) {
    const roundItems = eligible
      .map((theme) => ({ theme, headline: theme.headlines[round] }))
      .filter(
        (
          item,
        ): item is {
          theme: MarketNarrativeTheme;
          headline: MarketNarrativeHeadline;
        } => Boolean(item.headline),
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
        assets: theme.assets.map((asset) => ({
          ticker: asset.ticker,
          changePercent: asset.changePercent,
        })),
      });
    }
  }

  return items;
}

function NarrativeCard({
  theme,
  alt = false,
  featured = false,
}: {
  theme: MarketNarrativeTheme;
  alt?: boolean;
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
  const showMedia = Boolean(imageUrl);
  const copy = (
    <>
      <div className="pulse-news-narrative-top">
        <div className="pulse-news-narrative-tags">
          {featured ? <span className="pulse-news-lead-chip">Lead</span> : null}
          <span className="pulse-news-narrative-label">{theme.label}</span>
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

      {featured ? (
        <>
          <p className="pulse-news-narrative-summary">{theme.summary}</p>
          <p className="pulse-news-why">
            <strong>Why it matters</strong>
            <span>
              {WHY_IT_MATTERS[theme.id] ??
                "Coverage and price action are reinforcing the same market narrative."}
            </span>
          </p>
        </>
      ) : null}

      <AssetChips assets={theme.assets} label={theme.label} />

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
        featured ? "is-featured" : "is-dense",
        showMedia ? "is-media-hero has-media" : "",
        imageFailed ? "has-media-fallback" : "",
        `tone-${theme.marketTone}`,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {showMedia ? (
        <div className="pulse-news-hero-media">
          {imageFailed ? (
            <div className="pulse-news-media-fallback" aria-hidden="true">
              <span>{theme.label}</span>
              <i />
            </div>
          ) : (
            <Image
              src={imageUrl!}
              alt=""
              width={960}
              height={540}
              sizes="(max-width: 767px) 100vw, (max-width: 1100px) 52vw, 510px"
              className="pulse-news-hero-img"
              style={{ objectPosition: editorialFocalPoint(theme.id) }}
              priority={featured}
              onError={() => setImageFailed(true)}
              referrerPolicy="no-referrer"
            />
          )}
        </div>
      ) : null}
      {showMedia ? <div className="pulse-news-hero-copy">{copy}</div> : copy}
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
    <article
      className={`pulse-news-narrative is-dense${alt ? " is-alt" : ""} tone-${item.marketTone}`}
    >
      <div className="pulse-news-narrative-top">
        <div className="pulse-news-narrative-tags">
          <span className="pulse-news-narrative-label">{item.themeLabel}</span>
        </div>
        <footer className="pulse-news-narrative-source is-inline">
          <span>{item.publisher?.trim() || "Market source"}</span>
          <time dateTime={item.date}>{formatTime(item.date)}</time>
        </footer>
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

      <div className="pulse-news-dense-meta">
        <AssetChips assets={item.assets} label={item.themeLabel} />
        {item.url ? (
          <span className="pulse-news-read" aria-hidden="true">
            Read ↗
          </span>
        ) : null}
      </div>
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
  const rankedThemes = useMemo(
    () =>
      [...themes]
        .filter((theme) => Boolean(primaryHeadline(theme)))
        .sort((a, b) => editorialThemeScore(b) - editorialThemeScore(a)),
    [themes],
  );

  const filteredThemes = useMemo(() => {
    if (activeTheme === "all") return rankedThemes;
    return rankedThemes.filter((theme) => theme.id === activeTheme);
  }, [rankedThemes, activeTheme]);

  const visibleThemes = useMemo(
    () => orderNewsBriefThemes(filteredThemes),
    [filteredThemes],
  );
  const moreItems = useMemo(
    () => buildMoreFeed(rankedThemes, activeTheme),
    [rankedThemes, activeTheme],
  );

  useEffect(() => {
    setExpanded(false);
  }, [activeTheme]);

  if (status === "unavailable" || rankedThemes.length === 0) {
    return (
      <section className="pulse-news-feed" aria-label="Market news">
        <div className="pulse-news-empty">
          Market news is temporarily unavailable. Please try again later.
        </div>
      </section>
    );
  }

  const visibleItems = moreItems.slice(0, expanded ? 18 : 8);
  const showBrief = section === "all" || section === "brief";
  const showHeadlines = section === "all" || section === "headlines";

  return (
    <section className="pulse-news-feed" aria-label="Market news">
      <div className="pulse-news-filter-bar">
        <label className="pulse-news-theme-menu">
          <span>Market news</span>
          <select
            value={activeTheme}
            onChange={(event) => {
              const next = event.target.value;
              setActiveTheme(next || "all");
            }}
            aria-label="Filter by theme"
          >
            <option value="all">All topics</option>
            {rankedThemes.map((theme) => (
              <option key={theme.id} value={theme.id}>
                {theme.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="pulse-news-brief-grid" role="feed" aria-busy="false">
          {showBrief
            ? visibleThemes.map((theme, index) => (
                <NarrativeCard
                  key={theme.id}
                  theme={theme}
                  alt={index % 2 === 1}
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

      {showHeadlines && moreItems.length > 8 ? (
        <button
          type="button"
          className="pulse-news-expand"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
        >
          {expanded
            ? "Show fewer stories"
            : `Show ${Math.min(18, moreItems.length) - 8} more stories`}
        </button>
      ) : null}
    </section>
  );
}
