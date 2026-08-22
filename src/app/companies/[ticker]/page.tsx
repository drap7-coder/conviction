import Link from "next/link";
import { notFound } from "next/navigation";
import { CompanyQuoteCard } from "@/app/components/CompanyQuoteCard";
import { ConvictionSignalsCard } from "@/app/components/ConvictionSignalsCard";
import { MaterialNewsCard } from "@/app/components/MaterialNewsCard";
import { RelatedCompanies } from "@/app/components/RelatedCompanies";
import { CompanyDashboard } from "@/app/components/company-dashboard";
import { CompanyDecisionBrief } from "@/app/components/CompanyDecisionBrief";
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
  const supportsSignals = resolvedCompany.supportsConvictionSignals !== false;

  const title = `${companyName} (${upperTicker})`;
  const description = supportsSignals
    ? `Decision snapshot, catalyst, and source filings for ${companyName} (${upperTicker}).`
    : `Price, chart, and news for ${companyName} (${upperTicker}).`;

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
  const supportsSignals = resolvedCompany.supportsConvictionSignals !== false;
  const marketInstrument = getMarketInstrument(upperTicker);
  const sector = supportsSignals
    ? getSectorForCompany(upperTicker)
    : getSectorByTicker(upperTicker);
  const sectorName = supportsSignals
    ? (sector?.name ?? null)
    : (marketInstrument?.tag ?? "Market");

  const path = `/companies/${encodeURIComponent(upperTicker)}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: `${companyName} (${upperTicker}) · ${SITE_NAME}`,
    url: `${SITE_URL}${path}`,
    description: supportsSignals
      ? `Decision snapshot and source filings for ${companyName} (${upperTicker}).`
      : `Price, chart, and news for ${companyName} (${upperTicker}).`,
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
            {supportsSignals ? (
              <CompanyDecisionBrief ticker={upperTicker} />
            ) : (
              <section className="company-market-scope">
                <span>Price + news view</span>
                <p>
                  Filing-based conviction signals do not apply to this market instrument. Use the
                  live tape and catalyst feed below.
                </p>
              </section>
            )}
            <div className="company-catalyst-stack">
              <MaterialNewsCard
                key={upperTicker}
                ticker={upperTicker}
                companyName={companyName}
                showEmpty
              />
            </div>
            {supportsSignals ? (
              <ConvictionSignalsCard ticker={upperTicker} />
            ) : null}
            <RelatedCompanies ticker={upperTicker} sectorName={sectorName} />
          </>
        }
      />
    </main>
  );
}
