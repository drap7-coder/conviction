"use client";

import type { ReactNode } from "react";
import { TypewriterText } from "@/components/TypewriterText";

export type ProductStageVariant = "pulse" | "news" | "smart-money" | "watchlist" | "portfolio";

export type ProductStageTone =
  | "balanced"
  | "watch"
  | "concentrated"
  | "positive"
  | "negative"
  | "neutral";

type ProductStageProps = {
  variant: ProductStageVariant;
  eyebrow: ReactNode;
  headline: string;
  summary?: ReactNode;
  metrics?: ReactNode;
  tone?: ProductStageTone;
  /** If true, headline animates in left-to-right like a terminal/typewriter. */
  typewriterHeadline?: boolean;
  /** When true, render a skeleton loader (no messaging) instead of copy. */
  loading?: boolean;
  /** Extra copy-column content (actions, notes). */
  children?: ReactNode;
  "aria-label": string;
};

/**
 * Compact page-top stage: eyebrow + headline + short line, optional metrics.
 * Remounts when the headline changes so arrival motion plays on a live read.
 */
export function ProductStage(props: ProductStageProps) {
  return <ProductStageView key={props.headline} {...props} />;
}

function ProductStageView({
  variant,
  eyebrow,
  headline,
  summary,
  metrics,
  tone,
  typewriterHeadline,
  loading,
  children,
  "aria-label": ariaLabel,
}: ProductStageProps) {
  const hasMetrics = Boolean(metrics);
  const toneClass = tone && tone !== "neutral" ? ` tone-${tone}` : "";
  const useTypewriter = typewriterHeadline ?? true;

  if (loading) {
    return (
      <section
        className={`product-stage product-stage--${variant} product-stage--skeleton${hasMetrics ? " has-metrics" : " is-copy-only"}${toneClass}`}
        aria-label={ariaLabel}
        aria-busy="true"
      >
        <div className="product-stage-copy" aria-hidden="true">
          <span className="product-stage-skeleton product-stage-skeleton-eyebrow" />
          <h1 className="product-stage-skeleton-headline" aria-hidden="true">
            <span className="product-stage-skeleton product-stage-skeleton-line product-stage-skeleton-headline-line" />
          </h1>
          {summary ? <div className="product-stage-skeleton product-stage-skeleton-summary" /> : null}
        </div>

        {hasMetrics ? (
          <div className="product-stage-metrics product-stage-metrics--skeleton" aria-hidden="true">
            <div>
              <span className="product-stage-skeleton product-stage-skeleton-strong" />
              <span className="product-stage-skeleton product-stage-skeleton-small" />
            </div>
            <div>
              <span className="product-stage-skeleton product-stage-skeleton-strong" />
              <span className="product-stage-skeleton product-stage-skeleton-small" />
            </div>
            <div>
              <span className="product-stage-skeleton product-stage-skeleton-strong" />
              <span className="product-stage-skeleton product-stage-skeleton-small" />
            </div>
          </div>
        ) : null}
      </section>
    );
  }

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
          {useTypewriter ? (
            <TypewriterText
              text={headline}
              as="span"
              className="product-stage-headline-typewriter"
              msPerChar={26}
              startDelay={70}
            />
          ) : (
            <span key={headline}>{headline}</span>
          )}
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
