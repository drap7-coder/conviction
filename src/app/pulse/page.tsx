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
          <span aria-hidden="true" />
          Live market intelligence
        </p>
        <h1><span className="sr-only">Real-Time Market Dashboard: </span>See the market.<br />Skip the noise.</h1>
        <p className="pulse-seo-lede">
          One clear view of what is moving, where attention is building, and what
          deserves a closer look.
        </p>
        <div className="pulse-hero-actions" aria-label="Get started">
          <Link className="pulse-hero-primary" href="/pulse?view=movers">
            Explore today’s movers <span aria-hidden="true">→</span>
          </Link>
          <Link className="pulse-hero-secondary" href="/portfolio">
            Build your portfolio
          </Link>
        </div>
        <p className="pulse-hero-proof">Live data <i /> Free to explore <i /> No account required</p>
      </header>
      <PulseDashboard />
      <PulseAbout />
    </main>
  );
}
