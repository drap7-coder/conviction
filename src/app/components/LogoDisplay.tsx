"use client";

import { useState } from "react";
import { getLogoUrl, getSectorColors } from "@/lib/market/logos";

interface LogoDisplayProps {
  ticker: string;
  size?: "card" | "badge" | "detail";
}

/**
 * Renders a logo using Google Favicons for companies with known domains,
 * a colored gradient badge for sector ETFs, or a ticker-initial fallback.
 */
export function LogoDisplay({ ticker, size = "card" }: LogoDisplayProps) {
  const [hasError, setHasError] = useState(false);
  const upper = ticker.toUpperCase();
  const logoUrl = getLogoUrl(upper);
  const sectorColors = getSectorColors(upper);

  // Sector ETFs get a branded gradient badge
  if (sectorColors) {
    return (
      <div className={`card-logo card-logo-${size} sector-badge`} aria-hidden="true">
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <defs>
            <linearGradient id={`sector-${upper}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={sectorColors.c1} />
              <stop offset="100%" stopColor={sectorColors.c2} />
            </linearGradient>
          </defs>
          <rect width="100" height="100" rx="16" fill={`url(#sector-${upper})`} />
          <text
            x="50" y="50"
            fontFamily="-apple-system,BlinkMacSystemFont,sans-serif"
            fontSize="24"
            fontWeight="700"
            fill="#fff"
            textAnchor="middle"
            dominantBaseline="central"
            letterSpacing="0.5"
          >
            {sectorColors.label}
          </text>
        </svg>
      </div>
    );
  }

  // Companies with known domains get a favicon
  if (logoUrl && !hasError) {
    return (
      <img
        src={logoUrl}
        alt=""
        className={`card-logo card-logo-${size}`}
        onError={() => setHasError(true)}
        loading="lazy"
      />
    );
  }

  // Fallback: ticker initial badge
  return (
    <div className={`logo-badge logo-badge-${size}`} aria-hidden="true">
      {upper.charAt(0)}
    </div>
  );
}