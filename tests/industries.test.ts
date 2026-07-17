import { describe, expect, it } from "vitest";
import {
  getSectorByTicker,
  getSectorForCompany,
} from "@/lib/market/industries";

describe("industry mapping", () => {
  it("resolves a sector ETF", () => {
    expect(getSectorByTicker("xlk")?.name).toBe("Technology");
  });

  it("resolves a company through the shared sector definitions", () => {
    expect(getSectorForCompany("INTC")?.ticker).toBe("XLK");
    expect(getSectorForCompany("oxy")?.ticker).toBe("XLE");
  });

  it("returns undefined for an unmapped company", () => {
    expect(getSectorForCompany("UNKNOWN")).toBeUndefined();
  });
});
