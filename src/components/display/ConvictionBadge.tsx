/**
 * ── ConvictionBadge (shared) ──
 *
 * Pure presentation primitive that renders the canonical conviction state.
 * Uses the existing ConvictionBadge component logic but as a shared primitive.
 *
 * This is a thin wrapper around the canonical badge data — no surface-specific
 * styling or content.
 */

import type { ConvictionDisplay } from "@/lib/display/types";

interface ConvictionBadgeProps {
  conviction: ConvictionDisplay;
  className?: string;
}

export function ConvictionBadge({
  conviction,
  className = "",
}: ConvictionBadgeProps) {
  if (conviction.state === "unsupported" || conviction.state === "error") {
    return null;
  }

  return (
    <span
      className={`watchlist-row-state watchlist-row-state-${conviction.tone} ${className}`}
    >
      {conviction.label}
    </span>
  );
}
