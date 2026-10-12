"use client";

import Link from "next/link";
import type { MarketNarrativeTheme } from "@/lib/market/market-narratives";
import { primaryHeadline } from "@/lib/market/news-hero";

function formatPublished(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const diff = Math.max(0, Date.now() - date.getTime());
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * One deeper market story distinct from Today’s Brief. Hidden when nothing
 * useful remains after the brief picks.
 */
export function PulseWorthUnderstanding({
  theme,
  status,
}: {
  theme: MarketNarrativeTheme | null;
  status: "loading" | "ready" | "unavailable";
}) {
  if (status === "loading" || status === "unavailable") return null;
  if (!theme) return null;
  const headline = primaryHeadline(theme);
  if (!headline) return null;

  return (
    <section
      className="pulse-home-section pulse-worth-understanding"
      aria-labelledby="pulse-worth-heading"
    >
      <header className="pulse-home-section-head">
        <div>
          <p className="pulse-home-eyebrow">Deeper read</p>
          <h2 id="pulse-worth-heading">Worth Understanding</h2>
        </div>
        <Link href="/news" className="pulse-home-next">
          More on News <span aria-hidden="true">→</span>
        </Link>
      </header>
      <article className="pulse-home-worth-card">
        <span className="pulse-home-brief-label">{theme.label}</span>
        {headline.url ? (
          <a
            className="pulse-home-worth-title"
            href={headline.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {headline.title}
          </a>
        ) : (
          <h3 className="pulse-home-worth-title">{headline.title}</h3>
        )}
        <p className="pulse-home-worth-summary">{theme.summary}</p>
        <footer className="pulse-home-brief-meta">
          <span>{headline.publisher?.trim() || "Market source"}</span>
          <time dateTime={headline.date}>{formatPublished(headline.date)}</time>
        </footer>
      </article>
    </section>
  );
}
