"use client";

import { useEffect, useState } from "react";
import type { MoveEvent } from "@/lib/evidence/move-events";

interface MoveExplanationSectionProps {
  ticker: string;
}

function confidenceLabel(confidence: MoveEvent["confidence"]) {
  if (confidence === "high") return "High confidence";
  if (confidence === "medium") return "Medium confidence";
  return "Low confidence";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

export function MoveExplanationSection({ ticker }: MoveExplanationSectionProps) {
  const [event, setEvent] = useState<MoveEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/evidence/move?ticker=${ticker}`);
        if (!response.ok) throw new Error("Failed to load move evidence");
        const data = (await response.json()) as MoveEvent;
        if (!cancelled) setEvent(data);
      } catch {
        if (!cancelled) setError("Move explanation unavailable.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  return (
    <section className="move-section">
      <div className="section-header mt-16">
        <h2 className="section-title">Why moved?</h2>
        <span className="section-count">Recent catalyst</span>
      </div>

      {loading ? (
        <div className="move-card loading">
          <span className="move-eyebrow">Checking catalyst evidence...</span>
          <h3>Looking for a sourced explanation.</h3>
        </div>
      ) : error ? (
        <div className="move-card">
          <h3>{error}</h3>
          <p className="move-answer">No claim is better than a fake one.</p>
        </div>
      ) : event ? (
        <div className={`move-card confidence-${event.confidence}`}>
          <div className="move-card-top">
            <div>
              <span className="move-eyebrow">{formatDate(event.date)}</span>
              <h3>{event.headline}</h3>
            </div>
            <span className="move-confidence">
              {confidenceLabel(event.confidence)}
            </span>
          </div>

          <p className="move-answer">{event.answer}</p>

          {event.marketMove ? (
            <p className="move-market">{event.marketMove}</p>
          ) : null}

          <ul className="move-details">
            {event.details.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>

          <div className="move-conviction-check">
            <strong>Conviction check</strong>
            <span>{event.convictionQuestion}</span>
          </div>

          {event.sources.length > 0 ? (
            <div className="move-sources" aria-label="Sources">
              {event.sources.map((source) => (
                <a
                  href={source.url}
                  key={source.url}
                  rel="noreferrer"
                  target="_blank"
                >
                  {source.label}
                </a>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
