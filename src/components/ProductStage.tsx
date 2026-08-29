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

/** How hard the stage chrome should read — used to soften mild day moves. */
export type ProductStageIntensity = "mild" | "medium" | "strong";

type ProductStageProps = {
  variant: ProductStageVariant;
  eyebrow: ReactNode;
  /** Omit or pass empty to hide the stage headline (e.g. Live Portfolio puts Fit under Value). */
  headline?: string;
  summary?: ReactNode;
  metrics?: ReactNode;
  /** `above` puts the stat strip over the headline (Portfolio). Default stays a side column. */
  metricsPlacement?: "aside" | "above";
  tone?: ProductStageTone;
  /** Softens portfolio glow for small day moves; default strong. */
  intensity?: ProductStageIntensity;
  /** If true, headline animates in left-to-right like a terminal/typewriter. */
  typewriterHeadline?: boolean;
  /** Shrink the typed headline so the full title paints in this many lines. */
  headlineMaxLines?: number;
  /** When true, render a skeleton loader (no messaging) instead of copy. */
  loading?: boolean;
  /** Render only the metric strip (no eyebrow/headline/summary copy). */
  statOnly?: boolean;
  /** Extra copy-column content (actions, notes). */
  children?: ReactNode;
  "aria-label": string;
};

/**
 * Compact page-top stage: eyebrow + headline + short line, optional metrics.
 * Remounts when the headline changes so arrival motion plays on a live read.
 */
export function ProductStage(props: ProductStageProps) {
  return <ProductStageView key={props.headline || "stage"} {...props} />;
}

function ProductStageView({
  variant,
  eyebrow,
  headline,
  summary,
  metrics,
  metricsPlacement = "aside",
  tone,
  intensity = "strong",
  typewriterHeadline,
  headlineMaxLines,
  loading,
  statOnly,
  children,
  "aria-label": ariaLabel,
}: ProductStageProps) {
  const hasMetrics = Boolean(metrics);
  const metricsAbove = metricsPlacement === "above" && hasMetrics;
  const toneClass = tone && tone !== "neutral" ? ` tone-${tone}` : "";
  const intensityClass =
    variant === "portfolio" && intensity !== "strong" ? ` intensity-${intensity}` : "";
  const useTypewriter = typewriterHeadline ?? true;
  const stageClass = `product-stage product-stage--${variant}${hasMetrics ? " has-metrics" : " is-copy-only"}${metricsAbove ? " product-stage--metrics-above" : ""}${toneClass}${intensityClass}`;

  const metricsEl = hasMetrics ? (
    <div
      className={`product-stage-metrics${loading ? " product-stage-metrics--skeleton" : ""}`}
      aria-label="Key readings"
    >
      {metrics}
    </div>
  ) : null;

  if (statOnly) {
    return (
      <section
        className={`product-stage product-stage--${variant} product-stage--stat-only${toneClass}`}
        aria-label={ariaLabel}
        aria-busy={loading || undefined}
      >
        <div
          className={`product-stage-metrics${loading ? " product-stage-metrics--skeleton" : ""}`}
          aria-label="Key readings"
        >
          {loading ? (
            <>
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
            </>
          ) : (
            metrics
          )}
        </div>
      </section>
    );
  }

  const metricsSkeleton = hasMetrics ? (
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
  ) : null;

  const showHeadline = Boolean(headline);

  if (loading) {
    return (
      <section
        className={`${stageClass} product-stage--skeleton`}
        aria-label={ariaLabel}
        aria-busy="true"
      >
        <div className="product-stage-copy" aria-hidden="true">
          <span className="product-stage-skeleton product-stage-skeleton-eyebrow" />
          {metricsAbove ? metricsSkeleton : null}
          {showHeadline ? (
            <h1 className="product-stage-skeleton-headline" aria-hidden="true">
              <span className="product-stage-skeleton product-stage-skeleton-line product-stage-skeleton-headline-line" />
            </h1>
          ) : null}
          {summary ? <div className="product-stage-skeleton product-stage-skeleton-summary" /> : null}
        </div>
        {metricsAbove ? null : metricsSkeleton}
      </section>
    );
  }

  return (
    <section className={stageClass} aria-label={ariaLabel}>
      <div className="product-stage-copy">
        <span className="product-stage-eyebrow">
          <i aria-hidden="true" />
          {eyebrow}
        </span>
        {metricsAbove ? metricsEl : null}
        {showHeadline ? (
          <h1 className="product-stage-headline" aria-live="polite">
            {useTypewriter ? (
              <TypewriterText
                text={headline!}
                as="span"
                className="product-stage-headline-typewriter"
                msPerChar={26}
                startDelay={70}
                maxLines={headlineMaxLines}
              />
            ) : (
              <span key={headline}>{headline}</span>
            )}
          </h1>
        ) : null}
        {summary ? <p>{summary}</p> : null}
        {children}
      </div>
      {metricsAbove ? null : metricsEl}
    </section>
  );
}
