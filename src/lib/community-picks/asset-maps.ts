/**
 * User-facing asset identity → pricing symbol for macro slots.
 * Keep mappings centralized — never sprinkle BTC-USD / GLD / country ETFs in UI.
 */

export type MacroAssetClass = "crypto" | "commodity" | "international";

export type MacroAssetDefinition = {
  /** Stable identity stored / shown (not the Yahoo symbol). */
  id: string;
  label: string;
  /** Yahoo-compatible pricing instrument. */
  pricingSymbol: string;
  assetClass: MacroAssetClass;
};

/** Bitcoin or Gold — binary choice. */
export const BTC_GOLD_ASSETS: readonly MacroAssetDefinition[] = [
  { id: "BITCOIN", label: "Bitcoin", pricingSymbol: "BTC-USD", assetClass: "crypto" },
  { id: "GOLD", label: "Gold", pricingSymbol: "GLD", assetClass: "commodity" },
] as const;

/** Curated international markets — never expose ETF tickers in the picker. */
export const INTERNATIONAL_ASSETS: readonly MacroAssetDefinition[] = [
  { id: "INDIA", label: "India", pricingSymbol: "INDA", assetClass: "international" },
  { id: "CHINA", label: "China", pricingSymbol: "MCHI", assetClass: "international" },
  { id: "JAPAN", label: "Japan", pricingSymbol: "EWJ", assetClass: "international" },
  { id: "EUROPE", label: "Europe", pricingSymbol: "VGK", assetClass: "international" },
  { id: "UK", label: "UK", pricingSymbol: "EWU", assetClass: "international" },
  { id: "EMERGING", label: "Emerging Markets", pricingSymbol: "VWO", assetClass: "international" },
] as const;

function indexById(assets: readonly MacroAssetDefinition[]): Map<string, MacroAssetDefinition> {
  return new Map(assets.map((asset) => [asset.id, asset]));
}

function indexByPricingSymbol(
  assets: readonly MacroAssetDefinition[],
): Map<string, MacroAssetDefinition> {
  return new Map(assets.map((asset) => [asset.pricingSymbol.toUpperCase(), asset]));
}

const BTC_GOLD_BY_ID = indexById(BTC_GOLD_ASSETS);
const BTC_GOLD_BY_SYMBOL = indexByPricingSymbol(BTC_GOLD_ASSETS);
const INTL_BY_ID = indexById(INTERNATIONAL_ASSETS);
const INTL_BY_SYMBOL = indexByPricingSymbol(INTERNATIONAL_ASSETS);

export function resolveBtcGoldAsset(idOrSymbol: string): MacroAssetDefinition | null {
  const raw = idOrSymbol.trim().toUpperCase();
  if (!raw) return null;
  return BTC_GOLD_BY_ID.get(raw) ?? BTC_GOLD_BY_SYMBOL.get(raw) ?? null;
}

export function resolveInternationalAsset(idOrSymbol: string): MacroAssetDefinition | null {
  const raw = idOrSymbol.trim().toUpperCase();
  if (!raw) return null;
  return INTL_BY_ID.get(raw) ?? INTL_BY_SYMBOL.get(raw) ?? null;
}

/** Label for display when the stored value is a pricing symbol or asset id. */
export function displayAssetLabel(
  slot: "BTC_GOLD" | "INTERNATIONAL" | "STOCK_1" | "STOCK_2" | "STOCK_3",
  stored: string,
): string {
  if (slot === "BTC_GOLD") return resolveBtcGoldAsset(stored)?.label ?? stored;
  if (slot === "INTERNATIONAL") return resolveInternationalAsset(stored)?.label ?? stored;
  return stored.toUpperCase();
}

/** Pricing symbol to fetch for a stored identity (asset id or ticker). */
export function pricingSymbolForStored(
  slot: "BTC_GOLD" | "INTERNATIONAL" | "STOCK_1" | "STOCK_2" | "STOCK_3",
  stored: string,
): string {
  if (slot === "BTC_GOLD") {
    return resolveBtcGoldAsset(stored)?.pricingSymbol ?? stored.trim().toUpperCase();
  }
  if (slot === "INTERNATIONAL") {
    return resolveInternationalAsset(stored)?.pricingSymbol ?? stored.trim().toUpperCase();
  }
  return stored.trim().toUpperCase();
}
