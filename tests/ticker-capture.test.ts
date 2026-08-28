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

describe("inline voice mic wiring", () => {
  it("keeps a mic inside Manage ticker fields and drops camera", () => {
    const capture = read("src/components/TickerCaptureActions.tsx");
    expect(capture).toContain("Add by voice");
    expect(capture).toContain("ticker-mic");
    expect(capture).not.toContain("Camera");
    expect(capture).not.toContain("recognizeImageText");
    expect(capture).not.toContain("capture=\"environment\"");
    expect(read("src/lib/ticker-capture-resolve.ts")).not.toContain("tesseract");
    expect(read("src/components/Watchlist.tsx")).toContain("TickerCaptureActions");
    expect(read("src/components/PortfolioManager.tsx")).toContain("TickerCaptureActions");
    expect(read("src/components/CompanyTypeahead.tsx")).toContain("ticker-field-control");
    expect(read("src/components/CompanyTypeahead.tsx")).toContain("has-mic");
    expect(read("src/app/globals.css")).toContain(".ticker-mic");
    expect(read("src/app/globals.css")).not.toContain(".ticker-capture-camera");
  });
});
