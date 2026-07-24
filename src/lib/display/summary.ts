/**
 * ── Evidence Summary Engine ──
 *
 * Pure, deterministic utility that selects the single best evidence summary
 * for a security card, plus at most two supporting facts.
 *
 * Consumes canonical types (ConvictionSnapshot, WatchlistThesis,
 * PortfolioContext) and returns Display types.
 *
 * Priority order for the summary headline:
 *  1. Broken thesis
 *  2. Weakening thesis
 *  3. Material negative portfolio contribution
 *  4. Material positive portfolio contribution
 *  5. Institutional accumulation or reduction
 *  6. Earnings or guidance
 *  7. Material news
 *  8. Political activity
 *  9. Insider open-market activity
 *  10. Technical state
 *  11. Factual no-change fallback
 *
 * Rules:
 *  - Do not fabricate causality.
 *  - Use "coincides with", "followed", or "occurred alongside" when
 *    causation is uncertain.
 *  - Keep the headline concise (≤ 2 lines).
 *  - Do not use LLM or external AI.
 *  - Deterministic and independently testable.
 */

import type { ConvictionSnapshot } from "@/lib/conviction/canonical-types";
import type { WatchlistThesis } from "@/lib/watchlist/types";
import type { PortfolioContext } from "./types";
import type { SecurityCardSummary, SecurityCardFact } from "./types";
import type { FactCategory, SummaryCategory } from "./types";
import { isFiniteNumber } from "./format";

// ── Internal helpers ──

function thesisIsBroken(s: string | undefined): boolean {
  return s === "broken";
}
function thesisIsWeakening(s: string | undefined): boolean {
  return s === "weakening";
}
function thesisWarrantsReview(s: string | undefined): boolean {
  return s === "review" || s === "weakening" || s === "broken";
}

// ── Public: Select the single best evidence summary ──

