import type { MetadataRoute } from "next";
import { SECTORS } from "@/lib/market/industries";
import { listSeoTickers } from "@/lib/seo-tickers";
import { SITE_URL } from "@/lib/site";

/**
 * Sitemap lists canonical URLs only.
 * Pulse `?view=` tabs and Portfolio watchlist view canonicalize to their
 * parent routes, so they are omitted to avoid duplicate URL discovery.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/pulse` },
    { url: `${SITE_URL}/crowd` },
    { url: `${SITE_URL}/news` },
    { url: `${SITE_URL}/portfolio` },
    { url: `${SITE_URL}/about` },
    { url: `${SITE_URL}/faq` },
    { url: `${SITE_URL}/privacy` },
    { url: `${SITE_URL}/terms` },
  ];

  const sectorRoutes: MetadataRoute.Sitemap = SECTORS.map((sector) => ({
    url: `${SITE_URL}/industries/${sector.ticker}`,
  }));

  const companyRoutes: MetadataRoute.Sitemap = listSeoTickers().map(
    (ticker) => ({
      url: `${SITE_URL}/companies/${encodeURIComponent(ticker)}`,
    }),
  );

  return [...staticRoutes, ...sectorRoutes, ...companyRoutes];
}
