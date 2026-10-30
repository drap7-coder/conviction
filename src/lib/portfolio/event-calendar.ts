import type { RiskFactorId } from "@/lib/portfolio/risk-xray";

export type PortfolioEventKind = "earnings" | "inflation" | "labor" | "fed";

export interface PortfolioEvent {
  id: string;
  kind: PortfolioEventKind;
  title: string;
  at: string;
  timing: string;
  ticker: string | null;
  sourceName: string;
  sourceUrl: string;
  relevantFactors: RiskFactorId[];
}

const FED_SOURCE = "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm";
const CPI_SOURCE = "https://www.bls.gov/schedule/news_release/cpi.htm";
const JOBS_SOURCE = "https://www.bls.gov/schedule/news_release/empsit.htm";
const BLS_SCHEDULE = "https://www.bls.gov/schedule/2026/";

const OFFICIAL_EVENTS: PortfolioEvent[] = [
  { id: "eci-2026-10-30", kind: "labor", title: "U.S. Employment Cost Index", at: "2026-10-30T08:30:00-04:00", timing: "8:30 AM ET", ticker: null, sourceName: "BLS schedule", sourceUrl: BLS_SCHEDULE, relevantFactors: ["economic-cycle", "growth-duration"] },
  { id: "jobs-2026-11-06", kind: "labor", title: "U.S. employment report", at: "2026-11-06T08:30:00-05:00", timing: "8:30 AM ET", ticker: null, sourceName: "BLS schedule", sourceUrl: JOBS_SOURCE, relevantFactors: ["economic-cycle", "growth-duration"] },
  { id: "cpi-2026-11-10", kind: "inflation", title: "U.S. Consumer Price Index", at: "2026-11-10T08:30:00-05:00", timing: "8:30 AM ET", ticker: null, sourceName: "BLS schedule", sourceUrl: CPI_SOURCE, relevantFactors: ["inflation", "growth-duration", "defensive"] },
  { id: "jobs-2026-12-04", kind: "labor", title: "U.S. employment report", at: "2026-12-04T08:30:00-05:00", timing: "8:30 AM ET", ticker: null, sourceName: "BLS schedule", sourceUrl: JOBS_SOURCE, relevantFactors: ["economic-cycle", "growth-duration"] },
  { id: "fomc-2026-12-09", kind: "fed", title: "FOMC rate decision", at: "2026-12-09T14:00:00-05:00", timing: "2:00 PM ET", ticker: null, sourceName: "Federal Reserve", sourceUrl: FED_SOURCE, relevantFactors: ["growth-duration", "defensive"] },
  { id: "cpi-2026-12-10", kind: "inflation", title: "U.S. Consumer Price Index", at: "2026-12-10T08:30:00-05:00", timing: "8:30 AM ET", ticker: null, sourceName: "BLS schedule", sourceUrl: CPI_SOURCE, relevantFactors: ["inflation", "growth-duration", "defensive"] },
  { id: "jobs-2027-01-08", kind: "labor", title: "U.S. employment report", at: "2027-01-08T08:30:00-05:00", timing: "8:30 AM ET", ticker: null, sourceName: "BLS schedule", sourceUrl: JOBS_SOURCE, relevantFactors: ["economic-cycle", "growth-duration"] },
  { id: "fomc-2027-01-27", kind: "fed", title: "FOMC rate decision", at: "2027-01-27T14:00:00-05:00", timing: "2:00 PM ET", ticker: null, sourceName: "Federal Reserve", sourceUrl: FED_SOURCE, relevantFactors: ["growth-duration", "defensive"] },
  { id: "jobs-2027-02-05", kind: "labor", title: "U.S. employment report", at: "2027-02-05T08:30:00-05:00", timing: "8:30 AM ET", ticker: null, sourceName: "BLS schedule", sourceUrl: JOBS_SOURCE, relevantFactors: ["economic-cycle", "growth-duration"] },
  { id: "jobs-2027-03-05", kind: "labor", title: "U.S. employment report", at: "2027-03-05T08:30:00-05:00", timing: "8:30 AM ET", ticker: null, sourceName: "BLS schedule", sourceUrl: JOBS_SOURCE, relevantFactors: ["economic-cycle", "growth-duration"] },
  { id: "fomc-2027-03-17", kind: "fed", title: "FOMC rate decision", at: "2027-03-17T14:00:00-04:00", timing: "2:00 PM ET", ticker: null, sourceName: "Federal Reserve", sourceUrl: FED_SOURCE, relevantFactors: ["growth-duration", "defensive"] },
  { id: "fomc-2027-04-28", kind: "fed", title: "FOMC rate decision", at: "2027-04-28T14:00:00-04:00", timing: "2:00 PM ET", ticker: null, sourceName: "Federal Reserve", sourceUrl: FED_SOURCE, relevantFactors: ["growth-duration", "defensive"] },
  { id: "fomc-2027-06-09", kind: "fed", title: "FOMC rate decision", at: "2027-06-09T14:00:00-04:00", timing: "2:00 PM ET", ticker: null, sourceName: "Federal Reserve", sourceUrl: FED_SOURCE, relevantFactors: ["growth-duration", "defensive"] },
  { id: "fomc-2027-07-28", kind: "fed", title: "FOMC rate decision", at: "2027-07-28T14:00:00-04:00", timing: "2:00 PM ET", ticker: null, sourceName: "Federal Reserve", sourceUrl: FED_SOURCE, relevantFactors: ["growth-duration", "defensive"] },
  { id: "fomc-2027-09-15", kind: "fed", title: "FOMC rate decision", at: "2027-09-15T14:00:00-04:00", timing: "2:00 PM ET", ticker: null, sourceName: "Federal Reserve", sourceUrl: FED_SOURCE, relevantFactors: ["growth-duration", "defensive"] },
  { id: "fomc-2027-10-27", kind: "fed", title: "FOMC rate decision", at: "2027-10-27T14:00:00-04:00", timing: "2:00 PM ET", ticker: null, sourceName: "Federal Reserve", sourceUrl: FED_SOURCE, relevantFactors: ["growth-duration", "defensive"] },
  { id: "fomc-2027-12-08", kind: "fed", title: "FOMC rate decision", at: "2027-12-08T14:00:00-05:00", timing: "2:00 PM ET", ticker: null, sourceName: "Federal Reserve", sourceUrl: FED_SOURCE, relevantFactors: ["growth-duration", "defensive"] },
];

