import type { PulseBrief } from "@/lib/market/pulse-brief";

export function PulseDecisionCard({ brief, compact = false }: { brief: PulseBrief; compact?: boolean }) {
  return (
    <section className={`pulse-decision-card tone-${brief.tone}${compact ? " is-compact" : ""}`}>
      <div className="pulse-decision-copy">
        <span className="pulse-decision-eyebrow"><i aria-hidden="true" />{brief.eyebrow}</span>
        <h2>{brief.headline}</h2>
        <p>{brief.summary}</p>
      </div>
      {brief.metrics.length > 0 ? (
        <div className="pulse-decision-metrics" aria-label={`${brief.eyebrow} readings`}>
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
