import Link from "next/link";
import { notFound } from "next/navigation";
import { InsiderActivitySection } from "@/app/components/InsiderActivitySection";
import { MoveExplanationSection } from "@/app/components/MoveExplanationSection";
import { PoliticalTradesSection } from "@/app/components/PoliticalTradesSection";
import { TrackCompanyButton } from "@/app/components/TrackCompanyButton";
import { SEED_WATCHLIST } from "@/lib/watchlist/types";
import { validateTicker } from "@/lib/watchlist/validate";

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
          <span className="demo-badge">SEC 13F</span>
        </div>
        <h1 className="detail-ticker">{upperTicker}</h1>
        <p className="detail-name">{companyName}</p>
        <TrackCompanyButton ticker={upperTicker} companyName={companyName} />
      </div>

      <MoveExplanationSection ticker={upperTicker} />
      <PoliticalTradesSection ticker={upperTicker} />

      <div className="secondary-evidence">
        <div className="section-header mt-16">
          <h2 className="section-title">Secondary signal</h2>
          <span className="section-count">Form 4</span>
        </div>
        <InsiderActivitySection ticker={upperTicker} />
      </div>

    </div>
  );
}
