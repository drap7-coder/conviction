import type { CorporateDisclosure } from "./corporate-disclosures";

export interface CorporateEventActivitySummary {
  recentLeadershipCount: number;
  recentAcquisitionCount: number;
  latestEventDate: string | null;
  hasRecentLeadershipCluster: boolean;
  hasRecentActivity: boolean;
  copy: string;
}

function daysBetweenDates(fromDate: string, toDate: Date) {
  const from = new Date(`${fromDate}T12:00:00`).getTime();
  const to = new Date(toDate);
  to.setHours(12, 0, 0, 0);
  if (!Number.isFinite(from) || !Number.isFinite(to.getTime())) return Number.POSITIVE_INFINITY;
  return Math.floor((to.getTime() - from) / (24 * 60 * 60 * 1000));
}

export function summarizeCorporateEventActivity(
  events: CorporateDisclosure[],
  now = new Date(),
): CorporateEventActivitySummary {
  const recentEvents = events.filter((event) => daysBetweenDates(event.filingDate, now) <= 90);
  const recentLeadershipCount = recentEvents.filter((event) => event.kind === "leadership-change").length;
  const recentAcquisitionCount = recentEvents.filter((event) => event.kind === "acquisition-completed").length;
  const latestEventDate = recentEvents
    .map((event) => event.filingDate)
    .sort((a, b) => b.localeCompare(a))[0] ?? null;
  const hasRecentLeadershipCluster = recentLeadershipCount >= 2;
  const hasRecentActivity = recentLeadershipCount > 0 || recentAcquisitionCount > 0;

  let copy = "No recent leadership or acquisition 8-K events.";
  if (hasRecentLeadershipCluster) {
    copy = `${recentLeadershipCount} leadership-change 8-K filings in the last 90 days.`;
  } else if (recentLeadershipCount === 1) {
    copy = "1 leadership-change 8-K filing in the last 90 days.";
  } else if (recentAcquisitionCount > 0) {
    copy = `${recentAcquisitionCount} acquisition 8-K filing${recentAcquisitionCount === 1 ? "" : "s"} in the last 90 days.`;
  }

  return {
    recentLeadershipCount,
    recentAcquisitionCount,
    latestEventDate,
    hasRecentLeadershipCluster,
    hasRecentActivity,
    copy,
  };
}
