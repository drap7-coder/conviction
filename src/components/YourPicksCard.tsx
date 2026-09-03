"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { LogoDisplay } from "@/app/components/LogoDisplay";
import { CompanyTypeahead } from "@/components/CompanyTypeahead";
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
import {
  formatUsd,
  formatUsdDelta,
  notionalDeltaUsd,
  notionalValueUsd,
  PLAYER_BANKROLL_USD,
} from "@/lib/community-picks/notional";
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

function successCopy(input: { label: string; isSwap: boolean; filledCount: number }): string {
  if (input.isSwap) return `Swapped to ${input.label}.`;
  if (input.filledCount >= CALLS_REQUIRED) {
    return `${input.label} locked in · board complete.`;
  }
  return `${input.label} added · ${input.filledCount}/${CALLS_REQUIRED} picks.`;
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
  const [addingStock, setAddingStock] = useState(false);
  const [intlOpen, setIntlOpen] = useState(false);
  const [justSavedSlot, setJustSavedSlot] = useState<CallSlot | null>(null);

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

  useEffect(() => {
    if (!justSavedSlot && !success) return;
    const timer = window.setTimeout(() => {
      setJustSavedSlot(null);
      setSuccess(null);
    }, 3200);
    return () => window.clearTimeout(timer);
  }, [justSavedSlot, success]);

  const picks = data?.viewerPicks ?? {};
  const filledCount = data?.filledCount ?? 0;
  const complete = data?.boardComplete ?? false;
  const addSlot = nextEmptyStockSlot(picks);

  const stockActionLabel = useMemo(() => {
    if (editingStock && picks[editingStock]) return "Confirm Swap";
    return "Save Pick";
  }, [editingStock, picks]);

  async function commit(callSlot: CallSlot, asset: string, isSwap: boolean, labelHint?: string) {
    setBusySlot(callSlot);
    setError(null);
    setSuccess(null);
    try {
      const payload = await saveOrSwap({ callSlot, asset, isSwap });
      const saved = payload.viewerPicks[callSlot];
      const label = saved?.label ?? labelHint ?? asset;
      setData(payload);
      setSuccess(
        successCopy({
          label,
          isSwap,
          filledCount: payload.filledCount,
        }),
      );
      setJustSavedSlot(callSlot);
      setStockDraft("");
      setEditingStock(null);
      setAddingStock(false);
      setIntlOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save pick.");
    } finally {
      setBusySlot(null);
    }
  }

  function openAddStock() {
    setEditingStock(null);
    setStockDraft("");
    setAddingStock(true);
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

      {success ? (
        <p className="your-picks-success is-banner" role="status" aria-live="polite">
          <span className="your-picks-check" aria-hidden="true">
            ✓
          </span>
          {success}
        </p>
      ) : null}

      <div className="your-picks-bankroll" aria-label="Your $100,000 performance">
        <div className="your-picks-bankroll-main">
          <p className="your-picks-bankroll-label">Starting book</p>
          <strong className="your-picks-bankroll-start">{formatUsd(PLAYER_BANKROLL_USD)}</strong>
        </div>
        <div className="your-picks-bankroll-perf">
          <p className="your-picks-bankroll-label">Performance</p>
          {data.iqbullsReturnPct !== null ? (
            <>
              <strong className={`your-picks-bankroll-value is-${returnTone(data.iqbullsReturnPct)}`}>
                {formatUsd(notionalValueUsd(data.iqbullsReturnPct) ?? PLAYER_BANKROLL_USD)}
              </strong>
              <span className={`your-picks-bankroll-delta is-${returnTone(data.iqbullsReturnPct)}`}>
                {formatUsdDelta(notionalDeltaUsd(data.iqbullsReturnPct))}
                <em>({formatReturn(data.iqbullsReturnPct)})</em>
              </span>
            </>
          ) : (
            <>
              <strong className="your-picks-bankroll-value is-quiet">
                {formatUsd(PLAYER_BANKROLL_USD)}
              </strong>
              <span className="your-picks-bankroll-delta is-quiet">Add a pick to start</span>
            </>
          )}
        </div>
      </div>

      <div className="your-picks-section">
        <h3 className="your-picks-section-label">Stocks</h3>
        <ul className="your-picks-stock-list">
          {STOCK_SLOTS.map((slot) => {
            const pick = picks[slot];
            if (!pick) return null;
            const editing = editingStock === slot;
            const justSaved = justSavedSlot === slot;
            return (
              <li
                key={slot}
                className={`your-picks-stock-row${justSaved ? " is-just-saved" : ""}`}
              >
                <button
                  type="button"
                  className="your-picks-stock-main"
                  aria-pressed={editing}
                  onClick={() => {
                    setAddingStock(false);
                    setEditingStock(editing ? null : slot);
                    setStockDraft(pick.assetId);
                  }}
                >
                  <span className="your-picks-asset">
                    <span className="your-picks-logo" aria-hidden="true">
                      <LogoDisplay ticker={pick.pricingSymbol} size="badge" />
                    </span>
                    <strong>{pick.label}</strong>
                    {justSaved ? (
                      <span className="your-picks-added-chip">Added</span>
                    ) : null}
                  </span>
                  <span className={`your-picks-return is-${returnTone(pick.lifetimeReturnPct)}`}>
                    {formatReturn(pick.lifetimeReturnPct)}
                  </span>
                </button>
                {editing ? (
                  <div className="your-picks-editor">
                    <CompanyTypeahead
                      value={stockDraft}
                      onChange={(value) => setStockDraft(normalizeTickerInput(value))}
                      onSelect={(suggestion) => {
                        const ticker = suggestion.ticker.toUpperCase();
                        setStockDraft(ticker);
                        if (ticker !== pick.assetId) {
                          void commit(slot, ticker, true, ticker);
                        }
                      }}
                      onEnter={() => {
                        if (
                          TICKER_INPUT_PATTERN.test(stockDraft)
                          && stockDraft !== pick.assetId
                          && busySlot === null
                        ) {
                          void commit(slot, stockDraft, true, stockDraft);
                        }
                      }}
                      placeholder="Ticker or company"
                      inputAriaLabel="Swap stock ticker"
                      disabled={busySlot !== null}
                      autoCapitalize="characters"
                      className="your-picks-typeahead-input"
                      wrapperClassName="your-picks-typeahead"
                    />
                    <button
                      type="button"
                      className="your-picks-save"
                      disabled={
                        busySlot !== null
                        || !TICKER_INPUT_PATTERN.test(stockDraft)
                        || stockDraft === pick.assetId
                      }
                      onClick={() => void commit(slot, stockDraft, true, stockDraft)}
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
            {!addingStock ? (
              <button
                type="button"
                className="your-picks-add-trigger"
                onClick={openAddStock}
              >
                + Add stock
              </button>
            ) : (
              <div className="your-picks-editor">
                <CompanyTypeahead
                  value={stockDraft}
                  onChange={(value) => {
                    setEditingStock(null);
                    setStockDraft(normalizeTickerInput(value));
                  }}
                  onSelect={(suggestion) => {
                    const ticker = suggestion.ticker.toUpperCase();
                    setStockDraft(ticker);
                    void commit(addSlot, ticker, false, ticker);
                  }}
                  onEnter={() => {
                    if (TICKER_INPUT_PATTERN.test(stockDraft) && busySlot === null) {
                      void commit(addSlot, stockDraft, false, stockDraft);
                    }
                  }}
                  placeholder="Ticker or company"
                  inputAriaLabel="Add stock ticker"
                  disabled={busySlot !== null}
                  autoCapitalize="characters"
                  className="your-picks-typeahead-input"
                  wrapperClassName="your-picks-typeahead"
                />
                <button
                  type="button"
                  className="your-picks-save"
                  disabled={busySlot !== null || !TICKER_INPUT_PATTERN.test(stockDraft)}
                  onClick={() => void commit(addSlot, stockDraft, false, stockDraft)}
                >
                  {busySlot === addSlot ? "Saving…" : "Save Pick"}
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>

      <div className="your-picks-section">
        <h3 className="your-picks-section-label">Bitcoin or Gold</h3>
        <div className="your-picks-binary" role="group" aria-label="Bitcoin or Gold">
          {BTC_GOLD_ASSETS.map((asset) => {
            const active = picks.BTC_GOLD?.assetId === asset.id;
            const isSwap = Boolean(picks.BTC_GOLD);
            const justSaved = justSavedSlot === "BTC_GOLD" && active;
            return (
              <button
                key={asset.id}
                type="button"
                className={`your-picks-binary-btn${active ? " is-active" : ""}${justSaved ? " is-just-saved" : ""}`}
                disabled={busySlot !== null}
                aria-pressed={active}
                onClick={() => {
                  if (active) return;
                  void commit("BTC_GOLD", asset.id, isSwap, asset.label);
                }}
              >
                <span className="your-picks-asset">
                  <span>{asset.label}</span>
                  {justSaved ? <span className="your-picks-added-chip">Added</span> : null}
                </span>
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
            className={`your-picks-intl-current${justSavedSlot === "INTERNATIONAL" ? " is-just-saved" : ""}`}
            onClick={() => setIntlOpen((open) => !open)}
          >
            <span className="your-picks-asset">
              <strong>{picks.INTERNATIONAL.label}</strong>
              {justSavedSlot === "INTERNATIONAL" ? (
                <span className="your-picks-added-chip">Added</span>
              ) : null}
            </span>
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
                    void commit(
                      "INTERNATIONAL",
                      asset.id,
                      Boolean(picks.INTERNATIONAL),
                      asset.label,
                    )
                  }
                >
                  <span className="your-picks-asset">
                    <span>{asset.label}</span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {error ? <p className="your-picks-error" role="alert">{error}</p> : null}

      <p className="your-picks-hedge">
        Pick 3 stocks. Choose Bitcoin or Gold. Pick one international market. Equal-weight on a
        $100,000 book.
      </p>
    </section>
  );
}
