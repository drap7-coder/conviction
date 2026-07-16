/**
 * Local-only logo map for watchlist companies and sector ETFs.
 * Keys are uppercase tickers. Values are paths under public/logos/.
 *
 * The user is responsible for sourcing and placing SVG/PNG files in public/logos/.
 * If a logo file is missing, the UI falls back to a text badge (ticker initial).
 *
 * No external dependencies, no next/image, no remote APIs.
 */

export const LOGO_MAP: Record<string, string> = {
  // ── Watchlist companies ──
  OXY: "/logos/OXY.svg",
  INTC: "/logos/INTC.svg",
  GOOG: "/logos/GOOG.svg",
  NVO: "/logos/NVO.svg",
  PFE: "/logos/PFE.svg",
  NBIS: "/logos/NBIS.svg",
  NVDA: "/logos/NVDA.svg",
  TSLA: "/logos/TSLA.svg",
  AAPL: "/logos/AAPL.svg",
  AMD: "/logos/AMD.svg",
  PLTR: "/logos/PLTR.svg",
  AMZN: "/logos/AMZN.svg",
  MSFT: "/logos/MSFT.svg",
  META: "/logos/META.svg",
  AVGO: "/logos/AVGO.svg",
  ORCL: "/logos/ORCL.svg",
  IBM: "/logos/IBM.svg",
  GME: "/logos/GME.svg",
  HOOD: "/logos/HOOD.svg",
  COIN: "/logos/COIN.svg",

  // ── S&P Sector ETFs ──
  XLK: "/logos/XLK.svg",
  XLF: "/logos/XLF.svg",
  XLV: "/logos/XLV.svg",
  XLE: "/logos/XLE.svg",
  XLI: "/logos/XLI.svg",
  XLY: "/logos/XLY.svg",
  XLP: "/logos/XLP.svg",
  XLU: "/logos/XLU.svg",
  XLRE: "/logos/XLRE.svg",
  XLC: "/logos/XLC.svg",
  XLB: "/logos/XLB.svg",
};

export function getLogoPath(ticker: string): string | undefined {
  return LOGO_MAP[ticker.toUpperCase()];
}

export function hasLogo(ticker: string): boolean {
  return ticker.toUpperCase() in LOGO_MAP;
}