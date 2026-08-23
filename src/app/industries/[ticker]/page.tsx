import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketPanel } from "@/app/components/MarketPanel";
import { MaterialNewsCard } from "@/app/components/MaterialNewsCard";
import { CompanyDashboard, DashboardCard } from "@/app/components/company-dashboard";
import { getSectorByTicker, SECTORS } from "@/lib/market/industries";
import { getSectorColors } from "@/lib/market/logos";
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
      description: "This sector page is unavailable.",
      path: `/industries/${encodeURIComponent(upperTicker)}`,
      index: false,
    });
  }

  const title = `${sector.name} sector (${sector.ticker})`;
  const description = `Market context and news for the ${sector.name} sector (${sector.ticker}).`;

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
    description: `Market context and news for the ${sector.name} sector (${sector.ticker}).`,
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
            {(() => {
              const sc = getSectorColors(upperTicker);
              if (sc) {
                return (
                  <div className="detail-logo sector-badge" aria-hidden="true">
                    <svg viewBox="0 0 100 100" aria-hidden="true">
                      <defs>
                        <linearGradient id={`sector-${upperTicker}`} x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor={sc.c1} />
                          <stop offset="100%" stopColor={sc.c2} />
                        </linearGradient>
                      </defs>
                      <rect width="100" height="100" rx="16" fill={`url(#sector-${upperTicker})`} />
                      <text x="50" y="50" fontFamily="-apple-system,BlinkMacSystemFont,sans-serif" fontSize="24" fontWeight="700" fill="#fff" textAnchor="middle" dominantBaseline="central" letterSpacing="0.5">{sc.label}</text>
                    </svg>
                  </div>
                );
              }
              return <div className="logo-badge logo-badge-detail">{upperTicker.charAt(0)}</div>;
            })()}
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
