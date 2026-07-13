"use client";

import { useEffect, useState } from "react";
import type { EvidenceEvent } from "@/lib/evidence/types";

interface InsiderActivitySectionProps {
  ticker: string;
}

const TX_CLASS_LABELS: Record<string, string> = {
  "open-market-purchase": "OPEN-MARKET BUY",
  "open-market-sale": "OPEN-MARKET SALE",
  "grant": "GRANT",
  "exercise": "EXERCISE",
  "tax-withholding": "TAX WITHHOLDING",
  "automatic-plan-sale": "PLAN SALE",
  "disposition": "DISPOSITION",
  "gift": "GIFT",
  "other": "OTHER",
};

const TX_CLASS_COLORS: Record<string, string> = {
  "open-market-purchase": "positive",
  "open-market-sale": "negative",
  "grant": "neutral",
  "exercise": "neutral",
  "tax-withholding": "neutral",
  "automatic-plan-sale": "negative",
  "disposition": "neutral",
  "gift": "neutral",
  "other": "neutral",
};

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

  return (
    <div>
      <div className="section-header mt-16">
        <h2 className="section-title">Insider activity (SEC Form 4)</h2>
        <div className="flex items-center gap-8">
          {events.length > 0 ? (
            <span className="section-count">{events.length} events</span>
          ) : null}
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
            No insider activity data. Click "Refresh from SEC" to fetch.
          </p>
        </div>
      ) : (
        <div className="insider-table">
          <div className="insider-table-header">
            <span className="insider-th">Insider</span>
            <span className="insider-th">Role</span>
            <span className="insider-th">Type</span>
            <span className="insider-th">Date</span>
            <span className="insider-th">Shares</span>
            <span className="insider-th">Value</span>
            <span className="insider-th">Δ Own</span>
          </div>
          {events.map((e, i) => {
            const m = e.metadata;
            const cls = m?.transactionClass || "other";
            const colorClass = TX_CLASS_COLORS[cls] || "neutral";
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
                  {TX_CLASS_LABELS[cls] || "OTHER"}
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