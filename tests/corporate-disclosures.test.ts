import { describe, expect, it } from "vitest";
import { parseCorporateDisclosuresFromSubmissions } from "@/lib/sec/corporate-disclosures";

describe("SEC corporate disclosures", () => {
  it("detects 8-K Item 2.02 earnings releases and periodic reports", () => {
    const summary = parseCorporateDisclosuresFromSubmissions("IBM", "0000051143", {
      filings: {
        recent: {
          form: ["8-K", "10-Q", "10-K", "8-K"],
          filingDate: ["2026-07-24", "2026-05-05", "2026-02-25", "2026-01-10"],
          reportDate: ["2026-07-24", "2026-03-31", "2025-12-31", "2026-01-10"],
          accessionNumber: [
            "0000051143-26-000090",
            "0000051143-26-000055",
            "0000051143-26-000020",
            "0000051143-26-000001",
          ],
          primaryDocument: ["ibm-20260724.htm", "ibm-20260331.htm", "ibm-20251231.htm", "ibm-20260110.htm"],
          items: ["2.02", "", "", "8.01"],
        },
      },
    });

    expect(summary.status).toBe("success");
    expect(summary.lastEarningsRelease?.title).toBe("Quarterly results furnished");
    expect(summary.lastEarningsRelease?.item).toBe("Item 2.02");
    expect(summary.lastQuarterlyReport?.form).toBe("10-Q");
    expect(summary.lastAnnualReport?.form).toBe("10-K");
    expect(summary.latestDisclosure?.kind).toBe("earnings-release");
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
});
