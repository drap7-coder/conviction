import type { MetadataRoute } from "next";
import { SECTORS } from "@/lib/market/industries";
import { listMarketInstruments } from "@/lib/market/market-instruments";
import { SEED_WATCHLIST } from "@/lib/watchlist/types";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/pulse`,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/watchlist`,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/news`,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/smart-money`,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/pulse?view=international`,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/pulse?view=sectors`,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/portfolio`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/about`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/faq`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.2,
    },
    {
      url: `${SITE_URL}/terms`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.2,
    },
  ];

  const sectorRoutes: MetadataRoute.Sitemap = SECTORS.map((sector) => ({
    url: `${SITE_URL}/industries/${sector.ticker}`,
    lastModified: now,
    changeFrequency: "daily",
    priority: 0.7,
  }));

  const companyTickers = new Set([
    ...SEED_WATCHLIST.map((entry) => entry.ticker.toUpperCase()),
    ...listMarketInstruments().map((entry) => entry.ticker.toUpperCase()),
  ]);

  const companyRoutes: MetadataRoute.Sitemap = [...companyTickers]
    .sort()
    .map((ticker) => ({
      url: `${SITE_URL}/companies/${encodeURIComponent(ticker)}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.6,
    }));

  return [...staticRoutes, ...sectorRoutes, ...companyRoutes];
}
