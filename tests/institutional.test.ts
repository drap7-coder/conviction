import { describe, expect, it } from "vitest";
import {
  buildInstitutionalMarketIdeas,
  compareHoldings,
  extract13FSubmissions,
  findCompanyHolding,
  getInstitutionalFilingCacheKey,
  issuerMatchesCompany,
  parse13FInformationTable,
  type InstitutionalFiling,
  type InstitutionalHolding,
  type InstitutionalManagerSnapshot,
} from "@/lib/sec/institutional";
import type { InstitutionalManager } from "@/lib/sec/institutional-managers";

const manager: InstitutionalManager = {
  manager: "test-manager",
  cik: "0000000001",
  displayName: "Test Manager",
  kind: "hedge_fund",
};

function holding(overrides: Partial<InstitutionalHolding> = {}): InstitutionalHolding {
  return {
    issuer: "Acme Corp",
    classTitle: "COM",
    cusip: "000000000",
    putCall: null,
    shares: 100,
    value: 50,
    ...overrides,
  };
}

function filing(overrides: Partial<InstitutionalFiling> = {}): InstitutionalFiling {
  return {
    managerCik: manager.cik,
    accession: "0000000001-26-000001",
    filingDate: "2026-05-15",
    quarter: "2026-03-31",
    holdings: [],
    ...overrides,
  };
}

describe("parse13FInformationTable", () => {
  it("parses holdings from a 13F information table", () => {
    const xml = `
      <informationTable>
        <infoTable>
          <nameOfIssuer>ACME CORP</nameOfIssuer>
          <titleOfClass>COM</titleOfClass>
          <cusip>000000000</cusip>
          <putCall>Call</putCall>
          <value>1,250</value>
          <shrsOrPrnAmt><sshPrnamt>25,000</sshPrnamt></shrsOrPrnAmt>
        </infoTable>
      </informationTable>
    `;

    const parsed = parse13FInformationTable(xml, manager.cik, "acc", "2026-05-15", "2026-03-31");

    expect(parsed.holdings).toHaveLength(1);
    expect(parsed.holdings[0]).toMatchObject({
      issuer: "ACME CORP",
      classTitle: "COM",
      cusip: "000000000",
      putCall: "Call",
      value: 1250,
      shares: 25000,
    });
  });
});

describe("extract13FSubmissions", () => {
  it("keeps the latest filing for duplicate reporting quarters", () => {
    const filings = extract13FSubmissions({
      filings: {
        recent: {
          form: ["13F-HR", "13F-HR/A", "4"],
          accessionNumber: ["old", "amended", "ignored"],
          filingDate: ["2026-05-10", "2026-05-20", "2026-06-01"],
          reportDate: ["2026-03-31", "2026-03-31", "2026-05-30"],
          primaryDocument: ["old.xml", "amended.xml", "form4.xml"],
        },
      },
    });

    expect(filings).toHaveLength(1);
    expect(filings[0].accession).toBe("amended");
  });
});

describe("compareHoldings", () => {
  it("identifies a new position", () => {
    const result = compareHoldings(manager, holding({ shares: 100 }), null, filing());
    expect(result?.status).toBe("New");
    expect(result?.shareChange).toBe(100);
    expect(result?.percentageChange).toBeNull();
    expect(result?.fundKind).toBe("hedge_fund");
  });

  it("identifies an increased position by shares", () => {
    const result = compareHoldings(
      manager,
      holding({ shares: 150, value: 10 }),
      holding({ shares: 100, value: 1_000_000 }),
      filing(),
    );

    expect(result?.status).toBe("Increased");
    expect(result?.shareChange).toBe(50);
    expect(result?.percentageChange).toBe(50);
  });

  it("identifies a reduced position", () => {
    const result = compareHoldings(
      manager,
      holding({ shares: 75 }),
      holding({ shares: 100 }),
      filing(),
    );

    expect(result?.status).toBe("Reduced");
    expect(result?.shareChange).toBe(-25);
  });

  it("identifies an exited position", () => {
    const result = compareHoldings(manager, null, holding({ shares: 100 }), filing());
    expect(result?.status).toBe("Exited");
    expect(result?.shares).toBe(0);
    expect(result?.previousShares).toBe(100);
  });

  it("does not let reported value determine accumulation status", () => {
    const result = compareHoldings(
      manager,
      holding({ shares: 100, value: 5_000_000 }),
      holding({ shares: 100, value: 1 }),
      filing(),
    );

    expect(result?.status).toBe("Unchanged");
    expect(result?.shareChange).toBe(0);
  });

  it("does not compare different share classes as one position", () => {
    const result = compareHoldings(
      manager,
      holding({ issuer: "ALPHABET INC", classTitle: "CAP STK CL C", cusip: "02079K107" }),
      holding({ issuer: "ALPHABET INC", classTitle: "CAP STK CL A", cusip: "02079K305" }),
      filing(),
    );

    expect(result).toBeNull();
  });
});