export function selectSummary(
  snapshot: ConvictionSnapshot | null,
  thesis: { status: string | null; reviewAt: string | null } | null,
  portfolio: PortfolioContext | null,
  newsHeadlines?: { headline: string; date: string }[],
): SecurityCardSummary {
  const evidence = snapshot?.evidence ?? null;
  const signals = evidence?.signals ?? null;

  // 1. Broken thesis
  if (thesis?.status && thesisIsBroken(thesis.status)) {
    return {
      headline: "Thesis no longer valid — review required.",
      category: "thesis",
      significance: "high",
      updatedAt: thesis.reviewAt ?? null,
    };
  }

  // 2. Weakening thesis
  if (thesis?.status && thesisIsWeakening(thesis.status)) {
    return {
      headline: "Thesis showing signs of weakness — monitor closely.",
      category: "thesis",
      significance: "high",
      updatedAt: thesis.reviewAt ?? null,
    };
  }

  // 3. Material negative portfolio contribution
  if (portfolio?.isHeld && isFiniteNumber(portfolio.dayContributionAmount)) {
    const abs = Math.abs(portfolio.dayContributionAmount!);
    if (abs >= 500 && portfolio.dayContributionAmount! < 0) {
      return {
        headline: `Detracting −$${abs.toFixed(0)} from portfolio today.`,
        category: "portfolio",
        significance: "high",
        updatedAt: null,
      };
    }
  }

  // 4. Material positive portfolio contribution
  if (portfolio?.isHeld && isFiniteNumber(portfolio.dayContributionAmount)) {
    const abs = Math.abs(portfolio.dayContributionAmount!);
    if (abs >= 500 && portfolio.dayContributionAmount! > 0) {
      return {
        headline: `Contributing +$${abs.toFixed(0)} to portfolio today.`,
        category: "portfolio",
        significance: "high",
        updatedAt: null,
      };
    }
  }

  // 5. Institutional activity
  if (signals?.institutional) {
    const inst = signals.institutional;
    if (
      inst.sentiment === "positive" ||
      inst.sentiment === "strong_positive"
    ) {
      // Build a concise institutional summary from evidence references
      const refs = inst.evidenceFor ?? [];
      const managerNames = refs
        .map((r) => {
          const m = r.summary.match(/^(\S+(?:\s+\S+){0,2})/);
          return m ? m[1] : null;
        })
        .filter(Boolean) as string[];
      const unique = [...new Set(managerNames)];
      const count = inst.evidenceFor.length;
      const countLabel =
        count > 1
          ? `${count} tracked filer${count > 1 ? "s" : ""}`
          : unique[0] ?? "A tracked filer";
      return {
        headline: `${countLabel} ${count > 1 ? "added to" : "added to"} position${count > 1 ? "s" : ""}.`,
        category: "institutional",
        significance: inst.sentiment === "strong_positive" ? "high" : "medium",
        updatedAt: inst.updatedAt,
        sourceCount: count,
      };
    }
    if (
      inst.sentiment === "negative" ||
      inst.sentiment === "strong_negative"
    ) {
      const count = inst.evidenceAgainst.length;
      if (count > 0) {
        return {
          headline: `${count} tracked filer${count > 1 ? "s" : ""} reduced position${count > 1 ? "s" : ""}.`,
          category: "institutional",
          significance:
            inst.sentiment === "strong_negative" ? "high" : "medium",
          updatedAt: inst.updatedAt,
          sourceCount: count,
        };
      }
    }
  }

  // 6. Earnings or guidance
  if (signals?.earnings) {
    const earn = signals.earnings;
    if (
      earn.sentiment === "positive" ||
      earn.sentiment === "strong_positive"
    ) {
      return {
        headline: "Earnings or guidance exceeded expectations.",
        category: "earnings",
        significance: "medium",
        updatedAt: earn.updatedAt,
      };
    }
    if (
      earn.sentiment === "negative" ||
      earn.sentiment === "strong_negative"
    ) {
      return {
        headline: "Earnings or guidance fell short of expectations.",
        category: "earnings",
        significance: "medium",
        updatedAt: earn.updatedAt,
      };
    }
  }

  // 7. Material news
  if (newsHeadlines && newsHeadlines.length > 0) {
    const recentNews = newsHeadlines
      .filter((n) => n.headline)
      .sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );
    if (recentNews.length > 0) {
      const latest = recentNews[0];
      // Check if the headline suggests material events
      const materialIndicators =
        /guidance|raised|upgrad|downgrad|beat|miss|acquisit|merger|approv|denied|launch|recall|settlement|investigation|dividend|buyback|ceo|cfo|resign|appoint/i;
      if (materialIndicators.test(latest.headline)) {
        const truncated =
          latest.headline.length > 90
            ? latest.headline.slice(0, 87) + "..."
            : latest.headline;
        return {
          headline: truncated,
          category: "news",
          significance: "medium",
          updatedAt: latest.date,
        };
      }
    }
  }

  // 8. Political activity
  if (signals?.political) {
    const pol = signals.political;
    if (pol.evidenceFor.length > 0) {
      const count = pol.evidenceFor.length;
      return {
        headline: `${count} politician trade${count > 1 ? "s" : ""} filed.`,
        category: "political",
        significance: "low",
        updatedAt: pol.updatedAt,
        sourceCount: count,
      };
    }
  }

  // 9. Insider open-market activity
  if (signals?.insider) {
    const ins = signals.insider;
    const buys = (ins.evidenceFor ?? []).filter(
      (e) => e.type === "insider" || e.direction === "positive",
    );
    if (buys.length > 0) {
      return {
        headline: `${buys.length} insider purchase${buys.length > 1 ? "s" : ""} filed.`,
        category: "insider",
        significance: "low",
        updatedAt: ins.updatedAt,
      };
    }
  }

  // 10. Technical state
  if (snapshot?.technical) {
    const tech = snapshot.technical;
    if (tech.state === "strong" || tech.state === "improving") {
      return {
        headline: tech.summary || "Price momentum improving.",
        category: "technical",
        significance: "low",
        updatedAt: tech.updatedAt,
      };
    }
    if (tech.state === "weakening" || tech.state === "weak") {
      return {
        headline: tech.summary || "Price momentum deteriorating.",
        category: "technical",
        significance: "low",
        updatedAt: tech.updatedAt,
      };
    }
  }

  // 11. Fallback
  return {
    headline: "No material evidence change detected.",
    category: "none",
    significance: "low",
    updatedAt: null,
  };
}

// ── Public: Select at most two supporting facts ──

