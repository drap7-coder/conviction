/**
 * SEC EDGAR client for Form 4 insider transaction data.
 * Uses official SEC EDGAR full-text search and filing retrieval.
 *
 * SEC Fair Access guidance:
 * - Identify application via User-Agent
 * - Rate limit to 10 requests/second
 * - Cache responses
 * - Respect robots.txt
 */

import { CIK_MAP } from "./cik";
import type {
  InsiderTransaction,
  TransactionCode,
  SecSubmissionResult,
} from "./types";
import { codeToType } from "./types";

const SEC_BASE = "https://data.sec.gov";
const SEC_EDGAR = "https://www.sec.gov";
const USER_AGENT = "CONVICTION Evidence Detection v1.0 (nathandrapkin@gmail.com)";
const REQUEST_DELAY_MS = 200; // 5 req/s max, well within SEC limits
const MAX_FILINGS_TO_CHECK = 30;

// In-memory request queue for rate limiting
let lastRequestTime = 0;

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < REQUEST_DELAY_MS) {
    await new Promise((r) => setTimeout(r, REQUEST_DELAY_MS - elapsed));
  }
  lastRequestTime = Date.now();

  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json, text/xml, application/xml, text/html",
    },
  });

  return response;
}

/**
 * Resolve a ticker to SEC CIK.
 * Returns the 10-digit CIK padded with leading zeros.
 */
export function resolveCIK(ticker: string): string | null {
  const cik = CIK_MAP[ticker.toUpperCase()];
  return cik ? cik.padStart(10, "0") : null;
}

/**
 * Fetch recent company submissions from SEC EDGAR.
 * Uses the SEC JSON submissions API.
 */
export async function fetchCompanySubmissions(
  cik: string,
): Promise<{ submissions: Record<string, unknown> | null; rawCik: string }> {
  const paddedCik = cik.padStart(10, "0");
  const url = `${SEC_BASE}/submissions/CIK${paddedCik}.json`;

  try {
    const response = await rateLimitedFetch(url);
    if (!response.ok) {
      console.warn(`[sec] CIK ${cik}: HTTP ${response.status}`);
      return { submissions: null, rawCik: cik };
    }
    const data = (await response.json()) as Record<string, unknown>;
    // The API sometimes returns CIK as string (without zeros); use it
    const rawCik = (data?.cik as string) || cik;
    return { submissions: data, rawCik };
  } catch (err) {
    console.warn(`[sec] CIK ${cik} fetch failed:`, err instanceof Error ? err.message : err);
    return { submissions: null, rawCik: cik };
  }
}

/**
 * Extract recent Form 4 accession numbers from company submissions.
 * SEC JSON API returns parallel arrays (form[], filingDate[], accessionNumber[], etc.).
 */
export function extractForm4Accessions(
  data: Record<string, unknown>,
): Array<{ accession: string; filingDate: string; primaryDocument: string }> {
  const filings = data?.filings as Record<string, unknown> | undefined;
  const recent = filings?.recent as Record<string, unknown[]> | undefined;
  if (!recent) return [];

  const forms = recent.form as string[] | undefined;
  const filingDates = recent.filingDate as string[] | undefined;
  const accessions = recent.accessionNumber as string[] | undefined;
  const primaryDocs = recent.primaryDocument as string[] | undefined;

  if (!forms || !filingDates || !accessions || !primaryDocs) return [];

  const form4s: Array<{ accession: string; filingDate: string; primaryDocument: string }> = [];

  for (let i = 0; i < forms.length; i++) {
    const form = forms[i];
    if (form !== "4") continue;

    const accession = accessions[i];
    const filingDate = filingDates[i];
    const primaryDoc = primaryDocs[i];

    if (accession && filingDate && primaryDoc) {
      form4s.push({ accession, filingDate, primaryDocument: primaryDoc });
    }

    if (form4s.length >= MAX_FILINGS_TO_CHECK) break;
  }

  return form4s;
}

/**
 * Build the SEC filing detail page URL (not the raw document URL).
 */
