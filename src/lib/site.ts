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
/** Brand play + benefit. Short. No jargon. */
export const SITE_TAGLINE = "Raising your market IQ.";
export const SITE_TITLE = `${SITE_NAME} — ${SITE_TAGLINE}`;

/**
 * Meta description for Google / SMS / OG cards.
 * One job: say what it is. Then name the surfaces.
 */
export const SITE_DESCRIPTION =
  "IQBulls raises your market IQ — Pulse, Crowd, your portfolio and watchlist, and news, organized around you.";

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
