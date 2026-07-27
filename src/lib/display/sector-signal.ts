/**
 * Derive a sector-level intelligence reading from relative performance.
 * Keeps Industries cards in the shared Strong / Mixed / Weak / Awaiting vocabulary.
 */

import type { EvidenceStrength } from "@/lib/display/vocabulary";
import { EVIDENCE_STRENGTH_LABEL } from "@/lib/display/vocabulary";

export interface SectorSignalInput {
  name: string;
  changePercent: number | null;
  leaders: string[];
  description?: string;
}

export interface SectorSignal {
  strength: EvidenceStrength;
  conclusion: string;
  evidence: string;
  whyItMatters: string;
  dateLabel: string;
  source: "market_data";
}

function formatMove(changePercent: number): string {
  const sign = changePercent > 0 ? "+" : "";
  return `${sign}${changePercent.toFixed(2)}%`;
}

export function getSectorSignal(input: SectorSignalInput): SectorSignal {
  const { name, changePercent, leaders, description } = input;
  const lead = leaders[0] ?? null;

  if (changePercent === null || !Number.isFinite(changePercent)) {
    return {
      strength: "awaiting",
      conclusion: `${name} is awaiting evidence`,
      evidence: "Sector ETF move is unavailable right now.",
      whyItMatters: description
        ? description
        : "Without a readable sector move, treat single-name action as incomplete context.",
      dateLabel: "Today",
      source: "market_data",
    };
  }

  let strength: EvidenceStrength;
  if (changePercent >= 0.75) strength = "strong";
  else if (changePercent <= -0.75) strength = "weak";
  else strength = "mixed";

  const strengthLabel = EVIDENCE_STRENGTH_LABEL[strength].toLowerCase();
  const conclusion =
    strength === "strong"
      ? `${name} leadership is ${strengthLabel}`
      : strength === "weak"
        ? `${name} leadership is ${strengthLabel}`
        : `${name} leadership is mixed`;

  const evidence = `${name} is ${formatMove(changePercent)} today${
    lead ? `; ${lead} is a representative name in the group` : ""
  }.`;

  const whyItMatters =
    strength === "strong"
      ? "Sector strength can confirm whether a company move is idiosyncratic or part of broader leadership."
      : strength === "weak"
        ? "Sector weakness raises the bar for single-name theses — company-specific evidence must clear the sector drag."
        : "A mixed sector tape means company-level evidence matters more than the group move.";

  return {
    strength,
    conclusion,
    evidence,
    whyItMatters,
    dateLabel: "Today",
    source: "market_data",
  };
}
