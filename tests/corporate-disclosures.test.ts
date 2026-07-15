import { describe, expect, it } from "vitest";
import { parseCorporateDisclosuresFromSubmissions } from "@/lib/sec/corporate-disclosures";
import { summarizeCorporateEventActivity } from "@/lib/sec/corporate-disclosure-activity";

describe("SEC corporate disclosures", () => {
  it("detects 8-K Item 2.02 earnings releases, corporate events, and periodic reports", () => {
    const summary = parseCorporateDisclosuresFromSubmissions("IBM", "0000051143", {
      filings: {
        recent: {
          form: ["8-K", "10-Q", "10-K", "8-K", "8-K", "8-K"],
          filingDate: ["2026-07-24", "2026-05-05", "2026-02-25", "2026-07-20", "2026-06-15", "2026-01-10"],
          reportDate: ["2026-07-24", "2026-03-31", "2025-12-31", "2026-07-20", "2026-06-15", "2026-01-10"],
          accessionNumber: [
            "0000051143-26-000090",
            "0000051143-26-000055",
            "0000051143-26-000020",
            "0000051143-26-000080",
            "0000051143-26-000060",
            "0000051143-26-000001",
          ],
          primaryDocument: [
            "ibm-20260724.htm",
            "ibm-20260331.htm",
            "ibm-20251231.htm",
            "ibm-20260720.htm",
            "ibm-20260615.htm",
            "ibm-20260110.htm",
          ],
          items: ["2.02", "", "", "5.02", "2.01", "8.01"],
        },
      },
    });

    expect(summary.status).toBe("success");
    expect(summary.lastEarningsRelease?.title).toBe("Quarterly results furnished");
    expect(summary.lastEarningsRelease?.item).toBe("Item 2.02");
    expect(summary.lastQuarterlyReport?.form).toBe("10-Q");
    expect(summary.lastAnnualReport?.form).toBe("10-K");
    expect(summary.latestDisclosure?.kind).toBe("earnings-release");
    expect(summary.corporateEvents).toHaveLength(2);
    expect(summary.corporateEvents[0].title).toBe("◆ 8-K: leadership change");
    expect(summary.corporateEvents[0].item).toBe("Item 5.02");
    expect(summary.corporateEvents[1].title).toBe("◆ 8-K: acquisition completed");
    expect(summary.corporateEvents[1].item).toBe("Item 2.01");
    expect(summary.latestDisclosure?.sourceUrl).toContain("000005114326000090");
  });

  it("returns an empty terminal state when no supported disclosures exist", () => {
    const summary = parseCorporateDisclosuresFromSubmissions("TEST", "0000000001", {
      filings: {
        recent: {
          form: ["4", "8-K"],
          filingDate: ["2026-07-20", "2026-07-19"],
          accessionNumber: ["0000000001-26-000002", "0000000001-26-000001"],
          primaryDocument: ["xslF345X05/doc4.xml", "test-8k.htm"],
          items: ["", "8.01"],
        },
      },
    });

    expect(summary.status).toBe("empty");
    expect(summary.latestDisclosure).toBeNull();
    expect(summary.disclosures).toHaveLength(0);
  });

  it("summarizes recent leadership-change clusters without parsing filing prose", () => {
    const summary = parseCorporateDisclosuresFromSubmissions("WEN", "0000030697", {
      filings: {
        recent: {
          form: ["8-K", "8-K", "8-K", "8-K"],
          filingDate: ["2026-06-23", "2026-06-09", "2026-05-22", "2026-02-01"],
          reportDate: ["2026-06-19", "2026-06-04", "2026-05-20", "2026-01-30"],
          accessionNumber: [
            "0001193125-26-278576",
            "0001193125-26-263775",
            "0001193125-26-236835",
            "0001193125-26-100000",
          ],
          primaryDocument: [
            "d278576d8k.htm",
            "d263775d8k.htm",
            "d236835d8k.htm",
            "d100000d8k.htm",
          ],
          items: ["5.02", "5.02", "5.02", "5.02"],
        },
      },
    });

    const activity = summarizeCorporateEventActivity(summary.corporateEvents, new Date("2026-07-15T12:00:00Z"));

    expect(activity.recentLeadershipCount).toBe(3);
    expect(activity.hasRecentLeadershipCluster).toBe(true);
    expect(activity.latestEventDate).toBe("2026-06-23");
    expect(activity.copy).toBe("3 leadership-change 8-K filings in the last 90 days.");
  });
});
