import { PulseAbout } from "@/components/market/PulseAbout";
import { PulseDashboard } from "@/components/market/PulseDashboard";

/**
 * Server shell for Pulse SEO: one visible H1 + short intro in the initial HTML,
 * then the interactive dashboard, then evergreen About copy.
 */
export default function PulsePage() {
  return (
    <main className="markets-page pulse-page">
      <header className="pulse-seo-intro">
        <p className="pulse-product-label">Pulse</p>
        <h1>Real-Time Market Dashboard</h1>
        <p className="pulse-seo-lede">
          See what’s moving the market today. IQBulls Pulse brings together major
          indexes, stocks, sectors, commodities, crypto, volatility, and Treasury
          yields in one clear market overview.
        </p>
      </header>
      <PulseDashboard />
      <PulseAbout />
    </main>
  );
}
