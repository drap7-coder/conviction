"use client";

import { ProductStage } from "@/components/ProductStage";
import type { SmartMoneyStageSummary } from "@/lib/market/smart-money-stage";

export function SmartMoneyProductStage({
  eyebrow,
  summary,
  loading = false,
  "aria-label": ariaLabel,
}: {
  eyebrow: string;
  summary: SmartMoneyStageSummary;
  loading?: boolean;
  "aria-label": string;
}) {
  return (
    <ProductStage
      variant="smart-money"
      aria-label={ariaLabel}
      loading={loading}
      tone={summary.tone === "neutral" ? undefined : summary.tone}
      eyebrow={eyebrow}
      headline={summary.headline}
      summary={summary.summary}
      metrics={
        <>
          {summary.metrics.map((metric) => (
            <div
              key={metric.label}
              className={metric.tone ? `is-${metric.tone}` : undefined}
            >
              <strong>{metric.value}</strong>
              <span>{metric.label}</span>
            </div>
          ))}
        </>
      }
    />
  );
}
