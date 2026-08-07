import { describe, expect, it } from "vitest";
import { companyDetailHref, hasCompanyDetailPage } from "@/lib/market/company-detail-href";

describe("companyDetailHref", () => {
  it("links equities and ETFs to company detail", () => {
    expect(hasCompanyDetailPage("NBIS")).toBe(true);
    expect(companyDetailHref("spy")).toBe("/companies/SPY");
  });

  it("does not link crypto pairs or index symbols", () => {
    expect(hasCompanyDetailPage("ETH-USD")).toBe(false);
    expect(hasCompanyDetailPage("BTC-USD")).toBe(false);
    expect(hasCompanyDetailPage("^VIX")).toBe(false);
    expect(companyDetailHref("ETH-USD")).toBeNull();
    expect(companyDetailHref("^TNX")).toBeNull();
  });
});
