import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketPanel } from "@/app/components/MarketPanel";
import { MaterialNewsCard } from "@/app/components/MaterialNewsCard";
import { CompanyDashboard, DashboardCard } from "@/app/components/company-dashboard";
import { getSectorByTicker, SECTORS } from "@/lib/market/industries";
import { getLogoPath } from "@/lib/market/logos";
import "@/app/dashboard.css";

export function generateStaticParams() {
  return SECTORS.map((sector) => ({ ticker: sector.ticker }));
}

export default async function SectorPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;
  const upperTicker = ticker.toUpperCase();
  const sector = getSectorByTicker(upperTicker);
  if (!sector) notFound();

  return (
    <div>
      <div className="detail-header">
        <div className="detail-nav">
          <Link href="/industries" className="detail-back">
            ← Industries
          </Link>
          <span className="demo-badge">S&P sector</span>
        </div>
        <div className="detail-header-row">
          <div className="detail-header-left">
            {getLogoPath(upperTicker) ? (
              <img src={getLogoPath(upperTicker)!} alt="" className="detail-logo" />
            ) : (
              <div className="logo-badge logo-badge-detail">{upperTicker.charAt(0)}</div>
            )}
            <div>
              <h1 className="detail-ticker">{sector.ticker}</h1>
              <p className="detail-name">{sector.name}</p>
            </div>
          </div>
        </div>
      </div>

      <CompanyDashboard
        briefing={
          <MarketPanel ticker={upperTicker} />
        }
      >
        <DashboardCard className="dashboard-card-news">
          <MaterialNewsCard ticker={upperTicker} />
        </DashboardCard>
      </CompanyDashboard>
    </div>
  );
}