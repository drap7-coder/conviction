import type { MetadataRoute } from "next";
import { SECTORS } from "@/lib/market/industries";
import { SEED_WATCHLIST } from "@/lib/watchlist/types";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/watchlist`,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/industries`,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/trending`,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/pulse`,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/portfolio`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.5,
    },
  ];

  const sectorRoutes: MetadataRoute.Sitemap = SECTORS.map((sector) => ({
    url: `${SITE_URL}/industries/${sector.ticker}`,
    lastModified: now,
    changeFrequency: "daily",
    priority: 0.7,
  }));

  const companyRoutes: MetadataRoute.Sitemap = SEED_WATCHLIST.map((entry) => ({
    url: `${SITE_URL}/companies/${entry.ticker}`,
    lastModified: now,
    changeFrequency: "daily",
    priority: 0.6,
  }));

  return [...staticRoutes, ...sectorRoutes, ...companyRoutes];
}
