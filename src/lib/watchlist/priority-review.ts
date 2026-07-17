import type { WatchlistEntry, ThesisStatus, WatchlistThesis } from "./types";

/**
 * Priority review item returned by getPriorityReviewItems
 */
export interface PriorityReviewItem {
  ticker: string;
  companyName: string;
  thesis: string;
  status: ThesisStatus;
  reviewAt: string | null;
  reason: string;
}

/**
 * Status ranking for priority review ordering.
 * Lower number = higher priority.
 */
const STATUS_PRIORITY: Record<ThesisStatus, number> = {
  broken: 1,
  weakening: 2,
  review: 3,
  supported: 4,
  building: 5,
};

/**
 * Get priority review items from watchlist entries.
 *
 * Returns entries where:
 * - status === "review" || "weakening" || "broken" ||
 * - reviewAt <= now
 *
 * Returns at most 3 items, ranked by:
 * 1. broken status
 * 2. weakening status
 * 3. review status
 * 4. most overdue review date
 *
 * Within the same category, places most overdue first.
 */
export function getPriorityReviewItems(
  entries: WatchlistEntry[],
  now: Date = new Date(),
): PriorityReviewItem[] {
  const nowStr = now.toISOString();

  // Filter to entries that need review
  const candidates = entries.filter((entry) => {
    const thesis = entry.thesis;
    if (!thesis) return false;

    const { status, reviewAt } = thesis;

    // Check if status requires review
    if (status === "broken" || status === "weakening" || status === "review") {
      return true;
    }

    // Check if review is overdue
    if (reviewAt && reviewAt <= nowStr) {
      return true;
    }

    return false;
  });

  // Map to priority items with reasons
  const items = candidates.map((entry) => {
    const thesis = entry.thesis!;
    const reason = getReviewReason(thesis, now);
    return {
      ticker: entry.ticker,
      companyName: entry.companyName,
      thesis: thesis.thesis,
      status: thesis.status,
      reviewAt: thesis.reviewAt,
      reason,
    };
  });

  // Sort by status priority, then by overdue days (most overdue first)
  items.sort((a, b) => {
    const statusDiff = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
    if (statusDiff !== 0) return statusDiff;

    // Same status - compare overdue days
    const overdueA = a.reviewAt ? daysOverdue(a.reviewAt, now) : 0;
    const overdueB = b.reviewAt ? daysOverdue(b.reviewAt, now) : 0;

    return overdueB - overdueA; // Most overdue first
  });

  return items.slice(0, 3);
}

/**
 * Generate a deterministic review reason for an item.
 */
function getReviewReason(thesis: WatchlistThesis, now: Date): string {
  if (thesis.status === "broken") {
    return "Thesis marked broken";
  }
  if (thesis.status === "weakening") {
    return "Thesis is weakening";
  }
  if (thesis.status === "review") {
    return "Manual review requested";
  }
  if (thesis.reviewAt) {
    const overdue = daysOverdue(thesis.reviewAt, now);
    if (overdue > 0) {
      return `Review overdue by ${overdue} day${overdue > 1 ? "s" : ""}`;
    }
  }
  return "Review due";
}

/**
 * Calculate days overdue for a review date.
 */
function daysOverdue(reviewAt: string, now: Date): number {
  const reviewDate = new Date(reviewAt);
  const diffMs = now.getTime() - reviewDate.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Get default thesis object for backward compatibility.
 */
export function getDefaultThesis(): WatchlistThesis {
  return {
    thesis: "",
    invalidation: "",
    reviewAt: null,
    status: "building",
  };
}

/**
 * Ensure an entry has thesis fields with defaults for backward compatibility.
 */
export function normalizeEntryForThesis(entry: WatchlistEntry): WatchlistEntry {
  if (entry.thesis) {
    return entry;
  }
  return {
    ...entry,
    thesis: getDefaultThesis(),
  };
}