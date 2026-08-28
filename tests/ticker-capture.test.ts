import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { cleanSpokenQuery, extractTickerTokens, rankCaptureCandidates } from "@/lib/ticker-capture";

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("ticker capture parsing", () => {
  it("extracts ticker tokens from OCR-like noise", () => {
    expect(extractTickerTokens("NVDA $120.50 NVIDIA Corp")).toContain("NVDA");
    expect(extractTickerTokens("watch AAPL and MSFT today")).toEqual(
      expect.arrayContaining(["AAPL", "MSFT"]),
    );
    expect(extractTickerTokens("the and for")).toEqual([]);
  });

  it("cleans spoken filler into a search query", () => {
    expect(cleanSpokenQuery("add Nvidia to my watchlist")).toMatch(/nvidia/i);
    expect(cleanSpokenQuery("track AAPL")).toBe("AAPL");
    expect(rankCaptureCandidates("buy apple").query.toLowerCase()).toContain("apple");
  });
});

describe("mobile capture wiring", () => {
  it("mounts labeled voice and camera actions under Manage compose fields", () => {
    expect(read("src/components/TickerCaptureActions.tsx")).toContain("Or add with");
    expect(read("src/components/TickerCaptureActions.tsx")).toContain("Add by voice");
    expect(read("src/components/TickerCaptureActions.tsx")).toContain("Add from camera");
    expect(read("src/components/TickerCaptureActions.tsx")).toContain("capture=\"environment\"");
    expect(read("src/components/TickerCaptureActions.tsx")).toContain("ticker-capture-camera");
    expect(read("src/components/Watchlist.tsx")).toContain("TickerCaptureActions");
    expect(read("src/components/PortfolioManager.tsx")).toContain("TickerCaptureActions");
    expect(read("src/components/CompanyTypeahead.tsx")).toContain("trailing");
    expect(read("src/components/CompanyTypeahead.tsx")).not.toContain("ticker-input-row");
    expect(read("src/app/globals.css")).toContain(".ticker-capture");
    expect(read("src/app/globals.css")).toContain(".ticker-capture-camera");
    expect(read("src/app/globals.css")).toContain("(pointer: coarse)");
  });
});
