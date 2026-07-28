/**
 * Circular gauge / conviction ring used on the Quotes page.
 */

"use client";

export type GaugeTone = "green" | "amber" | "red" | "neutral";

interface GaugeRingProps {
  /** Fill amount 0–100. Null = empty/unavailable ring. */
  value: number | null;
  /** Center primary text (score or percent). */
  label: string;
  /** Optional center secondary text (e.g. ACCUMULATING). */
  sublabel?: string | null;
  /** Line under the ring (e.g. $332.50—$338.40). */
  detail?: string | null;
  /** Caption under detail (e.g. Day range). */
  caption?: string;
  tone?: GaugeTone;
  size?: "sm" | "lg";
  /** Optional aria label override. */
  ariaLabel?: string;
}

const TONE_STROKE: Record<GaugeTone, string> = {
  green: "var(--green)",
  amber: "var(--amber)",
  red: "var(--red)",
  neutral: "var(--muted)",
};

export function GaugeRing({
  value,
  label,
  sublabel = null,
  detail = null,
  caption,
  tone = "neutral",
  size = "sm",
  ariaLabel,
}: GaugeRingProps) {
  const radius = size === "lg" ? 58 : 30;
  const stroke = size === "lg" ? 10 : 5.5;
  const view = (radius + stroke) * 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = value === null ? 0 : Math.max(0, Math.min(100, value));
  const dash = (clamped / 100) * circumference;

  return (
    <div
      className={`quote-gauge quote-gauge-${size} quote-gauge-tone-${tone}`}
      role="img"
      aria-label={ariaLabel ?? `${caption}: ${label}`}
    >
      <div className="quote-gauge-ring">
        <svg
          className="quote-gauge-svg"
          viewBox={`0 0 ${view} ${view}`}
          width={view}
          height={view}
          aria-hidden="true"
        >
          <circle
            className="quote-gauge-track"
            cx={view / 2}
            cy={view / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
          />
          <circle
            className="quote-gauge-fill"
            cx={view / 2}
            cy={view / 2}
            r={radius}
            fill="none"
            stroke={TONE_STROKE[tone]}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
            transform={`rotate(-90 ${view / 2} ${view / 2})`}
          />
        </svg>
        <div className="quote-gauge-center">
          <strong className="quote-gauge-value">{label}</strong>
          {sublabel ? <span className="quote-gauge-sublabel">{sublabel}</span> : null}
        </div>
      </div>
      {detail ? <span className="quote-gauge-detail">{detail}</span> : null}
      {caption ? <span className="quote-gauge-caption">{caption}</span> : null}
    </div>
  );
}
