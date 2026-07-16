import Link from "next/link";
import { notFound } from "next/navigation";
import { CorporateDisclosuresSection } from "@/app/components/CorporateDisclosuresSection";
import { InsiderActivitySection } from "@/app/components/InsiderActivitySection";
import { MarketPanel } from "@/app/components/MarketPanel";
import { MaterialNewsCard } from "@/app/components/MaterialNewsCard";
import { MoveExplanationSection } from "@/app/components/MoveExplanationSection";
import { PoliticalTradesSection } from "@/app/components/PoliticalTradesSection";
import { TrackCompanyButton } from "@/app/components/TrackCompanyButton";
import { CompanyDashboard, DashboardCard } from "@/app/components/company-dashboard";
import { SEED_WATCHLIST } from "@/lib/watchlist/types";
import { validateTicker } from "@/lib/watchlist/validate";
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

  return (
    <div>
      <div className="detail-header">
        <div className="detail-nav">
          <Link href="/" className="detail-back">
            ← Watchlist
          </Link>
          <span className="demo-badge">Live data</span>
        </div>
        <h1 className="detail-ticker">{upperTicker}</h1>
        <p className="detail-name">{companyName}</p>
        <TrackCompanyButton ticker={upperTicker} companyName={companyName} />
      </div>

      <CompanyDashboard
        briefing={
          <MarketPanel ticker={upperTicker} />
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