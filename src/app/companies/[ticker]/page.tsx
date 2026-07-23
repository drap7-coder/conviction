import Link from "next/link";
import { notFound } from "next/navigation";
import { CorporateDisclosuresSection } from "@/app/components/CorporateDisclosuresSection";
import { CompanyDetailHeader } from "@/app/components/CompanyDetailHeader";
import { CompanyVerdict } from "@/app/components/CompanyVerdict";
import { EarningsMomentumSection } from "@/app/components/EarningsMomentumSection";
import { InstitutionalConvictionSection } from "@/app/components/InstitutionalConvictionSection";
// Conviction header & multi-vector cards temporarily suppressed — restore these imports when re-enabling:
// import { ConvictionHeader } from "@/app/components/ConvictionHeader";
// import { MultiVectorSummary } from "@/app/components/MultiVectorSummary";
import { InsiderActivitySection } from "@/app/components/InsiderActivitySection";
import { MarketPanel } from "@/app/components/MarketPanel";
import { MaterialNewsCard } from "@/app/components/MaterialNewsCard";
import { MoveExplanationSection } from "@/app/components/MoveExplanationSection";
import { PoliticalTradesSection } from "@/app/components/PoliticalTradesSection";
import { PriceTrendCard } from "@/app/components/PriceTrendCard";
// Thesis section temporarily suppressed — restore this import when re-enabling:
// import { ThesisTracker } from "@/app/components/ThesisTracker";
import { CompanyDashboard, DashboardCard } from "@/app/components/company-dashboard";
import { SEED_WATCHLIST } from "@/lib/watchlist/types";
import { validateTicker } from "@/lib/watchlist/validate";
import { getSectorForCompany } from "@/lib/market/industries";
import { getLogoUrl, getSectorColors } from "@/lib/market/logos";
import "@/app/dashboard.css";

export async function generateStaticParams() {
  return SEED_WATCHLIST.map((entry) => ({ ticker: entry.ticker }));
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

  return (
    <div>
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
            {/* Conviction header & multi-vector cards temporarily suppressed — restore when ready:
            <ConvictionHeader ticker={upperTicker} companyName={companyName} />
            <MultiVectorSummary ticker={upperTicker} /> */}
            <PriceTrendCard ticker={upperTicker} showQuote={false} />
            <MaterialNewsCard key={upperTicker} ticker={upperTicker} />
            <CompanyVerdict ticker={upperTicker} />
            {/* Thesis section temporarily suppressed — restore when ready:
            <ThesisTracker ticker={upperTicker} companyName={companyName} /> */}
          </>
        }
      >
        <DashboardCard className="dashboard-card-technical" title="Technical analysis" summary="Moving averages, 52-week range, and current trend state.">
          <MarketPanel ticker={upperTicker} />
        </DashboardCard>
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
