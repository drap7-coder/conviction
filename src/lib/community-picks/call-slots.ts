/** Five independent IQBulls calls — internal slot ids, not UI copy. */

export const CALL_SLOTS = [
  "STOCK_1",
  "STOCK_2",
  "STOCK_3",
  "BTC_GOLD",
  "INTERNATIONAL",
] as const;

export type CallSlot = (typeof CALL_SLOTS)[number];

export const STOCK_SLOTS = ["STOCK_1", "STOCK_2", "STOCK_3"] as const;
export type StockSlot = (typeof STOCK_SLOTS)[number];

export const CALLS_REQUIRED = CALL_SLOTS.length;

export function isCallSlot(value: string | null | undefined): value is CallSlot {
  return Boolean(value && (CALL_SLOTS as readonly string[]).includes(value));
}

export function isStockSlot(value: string | null | undefined): value is StockSlot {
  return Boolean(value && (STOCK_SLOTS as readonly string[]).includes(value));
}

export function parseCallSlot(value: string | null | undefined): CallSlot | null {
  const raw = value?.trim().toUpperCase();
  if (!raw) return null;
  return isCallSlot(raw) ? raw : null;
}
