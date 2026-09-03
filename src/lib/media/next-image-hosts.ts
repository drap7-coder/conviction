/**
 * Hosts allowed through Next.js Image Optimization (`/_next/image`).
 * Keep this list short and product-driven. News publishers outside the list
 * render via a native <img> fallback — never open the optimizer to all HTTPS.
 */

export const NEXT_IMAGE_REMOTE_HOST_PATTERNS = [
  "**.yimg.com",
  "**.yahoo.com",
  "**.googleusercontent.com",
  "**.wsj.net",
  "**.reuters.com",
  "**.reutersmedia.net",
  "**.cnbcfm.com",
  "**.nbcnews.com",
  "**.bloomberg.com",
  "**.ft.com",
  "**.cloudfront.net",
  "**.wp.com",
] as const;

export function nextImageRemotePatterns() {
  return NEXT_IMAGE_REMOTE_HOST_PATTERNS.map((hostname) => ({
    protocol: "https" as const,
    hostname,
  }));
}

/** Match Next.js remotePatterns hostname wildcards (`*` / `**`). */
export function hostMatchesImagePattern(hostname: string, pattern: string): boolean {
  const host = hostname.trim().toLowerCase();
  const rule = pattern.trim().toLowerCase();
  if (!host || !rule) return false;

  if (rule.startsWith("**.")) {
    const base = rule.slice(3);
    return host === base || host.endsWith(`.${base}`);
  }

  if (rule.startsWith("*.")) {
    const base = rule.slice(2);
    if (host === base) return false;
    if (!host.endsWith(`.${base}`)) return false;
    const prefix = host.slice(0, -(base.length + 1));
    return prefix.length > 0 && !prefix.includes(".");
  }

  return host === rule;
}

/** True when this URL may safely use next/image optimization. */
export function isNextImageRemoteAllowed(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    return NEXT_IMAGE_REMOTE_HOST_PATTERNS.some((pattern) =>
      hostMatchesImagePattern(parsed.hostname, pattern),
    );
  } catch {
    return false;
  }
}
