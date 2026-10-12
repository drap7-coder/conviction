import { HomeOverview } from "@/components/market/HomeOverview";
import Link from "next/link";

/**
 * IQBulls Home — for you today. Full tape depth is /pulse (Menu → Daily).
 */
export default function HomePage() {
  return (
    <main className="markets-page pulse-page home-page">
      <header className="pulse-seo-intro">
        <p className="pulse-product-label">For you today</p>
        <h1>
          <span className="sr-only">IQBulls: </span>
          What matters to you.{" "}
          <span className="pulse-title-muted">Not the whole tape.</span>
        </h1>
        <p className="pulse-seo-lede">
          Your brief, a quick market context, and the names you follow — then go
          deeper when you need to.
        </p>
        <div className="pulse-hero-actions" aria-label="Get started">
          <Link className="pulse-hero-primary" href="/portfolio?view=watchlist">
            Build your watchlist <span aria-hidden="true">→</span>
          </Link>
          <Link className="pulse-hero-secondary" href="/pulse">
            Open Pulse
          </Link>
        </div>
      </header>
      <HomeOverview />
    </main>
  );
}
