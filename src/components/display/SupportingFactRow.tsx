/**
 * ── SupportingFactRow (shared) ──
 *
 * Renders a single supporting fact as a compact row.
 */

import type { SecurityCardFact } from "@/lib/display/types";

interface SupportingFactRowProps {
  fact: SecurityCardFact;
  className?: string;
}

export function SupportingFactRow({
  fact,
  className = "",
}: SupportingFactRowProps) {
  const content = (
    <span
      className={`supporting-fact supporting-fact-${fact.significance} ${className}`}
    >
      {fact.label}
    </span>
  );

  if (fact.href) {
    return (
      <a
        href={fact.href}
        className="supporting-fact-link"
        onClick={(e) => e.stopPropagation()}
      >
        {content}
      </a>
    );
  }

  return content;
}