import { describe, expect, it } from "vitest";
import { validateTicker } from "@/lib/watchlist/validate";

describe("validateTicker market instruments", () => {
  it("accepts crypto pairs without SEC CIK", async () => {
    const eth = await validateTicker("ETH-USD");
    expect(eth.valid).toBe(true);
    expect(eth.ticker).toBe("ETH-USD");
    expect(eth.companyName).toBe("Ethereum");
    expect(eth.instrumentKind).toBe("crypto");
    expect(eth.supportsConvictionSignals).toBe(false);
    expect(eth.cik).toBeUndefined();
  });
});
