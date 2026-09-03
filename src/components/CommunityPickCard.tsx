"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { LogoDisplay } from "@/app/components/LogoDisplay";
import { SchoolLogo } from "@/components/crowd/SchoolLogo";
import {
  DEFAULT_H2H_PERF_RANGE,
  h2hPerfRangeLabel,
  type H2HPerfRange,
} from "@/lib/competitions/perf-range";
import type { CommunityPicksPayload } from "@/lib/community-picks/types";

const TICKER_INPUT_PATTERN = /^[A-Z][A-Z0-9.-]{0,9}$/;

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

function normalizeTickerInput(value: string): string {
  return value.trim().toUpperCase();
}

function isValidTickerInput(value: string): boolean {
  const ticker = normalizeTickerInput(value);
  return TICKER_INPUT_PATTERN.test(ticker);
}

async function loadCommunityPicksPayload(
  range: H2HPerfRange = DEFAULT_H2H_PERF_RANGE,
): Promise<CommunityPicksPayload> {
  const params = new URLSearchParams();
  params.set("range", range);
  const response = await fetch(`/api/community-picks?${params.toString()}`, {
    cache: "no-store",
    credentials: "include",
  });
  if (!response.ok) throw new Error("Could not load community picks.");
  return response.json() as Promise<CommunityPicksPayload>;
}