export function upcomingOfficialEvents(now = new Date(), limit = 6): PortfolioEvent[] {
  return OFFICIAL_EVENTS
    .filter((event) => Date.parse(event.at) >= now.getTime())
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
    .slice(0, limit);
}

type NasdaqRow = { symbol?: unknown; name?: unknown; time?: unknown };

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function dateWindow(start: Date, days: number): string[] {
  return Array.from({ length: days + 1 }, (_, offset) => {
    const next = new Date(start);
    next.setUTCDate(next.getUTCDate() + offset);
    return isoDate(next);
  });
}

export function normalizeNasdaqEarnings(rows: NasdaqRow[], date: string): PortfolioEvent[] {
  return rows.flatMap((row) => {
    const ticker = typeof row.symbol === "string" ? row.symbol.trim().toUpperCase() : "";
    if (!ticker) return [];
    const timing = row.time === "time-pre-market" ? "Before open" : row.time === "time-after-hours" ? "After close" : "Time not supplied";
    return [{
      id: `earnings-${ticker}-${date}`,
      kind: "earnings" as const,
      title: `${ticker} earnings`,
      // Nasdaq supplies a session label, not a guaranteed timestamp. Noon UTC
      // preserves the calendar date without manufacturing an exact report time.
      at: `${date}T12:00:00Z`,
      timing,
      ticker,
      sourceName: "Nasdaq earnings calendar",
      sourceUrl: `https://www.nasdaq.com/market-activity/stocks/${encodeURIComponent(ticker.toLowerCase())}/earnings`,
      relevantFactors: [],
    }];
  });
}

export async function fetchNasdaqEarningsDate(date: string): Promise<PortfolioEvent[]> {
  const response = await fetch(`https://api.nasdaq.com/api/calendar/earnings?date=${encodeURIComponent(date)}`, {
    headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (compatible; IQBulls/1.0)" },
    next: { revalidate: 43_200 },
    signal: AbortSignal.timeout(6_000),
  });
  if (!response.ok) throw new Error(`Nasdaq calendar ${response.status}`);
  const payload = await response.json() as { data?: { rows?: NasdaqRow[] | null } | null };
  return normalizeNasdaqEarnings(payload.data?.rows ?? [], date);
}

export async function fetchEarningsWindow(start: Date, days = 10): Promise<{ events: PortfolioEvent[]; complete: boolean; through: string }> {
  const dates = dateWindow(start, days);
  const events: PortfolioEvent[] = [];
  let complete = true;
  for (let index = 0; index < dates.length; index += 2) {
    const batch = dates.slice(index, index + 2);
    const results = await Promise.all(batch.map(async (date) => {
      try { return await fetchNasdaqEarningsDate(date); }
      catch { complete = false; return []; }
    }));
    for (const result of results) events.push(...result);
  }
  return { events, complete, through: dates.at(-1) ?? isoDate(start) };
}
