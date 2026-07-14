import { describe, expect, it } from "vitest";
import {
  compareHoldings,
  extract13FSubmissions,
  findCompanyHolding,
  getInstitutionalFilingCacheKey,
  issuerMatchesCompany,
  parse13FInformationTable,
  type InstitutionalFiling,
  type InstitutionalHolding,
} from "@/lib/sec/institutional";
import type { InstitutionalManager } from "@/lib/sec/institutional-managers";

const manager: InstitutionalManager = {
  manager: "test-manager",
  cik: "0000000001",
  displayName: "Test Manager",
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