export function CommunityPickCard({
  variant = "full",
  range = DEFAULT_H2H_PERF_RANGE,
  initialPayload = null,
}: {
  /** pick = editor only; standings = board only; full = both (legacy). */
  variant?: "pick" | "standings" | "full";
  /** Shared Standings performance window (default YTD). Ignored for pick-only. */
  range?: H2HPerfRange;
  /** From parent `/api/crowd/standings` — skips the standings self-fetch when present. */
  initialPayload?: CommunityPicksPayload | null;
}) {
  const [data, setData] = useState<CommunityPicksPayload | null>(initialPayload);
  const [ticker, setTicker] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const standingsRange = variant === "pick" ? DEFAULT_H2H_PERF_RANGE : range;

  useEffect(() => {
    if (variant === "standings" && initialPayload) {
      setData(initialPayload);
      return;
    }
    let cancelled = false;
    loadCommunityPicksPayload(standingsRange)
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : "Could not load community picks.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [standingsRange, variant, initialPayload]);

  const normalizedTicker = normalizeTickerInput(ticker);
  const hasExistingPick = Boolean(data?.viewerPick);
  const isSameTicker =
    hasExistingPick && normalizedTicker === data?.viewerPick?.assetId.toUpperCase();
  const canSubmit = isValidTickerInput(ticker) && !isSameTicker;

  const actionLabel = useMemo(() => {
    if (busy) return hasExistingPick ? "Swapping…" : "Saving…";
    return hasExistingPick ? "Confirm Swap" : "Save Pick";
  }, [busy, hasExistingPick]);

  const actionHint = useMemo(() => {
    if (!ticker.trim()) {
      return hasExistingPick
        ? "Enter a new ticker, then tap Confirm Swap."
        : "Enter a ticker, then tap Save Pick.";
    }
    if (!isValidTickerInput(ticker)) {
      return "Enter a valid stock or ETF ticker (e.g. AAPL).";
    }
    if (isSameTicker) {
      return "Enter a different ticker to swap.";
    }
    return hasExistingPick
      ? `Swap from ${data?.viewerPick?.assetId} to ${normalizedTicker}. Your current pick will bank into lifetime score.`
      : `Save ${normalizedTicker} as your community pick.`;
  }, [data?.viewerPick?.assetId, hasExistingPick, isSameTicker, normalizedTicker, ticker]);

  async function submitTicker() {
    if (!canSubmit || !data) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    const endpoint = hasExistingPick ? "/api/picks/swap" : "/api/community-picks";
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ticker: normalizedTicker }),
      });
      const payload = (await response.json()) as CommunityPicksPayload & { error?: string };
      if (!response.ok) {
        setError(payload.error ?? (hasExistingPick ? "Could not swap your pick." : "Could not save your pick."));
        return;
      }

      const refreshed = await loadCommunityPicksPayload(standingsRange);
      setData(refreshed);
      setTicker("");
      const savedTicker = refreshed.viewerPick?.assetId ?? normalizedTicker;
      setSuccess(
        hasExistingPick
          ? `Swap confirmed. ${savedTicker} is now your active pick.`
          : `Pick saved. ${savedTicker} is now your active pick.`,
      );
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

  const showPick = variant === "pick" || variant === "full";
  const showStandings = variant === "standings" || variant === "full";

  return (
    <section
      className="surface-shell community-pick-card"
      aria-label={variant === "standings" ? "Community standings" : "Community picks"}
    >
      {showPick ? (
        <>
          <div className="community-pick-head">
            <div className="community-pick-title">
              {data.viewerGroup ? (
                <SchoolLogo
                  name={data.viewerGroup.name}
                  domain={data.viewerGroup.domain}
                  ncaaId={data.viewerGroup.ncaaId}
                  accentColor={data.viewerGroup.accentColor ?? data.viewerGroup.primaryColor}
                  size={36}
                  className="community-pick-school-logo"
                />
              ) : null}
              <div>
                <p className="community-pick-eyebrow">Your community pick</p>
                <h2>{data.viewerGroup?.name ?? "Choose a community"}</h2>
              </div>
            </div>
            {data.viewerPick ? (
              <div className="community-pick-current">
                <span className="crowd-logo community-pick-ticker-logo" aria-hidden="true">
                  <LogoDisplay ticker={data.viewerPick.assetId} size="detail" />
                </span>
                <strong>{data.viewerPick.assetId}</strong>
                <span className={`is-${returnTone(data.viewerPick.lifetimeReturnPct)}`}>
                  {formatReturn(data.viewerPick.lifetimeReturnPct)}
                </span>
              </div>
            ) : null}
          </div>

          {!data.authenticated ? (
            <Link href="/signin" className="brief-link">Sign in to pick a stock</Link>
          ) : !data.viewerGroup ? (
            <p className="community-pick-note">Join a community to pick a stock.</p>
          ) : data.viewerPick ? (
            <div className="community-pick-metrics">
              <div>
                <span className="community-pick-metric-label">Active ticker</span>
                <strong className="community-pick-ticker-row">
                  <span className="crowd-logo community-pick-ticker-logo" aria-hidden="true">
                    <LogoDisplay ticker={data.viewerPick.assetId} size="detail" />
                  </span>
                  {data.viewerPick.assetId}
                </strong>
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
            <div className="community-pick-editor">
              <div className="community-pick-editor-head">
                <h3>{hasExistingPick ? "Change your pick" : "Set your pick"}</h3>
                {hasExistingPick ? (
                  <span className="community-pick-editor-current">
                    Active:{" "}
                    <span className="community-pick-ticker-row">
                      <span className="crowd-logo community-pick-ticker-logo is-compact" aria-hidden="true">
                        <LogoDisplay ticker={data.viewerPick!.assetId} size="badge" />
                      </span>
                      <strong>{data.viewerPick?.assetId}</strong>
                    </span>
                  </span>
                ) : null}
              </div>

              <label className="community-pick-editor-field">
                <span>{hasExistingPick ? "New ticker" : "Ticker"}</span>
                <input
                  value={ticker}
                  onChange={(event) => {
                    setTicker(event.target.value.toUpperCase());
                    setError(null);
                    setSuccess(null);
                  }}
                  placeholder="AAPL"
                  autoComplete="off"
                  spellCheck={false}
                  inputMode="text"
                  aria-describedby="community-pick-action-hint"
                  disabled={busy}
                />
              </label>

              <p id="community-pick-action-hint" className="community-pick-editor-hint">
                {actionHint}
              </p>

              <button
                type="button"
                className="watchlist-add-button community-pick-action"
                disabled={busy || !canSubmit}
                aria-busy={busy}
                onClick={() => void submitTicker()}
              >
                {actionLabel}
              </button>

              {success ? (
                <p className="community-pick-success" role="status">
                  {success}
                </p>
              ) : null}
              {error ? (
                <p className="community-pick-error h2h-error" role="alert">
                  {error}
                </p>
              ) : null}
            </div>
          ) : null}

          {data.pickHistory.length > 0 ? (
            <div className="community-pick-history">
              <h3>Closed picks</h3>
              <ol>
                {data.pickHistory.map((entry) => (
                  <li key={`${entry.assetId}-${entry.closedAt}`}>
                    <span className="community-pick-ticker-row">
                      <span className="crowd-logo community-pick-ticker-logo is-compact" aria-hidden="true">
                        <LogoDisplay ticker={entry.assetId} size="badge" />
                      </span>
                      <strong>{entry.assetId}</strong>
                    </span>
                    <span className={`is-${returnTone(entry.pickReturnPct)}`}>
                      {formatReturn(entry.pickReturnPct)}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </>
      ) : null}

      {showStandings ? (
        <div className={`community-standings${showPick ? "" : " is-standalone"}`}>
          <div className="community-standings-head">
            <h3>Community standings</h3>
            <span>
              {standingsRange === "1d" || data.range === "1d"
                ? "Today's average return"
                : `Average ${h2hPerfRangeLabel(data.range ?? standingsRange)} return`}
            </span>
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
                      <span className="community-standing-school">
                        <SchoolLogo
                          name={standing.name}
                          domain={standing.domain}
                          ncaaId={standing.ncaaId}
                          accentColor={standing.accentColor ?? standing.primaryColor}
                          size={28}
                        />
                        <span className="community-standing-name">
                          <strong>{standing.name}</strong>
                          <small>
                            {standing.pickCount} {standing.pickCount === 1 ? "member" : "members"}
                            {!standing.ranked && standing.pickCount > 0 ? " · unranked" : ""}
                          </small>
                        </span>
                      </span>
                      <strong className={`community-standing-return is-${returnTone(standing.avgReturnPct)}`}>
                        {formatReturn(standing.avgReturnPct)}
                      </strong>
                    </li>
                  );
                });
              })()}
            </ol>
          )}
        </div>
      ) : null}
    </section>
  );
}
