/**
 * Shared ink-box / ink-chip tone mapping.
 * up = constructive, down = adverse, amber = mixed, quiet = awaiting/neutral.
 */

export type InkTone = "up" | "down" | "amber" | "quiet";

export function inkBoxClass(tone: InkTone): string {
  return `ink-box ink-box--${tone}`;
}

export function inkChipClass(tone: InkTone): string {
  return `ink-chip ink-chip--${tone}`;
}

/** Map evidence / gauge tones onto ink box colors. */
export function inkToneFromSemantic(
  tone: string | null | undefined,
): InkTone {
  if (
    tone === "positive"
    || tone === "green"
    || tone === "improving"
    || tone === "up"
    || tone === "rising"
  ) {
    return "up";
  }
  if (
    tone === "negative"
    || tone === "red"
    || tone === "weakening"
    || tone === "down"
    || tone === "falling"
  ) {
    return "down";
  }
  if (
    tone === "contested"
    || tone === "amber"
    || tone === "mixed"
    || tone === "holding"
  ) {
    return "amber";
  }
  return "quiet";
}
