import type { EvidenceEvent } from "./types";

export type NewsDriverConfidence = "confirmed" | "reported" | "likely";

export interface NewsDriver {
  label: string;
  explanation: string;
  confidence: NewsDriverConfidence;
}

interface ThemeRule {
  label: string;
  pattern: RegExp;
  explanation: string;
}

const THEME_RULES: ThemeRule[] = [
  {
    label: "Strategic options",
    pattern: /takeover|acquisition|buyout|offer to (?:buy|acquire)|acquisition offer|merger|\bbid\b/i,
    explanation: "Deal interest and strategic alternatives are reshaping expectations.",
  },
  {
    label: "Oil sensitivity",
    pattern: /brent|crude|oil price|oil prices|middle east|iran|houthi|hormuz|geopolit|supply disruption/i,
    explanation: "Commodity prices and global supply risk remain central to the story.",
  },
  {
    label: "Execution + margins",
    pattern: /earnings|quarterly results|financial results|revenue|profit|margin|guidance|outlook|eps\b|cost cut/i,
    explanation: "Growth, profitability, and guidance are resetting expectations.",
  },
  {
    label: "AI positioning",
    pattern: /artificial intelligence|\bai\b|data center|accelerator|inference|robotaxi|autonom|robotics/i,
    explanation: "Investors are weighing the size and credibility of the AI opportunity.",
  },
  {
    label: "Manufacturing turnaround",
    pattern: /foundry|fabrication|\bfab\b|manufacturing|process node|chipmaking|semiconductor plant/i,
    explanation: "Manufacturing execution and the path to competitive economics remain pivotal.",
  },
  {
    label: "Pipeline renewal",
    pattern: /drug|pipeline|clinical|trial|fda|patent|biotech|vaccine|therapy|treatment/i,
    explanation: "The product pipeline and patent cycle are shaping the next phase of growth.",
  },
  {
    label: "Regulatory pressure",
    pattern: /regulator|regulatory|antitrust|investigation|lawsuit|court|sec\b|ftc\b|doj\b/i,
    explanation: "Legal and regulatory outcomes could change the operating outlook.",
  },
  {
    label: "Demand + competition",
    pattern: /demand|market share|competition|competitor|sales|shipments|deliveries|customer|consumer/i,
    explanation: "Demand and competitive position are the key operating debate.",
  },
  {
    label: "Capital allocation",
    pattern: /debt|buyback|repurchase|dividend|cash flow|capital spending|capex|asset sale/i,
    explanation: "Balance-sheet choices and capital returns are influencing the investment case.",
  },
];

export function buildNewsDriver(
  events: EvidenceEvent[],
  ticker: string,
  companyName?: string,
): NewsDriver | null {
  if (events.length === 0) return null;

  const companyToken = (companyName?.trim() || ticker)
    .replace(/[^a-z0-9 ]/gi, " ")
    .split(/\s+/)
    .find((token) => token.length >= 3 && !/^(the|inc|corp|corporation|company|holdings)$/i.test(token));

  const scores = new Map<string, { rule: ThemeRule; score: number }>();

  // Score recurring themes across company-relevant coverage. Each article is
  // evaluated independently so unrelated market roundups cannot leak in.
  for (const [index, event] of events.slice(0, 10).entries()) {
    const title = event.title;
    const eventText = `${title} ${event.summary}`;
    const isCompanyRelevant = new RegExp(`\\b${ticker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(eventText) ||
      Boolean(companyToken && new RegExp(`\\b${companyToken.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(eventText));
    if (!isCompanyRelevant) continue;

    for (const rule of THEME_RULES) {
      if (!rule.pattern.test(eventText)) continue;
      const current = scores.get(rule.label);
      scores.set(rule.label, {
        rule,
        score: (current?.score ?? 0) + Math.max(1, 5 - index * 0.5),
      });
    }
  }

  const themes = [...scores.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map(({ rule }) => rule);

  if (themes.length > 0) {
    return {
      label: themes.map((theme) => theme.label).join(" · "),
      explanation: themes.map((theme) => theme.explanation).join(" "),
      confidence: "likely",
    };
  }

  return {
    label: "Story still forming",
    explanation: "",
    confidence: "likely",
  };
}
