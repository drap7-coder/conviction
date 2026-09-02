import type { EvidenceLaneId, EvidenceSemantic } from "@/lib/conviction/evidence-display";
import type { ConvictionSignalStatus } from "@/lib/conviction/signal-display";

export interface EvidenceDecisionLane {
  id: EvidenceLaneId;
  label: string;
  semantic: EvidenceSemantic | "loading" | "unavailable";
  status: ConvictionSignalStatus;
  primary: string;
  secondary?: string | null;
}

export interface EvidenceDecisionView {
  stance: EvidenceSemantic;
  headline: string;
  explanation: string;
  supportCount: number;
  againstCount: number;
  coveredCount: number;
  totalCount: number;
  coveragePercent: number;
  leadingSupport: EvidenceDecisionLane | null;
  leadingRisk: EvidenceDecisionLane | null;
  unresolved: EvidenceDecisionLane | null;
  gapLabels: string[];
}

const DECISION_PRIORITY: Record<EvidenceLaneId, number> = {
  earnings: 100,
  institutional: 90,
  disclosures: 80,
  technicals: 70,
  short_interest: 60,
  insider: 50,
  ownership: 40,
  political: 30,
};

function mostDecisionRelevant(lanes: EvidenceDecisionLane[]): EvidenceDecisionLane | null {
  return [...lanes].sort(
    (left, right) => DECISION_PRIORITY[right.id] - DECISION_PRIORITY[left.id],
  )[0] ?? null;
}

function decisionHeadline(
  supportCount: number,
  againstCount: number,
  mixedCount: number,
): Pick<EvidenceDecisionView, "stance" | "headline" | "explanation"> {
  if (supportCount > 0 && againstCount > 0) {
    if (supportCount > againstCount) {
      return {
        stance: "mixed",
        headline: "Support leads, but the dissent matters.",
        explanation: "The evidence is constructive on balance, with a live contradiction that still needs to be resolved.",
      };
    }
    if (againstCount > supportCount) {
      return {
        stance: "against",
        headline: "Pressure leads the evidence stack.",
        explanation: "Some signals still support the case, but the strongest balance of evidence is leaning against it.",
      };
    }
    return {
      stance: "mixed",
      headline: "The setup is genuinely contested.",
      explanation: "Confirming and disconfirming evidence are evenly split. The next proof point matters more than the composite.",
    };
  }

  if (supportCount >= 2) {
    return {
      stance: "support",
      headline: "Independent signals are aligning.",
      explanation: "Multiple evidence lanes support the case with no live directional contradiction in the current stack.",
    };
  }

  if (againstCount >= 2) {
    return {
      stance: "against",
      headline: "The evidence is deteriorating.",
      explanation: "Multiple independent lanes are pushing against the case. Fresh proof is needed before it improves.",
    };
  }

  if (supportCount === 1) {
    return {
      stance: "support",
      headline: "There is support, but not yet confirmation.",
      explanation: "One live lane is constructive; the rest of the stack has not aligned strongly enough to call it broad conviction.",
    };
  }

  if (againstCount === 1) {
    return {
      stance: "against",
      headline: "One warning is carrying the risk read.",
      explanation: "A live lane is leaning against the case, while the broader evidence stack remains quiet or unresolved.",
    };
  }

  if (mixedCount > 0) {
    return {
      stance: "mixed",
      headline: "A clear read is not earned yet.",
      explanation: "The available evidence is informative but non-directional. Wait for a cleaner confirming or disconfirming signal.",
    };
  }

  return {
    stance: "quiet",
    headline: "The evidence stack is still forming.",
    explanation: "Too few fresh, directional inputs are live to make the signal read decision-grade.",
  };
}

export function buildEvidenceDecisionView(
  lanes: EvidenceDecisionLane[],
): EvidenceDecisionView {
  const support = lanes.filter((lane) => lane.semantic === "support");
  const against = lanes.filter((lane) => lane.semantic === "against");
  const mixed = lanes.filter((lane) => lane.semantic === "mixed");
  const covered = lanes.filter(
    (lane) => lane.status === "available" || lane.status === "quiet",
  );
  const gaps = lanes.filter(
    (lane) => lane.semantic === "loading" || lane.semantic === "unavailable",
  );
  const unresolvedPool = [
    ...mixed,
    ...lanes.filter((lane) => lane.semantic === "quiet"),
    ...gaps,
  ];
  const read = decisionHeadline(support.length, against.length, mixed.length);

  return {
    ...read,
    supportCount: support.length,
    againstCount: against.length,
    coveredCount: covered.length,
    totalCount: lanes.length,
    coveragePercent: lanes.length === 0
      ? 0
      : Math.round((covered.length / lanes.length) * 100),
    leadingSupport: mostDecisionRelevant(support),
    leadingRisk: mostDecisionRelevant(against),
    unresolved: mostDecisionRelevant(unresolvedPool),
    gapLabels: gaps.map((lane) => lane.label),
  };
}
