import { fetchCompanySubmissions, resolveCIK } from "./client";

export type MajorOwnershipStatus = "success" | "empty" | "unsupported";
export type MajorOwnershipKind = "13d" | "13g";

export interface MajorOwnershipFiling {
  id: string;
  ticker: string;
  kind: MajorOwnershipKind;
  title: string;
  summary: string;
  form: string;
  filingDate: string;
  reportDate: string | null;
  accession: string;
  source: "sec";
  sourceLabel: string;
  sourceUrl: string;
}

export interface MajorOwnershipSummary {
  ticker: string;
  status: MajorOwnershipStatus;
  filings: MajorOwnershipFiling[];
  latestFiling: MajorOwnershipFiling | null;
  fetchedAt: string;
  source: "sec-submissions";
}

interface RecentSubmissionRow {
  form: string;
  filingDate: string;
  reportDate: string | null;
  accession: string;
  primaryDocument: string;
}

const SEC_ARCHIVES = "https://www.sec.gov/Archives/edgar/data";
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const cache = new Map<string, { summary: MajorOwnershipSummary; cachedAt: number }>();

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
    });
  }

  return rows;
}

function ownershipKind(form: string): MajorOwnershipKind | null {
  if (/^SC 13D(?:\/A)?$/.test(form)) return "13d";
  if (/^SC 13G(?:\/A)?$/.test(form)) return "13g";
  return null;
}

function buildFiling(ticker: string, cik: string, row: RecentSubmissionRow): MajorOwnershipFiling | null {
  const kind = ownershipKind(row.form);
  if (!kind) return null;
  const amended = row.form.endsWith("/A");
  const sourceLabel = kind === "13d" ? "SEC Schedule 13D" : "SEC Schedule 13G";

  return {
    id: `${ticker}-${row.accession}-${kind}`,
    ticker,
    kind,
    title: kind === "13d" ? "◆ 13D: activist entry" : "◆ 13G: major passive holder",
    summary: kind === "13d"
      ? `Schedule 13D${amended ? " amendment" : ""} filed for a beneficial ownership position.`
      : `Schedule 13G${amended ? " amendment" : ""} filed for a passive beneficial ownership position.`,
    form: row.form,
    filingDate: row.filingDate,
    reportDate: row.reportDate,
    accession: row.accession,
    source: "sec",
    sourceLabel: amended ? `${sourceLabel}/A` : sourceLabel,
    sourceUrl: filingUrl(cik, row.accession, row.primaryDocument),
  };
}

export function clearMajorOwnershipCache() {
  cache.clear();
}

export function parseMajorOwnershipFromSubmissions(
  ticker: string,
  cik: string,
  submissions: Record<string, unknown>,
): MajorOwnershipSummary {
  const upperTicker = normalizeTicker(ticker);
  const filings = extractRecentRows(submissions)
    .map((row) => buildFiling(upperTicker, cik, row))
    .filter((filing): filing is MajorOwnershipFiling => filing !== null)
    .sort((a, b) => b.filingDate.localeCompare(a.filingDate));

  return {
    ticker: upperTicker,
    status: filings.length > 0 ? "success" : "empty",
    filings,
    latestFiling: filings[0] ?? null,
    fetchedAt: new Date().toISOString(),
    source: "sec-submissions",
  };
}

export function buildUnsupportedMajorOwnershipSummary(ticker: string): MajorOwnershipSummary {
  return {
    ticker: normalizeTicker(ticker),
    status: "unsupported",
    filings: [],
    latestFiling: null,
    fetchedAt: new Date().toISOString(),
    source: "sec-submissions",
  };
}

export async function getMajorOwnershipSummary(
  ticker: string,
  cikOverride?: string | null,
): Promise<MajorOwnershipSummary> {
  const upperTicker = normalizeTicker(ticker);
  const cik = cikOverride?.padStart(10, "0") ?? resolveCIK(upperTicker);
  if (!upperTicker || !cik) return buildUnsupportedMajorOwnershipSummary(upperTicker);

  const cached = cache.get(upperTicker);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) return cached.summary;

  const { submissions } = await fetchCompanySubmissions(cik);
  if (!submissions) return buildUnsupportedMajorOwnershipSummary(upperTicker);

  const summary = parseMajorOwnershipFromSubmissions(upperTicker, cik, submissions);
  cache.set(upperTicker, { summary, cachedAt: Date.now() });
  return summary;
}
