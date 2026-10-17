import { HomeOverview } from "@/components/market/HomeOverview";
import Link from "next/link";

/**
 * IQBulls Home — personal intelligence, distinct from the full market tape.
 * Full Markets / Movers / Crypto / Intl stays on /pulse.
 */
export default function HomePage() {
  return (
    <main className="markets-page pulse-page home-page">
      <header className="pulse-seo-intro">
        <p className="pulse-product-label">IQBulls / Daily intelligence</p>
        <h1>What changed. What matters.</h1>
        <p className="pulse-seo-lede">Your companies, connected to the evidence. Start with the brief; investigate what deserves your attention.</p>
        <Link className="home-pulse-link" href="/pulse">Open Pulse · Full market tape ↗</Link>
      </header>
      <HomeOverview />
    </main>
  );
}
