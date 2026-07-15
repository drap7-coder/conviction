import { fetchCompanySubmissions, resolveCIK } from "./client";

export type CorporateDisclosureStatus = "success" | "empty" | "unsupported";
export type CorporateDisclosureKind =
  | "earnings-release"
  | "quarterly-report"
  | "annual-report"
  | "leadership-change"
  | "acquisition-completed";
export type CorporateDisclosureDirection = "supporting" | "context";

export interface CorporateDisclosure {
  id: string;
  ticker: string;
  kind: CorporateDisclosureKind;
  direction: CorporateDisclosureDirection;
  title: string;
  summary: string;
  form: string;
  item: string | null;
  filingDate: string;
  reportDate: string | null;
  accession: string;
  source: "sec";
  sourceLabel: string;
  sourceUrl: string;
}

export interface CorporateDisclosureSummary {
  ticker: string;
  status: CorporateDisclosureStatus;
  lastEarningsRelease: CorporateDisclosure | null;
  lastQuarterlyReport: CorporateDisclosure | null;
  lastAnnualReport: CorporateDisclosure | null;
  corporateEvents: CorporateDisclosure[];
  latestDisclosure: CorporateDisclosure | null;
  disclosures: CorporateDisclosure[];
  fetchedAt: string;
  source: "sec-submissions";
}

interface RecentSubmissionRow {
  form: string;
  filingDate: string;
  reportDate: string | null;
  accession: string;
  primaryDocument: string;
  items: string | null;
}

const SEC_ARCHIVES = "https://www.sec.gov/Archives/edgar/data";
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const cache = new Map<string, { summary: CorporateDisclosureSummary; cachedAt: number }>();

function normalizeTicker(ticker: string) {
  return ticker.trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "");
}

function filingUrl(cik: string, accession: string, primaryDocument: string) {
  const bareCik = cik.replace(/^0+/, "");
  const accessionNoDash = accession.replace(/-/g, "");
  return `${SEC_ARCHIVES}/${bareCik}/${accessionNoDash}/${primaryDocument}`;
}

function extractRecentRows(submissions: Record<string, unknown>): RecentSubmissionRow[] {
  const recent = (submissions.filings as Record<string, unknown> | undefined)?.recent as Record<string, unknown[]> | undefined;
  if (!recent) return [];

  const forms = recent.form as string[] | undefined;
  const filingDates = recent.filingDate as string[] | undefined;
  const reportDates = recent.reportDate as string[] | undefined;
  const accessions = recent.accessionNumber as string[] | undefined;
  const primaryDocuments = recent.primaryDocument as string[] | undefined;
  const items = recent.items as string[] | undefined;
  if (!forms || !filingDates || !accessions || !primaryDocuments) return [];

  const rows: RecentSubmissionRow[] = [];
  for (let index = 0; index < forms.length; index++) {
    const form = forms[index];
    const filingDate = filingDates[index];
    const accession = accessions[index];
    const primaryDocument = primaryDocuments[index];
    if (!form || !filingDate || !accession || !primaryDocument) continue;
    rows.push({
      form,
      filingDate,
      reportDate: reportDates?.[index] ?? null,
      accession,
      primaryDocument,
      items: items?.[index] ?? null,
    });
  }

  return rows;
}

function hasItem202(row: RecentSubmissionRow) {
  return row.form.startsWith("8-K") && /\b2\.02\b/.test(row.items ?? "");
}

function hasItem502(row: RecentSubmissionRow) {
  return row.form.startsWith("8-K") && /\b5\.02\b/.test(row.items ?? "");
}

function hasItem201(row: RecentSubmissionRow) {
  return row.form.startsWith("8-K") && /\b2\.01\b/.test(row.items ?? "");
}

