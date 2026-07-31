import { describe, expect, it } from "vitest";
import { deriveTodayCatalyst, marketTodayIso } from "@/lib/evidence/today-catalyst";

describe("deriveTodayCatalyst", () => {
  const now = new Date("2026-07-31T16:00:00-04:00");

  it("labels earnings headlines from today", () => {
    const catalyst = deriveTodayCatalyst(
      [
        {
          headline: "Amazon (AMZN) earnings preview: What to expect as AWS growth takes center stage",
          date: "2026-07-31",
        },
        {
          headline: "Tech stocks mixed ahead of megacap reports",
          date: "2026-07-30",
        },
      ],
      "Execution + margins",
      { ticker: "AMZN", companyName: "Amazon", now },
    );

    expect(catalyst).toEqual({
      label: "Earnings today",
      tone: "contested",
      kind: "earnings",
    });
  });

  it("labels trial/pipeline setbacks and ignores unrelated earnings roundups", () => {
    const catalyst = deriveTodayCatalyst(
      [
        {
          headline: "Novo Nordisk Suffers Another Pipeline Setback",
          date: "2026-07-31",
          summary: "Shares fell after a late-stage cardiovascular trial failed to meet its main goal.",
        },
        {
          headline: "Novo Nordisk Stock Falls 7% as ZEUS Trial Fails",
          date: "2026-07-31",
        },
        {
          headline: "Exchange-Traded Funds Higher Pre-Bell as Amazon Earnings Offset Apple Weakness",
          date: "2026-07-31",
        },
      ],
      "Pipeline renewal · Execution + margins",
      { ticker: "NVO", companyName: "Novo Nordisk", now },
    );

    expect(catalyst).toEqual({
      label: "Trial setback",
      tone: "negative",
      kind: "trial",
    });
  });

  it("falls back to driver theme when headlines lack catalyst keywords", () => {
    const catalyst = deriveTodayCatalyst(
      [{ headline: "Company updates investors on operations", date: "2026-07-31" }],
      "Regulatory pressure",
      { ticker: "TEST", now },
    );

    expect(catalyst).toEqual({
      label: "Regulatory risk",
      tone: "negative",
      kind: "regulatory",
    });
  });

  it("returns null when there is no usable signal", () => {
    expect(
      deriveTodayCatalyst(
        [{ headline: "Markets wrap: indexes little changed", date: "2026-07-20" }],
        "Story still forming",
        { now },
      ),
    ).toBeNull();
  });

  it("formats market today in Eastern time", () => {
    expect(marketTodayIso(now)).toBe("2026-07-31");
  });
});
