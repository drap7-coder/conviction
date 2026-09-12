/**
 * Shared public site origin for canonicals, sitemap, and robots.
 * Prefer apex https://iqbulls.com — live TLS cert has no www SAN. Override with SITE_URL if needed.
 */
function normalizeOrigin(value: string): string {
  const trimmed = value.trim().replace(/\/$/, "");
  if (!trimmed) return "https://iqbulls.com";
  if (/^https?:\/\//i.test(trimmed)) return trimmed.replace(/^http:/i, "https:");
  return `https://${trimmed}`;
}

export const SITE_URL = normalizeOrigin(
  process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "https://iqbulls.com",
);

/** Public search / share copy. Lead with the full product as it ships today. */
export const SITE_NAME = "IQBulls";
/** How people type the brand in search (“IQ bulls”). */
export const SITE_ALTERNATE_NAMES = ["IQ Bulls", "iqbulls.com"] as const;
/** Brand play + benefit. Short. No jargon. */
export const SITE_TAGLINE = "Raising your market IQ.";
export const SITE_TITLE = `${SITE_NAME} — ${SITE_TAGLINE}`;

/**
 * Meta description for Google / SMS / OG cards.
 * Job: say what you can *do* here — not a feature inventory.
 * Keep ~150–160 chars so SERP snippets stay intact.
 */
export const SITE_DESCRIPTION =
  "See what’s moving on Pulse, make your campus Crowd pick, and manage your portfolio and watchlist — free market context for the names you care about.";

/** Pulse-only SERP / share copy (homepage canonical). */
export const PULSE_TITLE =
  "Real-Time Market Dashboard: Stocks, Sectors & Crypto | IQBulls";
export const PULSE_OG_TITLE = "Real-Time Market Dashboard | IQBulls";
export const PULSE_DESCRIPTION =
  "Track the stock market today with live indexes, market movers, sectors, commodities, crypto, volatility and Treasury yields—all in one free dashboard.";
/** Stable JSON-LD name for the Pulse WebPage entity. */
export const PULSE_WEBPAGE_NAME = "Real-Time Market Dashboard";

export const SITE_OG_IMAGE = {
  // Canonical share card. Do not reintroduce /iqbulls-og.png — scrapers cache that stale path.
  url: "/iqbulls-share.png",
  width: 1200,
  height: 630,
  alt: `${SITE_TITLE}`,
} as const;

export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${suffix}`;
}
