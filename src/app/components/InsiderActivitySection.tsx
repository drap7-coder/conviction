"use client";

import { useEffect, useState } from "react";
import type { EvidenceEvent } from "@/lib/evidence/types";
import { classifyClientError, fetchJsonWithTimeout, type EvidenceStatus } from "./evidence-request";
import { inkBoxClass, inkChipClass, inkToneFromSemantic } from "@/lib/display/ink-tone";

interface InsiderActivitySectionProps {
  ticker: string;
  /** Hide the section h2 when nested inside Conviction Signals. */
  hideHeader?: boolean;
}

const TX_TYPE_LABELS: Record<string, string> = {
  purchase: "Open Market Purchase",
  sale: "Open Market Sale",
  grant: "Equity Grant",
  option_exercise: "Option Exercise",
  gift: "Gift",
  tax_withholding: "Tax Withholding",
  other: "Other",
};

const TX_TYPE_COLORS: Record<string, string> = {
  purchase: "positive",
  sale: "negative",
  grant: "neutral",
  option_exercise: "neutral",
  gift: "neutral",
  tax_withholding: "neutral",
  other: "neutral",
};

interface GroupedCount {
  type: string;
  label: string;
  count: number;
  totalShares: number;
  totalValue: number | null;
  color: string;
}

function groupEvents(events: EvidenceEvent[]): {
  grouped: GroupedCount[];
  netScore: number;
  netShares: number;
  label: "bullish" | "bearish" | "neutral" | "no_signal";
} {
  const byType = new Map<string, EvidenceEvent[]>();
  for (const e of events) {
    const t = e.metadata?.transactionType || "other";
    if (!byType.has(t)) byType.set(t, []);
    byType.get(t)!.push(e);
  }

  let netScore = 0;
  let netShares = 0;
  const grouped: GroupedCount[] = [];

  for (const [type, txs] of byType) {
    const totalShares = txs.reduce((s, e) => s + (e.metadata?.shares || 0), 0);
    const totalValue = txs.reduce((s, e) => s + (e.metadata?.totalValue || 0), 0);

    if (type === "purchase") {
      netScore += Math.round(totalValue / 1000);
      netShares += totalShares;
    } else if (type === "sale") {
      netScore -= Math.round(totalValue / 1000 * 0.4);
      netShares -= totalShares;
    }

    grouped.push({
      type,
      label: TX_TYPE_LABELS[type] || type,
      count: txs.length,
      totalShares,
      totalValue: totalValue > 0 ? totalValue : null,
      color: TX_TYPE_COLORS[type] || "neutral",
    });
  }

  grouped.sort((a, b) => {
    const order: Record<string, number> = { purchase: 0, sale: 1, grant: 2, option_exercise: 3, gift: 4, tax_withholding: 5, other: 6 };
    return (order[a.type] ?? 99) - (order[b.type] ?? 99);
  });

  const label = netScore >= 50 ? "bullish" : netScore <= -50 ? "bearish" : "neutral";

  return { grouped, netScore, netShares, label };
}

