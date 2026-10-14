import { HomeOverview } from "@/components/market/HomeOverview";

/**
 * IQBulls Home — public market telemetry (regime, indexes, commodities, sectors).
 * Personal holdings and the daily brief live on Portfolio → Watchlist.
 * Full Markets / Movers / Crypto / Intl stays on /pulse.
 */
export default function HomePage() {
  return (
    <main className="markets-page pulse-page home-page">
      <h1 className="sr-only">IQBulls: Market telemetry and cross-asset tape.</h1>
      <HomeOverview />
    </main>
  );
}
