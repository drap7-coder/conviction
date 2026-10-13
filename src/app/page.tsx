import { HomeOverview } from "@/components/market/HomeOverview";
import Link from "next/link";

/**
 * IQBulls Home — for you today. Full tape depth is /pulse (Menu → Daily).
 */
export default function HomePage() {
  return (
    <main className="markets-page pulse-page home-page">
      <header className="pulse-seo-intro">
        <p className="pulse-product-label">IQBulls / Personal intelligence</p>
        <h1>
          <span className="sr-only">IQBulls: </span>
          Your world. In focus.
        </h1>
        <p className="pulse-seo-lede">
          Sourced reporting. Connected to the companies you care about.
        </p>
        <Link className="home-pulse-link" href="/pulse">Full market tape · Open Pulse ↗</Link>
      </header>
      <HomeOverview />
    </main>
  );
}