describe("institutional matching and caching", () => {
  it("matches issuer names conservatively against company names", () => {
    expect(issuerMatchesCompany("OCCIDENTAL PETE CORP", "Occidental Petroleum")).toBe(true);
    expect(issuerMatchesCompany("APPLE INC", "Occidental Petroleum")).toBe(false);
  });

  it("excludes options from common-share matching", () => {
    const result = findCompanyHolding(
      filing({
        holdings: [
          holding({ issuer: "INTEL CORP", putCall: "Call", shares: 1000 }),
          holding({ issuer: "INTEL CORP", putCall: "Put", shares: 2000 }),
          holding({ issuer: "INTEL CORP", shares: 300 }),
        ],
      }),
      "Intel Corporation",
    );

    expect(result?.shares).toBe(300);
    expect(result?.putCall).toBeNull();
  });

  it("combines duplicate rows for the same common security", () => {
    const result = findCompanyHolding(
      filing({
        holdings: [
          holding({ issuer: "PFIZER INC", cusip: "717081103", shares: 100, value: 10 }),
          holding({ issuer: "PFIZER INC", cusip: "717081103", shares: 250, value: 20 }),
        ],
      }),
      "Pfizer Inc.",
    );

    expect(result?.shares).toBe(350);
    expect(result?.value).toBe(30);
    expect(result?.cusip).toBe("717081103");
  });

  it("excludes ambiguous matches across distinct share classes", () => {
    const result = findCompanyHolding(
      filing({
        holdings: [
          holding({
            issuer: "ALPHABET INC",
            classTitle: "CAP STK CL A",
            cusip: "02079K305",
            shares: 100,
          }),
          holding({
            issuer: "ALPHABET INC",
            classTitle: "CAP STK CL C",
            cusip: "02079K107",
            shares: 200,
          }),
        ],
      }),
      "Alphabet Inc.",
    );

    expect(result).toBeNull();
  });

  it("keys parsed filing cache by manager and filing quarter", () => {
    expect(getInstitutionalFilingCacheKey("0000000001", "2026-03-31")).toBe(
      "0000000001:2026-03-31",
    );
  });
});

describe("institutional market ideas", () => {
  function snapshot(
    displayName: string,
    latestHoldings: InstitutionalHolding[],
    previousHoldings: InstitutionalHolding[],
  ): InstitutionalManagerSnapshot {
    return {
      manager: {
        manager: displayName,
        displayName,
        cik: displayName,
        kind: "hedge_fund",
      },
      latest: filing({ holdings: latestHoldings }),
      previous: filing({
        accession: "0000000001-26-000000",
        filingDate: "2026-02-14",
        quarter: "2025-12-31",
        holdings: previousHoldings,
      }),
    };
  }

  it("combines share classes and labels new, added, and shared signals", () => {
    const universe = [{
      ticker: "GOOG",
      companyName: "Alphabet Inc.",
      cusips: ["02079K107", "02079K305"],
    }];
    const ideas = buildInstitutionalMarketIdeas([
      snapshot(
        "Baupost",
        [
          holding({ issuer: "ALPHABET INC", cusip: "02079K107", classTitle: "CAP STK CL C", shares: 120 }),
          holding({ issuer: "ALPHABET INC", cusip: "02079K305", classTitle: "CAP STK CL A", shares: 30 }),
        ],
        [holding({ issuer: "ALPHABET INC", cusip: "02079K107", classTitle: "CAP STK CL C", shares: 100 })],
      ),
      snapshot(
        "Pershing Square",
        [holding({ issuer: "ALPHABET INC", cusip: "02079K107", classTitle: "CAP STK CL C", shares: 50 })],
        [],
      ),
    ], universe);

    expect(ideas).toHaveLength(1);
    expect(ideas[0]).toMatchObject({
      ticker: "GOOG",
      headline: "New Position",
      holderCount: 2,
      newPositionCount: 1,
      increasedCount: 1,
      categories: ["new", "added", "shared"],
    });
    expect(ideas[0].moves.find((move) => move.displayName === "Baupost")?.shares).toBe(150);
  });

  it("keeps independently held positions as shared conviction without calling them purchases", () => {
    const qsr = holding({ issuer: "RESTAURANT BRANDS INTL", cusip: "76131D103", shares: 100 });
    const ideas = buildInstitutionalMarketIdeas([
      snapshot("Baupost", [qsr], [qsr]),
      snapshot("Pershing Square", [holding({ ...qsr, shares: 90 })], [qsr]),
    ], [{ ticker: "QSR", companyName: "Restaurant Brands", cusips: ["76131D103"] }]);

    expect(ideas[0]).toMatchObject({
      headline: "Shared Conviction",
      categories: ["shared"],
      holderCount: 2,
      newPositionCount: 0,
      increasedCount: 0,
    });
  });

  it("does not surface a lone reduction as an investor idea", () => {
    const ideas = buildInstitutionalMarketIdeas([
      snapshot(
        "Test Manager",
        [holding({ issuer: "ACME CORP", cusip: "000000000", shares: 50 })],
        [holding({ issuer: "ACME CORP", cusip: "000000000", shares: 100 })],
      ),
    ], [{ ticker: "ACME", companyName: "Acme Corp", cusips: ["000000000"] }]);

    expect(ideas).toEqual([]);
  });
});
