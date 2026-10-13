import { HomeOverview } from "@/components/market/HomeOverview";
import Link from "next/link";

/**
 * IQBulls Home — mission context + personal brief. Full tape depth is /pulse.
 */
export default function HomePage() {
  return (
    <main className="markets-page pulse-page home-page">
      <header className="pulse-seo-intro home-mission-intro">
        <p className="pulse-product-label">
          <span className="home-live-dot" aria-hidden="true" />
          IQBulls / Operations brief
        </p>
        <h1>
          <span className="sr-only">IQBulls: </span>
          Your world. In focus.
        </h1>
        <p className="pulse-seo-lede">
          Regime gauges, major indexes, then sourced reporting on the companies you care about.
        </p>
        <Link className="home-pulse-link" href="/pulse">Full market tape · Open Pulse ↗</Link>
      </header>
      <HomeOverview />
    </main>
  );
}
