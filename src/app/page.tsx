import { HomeOverview } from "@/components/market/HomeOverview";
import Link from "next/link";

/**
 * IQBulls Home — brand + useful overview. Depth (full Pulse slicer) is one click away.
 */
export default function HomePage() {
  return (
    <main className="markets-page pulse-page home-page">
      <header className="pulse-seo-intro">
        <p className="pulse-product-label">IQBulls</p>
        <h1>
          <span className="sr-only">IQBulls: </span>
          See the market.{" "}
          <span className="pulse-title-muted">Skip the noise.</span>
        </h1>
        <p className="pulse-seo-lede">
          What’s moving. Where you stand. What matters next.
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
