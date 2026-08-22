"use client";

import { useState, type ReactNode } from "react";

/** Collapsed phone preview: 3 rows × 2 columns. Desktop still shows the full grid. */
export const HEATMAP_MOBILE_PREVIEW = 6;

export function HeatmapGrid({
  className,
  count,
  children,
}: {
  className: string;
  count: number;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const hidden = Math.max(0, count - HEATMAP_MOBILE_PREVIEW);
  const collapsible = hidden > 0;

  return (
    <>
      <div className={`${className}${collapsible && !expanded ? " is-collapsed" : ""}`}>
        {children}
      </div>
      {collapsible ? (
        <button
          type="button"
          className="heat-show-more"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "Show less" : `Show ${hidden} more`}
        </button>
      ) : null}
    </>
  );
}
