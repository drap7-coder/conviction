import type { MetadataRoute } from "next";
import { SECTORS } from "@/lib/market/industries";
import { listMarketInstruments } from "@/lib/market/market-instruments";
import { SEED_WATCHLIST } from "@/lib/watchlist/types";
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

  const companyTickers = new Set([
    ...SEED_WATCHLIST.map((entry) => entry.ticker.toUpperCase()),
    ...listMarketInstruments().map((entry) => entry.ticker.toUpperCase()),
  ]);

  const companyRoutes: MetadataRoute.Sitemap = [...companyTickers]
    .sort()
    .map((ticker) => ({
      url: `${SITE_URL}/companies/${encodeURIComponent(ticker)}`,
    }));

  return [...staticRoutes, ...sectorRoutes, ...companyRoutes];
}
