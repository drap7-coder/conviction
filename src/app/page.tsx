import { HomeOverview } from "@/components/market/HomeOverview";

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
      </header>
      <HomeOverview />
    </main>
  );
}
