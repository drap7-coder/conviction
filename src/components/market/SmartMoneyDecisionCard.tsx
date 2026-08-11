import type { SmartMoneyBrief } from "@/lib/market/smart-money-brief";

export function SmartMoneyDecisionCard({ brief, political = false }: { brief: SmartMoneyBrief; political?: boolean }) {
  return (
    <section className={`smart-money-answer tone-${brief.tone}${political ? " smart-money-answer--political" : ""}`}>
      <div className="smart-money-answer-copy">
        <span className="smart-money-answer-eyebrow"><i aria-hidden="true" />{brief.eyebrow}</span>
        <h2>{brief.headline}</h2>
        <p>{brief.summary}</p>
      </div>
      {brief.metrics.length > 0 ? (
        <div className="smart-money-answer-metrics" aria-label={`${brief.eyebrow} readings`}>
          {brief.metrics.map((metric) => (
            <div key={metric.label} className={`tone-${metric.tone ?? "neutral"}`}>
              <strong>{metric.value}</strong>
              <span>{metric.label}</span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
