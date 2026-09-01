/**
 * Compact portfolio holding card — logo + ticker stack, value + today move,
 * optional allocation bar. Edit/remove controls only when Manage passes handlers.
 */

"use client";

import Link from "next/link";
import { LogoDisplay } from "@/app/components/LogoDisplay";
import {
  fmtCompactCurrency,
  fmtDollarPrice,
  fmtPercent,
  isFiniteNumber,
} from "@/lib/display/format";
import { changeToneClass } from "@/lib/display/heat-color";
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
  /**
   * Allocation bar fill. Pass an industry color on Manage; omit on Live
   * (Concentration owns the weight story).
   */
  barColor?: string | null;
  isEditing?: boolean;
  formShares?: string;
  formCost?: string;
  formError?: string | null;
  confirmRemove?: boolean;
  focused?: boolean;
  saving?: boolean;
  onEdit?: (ticker: string) => void;
  onCancelEdit?: () => void;
  onSharesChange?: (value: string) => void;
  onCostChange?: (value: string) => void;
  onSaveEdit?: () => void;
  onAskRemove?: (ticker: string) => void;
  onCancelRemove?: () => void;
  onConfirmRemove?: (ticker: string) => void;
}

function formatWeight(weight: number | null): string {
  if (!isFiniteNumber(weight)) return "—";
  return `${weight.toFixed(1)}%`;
}

function formatTodayDollars(value: number | null): string {
  if (!isFiniteNumber(value)) return "—";
  if (value === 0) return "$0.00";
  return `${value > 0 ? "+" : "−"}$${Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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
  barColor = null,
  isEditing = false,
  formShares = "",
  formCost = "",
  formError = null,
  confirmRemove = false,
  focused = false,
  saving = false,
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
  const dayChangeClass = changeToneClass(metrics.dailyChange ?? changePercent);
  const closeChangeClass = changeToneClass(closeChangePercent);
  const allocation = metrics.weight;
  const displayName = companyName?.trim() || ticker;
  const barWidth = isFiniteNumber(allocation) ? Math.min(100, Math.max(0, allocation)) : 0;
  const showBar = typeof barColor === "string" && barColor.length > 0;
  const editable = Boolean(onEdit && onAskRemove);
  const sharesLabel = `${shares.toLocaleString("en-US", {
    maximumFractionDigits: 4,
  })} sh`;

  return (
    <article
      id={`portfolio-holding-${ticker}`}
      className={`pf-holding-card${isEditing ? " is-editing" : ""}${focused ? " focused-card" : ""}`}
      aria-label={`${displayName} holding`}
    >
      <div className="pf-holding-main">
        <span className="pf-holding-logo" aria-hidden="true">
          <LogoDisplay ticker={ticker} size="card" />
        </span>

        <div className="pf-holding-copy">
          <Link href={`/companies/${ticker}`} className="pf-holding-id">
            <strong className="pf-holding-ticker">{ticker}</strong>
            <span className="pf-holding-name">{displayName}</span>
          </Link>
          <span className="pf-holding-meta tnum">
            {sharesLabel}
            <span aria-hidden="true"> · </span>
            {fmtDollarPrice(price)}
            {sessionLabel ? (
              <>
                <span aria-hidden="true"> · </span>
                {sessionLabel}
              </>
            ) : null}
          </span>
        </div>

        <div className="pf-holding-figures">
          <strong className="pf-holding-value tnum">{fmtCompactCurrency(metrics.marketValue)}</strong>
          <span className={`pf-holding-day tnum ${dayChangeClass}`}>
            {formatTodayDollars(metrics.dailyChange)}
            {isFiniteNumber(changePercent) ? (
              <span className="pf-holding-day-pct"> {fmtPercent(changePercent, 2)}</span>
            ) : null}
            <span className="pf-holding-day-suffix"> today</span>
          </span>
          <span className="pf-holding-weight tnum">{formatWeight(allocation)}</span>
          {hasExtendedSession ? (
            <span className={`pf-holding-close tnum ${closeChangeClass}`}>
              Close {fmtDollarPrice(closePrice)}
              {isFiniteNumber(closeChangePercent) ? ` ${fmtPercent(closeChangePercent, 2)}` : ""}
            </span>
          ) : null}
        </div>
      </div>

      {editable ? (
        <div className="pf-holding-actions">
          {confirmRemove ? (
            <>
              <span className="pf-holding-confirm-label">Remove?</span>
              <button
                type="button"
                className="pf-holding-action pf-holding-action-danger"
                disabled={saving}
                onClick={() => onConfirmRemove?.(ticker)}
              >
                Yes
              </button>
              <button type="button" className="pf-holding-action" onClick={() => onCancelRemove?.()}>
                No
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="pf-holding-action"
                onClick={() => onEdit?.(ticker)}
                disabled={isEditing || saving}
              >
                Edit
              </button>
              <button
                type="button"
                className="pf-holding-action pf-holding-action-danger"
                onClick={() => onAskRemove?.(ticker)}
                disabled={isEditing || saving}
              >
                Remove
              </button>
            </>
          )}
        </div>
      ) : null}

      {editable && isEditing ? (
        <form
          className="pf-holding-edit"
          onSubmit={(e) => {
            e.preventDefault();
            onSaveEdit?.();
          }}
        >
          <label className="pf-holding-edit-field">
            <span>Shares</span>
            <input
              type="text"
              inputMode="decimal"
              value={formShares}
              onChange={(e) => onSharesChange?.(e.target.value)}
              autoFocus
            />
          </label>
          <label className="pf-holding-edit-field">
            <span>Avg cost</span>
            <input
              type="text"
              inputMode="decimal"
              value={formCost}
              onChange={(e) => onCostChange?.(e.target.value)}
              placeholder="optional"
            />
          </label>
          <div className="pf-holding-edit-actions">
            <button type="submit" className="pf-holding-save" disabled={saving}>
              Save
            </button>
            <button type="button" className="pf-holding-action" onClick={() => onCancelEdit?.()}>
              Cancel
            </button>
          </div>
          {formError ? <p className="pf-holding-edit-error">{formError}</p> : null}
        </form>
      ) : null}

      {showBar ? (
        <div
          className="pf-holding-bar is-industry"
          aria-label={`${ticker} allocation ${isFiniteNumber(allocation) ? `${allocation.toFixed(1)} percent` : "unavailable"}`}
        >
          <i style={{ width: `${barWidth}%`, background: barColor }} />
        </div>
      ) : null}
    </article>
  );
}
