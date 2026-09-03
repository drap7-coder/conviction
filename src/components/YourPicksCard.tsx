"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SchoolLogo } from "@/components/crowd/SchoolLogo";
import {
  BTC_GOLD_ASSETS,
  INTERNATIONAL_ASSETS,
} from "@/lib/community-picks/asset-maps";
import {
  CALLS_REQUIRED,
  STOCK_SLOTS,
  type CallSlot,
  type StockSlot,
} from "@/lib/community-picks/call-slots";
import type { CommunityPick, CommunityPicksPayload } from "@/lib/community-picks/types";

const TICKER_INPUT_PATTERN = /^[A-Z][A-Z0-9.-]{0,9}$/;

function formatReturn(value: number | null): string {
  if (value === null) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function returnTone(value: number | null): "up" | "down" | "quiet" {
  if (value === null || value === 0) return "quiet";
  return value > 0 ? "up" : "down";
}

function normalizeTickerInput(value: string): string {
  return value.trim().toUpperCase();
}

async function loadPicks(): Promise<CommunityPicksPayload> {
  const response = await fetch("/api/community-picks", {
    cache: "no-store",
    credentials: "include",
  });
  if (!response.ok) throw new Error("Could not load your picks.");
  return response.json() as Promise<CommunityPicksPayload>;
}

async function saveOrSwap(input: {
  callSlot: CallSlot;
  asset: string;
  isSwap: boolean;
}): Promise<CommunityPicksPayload> {
  const endpoint = input.isSwap ? "/api/picks/swap" : "/api/community-picks";
  const response = await fetch(endpoint, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callSlot: input.callSlot, asset: input.asset }),
  });
  const payload = (await response.json().catch(() => null)) as
    | (CommunityPicksPayload & { error?: string })
    | null;
  if (!response.ok) {
    throw new Error(payload?.error ?? "Could not save pick.");
  }
  return payload as CommunityPicksPayload;
}

function nextEmptyStockSlot(picks: Partial<Record<CallSlot, CommunityPick>>): StockSlot | null {
  for (const slot of STOCK_SLOTS) {
    if (!picks[slot]) return slot;
  }
  return null;
}

