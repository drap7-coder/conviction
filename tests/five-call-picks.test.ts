import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  BTC_GOLD_ASSETS,
  INTERNATIONAL_ASSETS,
  pricingSymbolForStored,
  resolveBtcGoldAsset,
  resolveInternationalAsset,
} from "@/lib/community-picks/asset-maps";
import {
  CALL_SLOTS,
  CALLS_REQUIRED,
  isCallSlot,
  parseCallSlot,
} from "@/lib/community-picks/call-slots";
import { averageLifetimeReturnPct } from "@/lib/community-picks/growth";
import { normalizeStoredAsset } from "@/lib/community-picks/store";

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("five-call IQBulls picks", () => {
  it("keeps five slots and curated macro mappings", () => {
    expect(CALL_SLOTS).toEqual([
      "STOCK_1",
      "STOCK_2",
      "STOCK_3",
      "BTC_GOLD",
      "INTERNATIONAL",
    ]);
    expect(CALLS_REQUIRED).toBe(5);
    expect(isCallSlot("STOCK_1")).toBe(true);
    expect(parseCallSlot("btc_gold")).toBe("BTC_GOLD");
    expect(resolveBtcGoldAsset("BITCOIN")?.pricingSymbol).toBe("BTC-USD");
    expect(resolveBtcGoldAsset("GOLD")?.pricingSymbol).toBe("GLD");
    expect(resolveInternationalAsset("INDIA")?.pricingSymbol).toBe("INDA");
    expect(resolveInternationalAsset("EUROPE")?.pricingSymbol).toBe("VGK");
    expect(pricingSymbolForStored("BTC_GOLD", "BITCOIN")).toBe("BTC-USD");
    expect(pricingSymbolForStored("INTERNATIONAL", "JAPAN")).toBe("EWJ");
    expect(BTC_GOLD_ASSETS).toHaveLength(2);
    expect(INTERNATIONAL_ASSETS).toHaveLength(6);
  });

  it("normalizes macro assets and rejects invalid ones", () => {
    expect(normalizeStoredAsset("BTC_GOLD", "bitcoin")).toBe("BITCOIN");
    expect(normalizeStoredAsset("BTC_GOLD", "GLD")).toBe("GOLD");
    expect(normalizeStoredAsset("INTERNATIONAL", "india")).toBe("INDIA");
    expect(() => normalizeStoredAsset("BTC_GOLD", "ETH")).toThrow(/Bitcoin or Gold/);
    expect(() => normalizeStoredAsset("INTERNATIONAL", "EWZ")).toThrow(/international/);
  });

  it("averages five independent lifetime returns equally", () => {
    expect(averageLifetimeReturnPct([10, 0, -5, 20, 5])).toBe(6);
    expect(averageLifetimeReturnPct([18.4])).toBe(18.4);
    expect(averageLifetimeReturnPct([])).toBeNull();
  });

  it("ships additive migration preserving STOCK_1", () => {
    const migration = read("migrations/014_five_call_picks.sql");
    expect(migration).toContain("call_slot");
    expect(migration).toContain("STOCK_1");
    expect(migration).toContain("default 'STOCK_1'");
    expect(migration).toContain("community_picks_user_group_slot_pkey");
    expect(migration).not.toContain("delete from community_picks");
  });

  it("wires Your Picks UX and slot-aware APIs", () => {
    const board = read("src/components/CrowdBoard.tsx");
    const card = read("src/components/YourPicksCard.tsx");
    const save = read("src/app/api/community-picks/route.ts");
    const swap = read("src/app/api/picks/swap/route.ts");
    const store = read("src/lib/community-picks/store.ts");

    expect(board).toContain("YourPicksCard");
    expect(board).toContain("finish all five calls to join the leaderboard");
    expect(card).toContain("Your Picks");
    expect(card).toContain("Bitcoin or Gold");
    expect(card).toContain("International");
    expect(card).toContain("Save Pick");
    expect(card).toContain("Confirm Swap");
    expect(card).not.toContain("Five-Pick");
    expect(card).not.toContain("STOCK_1");
    expect(save).toContain("callSlot");
    expect(swap).toContain("callSlot");
    expect(store).toContain("leaderboardEligible");
    expect(store).toContain("boardComplete");
    expect(store).toContain("CALLS_REQUIRED");
  });
});
