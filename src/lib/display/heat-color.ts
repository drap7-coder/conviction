/**
 * Text tone for percent / price changes (holdings, quotes).
 * Heatmap tile fills were removed with the boards.
 */

/** Sub-1% downs use soft red for text tone helpers. */
const MILD_DOWN_THRESHOLD = 1;

export type ChangeToneClass =
  | "positive"
  | "negative"
  | "negative-mild"
  | "neutral";

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
