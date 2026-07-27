/**
 * ── Building Conviction Now ──
 *
 * Pure helper that assembles a short public feed of current evidence examples.
 * Uses curated signal summaries and material move events only — no network.
 */

import { getSectorForCompany } from "@/lib/market/industries";
import {
  EVIDENCE_STRENGTH_LABEL,
  SOURCE_BADGE_LABEL,
  type EvidenceStrength,
} from "@/lib/display/vocabulary";
import { TICKER_SIGNAL_SUMMARIES, type TickerSignalSummary } from "./signal-summaries";
import { listMaterialMoveEvents, type MoveEvent } from "./move-events";

export interface BuildingConvictionItem {
  id: string;
  href: string;
  subject: string;
  subjectKind: "company" | "sector";
  ticker: string | null;
  conclusion: string;
  evidence: string;
  whyItMatters: string;
  dateLabel: string;
  sourceLabel: string;
  strength: EvidenceStrength;
}

const COMPANY_NAMES: Record<string, string> = {
  INTC: "Intel Corporation",
  GOOG: "Alphabet Inc.",
  OXY: "Occidental Petroleum",
  PFE: "Pfizer Inc.",
  NBIS: "Nebius Group",
  IBM: "International Business Machines",
  APLD: "Applied Digital",
};

const FILING_PERIOD_LABEL = "Q2 2026 filings";

function signalStrength(signal: TickerSignalSummary): EvidenceStrength {
  if (signal.direction === "pos") return "strong";
  if (signal.direction === "neg") return "weak";
  return "mixed";
}

