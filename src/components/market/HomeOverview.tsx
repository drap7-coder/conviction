"use client";

import {
  PulseTodaysBrief,
  usePulseHomeNews,
} from "@/components/market/PulseTodaysBrief";
import { PulseMarketBoard } from "@/components/market/PulseMarketBoard";
import { PulseWorthUnderstanding } from "@/components/market/PulseWorthUnderstanding";
import { PulseYourStocks } from "@/components/market/PulseYourStocks";

/**
 * IQBulls Home overview — what matters today, what matters to me, where next.
 * Full Markets / Movers / Crypto / Intl depth lives on /pulse.
 */
export function HomeOverview() {
  const homeNews = usePulseHomeNews();

  return (
    <div className="pulse-dashboard pulse-home home-overview">
      <PulseTodaysBrief
        status={homeNews.status}
        fetchedAt={homeNews.fetchedAt}
        stories={homeNews.todaysBrief}
      />

      <PulseMarketBoard variant="home" />

      <PulseYourStocks />

      <PulseWorthUnderstanding
        theme={homeNews.worthUnderstanding}
        status={homeNews.status}
      />
    </div>
  );
}
