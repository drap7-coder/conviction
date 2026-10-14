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
          } catch {
            /* ignore */
          }
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [symbol]);

  const consensus = useMemo(() => {
    if (!totals?.total) {
      return { bullishPct: 50, bearishPct: 50, total: 0 };
    }
    const bullishPct = Math.round((totals.bullish / totals.total) * 100);
    return {
      bullishPct,
      bearishPct: 100 - bullishPct,
      total: totals.total,
    };
  }, [totals]);

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
      } catch {
        /* ignore */
      }
    } catch (e) {
      setChoice(previous);
      setTotals(previousTotals);
      setError(e instanceof Error ? e.message : "Vote failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="sentiment-poll sentiment-poll--ops" aria-labelledby={`sentiment-${symbol}`}>
      <header className="sentiment-ops-head">
        <div>
          <span className="data-manager-eyebrow">Live consensus</span>
          <h2 id={`sentiment-${symbol}`}>{symbol} node sentiment</h2>
        </div>
        <span className="sentiment-ops-count tnum" aria-live="polite">
          {consensus.total > 0 ? `${consensus.total} votes` : "Awaiting nodes"}
        </span>
      </header>

      <div
        className="sentiment-consensus"
        role="img"
        aria-label={`${consensus.bullishPct}% bullish, ${consensus.bearishPct}% bearish`}
      >
        <div className="sentiment-consensus-bar">
          <i className="is-bull" style={{ width: `${consensus.bullishPct}%` }} />
          <i className="is-bear" style={{ width: `${consensus.bearishPct}%` }} />
        </div>
        <div className="sentiment-consensus-labels">
          <span className="is-bull tnum">{consensus.bullishPct}% bullish</span>
          <span className="is-bear tnum">{consensus.bearishPct}% bearish</span>
        </div>
      </div>

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
