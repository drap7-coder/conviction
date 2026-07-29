export type FundKind = "hedge_fund" | "investment_fund";

export interface InstitutionalManager {
  manager: string;
  cik: string;
  displayName: string;
  /** Hedge funds vs long-only / mutual-style investment managers. */
  kind: FundKind;
}

export const FUND_KIND_LABELS: Record<FundKind, string> = {
  hedge_fund: "Hedge funds",
  investment_fund: "Investment funds",
};

export const INSTITUTIONAL_MANAGERS: InstitutionalManager[] = [
  // Investment funds (long-only / mutual-style)
  { manager: "Berkshire Hathaway", cik: "0001067983", displayName: "Berkshire Hathaway", kind: "investment_fund" },
  { manager: "BAMCO Inc", cik: "0001017918", displayName: "Baron Capital", kind: "investment_fund" },
  { manager: "ARK Investment Management", cik: "0001697748", displayName: "ARK Invest", kind: "investment_fund" },

  // Hedge funds
  { manager: "Pershing Square Capital Management", cik: "0001336528", displayName: "Pershing Square", kind: "hedge_fund" },
  { manager: "Duquesne Family Office", cik: "0001536411", displayName: "Duquesne", kind: "hedge_fund" },
  { manager: "Third Point", cik: "0001040273", displayName: "Third Point", kind: "hedge_fund" },
  { manager: "Tiger Global Management", cik: "0001167483", displayName: "Tiger Global", kind: "hedge_fund" },
  { manager: "Coatue Management", cik: "0001135730", displayName: "Coatue", kind: "hedge_fund" },
  { manager: "Renaissance Technologies", cik: "0001037389", displayName: "Renaissance", kind: "hedge_fund" },
  { manager: "Bridgewater Associates", cik: "0001350694", displayName: "Bridgewater", kind: "hedge_fund" },
  { manager: "D. E. Shaw", cik: "0001009207", displayName: "D. E. Shaw", kind: "hedge_fund" },
  { manager: "Citadel Advisors", cik: "0001423053", displayName: "Citadel", kind: "hedge_fund" },
  { manager: "Baupost Group", cik: "0001061768", displayName: "Baupost", kind: "hedge_fund" },
  { manager: "Lone Pine Capital", cik: "0001061165", displayName: "Lone Pine", kind: "hedge_fund" },
  { manager: "Viking Global Investors", cik: "0001103804", displayName: "Viking Global", kind: "hedge_fund" },
  { manager: "Soros Fund Management", cik: "0001029160", displayName: "Soros Fund", kind: "hedge_fund" },
  { manager: "Scion Asset Management", cik: "0001649339", displayName: "Scion", kind: "hedge_fund" },
];

export function managersForKind(kind: FundKind): InstitutionalManager[] {
  return INSTITUTIONAL_MANAGERS.filter((manager) => manager.kind === kind);
}

export function managerCountForKind(kind: FundKind): number {
  return managersForKind(kind).length;
}
