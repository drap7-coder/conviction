import { notFound } from "next/navigation";
import { CompanyDetailHeader } from "@/app/components/CompanyDetailHeader";
import { ConvictionSignalsCard } from "@/app/components/ConvictionSignalsCard";
import { MaterialNewsCard } from "@/app/components/MaterialNewsCard";
import { PriceTrendCard } from "@/app/components/PriceTrendCard";
import { CompanyDashboard } from "@/app/components/company-dashboard";
import { SEED_WATCHLIST } from "@/lib/watchlist/types";
import { validateTicker } from "@/lib/watchlist/validate";
import { getMarketInstrument, listMarketInstruments } from "@/lib/market/market-instruments";
import { getSectorByTicker, getSectorForCompany } from "@/lib/market/industries";
import { getLogoUrl } from "@/lib/market/logos";
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
  const marketInstrument = getMarketInstrument(upperTicker);
  const sector = supportsSignals
    ? getSectorForCompany(upperTicker)
    : getSectorByTicker(upperTicker);
  const sectorName = supportsSignals
    ? (sector?.name ?? null)
    : (marketInstrument?.tag ?? "Market");

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
        logoUrl={getLogoUrl(upperTicker) ?? null}
      />

      <CompanyDashboard
        briefing={
          <>
            {/* 1. Catalyst — only mounts when there’s a story or meaningful move */}
            <MaterialNewsCard key={upperTicker} ticker={upperTicker} companyName={companyName} />
            {supportsSignals ? (
              /* 2. Product read — elevated above chart/technicals */
              <ConvictionSignalsCard ticker={upperTicker} />
            ) : null}
            {/* 3. Supporting visual */}
            <PriceTrendCard ticker={upperTicker} showQuote={false} />
          </>
        }
      />
    </div>
  );
}
