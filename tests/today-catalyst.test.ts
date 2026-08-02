import { describe, expect, it } from "vitest";
import {
  catalystFromGradeActions,
  deriveTodayCatalyst,
  isCompanyRelevantHeadline,
  marketTodayIso,
} from "@/lib/evidence/today-catalyst";

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

  it("does not badge from unscoped roundups when a ticker is known", () => {
    expect(
      deriveTodayCatalyst(
        [
          {
            headline: "Microsoft Soars 15% as Tech Stocks Rally",
            date: "2026-07-31",
          },
          {
            headline: "Exchange-Traded Funds Higher Pre-Bell on Megacap Strength",
            date: "2026-07-31",
          },
        ],
        "Demand + competition",
        { ticker: "TDOC", companyName: "Teladoc Health", now },
      ),
    ).toBeNull();
  });

  it("requires ticker or company name in the headline text", () => {
    expect(isCompanyRelevantHeadline("Microsoft Soars 15% as Tech Stocks Rally", "TDOC", "Teladoc Health")).toBe(false);
    expect(isCompanyRelevantHeadline("Teladoc Health cuts guidance", "TDOC", "Teladoc Health")).toBe(true);
    expect(isCompanyRelevantHeadline("TDOC jumps after earnings", "TDOC", "Teladoc Health")).toBe(true);
  });

  it("matches ETF and crypto headline aliases", () => {
    expect(isCompanyRelevantHeadline("Bitcoin Falls To 3-Week Low", "BTC-USD")).toBe(true);
    expect(isCompanyRelevantHeadline("S&P 500 Earnings Season Update", "SPY")).toBe(true);
    expect(isCompanyRelevantHeadline("Nasdaq-100 rebounds into the close", "QQQ")).toBe(true);
    expect(isCompanyRelevantHeadline("Crude prices jump on supply risk", "USO")).toBe(true);
    expect(isCompanyRelevantHeadline("Apple beats estimates", "BTC-USD")).toBe(false);
  });

  it("formats market today in Eastern time", () => {
    expect(marketTodayIso(now)).toBe("2026-07-31");
  });

  it("labels analyst upgrades and ignores credit-rating false positives", () => {
    expect(
      deriveTodayCatalyst(
        [
          {
            headline: "Morgan Stanley upgrades GOOG to Overweight, raises price target",
            date: "2026-07-31",
          },
        ],
        null,
        { ticker: "GOOG", companyName: "Alphabet", now },
      ),
    ).toEqual({
      label: "Analyst upgrade",
      tone: "positive",
      kind: "analyst",
    });

    expect(
      deriveTodayCatalyst(
        [
          {
            headline: "S&P Global Ratings upgrades Alphabet credit rating outlook",
            date: "2026-07-31",
          },
        ],
        null,
        { ticker: "GOOG", companyName: "Alphabet", now },
      ),
    ).toBeNull();
  });

  it("labels analyst downgrades and price-target moves", () => {
    expect(
      deriveTodayCatalyst(
        [
          {
            headline: "Analyst downgrades AMZN to Equal Weight and cuts price target",
            date: "2026-07-31",
          },
        ],
        null,
        { ticker: "AMZN", companyName: "Amazon", now },
      ),
    ).toEqual({
      label: "Analyst downgrade",
      tone: "negative",
      kind: "analyst",
    });

    expect(
      deriveTodayCatalyst(
        [
          {
            headline: "Bank of America lifts MSFT price target to $520",
            date: "2026-07-31",
          },
        ],
        null,
        { ticker: "MSFT", companyName: "Microsoft", now },
      ),
    ).toEqual({
      label: "Price target move",
      tone: "contested",
      kind: "analyst",
    });
  });

  it("builds catalyst badges from structured grade actions", () => {
    expect(
      catalystFromGradeActions(
        [
          {
            date: "2026-07-31",
            direction: "upgrade",
            firm: "Morgan Stanley",
            previousGrade: "Equal-Weight",
            newGrade: "Overweight",
          },
        ],
        { now },
      ),
    ).toEqual({
      label: "Analyst upgrade",
      tone: "positive",
      kind: "analyst",
    });

    expect(
      catalystFromGradeActions(
        [
          {
            date: "2026-07-31",
            direction: "upgrade",
            firm: "MS",
          },
          {
            date: "2026-07-31",
            direction: "downgrade",
            firm: "JPM",
          },
        ],
        { now },
      ),
    ).toEqual({
      label: "Street mixed",
      tone: "contested",
      kind: "analyst",
    });
  });
});
