/**
 * Shared public site origin for canonicals, sitemap, and robots.
 * Override with SITE_URL when the public host is not www.gotconviction.com.
 */
function normalizeOrigin(value: string): string {
  const trimmed = value.trim().replace(/\/$/, "");
  if (!trimmed) return "https://www.gotconviction.com";
  if (/^https?:\/\//i.test(trimmed)) return trimmed.replace(/^http:/i, "https:");
  return `https://${trimmed}`;
}

export const SITE_URL = normalizeOrigin(
  process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.gotconviction.com",
);

/** Public search / share copy. Lead with the product category, not a feature. */
export const SITE_NAME = "CONVICTION";
export const SITE_TAGLINE = "The stock market, organized around you";
export const SITE_TITLE = `${SITE_NAME} — ${SITE_TAGLINE}`;
export const SITE_DESCRIPTION =
  "Track the stock market, your watchlist, portfolio, news, and notable investor activity — all in one place.";

export const SITE_OG_IMAGE = {
  url: "/conviction-og.png",
  width: 1200,
  height: 630,
  alt: "CONVICTION pixel bull logo",
} as const;

export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${suffix}`;
}
