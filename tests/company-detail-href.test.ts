import { describe, expect, it } from "vitest";
import { companyDetailHref, hasCompanyDetailPage } from "@/lib/market/company-detail-href";
import { supportsConvictionSignals } from "@/lib/market/market-instruments";

describe("companyDetailHref", () => {
  it("links equities and crypto market instruments", () => {
    expect(hasCompanyDetailPage("NBIS")).toBe(true);
    expect(companyDetailHref("spy")).toBe("/companies/SPY");
    expect(hasCompanyDetailPage("ETH-USD")).toBe(true);
    expect(companyDetailHref("ETH-USD")).toBe("/companies/ETH-USD");
  });

  it("does not link caret index symbols", () => {
    expect(hasCompanyDetailPage("^VIX")).toBe(false);
    expect(companyDetailHref("^TNX")).toBeNull();
  });
});

describe("supportsConvictionSignals", () => {
  it("is false for crypto pairs and true for equities", () => {
    expect(supportsConvictionSignals("ETH-USD")).toBe(false);
    expect(supportsConvictionSignals("BTC-USD")).toBe(false);
    expect(supportsConvictionSignals("NBIS")).toBe(true);
  });
});
