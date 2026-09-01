/** Crowd row copy — exact counts, no rounded % as primary metric. */

export type CrowdCountUnit = "books" | "lists";

export function formatCrowdRowCount(
  count: number,
  total: number,
  unit: CrowdCountUnit,
): string {
  if (!Number.isFinite(count) || !Number.isFinite(total) || total <= 0 || count < 0) {
    return "—";
  }
  return `${count} / ${total} ${unit}`;
}