export function selectSupportingFacts(
  snapshot: ConvictionSnapshot | null,
  thesis: { status: string | null; reviewAt: string | null; thesis?: string } | null,
  portfolio: PortfolioContext | null,
): SecurityCardFact[] {
  const facts: SecurityCardFact[] = [];
  const evidence = snapshot?.evidence ?? null;
  const signals = evidence?.signals ?? null;
  const tech = snapshot?.technical ?? null;
  const usedCategories = new Set<string>();

  function add(
    id: string,
    label: string,
    category: FactCategory,
    significance: "high" | "medium" | "low",
    href?: string,
  ): boolean {
    if (facts.length >= 2) return false;
    if (usedCategories.has(category) && significance !== "high") return false;
    facts.push({ id, label, category, significance, href });
    usedCategories.add(category);
    return true;
  }

  // Priority 1: Thesis risk
  if (
    thesis?.status &&
    thesisWarrantsReview(thesis.status) &&
    thesis.thesis
  ) {
    const statusLabel =
      thesis.status === "broken"
        ? "Thesis broken"
        : thesis.status === "weakening"
          ? "Thesis weakening"
          : "Thesis overdue for review";
    add("thesis-risk", statusLabel, "thesis", "high");
  }

  // Priority 2: Portfolio risk
  if (portfolio?.isHeld && isFiniteNumber(portfolio.weightPercent)) {
    const w = portfolio.weightPercent!;
    if (w > 20) {
      add("portfolio-weight", `${Math.round(w)}% of portfolio`, "portfolio", "high");
    } else if (w > 10) {
      add("portfolio-weight", `${Math.round(w)}% of portfolio`, "portfolio", "medium");
    }
  }

  if (
    portfolio?.isHeld &&
    isFiniteNumber(portfolio.dayContributionAmount) &&
    Math.abs(portfolio.dayContributionAmount!) >= 200
  ) {
    const abs = Math.abs(portfolio.dayContributionAmount!);
    add(
      "portfolio-day",
      portfolio.dayContributionAmount! >= 0
        ? `+${abs.toFixed(0)} today`
        : `−${abs.toFixed(0)} today`,
      "portfolio",
      "medium",
    );
  }

  // Priority 3: Institutional activity
  if (signals?.institutional) {
    const inst = signals.institutional;
    const forCount = inst.evidenceFor.length;
    const againstCount = inst.evidenceAgainst.length;
    if (forCount > 1 && inst.sentiment !== "neutral") {
      add(
        "institutional-for",
        `13F: ${forCount} tracked filers added`,
        "institutional",
        forCount > 3 ? "high" : "medium",
      );
    }
    if (againstCount > 1 && inst.sentiment !== "neutral") {
      add(
        "institutional-against",
        `13F: ${againstCount} tracked filers reduced`,
        "institutional",
        againstCount > 3 ? "high" : "medium",
      );
    }
  }

  // Priority 4: Earnings or guidance
  if (signals?.earnings && signals.earnings.sentiment !== "neutral" && signals.earnings.sentiment !== "unknown") {
    const earn = signals.earnings;
    if (earn.evidenceFor.length > 0) {
      const ref = earn.evidenceFor[0];
      add(
        "earnings",
        ref.summary.length > 50 ? ref.summary.slice(0, 47) + "..." : ref.summary,
        "earnings",
        "medium",
      );
    }
  }

  // Priority 5: News (use headline list if available, not here — this is lightweight)

  // Priority 6: Political
  if (signals?.political && signals.political.evidenceFor.length > 0) {
    add(
      "political",
      `${signals.political.evidenceFor.length} politician trade${signals.political.evidenceFor.length > 1 ? "s" : ""} filed`,
      "political",
      "low",
    );
  }

  // Priority 7: Insider
  if (signals?.insider) {
    const buys = (signals.insider.evidenceFor ?? []).filter(
      (e) => e.direction === "positive",
    );
    const sells = (signals.insider.evidenceAgainst ?? []).filter(
      (e) => e.direction === "negative",
    );
    if (buys.length > 0) {
      add("insider-buy", `${buys.length} insider open-market purchase${buys.length > 1 ? "s" : ""}`, "insider", "low");
    } else if (sells.length > 0) {
      add("insider-sell", `${sells.length} insider open-market sale${sells.length > 1 ? "s" : ""}`, "insider", "low");
    }
  }

  // Priority 8: Technical
  if (tech) {
    if (tech.state === "strong") {
      add("tech-strong", "Price above key moving averages", "technical", "low");
    } else if (tech.state === "weak") {
      add("tech-weak", "Price below key moving averages", "technical", "low");
    } else if (tech.state === "weakening") {
      add("tech-weakening", "Price momentum deteriorating", "technical", "low");
    }
  }

  return facts;
}
