import {
  themesForHeatmapGroup,
  type MarketNarrativeTheme,
} from "@/lib/market/market-narratives";

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
 * Pulse hero is one headline: the Major Indexes story title.
 * No “leads the tape; DIA is +1%” clause and no second summary line.
 */
export function pulseHeroCopy({
  themes,
  regimeLabel,
}: {
  themes?: MarketNarrativeTheme[];
  regimeLabel?: string;
}): { headline: string } {
  const indexTheme = themes
    ? themesForHeatmapGroup(themes, "Major Index")[0]
    : undefined;
  const newsTitle = indexTheme?.headline?.title?.trim() || "";

  return {
    headline: newsTitle || regimeDecisionHeadline(regimeLabel),
  };
}
