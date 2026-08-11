/**
 * Compact portfolio holding row — same ring-list language as Watchlist,
 * with a color-accented holdings band (shares / value / cost / total return).
 * Edit and remove are always visible; company dashboard is a ticker link.
 */

"use client";

import Link from "next/link";
import { GaugeRing, type GaugeTone } from "@/components/GaugeRing";
import { isFiniteNumber } from "@/lib/display/format";
import { changeToneClass } from "@/lib/display/heat-color";
import { inkBoxClass, inkChipClass, inkToneFromSemantic } from "@/lib/display/ink-tone";
import type { PositionMetrics } from "@/lib/portfolio/types";

export interface PortfolioHoldingCardProps {
  ticker: string;
  companyName?: string | null;
  /** Live session price (premarket / regular / after-hours) */
  price: number | null;
  changePercent: number | null;
  /** "Pre-Market" or "After Hours" chip when hero is extended-hours */
  sessionLabel: string | null;
  /** Regular-session close reference when extended */
  closePrice: number | null;
  closeChangePercent: number | null;
  shares: number;
  metrics: PositionMetrics;
  isEditing?: boolean;
  formShares?: string;
  formCost?: string;
  formError?: string | null;
  confirmRemove?: boolean;
  onEdit: (ticker: string) => void;
  onCancelEdit: () => void;
  onSharesChange: (value: string) => void;
  onCostChange: (value: string) => void;
  onSaveEdit: () => void;
  onAskRemove: (ticker: string) => void;
  onCancelRemove: () => void;
  onConfirmRemove: (ticker: string) => void;
}

function formatPrice(value: number | null) {
  if (!isFiniteNumber(value)) return "—";
  return value.toLocaleString(undefined, {
    maximumFractionDigits: value >= 100 ? 2 : 3,
    minimumFractionDigits: value >= 1 ? 2 : 3,
  });
}

