import { notFound } from "next/navigation";
import { CorporateDisclosuresSection } from "@/app/components/CorporateDisclosuresSection";
import { CompanyDetailHeader } from "@/app/components/CompanyDetailHeader";
import { CompanyDetailPrice } from "@/app/components/CompanyDetailPrice";
import { EarningsMomentumSection } from "@/app/components/EarningsMomentumSection";
import { ConvictionSignalsCard } from "@/app/components/ConvictionSignalsCard";
import { MaterialNewsCard } from "@/app/components/MaterialNewsCard";
import { MoveExplanationSection } from "@/app/components/MoveExplanationSection";
import { PoliticalTradesSection } from "@/app/components/PoliticalTradesSection";
import { PriceTrendCard } from "@/app/components/PriceTrendCard";
import { CompanySignalGauges } from "@/app/components/CompanySignalGauges";
import { CompanyDashboard } from "@/app/components/company-dashboard";
import { SEED_WATCHLIST } from "@/lib/watchlist/types";
import { validateTicker } from "@/lib/watchlist/validate";
import { listMarketInstruments } from "@/lib/market/market-instruments";
import { getSectorForCompany } from "@/lib/market/industries";
import { getLogoUrl, getSectorColors } from "@/lib/market/logos";
import type { Metadata } from "next";
import { SITE_URL } from "@/lib/site";
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
    ? `Ownership signals, institutional activity, insider filings, earnings, and what’s driving ${companyName} (${upperTicker}).`
    : `Price, chart, and news for ${companyName} (${upperTicker}).`;

  return {
    title,
    description,
    alternates: {
      canonical: `${SITE_URL}/companies/${encodeURIComponent(upperTicker)}`,
    },
    openGraph: {
      title: `${title} · CONVICTION`,
      description,
      url: `${SITE_URL}/companies/${encodeURIComponent(upperTicker)}`,
      siteName: "CONVICTION",
    },
  };
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
  const sector = supportsSignals ? getSectorForCompany(upperTicker) : null;
  const sectorColors = sector ? getSectorColors(sector.ticker) : undefined;
  const sectorName = supportsSignals
    ? (sector?.name ?? null)
    : (resolvedCompany.instrumentKind === "crypto" ? "Crypto" : null);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: `${companyName} (${upperTicker}) · CONVICTION`,
    url: `${SITE_URL}/companies/${encodeURIComponent(upperTicker)}`,
    description: supportsSignals
      ? `Ownership signals and filings for ${companyName} (${upperTicker}).`
      : `Price, chart, and news for ${companyName} (${upperTicker}).`,
  };

  return (
    <div>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        // Safe: server-side JSON literal for structured data.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <CompanyDetailHeader
        ticker={upperTicker}
        companyName={companyName}
        sectorName={sectorName}
        sectorColors={sectorColors}
        logoUrl={getLogoUrl(upperTicker) ?? null}
      />

      <CompanyDashboard
        briefing={
          <>
            {/* 1. What’s driving the move */}
            <MaterialNewsCard key={upperTicker} ticker={upperTicker} companyName={companyName} />
            {/* 2. Price */}
            <CompanyDetailPrice ticker={upperTicker} />
            {/* 3. Chart */}
            <PriceTrendCard ticker={upperTicker} showQuote={false} />
            {supportsSignals ? (
              <>
                {/* 4. Market gauges */}
                <CompanySignalGauges ticker={upperTicker} />
                {/* 5. Conviction Signals — Evidence cards merged into expandable rows */}
                <ConvictionSignalsCard
                  ticker={upperTicker}
                  moreEvidence={
                    <>
                      <details className="other-events conviction-more-evidence">
                        <summary>Earnings</summary>
                        <EarningsMomentumSection ticker={upperTicker} hideHeader />
                      </details>
                      <details className="other-events conviction-more-evidence">
                        <summary>Political disclosures</summary>
                        <PoliticalTradesSection ticker={upperTicker} hideHeader />
                      </details>
                      <details className="other-events conviction-more-evidence">
                        <summary>Filings &amp; market context</summary>
                        <MoveExplanationSection ticker={upperTicker} />
                        <details className="other-events">
                          <summary>Other filings &amp; events</summary>
                          <CorporateDisclosuresSection ticker={upperTicker} />
                        </details>
                      </details>
                    </>
                  }
                />
              </>
            ) : null}
          </>
        }
      />
    </div>
  );
}
