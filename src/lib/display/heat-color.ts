/**
 * Shared heat-tile colors — color = direction of the session move.
 *
 * Tiles are two-state (up/down), not the three-state conviction legend
 * (Accumulating / Holding / Distribution). See docs/punchlist-color-ux.md.
 *
 * Teal = up. Soft → mid → solid teal by magnitude.
 * Soft red = mild downs; fuller red past the strong threshold.
 */

/** Escalate past this for a clearer fill (default ±2.5%). */
const STRONG_THRESHOLD = 2.5;
/** Mega-moves (earnings gaps, etc.) get the solid teal / fuller red. */
const EXTREME_THRESHOLD = 8;
/** Sub-1% downs use soft red so full red stays reserved for real alerts. */
const MILD_DOWN_THRESHOLD = 1;

/** Neutral tile when move is missing / flat. */
export const HEAT_NEUTRAL = "#EDEEF1";

/** Positive / Accumulating teal — matches selection accent and ring legend. */
export const HEAT_TEAL = "#0D9488";
export const HEAT_TEAL_MID = "#5EEAD4";
export const HEAT_TEAL_SOFT = "#CCFBF1";

export const HEAT_RED_SOFT_BG = "#FEF2F2";
export const HEAT_RED_MID = "#FECACA";
export const HEAT_RED_STRONG = "#FCA5A5";
export const HEAT_RED_MILD = "#F87171";

export type ChangeToneClass =
  | "positive"
  | "negative"
  | "negative-mild"
  | "neutral";

export function heatTileColor(
  change: number | null | undefined,
  options: { strongThreshold?: number; extremeThreshold?: number } = {},
): string {
  if (change === null || change === undefined || !Number.isFinite(change)) {
    return HEAT_NEUTRAL;
  }
  if (Math.abs(change) < 0.05) return HEAT_NEUTRAL;

  const strongAt = options.strongThreshold ?? STRONG_THRESHOLD;
  const extremeAt = options.extremeThreshold ?? EXTREME_THRESHOLD;
  const abs = Math.abs(change);
  const extreme = abs >= extremeAt;
  const strong = abs >= strongAt;

  if (change > 0) {
    if (extreme) return HEAT_TEAL;
    if (strong) return HEAT_TEAL_MID;
    return HEAT_TEAL_SOFT;
  }
  if (extreme) return HEAT_RED_STRONG;
  if (strong) return HEAT_RED_MID;
  return HEAT_RED_SOFT_BG;
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
