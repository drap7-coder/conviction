import type { CompetitionPick } from "@/lib/competitions/types";

export function computeReturnPct(startPrice: number, currentPrice: number): number {
  if (!Number.isFinite(startPrice) || startPrice <= 0 || !Number.isFinite(currentPrice)) {
    return 0;
  }
  return Math.round(((currentPrice - startPrice) / startPrice) * 10000) / 100;
}

/** AVG(returnPct) across locked picks only for a group side. */
export function computeSideScore(
  picks: CompetitionPick[],
  groupId: string,
): { avgReturnPct: number | null; pickCount: number } {
  const locked = picks.filter(
    (pick) => pick.groupId === groupId && pick.lockedAt && pick.returnPct !== null,
  );
  if (locked.length === 0) {
    const submitted = picks.filter((pick) => pick.groupId === groupId);
    return { avgReturnPct: null, pickCount: submitted.length };
  }
  const sum = locked.reduce((acc, pick) => acc + (pick.returnPct ?? 0), 0);
  return {
    avgReturnPct: Math.round((sum / locked.length) * 100) / 100,
    pickCount: locked.length,
  };
}

/** Count all submitted picks (locked or not) for participation subtext. */
export function countSubmittedPicks(picks: CompetitionPick[], groupId: string): number {
  return picks.filter((pick) => pick.groupId === groupId).length;
}