function formatPercent(value: number | null) {
  if (!isFiniteNumber(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function compactCurrency(value: number | null) {
  if (!isFiniteNumber(value)) return "—";
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function allocationTone(weight: number | null): GaugeTone {
  if (!isFiniteNumber(weight)) return "neutral";
  if (weight > 20) return "red";
  if (weight >= 12) return "amber";
  return "green";
}

function holdingAccent(totalGainLoss: number | null): "up" | "down" | "flat" {
  if (!isFiniteNumber(totalGainLoss) || totalGainLoss === 0) return "flat";
  return totalGainLoss > 0 ? "up" : "down";
}

export function PortfolioHoldingCard({
  ticker,
  companyName,
  price,
  changePercent,
  sessionLabel,
  closePrice,
  closeChangePercent,
  shares,
  metrics,
  isEditing = false,
  formShares = "",
  formCost = "",
  formError = null,
  confirmRemove = false,
  onEdit,
  onCancelEdit,
  onSharesChange,
  onCostChange,
  onSaveEdit,
  onAskRemove,
  onCancelRemove,
  onConfirmRemove,
}: PortfolioHoldingCardProps) {
  const hasExtendedSession = sessionLabel !== null && closePrice !== null;
  const dayChangeClass = changeToneClass(changePercent);
  const closeChangeClass = changeToneClass(closeChangePercent);
  const moveTone = inkToneFromSemantic(
    dayChangeClass === "positive"
      ? "positive"
      : dayChangeClass === "negative" || dayChangeClass === "negative-mild"
        ? "negative"
        : "quiet",
  );

  const allocation = metrics.weight;
  const accent = holdingAccent(metrics.totalGainLoss);
  const displayName = companyName?.trim() || ticker;

  return (
    <article
      className={`wl-ring-row pf-holding-card ${inkBoxClass(moveTone)}${isEditing ? " is-editing" : ""}`}
      aria-label={`${displayName} holding`}
    >
      <div className="wl-ring-row-main">
        <div className="wl-ring-identity">
          <Link href={`/companies/${ticker}`} className="pf-holding-company-link">
            <strong className="wl-ring-ticker">{ticker}</strong>
            <span className="wl-ring-name">{displayName}</span>
          </Link>
        </div>

        <div className="wl-ring-price">
          <div className="wl-ring-price-primary">
            <strong className="wl-ring-last">
              {price !== null ? `$${formatPrice(price)}` : "—"}
            </strong>
            {sessionLabel ? (
              <span className="ink-chip ink-chip--quiet wl-ring-session-chip">{sessionLabel}</span>
            ) : null}
          </div>
          <span className={`${inkChipClass(moveTone)} wl-ring-day-change`}>
            {formatPercent(changePercent)}
          </span>
          {hasExtendedSession ? (
            <span className={`wl-ring-at-close ${closeChangeClass}`}>
              At close ${formatPrice(closePrice)}
              {isFiniteNumber(closeChangePercent)
                ? ` (${formatPercent(closeChangePercent)})`
                : ""}
            </span>
          ) : null}
        </div>

        <div className="wl-ring-gauge">
          <GaugeRing
            size="sm"
            value={allocation}
            label={isFiniteNumber(allocation) ? `${Math.round(allocation)}%` : "—"}
            sublabel="Alloc"
            tone={allocationTone(allocation)}
            ariaLabel={`${ticker} allocation ${isFiniteNumber(allocation) ? `${allocation.toFixed(1)} percent` : "unavailable"}`}
          />
        </div>

        <div className="pf-holding-actions">
          {confirmRemove ? (
            <>
              <span className="pf-holding-confirm-label">Remove?</span>
              <button
                type="button"
                className="pf-holding-action pf-holding-action-danger"
                onClick={() => onConfirmRemove(ticker)}
              >
                Yes
              </button>
              <button
                type="button"
                className="pf-holding-action"
                onClick={onCancelRemove}
              >
                No
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="pf-holding-action"
                onClick={() => onEdit(ticker)}
                disabled={isEditing}
              >
                Edit
              </button>
              <button
                type="button"
                className="pf-holding-action pf-holding-action-danger"
                onClick={() => onAskRemove(ticker)}
                disabled={isEditing}
              >
                Remove
              </button>
            </>
          )}
        </div>
      </div>

      {isEditing ? (
        <form
          className="pf-holding-edit"
          onSubmit={(e) => {
            e.preventDefault();
            onSaveEdit();
          }}
        >
          <label className="pf-holding-edit-field">
            <span>Shares</span>
            <input
              type="text"
              inputMode="decimal"
              value={formShares}
              onChange={(e) => onSharesChange(e.target.value)}
              autoFocus
            />
          </label>
          <label className="pf-holding-edit-field">
            <span>Avg cost</span>
            <input
              type="text"
              inputMode="decimal"
              value={formCost}
              onChange={(e) => onCostChange(e.target.value)}
              placeholder="optional"
            />
          </label>
          <div className="pf-holding-edit-actions">
            <button type="submit" className="pf-holding-save">
              Save
            </button>
            <button type="button" className="pf-holding-action" onClick={onCancelEdit}>
              Cancel
            </button>
          </div>
          {formError ? <p className="pf-holding-edit-error">{formError}</p> : null}
        </form>
      ) : (
        <div className={`pf-ring-holding ${accent}`} aria-label="Holding details">
          <div className="pf-ring-holding-item">
            <span className="pf-ring-holding-label">Shares</span>
            <span className="pf-ring-holding-value">{shares.toLocaleString()}</span>
          </div>
          <div className="pf-ring-holding-item">
            <span className="pf-ring-holding-label">Value</span>
            <span className="pf-ring-holding-value">
              {compactCurrency(metrics.marketValue)}
            </span>
          </div>
          <div className="pf-ring-holding-item">
            <span className="pf-ring-holding-label">Cost</span>
            <span className="pf-ring-holding-value">
              {compactCurrency(metrics.totalCost)}
            </span>
          </div>
          <div className="pf-ring-holding-item">
            <span className="pf-ring-holding-label">Total return</span>
            <span className={`pf-ring-holding-value pf-ring-holding-gl ${accent}`}>
              {compactCurrency(metrics.totalGainLoss)}
              {isFiniteNumber(metrics.totalGainLossPercent)
                ? ` ${formatPercent(metrics.totalGainLossPercent)}`
                : ""}
            </span>
          </div>
        </div>
      )}
    </article>
  );
}
