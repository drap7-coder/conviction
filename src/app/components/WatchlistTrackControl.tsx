"use client";

import Link from "next/link";

type WatchlistTrackSize = "row" | "quote";
type WatchlistTrackSurface = "paper" | "ink";

interface WatchlistTrackControlProps {
  ticker: string;
  companyName: string;
  tracked: boolean;
  adding?: boolean;
  onAdd: (idea: { ticker: string; companyName: string }) => void;
  size?: WatchlistTrackSize;
  surface?: WatchlistTrackSurface;
}

/**
 * Always-visible watchlist control: Add, Adding…, or Tracked.
 * Tracked links to the watchlist so the status stays actionable.
 */
export function WatchlistTrackControl({
  ticker,
  companyName,
  tracked,
  adding = false,
  onAdd,
  size = "row",
  surface = "paper",
}: WatchlistTrackControlProps) {
  const className = [
    "watchlist-track",
    size === "quote" ? "is-quote" : "",
    surface === "ink" ? "is-on-ink" : "",
    tracked ? "is-tracked" : "",
  ].filter(Boolean).join(" ");

  if (tracked) {
    return (
      <Link
        href="/portfolio?view=watchlist"
        className={className}
        aria-label={`${ticker} is on your watchlist`}
        title="On your watchlist"
      >
        Tracked
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={className}
      disabled={adding}
      onClick={() => onAdd({ ticker, companyName })}
      aria-label={`Add ${ticker} to watchlist`}
    >
      {adding ? "Adding…" : size === "quote" ? "Add to watchlist" : "Add"}
    </button>
  );
}
