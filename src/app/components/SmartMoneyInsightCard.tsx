import type { SmartMoneyStageSummary } from "@/lib/market/smart-money-stage";

export function SmartMoneyInsightCard({
  eyebrow,
  summary,
  updating = false,
}: {
  eyebrow: string;
  summary: SmartMoneyStageSummary;
  updating?: boolean;
}) {
  const toneClass = summary.tone === "neutral" ? "" : ` tone-${summary.tone}`;

  return (
    <section
      className={`smart-money-insight-card${toneClass}${updating ? " is-updating" : ""}`}
      aria-label={`${eyebrow}: ${summary.headline}`}
      aria-busy={updating}
    >
      <div className="smart-money-insight-copy">
        <span className="smart-money-insight-eyebrow">
          {eyebrow}
          {updating ? <i>Updating</i> : null}
        </span>
        <h2>
          <span key={summary.headline}>{summary.headline}</span>
        </h2>
        <p>{summary.summary}</p>
      </div>
      <div className="smart-money-insight-metrics" aria-label="Selected evidence readings">
        {summary.metrics.map((metric) => (
          <div
            key={metric.label}
            className={metric.tone ? `is-${metric.tone}` : undefined}
          >
            <strong key={`${metric.label}-${metric.value}`}>{metric.value}</strong>
            <span>{metric.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function SmartMoneyInsightLoadingCard({ label }: { label: string }) {
  return (
    <section
      className="smart-money-insight-card is-loading"
      aria-label={label}
      aria-busy="true"
      role="status"
    >
      <div className="smart-money-insight-copy" aria-hidden="true">
        <span className="smart-money-insight-eyebrow">{label}</span>
        <span className="smart-money-insight-placeholder is-headline" />
        <span className="smart-money-insight-placeholder is-summary" />
      </div>
      <div className="smart-money-insight-loading-metrics" aria-hidden="true">
        <span /><span /><span />
      </div>
    </section>
  );
}
