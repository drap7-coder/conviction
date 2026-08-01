/**
 * ── SignalBlock ──
 *
 * One shared intelligence format:
 *   Conclusion → Evidence → Why it matters → Date · Source
 *
 * Rendered as a color-coded ink box with highlighted status chips.
 */

import type { ReactNode } from "react";
import { SourceBadge } from "./SourceBadge";
import type { SourceBadge as SourceBadgeKind } from "@/lib/display/vocabulary";
import type { EvidenceStrength } from "@/lib/display/vocabulary";
import { EVIDENCE_STRENGTH_LABEL, EVIDENCE_STRENGTH_TONE } from "@/lib/display/vocabulary";
import { inkBoxClass, inkChipClass, inkToneFromSemantic } from "@/lib/display/ink-tone";

export interface SignalBlockProps {
  conclusion: string;
  evidence?: string | null;
  whyItMatters?: string | null;
  dateLabel?: string | null;
  source?: SourceBadgeKind | string | null;
  strength?: EvidenceStrength | null;
  /** Optional status chip opposite the conclusion (e.g. today’s news catalyst). */
  badge?: { label: string; tone?: string } | null;
  eyebrow?: string | null;
  compact?: boolean;
  children?: ReactNode;
  className?: string;
}

export function SignalBlock({
  conclusion,
  evidence,
  whyItMatters,
  dateLabel,
  source,
  strength,
  badge,
  eyebrow,
  compact = false,
  children,
  className = "",
}: SignalBlockProps) {
  const semantic = badge?.tone ?? (strength ? EVIDENCE_STRENGTH_TONE[strength] : null);
  const inkTone = inkToneFromSemantic(semantic);
  const chipLabel = badge?.label ?? (strength ? EVIDENCE_STRENGTH_LABEL[strength] : null);

  return (
    <section
      className={`signal-block ${inkBoxClass(inkTone)} ${compact ? "signal-block-compact" : ""} ${className}`.trim()}
      aria-label={conclusion}
    >
      <div className="signal-block-heading">
        <div className="signal-block-heading-text">
          {eyebrow ? <span className="signal-block-eyebrow">{eyebrow}</span> : null}
          <strong className="signal-block-conclusion">{conclusion}</strong>
        </div>
        {chipLabel ? (
          <span className={inkChipClass(inkTone)}>{chipLabel}</span>
        ) : null}
      </div>

      {evidence ? <p className="signal-block-evidence">{evidence}</p> : null}
      {whyItMatters ? <p className="signal-block-why">{whyItMatters}</p> : null}
      {children}

      {(dateLabel || source) ? (
        <div className="signal-block-meta">
          {dateLabel ? <span>{dateLabel}</span> : null}
          {dateLabel && source ? <span aria-hidden="true">·</span> : null}
          {source ? <SourceBadge source={source} /> : null}
        </div>
      ) : null}
    </section>
  );
}
