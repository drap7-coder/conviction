/**
 * Dashboard Conviction Score — shared composite
 * (institutional 45% + technicals 38% + short interest 17%).
 *
 * Until institutional + earnings inputs ship reliably, show a static
 * "coming soon" state instead of an indefinite LOADING spinner.
 */

"use client";

import { ConvictionScoreOverview } from "@/app/components/ConvictionScoreOverview";

const COMING_SOON =
  "Score requires institutional + earnings data (coming soon)";

export function ConvictionScoreOverviewCard({ ticker: _ticker }: { ticker: string }) {
  return (
    <ConvictionScoreOverview
      score={null}
      label="Awaiting"
      tone="neutral"
      detail={COMING_SOON}
      meta="SOON"
      unavailable
      className="dashboard-conviction-overview"
    />
  );
}
