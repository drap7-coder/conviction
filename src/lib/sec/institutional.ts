import { secFetch } from "./client";
import { INSTITUTIONAL_MANAGERS, type InstitutionalManager } from "./institutional-managers";

const SEC_BASE = "https://data.sec.gov";
const SEC_ARCHIVES = "https://www.sec.gov/Archives/edgar/data";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type AccumulationStatus = "New" | "Increased" | "Unchanged" | "Reduced" | "Exited";

export interface InstitutionalHolding {
  issuer: string;
  classTitle: string;
  cusip: string;
  putCall: string | null;
  shares: number;
  value: number;
}

export interface InstitutionalFiling {
  managerCik: string;
  accession: string;
  filingDate: string;
  quarter: string;
  holdings: InstitutionalHolding[];
}

export interface InstitutionalAccumulation {
  manager: string;
  displayName: string;
  cik: string;
  issuer: string | null;
  classTitle: string | null;
  cusip: string | null;
  shares: number;
  previousShares: number;
  shareChange: number;
  percentageChange: number | null;
  reportedValue: number;
  filingQuarter: string;
  filingDate: string;
  status: AccumulationStatus;
}

export interface InstitutionalCompanyResult {
  ticker: string;
  companyName: string;
  results: InstitutionalAccumulation[];
  fetchedAt: string;
  source: "sec-13f";
}

export interface RecentFiling {
  accession: string;
  filingDate: string;
  reportDate: string;
  primaryDocument: string;
}

interface HoldingMatch {
  holding: InstitutionalHolding | null;
  ambiguous: boolean;
}

const filingCache = new Map<string, { filing: InstitutionalFiling; cachedAt: number }>();

export function clearInstitutionalCache() {
  filingCache.clear();
}

export function getInstitutionalFilingCacheKey(managerCik: string, quarter: string) {
  return `${managerCik}:${quarter}`;
}

function normalizeText(value: string): string {
  return value
    .toUpperCase()
    .replace(/&/g, " AND ")
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\b(CL|CLASS|COM|COMMON|CORP|CORPORATION|INC|INCORPORATED|LTD|LIMITED|PLC|SA|NV|DE|NEW|ORD|SHS|SPON|ADR|ADS|HLDG|HOLDINGS|GROUP|THE)\b/g, " ")
    .replace(/\bPETE\b/g, "PETROLEUM")
    .replace(/\bINTL\b/g, "INTERNATIONAL")
    .replace(/\bTECH\b/g, "TECHNOLOGY")
    .replace(/\s+/g, " ")
    .trim();
}

export function issuerMatchesCompany(issuer: string, companyName: string): boolean {
  const issuerTokens = new Set(normalizeText(issuer).split(" ").filter((token) => token.length >= 3));
  const companyTokens = normalizeText(companyName).split(" ").filter((token) => token.length >= 3);
  if (issuerTokens.size === 0 || companyTokens.length === 0) return false;

  const matches = companyTokens.filter((token) => issuerTokens.has(token)).length;
  return matches >= Math.min(2, companyTokens.length);
}

function extractTag(section: string, tag: string): string | null {
  const pattern = new RegExp(`<[^>]*${tag}[^>]*>([\\s\\S]*?)<\\/[^>]*${tag}>`, "i");
  const match = section.match(pattern);
  if (!match) return null;
  return match[1].replace(/<[^>]+>/g, "").trim();
}

function extractInfoTables(xml: string): string[] {
  const tables: string[] = [];
  const pattern = /<[^>]*infoTable[^>]*>([\s\S]*?)<\/[^>]*infoTable>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(xml)) !== null) {
    tables.push(match[1]);
  }
  return tables;
}

export function parse13FInformationTable(
  xml: string,
  managerCik: string,
  accession: string,
  filingDate: string,
  quarter: string,
): InstitutionalFiling {
  const holdings = extractInfoTables(xml)
    .map((section): InstitutionalHolding | null => {
      const issuer = extractTag(section, "nameOfIssuer");
      const classTitle = extractTag(section, "titleOfClass") ?? "";
      const cusip = extractTag(section, "cusip") ?? "";
      const putCall = extractTag(section, "putCall");
      const value = Number((extractTag(section, "value") ?? "0").replace(/,/g, ""));
      const shares = Number((extractTag(section, "sshPrnamt") ?? "0").replace(/,/g, ""));
      if (!issuer || !Number.isFinite(shares) || shares <= 0) return null;
      return { issuer, classTitle, cusip, putCall: putCall || null, value: Number.isFinite(value) ? value : 0, shares };
    })
    .filter((holding): holding is InstitutionalHolding => holding !== null);

  return { managerCik, accession, filingDate, quarter, holdings };
}

