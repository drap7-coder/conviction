import type { MarketNarrativeTheme } from "@/lib/market/market-narratives";

export interface NewsPageBrief {
  leadTheme: string;
  storyCount: number;
  activeNarratives: number;
  statusLabel: "Live" | "Partial" | "Unavailable";
}

export function buildNewsPageBrief(
  themes: MarketNarrativeTheme[],
  status: "live" | "partial" | "unavailable",
): NewsPageBrief {
  const withStories = themes.filter((theme) => theme.headlines.length > 0 || theme.headline);
  const lead = [...withStories].sort((a, b) => b.score - a.score)[0] ?? null;

  return {
    leadTheme: lead?.label ?? "Still forming",
    storyCount: withStories.reduce((sum, theme) => sum + theme.headlines.length, 0),
    activeNarratives: withStories.filter((theme) => theme.heat !== "quiet").length,
    statusLabel: status === "live" ? "Live" : status === "partial" ? "Partial" : "Unavailable",
  };
}
