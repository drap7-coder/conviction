import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { breadcrumbJsonLd, pageMetadata, siteJsonLd } from "@/lib/seo";
import { SITE_DESCRIPTION, SITE_NAME, SITE_OG_IMAGE, SITE_TAGLINE, SITE_TITLE, SITE_URL } from "@/lib/site";
import sitemap from "@/app/sitemap";
import { listMarketInstruments } from "@/lib/market/market-instruments";
import { SECTORS } from "@/lib/market/industries";
import { SEED_WATCHLIST } from "@/lib/watchlist/types";

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("SEO metadata", () => {
  it("keeps the public brand constants", () => {
    expect(SITE_NAME).toBe("CONVICTION");
    expect(SITE_TAGLINE).toBe("The stock market, organized around you");
    expect(SITE_TITLE).toBe("CONVICTION — The stock market, organized around you");
    expect(SITE_TITLE).not.toContain("Evidence Detection");
    expect(SITE_TITLE).not.toContain("Ownership Signals");
    expect(SITE_DESCRIPTION).toContain("stock market");
    expect(SITE_DESCRIPTION).toContain("watchlist, portfolio, news");
    expect(SITE_DESCRIPTION).not.toContain("Evidence Detection");
    expect(SITE_DESCRIPTION).not.toContain("Ownership Signals");
    expect(SITE_URL).toMatch(/^https:\/\//);
    expect(SITE_URL.endsWith("/")).toBe(false);
  });

  it("builds matching title, canonical, Open Graph, and Twitter tags", () => {
    const meta = pageMetadata({
      title: "Pulse",
      description: "Market heatmaps for indexes and sectors.",
      path: "/pulse",
    });

    expect(meta.title).toBe("Pulse");
    expect(meta.alternates).toEqual({ canonical: "/pulse" });
    expect(meta.openGraph?.url).toBe(`${SITE_URL}/pulse`);
    expect(meta.openGraph?.title).toBe("Pulse · CONVICTION");
    expect(meta.twitter?.title).toBe("Pulse · CONVICTION");
    expect(meta.robots).toEqual({ index: true, follow: true });
  });

  it("marks Study Mode as noindex while keeping the live Portfolio canonical", () => {
    const meta = pageMetadata({
      title: "Portfolio",
      description: "Your book.",
      path: "/portfolio",
      index: false,
    });

    expect(meta.robots).toEqual({ index: false, follow: true });
    expect(meta.alternates).toEqual({ canonical: "/portfolio" });
  });

  it("includes the main tabs, sectors, seed names, and Pulse instruments in the sitemap", () => {
    const urls = sitemap().map((entry) => entry.url);

    expect(urls).toContain(`${SITE_URL}/pulse`);
    expect(urls).toContain(`${SITE_URL}/portfolio`);
    expect(urls).toContain(`${SITE_URL}/watchlist`);
    expect(urls).toContain(`${SITE_URL}/news`);
    expect(urls).toContain(`${SITE_URL}/smart-money`);
    expect(urls).toContain(`${SITE_URL}/international`);
    expect(urls).toContain(`${SITE_URL}/sectors`);

    for (const sector of SECTORS) {
      expect(urls).toContain(`${SITE_URL}/industries/${sector.ticker}`);
    }
    for (const entry of SEED_WATCHLIST) {
      expect(urls).toContain(`${SITE_URL}/companies/${entry.ticker}`);
    }
    for (const instrument of listMarketInstruments()) {
      expect(urls).toContain(`${SITE_URL}/companies/${encodeURIComponent(instrument.ticker)}`);
    }
  });

  it("publishes Organization and WebSite JSON-LD plus breadcrumbs", () => {
    const site = siteJsonLd();
    expect(JSON.stringify(site)).toContain("Organization");
    expect(JSON.stringify(site)).toContain("WebSite");
    expect(JSON.stringify(site)).not.toContain("SearchAction");
    expect(site["@graph"][1]).toMatchObject({
      "@type": "WebSite",
      name: SITE_NAME,
      alternateName: "Conviction",
      url: SITE_URL,
    });

    const crumbs = breadcrumbJsonLd([
      { name: "Pulse", path: "/pulse" },
      { name: "Apple", path: "/companies/AAPL" },
    ]);
    expect(crumbs.itemListElement).toHaveLength(2);
    expect(crumbs.itemListElement[1]?.item).toBe(`${SITE_URL}/companies/AAPL`);
  });

  it("wires the shared metadata helper into every workspace route", () => {
    for (const path of [
      "src/app/pulse/layout.tsx",
      "src/app/news/layout.tsx",
      "src/app/smart-money/layout.tsx",
      "src/app/international/layout.tsx",
      "src/app/sectors/layout.tsx",
      "src/app/watchlist/page.tsx",
      "src/app/portfolio/page.tsx",
      "src/app/companies/[ticker]/page.tsx",
      "src/app/industries/[ticker]/page.tsx",
    ]) {
      expect(read(path)).toContain("pageMetadata");
    }

    expect(read("src/app/layout.tsx")).toContain("siteJsonLd");
    expect(read("src/app/watchlist/page.tsx")).toContain('sr-only');
    expect(read("src/app/portfolio/page.tsx")).toContain('sr-only');
    expect(read("src/app/news/page.tsx")).toContain('sr-only');
    expect(read("src/app/not-found.tsx")).toContain("index: false");
    expect(read("src/app/pulse/page.tsx")).toContain('sr-only');
    expect(read("src/app/smart-money/page.tsx")).toContain('sr-only');
    expect(read("src/app/international/page.tsx")).toContain('sr-only');
    expect(read("src/app/sectors/page.tsx")).toContain('sr-only');
    expect(read("src/app/page.tsx")).toContain("permanentRedirect");
    expect(read("next.config.ts")).toContain('source: "/"');
    expect(read("next.config.ts")).toContain("www.gotconviction.com");
    expect(read("src/app/industries/[ticker]/page.tsx")).not.toContain("Ownership signals");
  });

  it("points Open Graph and Twitter images at the public origin", () => {
    const meta = pageMetadata({
      title: "News",
      description: "Stories.",
      path: "/news",
    });

    expect(meta.openGraph?.images).toEqual([
      { ...SITE_OG_IMAGE, url: `${SITE_URL}/conviction-og.png` },
    ]);
    expect(meta.twitter?.images).toEqual([`${SITE_URL}/conviction-og.png`]);
    expect(meta.openGraph?.locale).toBe("en_US");
  });

  it("uses the brand title on Pulse so Google and SMS cards are not Pulse · CONVICTION", () => {
    const meta = pageMetadata({
      title: SITE_TITLE,
      description: SITE_DESCRIPTION,
      path: "/pulse",
      absoluteTitle: true,
    });

    expect(meta.title).toEqual({ absolute: SITE_TITLE });
    expect(meta.openGraph?.title).toBe(SITE_TITLE);
    expect(meta.twitter?.title).toBe(SITE_TITLE);
    expect(meta.openGraph?.description).toBe(SITE_DESCRIPTION);
    expect(read("src/app/pulse/layout.tsx")).toContain("absoluteTitle: true");
    expect(read("src/app/pulse/layout.tsx")).toContain("SITE_TITLE");
  });
});
