"use client";

import { useMemo } from "react";
import { getConvictionBadge } from "@/lib/conviction/canonical-types";
import type { ConvictionSnapshot } from "@/lib/conviction/canonical-types";

interface ConvictionBadgeProps {
  snapshot: ConvictionSnapshot;
  className?: string;
  /** Show a compact version (just the verdict tone) */
  compact?: boolean;
}

/**
 * Renders the canonical conviction badge for a snapshot.
 * Shows verdict + direction + technical state as a single pill.
 */
export function ConvictionBadge({ snapshot, className = "", compact = false }: ConvictionBadgeProps) {
  const badge = useMemo(() => getConvictionBadge(snapshot), [snapshot]);

  // Low-coverage badges add noise without giving the user an actionable signal.
  if (badge.verdict === "Insufficient") return null;

  if (compact) {
    return (
      <span className={`watchlist-row-state watchlist-row-state-${badge.tone} ${className}`}>
        {badge.verdict}
      </span>
    );
  }

  const parts = [badge.verdict, badge.direction, badge.technicalState].filter(Boolean);
  const label = parts.join(" · ");

  return (
    <span className={`watchlist-row-state watchlist-row-state-${badge.tone} ${className}`}>
      {label}
    </span>
  );
}
