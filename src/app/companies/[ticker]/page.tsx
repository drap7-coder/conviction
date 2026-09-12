import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CompanyQuoteCard } from "@/app/components/CompanyQuoteCard";
import { CompanyEvidenceCard } from "@/app/components/CompanyEvidenceCard";
import { RelatedCompanies } from "@/app/components/RelatedCompanies";
import { CompanyDashboard } from "@/app/components/company-dashboard";
import { validateTicker } from "@/lib/watchlist/validate";
import { getMarketInstrument } from "@/lib/market/market-instruments";
import { listSeoTickers } from "@/lib/seo-tickers";
import {
  getSectorByTicker,
  getSectorForCompany,
} from "@/lib/market/industries";
import { getLogoUrl } from "@/lib/market/logos";
import type { Metadata } from "next";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { breadcrumbJsonLd, pageMetadata } from "@/lib/seo";
import { fetchStockQuotes } from "@/lib/market/quotes";
import { CompanySeoSnapshot } from "@/components/CompanySeoSnapshot";
import { SentimentPoll } from "@/components/SentimentPoll";
import "@/app/dashboard.css";

export async function generateStaticParams() {
  return listSeoTickers().map((ticker) => ({ ticker }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ticker: string }>;
}): Promise<Metadata> {
  const { ticker } = await params;
  const upperTicker = ticker.toUpperCase();
  const resolvedCompany = await validateTicker(upperTicker);
  if (!resolvedCompany.valid)
    return pageMetadata({
      title: `${upperTicker} Market Overview`,
      description: "This market page is unavailable.",
      path: `/companies/${encodeURIComponent(upperTicker)}`,
      index: false,
    });
  const companyName = resolvedCompany.companyName ?? upperTicker;
  const isMarketInstrument = resolvedCompany.source === "market_instrument";

  const title = `${companyName} Stock Price, Chart & Market Overview (${upperTicker}) | IQBulls`;
  const description = `View the latest ${companyName} (${upperTicker}) price, market-session movement, chart, volatility context, key metrics and recent news on IQBulls.`;

  return pageMetadata({
    title,
    description,
    path: `/companies/${encodeURIComponent(upperTicker)}`,
    absoluteTitle: true,
  });
}

export default async function CompanyPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;
  const upperTicker = ticker.toUpperCase();
  if (ticker !== upperTicker)
    redirect(`/companies/${encodeURIComponent(upperTicker)}`);
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
  const quote = (await fetchStockQuotes([upperTicker]))[0] ?? null;

  const path = `/companies/${encodeURIComponent(upperTicker)}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${SITE_URL}${path}#webpage`,
    name: `${companyName} (${upperTicker}) · ${SITE_NAME}`,
    url: `${SITE_URL}${path}`,
    description: isMarketInstrument
      ? `Price, chart, and news for ${companyName} (${upperTicker}).`
      : `Today’s move and catalyst news for ${companyName} (${upperTicker}).`,
    isPartOf: { "@id": `${SITE_URL}/#website` },
    about: {
      "@type": "Thing",
      name: companyName,
      identifier: upperTicker,
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
                  Filing-based signal reads do not apply to this market
                  instrument. Use the live tape and catalyst feed below.
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
            <CompanySeoSnapshot
              ticker={upperTicker}
              name={companyName}
              sector={sectorName}
              quote={quote}
            />
            <SentimentPoll ticker={upperTicker} />
          </>
        }
      />
    </main>
  );
}
