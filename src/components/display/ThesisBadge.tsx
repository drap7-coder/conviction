/**
 * ── ThesisBadge (shared) ──
 *
 * Small presentation primitive for thesis status.
 */

import type { ThesisDisplay } from "@/lib/display/types";

interface ThesisBadgeProps {
  thesis: ThesisDisplay;
  className?: string;
}

const STATUS_LABELS: Record<string, string> = {
  building: "Building",
  supported: "Supported",
  review: "Review",
  weakening: "Weakening",
  broken: "Broken",
};

const STATUS_COLORS: Record<string, string> = {
  building: "quiet",
  supported: "positive",
  review: "contested",
  weakening: "negative",
  broken: "negative",
};

export function ThesisBadge({ thesis, className = "" }: ThesisBadgeProps) {
  if (!thesis.status) return null;

  const label = STATUS_LABELS[thesis.status] ?? thesis.status;
  const tone = STATUS_COLORS[thesis.status] ?? "quiet";

  return (
    <span
      className={`watchlist-row-state watchlist-row-state-${tone} ${className}`}
      title={
        thesis.isOverdue && thesis.reviewAt
          ? `Review overdue since ${new Date(thesis.reviewAt).toLocaleDateString()}`
          : undefined
      }
    >
      {label}
      {thesis.isOverdue ? " (overdue)" : ""}
    </span>
  );
}