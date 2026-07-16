"use client";

import { useState } from "react";
import { getLogoPath } from "@/lib/market/logos";

interface LogoDisplayProps {
  ticker: string;
  size?: "card" | "badge" | "detail";
}

/**
 * Renders a local logo image or a fallback ticker badge.
 * Uses standard <img> — no next/image, no remote APIs.
 * Handles load failures gracefully with onError fallback.
 */
export function LogoDisplay({ ticker, size = "card" }: LogoDisplayProps) {
  const [hasError, setHasError] = useState(false);
  const logoPath = getLogoPath(ticker);

  if (!logoPath || hasError) {
    return (
      <div className={`logo-badge logo-badge-${size}`} aria-hidden="true">
        {ticker.charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={logoPath}
      alt=""
      className={`card-logo card-logo-${size}`}
      onError={() => setHasError(true)}
      loading="lazy"
    />
  );
}