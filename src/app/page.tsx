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

export default function WatchlistPage() {
  const [entries, setEntries] = useState<WatchlistEntry[]>([]);
  const [kvEnabled, setKvEnabled] = useState(false);
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
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWatchlist();
  }, [loadWatchlist]);

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
        <h2 className="section-title">Institutional watchlist</h2>
        <div className="flex items-center gap-8">
          <span className="section-count">{entries.length} companies</span>
          {!kvEnabled && (
            <span className="demo-badge" title="Watchlist is stored locally and will not persist across deployments">
              LOCAL STORE
            </span>
          )}
        </div>
      </div>

      <div className="product-brief">
        <div>
          <span className="institutional-eyebrow">Conviction engine</span>
          <h2>Where sophisticated capital is building conviction.</h2>
        </div>
        <Link href="/rising" className="brief-link">
          View leaderboard →
        </Link>
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
          <small>Add a ticker above to track institutional 13F changes.</small>
        </div>
      ) : (
        <>
          {/* Active companies */}
          <div className="company-grid">
            {activeEntries.map((entry) => {
              return (
                <div key={entry.ticker} style={{ position: "relative" }}>
                  <Link href={`/companies/${entry.ticker}`} className="company-card" style={{ paddingRight: 32 }}>
                    <div className="card-header">
                      <span className="card-ticker">{entry.ticker}</span>
                      <span className="card-name">{entry.companyName}</span>
                    </div>

                    <div className="card-change" style={{ color: "var(--green)" }}>
                      ◆ SEC 13F manager changes
                    </div>

                    <div className="card-implication">
                      Open the company page to see which tracked managers changed positions.
                    </div>

                    <div className="card-metrics">
                      <span className="metric">
                        <span className="metric-label">primary signal</span>
                        <span className="metric-value">
                          institutional accumulation
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
                      ◆ {entry.statusMessage || "Limited SEC coverage"}
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
        Powered by SEC EDGAR Form 13F institutional data
      </p>
    </div>
  );
}
