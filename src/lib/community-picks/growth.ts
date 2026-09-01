/** Multiplicative growth math for continuous community pick accumulation. */

export function activeGrowthFactor(activeStartSpot: number, currentSpot: number): number {
  if (!Number.isFinite(activeStartSpot) || activeStartSpot <= 0) return 1;
  if (!Number.isFinite(currentSpot) || currentSpot <= 0) return 1;
  return currentSpot / activeStartSpot;
}

export function totalGrowthFactor(bankedGrowthFactor: number, activeFactor: number): number {
  if (!Number.isFinite(bankedGrowthFactor) || bankedGrowthFactor <= 0) return activeFactor;
  if (!Number.isFinite(activeFactor) || activeFactor <= 0) return bankedGrowthFactor;
  return bankedGrowthFactor * activeFactor;
}

/** Lifetime return as a percentage (totalGrowthFactor - 1) * 100. */
export function lifetimeReturnPct(totalGrowth: number): number {
  if (!Number.isFinite(totalGrowth)) return 0;
  return Math.round((totalGrowth - 1) * 10000) / 100;
}

/** Active-leg return as a percentage. */
export function activeReturnPct(activeFactor: number): number {
  return lifetimeReturnPct(activeFactor);
}

/** Closed-leg growth factor from entry and exit spots. */
export function pickGrowthFactor(startSpot: number, exitSpot: number): number {
  return activeGrowthFactor(startSpot, exitSpot);
}

/** Closed-leg return percentage for history display. */
export function pickReturnPct(startSpot: number, exitSpot: number): number {
  return lifetimeReturnPct(pickGrowthFactor(startSpot, exitSpot));
}

export function averageLifetimeReturnPct(values: number[]): number | null {
  if (values.length === 0) return null;
  const sum = values.reduce((acc, value) => acc + value, 0);
  return Math.round((sum / values.length) * 100) / 100;
}
