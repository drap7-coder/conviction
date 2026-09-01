"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { CommunityPicksPayload } from "@/lib/community-picks/types";

function formatReturn(value: number | null): string {
  if (value === null) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function returnTone(value: number | null): "up" | "down" | "quiet" {
  if (value === null || value === 0) return "quiet";
  return value > 0 ? "up" : "down";
}

function formatStartedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function CommunityPickCard() {
  const [data, setData] = useState<CommunityPicksPayload | null>(null);
  const [ticker, setTicker] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/community-picks", { cache: "no-store", credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load community picks.");
        return response.json() as Promise<CommunityPicksPayload>;
      })
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Could not load community picks.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function submitTicker() {
    if (!ticker.trim() || !data) return;
    setBusy(true);
    setError(null);
    const endpoint = data.viewerPick ? "/api/picks/swap" : "/api/community-picks";
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ticker: ticker.trim() }),
      });
      const payload = (await response.json()) as CommunityPicksPayload & { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Could not save your pick.");
        return;
      }
      setData(payload);
      setTicker("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save your pick.");
    } finally {
      setBusy(false);
    }
  }

  if (data === null) {
    return (
      <section className="surface-shell community-pick-card" aria-label="Community picks">
        <p className="crowd-empty">{error ?? "Loading community picks…"}</p>
      </section>
    );
  }

  return (
    <section className="surface-shell community-pick-card" aria-label="Community picks">
      <div className="community-pick-head">
        <div>
          <p className="community-pick-eyebrow">Your community pick</p>
          <h2>{data.viewerGroup?.name ?? "Choose a community"}</h2>
        </div>
        {data.viewerPick ? (
          <div className="community-pick-current">
            <strong>{data.viewerPick.ticker}</strong>
            <span className={`is-${returnTone(data.viewerPick.lifetimeReturnPct)}`}>
              {formatReturn(data.viewerPick.lifetimeReturnPct)}
            </span>
          </div>
        ) : null}
      </div>

      {!data.authenticated ? (
        <Link href="/signin" className="brief-link">Sign in to pick a stock</Link>
      ) : !data.viewerGroup ? (
        <p className="community-pick-note">Join a community above to pick a stock.</p>
      ) : data.viewerPick ? (
        <div className="community-pick-metrics">
          <div>
            <span className="community-pick-metric-label">Active ticker</span>
            <strong>{data.viewerPick.ticker}</strong>
            <small>from ${data.viewerPick.entryPrice.toFixed(2)}</small>
          </div>
          <div>
            <span className="community-pick-metric-label">Current pick</span>
            <strong className={`is-${returnTone(data.viewerPick.activeReturnPct)}`}>
              {formatReturn(data.viewerPick.activeReturnPct)}
            </strong>
          </div>
          <div>
            <span className="community-pick-metric-label">Lifetime score</span>
            <strong className={`is-${returnTone(data.viewerPick.lifetimeReturnPct)}`}>
              {formatReturn(data.viewerPick.lifetimeReturnPct)}
            </strong>
          </div>
          <div>
            <span className="community-pick-metric-label">Started</span>
            <strong>{formatStartedAt(data.viewerPick.pickedAt)}</strong>
          </div>
        </div>
      ) : null}

      {data.authenticated && data.viewerGroup ? (
        <div className="community-pick-compose">
          <label>
            <span>{data.viewerPick ? "Swap ticker" : "Ticker"}</span>
            <input
              value={ticker}
              onChange={(event) => setTicker(event.target.value.toUpperCase())}
              onKeyDown={(event) => {
                if (event.key === "Enter") void submitTicker();
              }}
              placeholder="AAPL"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <button
            type="button"
            className="watchlist-add-button"
            disabled={busy || !ticker.trim()}
            onClick={() => void submitTicker()}
          >
            {busy ? "Saving…" : data.viewerPick ? "Swap ticker" : "Set pick"}
          </button>
        </div>
      ) : null}

      {data.viewerPick ? (
        <p className="community-pick-note">
          Swapping banks your current pick into your lifetime score. Performance compounds across every ticker you hold.
        </p>
      ) : null}

      {data.pickHistory.length > 0 ? (
        <div className="community-pick-history">
          <h3>Closed picks</h3>
          <ol>
            {data.pickHistory.map((entry) => (
              <li key={`${entry.ticker}-${entry.closedAt}`}>
                <strong>{entry.ticker}</strong>
                <span className={`is-${returnTone(entry.pickReturnPct)}`}>
                  {formatReturn(entry.pickReturnPct)}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {error ? <p className="h2h-error">{error}</p> : null}

      <div className="community-standings">
        <div className="community-standings-head">
          <h3>Community standings</h3>
          <span>Average lifetime return</span>
        </div>
        {data.standings.length === 0 ? (
          <p className="crowd-empty">Standings begin with the first community pick.</p>
        ) : (
          <ol>
            {(() => {
              let rank = 0;
              return data.standings.map((standing) => {
                if (standing.ranked) rank += 1;
                return (
                  <li key={standing.groupId} className={standing.ranked ? undefined : "is-unranked"}>
                    <span className="community-standing-rank">
                      {standing.ranked ? rank : "—"}
                    </span>
                    <span className="community-standing-name">
                      <strong>{standing.name}</strong>
                      <small>
                        {standing.pickCount} {standing.pickCount === 1 ? "member" : "members"}
                        {!standing.ranked && standing.pickCount > 0 ? " · unranked" : ""}
                      </small>
                    </span>
                    <strong className={`community-standing-return is-${returnTone(standing.avgLifetimeReturnPct)}`}>
                      {formatReturn(standing.avgLifetimeReturnPct)}
                    </strong>
                  </li>
                );
              });
            })()}
          </ol>
        )}
      </div>
    </section>
  );
}
