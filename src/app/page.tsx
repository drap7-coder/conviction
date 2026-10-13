import { HomeOverview } from "@/components/market/HomeOverview";

/**
 * IQBulls Home — one command brief: brand + coverage graphs + sourced reports.
 * Full market tape stays on /pulse.
 */
export default function HomePage() {
  return (
    <main className="markets-page pulse-page home-page">
      <h1 className="sr-only">IQBulls: Your world. In focus.</h1>
      <HomeOverview />
    </main>
  );
}
