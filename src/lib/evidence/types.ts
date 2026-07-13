// ── Core evidence types for CONVICTION ──

export type Ticker = string;

export interface CompanyProfile {
  ticker: Ticker;
  name: string;
  sector: string;
  description: string;
}

export type EvidenceDirection = "positive" | "negative" | "neutral";
export type EvidenceSource = "sec-edgar" | "market-price" | "usaspending";
export type EventType =
  | "insider-buy"
  | "insider-sell"
  | "institutional-buy"
  | "institutional-sell"
  | "federal-award"
  | "federal-contract"
  | "earnings"
  | "revenue-acceleration"
  | "estimate-revision"
  | "relative-strength"
  | "capacity-announcement"
  | "upcoming-catalyst";

export interface EvidenceEvent {
  id: string;
  ticker: Ticker;
  type: EventType;
  direction: EvidenceDirection;
  title: string;
  summary: string;
  source: EvidenceSource;
  sourceUrl: string;
  date: string; // ISO date
  disclosureDelay: number; // days
  size: number; // relative to company (0-1 normalized)
  strength: number; // 0-1
  isContradiction: boolean;
  aiExplanation: string;
}

export interface ReasonCode {
  code: string;
  label: string;
  positive: boolean;
  strength: number; // 0-1
}

export interface EmergingIdea {
  ticker: Ticker;
  name: string;
  sector: string;
  reasonCodes: ReasonCode[];
  topEvent: EvidenceEvent;
}

export type ThesisStatus = "active" | "validated" | "invalidated" | "expired";

export interface DecisionJournalEntry {
  id: string;
  ticker: Ticker;
  thesis: string;
  expectedCatalyst: string;
  timeHorizon: string;
  invalidationCondition: string;
  positionSize: string;
  risks: string;
  decisionDate: string;
  status: ThesisStatus;
  outcome?: string;
}

export interface CompanyState {
  ticker: Ticker;
  name: string;
  latestChange: string;
  implication: string;
  evidenceStrength: number;
  contradiction: string;
  nextCatalyst: string;
  newEventCount: number;
  events: EvidenceEvent[];
  journalEntries: DecisionJournalEntry[];
}