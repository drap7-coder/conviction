import Link from "next/link";
import { notFound } from "next/navigation";
import { CorporateDisclosuresSection } from "@/app/components/CorporateDisclosuresSection";
// Conviction header & multi-vector cards temporarily suppressed — restore these imports when re-enabling:
// import { ConvictionHeader } from "@/app/components/ConvictionHeader";
// import { MultiVectorSummary } from "@/app/components/MultiVectorSummary";
import { InsiderActivitySection } from "@/app/components/InsiderActivitySection";
import { MarketPanel } from "@/app/components/MarketPanel";
import { MaterialNewsCard } from "@/app/components/MaterialNewsCard";
import { MoveExplanationSection } from "@/app/components/MoveExplanationSection";
import { PoliticalTradesSection } from "@/app/components/PoliticalTradesSection";
// Thesis section temporarily suppressed — restore this import when re-enabling:
// import { ThesisTracker } from "@/app/components/ThesisTracker";
// Track/Tracked button temporarily suppressed — restore this import when re-enabling:
// import { TrackCompanyButton } from "@/app/components/TrackCompanyButton";
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
      <div className="detail-header">
        <div className="detail-nav">
          <Link href="/" className="detail-back">
            ← Watchlist
          </Link>
          <span className="demo-badge">Live data</span>
        </div>
        <div className="detail-header-row">
          <div className="detail-header-left">
            {getLogoUrl(upperTicker) ? (
              <img src={getLogoUrl(upperTicker)!} alt="" className="detail-logo" />
            ) : (
              <div className="logo-badge logo-badge-detail">{upperTicker.charAt(0)}</div>
            )}
            <div className="detail-identity">
              <div className="detail-title-row">
                <h1 className="detail-ticker">{upperTicker}</h1>
                {sector ? (
                  <span
                    className="company-sector-tag"
                    style={sectorColors ? {
                      background: `linear-gradient(135deg, ${sectorColors.c1}, ${sectorColors.c2})`,
                    } : undefined}
                  >
                    {sector.name}
                  </span>
                ) : null}
              </div>
              <p className="detail-name">{companyName}</p>
            </div>
          </div>
          {/* Track/Tracked button temporarily suppressed — restore when ready:
          <TrackCompanyButton ticker={upperTicker} companyName={companyName} /> */}
        </div>
      </div>

      <CompanyDashboard
        briefing={
          <>
            {/* Conviction header & multi-vector cards temporarily suppressed — restore when ready:
            <ConvictionHeader ticker={upperTicker} companyName={companyName} />
            <MultiVectorSummary ticker={upperTicker} /> */}
            <MarketPanel ticker={upperTicker} />
            {/* Thesis section temporarily suppressed — restore when ready:
            <ThesisTracker ticker={upperTicker} companyName={companyName} /> */}
          </>
        }
      >
        <DashboardCard className="dashboard-card-news">
          <MaterialNewsCard ticker={upperTicker} />
        </DashboardCard>
        <DashboardCard className="dashboard-card-conviction">
          <MoveExplanationSection ticker={upperTicker} />
        </DashboardCard>
        <DashboardCard className="dashboard-card-political">
          <PoliticalTradesSection ticker={upperTicker} />
        </DashboardCard>
        <DashboardCard className="dashboard-card-insider">
          <div className="section-header">
            <h2 className="section-title">Secondary signal</h2>
            <span className="section-count">Form 4</span>
          </div>
          <InsiderActivitySection ticker={upperTicker} />
          <CorporateDisclosuresSection ticker={upperTicker} />
        </DashboardCard>
      </CompanyDashboard>
    </div>
  );
}
