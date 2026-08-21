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

/** Tile fill — brokerage teal / red / canvas (readable white type). */
export const HEAT_TILE_BG: Record<HeatBand, string> = {
  flat: "#1c2430",
  "up-mild": "#0c3d38",
  "up-strong": "#0f6e66",
  "up-extreme": "#14b8a6",
  "down-mild": "#3d1818",
  "down-strong": "#8f3532",
  "down-extreme": "#e0554d",
};

/** Percent chip fill + text — contrast matched to the chip, not the tile. */
export const HEAT_CHIP: Record<HeatBand, { background: string; color: string }> = {
  flat: { background: "#2c3646", color: "#edf1f5" },
  "up-mild": { background: "#0f6e66", color: "#d5f6f1" },
  "up-strong": { background: "#14b8a6", color: "#04121a" },
  "up-extreme": { background: "#2dd4bf", color: "#04121a" },
  "down-mild": { background: "#6b2a28", color: "#fde8e6" },
  "down-strong": { background: "#c24e48", color: "#ffffff" },
  "down-extreme": { background: "#f0665e", color: "#04121a" },
};

/** Legend swatches (tile backgrounds). */
export const HEAT_NEUTRAL = HEAT_TILE_BG.flat;
export const HEAT_TEAL_SOFT = HEAT_TILE_BG["up-mild"];
export const HEAT_TEAL_MID = HEAT_TILE_BG["up-strong"];
export const HEAT_TEAL = HEAT_TILE_BG["up-extreme"];
export const HEAT_RED_SOFT_BG = HEAT_TILE_BG["down-mild"];
export const HEAT_RED_MID = HEAT_TILE_BG["down-strong"];
export const HEAT_RED_STRONG = HEAT_TILE_BG["down-extreme"];
export const HEAT_RED_MILD = "#f0665e";

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