export function extract13FSubmissions(data: Record<string, unknown>): RecentFiling[] {
  const recent = (data.filings as Record<string, unknown> | undefined)?.recent as Record<string, unknown[]> | undefined;
  if (!recent) return [];

  const forms = recent.form as string[] | undefined;
  const accessions = recent.accessionNumber as string[] | undefined;
  const filingDates = recent.filingDate as string[] | undefined;
  const reportDates = recent.reportDate as string[] | undefined;
  const primaryDocs = recent.primaryDocument as string[] | undefined;
  if (!forms || !accessions || !filingDates || !reportDates || !primaryDocs) return [];

  const byQuarter = new Map<string, RecentFiling>();
  for (let index = 0; index < forms.length; index++) {
    if (!forms[index]?.startsWith("13F-HR")) continue;
    const reportDate = reportDates[index];
    const filingDate = filingDates[index];
    const accession = accessions[index];
    const primaryDocument = primaryDocs[index];
    if (!reportDate || !filingDate || !accession || !primaryDocument) continue;

    const existing = byQuarter.get(reportDate);
    if (!existing || filingDate > existing.filingDate) {
      byQuarter.set(reportDate, { accession, filingDate, reportDate, primaryDocument });
    }
  }

  return Array.from(byQuarter.values()).sort((a, b) => b.reportDate.localeCompare(a.reportDate));
}

async function fetchManagerSubmissions(manager: InstitutionalManager): Promise<RecentFiling[]> {
  const cik = manager.cik.padStart(10, "0");
  const response = await secFetch(`${SEC_BASE}/submissions/CIK${cik}.json`);
  if (!response.ok) return [];
  const data = (await response.json()) as Record<string, unknown>;
  return extract13FSubmissions(data);
}

async function fetchFilingIndex(manager: InstitutionalManager, accession: string): Promise<string[]> {
  const bareCik = manager.cik.replace(/^0+/, "");
  const accessionNoDash = accession.replace(/-/g, "");
  const response = await secFetch(`${SEC_ARCHIVES}/${bareCik}/${accessionNoDash}/index.json`);
  if (!response.ok) return [];
  const data = (await response.json()) as { directory?: { item?: Array<{ name?: string }> } };
  return data.directory?.item?.map((item) => item.name).filter((name): name is string => !!name) ?? [];
}

function isLikelyInfoTableFile(filename: string, primaryDocument: string): boolean {
  const lower = filename.toLowerCase();
  if (!lower.endsWith(".xml")) return false;
  if (filename === primaryDocument) return false;
  return lower.includes("info") || lower.includes("form13f") || lower.includes("13f") || lower.includes("primary_doc");
}

async function fetch13FXML(manager: InstitutionalManager, filing: RecentFiling): Promise<string | null> {
  const bareCik = manager.cik.replace(/^0+/, "");
  const accessionNoDash = filing.accession.replace(/-/g, "");
  const filenames = await fetchFilingIndex(manager, filing.accession);
  const candidates = [
    ...filenames.filter((name) => isLikelyInfoTableFile(name, filing.primaryDocument)),
    ...filenames.filter((name) => name.toLowerCase().endsWith(".xml") && name !== filing.primaryDocument),
  ];

  for (const filename of [...new Set(candidates)]) {
    const response = await secFetch(`${SEC_ARCHIVES}/${bareCik}/${accessionNoDash}/${filename}`);
    if (!response.ok) continue;
    const text = await response.text();
    if (/<[^>]*infoTable/i.test(text)) return text;
  }

  return null;
}

async function getParsedFiling(
  manager: InstitutionalManager,
  filing: RecentFiling,
  forceRefresh = false,
): Promise<InstitutionalFiling | null> {
  const cacheKey = getInstitutionalFilingCacheKey(manager.cik, filing.reportDate);
  const cached = filingCache.get(cacheKey);
  if (!forceRefresh && cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached.filing;
  }

  const xml = await fetch13FXML(manager, filing);
  if (!xml) return null;
  const parsed = parse13FInformationTable(
    xml,
    manager.cik,
    filing.accession,
    filing.filingDate,
    filing.reportDate,
  );
  filingCache.set(cacheKey, { filing: parsed, cachedAt: Date.now() });
  return parsed;
}

function isCommonShareHolding(holding: InstitutionalHolding): boolean {
  if (holding.putCall) return false;

  const title = holding.classTitle.toUpperCase();
  if (/\b(CALL|PUT|WARRANT|RIGHT|NOTE|UNIT|ETF)\b/.test(title)) return false;
  if (title.includes("W EXP") || title.includes("*W EXP")) return false;

  return true;
}

function securityKey(holding: InstitutionalHolding) {
  return `${holding.cusip}|${normalizeText(holding.classTitle)}|${normalizeText(holding.issuer)}`;
}