function formatShortDate(value: string): string {
  const d = new Date(`${value}T12:00:00`);
  if (!Number.isFinite(d.getTime())) return value;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function whyForSignal(signal: TickerSignalSummary, sectorName: string | null): string {
  const count = signal.supportCount ?? 0;
  if (count >= 3) {
    return sectorName
      ? `Several large funds are adding; ${signal.ticker} leads ${sectorName} among names we track.`
      : "Several large funds opening or adding positions is a clearer ownership signal than a single increase.";
  }
  if (count === 2) {
    return "Two independent funds moving the same way is stronger than a one-off trade.";
  }
  return sectorName
    ? `${signal.ticker} currently has the clearest ownership signal in ${sectorName}.`
    : "A large fund increased its stake — useful context, but confirm with more evidence before deciding.";
}

function itemFromSignal(signal: TickerSignalSummary): BuildingConvictionItem {
  const strength = signalStrength(signal);
  const sector = getSectorForCompany(signal.ticker);
  const companyName = COMPANY_NAMES[signal.ticker] ?? signal.ticker;
  const strengthWord = EVIDENCE_STRENGTH_LABEL[strength].toLowerCase();

  const conclusion =
    strength === "strong"
      ? "Big funds have been buying"
      : strength === "weak"
        ? "Ownership looks soft"
        : `Ownership looks ${strengthWord}`;

  return {
    id: `signal-${signal.ticker}`,
    href: `/companies/${signal.ticker}`,
    subject: `${signal.ticker} · ${companyName}`,
    subjectKind: "company",
    ticker: signal.ticker,
    conclusion,
    evidence: signal.cardText.replace(/\.$/, ""),
    whyItMatters: whyForSignal(signal, sector?.name ?? null),
    dateLabel: FILING_PERIOD_LABEL,
    sourceLabel: SOURCE_BADGE_LABEL.sec_filing,
    strength,
  };
}

function itemFromMoveEvent(event: MoveEvent): BuildingConvictionItem {
  const strength: EvidenceStrength =
    event.category === "earnings-warning" ? "weak" : event.confidence === "high" ? "mixed" : "weak";

  const conclusion =
    event.category === "earnings-warning"
      ? "Earnings outlook looks weak"
      : event.category === "earnings"
        ? "Earnings news that could move the stock"
        : "Company-specific risk is rising";

  return {
    id: `move-${event.ticker}`,
    href: `/companies/${event.ticker}`,
    subject: `${event.ticker} · ${event.companyName}`,
    subjectKind: "company",
    ticker: event.ticker,
    conclusion,
    evidence: event.headline.replace(/\.$/, ""),
    whyItMatters: event.convictionQuestion,
    dateLabel: formatShortDate(event.date),
    sourceLabel: SOURCE_BADGE_LABEL.material_news,
    strength,
  };
}

/**
 * Build a sector rollup when at least one strong positive signal exists in a sector.
 * Keeps the example honest to available evidence — no invented manager counts.
 */
function sectorRollupFromSignals(signals: TickerSignalSummary[]): BuildingConvictionItem | null {
  const positive = signals.filter((s) => s.direction === "pos");
  if (positive.length === 0) return null;

  // Prefer Energy when OXY is present (matches the product example pattern).
  const bySector = new Map<string, TickerSignalSummary[]>();
  for (const signal of positive) {
    const sector = getSectorForCompany(signal.ticker);
    if (!sector) continue;
    const list = bySector.get(sector.ticker) ?? [];
    list.push(signal);
    bySector.set(sector.ticker, list);
  }

  const preferred =
    bySector.get("XLE") ??
    [...bySector.values()].sort((a, b) => b.length - a.length)[0];
  if (!preferred || preferred.length === 0) return null;

  const lead = [...preferred].sort(
    (a, b) => (b.supportCount ?? 0) - (a.supportCount ?? 0) || a.ticker.localeCompare(b.ticker),
  )[0];
  const sector = getSectorForCompany(lead.ticker);
  if (!sector) return null;

  const managerCount = preferred.reduce((sum, s) => sum + (s.supportCount ?? 0), 0);

  return {
    id: `sector-${sector.ticker}`,
    href: `/industries/${sector.ticker}`,
    subject: sector.name,
    subjectKind: "sector",
    ticker: sector.ticker,
    conclusion: `Big funds are active in ${sector.name}`,
    evidence:
      managerCount > 1
        ? `${managerCount} fund increases across ${preferred.map((s) => s.ticker).join(", ")}; ${lead.ticker} looks strongest.`
        : `${lead.ticker} shows the clearest fund increase in ${sector.name}.`,
    whyItMatters:
      "Sector-wide buying helps tell whether one stock’s move is unique or part of a broader shift.",
    dateLabel: FILING_PERIOD_LABEL,
    sourceLabel: SOURCE_BADGE_LABEL.sec_filing,
    strength: "strong",
  };
}

/**
 * Return up to `limit` public examples for the homepage module.
 * Deterministic ordering: sector rollup → strongest ownership signals → material news.
 */
export function getBuildingConvictionItems(limit = 5): BuildingConvictionItem[] {
  const capped = Math.max(3, Math.min(limit, 5));
  const items: BuildingConvictionItem[] = [];
  const usedTickers = new Set<string>();

  const sectorItem = sectorRollupFromSignals(TICKER_SIGNAL_SUMMARIES);
  if (sectorItem) {
    items.push(sectorItem);
    // Don't suppress company items from that sector — company detail is still useful.
  }

  const rankedSignals = [...TICKER_SIGNAL_SUMMARIES].sort(
    (a, b) =>
      (b.supportCount ?? 0) - (a.supportCount ?? 0) ||
      (b.strength ?? 0) - (a.strength ?? 0) ||
      a.ticker.localeCompare(b.ticker),
  );

  for (const signal of rankedSignals) {
    if (items.length >= capped) break;
    if (usedTickers.has(signal.ticker)) continue;
    items.push(itemFromSignal(signal));
    usedTickers.add(signal.ticker);
  }

  for (const event of listMaterialMoveEvents()) {
    if (items.length >= capped) break;
    if (usedTickers.has(event.ticker)) continue;
    items.push(itemFromMoveEvent(event));
    usedTickers.add(event.ticker);
  }

  return items.slice(0, capped);
}
