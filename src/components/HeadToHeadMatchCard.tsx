"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { HeadToHeadPayload } from "@/lib/competitions/types";

function formatReturn(value: number | null): string {
  if (value === null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function returnTone(value: number | null): "up" | "down" | "quiet" {
  if (value === null) return "quiet";
  if (value > 0) return "up";
  if (value < 0) return "down";
  return "quiet";
}

export function HeadToHeadMatchCard() {
  const [data, setData] = useState<HeadToHeadPayload | null>(null);
  const [ticker, setTicker] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  async function reload() {
    const res = await fetch("/api/competitions/active", { cache: "no-store", credentials: "include" });
    if (!res.ok) return;
    setData((await res.json()) as HeadToHeadPayload);
  }

  useEffect(() => {
    void reload();
  }, []);

  if (data === null) {
    return (
      <section className="surface-shell h2h-card h2h-card--empty" aria-label="Weekly rivalry">
        <p className="crowd-empty">Loading weekly rivalry…</p>
      </section>
    );
  }

  if (!data.available || !data.competition || !data.groupA || !data.groupB) {
    return (
      <section className="surface-shell h2h-card h2h-card--empty" aria-label="Weekly rivalry">
        <p className="crowd-empty">
          Weekly rivalry opens when a head-to-head is active. Join a community above, then check back.
        </p>
      </section>
    );
  }

  const { competition, groupA, groupB, statusLabel, viewer } = data;
  const accentA = groupA.primaryColor ?? "#115740";
  const accentB = groupB.primaryColor ?? "#D6001C";

  async function submitPick() {
    if (viewer.kind !== "can_submit") return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/competitions/picks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          competitionId: competition.id,
          groupId: viewer.groupId,
          ticker: ticker.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage(json.error ?? "Could not submit pick.");
        return;
      }
      setModalOpen(false);
      setTicker("");
      await reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="surface-shell h2h-card" aria-label="Weekly rivalry">
      <div className="h2h-card-head">
        <div className="h2h-rivalry">
          <span className="h2h-school" style={{ ["--h2h-accent" as string]: accentA }}>
            {groupA.name}
          </span>
          <span className="h2h-vs">vs</span>
          <span className="h2h-school" style={{ ["--h2h-accent" as string]: accentB }}>
            {groupB.name}
          </span>
        </div>
        <span className={`h2h-status${statusLabel === "Live" ? " is-live" : ""}`}>{statusLabel}</span>
      </div>

      <div className="h2h-scoreboard">
        <div className="h2h-side" style={{ ["--h2h-accent" as string]: accentA }}>
          <strong className={`h2h-return is-${returnTone(groupA.avgReturnPct)}`}>
            {formatReturn(groupA.avgReturnPct)}
          </strong>
          <span className="h2h-picks">{groupA.pickCount} picks submitted</span>
        </div>
        <div className="h2h-side" style={{ ["--h2h-accent" as string]: accentB }}>
          <strong className={`h2h-return is-${returnTone(groupB.avgReturnPct)}`}>
            {formatReturn(groupB.avgReturnPct)}
          </strong>
          <span className="h2h-picks">{groupB.pickCount} picks submitted</span>
        </div>
      </div>

      <div className="h2h-action">
        {viewer.kind === "guest" ? (
          <Link href="/signin" className="brief-link">
            Sign in to submit a weekly pick
          </Link>
        ) : viewer.kind === "not_member" ? (
          <p className="h2h-note">{viewer.message}</p>
        ) : viewer.kind === "can_submit" ? (
          <>
            <button type="button" className="watchlist-add-button" onClick={() => {
              if (viewer.existingTicker && !ticker) setTicker(viewer.existingTicker);
              setModalOpen(true);
            }}>
              {viewer.existingTicker ? "Change Pick" : "Submit Pick"}
            </button>
            {modalOpen ? (
              <div className="h2h-modal" role="dialog" aria-label="Submit weekly pick">
                <label>
                  Ticker
                  <input
                    value={ticker}
                    onChange={(event) => setTicker(event.target.value.toUpperCase())}
                    placeholder="NVDA"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </label>
                <div className="h2h-modal-actions">
                  <button type="button" className="brief-link" onClick={() => setModalOpen(false)}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="watchlist-add-button"
                    disabled={busy || !ticker.trim()}
                    onClick={() => void submitPick()}
                  >
                    {busy ? "Saving…" : "Save pick"}
                  </button>
                </div>
              </div>
            ) : null}
          </>
        ) : viewer.kind === "locked_pick" ? (
          <p className="h2h-note">
            Your Pick: <strong>{viewer.ticker}</strong> ({formatReturn(viewer.returnPct)})
          </p>
        ) : null}
        {message ? <p className="h2h-error">{message}</p> : null}
      </div>
    </section>
  );
}