function buildFilingUrl(cik: string, accession: string, _primaryDoc?: string): string {
  // Strip leading zeros for EDGAR archive paths
  const bareCik = cik.replace(/^0+/, "");
  const accessionNoDash = accession.replace(/-/g, "");
  return `${SEC_EDGAR}/Archives/edgar/data/${bareCik}/${accessionNoDash}/${accessionNoDash}-index.htm`;
}

/**
 * Parse the ownershipDocument XML (non-namespace SEC schema).
 * Returns the raw text of the document for text-based parsing.
 * SEC stores Form 4 in two forms: an HTML-rendered version in a subdirectory
 * and the raw XML at the top level. We try the raw XML first.
 */
async function fetchForm4Document(
  cik: string,
  accession: string,
  primaryDoc: string,
): Promise<string | null> {
  const bareCik = cik.replace(/^0+/, "");
  const accessionNoDash = accession.replace(/-/g, "");

  // Derive the raw XML filename by stripping any subdirectory prefix
  const rawFilename = primaryDoc.includes("/") ? primaryDoc.split("/").pop()! : primaryDoc;

  // Try raw XML data file first
  const rawUrl = `${SEC_EDGAR}/Archives/edgar/data/${bareCik}/${accessionNoDash}/${rawFilename}`;
  try {
    const response = await rateLimitedFetch(rawUrl);
    if (response.ok) {
      const text = await response.text();
      // Verify it's actual XML, not HTML
      if (text.trim().startsWith("<?xml") || text.trim().startsWith("<ownershipDocument")) {
        return text;
      }
    }
  } catch {
    // Fall through to try primary doc
  }

  // Fall back to the primary document
  const url = buildFilingUrl(cik, accession, primaryDoc);
  try {
    const response = await rateLimitedFetch(url);
    if (!response.ok) {
      console.warn(`[sec] Form 4 fetch ${url}: HTTP ${response.status}`);
      return null;
    }
    return await response.text();
  } catch (err) {
    console.warn(`[sec] Form 4 fetch ${url}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Extract a value from XML-like text.
 * SEC Form 4 XML uses nested format: <tag><value>data</value></tag>
 * Also handles <tag>data</tag> and <tag attr="val">data</tag>.
 */
function extractXmlTag(xml: string, tag: string): string | null {
  // Match the section between opening and closing tag
  // Then look for a nested <value> tag first, or use the raw content
  const pattern = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = xml.match(pattern);
  if (!match) return null;

  const content = match[1].trim();
  if (!content) return null;

  // If there's a nested <value> tag, use that
  const valueMatch = content.match(/<value>([^<]*)<\/value>/i);
  if (valueMatch) return valueMatch[1].trim();

  // Otherwise use the raw content (but only if it doesn't contain nested XML tags)
  if (!content.includes("<")) return content;
  return null;
}

/**
 * Extract the full text content of a section (e.g. <reportingOwner>...</reportingOwner>).
 */
function extractXmlSection(xml: string, tag: string): string | null {
  // Match with or without namespace
  const pattern = new RegExp(`<[^>]*${tag}[^>]*>([\\s\\S]*?)<\\/[^>]*${tag}>`, "i");
  const match = xml.match(pattern);
  return match ? match[1] : null;
}

/**
 * Extract all occurrences of a repeating section (e.g. <nonDerivativeTable>).
 */
function extractAllSections(xml: string, tag: string): string[] {
  const sections: string[] = [];
  const pattern = new RegExp(`<[^>]*${tag}[^>]*>([\\s\\S]*?)<\\/[^>]*${tag}>`, "gi");
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(xml)) !== null) {
    sections.push(match[1]);
  }
  return sections;
}

/**
 * Parse a single non-derivative transaction from its XML section.
 */
function parseNonDerivativeTransaction(
  section: string,
  ticker: string,
  cik: string,
  accession: string,
  insiderName: string,
  insiderRole: string | null,
  isDirector: boolean,
  isOfficer: boolean,
  isTenPercentOwner: boolean,
  filingDate: string,
  index: number,
): InsiderTransaction | null {
  const transactionDate = extractXmlTag(section, "transactionDate");
  if (!transactionDate) return null;

  const rawCode = extractXmlTag(section, "transactionCode");
  if (!rawCode) return null;

  const transactionCode = rawCode.toUpperCase() as TransactionCode;
  const transactionType = codeToType(transactionCode);

  // Shares
  const sharesRaw = extractXmlTag(section, "transactionShares");
  const shares = sharesRaw ? parseFloat(sharesRaw.replace(/,/g, "")) : 0;
  if (shares <= 0) return null;

  // Price
  const priceRaw = extractXmlTag(section, "transactionPricePerShare");
  const pricePerShare = priceRaw ? parseFloat(priceRaw.replace(/,/g, "")) : null;

  // Total value (shares * price)
  const totalValue = pricePerShare ? Math.round(shares * pricePerShare * 100) / 100 : null;

  // Acquired or disposed
  const acquiredDisposed = extractXmlTag(section, "transactionAcquiredDisposedCode");
  const isAcquisition = acquiredDisposed?.toUpperCase() === "A";

  // Ownership
  const directIndirect = extractXmlTag(section, "directOrIndirectOwnership");
  const isDirectOwnership = directIndirect?.toUpperCase() === "D";

  // Shares owned after
  const sharesOwnedRaw = extractXmlTag(section, "sharesOwnedFollowingTransaction");
  const sharesOwnedAfter = sharesOwnedRaw ? parseFloat(sharesOwnedRaw.replace(/,/g, "")) : null;

  // Ownership change percentage
  const ownershipChange = sharesOwnedAfter && sharesOwnedAfter > 0
    ? Math.round((shares / (sharesOwnedAfter - shares)) * 10000) / 100
    : null;

  const id = `${ticker}::${accession}::${index}::${transactionCode}`;
  const filingUrl = buildFilingUrl(cik, accession);

  return {
    id,
    ticker,
    cik,
    accessionNumber: accession,
    filingUrl,
    insiderName,
    insiderRole,
    isDirector,
    isOfficer,
    isTenPercentOwner,
    transactionDate,
    filingDate,
    transactionCode,
    transactionType,
    shares,
    pricePerShare,
    totalValue,
    sharesOwnedAfter,
    isDirectOwnership,
    ownershipChange,
  };
}

// (formatAccession removed — filingUrl now uses buildFilingUrl directly)


/**
 * Parse the reporting owner section from Form 4 XML.
 */
function parseReportingOwner(xml: string): {
  name: string;
  role: string | null;
  isDirector: boolean;
  isOfficer: boolean;
  isTenPercentOwner: boolean;
} {
  const ownerSection = extractXmlSection(xml, "reportingOwner");
  if (!ownerSection) {
    return { name: "Unknown", role: null, isDirector: false, isOfficer: false, isTenPercentOwner: false };
  }

  const nameSection = extractXmlSection(ownerSection, "reportingOwnerId") || ownerSection;
  const name = extractXmlTag(nameSection, "rptOwnerName") || "Unknown";

  const roleSection = extractXmlSection(ownerSection, "reportingOwnerRelationship") || ownerSection;
  const isDirector = extractXmlTag(roleSection, "isDirector")?.toUpperCase() === "1";
  const isOfficer = extractXmlTag(roleSection, "isOfficer")?.toUpperCase() === "1";
  const isTenPercentOwner = extractXmlTag(roleSection, "isTenPercentOwner")?.toUpperCase() === "1";
  const officerTitle = extractXmlTag(roleSection, "officerTitle");

  let role: string | null = null;
  if (isOfficer && officerTitle) {
    role = officerTitle;
  } else if (isDirector) {
    role = "Director";
  } else if (isTenPercentOwner) {
    role = "10% Owner";
  }

  return { name, role, isDirector, isOfficer, isTenPercentOwner };
}

/**
 * Parse a complete Form 4 XML document into structured transactions.
 */
export function parseForm4Document(
  xml: string,
  ticker: string,
  cik: string,
  accession: string,
  filingDate: string,
): InsiderTransaction[] {
  const transactions: InsiderTransaction[] = [];

  // Extract reporting owner info
  const { name, role, isDirector, isOfficer, isTenPercentOwner } = parseReportingOwner(xml);

  // Extract non-derivative transactions
  const nonDerivativeTables = extractAllSections(xml, "nonDerivativeTable");
  for (const table of nonDerivativeTables) {
    const tx = parseNonDerivativeTransaction(
      table, ticker, cik, accession, name, role,
      isDirector, isOfficer, isTenPercentOwner,
      filingDate, transactions.length,
    );
    if (tx) transactions.push(tx);
  }

  // Extract derivative transactions (exercises, etc.)
  const derivativeTables = extractAllSections(xml, "derivativeTable");
  for (const table of derivativeTables) {
    const tx = parseNonDerivativeTransaction(
      table, ticker, cik, accession, name, role,
      isDirector, isOfficer, isTenPercentOwner,
      filingDate, transactions.length,
    );
    if (tx) {
      // Mark derivative transactions
      if (tx.transactionCode === "M" || tx.transactionCode === "X") {
        // Keep as-is, classification already handles this
      }
      transactions.push(tx);
    }
  }

  return transactions;
}

/**
 * Fetch and parse Form 4 filings for a ticker.
 * Returns structured insider transactions.
 */
export async function fetchInsiderTransactions(
  ticker: string,
  knownDedupKeys: Set<string> = new Set(),
): Promise<{
  newTransactions: InsiderTransaction[];
  allTransactions: InsiderTransaction[];
  errors: string[];
  fetchedAt: string;
}> {
  const errors: string[] = [];
  const allTransactions: InsiderTransaction[] = [];
  const newTransactions: InsiderTransaction[] = [];

  const cik = resolveCIK(ticker);
  if (!cik) {
    errors.push(`No CIK mapping for ${ticker}`);
    return { newTransactions: [], allTransactions: [], errors, fetchedAt: new Date().toISOString() };
  }

  // Fetch company submissions
  const { submissions, rawCik } = await fetchCompanySubmissions(cik);
  if (!submissions) {
    errors.push(`Failed to fetch submissions for ${ticker} (CIK ${cik})`);
    return { newTransactions: [], allTransactions: [], errors, fetchedAt: new Date().toISOString() };
  }

  // Extract Form 4 accessions
  const form4s = extractForm4Accessions(submissions);
  if (form4s.length === 0) {
    return { newTransactions: [], allTransactions: [], errors, fetchedAt: new Date().toISOString() };
  }

  // Fetch and parse each Form 4
  for (const form4 of form4s) {
    const xml = await fetchForm4Document(rawCik, form4.accession, form4.primaryDocument);
    if (!xml) {
      errors.push(`Failed to fetch Form 4 ${form4.accession} for ${ticker}`);
      continue;
    }

    const transactions = parseForm4Document(xml, ticker, rawCik, form4.accession, form4.filingDate);
    for (const tx of transactions) {
      allTransactions.push(tx);
      if (!knownDedupKeys.has(tx.id)) {
        newTransactions.push(tx);
      }
    }
  }

  // Sort by transaction date descending
  allTransactions.sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
  newTransactions.sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));

  return {
    newTransactions,
    allTransactions,
    errors,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Fetch insider transactions for multiple tickers.
 */
export async function fetchAllWatchlistInsiderTransactions(
  tickers: string[],
  knownDedupKeys: Set<string> = new Set(),
): Promise<Record<string, {
  newTransactions: InsiderTransaction[];
  allTransactions: InsiderTransaction[];
  errors: string[];
  fetchedAt: string;
}>> {
  const results: Record<string, any> = {};

  for (const ticker of tickers) {
    results[ticker] = await fetchInsiderTransactions(ticker, knownDedupKeys);
    // Small delay between companies to be respectful
    await new Promise((r) => setTimeout(r, 100));
  }

  return results;
}