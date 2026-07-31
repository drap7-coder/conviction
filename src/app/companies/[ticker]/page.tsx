import { notFound } from "next/navigation";
import { CorporateDisclosuresSection } from "@/app/components/CorporateDisclosuresSection";
import { CompanyDetailHeader } from "@/app/components/CompanyDetailHeader";
import { CompanyVerdict } from "@/app/components/CompanyVerdict";
import { EarningsMomentumSection } from "@/app/components/EarningsMomentumSection";
import { InstitutionalConvictionSection } from "@/app/components/InstitutionalConvictionSection";
import { ConvictionScoreOverviewCard } from "@/app/components/ConvictionScoreOverviewCard";
import { InsiderActivitySection } from "@/app/components/InsiderActivitySection";
import { MaterialNewsCard } from "@/app/components/MaterialNewsCard";
import { MoveExplanationSection } from "@/app/components/MoveExplanationSection";
import { PoliticalTradesSection } from "@/app/components/PoliticalTradesSection";
import { PriceTrendCard } from "@/app/components/PriceTrendCard";
import { CompanySignalGauges } from "@/app/components/CompanySignalGauges";
import { CompanyDashboard, DashboardCard } from "@/app/components/company-dashboard";
import { SEED_WATCHLIST } from "@/lib/watchlist/types";
import { validateTicker } from "@/lib/watchlist/validate";
import { getSectorForCompany } from "@/lib/market/industries";
import { getLogoUrl, getSectorColors } from "@/lib/market/logos";
import type { Metadata } from "next";
import { SITE_URL } from "@/lib/site";
import "@/app/dashboard.css";

export async function generateStaticParams() {
  return SEED_WATCHLIST.map((entry) => ({ ticker: entry.ticker }));
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

  const title = `${companyName} (${upperTicker}) — Conviction`;
  const description = `Explore conviction signals, institutional activity, insider activity, earnings momentum, and political disclosures for ${companyName} (${upperTicker}).`;

  return {
    title,
    description,
    alternates: {
      canonical: `${SITE_URL}/companies/${encodeURIComponent(upperTicker)}`,
    },
    openGraph: {
      title,
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
  const sector = getSectorForCompany(upperTicker);
  const sectorColors = sector ? getSectorColors(sector.ticker) : undefined;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: `${companyName} (${upperTicker}) — Conviction`,
    url: `${SITE_URL}/companies/${encodeURIComponent(upperTicker)}`,
    description: `Explore conviction signals and filings for ${companyName} (${upperTicker}).`,
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
        sectorName={sector?.name ?? null}
        sectorColors={sectorColors}
        logoUrl={getLogoUrl(upperTicker) ?? null}
      />

      <CompanyDashboard
        briefing={
          <>
            <ConvictionScoreOverviewCard ticker={upperTicker} />
            <CompanySignalGauges ticker={upperTicker} />
            <PriceTrendCard ticker={upperTicker} showQuote={false} />
            <MaterialNewsCard key={upperTicker} ticker={upperTicker} companyName={companyName} />
            <CompanyVerdict ticker={upperTicker} />
          </>
        }
      >
        <DashboardCard className="dashboard-card-institutional" title="Institutional activity" summary="Recent position changes reported by tracked managers.">
          <InstitutionalConvictionSection ticker={upperTicker} priority="primary" />
        </DashboardCard>
        <DashboardCard className="dashboard-card-insider" title="Insider activity" summary="Recent open-market purchases and sales by company insiders.">
          <InsiderActivitySection ticker={upperTicker} />
        </DashboardCard>
        <DashboardCard className="dashboard-card-earnings" title="Earnings details" summary="Reported results and changes to analyst estimates.">
          <EarningsMomentumSection ticker={upperTicker} />
        </DashboardCard>
        <DashboardCard className="dashboard-card-political" title="Political disclosures" summary="Reported purchases and sales involving public officials.">
          <PoliticalTradesSection ticker={upperTicker} />
        </DashboardCard>
        <DashboardCard className="dashboard-card-conviction" title="Filings and market context" summary="Short interest, ownership filings, and corporate disclosures.">
          <MoveExplanationSection ticker={upperTicker} />
          <details className="other-events">
            <summary>Other filings &amp; events</summary>
            <CorporateDisclosuresSection ticker={upperTicker} />
          </details>
        </DashboardCard>
      </CompanyDashboard>
    </div>
  );
}
