"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { notifyPortfolioChanged } from "@/components/PortfolioData";
import { loadPortfolioForViewer, savePortfolioForViewer } from "@/lib/portfolio/client";
import type { PersistedPosition } from "@/lib/portfolio/persist";

function parsePosition(
  tickerValue: string,
  sharesValue: string,
  costValue: string,
  existingTicker = false,
): { position: PersistedPosition | null; error: string | null } {
  const ticker = tickerValue.trim().toUpperCase();
  if (!ticker || (!existingTicker && !/^[A-Z]{1,5}$/.test(ticker))) {
    return { position: null, error: "Enter a ticker with 1–5 letters." };
  }

  const shares = Number.parseFloat(sharesValue);
  if (!Number.isFinite(shares) || shares <= 0) {
    return { position: null, error: "Enter a valid number of shares." };
  }

  const averageCost = costValue.trim() ? Number.parseFloat(costValue) : undefined;
  if (averageCost !== undefined && (!Number.isFinite(averageCost) || averageCost <= 0)) {
    return { position: null, error: "Enter a valid average cost." };
  }

  return { position: { ticker, shares, averageCost }, error: null };
}

function formatCost(value: number | undefined): string {
  if (value === undefined) return "No cost basis";
  return `${new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} avg cost`;
}

export function PortfolioManager() {
  const [positions, setPositions] = useState<PersistedPosition[]>([]);
  const [authenticated, setAuthenticated] = useState(false);
  const [persistence, setPersistence] = useState<"browser" | "neon" | "unconfigured">("browser");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [ticker, setTicker] = useState("");
  const [shares, setShares] = useState("");
  const [cost, setCost] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [editingTicker, setEditingTicker] = useState<string | null>(null);
  const [editShares, setEditShares] = useState("");
  const [editCost, setEditCost] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [removingTicker, setRemovingTicker] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadPortfolioForViewer().then((next) => {
      if (cancelled) return;
      setPositions(next.positions);
      setAuthenticated(next.authenticated);
      setPersistence(next.persistence);
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);

  async function persist(next: PersistedPosition[]) {
    const trimmed = next.slice(0, 50);
    const previous = positions;
    setPositions(trimmed);
    setSaving(true);
    setSyncError(null);
    try {
      if (persistence === "unconfigured") {
        throw new Error("Portfolio sync is temporarily unavailable");
      }
      const saved = await savePortfolioForViewer(trimmed, authenticated);
      setPositions(saved);
      notifyPortfolioChanged();
      return true;
    } catch (error) {
      setPositions(previous);
      setSyncError(error instanceof Error ? error.message : "Could not save the portfolio");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleAdd(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = parsePosition(ticker, shares, cost);
    if (!result.position) {
      setAddError(result.error);
      return;
    }

    const next = [...positions];
    const existingIndex = next.findIndex(
      (position) => position.ticker.toUpperCase() === result.position?.ticker,
    );
    if (existingIndex >= 0) next[existingIndex] = result.position;
    else next.push(result.position);
    if (!await persist(next)) return;
    setTicker("");
    setShares("");
    setCost("");
    setAddError(null);
  }

  function startEdit(position: PersistedPosition) {
    setEditingTicker(position.ticker);
    setEditShares(String(position.shares));
    setEditCost(position.averageCost === undefined ? "" : String(position.averageCost));
    setEditError(null);
    setRemovingTicker(null);
  }

  function cancelEdit() {
    setEditingTicker(null);
    setEditShares("");
    setEditCost("");
    setEditError(null);
  }

  async function saveEdit(event: React.FormEvent<HTMLFormElement>, originalTicker: string) {
    event.preventDefault();
    const result = parsePosition(originalTicker, editShares, editCost, true);
    if (!result.position) {
      setEditError(result.error);
      return;
    }
    const saved = await persist(positions.map((position) =>
      position.ticker.toUpperCase() === originalTicker.toUpperCase()
        ? result.position as PersistedPosition
        : position,
    ));
    if (saved) cancelEdit();
  }

  async function remove(tickerToRemove: string) {
    const saved = await persist(positions.filter(
      (position) => position.ticker.toUpperCase() !== tickerToRemove.toUpperCase(),
    ));
    if (!saved) return;
    setRemovingTicker(null);
    if (editingTicker?.toUpperCase() === tickerToRemove.toUpperCase()) cancelEdit();
  }

  async function clearPortfolio() {
    if (!await persist([])) return;
    setConfirmClear(false);
    cancelEdit();
  }

  return (
    <section id="portfolio" className="data-manager-section" aria-labelledby="manage-portfolio-title">
      <header className="data-manager-section-head">
        <div>
          <span className="data-manager-eyebrow">Portfolio</span>
          <h2 id="manage-portfolio-title">Holdings you own</h2>
        </div>
        <span className="data-manager-count">
          {positions.length} holding{positions.length === 1 ? "" : "s"}
        </span>
      </header>

      <form className="data-manager-form" onSubmit={handleAdd} aria-label="Add a portfolio holding">
        <label>
          <span>Ticker</span>
          <input
            value={ticker}
            onChange={(event) => setTicker(event.target.value.toUpperCase())}
            placeholder="AAPL"
            autoCapitalize="characters"
            autoComplete="off"
          />
        </label>
        <label>
          <span>Shares</span>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={shares}
            onChange={(event) => setShares(event.target.value)}
            placeholder="10"
          />
        </label>
        <label>
          <span>Average cost <em>optional</em></span>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={cost}
            onChange={(event) => setCost(event.target.value)}
            placeholder="150.00"
          />
        </label>
        <button type="submit" className="data-manager-primary" disabled={saving}>Add holding</button>
        {addError ? <p className="data-manager-error" role="alert">{addError}</p> : null}
      </form>

      {!loaded ? (
        <div className="data-manager-empty">Loading portfolio…</div>
      ) : positions.length > 0 ? (
        <div className="data-manager-list" aria-label="Portfolio holdings">
          {positions.map((position) => {
            const isEditing = editingTicker?.toUpperCase() === position.ticker.toUpperCase();
            const isRemoving = removingTicker?.toUpperCase() === position.ticker.toUpperCase();
            return (
              <div key={position.ticker} className="data-manager-row data-manager-row--portfolio">
                <div className="data-manager-row-copy">
                  <Link href={`/companies/${encodeURIComponent(position.ticker)}`} className="data-manager-ticker">
                    {position.ticker}
                  </Link>
                  <span>{position.shares.toLocaleString()} shares · {formatCost(position.averageCost)}</span>
                </div>

                <div className="data-manager-row-actions">
                  {isRemoving ? (
                    <>
                      <span className="data-manager-confirm">Remove?</span>
                      <button type="button" className="data-manager-action is-danger" disabled={saving} onClick={() => void remove(position.ticker)}>Yes</button>
                      <button type="button" className="data-manager-action" onClick={() => setRemovingTicker(null)}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <button type="button" className="data-manager-action" onClick={() => startEdit(position)}>Edit</button>
                      <button type="button" className="data-manager-action is-danger" onClick={() => setRemovingTicker(position.ticker)}>Remove</button>
                    </>
                  )}
                </div>

                {isEditing ? (
                  <form className="data-manager-inline-form" onSubmit={(event) => void saveEdit(event, position.ticker)}>
                    <label>
                      <span>Shares</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="any"
                        value={editShares}
                        onChange={(event) => setEditShares(event.target.value)}
                        autoFocus
                      />
                    </label>
                    <label>
                      <span>Average cost</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="any"
                        value={editCost}
                        onChange={(event) => setEditCost(event.target.value)}
                        placeholder="optional"
                      />
                    </label>
                    <button type="submit" className="data-manager-primary" disabled={saving}>Save</button>
                    <button type="button" className="data-manager-action" onClick={cancelEdit}>Cancel</button>
                    {editError ? <p className="data-manager-error" role="alert">{editError}</p> : null}
                  </form>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="data-manager-empty">
          <strong>No portfolio holdings yet.</strong>
          <span>Use the form above to add your first position.</span>
        </div>
      )}

      <footer className="data-manager-footer">
        <span>
          {persistence === "neon" && authenticated
            ? "Portfolio holdings are synced privately in Neon."
            : "Portfolio holdings are stored in this browser."}
        </span>
        {syncError ? <span className="data-manager-error" role="alert">{syncError}</span> : null}
        {positions.length > 0 ? (
          confirmClear ? (
            <div className="data-manager-row-actions">
              <span className="data-manager-confirm">Clear every holding?</span>
              <button type="button" className="data-manager-action is-danger" disabled={saving} onClick={() => void clearPortfolio()}>Clear all</button>
              <button type="button" className="data-manager-action" onClick={() => setConfirmClear(false)}>Cancel</button>
            </div>
          ) : (
            <button type="button" className="data-manager-action is-danger" onClick={() => setConfirmClear(true)}>Clear portfolio</button>
          )
        ) : null}
      </footer>
    </section>
  );
}