function combineSameSecurity(rows: InstitutionalHolding[]): HoldingMatch {
  if (rows.length === 0) return { holding: null, ambiguous: false };

  const securities = new Map<string, InstitutionalHolding[]>();
  for (const row of rows) {
    const key = securityKey(row);
    const existing = securities.get(key) ?? [];
    existing.push(row);
    securities.set(key, existing);
  }

  if (securities.size !== 1) return { holding: null, ambiguous: true };

  const grouped = [...securities.values()][0];
  const [first] = grouped;
  return {
    holding: {
      ...first,
      shares: grouped.reduce((sum, row) => sum + row.shares, 0),
      value: grouped.reduce((sum, row) => sum + row.value, 0),
    },
    ambiguous: false,
  };
}

function resolveCompanyHolding(filing: InstitutionalFiling | null, companyName: string): HoldingMatch {
  if (!filing) return { holding: null, ambiguous: false };
  const matches = filing.holdings.filter(
    (holding) => issuerMatchesCompany(holding.issuer, companyName) && isCommonShareHolding(holding),
  );
  return combineSameSecurity(matches);
}

export function findCompanyHolding(filing: InstitutionalFiling | null, companyName: string): InstitutionalHolding | null {
  return resolveCompanyHolding(filing, companyName).holding;
}

export function compareHoldings(
  manager: InstitutionalManager,
  latest: InstitutionalHolding | null,
  previous: InstitutionalHolding | null,
  latestFiling: InstitutionalFiling,
): InstitutionalAccumulation | null {
  if (!latest && !previous) return null;
  if (latest && previous && securityKey(latest) !== securityKey(previous)) return null;

  const shares = latest?.shares ?? 0;
  const previousShares = previous?.shares ?? 0;
  const shareChange = shares - previousShares;
  const percentageChange =
    previousShares > 0 ? Math.round((shareChange / previousShares) * 10000) / 100 : null;

  let status: AccumulationStatus = "Unchanged";
  if (previousShares === 0 && shares > 0) status = "New";
  else if (previousShares > 0 && shares === 0) status = "Exited";
  else if (shareChange > 0) status = "Increased";
  else if (shareChange < 0) status = "Reduced";

  return {
    manager: manager.manager,
    displayName: manager.displayName,
    cik: manager.cik,
    issuer: latest?.issuer ?? previous?.issuer ?? null,
    classTitle: latest?.classTitle ?? previous?.classTitle ?? null,
    cusip: latest?.cusip ?? previous?.cusip ?? null,
    shares,
    previousShares,
    shareChange,
    percentageChange,
    reportedValue: latest?.value ?? 0,
    filingQuarter: latestFiling.quarter,
    filingDate: latestFiling.filingDate,
    status,
  };
}

export async function getInstitutionalAccumulationForCompany(
  ticker: string,
  companyName: string,
  options: { forceRefresh?: boolean } = {},
): Promise<InstitutionalCompanyResult> {
  // Fetch all manager submissions in parallel.
  // The secFetch rate limiter (200ms delay) naturally serializes requests,
  // so Promise.all batches them without exceeding SEC's 10 req/s limit.
  const managerEntries = await Promise.all(
    INSTITUTIONAL_MANAGERS.map(async (manager) => {
      const filings = await fetchManagerSubmissions(manager);
      return { manager, filings };
    }),
  );

  const results: InstitutionalAccumulation[] = [];

  for (const { manager, filings } of managerEntries) {
    if (filings.length < 1) continue;

    // Fetch latest and previous filings in parallel per manager.
    // The secFetch rate limiter keeps us within SEC bounds.
    const [latest, previous] = await Promise.all([
      getParsedFiling(manager, filings[0], options.forceRefresh),
      filings[1] ? getParsedFiling(manager, filings[1], options.forceRefresh) : Promise.resolve(null),
    ]);
    if (!latest) continue;

    const latestMatch = resolveCompanyHolding(latest, companyName);
    const previousMatch = resolveCompanyHolding(previous, companyName);
    if (latestMatch.ambiguous || previousMatch.ambiguous) continue;

    const comparison = compareHoldings(manager, latestMatch.holding, previousMatch.holding, latest);
    if (comparison) results.push(comparison);
  }

  results.sort((a, b) => {
    const order: Record<AccumulationStatus, number> = { New: 0, Increased: 1, Unchanged: 2, Reduced: 3, Exited: 4 };
    return order[a.status] - order[b.status] || Math.abs(b.shareChange) - Math.abs(a.shareChange);
  });

  return {
    ticker,
    companyName,
    results,
    fetchedAt: new Date().toISOString(),
    source: "sec-13f",
  };
}

export function summarizeInstitutionalEvidence(results: InstitutionalAccumulation[]) {
  const newPositions = results.filter((result) => result.status === "New");
  const increased = results.filter((result) => result.status === "Increased");
  const reduced = results.filter((result) => result.status === "Reduced");
  const exited = results.filter((result) => result.status === "Exited");
  const aggregateShareChange = results.reduce((sum, result) => sum + result.shareChange, 0);

  return {
    newPositions,
    increased,
    reduced,
    exited,
    aggregateShareChange,
    positiveCount: newPositions.length + increased.length,
    negativeCount: reduced.length + exited.length,
  };
}
