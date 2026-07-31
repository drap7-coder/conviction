/**
 * Shared heat-tile colors — color = direction of the move.
 * Mild tints for routine moves; fuller fills past a magnitude threshold.
 */

const STRONG_THRESHOLD = 2.5;
/** Sub-1% downs use soft red so full red stays reserved for real alerts. */
const MILD_DOWN_THRESHOLD = 1;

/** Neutral tile when move is missing / flat. */
export const HEAT_NEUTRAL = "#EDEEF1";

export type ChangeToneClass =
  | "positive"
  | "negative"
  | "negative-mild"
  | "neutral";

export function heatTileColor(
  change: number | null | undefined,
  options: { strongThreshold?: number } = {},
): string {
  if (change === null || change === undefined || !Number.isFinite(change)) {
    return HEAT_NEUTRAL;
  }
  if (Math.abs(change) < 0.05) return HEAT_NEUTRAL;

  const strong = Math.abs(change) >= (options.strongThreshold ?? STRONG_THRESHOLD);
  if (change > 0) {
    // Mild green soft → stronger green fill for notable ups
    return strong ? "#86EFAC" : "#DCFCE7";
  }
  // Mild soft-red bg → stronger red tint for notable downs
  return strong ? "#FECACA" : "#FEF2F2";
}

/**
 * Text tone for percent / price changes.
 * Small routine downs get `negative-mild`; larger downs keep full red.
 */
export function changeToneClass(
  change: number | null | undefined,
  options: { mildDownThreshold?: number } = {},
): ChangeToneClass {
  if (change === null || change === undefined || !Number.isFinite(change)) {
    return "neutral";
  }
  if (Math.abs(change) < 0.005) return "neutral";
  if (change > 0) return "positive";
  const mild = options.mildDownThreshold ?? MILD_DOWN_THRESHOLD;
  if (Math.abs(change) < mild) return "negative-mild";
  return "negative";
}
