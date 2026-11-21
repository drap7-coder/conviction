import { describe, expect, it } from "vitest";
import { GET as getLogo } from "@/app/api/logos/[ticker]/route";
import { getLogoDomain, getLogoUrl, getSectorColors } from "@/lib/market/logos";

describe("shared logo resolution", () => {
  it("uses a same-origin cached route for known company logos", () => {
    expect(getLogoDomain("aapl")).toBe("apple.com");
    expect(getLogoUrl("aapl")).toBe("/api/logos/AAPL");
  });

  it("keeps unknown tickers on the deterministic component badge", () => {
    expect(getLogoDomain("UNKNOWN")).toBeUndefined();
    expect(getLogoUrl("UNKNOWN")).toBeUndefined();
  });

  it("keeps sector ETFs on generated sector badges", () => {
    expect(getSectorColors("XLK")?.label).toBe("Tech");
    expect(getLogoUrl("XLK")).toBeUndefined();
  });

  it("returns a cacheable SVG instead of a broken response for unavailable symbols", async () => {
    const response = await getLogo(
      new Request("http://localhost/api/logos/UNKNOWN"),
      { params: Promise.resolve({ ticker: "UNKNOWN" }) },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/svg+xml");
    expect(response.headers.get("cache-control")).toContain("stale-while-revalidate");
    expect(await response.text()).toContain(">U</text>");
  });
});