function buildDisclosure(ticker: string, cik: string, row: RecentSubmissionRow, kind: CorporateDisclosureKind): CorporateDisclosure {
  const isEarningsRelease = kind === "earnings-release";
  const isQuarterly = kind === "quarterly-report";
  const isLeadership = kind === "leadership-change";
  const isAcquisition = kind === "acquisition-completed";

  return {
    id: `${ticker}-${row.accession}-${kind}`,
    ticker,
    kind,
    direction: isEarningsRelease ? "supporting" : "context",
    title: isEarningsRelease
      ? "Quarterly results furnished"
      : isQuarterly
        ? "Quarterly report filed"
        : isLeadership
          ? "◆ 8-K: leadership change"
          : isAcquisition
            ? "◆ 8-K: acquisition completed"
            : "Annual report filed",
    summary: isEarningsRelease
      ? "Company furnished quarterly results in an SEC Form 8-K."
      : isQuarterly
        ? "Company filed its latest Form 10-Q."
        : isLeadership
          ? "Company reported a director or officer event in an SEC Form 8-K."
          : isAcquisition
            ? "Company reported completion of an acquisition or disposition in an SEC Form 8-K."
            : "Company filed its latest Form 10-K.",
    form: row.form,
    item: isEarningsRelease
      ? "Item 2.02"
      : isLeadership
        ? "Item 5.02"
        : isAcquisition
          ? "Item 2.01"
          : null,
    filingDate: row.filingDate,
    reportDate: row.reportDate,
    accession: row.accession,
    source: "sec",
    sourceLabel: isEarningsRelease
      ? "SEC Form 8-K Item 2.02"
      : isLeadership
        ? "SEC Form 8-K Item 5.02"
        : isAcquisition
          ? "SEC Form 8-K Item 2.01"
          : `SEC ${row.form}`,
    sourceUrl: filingUrl(cik, row.accession, row.primaryDocument),
  };
}

function latestByDate(rows: RecentSubmissionRow[]) {
  return rows.sort((a, b) => b.filingDate.localeCompare(a.filingDate))[0] ?? null;
}

export function clearCorporateDisclosureCache() {
  cache.clear();
}

export function parseCorporateDisclosuresFromSubmissions(
  ticker: string,
  cik: string,
  submissions: Record<string, unknown>,
): CorporateDisclosureSummary {
  const upperTicker = normalizeTicker(ticker);
  const rows = extractRecentRows(submissions);
  const earningsRow = latestByDate(rows.filter(hasItem202));
  const quarterlyRow = latestByDate(rows.filter((row) => row.form === "10-Q" || row.form === "10-Q/A"));
  const annualRow = latestByDate(rows.filter((row) => row.form === "10-K" || row.form === "10-K/A"));
  const corporateEventRows = [
    ...rows.filter(hasItem502).map((row) => buildDisclosure(upperTicker, cik, row, "leadership-change")),
    ...rows.filter(hasItem201).map((row) => buildDisclosure(upperTicker, cik, row, "acquisition-completed")),
  ].sort((a, b) => b.filingDate.localeCompare(a.filingDate));

  const disclosures = [
    earningsRow ? buildDisclosure(upperTicker, cik, earningsRow, "earnings-release") : null,
    quarterlyRow ? buildDisclosure(upperTicker, cik, quarterlyRow, "quarterly-report") : null,
    annualRow ? buildDisclosure(upperTicker, cik, annualRow, "annual-report") : null,
    ...corporateEventRows,
  ].filter((disclosure): disclosure is CorporateDisclosure => disclosure !== null)
    .sort((a, b) => b.filingDate.localeCompare(a.filingDate));

  return {
    ticker: upperTicker,
    status: disclosures.length > 0 ? "success" : "empty",
    lastEarningsRelease: disclosures.find((disclosure) => disclosure.kind === "earnings-release") ?? null,
    lastQuarterlyReport: disclosures.find((disclosure) => disclosure.kind === "quarterly-report") ?? null,
    lastAnnualReport: disclosures.find((disclosure) => disclosure.kind === "annual-report") ?? null,
    corporateEvents: corporateEventRows,
    latestDisclosure: disclosures[0] ?? null,
    disclosures,
    fetchedAt: new Date().toISOString(),
    source: "sec-submissions",
  };
}

export function buildUnsupportedCorporateDisclosureSummary(ticker: string): CorporateDisclosureSummary {
  return {
    ticker: normalizeTicker(ticker),
    status: "unsupported",
    lastEarningsRelease: null,
    lastQuarterlyReport: null,
    lastAnnualReport: null,
    corporateEvents: [],
    latestDisclosure: null,
    disclosures: [],
    fetchedAt: new Date().toISOString(),
    source: "sec-submissions",
  };
}

export async function getCorporateDisclosureSummary(
  ticker: string,
  cikOverride?: string | null,
): Promise<CorporateDisclosureSummary> {
  const upperTicker = normalizeTicker(ticker);
  const cik = cikOverride?.padStart(10, "0") ?? resolveCIK(upperTicker);
  if (!upperTicker || !cik) return buildUnsupportedCorporateDisclosureSummary(upperTicker);

  const cached = cache.get(upperTicker);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) return cached.summary;

  const { submissions } = await fetchCompanySubmissions(cik);
  if (!submissions) return buildUnsupportedCorporateDisclosureSummary(upperTicker);

  const summary = parseCorporateDisclosuresFromSubmissions(upperTicker, cik, submissions);
  cache.set(upperTicker, { summary, cachedAt: Date.now() });
  return summary;
}
