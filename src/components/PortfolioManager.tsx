"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { CompanyTypeahead } from "@/components/CompanyTypeahead";
import { notifyPortfolioChanged, usePortfolioData } from "@/components/PortfolioData";
import { PortfolioHoldingCard } from "@/components/PortfolioHoldingCard";
import { PageLoadingMotion } from "@/components/PageLoadingMotion";
import { getLivePrice } from "@/lib/market/live-quote";
import type { StockQuote } from "@/lib/market/quotes";
import { savePortfolioForViewer } from "@/lib/portfolio/client";
import {
  computePortfolioMetrics,
  computePositionMetrics,
} from "@/lib/portfolio/calculations";
import type { PersistedPosition } from "@/lib/portfolio/persist";
import type { PortfolioPosition } from "@/lib/portfolio/types";

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

function enrichWithPrices(
  persisted: PersistedPosition[],
  quotes: StockQuote[],
): PortfolioPosition[] {
  const quoteMap = new Map(quotes.map((q) => [q.ticker.toUpperCase(), q]));
  return persisted.map((p) => {
    const ticker = p.ticker.toUpperCase();
    const quote = quoteMap.get(ticker);
    const live = quote ? getLivePrice(quote) : null;
    return {
      companyId: ticker,
      shares: p.shares,
      averageCost: p.averageCost,
      currentPrice: live?.price ?? quote?.price ?? null,
      previousClose: quote?.previousClose ?? null,
    };
  });
}

