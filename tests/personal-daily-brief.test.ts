import { describe, expect, it } from "vitest";
import { briefContext, briefNames, selectBriefStories, type BriefStory } from "../src/lib/watchlist/daily-brief";
import type { EvidenceEvent } from "../src/lib/evidence/types";

const now = Date.parse("2026-10-10T16:00:00Z");
function story(ticker: string, held = false, date = "2026-10-10T12:00:00Z", title = ticker): BriefStory {
  return { ticker, held, event: { title, date, sourceUrl: "https://example.com/report" } as EvidenceEvent };
}
describe("personal daily brief", () => {
  it("labels inferred context rather than presenting a price-move cause as fact", () => {
    expect(briefContext({ title: "AAPL earnings outlook", summary: "Revenue guidance" } as EvidenceEvent, "AAPL")).toContain("context inferred");
    expect(briefContext({ title: "AAPL update", summary: "" } as EvidenceEvent, "AAPL")).toContain("Confirm the details");
  });
  it("deduplicates holdings and watched names without inventing a guest list", () => {
    expect(briefNames(["aapl"], ["AAPL", "NVDA", "bad/name"])).toEqual([{ ticker: "AAPL", held: true }, { ticker: "NVDA", held: false }]);
    expect(briefNames([], [])).toEqual([]);
  });
  it("prioritizes holdings, then recency and caps at three", () => {
    expect(selectBriefStories([story("A"), story("B"), story("C"), story("D", true)], now).map(s => s.ticker)).toEqual(["D", "A", "B"]);
  });
  it("excludes stale, future, invalid and unsourced stories", () => {
    const unsafe = story("BAD"); unsafe.event.sourceUrl = "javascript:alert(1)";
    expect(selectBriefStories([story("OLD", false, "2026-10-01"), story("FUTURE", false, "2026-10-11"), story("INVALID", false, "bad"), unsafe], now)).toEqual([]);
  });
  it("deduplicates syndicated headlines", () => {
    expect(selectBriefStories([story("A", true, undefined, "Same story"), story("B", false, undefined, "Same story")], now)).toHaveLength(1);
  });
});
