import type { MetadataRoute } from "next";

const SITE_URL = "https://conviction-orpin.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/activity", "/journal"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
