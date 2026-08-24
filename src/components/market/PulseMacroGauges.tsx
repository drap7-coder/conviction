"use client";

import type { PulseIndicator } from "@/app/api/market/pulse/route";
import {
  pulseMacroGauges,
  type PulseGaugeCard,
} from "@/lib/market/pulse-gauges";

const RADIUS = 62;
const STROKE = 10;
const CX = 80;
const CY = 84;
const TRACK = Math.PI * RADIUS;

function GaugeArc({ card }: { card: PulseGaugeCard }) {
  const fill = Math.max(0, Math.min(100, card.fill));
  const dash = (fill / 100) * TRACK;
  const d = `M ${CX - RADIUS} ${CY} A ${RADIUS} ${RADIUS} 0 0 1 ${CX + RADIUS} ${CY}`;

  return (
    <svg className="pulse-gauge-arc" viewBox="0 0 160 96" aria-hidden="true">
      <path
        d={d}
        fill="none"
        stroke="var(--border)"
        strokeWidth={STROKE}
        strokeLinecap="round"
      />
      <path
        className={`pulse-gauge-fill pulse-gauge-fill--${card.accent}`}
        d={d}
        fill="none"
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${TRACK}`}
      />
    </svg>
  );
}

function GaugeCard({ card }: { card: PulseGaugeCard }) {
  return (
    <article
      className={`pulse-gauge-card pulse-gauge-card--${card.accent}`}
      aria-label={`${card.label} ${card.value}, ${card.status}, ${card.caption}`}
    >
      <p className="pulse-gauge-kicker">{card.label}</p>
      <div className="pulse-gauge-face">
        <GaugeArc card={card} />
        <div className="pulse-gauge-readout">
          <strong className="tnum">{card.value}</strong>
          <span className={`pulse-gauge-pill pulse-gauge-pill--${card.tone}`}>
            {card.status}
          </span>
        </div>
      </div>
      <p className="pulse-gauge-caption">{card.caption}</p>
    </article>
  );
}

export function PulseMacroGauges({
  indicators,
}: {
  indicators: PulseIndicator[];
}) {
  const cards = pulseMacroGauges(indicators);
  if (cards.length === 0) return null;

  return (
    <section className="pulse-gauge-grid" aria-label="VIX and 10-year yield">
      {cards.map((card) => (
        <GaugeCard key={card.id} card={card} />
      ))}
    </section>
  );
}
