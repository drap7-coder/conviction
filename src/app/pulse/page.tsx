import { PulseAbout } from "@/components/market/PulseAbout";
import { PulseDashboard } from "@/components/market/PulseDashboard";
import Link from "next/link";

/**
 * Pulse markets workspace — Indexes, Movers, Crypto, Intl.
 * The four-section overview lives on Home (`/`).
 */
export default function PulsePage() {
  return (
    <main className="markets-page pulse-page">
      <header className="pulse-seo-intro">
        <p className="pulse-product-label">Pulse</p>
        <h1>
          <span className="sr-only">Real-Time Market Dashboard: </span>
          Markets in one place.
        </h1>
        <p className="pulse-seo-lede">
          Indexes, movers, crypto, and international boards — session-aware and
          refreshable.
        </p>
        <div className="pulse-hero-actions" aria-label="Related">
          <Link className="pulse-hero-primary" href="/">
            Back to Home <span aria-hidden="true">→</span>
          </Link>
          <Link className="pulse-hero-secondary" href="/news">
            Open News
          </Link>
        </div>
      </header>
      <PulseDashboard />
      <PulseAbout />
    </main>
  );
}
