import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * App Router robots.txt — allow full crawl of public pages,
 * keep API routes out of the index, point crawlers at the sitemap.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
