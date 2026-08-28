"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SurfaceSlicer } from "@/components/SurfaceSlicer";
import { SessionQuoteStack } from "@/components/market/SessionQuoteStack";
import { fmtWeight } from "@/lib/display/format";
import { companyDetailHref } from "@/lib/market/company-detail-href";
import type { CrowdHoldingRank, CrowdSnapshot, CrowdWatchRank } from "@/lib/crowd/types";
import type { StockQuote } from "@/lib/market/quotes";

type CrowdView = "held" | "watched";

const VIEWS: Array<{ id: CrowdView; label: string }> = [
  { id: "held", label: "Most held" },
  { id: "watched", label: "Most watched" },
];

function bookMetaLine(snapshot: CrowdSnapshot): string {
  const parts = [`${snapshot.bookCount} book${snapshot.bookCount === 1 ? "" : "s"}`];
  if (snapshot.liveBookCount > 0 && snapshot.seedBookCount > 0) {
    parts.push(`${snapshot.liveBookCount} signed-in`);
  }
  return parts.join(" · ");
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

      <section className="market-heatmap-shell crowd-board" aria-label="Crowd rankings">
        <div className="market-heatmap-copy">
          <div className="market-panel-header">
            <h2>
              {view === "held" ? "Most held" : "Most watched"}
              {snapshot ? (
                <span className="pulse-index-session" aria-label={bookMetaLine(snapshot)}>
                  <i className="pulse-index-session-dot" aria-hidden="true" />
                  {bookMetaLine(snapshot)}
                </span>
              ) : null}
            </h2>
          </div>
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
                const held = view === "held" ? (row as CrowdHoldingRank) : null;
                const watched = view === "watched" ? (row as CrowdWatchRank) : null;
                const sharePct = held?.holderPct ?? watched?.watcherPct ?? 0;
                const countLabel = held
                  ? `${held.holderCount} of ${held.bookCount}`
                  : `${watched?.watcherCount ?? 0} of ${watched?.listCount ?? 0}`;
                const avgWeight = held?.avgWeightPct ?? null;
                const name = quote?.name ?? ticker;
                const body = (
                  <>
                    <span className="crowd-rank" aria-hidden="true">
                      {index + 1}
                    </span>
                    <span className="crowd-id">
                      <strong>{ticker}</strong>
                      <small>{name}</small>
                    </span>
                    <span className="crowd-share">
                      <strong>{fmtWeight(sharePct)}</strong>
                      <small>
                        {countLabel}
                        {avgWeight !== null ? ` · avg ${fmtWeight(avgWeight)}` : ""}
                      </small>
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
                  `${fmtWeight(sharePct)} of ${view === "held" ? "books" : "lists"}`,
                ].join(", ");

                return (
                  <li key={ticker}>
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
