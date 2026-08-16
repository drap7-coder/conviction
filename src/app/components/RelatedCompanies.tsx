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
 * Quiet footer hop to sector neighbors — not a first-class dashboard section.
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

  const label = sectorName?.trim() || getSectorForCompany(ticker)?.name || "Peers";

  return (
    <aside className="related-companies is-quiet" aria-label={`${label} peers`}>
      <span className="related-companies-quiet-label">{label}</span>
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
    </aside>
  );
}
