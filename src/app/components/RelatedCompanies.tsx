import Link from "next/link";
import { LogoDisplay } from "@/app/components/LogoDisplay";
import {
  getAllSectorTickers,
  getSectorForCompany,
} from "@/lib/market/industries";

const SECTOR_ETF_TICKERS = new Set(getAllSectorTickers());

export function relatedCompanyTickers(ticker: string, limit = 6): string[] {
  const upper = ticker.toUpperCase();
  const sector = getSectorForCompany(upper);
  if (!sector) return [];
  return sector.representativeTickers
    .map((peer) => peer.toUpperCase())
    .filter((peer) => peer !== upper && !SECTOR_ETF_TICKERS.has(peer))
    .slice(0, limit);
}

/**
 * Quiet peer strip under Conviction Signals — sector neighbors only.
 * One job: help someone keep reading adjacent names.
 */
export function RelatedCompanies({
  ticker,
  sectorName,
}: {
  ticker: string;
  sectorName?: string | null;
}) {
  const peers = relatedCompanyTickers(ticker);
  if (peers.length === 0) return null;

  const label = sectorName?.trim() || getSectorForCompany(ticker)?.name || "Related";

  return (
    <section className="related-companies" aria-label="Related companies">
      <header className="related-companies-heading">
        <h2 className="related-companies-title">Related</h2>
        <p className="related-companies-lede">{label}</p>
      </header>
      <ul className="related-companies-list">
        {peers.map((peer) => (
          <li key={peer}>
            <Link href={`/companies/${peer}`} className="related-companies-link">
              <LogoDisplay ticker={peer} size="badge" />
              <span>{peer}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
