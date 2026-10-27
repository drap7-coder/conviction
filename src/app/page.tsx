import { HomeOverview } from "@/components/market/HomeOverview";

/**
 * IQBulls Home — personal intelligence, distinct from the full market tape.
 * Full Markets / Movers / Crypto / Intl stays on /pulse.
 */
export default function HomePage() {
  return (
    <main className="markets-page pulse-page home-page">
      <header className="pulse-seo-intro home-dashboard-intro">
        <p className="pulse-product-label">IQBulls / Market intelligence</p>
        <h1>Markets first. What matters next.</h1>
      </header>
      <HomeOverview />
    </main>
  );
}
