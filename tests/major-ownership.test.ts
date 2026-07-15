import { describe, expect, it } from "vitest";
import { parseMajorOwnershipFromSubmissions } from "@/lib/sec/major-ownership";

describe("SEC major ownership filings", () => {
  it("detects Schedule 13D and 13G filings from SEC submissions", () => {
    const summary = parseMajorOwnershipFromSubmissions("OXY", "0000797468", {
      filings: {
        recent: {
          form: ["SC 13G/A", "SC 13D", "8-K"],
          filingDate: ["2026-07-11", "2026-07-01", "2026-06-20"],
          reportDate: ["2026-07-10", "2026-06-30", "2026-06-20"],
          accessionNumber: [
            "0000950123-26-000010",
            "0000950123-26-000001",
            "0000797468-26-000020",
          ],
          primaryDocument: ["ownership-13ga.htm", "ownership-13d.htm", "oxy-8k.htm"],
        },
      },
    });

    expect(summary.status).toBe("success");
    expect(summary.filings).toHaveLength(2);
    expect(summary.latestFiling?.title).toBe("◆ 13G: major passive holder");
    expect(summary.filings[0].sourceLabel).toBe("SEC Schedule 13G/A");
    expect(summary.filings[1].title).toBe("◆ 13D: activist entry");
    expect(summary.filings[1].sourceUrl).toContain("000095012326000001");
  });

  it("returns an empty terminal state when no 13D or 13G filings exist", () => {
    const summary = parseMajorOwnershipFromSubmissions("IBM", "0000051143", {
      filings: {
        recent: {
          form: ["8-K", "10-Q", "4"],
          filingDate: ["2026-07-14", "2026-04-23", "2026-03-01"],
          accessionNumber: [
            "0000051143-26-000070",
            "0000051143-26-000038",
            "0000051143-26-000020",
          ],
          primaryDocument: ["ibm-8k.htm", "ibm-10q.htm", "ibm-form4.xml"],
        },
      },
    });

    expect(summary.status).toBe("empty");
    expect(summary.latestFiling).toBeNull();
    expect(summary.filings).toHaveLength(0);
  });
});
