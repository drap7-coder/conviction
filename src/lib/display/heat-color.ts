/**
 * Shared heat-tile colors — color = direction + magnitude of the session move.
 *
 * Tiles are two-state (up/down) with mild / strong / extreme intensity,
 * not the three-state conviction legend (Accumulating / Holding / Distribution).
 *
 * Thresholds: strong ≥ 2.5%, extreme ≥ 8% (match legend).
 */

/** Escalate past this for a clearer fill. */
export const HEAT_STRONG_THRESHOLD = 2.5;
/** Mega-moves (earnings gaps, etc.). */
export const HEAT_EXTREME_THRESHOLD = 8;
/** Sub-1% downs use soft red for text tone helpers. */
const MILD_DOWN_THRESHOLD = 1;

export type HeatBand = "flat" | "up-mild" | "up-strong" | "up-extreme" | "down-mild" | "down-strong" | "down-extreme";

/** Tile fill — Tailwind emerald / rose / neutral scale (dark UI). */
export const HEAT_TILE_BG: Record<HeatBand, string> = {
  flat: "#262626", // neutral-800
  "up-mild": "#064E3B", // emerald-900
  "up-strong": "#047857", // emerald-700
  "up-extreme": "#10B981", // emerald-500
  "down-mild": "#4C0519", // rose-950
  "down-strong": "#9F1239", // rose-800
  "down-extreme": "#E11D48", // rose-600
};

/** Percent chip fill + text — contrast matched to the chip, not the tile. */
export const HEAT_CHIP: Record<HeatBand, { background: string; color: string }> = {
  flat: { background: "#404040", color: "#E5E5E5" }, // neutral-700 / 200
  "up-mild": { background: "#065F46", color: "#D1FAE5" }, // emerald-800 / 100
  "up-strong": { background: "#059669", color: "#FFFFFF" }, // emerald-600 / white
  "up-extreme": { background: "#34D399", color: "#022C22" }, // emerald-400 / 950
  "down-mild": { background: "#881337", color: "#FFE4E6" }, // rose-900 / 100
  "down-strong": { background: "#BE123C", color: "#FFFFFF" }, // rose-700 / white
  "down-extreme": { background: "#F43F5E", color: "#FFFFFF" }, // rose-500 / white
};

/** Legend swatches (tile backgrounds). */
export const HEAT_NEUTRAL = HEAT_TILE_BG.flat;
export const HEAT_TEAL_SOFT = HEAT_TILE_BG["up-mild"];
export const HEAT_TEAL_MID = HEAT_TILE_BG["up-strong"];
export const HEAT_TEAL = HEAT_TILE_BG["up-extreme"];
export const HEAT_RED_SOFT_BG = HEAT_TILE_BG["down-mild"];
export const HEAT_RED_MID = HEAT_TILE_BG["down-strong"];
export const HEAT_RED_STRONG = HEAT_TILE_BG["down-extreme"];
export const HEAT_RED_MILD = "#F87171";

export type ChangeToneClass =
  | "positive"
  | "negative"
  | "negative-mild"
  | "neutral";

export function heatBand(
  change: number | null | undefined,
  options: { strongThreshold?: number; extremeThreshold?: number } = {},
): HeatBand {
  if (change === null || change === undefined || !Number.isFinite(change)) {
    return "flat";
  }
  if (Math.abs(change) < 0.05) return "flat";

  const strongAt = options.strongThreshold ?? HEAT_STRONG_THRESHOLD;
  const extremeAt = options.extremeThreshold ?? HEAT_EXTREME_THRESHOLD;
  const abs = Math.abs(change);
  const extreme = abs >= extremeAt;
  const strong = abs >= strongAt;

  if (change > 0) {
    if (extreme) return "up-extreme";
    if (strong) return "up-strong";
    return "up-mild";
  }
  if (extreme) return "down-extreme";
  if (strong) return "down-strong";
  return "down-mild";
}

export function heatTileColor(
  change: number | null | undefined,
  options: { strongThreshold?: number; extremeThreshold?: number } = {},
): string {
  return HEAT_TILE_BG[heatBand(change, options)];
}

export function heatChipColors(
  change: number | null | undefined,
  options: { strongThreshold?: number; extremeThreshold?: number } = {},
): { background: string; color: string } {
  return HEAT_CHIP[heatBand(change, options)];
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
