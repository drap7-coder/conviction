import { describe, it, expect } from "vitest";
import type { WatchlistEntry } from "@/lib/watchlist/types";
import { getDefaultThesis, getPriorityReviewItems } from "@/lib/watchlist/priority-review";
import { validateThesisInput } from "@/lib/user-watchlist";

describe("getDefaultThesis", () => {
  it("returns default thesis with empty values", () => {
    const thesis = getDefaultThesis();
    expect(thesis.thesis).toBe("");
    expect(thesis.invalidation).toBe("");
    expect(thesis.reviewAt).toBeNull();
    expect(thesis.status).toBe("building");
  });
});

describe("validateThesisInput", () => {
  it("accepts valid thesis input", () => {
    const result = validateThesisInput({
      thesis: "Test thesis",
      invalidation: "Test invalidation",
      reviewAt: "2026-12-31T00:00:00.000Z",
      status: "supported",
    });
    expect(result.valid).toBe(true);
  });

  it("accepts building status", () => {
    const result = validateThesisInput({
      thesis: "",
      invalidation: "",
      reviewAt: null,
      status: "building",
    });
    expect(result.valid).toBe(true);
  });

  it("accepts supported status", () => {
    const result = validateThesisInput({
      thesis: "Test",
      invalidation: "Test",
      reviewAt: null,
      status: "supported",
    });
    expect(result.valid).toBe(true);
  });

  it("accepts review status", () => {
    const result = validateThesisInput({
      thesis: "Test",
      invalidation: "Test",
      reviewAt: null,
      status: "review",
    });
    expect(result.valid).toBe(true);
  });

  it("accepts weakening status", () => {
    const result = validateThesisInput({
      thesis: "Test",
      invalidation: "Test",
      reviewAt: null,
      status: "weakening",
    });
    expect(result.valid).toBe(true);
  });

  it("accepts broken status", () => {
    const result = validateThesisInput({
      thesis: "Test",
      invalidation: "Test",
      reviewAt: null,
      status: "broken",
    });
    expect(result.valid).toBe(true);
  });

  it("rejects invalid status", () => {
    const result = validateThesisInput({
      thesis: "Test",
      invalidation: "Test",
      reviewAt: null,
      status: "invalid" as any,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBe("Invalid thesis status");
    }
  });

  it("rejects invalid review date", () => {
    const result = validateThesisInput({
      thesis: "Test",
      invalidation: "Test",
      reviewAt: "not-a-date",
      status: "building",
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBe("Invalid review date");
    }
  });

  it("accepts null review date", () => {
    const result = validateThesisInput({
      thesis: "Test",
      invalidation: "Test",
      reviewAt: null,
      status: "building",
    });
    expect(result.valid).toBe(true);
  });
});

describe("getPriorityReviewItems", () => {
  function createEntry(overrides: Partial<WatchlistEntry> = {}): WatchlistEntry {
    return {
      ticker: "TEST",
      companyName: "Test Company",
      addedAt: new Date("2026-01-01").toISOString(),
      status: "active",
      ...overrides,
    };
  }

  it("returns empty array when no entries need review", () => {
    const entries: WatchlistEntry[] = [];
    const result = getPriorityReviewItems(entries);
    expect(result).toEqual([]);
  });

  it("includes entries with broken status", () => {
    const entries = [
      createEntry({
        ticker: "BRK",
        thesis: { thesis: "Test thesis", invalidation: "Test", reviewAt: null, status: "broken" },
      }),
    ];
    const result = getPriorityReviewItems(entries);
    expect(result).toHaveLength(1);
    expect(result[0].ticker).toBe("BRK");
    expect(result[0].reason).toBe("Thesis marked broken");
  });

  it("includes entries with weakening status", () => {
    const entries = [
      createEntry({
        ticker: "WEA",
        thesis: { thesis: "Test thesis", invalidation: "Test", reviewAt: null, status: "weakening" },
      }),
    ];
    const result = getPriorityReviewItems(entries);
    expect(result).toHaveLength(1);
    expect(result[0].ticker).toBe("WEA");
    expect(result[0].reason).toBe("Thesis is weakening");
  });

  it("includes entries with review status", () => {
    const entries = [
      createEntry({
        ticker: "REV",
        thesis: { thesis: "Test thesis", invalidation: "Test", reviewAt: null, status: "review" },
      }),
    ];
    const result = getPriorityReviewItems(entries);
    expect(result).toHaveLength(1);
    expect(result[0].ticker).toBe("REV");
    expect(result[0].reason).toBe("Manual review requested");
  });

  it("includes entries with overdue review date", () => {
    const now = new Date("2026-07-17T12:00:00.000Z");
    const entries = [
      createEntry({
        ticker: "OVE",
        thesis: { thesis: "Test thesis", invalidation: "Test", reviewAt: "2026-07-10T00:00:00.000Z", status: "supported" },
      }),
    ];
    const result = getPriorityReviewItems(entries, now);
    expect(result).toHaveLength(1);
    expect(result[0].ticker).toBe("OVE");
    expect(result[0].reason).toBe("Review overdue by 7 days");
  });

  it("ranks broken before weakening", () => {
    const entries = [
      createEntry({
        ticker: "WEA",
        thesis: { thesis: "Test", invalidation: "Test", reviewAt: null, status: "weakening" },
      }),
      createEntry({
        ticker: "BRK",
        thesis: { thesis: "Test", invalidation: "Test", reviewAt: null, status: "broken" },
      }),
    ];
    const result = getPriorityReviewItems(entries);
    expect(result).toHaveLength(2);
    expect(result[0].ticker).toBe("BRK");
    expect(result[1].ticker).toBe("WEA");
  });

  it("ranks weakening before review", () => {
    const entries = [
      createEntry({
        ticker: "REV",
        thesis: { thesis: "Test", invalidation: "Test", reviewAt: null, status: "review" },
      }),
      createEntry({
        ticker: "WEA",
        thesis: { thesis: "Test", invalidation: "Test", reviewAt: null, status: "weakening" },
      }),
    ];
    const result = getPriorityReviewItems(entries);
    expect(result).toHaveLength(2);
    expect(result[0].ticker).toBe("WEA");
    expect(result[1].ticker).toBe("REV");
  });

  it("ranks review before supported/building", () => {
    const entries = [
      createEntry({
        ticker: "SUP",
        thesis: { thesis: "Test", invalidation: "Test", reviewAt: null, status: "supported" },
      }),
      createEntry({
        ticker: "REV",
        thesis: { thesis: "Test", invalidation: "Test", reviewAt: null, status: "review" },
      }),
    ];
    const result = getPriorityReviewItems(entries);
    expect(result).toHaveLength(1);
    expect(result[0].ticker).toBe("REV");
  });

  it("orders by most overdue review date within same status", () => {
    const now = new Date("2026-07-17T12:00:00.000Z");
    const entries = [
      createEntry({
        ticker: "OVERDUE1",
        thesis: { thesis: "Test", invalidation: "Test", reviewAt: "2026-07-15T00:00:00.000Z", status: "review" },
      }),
      createEntry({
        ticker: "OVERDUE2",
        thesis: { thesis: "Test", invalidation: "Test", reviewAt: "2026-07-10T00:00:00.000Z", status: "review" },
      }),
      createEntry({
        ticker: "OVERDUE3",
        thesis: { thesis: "Test", invalidation: "Test", reviewAt: "2026-07-12T00:00:00.000Z", status: "review" },
      }),
    ];
    const result = getPriorityReviewItems(entries, now);
    expect(result).toHaveLength(3);
    expect(result[0].ticker).toBe("OVERDUE2"); // 7 days overdue
    expect(result[1].ticker).toBe("OVERDUE3"); // 5 days overdue
    expect(result[2].ticker).toBe("OVERDUE1"); // 2 days overdue
  });

  it("returns maximum three items", () => {
    const entries = [
      createEntry({ ticker: "BRK1", thesis: { thesis: "Test", invalidation: "Test", reviewAt: null, status: "broken" } }),
      createEntry({ ticker: "BRK2", thesis: { thesis: "Test", invalidation: "Test", reviewAt: null, status: "broken" } }),
      createEntry({ ticker: "BRK3", thesis: { thesis: "Test", invalidation: "Test", reviewAt: null, status: "broken" } }),
      createEntry({ ticker: "BRK4", thesis: { thesis: "Test", invalidation: "Test", reviewAt: null, status: "broken" } }),
    ];
    const result = getPriorityReviewItems(entries);
    expect(result).toHaveLength(3);
  });

  it("returns deterministic review reasons for overdue items", () => {
    const now = new Date("2026-07-17T12:00:00.000Z");
    const entries = [
      createEntry({
        ticker: "TEST",
        thesis: { thesis: "Test", invalidation: "Test", reviewAt: "2026-07-15T00:00:00.000Z", status: "supported" },
      }),
    ];
    const result = getPriorityReviewItems(entries, now);
    expect(result[0].reason).toBe("Review overdue by 2 days");
  });

  it("does not include entries without thesis", () => {
    const entries = [
      createEntry({ ticker: "NOTES", status: "active" }),
    ];
    const result = getPriorityReviewItems(entries);
    expect(result).toEqual([]);
  });

  it("does not include supported entries without overdue review", () => {
    const entries = [
      createEntry({
        ticker: "SUP",
        thesis: { thesis: "Test", invalidation: "Test", reviewAt: "2026-12-31T00:00:00.000Z", status: "supported" },
      }),
    ];
    const result = getPriorityReviewItems(entries);
    expect(result).toEqual([]);
  });

  it("handles single overdue day correctly", () => {
    const now = new Date("2026-07-17T12:00:00.000Z");
    const entries = [
      createEntry({
        ticker: "SINGLEDAY",
        thesis: { thesis: "Test", invalidation: "Test", reviewAt: "2026-07-16T00:00:00.000Z", status: "supported" },
      }),
    ];
    const result = getPriorityReviewItems(entries, now);
    expect(result[0].reason).toBe("Review overdue by 1 day");
  });
});

describe("backward compatibility", () => {
  it("treats entries without thesis as needing review only if status requires it", () => {
    const entries: WatchlistEntry[] = [
      {
        ticker: "OLD",
        companyName: "Old Company",
        addedAt: new Date("2026-01-01").toISOString(),
        status: "active",
        // No thesis field
      },
    ];
    const result = getPriorityReviewItems(entries);
    expect(result).toEqual([]);
  });
});