export function InsiderActivitySection({ ticker, hideHeader = false }: InsiderActivitySectionProps) {
  const [events, setEvents] = useState<EvidenceEvent[]>([]);
  const [status, setStatus] = useState<EvidenceStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [fetchMessage, setFetchMessage] = useState<string | null>(null);

  const loadEvents = async (signal?: AbortSignal) => {
    setStatus("loading");
    setError(null);
    try {
      const data = await fetchJsonWithTimeout<{ events?: EvidenceEvent[]; source?: string }>(
        `/api/evidence/insider?ticker=${ticker}`,
        14_000,
        signal,
      );
      setEvents(data.events ?? []);
      if (!data.events?.length) {
        setStatus(data.source === "error" ? "error" : "empty");
        setError(data.source === "error"
          ? "Insider transaction data is temporarily unavailable."
          : "No qualifying insider purchases found in the current window.");
      } else {
        setStatus("success");
      }
    } catch (caught) {
      const nextStatus = classifyClientError(caught);
      if (nextStatus !== "idle") {
        setStatus(nextStatus);
        setError(nextStatus === "timeout"
          ? "Insider transaction data is temporarily unavailable."
          : nextStatus === "unsupported"
            ? "This issuer is not currently supported."
            : "Insider transaction data could not be loaded.");
      }
    }
  };

  const handleRefresh = async () => {
    setFetching(true);
    setFetchMessage("Fetching SEC data...");
    try {
      const res = await fetch("/api/evidence/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFetchMessage(
          typeof data.error === "string"
            ? data.error
            : res.status === 429
              ? "Refresh rate-limited. Try again shortly."
              : "Refresh failed. SEC may be rate-limiting.",
        );
        return;
      }
      const result = data.results?.[ticker];
      if (result) {
        setFetchMessage(
          result.newEvents > 0
            ? `Found ${result.newEvents} new transaction${result.newEvents > 1 ? "s" : ""}. Reloaded.`
            : result.totalEvents > 0
              ? `${result.totalEvents} transactions found (all previously seen).`
              : "No new transactions found.",
        );
        if (result.errors?.length) {
          setFetchMessage((prev) => `${prev} ${result.errors.length} errors.`);
        }
      }
      await loadEvents();
    } catch {
      setFetchMessage("Refresh failed. SEC may be rate-limiting.");
    } finally {
      setFetching(false);
      setTimeout(() => setFetchMessage(null), 5000);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    loadEvents(controller.signal);
    return () => controller.abort();
  }, [ticker]);

  const { grouped, netScore, netShares, label } = groupEvents(events);

  return (
    <div>
      {hideHeader ? (
        <div className="conviction-signal-detail-toolbar">
          <button
            onClick={handleRefresh}
            disabled={fetching}
            type="button"
            className="retry-button"
          >
            {fetching ? "Fetching…" : "Refresh from SEC"}
          </button>
          {fetchMessage ? <span className="section-count">{fetchMessage}</span> : null}
        </div>
      ) : (
        <>
          <div className="section-header mt-16">
            <h2 className="section-title">Insider activity (SEC Form 4)</h2>
            <div className="flex items-center gap-8">
              <button
                onClick={handleRefresh}
                disabled={fetching}
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.55rem",
                  color: "var(--accent)",
                  background: "var(--accent-dim)",
                  padding: "2px 8px",
                  borderRadius: "var(--radius)",
                  border: "none",
                  cursor: fetching ? "wait" : "pointer",
                }}
              >
                {fetching ? "Fetching..." : "Refresh from SEC"}
              </button>
            </div>
          </div>

          {fetchMessage ? (
            <p style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.55rem",
              color: "var(--muted)",
              marginBottom: 8,
            }}>
              {fetchMessage}
            </p>
          ) : null}
        </>
      )}

      {status === "loading" || status === "idle" ? (
        <div className={`evidence-panel ${inkBoxClass("quiet")}`}>
          <p style={{ color: "var(--quiet)", fontSize: "0.65rem" }}>
            Loading insider transactions...
          </p>
        </div>
      ) : error && events.length === 0 ? (
        <div className={`evidence-panel ${inkBoxClass("amber")}`}>
          <p style={{ color: "var(--muted)", fontSize: "0.65rem" }}>
            {error}
          </p>
          {(status === "timeout" || status === "error") ? (
            <button className="retry-button" type="button" onClick={() => loadEvents()}>
              Retry
            </button>
          ) : null}
        </div>
      ) : events.length === 0 ? (
        <div className={`evidence-panel ${inkBoxClass("quiet")}`}>
          <p style={{ color: "var(--quiet)", fontSize: "0.65rem" }}>
            No insider activity data. Click &quot;Refresh from SEC&quot; to fetch.
          </p>
        </div>
      ) : (
        <>
          {/* Conviction summary */}
          <div className="evidence-grid" style={{ marginBottom: 12 }}>
            <div className={`evidence-panel ${inkBoxClass(
              label === "bullish" ? "up" : label === "bearish" ? "down" : "quiet",
            )}`}>
              <h3 style={{ fontSize: "0.7rem", marginBottom: 8 }}>
                <span className={inkChipClass(
                  label === "bullish" ? "up" : label === "bearish" ? "down" : "quiet",
                )}>
                  {label === "bullish" ? "Constructive insider activity" :
                   label === "bearish" ? "Adverse insider activity" :
                   label === "neutral" ? "Neutral insider activity" :
                   "No signal"}
                </span>
              </h3>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.6rem", color: "var(--muted)" }}>
                Conviction score:{" "}
                <span className={inkChipClass(
                  netScore > 0 ? "up" : netScore < 0 ? "down" : "quiet",
                )}>
                  {netScore > 0 ? "+" : ""}{netScore}
                </span>
              </p>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.6rem", color: "var(--muted)", marginTop: 6 }}>
                Net shares:{" "}
                <span className={inkChipClass(
                  netShares > 0 ? "up" : netShares < 0 ? "down" : "quiet",
                )}>
                  {netShares > 0 ? "+" : ""}{netShares.toLocaleString()}
                </span>
              </p>
            </div>
            <div className={`evidence-panel ${inkBoxClass("quiet")}`}>
              <h3 style={{ fontSize: "0.7rem", marginBottom: 8 }}>Past 90 days</h3>
              {grouped.map((g) => (
                <div key={g.type} style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 8,
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.55rem",
                  color: "var(--muted)",
                  padding: "4px 0",
                }}>
                  <span className={inkChipClass(inkToneFromSemantic(g.color))}>
                    {g.count} {g.label}
                  </span>
                  <span>{g.totalShares.toLocaleString()} shares{g.totalValue ? ` / $${(g.totalValue / 1000).toFixed(0)}K` : ""}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Transaction table (collapsible detail) */}
          <details>
            <summary style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.55rem",
              color: "var(--quiet)",
              cursor: "pointer",
              marginBottom: 8,
            }}>
              Show all {events.length} transactions
            </summary>
            <div className="insider-table">
              <div className="insider-table-header">
                <span className="insider-th">Insider</span>
                <span className="insider-th">Role</span>
                <span className="insider-th">Type</span>
                <span className="insider-th">Date</span>
                <span className="insider-th">Shares</span>
                <span className="insider-th">Value</span>
                <span className="insider-th">After</span>
              </div>
              {events.map((e) => {
                const m = e.metadata;
                const tt = m?.transactionType || "other";
                const colorClass = TX_TYPE_COLORS[tt] || "neutral";
                return (
                  <a
                    key={e.id}
                    href={e.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`insider-row insider-${colorClass}`}
                  >
                    <span className="insider-name">{m?.insiderName || "—"}</span>
                    <span className="insider-role">{m?.insiderRole || "—"}</span>
                    <span className={`insider-tag insider-tag-${colorClass}`}>
                      {TX_TYPE_LABELS[tt] || "OTHER"}
                    </span>
                    <span className="insider-date">{e.date}</span>
                    <span className="insider-num">{m?.shares?.toLocaleString() || "—"}</span>
                    <span className="insider-num">
                      {m?.totalValue
                        ? m.totalValue >= 1_000_000
                          ? `$${(m.totalValue / 1_000_000).toFixed(1)}M`
                          : `$${(m.totalValue / 1_000).toFixed(0)}K`
                        : "—"}
                    </span>
                    <span className="insider-num">
                      {m?.sharesOwnedAfter ? m.sharesOwnedAfter.toLocaleString() : "—"}
                    </span>
                  </a>
                );
              })}
            </div>
          </details>
        </>
      )}

      <style>{`
        .insider-table {
          display: grid;
          gap: 2px;
          font-size: 0.65rem;
        }
        .insider-table-header {
          display: grid;
          grid-template-columns: 1.2fr 1fr 1fr 0.8fr 0.8fr 0.8fr 0.8fr;
          gap: 4px;
          padding: 4px 8px;
          font-family: var(--font-mono);
          font-size: 0.5rem;
          color: var(--quiet);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border-bottom: 1px solid var(--border);
        }
        .insider-row {
          display: grid;
          grid-template-columns: 1.2fr 1fr 1fr 0.8fr 0.8fr 0.8fr 0.8fr;
          gap: 4px;
          padding: 5px 8px;
          text-decoration: none;
          color: var(--ink);
          border-radius: 2px;
          transition: background 0.1s;
        }
        .insider-row:hover {
          background: var(--surface-elevated);
        }
        .insider-positive { border-left: 2px solid var(--green); }
        .insider-negative { border-left: 2px solid var(--red); }
        .insider-neutral { border-left: 2px solid var(--border); }
        .insider-name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .insider-role { color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .insider-date { color: var(--muted); font-family: var(--font-mono); }
        .insider-num { font-family: var(--font-mono); color: var(--muted); text-align: right; }
        .insider-tag {
          font-family: var(--font-mono);
          font-size: 0.5rem;
          padding: 1px 5px;
          border-radius: 2px;
          text-align: center;
          white-space: nowrap;
        }
        .insider-tag-positive { color: var(--green); background: var(--green-dim); }
        .insider-tag-negative { color: var(--red); background: var(--red-dim); }
        .insider-tag-neutral { color: var(--muted); background: var(--surface-elevated); }
      `}</style>
    </div>
  );
}
