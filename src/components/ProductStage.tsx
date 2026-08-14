"use client";

import type { ReactNode } from "react";
import { TypewriterText } from "@/components/TypewriterText";

export type ProductStageVariant = "pulse" | "news" | "smart-money" | "watchlist";

/**
 * Compact page-top stage: eyebrow + typewriter headline + short line,
 * optional metrics. Shared across Pulse / News / Smart Money / Watchlist.
 */
export function ProductStage({
  variant,
  eyebrow,
  headline,
  summary,
  metrics,
  "aria-label": ariaLabel,
}: {
  variant: ProductStageVariant;
  eyebrow: ReactNode;
  headline: string;
  summary?: ReactNode;
  metrics?: ReactNode;
  "aria-label": string;
}) {
  const hasMetrics = Boolean(metrics);

  return (
    <section
      className={`product-stage product-stage--${variant}${hasMetrics ? " has-metrics" : " is-copy-only"}`}
      aria-label={ariaLabel}
    >
      <div className="product-stage-copy">
        <span className="product-stage-eyebrow">
          <i aria-hidden="true" />
          {eyebrow}
        </span>
        <TypewriterText as="h1" text={headline} className="product-stage-headline" />
        {summary ? <p>{summary}</p> : null}
      </div>
      {hasMetrics ? (
        <div className="product-stage-metrics" aria-label="Key readings">
          {metrics}
        </div>
      ) : null}
    </section>
  );
}
