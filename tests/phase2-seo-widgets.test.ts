import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseEmbedAccent, parseEmbedSurface } from "@/lib/embed-theme";
import { easternPollDate, parseSentimentVote } from "@/lib/sentiment";

const read = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("canonical ticker SEO", () => {
  it("enhances companies without creating a duplicate quote route", () => {
    const page = read("src/app/companies/[ticker]/page.tsx");
    expect(page).toContain("absoluteTitle: true");
    expect(page).toContain("CompanySeoSnapshot");
    expect(page).toContain("redirect(`/companies/");
    expect(page).toMatch(/index:\s*false/);
    expect(() => read("src/app/quote/[ticker]/page.tsx")).toThrow();
  });
});

describe("embed widgets", () => {
  it("allowlists theme values", () => {
    expect(parseEmbedSurface("cream")).toBe("cream");
    expect(parseEmbedSurface("neon")).toBe("dark");
    expect(parseEmbedAccent("pink")).toBe("pink");
    expect(parseEmbedAccent("url(javascript:bad)")).toBe("green");
  });
  it("keeps embeds out of search and outside app chrome", () => {
    expect(read("src/app/embed/layout.tsx")).toContain("index: false");
    expect(read("src/components/AppFrame.tsx")).toContain(
      'pathname.startsWith("/embed/")',
    );
    expect(read("next.config.ts")).toContain("frame-ancestors *");
    expect(read("src/components/embed/WidgetAttribution.tsx")).toContain(
      "Powered by IQBulls",
    );
  });
  it("keeps gauge tools in normal flow above the market index board", () => {
    const styles = read("src/app/globals.css");
    expect(styles).not.toMatch(
      /\.pulse-gauge-tools[^}]*margin-bottom:\s*-\d/,
    );
    expect(styles).toMatch(/\.pulse-gauges\s*{[^}]*display:\s*grid/);
    expect(styles).toMatch(
      /\.pulse-dashboard\s*{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;[^}]*gap:\s*1\.5rem/s,
    );
    expect(styles).toMatch(
      /\.pulse-gauge-arc,\s*\.pulse-gauge-readout\s*{[^}]*grid-area:\s*1\s*\/\s*1/s,
    );
    expect(styles).not.toMatch(
      /\.pulse-gauge-readout\s*{[^}]*position:\s*absolute/s,
    );
  });
});

describe("daily sentiment contract", () => {
  it("uses a server-defined New York poll day and strict choices", () => {
    expect(easternPollDate(new Date("2026-01-01T02:00:00Z"))).toBe(
      "2025-12-31",
    );
    expect(parseSentimentVote("bullish")).toBe("bullish");
    expect(parseSentimentVote("maybe")).toBeNull();
  });
  it("enforces database uniqueness and server validation", () => {
    const migration = read("migrations/016_daily_sentiment_votes.sql");
    const route = read("src/app/api/sentiment/route.ts");
    expect(migration).toContain("unique (poll_date, ticker, voter_hash)");
    expect(route).toContain("validateTicker");
    expect(route).toContain("easternPollDate");
    expect(route).toContain("checkSentimentRateLimit");
  });
});