export function PortfolioManager() {
  const {
    positions,
    quotes,
    authenticated,
    persistence,
    data: sharedData,
    reloadPositions,
  } = usePortfolioData();
  const [saving, setSaving] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [ticker, setTicker] = useState("");
  const [shares, setShares] = useState("");
  const [cost, setCost] = useState("");
  const sharesInputRef = useRef<HTMLInputElement>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [editingTicker, setEditingTicker] = useState<string | null>(null);
  const [editShares, setEditShares] = useState("");
  const [editCost, setEditCost] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [removingTicker, setRemovingTicker] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const enriched = useMemo(() => enrichWithPrices(positions, quotes), [positions, quotes]);
  const portfolioMetrics = useMemo(() => computePortfolioMetrics(enriched), [enriched]);
  const holdingRows = useMemo(() => {
    const rows = enriched.map((pos) => {
      const metrics = computePositionMetrics(
        pos,
        portfolioMetrics.totalMarketValue,
        portfolioMetrics.dailyChange,
      );
      const dailyPct =
        pos.currentPrice != null && pos.previousClose != null
          ? ((pos.currentPrice - pos.previousClose) / pos.previousClose) * 100
          : null;
      return { pos, metrics, dailyPct };
    });
    rows.sort((a, b) => (b.metrics.marketValue ?? 0) - (a.metrics.marketValue ?? 0));
    return rows;
  }, [enriched, portfolioMetrics]);

  async function persist(next: PersistedPosition[]) {
    const trimmed = next.slice(0, 50);
    setSaving(true);
    setSyncError(null);
    try {
      if (persistence === "unconfigured") {
        throw new Error("Portfolio sync is temporarily unavailable");
      }
      await savePortfolioForViewer(trimmed, authenticated);
      notifyPortfolioChanged();
      await reloadPositions();
      return true;
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "Could not save the portfolio");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleAdd(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = parsePosition(ticker, shares, cost, true);
    if (!result.position) {
      setAddError(result.error);
      return;
    }

    setResolving(true);
    setAddError(null);
    try {
      const response = await fetch("/api/portfolio/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: ticker }),
      });
      const resolution = await response.json().catch(() => ({})) as {
        success?: boolean;
        ticker?: string;
        error?: string;
      };
      if (!response.ok || !resolution.success || !resolution.ticker) {
        setAddError(resolution.error ?? "Could not resolve that ticker or company.");
        return;
      }

      const position = {
        ...result.position,
        ticker: resolution.ticker.toUpperCase(),
      };
      const next = [...positions];
      const existingIndex = next.findIndex(
        (existing) => existing.ticker.toUpperCase() === position.ticker,
      );
      if (existingIndex >= 0) next[existingIndex] = position;
      else next.push(position);
      if (!await persist(next)) return;
      setTicker("");
      setShares("");
      setCost("");
      setAddError(null);
    } catch {
      setAddError("Could not add the holding. Check your connection and try again.");
    } finally {
      setResolving(false);
    }
  }

  function startEdit(positionTicker: string) {
    const position = positions.find(
      (item) => item.ticker.toUpperCase() === positionTicker.toUpperCase(),
    );
    if (!position) return;
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

  async function saveEdit() {
    if (!editingTicker) return;
    const result = parsePosition(editingTicker, editShares, editCost, true);
    if (!result.position) {
      setEditError(result.error);
      return;
    }
    const saved = await persist(positions.map((position) =>
      position.ticker.toUpperCase() === editingTicker.toUpperCase()
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

  const loaded = !sharedData.loading || positions.length > 0 || Boolean(sharedData.error);

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
          <span>Ticker or company</span>
          <CompanyTypeahead
            value={ticker}
            onChange={setTicker}
            onSelect={(suggestion) => {
              setTicker(suggestion.ticker);
              setAddError(null);
              sharesInputRef.current?.focus();
            }}
            placeholder="AAPL or Apple"
            wrapperClassName="data-manager-typeahead"
            autoCapitalize="characters"
          />
        </label>
        <label>
          <span>Shares</span>
          <input
            ref={sharesInputRef}
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
        <button type="submit" className="data-manager-primary" disabled={saving || resolving}>
          {resolving ? "Adding…" : "Add holding"}
        </button>
        {addError ? <p className="data-manager-error" role="alert">{addError}</p> : null}
      </form>

      {!loaded ? (
        <div className="data-manager-empty">Loading portfolio…</div>
      ) : positions.length > 0 ? (
        <div className="data-manager-holdings" aria-label="Portfolio holdings">
          {sharedData.loading ? (
            <PageLoadingMotion
              label="Loading portfolio prices"
              compact
              showLabel={false}
              showSubtitle={false}
              speed="slow"
            />
          ) : null}
          {holdingRows.map(({ pos, metrics, dailyPct }) => {
            const tickerKey = pos.companyId.toUpperCase();
            const quote = quotes.find((item) => item.ticker.toUpperCase() === tickerKey);
            const live = quote ? getLivePrice(quote) : null;
            const isEditing = editingTicker?.toUpperCase() === tickerKey;
            return (
              <PortfolioHoldingCard
                key={tickerKey}
                ticker={tickerKey}
                companyName={quote?.name ?? tickerKey}
                price={live?.price ?? quote?.price ?? pos.currentPrice ?? null}
                changePercent={live?.changePercent ?? quote?.changePercent ?? dailyPct}
                sessionLabel={live?.label ?? null}
                closePrice={live?.label ? quote?.price ?? null : null}
                closeChangePercent={live?.label ? quote?.changePercent ?? null : null}
                shares={pos.shares}
                metrics={metrics}
                focused={false}
                isEditing={isEditing}
                formShares={editShares}
                formCost={editCost}
                formError={isEditing ? editError : null}
                confirmRemove={removingTicker?.toUpperCase() === tickerKey}
                saving={saving}
                onEdit={startEdit}
                onCancelEdit={cancelEdit}
                onSharesChange={setEditShares}
                onCostChange={setEditCost}
                onSaveEdit={() => void saveEdit()}
                onAskRemove={setRemovingTicker}
                onCancelRemove={() => setRemovingTicker(null)}
                onConfirmRemove={(value) => void remove(value)}
              />
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
        <Link href="/portfolio" className="data-manager-view-link">
          View Portfolio <span aria-hidden="true">→</span>
        </Link>
      </footer>
    </section>
  );
}
