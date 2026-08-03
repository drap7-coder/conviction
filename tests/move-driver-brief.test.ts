import { describe, expect, it } from "vitest";
import {
  buildMoveDriverView,
  isRecentHeadlineDate,
  usableNewsDriver,
} from "@/lib/evidence/move-driver-brief";

describe("move driver brief", () => {
  const now = new Date("2026-08-02T16:00:00-04:00");

  it("treats story-still-forming as an unusable driver", () => {
    expect(usableNewsDriver({ label: "Story still forming", explanation: "", confidence: "likely" })).toBeNull();
    expect(usableNewsDriver({ label: "Strategic options", explanation: "Deal interest.", confidence: "likely" })).toMatchObject({
      label: "Strategic options",
    });
  });

  it("recognizes today and yesterday headlines in Eastern time", () => {
    expect(isRecentHeadlineDate("2026-08-02", now)).toBe(true);
    expect(isRecentHeadlineDate("2026-08-01", now)).toBe(true);
    expect(isRecentHeadlineDate("2026-07-30", now)).toBe(false);
  });

  it("leads with the headline and demotes theme to a chip when badge is allowed", () => {
    const view = buildMoveDriverView({
      ticker: "GOOG",
      companyName: "Alphabet",
      driver: {
        label: "AI positioning · Execution + margins",
        explanation: "Investors are weighing the AI opportunity.",
        confidence: "likely",
      },
      headlines: [
        {
          headline: "Alphabet jumps after strong cloud growth",
          url: "https://example.com/a",
          date: "2026-08-02",
        },
        {
          headline: "Analysts lift GOOG targets on AI spend",
          url: "https://example.com/b",
          date: "2026-08-02",
        },
      ],
      showBadge: true,
      now,
    });

    expect(view.mode).toBe("catalyst");
    expect(view.conclusion).toBe("Alphabet jumps after strong cloud growth");
    expect(view.evidence).toBe("Analysts lift GOOG targets on AI spend");
    expect(view.conclusion).not.toMatch(/AI positioning|Execution/i);
  });

  it("hides the card when coverage is stale and the session is quiet", () => {
    const view = buildMoveDriverView({
      ticker: "GOOG",
      companyName: "Alphabet",
      driver: null,
      headlines: [
        {
          headline: "Old Alphabet feature story",
          url: null,
          date: "2026-07-20",
        },
      ],
      absChangePercent: 0.2,
      showBadge: false,
      now,
    });
    expect(view.mode).toBe("hidden");
  });

  it("shows a no-catalyst note on a meaningful move without fresh headlines", () => {
    const view = buildMoveDriverView({
      ticker: "GOOG",
      companyName: "Alphabet",
      driver: null,
      headlines: [],
      absChangePercent: 3.4,
      showBadge: false,
      now,
    });
    expect(view.mode).toBe("no_catalyst");
    expect(view.conclusion).toMatch(/No clear news catalyst/i);
  });

  it("omits the duplicate catalyst chip when showBadge is false", () => {
    const view = buildMoveDriverView({
      ticker: "AMZN",
      companyName: "Amazon",
      driver: {
        label: "Execution + margins",
        explanation: "Guidance is resetting expectations.",
        confidence: "likely",
      },
      headlines: [
        {
          headline: "Amazon (AMZN) earnings preview: AWS growth in focus",
          url: null,
          date: "2026-08-02",
        },
      ],
      showBadge: false,
      now,
    });
    expect(view.mode).toBe("catalyst");
    expect(view.badge).toBeNull();
  });
});