/** Your Picks — three stocks, Bitcoin or Gold, one international market. */
export function YourPicksCard() {
  const [data, setData] = useState<CommunityPicksPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busySlot, setBusySlot] = useState<CallSlot | "STOCK_ADD" | null>(null);
  const [stockDraft, setStockDraft] = useState("");
  const [editingStock, setEditingStock] = useState<StockSlot | null>(null);
  const [intlOpen, setIntlOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadPicks()
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : "Could not load your picks.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const picks = data?.viewerPicks ?? {};
  const filledCount = data?.filledCount ?? 0;
  const complete = data?.boardComplete ?? false;
  const addSlot = nextEmptyStockSlot(picks);

  const stockActionLabel = useMemo(() => {
    if (editingStock && picks[editingStock]) return "Confirm Swap";
    return "Save Pick";
  }, [editingStock, picks]);

  async function commit(callSlot: CallSlot, asset: string, isSwap: boolean) {
    setBusySlot(callSlot);
    setError(null);
    setSuccess(null);
    try {
      const payload = await saveOrSwap({ callSlot, asset, isSwap });
      setData(payload);
      setSuccess(isSwap ? "Swap saved." : "Pick saved.");
      setStockDraft("");
      setEditingStock(null);
      setIntlOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save pick.");
    } finally {
      setBusySlot(null);
    }
  }

  if (!data) {
    return (
      <section className="surface-shell your-picks-card" aria-label="Your picks">
        <p className="crowd-empty">{error ?? "Loading your picks…"}</p>
      </section>
    );
  }

  if (!data.authenticated) {
    return (
      <section className="surface-shell your-picks-card" aria-label="Your picks">
        <header className="your-picks-head">
          <div>
            <p className="your-picks-eyebrow">Your Picks</p>
            <h2 className="your-picks-title">Build your track record</h2>
          </div>
        </header>
        <p className="your-picks-lede">
          Pick 3 stocks. Choose Bitcoin or Gold. Pick one international market.
        </p>
        <Link href="/signin" className="brief-link">
          Sign in to start
        </Link>
      </section>
    );
  }

  if (!data.viewerGroup) {
    return (
      <section className="surface-shell your-picks-card" aria-label="Your picks">
        <header className="your-picks-head">
          <div>
            <p className="your-picks-eyebrow">Your Picks</p>
            <h2 className="your-picks-title">Join a campus first</h2>
          </div>
        </header>
        <Link href="/crowd?tab=community" className="brief-link">
          Find your community
        </Link>
      </section>
    );
  }

  const group = data.viewerGroup;
  const progressLabel = complete
    ? "5/5 COMPLETE"
    : `${filledCount}/${CALLS_REQUIRED} PICKS`;

  return (
    <section className="surface-shell your-picks-card" aria-label="Your picks">
      <header className="your-picks-head">
        <div className="your-picks-identity">
          <SchoolLogo
            name={group.name}
            domain={group.domain}
            ncaaId={group.ncaaId}
            accentColor={group.accentColor ?? group.primaryColor}
            size={36}
          />
          <div>
            <p className="your-picks-eyebrow">Your Picks</p>
            <h2 className="your-picks-title">{group.name}</h2>
          </div>
        </div>
        <span className={`your-picks-progress${complete ? " is-complete" : ""}`}>
          {progressLabel}
        </span>
      </header>

      {!complete ? (
        <p className="your-picks-nudge">
          {filledCount}/{CALLS_REQUIRED} picks · complete your picks to join the leaderboard
        </p>
      ) : null}

      <div className="your-picks-section">
        <h3 className="your-picks-section-label">Stocks</h3>
        <ul className="your-picks-stock-list">
          {STOCK_SLOTS.map((slot) => {
            const pick = picks[slot];
            if (!pick) return null;
            const editing = editingStock === slot;
            return (
              <li key={slot} className="your-picks-stock-row">
                <button
                  type="button"
                  className="your-picks-stock-main"
                  onClick={() => {
                    setEditingStock(editing ? null : slot);
                    setStockDraft(pick.assetId);
                  }}
                >
                  <strong>{pick.label}</strong>
                  <span className={`your-picks-return is-${returnTone(pick.lifetimeReturnPct)}`}>
                    {formatReturn(pick.lifetimeReturnPct)}
                  </span>
                </button>
                {editing ? (
                  <div className="your-picks-editor">
                    <input
                      value={stockDraft}
                      onChange={(event) => setStockDraft(normalizeTickerInput(event.target.value))}
                      aria-label="Stock ticker"
                      placeholder="Ticker"
                      maxLength={10}
                      autoCapitalize="characters"
                    />
                    <button
                      type="button"
                      className="your-picks-save"
                      disabled={
                        busySlot !== null
                        || !TICKER_INPUT_PATTERN.test(stockDraft)
                        || stockDraft === pick.assetId
                      }
                      onClick={() => void commit(slot, stockDraft, true)}
                    >
                      {busySlot === slot ? "Saving…" : stockActionLabel}
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>

        {addSlot ? (
          <div className="your-picks-add">
            <button
              type="button"
              className="your-picks-add-trigger"
              onClick={() => {
                setEditingStock(null);
                setStockDraft("");
              }}
            >
              + Add stock
            </button>
            <div className="your-picks-editor">
              <input
                value={editingStock ? "" : stockDraft}
                onChange={(event) => {
                  setEditingStock(null);
                  setStockDraft(normalizeTickerInput(event.target.value));
                }}
                aria-label="Add stock ticker"
                placeholder="Ticker"
                maxLength={10}
                autoCapitalize="characters"
              />
              <button
                type="button"
                className="your-picks-save"
                disabled={
                  busySlot !== null
                  || !TICKER_INPUT_PATTERN.test(stockDraft)
                  || Boolean(editingStock)
                }
                onClick={() => void commit(addSlot, stockDraft, false)}
              >
                {busySlot === addSlot ? "Saving…" : "Save Pick"}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="your-picks-section">
        <h3 className="your-picks-section-label">Bitcoin or Gold</h3>
        <div className="your-picks-binary" role="group" aria-label="Bitcoin or Gold">
          {BTC_GOLD_ASSETS.map((asset) => {
            const active = picks.BTC_GOLD?.assetId === asset.id;
            const isSwap = Boolean(picks.BTC_GOLD);
            return (
              <button
                key={asset.id}
                type="button"
                className={`your-picks-binary-btn${active ? " is-active" : ""}`}
                disabled={busySlot !== null}
                onClick={() => {
                  if (active) return;
                  void commit("BTC_GOLD", asset.id, isSwap);
                }}
              >
                <span>{asset.label}</span>
                {active ? (
                  <em className={`your-picks-return is-${returnTone(picks.BTC_GOLD?.lifetimeReturnPct ?? null)}`}>
                    {formatReturn(picks.BTC_GOLD?.lifetimeReturnPct ?? null)}
                  </em>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="your-picks-section">
        <h3 className="your-picks-section-label">International</h3>
        {picks.INTERNATIONAL ? (
          <button
            type="button"
            className="your-picks-intl-current"
            onClick={() => setIntlOpen((open) => !open)}
          >
            <strong>{picks.INTERNATIONAL.label}</strong>
            <span className={`your-picks-return is-${returnTone(picks.INTERNATIONAL.lifetimeReturnPct)}`}>
              {formatReturn(picks.INTERNATIONAL.lifetimeReturnPct)}
            </span>
          </button>
        ) : (
          <button
            type="button"
            className="your-picks-add-trigger"
            onClick={() => setIntlOpen(true)}
          >
            + Add international market
          </button>
        )}
        {intlOpen ? (
          <div className="your-picks-intl-sheet" role="listbox" aria-label="International markets">
            {INTERNATIONAL_ASSETS.map((asset) => {
              const active = picks.INTERNATIONAL?.assetId === asset.id;
              return (
                <button
                  key={asset.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`your-picks-intl-option${active ? " is-active" : ""}`}
                  disabled={busySlot !== null || active}
                  onClick={() =>
                    void commit("INTERNATIONAL", asset.id, Boolean(picks.INTERNATIONAL))
                  }
                >
                  {asset.label}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {data.iqbullsReturnPct !== null ? (
        <div className="your-picks-iqbulls">
          <span>IQBulls</span>
          <strong className={`your-picks-return is-${returnTone(data.iqbullsReturnPct)}`}>
            {formatReturn(data.iqbullsReturnPct)}
          </strong>
        </div>
      ) : null}

      {error ? <p className="your-picks-error" role="alert">{error}</p> : null}
      {success ? <p className="your-picks-success" role="status">{success}</p> : null}

      <p className="your-picks-hedge">
        Pick 3 stocks. Choose Bitcoin or Gold. Pick one international market. Build your track
        record.
      </p>
    </section>
  );
}
