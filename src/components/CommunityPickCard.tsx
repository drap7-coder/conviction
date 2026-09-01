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

  async function savePick() {
    if (!ticker.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/community-picks", {
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
          <div
            className="community-pick-current"
            style={
              data.viewerGroup?.accentColor
                ? { ["--campus-accent" as string]: data.viewerGroup.accentColor }
                : undefined
            }
          >
            <strong className="community-pick-ticker">{data.viewerPick.ticker}</strong>
            <span className={`is-${returnTone(data.viewerPick.returnPct)}`}>
              {formatReturn(data.viewerPick.returnPct)}
            </span>
          </div>
        ) : null}
      </div>

      {!data.authenticated ? (
        <Link href="/signin" className="brief-link">Sign in to pick a stock</Link>
      ) : !data.viewerGroup ? (
        <p className="community-pick-note">Join a community above to pick a stock.</p>
      ) : (
        <div className="community-pick-compose">
          <label>
            <span>{data.viewerPick ? "Change ticker" : "Ticker"}</span>
            <input
              value={ticker}
              onChange={(event) => setTicker(event.target.value.toUpperCase())}
              onKeyDown={(event) => {
                if (event.key === "Enter") void savePick();
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
            onClick={() => void savePick()}
          >
            {busy ? "Saving…" : data.viewerPick ? "Change pick" : "Set pick"}
          </button>
        </div>
      )}

      {data.viewerPick ? (
        <p className="community-pick-note">
          Performance starts from ${data.viewerPick.entryPrice.toFixed(2)}. Changing your ticker starts fresh.
        </p>
      ) : null}
      {error ? <p className="h2h-error">{error}</p> : null}

      <div className="community-standings">
        <div className="community-standings-head">
          <h3>Community standings</h3>
          <span>Average member return</span>
        </div>
        {data.standings.length === 0 ? (
          <p className="crowd-empty">Standings begin with the first community pick.</p>
        ) : (
          <ol>
            {data.standings.map((standing, index) => (
              <li
                key={standing.groupId}
                className={
                  standing.groupId === data.viewerGroup?.groupId ? "is-yours" : undefined
                }
              >
                <span className="community-standing-rank">{index + 1}</span>
                <span className="community-standing-name">
                  <strong>{standing.name}</strong>
                  <small>{standing.pickCount} {standing.pickCount === 1 ? "pick" : "picks"}</small>
                </span>
                <strong className={`community-standing-return is-${returnTone(standing.avgReturnPct)}`}>
                  {formatReturn(standing.avgReturnPct)}
                </strong>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
