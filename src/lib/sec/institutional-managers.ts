export interface InstitutionalManager {
  manager: string;
  cik: string;
  displayName: string;
}

export const INSTITUTIONAL_MANAGERS: InstitutionalManager[] = [
  { manager: "Berkshire Hathaway", cik: "0001067983", displayName: "Berkshire Hathaway" },
  { manager: "Pershing Square Capital Management", cik: "0001336528", displayName: "Pershing Square" },
  { manager: "Duquesne Family Office", cik: "0001536411", displayName: "Duquesne" },
  { manager: "Third Point", cik: "0001040273", displayName: "Third Point" },
  { manager: "Tiger Global Management", cik: "0001167483", displayName: "Tiger Global" },
  { manager: "Coatue Management", cik: "0001135730", displayName: "Coatue" },
  { manager: "Renaissance Technologies", cik: "0001037389", displayName: "Renaissance" },
  { manager: "Bridgewater Associates", cik: "0001350694", displayName: "Bridgewater" },
  { manager: "D. E. Shaw", cik: "0001009207", displayName: "D. E. Shaw" },
  { manager: "Citadel Advisors", cik: "0001423053", displayName: "Citadel" },
  { manager: "Baupost Group", cik: "0001061768", displayName: "Baupost" },
  { manager: "Lone Pine Capital", cik: "0001061165", displayName: "Lone Pine" },
  { manager: "Viking Global Investors", cik: "0001103804", displayName: "Viking Global" },
  { manager: "Soros Fund Management", cik: "0001029160", displayName: "Soros Fund" },
  { manager: "Scion Asset Management", cik: "0001649339", displayName: "Scion" },
];
