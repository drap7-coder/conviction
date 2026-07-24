/**
 * ── EvidenceSummary (shared) ──
 *
 * Renders one concise evidence headline below the conviction badge.
 */

import type { SecurityCardSummary } from "@/lib/display/types";

interface EvidenceSummaryProps {
  summary: SecurityCardSummary;
  className?: string;
}

export function EvidenceSummary({
  summary,
  className = "",
}: EvidenceSummaryProps) {
  return (
    <div className={`evidence-summary ${className}`}>
      <span className={`evidence-summary-text evidence-summary-${summary.significance}`}>
        {summary.headline}
      </span>
    </div>
  );
}