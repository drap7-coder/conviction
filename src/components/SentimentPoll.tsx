"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { SentimentVote } from "@/lib/sentiment";

type Totals = {
  ticker: string;
  date: string;
  bullish: number;
  bearish: number;
  total: number;
  available: boolean;
};
export function SentimentPoll({ ticker }: { ticker: string }) {
  const symbol = ticker.toUpperCase();
  const [totals, setTotals] = useState<Totals | null>(null);
  const [choice, setChoice] = useState<SentimentVote | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    fetch(`/api/sentiment?ticker=${encodeURIComponent(symbol)}`, {
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (active && data) {
          setTotals(data);
          try {
            const saved = localStorage.getItem(
              `iqbulls-sentiment:${symbol}:${data.date}`,
            );
            if (saved === "bullish" || saved === "bearish") setChoice(saved);
          } catch {}
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [symbol]);
  const pct = useMemo(
    () =>
      totals?.total ? Math.round((totals.bullish / totals.total) * 100) : 50,
    [totals],
  );
  async function vote(next: SentimentVote) {
    const previous = choice;
    const previousTotals = totals;
    setChoice(next);
    setPending(true);
    setError(null);
    if (totals && next !== previous) {
      setTotals({
        ...totals,
        bullish:
          totals.bullish +
          (next === "bullish" ? 1 : 0) -
          (previous === "bullish" ? 1 : 0),
        bearish:
          totals.bearish +
          (next === "bearish" ? 1 : 0) -
          (previous === "bearish" ? 1 : 0),
        total: totals.total + (previous ? 0 : 1),
      });
    }
    try {
      const response = await fetch("/api/sentiment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ticker: symbol, vote: next }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Vote failed");
      setTotals(data);
      try {
        localStorage.setItem(`iqbulls-sentiment:${symbol}:${data.date}`, next);
      } catch {}
    } catch (e) {
      setChoice(previous);
      setTotals(previousTotals);
      setError(e instanceof Error ? e.message : "Vote failed");
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="sentiment-poll" aria-labelledby={`sentiment-${symbol}`}>
      <span className="data-manager-eyebrow">Daily sentiment</span>
      <h2 id={`sentiment-${symbol}`}>
        What is your sentiment on {symbol} today?
      </h2>
      <div
        className="sentiment-actions"
        role="group"
        aria-label={`${symbol} sentiment`}
      >
        <button
          type="button"
          className={choice === "bullish" ? "is-selected" : ""}
          disabled={pending}
          onClick={() => vote("bullish")}
        >
          Bullish
        </button>
        <button
          type="button"
          className={choice === "bearish" ? "is-selected" : ""}
          disabled={pending}
          onClick={() => vote("bearish")}
        >
          Bearish
        </button>
      </div>
      {totals?.total ? (
        <div className="sentiment-result" aria-live="polite">
          <div>
            <i style={{ width: `${pct}%` }} />
          </div>
          <p>
            {pct}% bullish · {100 - pct}% bearish · {totals.total} votes
          </p>
        </div>
      ) : (
        <p aria-live="polite">Be among the first to vote today.</p>
      )}
      {error ? <p role="alert">{error}</p> : null}
      {choice && !error ? (
        <p className="sentiment-sync">
          Want this everywhere?{" "}
          <Link href="/signin">Sync your watchlist across devices</Link>.
        </p>
      ) : null}
    </section>
  );
}
