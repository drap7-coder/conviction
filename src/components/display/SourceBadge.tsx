/**
 * ── SourceBadge ──
 *
 * Consistent source attribution across every intelligence surface.
 */

import {
  SOURCE_BADGE_LABEL,
  sourceBadgeLabel,
  type SourceBadge as SourceBadgeKind,
} from "@/lib/display/vocabulary";

interface SourceBadgeProps {
  /** Known badge kind, or a raw provider string to normalize. */
  source: SourceBadgeKind | string;
  className?: string;
}

export function SourceBadge({ source, className = "" }: SourceBadgeProps) {
  const label =
    source in SOURCE_BADGE_LABEL
      ? SOURCE_BADGE_LABEL[source as SourceBadgeKind]
      : sourceBadgeLabel(source);

  return (
    <span className={`source-badge ${className}`.trim()}>
      {label}
    </span>
  );
}
