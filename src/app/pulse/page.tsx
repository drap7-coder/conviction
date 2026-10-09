import { PulseAbout } from "@/components/market/PulseAbout";
import { PulseDashboard } from "@/components/market/PulseDashboard";
import Link from "next/link";

/**
 * Server shell for Pulse SEO: one visible H1 + short intro in the initial HTML,
 * then the interactive dashboard, then evergreen About copy.
 */
export default function PulsePage() {
  return (
    <main className="markets-page pulse-page">
      <header className="pulse-seo-intro">
        <p className="pulse-product-label">
          Your daily market view
        </p>
        <h1><span className="sr-only">Real-Time Market Dashboard: </span>See the market. <span className="pulse-title-muted">Skip the noise.</span></h1>
        <p className="pulse-seo-lede">
          What’s moving. Where you stand. What matters next.
        </p>
        <div className="pulse-hero-actions" aria-label="Get started">
          <Link className="pulse-hero-primary" href="/pulse?view=movers">
            Today’s movers <span aria-hidden="true">→</span>
          </Link>
          <Link className="pulse-hero-secondary" href="/portfolio">
            Build your portfolio
          </Link>
        </div>
      </header>
      <PulseDashboard />
      <PulseAbout />
    </main>
  );
}
