import {
  themesForHeatmapGroup,
  type MarketNarrativeTheme,
} from "@/lib/market/market-narratives";

const FALLBACK_SUMMARY =
  "See the regime first, then scan the indexes, sectors, and stocks driving the day.";

export function regimeDecisionHeadline(label: string | undefined): string {
  switch (label) {
    case "Risk-on": return "Risk appetite is broadening.";
    case "Risk-off": return "Risk is coming out of the market.";
    case "Defensive rotation": return "Defensives are taking the lead.";
    case "Growth-led": return "Growth is leading the market.";
    case "Cyclical rotation": return "Cyclicals are taking the lead.";
    case "Volatility expansion": return "Volatility is rising beneath a steady market.";
    case "Volatility compression": return "Volatility is easing while stocks wait.";
    case "Rates pressure": return "Higher yields are pressuring risk.";
    case "Mixed Signals": return "The market is sending mixed signals.";
    case "Insufficient data": return "The market read is still forming.";
    default: return "Read the market at a glance.";
  }
}

/**
 * Pulse hero uses the Major Indexes narrative card (the line that used to
 * sit under that heatmap) and falls back to the regime read.
 */
export function pulseHeroCopy({
  themes,
  regimeLabel,
  regimeSummary,
}: {
  themes?: MarketNarrativeTheme[];
  regimeLabel?: string;
  regimeSummary?: string;
}): { headline: string; summary: string } {
  const indexTheme = themes
    ? themesForHeatmapGroup(themes, "Major Index")[0]
    : undefined;
  const newsTitle = indexTheme?.headline?.title?.trim() || "";
  const narrative = indexTheme?.summary?.trim() || "";

  return {
    headline: narrative || regimeDecisionHeadline(regimeLabel),
    summary: newsTitle || regimeSummary || FALLBACK_SUMMARY,
  };
}
