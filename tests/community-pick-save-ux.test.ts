import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("community pick save UX", () => {
  it("shows explicit Save Pick and Confirm Swap on Your Picks", () => {
    const source = read("src/components/YourPicksCard.tsx");
    expect(source).toContain('"Save Pick"');
    expect(source).toContain('"Confirm Swap"');
    expect(source).toContain("your-picks-save");
    expect(source).toContain("your-picks-success");
    expect(source).toContain("your-picks-error");
  });

  it("uses company typeahead and logos for stocks, Bitcoin/Gold, and international", () => {
    const source = read("src/components/YourPicksCard.tsx");
    const typeahead = read("src/components/CompanyTypeahead.tsx");
    expect(source).toContain("CompanyTypeahead");
    expect(source).toContain("LogoDisplay");
    expect(source).toContain("asset.pricingSymbol");
    expect(source).toContain("pick.pricingSymbol");
    expect(source).toContain("your-picks-added-chip");
    expect(source).toContain("is-just-saved");
    expect(source).toContain("added ·");
    expect(typeahead).toContain("LogoDisplay");
    expect(typeahead).toContain("ticker-suggestion-logo");
  });

  it("styles the Your Picks scoreboard in Crowd chrome", () => {
    const css = read("src/app/globals.css");
    expect(css).toContain(".your-picks-card");
    expect(css).toContain(".your-picks-binary");
    expect(css).toContain(".your-picks-iqbulls");
    expect(css).toContain(".your-picks-logo");
    expect(css).toContain(".your-picks-success.is-banner");
    expect(css).toContain(".ticker-suggestion-logo");
  });
});
