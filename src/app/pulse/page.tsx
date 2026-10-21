import { PulseAbout } from "@/components/market/PulseAbout";
import { PulseDashboard } from "@/components/market/PulseDashboard";

/**
 * Pulse markets workspace — Indexes, Movers, Crypto, Intl.
 * The four-section overview lives on Home (`/`).
 */
export default function PulsePage() {
  return (
    <main className="markets-page pulse-page">
      <h1 className="sr-only">Real-Time Market Dashboard: Markets in one place.</h1>
      <PulseDashboard />
      <PulseAbout />
    </main>
  );
}
