"use client";

import Link from "next/link";

export type TrendingManageItem = {
  ticker: string;
  companyName?: string | null;
  activityLabel?: string | null;
};

/**
 * Compact ticker row under a trending heatmap — open company or add/remove watchlist.
 */
export function TrendingManageChips({
  items,
  trackedTickers,
  addingTicker = null,
  onAdd,
  onRemove,
}: {
  items: TrendingManageItem[];
  trackedTickers: Set<string>;
  addingTicker?: string | null;
  onAdd: (item: TrendingManageItem) => void;
  onRemove: (ticker: string) => void;
}) {
  if (items.length === 0) return null;

  return (
    <div className="wl-manage-row" aria-label="Trending names">
      <span className="wl-manage-label">
        {items.length} symbol{items.length === 1 ? "" : "s"}
      </span>
      <div className="wl-manage-chips">
        {items.map((item) => {
          const tracked = trackedTickers.has(item.ticker);
          const busy = addingTicker === item.ticker;
          return (
            <span key={item.ticker} className="wl-manage-chip">
              <Link
                href={`/companies/${encodeURIComponent(item.ticker)}`}
                title={item.activityLabel ?? item.companyName ?? item.ticker}
              >
                {item.ticker}
              </Link>
              {tracked ? (
                <button
                  type="button"
                  className="wl-manage-remove"
                  onClick={() => onRemove(item.ticker)}
                  aria-label={`Remove ${item.ticker} from watchlist`}
                >
                  ×
                </button>
              ) : (
                <button
                  type="button"
                  className="wl-manage-add"
                  onClick={() => onAdd(item)}
                  disabled={busy}
                  aria-label={`Add ${item.ticker} to watchlist`}
                >
                  {busy ? "…" : "+"}
                </button>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}
