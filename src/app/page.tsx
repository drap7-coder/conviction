import { HomeOverview } from "@/components/market/HomeOverview";
import Link from "next/link";

/**
 * IQBulls Home — personal brief + coverage graphs. Full tape depth is /pulse.
 */
export default function HomePage() {
  return (
    <main className="markets-page pulse-page home-page">
      <header className="pulse-seo-intro home-mission-intro">
        <p className="pulse-product-label">
          <span className="home-live-dot" aria-hidden="true" />
          IQBulls / Personal intelligence
        </p>
        <h1>
          <span className="sr-only">IQBulls: </span>
          Your world. In focus.
        </h1>
        <p className="pulse-seo-lede">
          Coverage graphs and sourced reporting on the companies you care about.
          Markets tape lives on Pulse.
        </p>
        <Link className="home-pulse-link" href="/pulse">Full market tape · Open Pulse ↗</Link>
      </header>
      <HomeOverview />
    </main>
  );
}
