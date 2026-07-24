/**
 * ── CompanyIdentity (shared) ──
 *
 * Renders ticker + company name + optional portfolio indicator.
 */

import { getLogoUrl } from "@/lib/market/logos";

interface CompanyIdentityProps {
  ticker: string;
  companyName: string | null;
  isHeld?: boolean;
  className?: string;
}

export function CompanyIdentity({
  ticker,
  companyName,
  isHeld = false,
  className = "",
}: CompanyIdentityProps) {
  const logoUrl = getLogoUrl(ticker);

  return (
    <div className={`company-identity ${className}`}>
      {logoUrl && (
        <img
          src={logoUrl}
          alt=""
          className="company-identity-logo"
          width={20}
          height={20}
        />
      )}
      <div className="company-identity-text">
        <span className="company-identity-ticker">
          {ticker.toUpperCase()}
        </span>
        {companyName && (
          <span className="company-identity-name">{companyName}</span>
        )}
      </div>
      {isHeld && <span className="company-identity-held" title="In portfolio">P</span>}
    </div>
  );
}