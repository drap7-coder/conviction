import Link from "next/link";
import { notFound } from "next/navigation";
import { CompanyQuoteCard } from "@/app/components/CompanyQuoteCard";
import { CompanyEvidenceCard } from "@/app/components/CompanyEvidenceCard";
import { RelatedCompanies } from "@/app/components/RelatedCompanies";
import { CompanyDashboard } from "@/app/components/company-dashboard";
import { SEED_WATCHLIST } from "@/lib/watchlist/types";
import { validateTicker } from "@/lib/watchlist/validate";
import { getMarketInstrument, listMarketInstruments } from "@/lib/market/market-instruments";
import { getSectorByTicker, getSectorForCompany } from "@/lib/market/industries";
import { getLogoUrl } from "@/lib/market/logos";
import type { Metadata } from "next";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { breadcrumbJsonLd, pageMetadata } from "@/lib/seo";
import "@/app/dashboard.css";

export async function generateStaticParams() {
  const seed = SEED_WATCHLIST.map((entry) => ({ ticker: entry.ticker }));
  const markets = listMarketInstruments().map((entry) => ({ ticker: entry.ticker }));
  return [...seed, ...markets];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ticker: string }>;
}): Promise<Metadata> {
  const { ticker } = await params;
  const upperTicker = ticker.toUpperCase();
  const resolvedCompany = await validateTicker(upperTicker);
  const companyName = resolvedCompany.companyName ?? upperTicker;
  const isMarketInstrument = resolvedCompany.source === "market_instrument";

  const title = `${companyName} (${upperTicker})`;
  const description = isMarketInstrument
    ? `Price, chart, and news for ${companyName} (${upperTicker}) on IQBulls.`
    : `Live quote, news, and company detail for ${companyName} (${upperTicker}) on IQBulls.`;

  return pageMetadata({
    title,
    description,
    path: `/companies/${encodeURIComponent(upperTicker)}`,
  });
}

export default async function CompanyPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;
  const upperTicker = ticker.toUpperCase();
  const resolvedCompany = await validateTicker(upperTicker);
  if (!resolvedCompany.valid) notFound();
  const companyName = resolvedCompany.companyName ?? upperTicker;
  const isMarketInstrument = resolvedCompany.source === "market_instrument";
  const marketInstrument = getMarketInstrument(upperTicker);
  const sector = isMarketInstrument
    ? getSectorByTicker(upperTicker)
    : getSectorForCompany(upperTicker);
  const sectorName = isMarketInstrument
    ? (marketInstrument?.tag ?? "Market")
    : (sector?.name ?? null);

  const path = `/companies/${encodeURIComponent(upperTicker)}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: `${companyName} (${upperTicker}) · ${SITE_NAME}`,
    url: `${SITE_URL}${path}`,
    description: isMarketInstrument
      ? `Price, chart, and news for ${companyName} (${upperTicker}).`
      : `Today’s move and catalyst news for ${companyName} (${upperTicker}).`,
    mainEntity: {
      "@type": isMarketInstrument ? "InvestmentFund" : "Corporation",
      name: companyName,
      identifier: upperTicker,
      url: `${SITE_URL}${path}`,
    },
  };
  const breadcrumbs = breadcrumbJsonLd([
    { name: "Pulse", path: "/pulse" },
    { name: companyName, path },
  ]);

  return (
    <main className="company-detail-page">
      <script
        type="application/ld+json"
        suppressHydrationWarning
        // Safe: server-side JSON literal for structured data.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }}
      />

      <div className="detail-nav">
        <Link href="/pulse" className="detail-back">
          ← Pulse
        </Link>
        <span className="detail-context">Company</span>
      </div>

      <CompanyDashboard
        briefing={
          <>
            <div className="company-overview-stack">
              <CompanyQuoteCard
                ticker={upperTicker}
                companyName={companyName}
                sectorName={sectorName}
                logoUrl={getLogoUrl(upperTicker) ?? null}
              />
            </div>
            {isMarketInstrument ? (
              <section className="company-market-scope">
                <span>Price + news view</span>
                <p>
                  Filing-based signal reads do not apply to this market instrument. Use the
                  live tape and catalyst feed below.
                </p>
              </section>
            ) : null}
            <div className="company-catalyst-stack">
              <CompanyEvidenceCard
                key={upperTicker}
                ticker={upperTicker}
                companyName={companyName}
                showEmpty
              />
            </div>
            <RelatedCompanies ticker={upperTicker} sectorName={sectorName} />
          </>
        }
      />
    </main>
  );
}
