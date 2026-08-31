"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LogoDisplay } from "@/app/components/LogoDisplay";
import { SurfaceSlicer } from "@/components/SurfaceSlicer";
import { SessionQuoteStack } from "@/components/market/SessionQuoteStack";
import { companyDetailHref } from "@/lib/market/company-detail-href";
import type { CrowdSnapshot } from "@/lib/crowd/types";
import type { StockQuote } from "@/lib/market/quotes";

type CrowdView = "held" | "watched";

const VIEWS: Array<{ id: CrowdView; label: string }> = [
  { id: "held", label: "Most held" },
  { id: "watched", label: "Most watched" },
];

function formatSharePct(pct: number): string {
  if (!Number.isFinite(pct) || pct < 0) return "—";
  const rounded = Math.round(pct * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
}

/** Quiet head meta: book/list counts + starter vs live mix. Aggregate only. */
export function crowdBoardMetaLine(
  snapshot: CrowdSnapshot,
  view: CrowdView,
): string {
  if (view === "held") {
    const { bookCount, liveBookCount, seedBookCount, includesDemoBooks } = snapshot;
    if (bookCount <= 0) return "No books yet";
    if (includesDemoBooks && liveBookCount === 0) {
      return `Across ${bookCount} starter ${bookCount === 1 ? "book" : "books"}`;
    }
    if (includesDemoBooks && liveBookCount > 0) {
      return `Across ${bookCount} books · ${liveBookCount} live · ${seedBookCount} starter`;
    }
    return `Across ${bookCount} ${bookCount === 1 ? "book" : "books"}`;
  }

  const { listCount, liveBookCount, seedBookCount, includesDemoBooks } = snapshot;
  if (listCount <= 0) return "No lists yet";
  if (includesDemoBooks && liveBookCount === 0) {
    return `Across ${listCount} starter ${listCount === 1 ? "list" : "lists"}`;
  }
  if (includesDemoBooks && liveBookCount > 0) {
    const liveLists = Math.min(listCount, liveBookCount);
    const starterLists = Math.max(0, listCount - liveLists);
    // Prefer snapshot seed/live book mix for honesty when every book has a list.
    if (listCount === snapshot.bookCount) {
      return `Across ${listCount} lists · ${liveBookCount} live · ${seedBookCount} starter`;
    }
    return `Across ${listCount} lists · ${liveLists} live · ${starterLists} starter`;
  }
  return `Across ${listCount} ${listCount === 1 ? "list" : "lists"}`;
}

export function CrowdBoard() {
  const [view, setView] = useState<CrowdView>("held");
  const [snapshot, setSnapshot] = useState<CrowdSnapshot | null>(null);
  const [quotes, setQuotes] = useState<Record<string, StockQuote>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/crowd", { cache: "no-store" });
        if (!res.ok) throw new Error("Could not load Crowd");
        const data = (await res.json()) as CrowdSnapshot;
        if (cancelled) return;
        setSnapshot(data);

        const tickers = [
          ...data.held.slice(0, 20).map((row) => row.ticker),
          ...data.watched.slice(0, 20).map((row) => row.ticker),
        ];
        const unique = [...new Set(tickers)];
        if (unique.length === 0) return;

        const quoteRes = await fetch(
          `/api/market/quotes?tickers=${encodeURIComponent(unique.join(","))}`,
          { cache: "no-store" },
        );
        if (!quoteRes.ok || cancelled) return;
        const quoteJson = (await quoteRes.json()) as { quotes?: StockQuote[] };
        const map: Record<string, StockQuote> = {};
        for (const quote of quoteJson.quotes ?? []) {
          map[quote.ticker.toUpperCase()] = quote;
        }
        if (!cancelled) setQuotes(map);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load Crowd");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const rows =
    view === "held"
      ? (snapshot?.held ?? []).slice(0, 20)
      : (snapshot?.watched ?? []).slice(0, 20);

  return (
    <div className="crowd-page-body">
      <SurfaceSlicer
        label="Crowd view"
        options={VIEWS}
        activeId={view}
        onChange={(id) => setView(id as CrowdView)}
      />

      <section className="surface-shell crowd-board" aria-label="Crowd rankings">
        <div className="crowd-board-head">
          <div className="crowd-board-title">
            <h2>{view === "held" ? "Most held" : "Most watched"}</h2>
          </div>
          {snapshot ? (
            <p className="crowd-board-meta">{crowdBoardMetaLine(snapshot, view)}</p>
          ) : null}
        </div>

        <div className="surface-well crowd-well">
          {loading && !snapshot ? (
            <p className="crowd-empty">Loading member books…</p>
          ) : error ? (
            <p className="crowd-empty">{error}</p>
          ) : rows.length === 0 ? (
            <p className="crowd-empty">
              {view === "held"
                ? "No holdings to rank yet."
                : "No watchlists to rank yet."}
            </p>
          ) : (
            <ol className="crowd-list">
              {rows.map((row, index) => {
                const ticker = row.ticker;
                const quote = quotes[ticker];
                const href = companyDetailHref(ticker);
                const name = quote?.name ?? ticker;
                const topThree = index < 3;
                const sharePct = "holderPct" in row ? row.holderPct : row.watcherPct;
                const shareLabel = view === "held" ? "of books" : "of lists";
                const body = (
                  <>
                    <span className={`crowd-rank${topThree ? " is-lead" : ""}`} aria-hidden="true">
                      {index + 1}
                    </span>
                    <span className="crowd-logo" aria-hidden="true">
                      <LogoDisplay ticker={ticker} size="detail" />
                    </span>
                    <span className="crowd-id">
                      <strong>{ticker}</strong>
                      <small>{name}</small>
                    </span>
                    <span className="crowd-share" aria-hidden="true">
                      <strong className="tnum">{formatSharePct(sharePct)}</strong>
                      <small>{shareLabel}</small>
                    </span>
                    <SessionQuoteStack
                      lastPrice={quote?.price ?? null}
                      change={quote?.change ?? null}
                      changePercent={quote?.changePercent ?? null}
                      compact
                    />
                  </>
                );
                const aria = [
                  `#${index + 1}`,
                  ticker,
                  name,
                  `${formatSharePct(sharePct)} ${shareLabel}`,
                ].join(", ");

                return (
                  <li key={ticker} className={topThree ? "is-lead" : undefined}>
                    {href ? (
                      <Link href={href} className="crowd-row" aria-label={aria}>
                        {body}
                      </Link>
                    ) : (
                      <div className="crowd-row" aria-label={aria}>
                        {body}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <p className="crowd-hedge">
          {snapshot?.includesDemoBooks
            ? "Starter books fill the board while membership is small. Aggregate of member books — not a recommendation."
            : "Aggregate of member books — not a recommendation."}
        </p>
      </section>
    </div>
  );
}
