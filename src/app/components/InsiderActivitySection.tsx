"use client";

import { useEffect, useState } from "react";
import type { EvidenceEvent } from "@/lib/evidence/types";

interface InsiderActivitySectionProps {
  ticker: string;
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

export function InsiderActivitySection({ ticker }: InsiderActivitySectionProps) {
  const [events, setEvents] = useState<EvidenceEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [fetchMessage, setFetchMessage] = useState<string | null>(null);

  const loadEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/evidence/insider?ticker=${ticker}`);
      const data = await res.json();
      setEvents(data.events ?? []);
      if (!data.events?.length) {
        setError("No insider activity found yet. Try refreshing.");
      }
    } catch {
      setError("Failed to load insider data");
    } finally {
      setLoading(false);
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
      const data = await res.json();
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
    loadEvents();
  }, [ticker]);

  const { grouped, netScore, netShares, label } = groupEvents(events);

  return (
    <div>
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

      {loading ? (
        <div className="evidence-panel">
          <p style={{ color: "var(--quiet)", fontSize: "0.65rem" }}>
            Loading insider transactions...
          </p>
        </div>
      ) : error && events.length === 0 ? (
        <div className="evidence-panel" style={{ borderColor: "var(--amber-dim)" }}>
          <p style={{ color: "var(--muted)", fontSize: "0.65rem" }}>
            {error}
          </p>
        </div>
      ) : events.length === 0 ? (
        <div className="evidence-panel">
          <p style={{ color: "var(--quiet)", fontSize: "0.65rem" }}>
            No insider activity data. Click &quot;Refresh from SEC&quot; to fetch.
          </p>
        </div>
      ) : (
        <>
          {/* Conviction summary */}
          <div className="evidence-grid" style={{ marginBottom: 12 }}>
            <div className="evidence-panel">
              <h3 style={{
                color: label === "bullish" ? "var(--green)" : label === "bearish" ? "var(--red)" : "var(--muted)",
                fontSize: "0.7rem",
                marginBottom: 4,
              }}>
                {label === "bullish" ? "▲ Bullish Insider Activity" :
                 label === "bearish" ? "▼ Bearish Insider Activity" :
                 label === "neutral" ? "◆ Neutral Insider Activity" :
                 "— No Signal"}
              </h3>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.6rem", color: "var(--muted)" }}>
                Conviction score: <span style={{
                  color: netScore > 0 ? "var(--green)" : netScore < 0 ? "var(--red)" : "var(--muted)",
                }}>
                  {netScore > 0 ? "+" : ""}{netScore}
                </span>
              </p>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.6rem", color: "var(--muted)" }}>
                Net shares: <span style={{
                  color: netShares > 0 ? "var(--green)" : netShares < 0 ? "var(--red)" : "var(--muted)",
                }}>
                  {netShares > 0 ? "+" : ""}{netShares.toLocaleString()}
                </span>
              </p>
            </div>
            <div className="evidence-panel">
              <h3 style={{ fontSize: "0.7rem", marginBottom: 4 }}>Past 90 days</h3>
              {grouped.map((g) => (
                <div key={g.type} style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.55rem",
                  color: "var(--muted)",
                  padding: "2px 0",
                }}>
                  <span style={{
                    color: g.color === "positive" ? "var(--green)" :
                           g.color === "negative" ? "var(--red)" : "var(--muted)",
                  }}>
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
        details summary::-webkit-details-marker { color: var(--quiet); }
      `}</style>
    </div>
  );
}