"use client";

import type { ReactNode } from "react";

export type ProductStageVariant = "pulse" | "news" | "smart-money" | "watchlist" | "portfolio";

export type ProductStageTone =
  | "balanced"
  | "watch"
  | "concentrated"
  | "positive"
  | "negative"
  | "neutral";

/**
 * Compact page-top stage: eyebrow + immediate headline + short line,
 * optional metrics. Shared across Pulse / News / Smart Money / Watchlist / Portfolio.
 */
export function ProductStage({
  variant,
  eyebrow,
  headline,
  summary,
  metrics,
  tone,
  children,
  "aria-label": ariaLabel,
}: {
  variant: ProductStageVariant;
  eyebrow: ReactNode;
  headline: string;
  summary?: ReactNode;
  metrics?: ReactNode;
  tone?: ProductStageTone;
  /** Extra copy-column content (actions, notes). */
  children?: ReactNode;
  "aria-label": string;
}) {
  const hasMetrics = Boolean(metrics);
  const toneClass = tone && tone !== "neutral" ? ` tone-${tone}` : "";

  return (
    <section
      className={`product-stage product-stage--${variant}${hasMetrics ? " has-metrics" : " is-copy-only"}${toneClass}`}
      aria-label={ariaLabel}
    >
      <div className="product-stage-copy">
        <span className="product-stage-eyebrow">
          <i aria-hidden="true" />
          {eyebrow}
        </span>
        <h1 className="product-stage-headline" aria-live="polite">
          <span key={headline}>{headline}</span>
        </h1>
        {summary ? <p>{summary}</p> : null}
        {children}
      </div>
      {hasMetrics ? (
        <div className="product-stage-metrics" aria-label="Key readings">
          {metrics}
        </div>
      ) : null}
    </section>
  );
}
