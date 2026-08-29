import Link from "next/link";
import { notFound } from "next/navigation";
import { LogoDisplay } from "@/app/components/LogoDisplay";
import { MarketPanel } from "@/app/components/MarketPanel";
import { MaterialNewsCard } from "@/app/components/MaterialNewsCard";
import { CompanyDashboard, DashboardCard } from "@/app/components/company-dashboard";
import { getSectorByTicker, SECTORS } from "@/lib/market/industries";
import type { Metadata } from "next";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { breadcrumbJsonLd, pageMetadata } from "@/lib/seo";
import "@/app/dashboard.css";

export function generateStaticParams() {
  return SECTORS.map((sector) => ({ ticker: sector.ticker }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ticker: string }>;
}): Promise<Metadata> {
  const { ticker } = await params;
  const upperTicker = ticker.toUpperCase();
  const sector = getSectorByTicker(upperTicker);
  if (!sector) {
    return pageMetadata({
      title: upperTicker,
      description: "Market performance, holdings, and recent news for this sector.",
      path: `/industries/${encodeURIComponent(upperTicker)}`,
      index: false,
    });
  }

  const title = `${sector.name} sector (${sector.ticker})`;
  const description = `Market performance, top holdings, and recent news for the ${sector.name} sector (${sector.ticker}).`;

  return pageMetadata({
    title,
    description,
    path: `/industries/${encodeURIComponent(upperTicker)}`,
  });
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

  const path = `/industries/${encodeURIComponent(upperTicker)}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: `${sector.name} sector (${sector.ticker}) · ${SITE_NAME}`,
    url: `${SITE_URL}${path}`,
    description: `Market performance, holdings, and recent news for the ${sector.name} sector (${sector.ticker}).`,
  };
  const breadcrumbs = breadcrumbJsonLd([
    { name: "Pulse", path: "/pulse" },
    { name: `${sector.name} sector`, path },
  ]);

  return (
    <main>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }}
      />
      <div className="detail-header">
        <div className="detail-nav">
          <Link href="/pulse" className="detail-back">
            ← Industries
          </Link>
          <span className="demo-badge">S&P sector</span>
        </div>
        <div className="detail-header-row">
          <div className="detail-header-left">
            <span className="detail-logo" aria-hidden="true">
              <LogoDisplay ticker={upperTicker} size="detail" />
            </span>
            <div>
              <h1 className="detail-ticker">
                {sector.ticker}
                <span className="sr-only">{` ${sector.name} sector`}</span>
              </h1>
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
        <DashboardCard className="dashboard-card-news" title="Industry news" summary="Recent sourced developments affecting this industry.">
          <MaterialNewsCard key={upperTicker} ticker={upperTicker} />
        </DashboardCard>
      </CompanyDashboard>
    </main>
  );
}
