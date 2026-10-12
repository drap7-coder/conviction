"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { MarketNarrativeTheme } from "@/lib/market/market-narratives";
import { primaryHeadline } from "@/lib/market/news-hero";
import { selectPulseHomeStories } from "@/lib/market/pulse-home";

type NewsStatus = "loading" | "ready" | "unavailable";

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

function BriefStoryCard({ theme }: { theme: MarketNarrativeTheme }) {
  const headline = primaryHeadline(theme);
  if (!headline) return null;
  return (
    <article className="pulse-home-brief-card">
      <span className="pulse-home-brief-label">{theme.label}</span>
      {headline.url ? (
        <a
          className="pulse-home-brief-title"
          href={headline.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {headline.title}
        </a>
      ) : (
        <h3 className="pulse-home-brief-title">{headline.title}</h3>
      )}
      <footer className="pulse-home-brief-meta">
        <span>{headline.publisher?.trim() || "Market source"}</span>
        <time dateTime={headline.date}>{formatPublished(headline.date)}</time>
      </footer>
    </article>
  );
}

/**
 * Loads market news once and renders Today’s Brief + Worth Understanding
 * in the homepage order (caller places Market / Your Stocks between them).
 */
export function usePulseHomeNews() {
  const [status, setStatus] = useState<NewsStatus>("loading");
  const [themes, setThemes] = useState<MarketNarrativeTheme[]>([]);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch("/api/market/news", {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("news unavailable");
        const payload = (await response.json()) as {
          marketNarratives?: { themes?: MarketNarrativeTheme[] };
          fetchedAt?: string;
        };
        if (cancelled) return;
        setThemes(payload.marketNarratives?.themes ?? []);
        setFetchedAt(payload.fetchedAt ?? null);
        setStatus("ready");
      } catch (error) {
        if (cancelled) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        setThemes([]);
        setStatus("unavailable");
      }
    }
    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  return { status, fetchedAt, ...selectPulseHomeStories(themes) };
}

export function PulseTodaysBrief({
  status,
  fetchedAt,
  stories,
}: {
  status: NewsStatus;
  fetchedAt: string | null;
  stories: MarketNarrativeTheme[];
}) {
  return (
    <section className="pulse-home-section pulse-todays-brief" aria-labelledby="pulse-todays-brief-heading">
      <header className="pulse-home-section-head">
        <div>
          <p className="pulse-home-eyebrow">Market-wide</p>
          <h2 id="pulse-todays-brief-heading">Today’s Brief</h2>
        </div>
        <Link href="/news" className="pulse-home-next">
          Open News <span aria-hidden="true">→</span>
        </Link>
      </header>

      {status === "loading" ? (
        <p className="pulse-home-state">Loading today’s market brief…</p>
      ) : null}
      {status === "unavailable" ? (
        <p className="pulse-home-state">Market news is temporarily unavailable.</p>
      ) : null}
      {status === "ready" && stories.length === 0 ? (
        <p className="pulse-home-state">
          No sourced market stories are available right now. Check News later.
        </p>
      ) : null}
      {stories.length > 0 ? (
        <div className="pulse-home-brief-grid">
          {stories.map((theme) => (
            <BriefStoryCard key={theme.id} theme={theme} />
          ))}
        </div>
      ) : null}
      {fetchedAt && status === "ready" ? (
        <p className="pulse-home-freshness">
          Feed fetched{" "}
          <time dateTime={fetchedAt}>
            {new Date(fetchedAt).toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
            })}
          </time>
          . Story times are publication times.
        </p>
      ) : null}
    </section>
  );
}
