import type { SmartMoneyStageSummary } from "@/lib/market/smart-money-stage";

export function SmartMoneyInsightCard({
  eyebrow,
  summary,
}: {
  eyebrow: string;
  summary: SmartMoneyStageSummary;
}) {
  const toneClass = summary.tone === "neutral" ? "" : ` tone-${summary.tone}`;

  return (
    <section
      className={`smart-money-insight-card${toneClass}`}
      aria-label={`${eyebrow}: ${summary.headline}`}
    >
      <div className="smart-money-insight-copy">
        <span className="smart-money-insight-eyebrow">{eyebrow}</span>
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
            <strong>{metric.value}</strong>
            <span>{metric.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
