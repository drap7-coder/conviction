"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";

interface WatchlistEntry {
  ticker: string;
  companyName: string;
  cik?: string;
  addedAt: string;
  lastSyncedAt?: string;
  status: "active" | "unsupported" | "error";
  statusMessage?: string;
}

interface InsiderSummary {
  ticker: string;
  bullish: boolean;
  bearish: boolean;
  purchases: number;
  sales: number;
  netShares: number;
  convictionScore: number;
  breakdown: string;
}

export default function WatchlistPage() {
  const [entries, setEntries] = useState<WatchlistEntry[]>([]);
  const [kvEnabled, setKvEnabled] = useState(false);
  const [insiderSummaries, setInsiderSummaries] = useState<Record<string, InsiderSummary>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add company state
  const [addInput, setAddInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [addMessage, setAddMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  // Removal state
  const [removing, setRemoving] = useState<string | null>(null);

  const loadWatchlist = useCallback(async () => {
    try {
      const res = await fetch("/api/watchlist");
      const data = await res.json();
      setEntries(data.entries ?? []);
      setKvEnabled(data.kvEnabled ?? false);
    } catch {
      setError("Failed to load watchlist");
    }
  }, []);

  const loadInsiderData = useCallback(async () => {
    if (entries.length === 0) return;

    const results: Record<string, InsiderSummary> = {};
    await Promise.all(
      entries
        .filter((e) => e.status === "active")
        .map(async (entry) => {
          try {
            const res = await fetch(`/api/evidence/insider?ticker=${entry.ticker}`);
            if (!res.ok) return;
            const data = await res.json();
            const events = data.events ?? [];
            if (!events.length) return;

            const byType = new Map<string, { count: number; shares: number; value: number }>();
            for (const e of events) {
              const t = e.metadata?.transactionType || "other";
              const row = byType.get(t) || { count: 0, shares: 0, value: 0 };
              row.count++;
              row.shares += e.metadata?.shares || 0;
              row.value += e.metadata?.totalValue || 0;
              byType.set(t, row);
            }

            const purchases = byType.get("purchase");
            const sales = byType.get("sale");
            const netShares = (purchases?.shares || 0) - (sales?.shares || 0);
            const purchaseValue = purchases?.value || 0;
            const saleValue = (sales?.value || 0) * 0.4;
            const convictionScore = Math.round((purchaseValue - saleValue) / 1000);

            const parts: string[] = [];
            const order = ["purchase", "sale", "grant", "option_exercise", "gift", "tax_withholding", "other"];
            for (const t of order) {
              const row = byType.get(t);
              if (row) parts.push(`${row.count} ${t.replace(/_/g, " ")}`);
            }

            results[entry.ticker] = {
              ticker: entry.ticker,
              bullish: netShares > 0 && convictionScore > 0,
              bearish: netShares < 0 || convictionScore < -50,
              purchases: purchases?.count || 0,
              sales: sales?.count || 0,
              netShares,
              convictionScore,
              breakdown: parts.join(", "),
            };
          } catch {
            // ignore fetch errors
          }
        }),
    );
    setInsiderSummaries(results);
    setLoading(false);
  }, [entries]);

  useEffect(() => {
    loadWatchlist();
  }, [loadWatchlist]);

  useEffect(() => {
    if (entries.length > 0) {
      loadInsiderData();
    } else {
      setLoading(false);
    }
  }, [entries, loadInsiderData]);

  const handleAdd = async () => {
    const input = addInput.trim();
    if (!input) return;

    setAdding(true);
    setAddMessage(null);

    try {
      const res = await fetch("/api/watchlist/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: input }),
      });

      const data = await res.json();

      if (!data.success) {
        setAddMessage({ type: "error", text: data.error || "Failed to add" });
      } else {
        setEntries(data.entries);
        setAddInput("");

        if (data.initialSync?.skipped) {
          setAddMessage({ type: "info", text: data.initialSync.reason });
        } else if (data.initialSync?.failed) {
          setAddMessage({
            type: "error",
            text: `${data.added.ticker} added but initial sync failed: ${data.initialSync.errors?.join("; ")}`,
          });
        } else {
          const syncMsg = data.initialSync?.newTransactions > 0
            ? `Found ${data.initialSync.newTransactions} new transaction(s).`
            : "No new transactions found.";
          setAddMessage({ type: "success", text: `${data.added.companyName} (${data.added.ticker}) added. ${syncMsg}` });
        }

        // Load insider data for the new entry
        loadInsiderData();
      }
    } catch {
      setAddMessage({ type: "error", text: "Network error — try again" });
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (ticker: string) => {
    setRemoving(ticker);
    try {
      const res = await fetch(`/api/watchlist/${ticker}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setEntries(data.entries);
        setInsiderSummaries((prev) => {
          const next = { ...prev };
          delete next[ticker];
          return next;
        });
      }
    } catch {
      // ignore
    } finally {
      setRemoving(null);
    }
  };

  const handleAddKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleAdd();
  };

  const strengthLabel = (s: number) => {
    if (s >= 0.7) return "strong";
    if (s >= 0.5) return "moderate";
    return "weak";
  };

  const activeEntries = entries.filter((e) => e.status === "active");
  const unsupportedEntries = entries.filter((e) => e.status !== "active");

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">Watchlist</h2>
        <div className="flex items-center gap-8">
          <span className="section-count">{entries.length} companies</span>
          {!kvEnabled && (
            <span className="demo-badge" title="Watchlist is stored locally and will not persist across deployments">
              LOCAL STORE
            </span>
          )}
        </div>
      </div>

      {/* Add company control */}
      <div style={{
        display: "flex",
        gap: 6,
        marginBottom: 16,
        alignItems: "center",
      }}>
        <div style={{ position: "relative", flex: 1, maxWidth: 300 }}>
          <input
            type="text"
            value={addInput}
            onChange={(e) => setAddInput(e.target.value)}
            onKeyDown={handleAddKeyDown}
            placeholder="Add company (ticker or name)"
            disabled={adding}
            style={{
              width: "100%",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              padding: "6px 10px",
              fontFamily: "var(--font-mono)",
              fontSize: "0.65rem",
              color: "var(--ink)",
              outline: "none",
            }}
          />
        </div>
        <button
          onClick={handleAdd}
          disabled={adding || !addInput.trim()}
          style={{
            background: adding ? "var(--surface-elevated)" : "var(--accent)",
            border: "none",
            borderRadius: "var(--radius)",
            padding: "6px 14px",
            fontFamily: "var(--font-mono)",
            fontSize: "0.6rem",
            color: adding ? "var(--muted)" : "var(--ink)",
            cursor: adding ? "wait" : "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {adding ? "Adding..." : "Add"}
        </button>
      </div>

      {/* Add message */}
      {addMessage && (
        <p style={{
          fontFamily: "var(--font-mono)",
          fontSize: "0.55rem",
          color: addMessage.type === "error" ? "var(--red)" :
                 addMessage.type === "info" ? "var(--amber)" : "var(--green)",
          marginBottom: 8,
        }}>
          {addMessage.text}
        </p>
      )}

      {/* Main company grid */}
      {loading ? (
        <div className="empty-state">
          <p>Loading watchlist...</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="empty-state">
          <p>Your watchlist is empty.</p>
          <small>Add a ticker above to start tracking insider activity.</small>
        </div>
      ) : (
        <>
          {/* Active companies */}
          <div className="company-grid">
            {activeEntries.map((entry) => {
              const insider = insiderSummaries[entry.ticker];
              return (
                <div key={entry.ticker} style={{ position: "relative" }}>
                  <Link href={`/companies/${entry.ticker}`} className="company-card" style={{ paddingRight: 32 }}>
                    <div className="card-header">
                      <span className="card-ticker">{entry.ticker}</span>
                      <span className="card-name">{entry.companyName}</span>
                    </div>

                    {insider ? (
                      <div className="card-change" style={{
                        color: insider.bullish ? "var(--green)" : insider.bearish ? "var(--red)" : "var(--muted)",
                      }}>
                        {insider.bullish ? "▲" : insider.bearish ? "▼" : "◆"} Insider{" "}
                        {insider.bullish ? "Bullish" : insider.bearish ? "Bearish" : "Neutral"}
                        {insider.netShares !== 0 && (
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.55rem", marginLeft: 4 }}>
                            ({insider.netShares > 0 ? "+" : ""}{insider.netShares.toLocaleString()} net shares)
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="card-change" style={{ color: "var(--quiet)" }}>
                        No insider data yet
                      </div>
                    )}

                    <div className="card-implication">
                      {insider
                        ? `Conviction score: ${insider.convictionScore > 0 ? "+" : ""}${insider.convictionScore}`
                        : entry.lastSyncedAt
                          ? "No directional insider activity"
                          : "Sync pending — click Refresh from SEC"}
                    </div>

                    {insider?.breakdown && (
                      <div className="card-metrics mt-8" style={{ flexWrap: "wrap", gap: 4 }}>
                        <span className="metric-label" style={{ fontSize: "0.5rem" }}>
                          {insider.breakdown}
                        </span>
                      </div>
                    )}

                    <div className="card-metrics">
                      <span className="metric">
                        <span className="metric-label">status</span>
                        <span className="metric-value">
                          {entry.lastSyncedAt
                            ? `synced ${new Date(entry.lastSyncedAt).toLocaleDateString()}`
                            : "not yet synced"}
                        </span>
                      </span>
                    </div>
                  </Link>

                  {/* Remove button */}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      handleRemove(entry.ticker);
                    }}
                    disabled={removing === entry.ticker}
                    title={`Remove ${entry.ticker}`}
                    style={{
                      position: "absolute",
                      top: 8,
                      right: 8,
                      background: "transparent",
                      border: "none",
                      color: "var(--quiet)",
                      cursor: "pointer",
                      fontFamily: "var(--font-mono)",
                      fontSize: "0.6rem",
                      padding: "2px 6px",
                      borderRadius: 2,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "var(--red)")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "var(--quiet)")}
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>

          {/* Unsupported/reference-only entries */}
          {unsupportedEntries.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <div className="section-header">
                <h3 className="section-title" style={{ fontSize: "0.7rem" }}>Reference only</h3>
                <span className="section-count">{unsupportedEntries.length} companies</span>
              </div>
              <div className="company-grid">
                {unsupportedEntries.map((entry) => (
                  <div key={entry.ticker} className="company-card" style={{ opacity: 0.6 }}>
                    <div className="card-header">
                      <span className="card-ticker">{entry.ticker}</span>
                      <span className="card-name">{entry.companyName}</span>
                    </div>
                    <div className="card-change" style={{ color: "var(--amber)" }}>
                      ◆ {entry.statusMessage || "No SEC Form 4 data available"}
                    </div>
                    <div className="card-metrics mt-8">
                      <span className="metric">
                        <span className="metric-label">status</span>
                        <span className="metric-value warning">unsupported</span>
                      </span>
                    </div>
                    <button
                      onClick={() => handleRemove(entry.ticker)}
                      disabled={removing === entry.ticker}
                      style={{
                        marginTop: 8,
                        background: "transparent",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius)",
                        padding: "3px 10px",
                        fontFamily: "var(--font-mono)",
                        fontSize: "0.5rem",
                        color: "var(--quiet)",
                        cursor: "pointer",
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <p style={{
        fontFamily: "var(--font-mono)",
        fontSize: "0.55rem",
        color: "var(--quiet)",
        textAlign: "center",
        marginTop: 16,
      }}>
        Watchlist powered by SEC EDGAR Form 4 insider data
      </p>
    </div>
  );
}