/**
 * ── Shared Product Vocabulary ──
 *
 * One system, used everywhere. Do not invent screen-specific status labels.
 *
 * Evidence strength  → how strong the available evidence is
 * Thesis status      → the user's manual thesis state
 * User priority      → whether the item needs action
 * Source badge       → where the evidence came from
 */

// ── Evidence strength ──

export type EvidenceStrength = "strong" | "mixed" | "weak" | "awaiting";

export const EVIDENCE_STRENGTH_LABEL: Record<EvidenceStrength, string> = {
  strong: "Strong",
  mixed: "Mixed",
  weak: "Weak",
  awaiting: "Awaiting Evidence",
};

export type EvidenceStrengthTone = "positive" | "negative" | "contested" | "quiet";

export const EVIDENCE_STRENGTH_TONE: Record<EvidenceStrength, EvidenceStrengthTone> = {
  strong: "positive",
  mixed: "contested",
  weak: "negative",
  awaiting: "quiet",
};

// ── Thesis status ──

export type ThesisStatusVocab =
  | "building"
  | "supported"
  | "review"
  | "weakening"
  | "broken";

export const THESIS_STATUS_LABEL: Record<ThesisStatusVocab, string> = {
  building: "Building",
  supported: "Supported",
  review: "Review",
  weakening: "Weakening",
  broken: "Broken",
};

// ── User priority ──

export type UserPriority = "needs_attention" | "changed" | "no_action";

export const USER_PRIORITY_LABEL: Record<UserPriority, string> = {
  needs_attention: "Needs Attention",
  changed: "Changed",
  no_action: "No Action",
};

// ── Source badges ──

export type SourceBadge =
  | "sec_filing"
  | "company_filing"
  | "congressional"
  | "market_data"
  | "material_news";

export const SOURCE_BADGE_LABEL: Record<SourceBadge, string> = {
  sec_filing: "SEC Filing",
  company_filing: "Company Filing",
  congressional: "Congressional Disclosure",
  market_data: "Market Data",
  material_news: "Material News",
};

/**
 * Map a provider string from evidence pipelines to a source badge label.
 * Falls back to the original string when no known mapping exists.
 */
export function sourceBadgeLabel(provider: string): string {
  const key = provider.trim().toLowerCase();
  if (key.includes("13f") || key.includes("sec edgar") || key === "sec evidence" || key.includes("form 4") || key.includes("8-k")) {
    return SOURCE_BADGE_LABEL.sec_filing;
  }
  if (key.includes("stock act") || key.includes("congress") || key.includes("political")) {
    return SOURCE_BADGE_LABEL.congressional;
  }
  if (key.includes("rss") || key.includes("news") || key.includes("publisher") || key.includes("yahoo")) {
    return SOURCE_BADGE_LABEL.material_news;
  }
  if (key.includes("finra") || key.includes("quote") || key.includes("market")) {
    return SOURCE_BADGE_LABEL.market_data;
  }
  if (key.includes("company") || key.includes("ir ")) {
    return SOURCE_BADGE_LABEL.company_filing;
  }
  return provider;
}

/**
 * Derive evidence strength from simple support/contra counts.
 * Used by lightweight card aggregators that do not yet build a full snapshot.
 */
export function evidenceStrengthFromCounts(support: number, contra: number): EvidenceStrength {
  if (support > 0 && contra > 0) return "mixed";
  if (support > contra) return "strong";
  if (contra > support) return "weak";
  return "awaiting";
}
