import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * App Router robots.txt.
 *
 * Pulse / News / Crowd are client-rendered and fetch public JSON under `/api/…`
 * after paint. Googlebot respects robots.txt during rendering — a blanket
 * `Disallow: /api/` leaves those pages as empty shells (chrome + "Loading…"),
 * which is a soft-404 signal and can wipe `site:` visibility.
 *
 * Allow only the read endpoints those surfaces need. Keep auth, admin, and
 * mutating APIs blocked. API responses also send `X-Robots-Tag: noindex`
 * (see next.config.ts) so JSON is never indexed as a document.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          // More specific than Disallow:/api/ — Google uses longest-match path.
          "/api/market/",
          "/api/crowd/standings",
          "/api/community-picks",
          "/api/competitions/active",
        ],
        disallow: ["/api/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
