import type { EvidenceEvent } from "./types";

export type NewsDriverConfidence = "confirmed" | "reported" | "likely";

export interface NewsDriver {
  label: string;
  explanation: string;
  confidence: NewsDriverConfidence;
}

interface DriverRule {
  label: string;
  confidence: NewsDriverConfidence;
  pattern: RegExp;
  explanation: (company: string) => string;
}

const DRIVER_RULES: DriverRule[] = [
  {
    label: "Deal watch",
    confidence: "reported",
    pattern: /takeover|acquisition|buyout|offer to (?:buy|acquire)|acquisition offer|merger|\bbid\b/i,
    explanation: (company) => `${company} is in focus after reports of a potential transaction. The deal is not final unless the company confirms it.`,
  },
  {
    label: "Oil + geopolitics",
    confidence: "likely",
    pattern: /brent|crude|oil price|oil prices|middle east|iran|houthi|hormuz|geopolit|supply disruption/i,
    explanation: (company) => `${company} is moving with oil as geopolitical tension changes expectations for global supply.`,
  },
  {
    label: "Earnings",
    confidence: "confirmed",
    pattern: /earnings|quarterly results|financial results|revenue|profit|guidance|outlook|eps\b/i,
    explanation: (company) => `${company} is trading around its latest results and the market's read on growth, profitability, and guidance.`,
  },
  {
    label: "Regulatory",
    confidence: "likely",
    pattern: /regulator|regulatory|antitrust|investigation|lawsuit|court|sec\b|ftc\b|doj\b/i,
    explanation: (company) => `${company} is reacting to a legal or regulatory development that could affect its outlook.`,
  },
  {
    label: "Wall Street view",
    confidence: "likely",
    pattern: /upgrade|downgrade|price target|analyst|rating|initiates coverage/i,
    explanation: (company) => `${company} is reacting to a change in Wall Street expectations.`,
  },
  {
    label: "Company update",
    confidence: "confirmed",
    pattern: /launch|announces|appoints|resigns|ceo|partnership|contract|order|delivery|production/i,
    explanation: (company) => `${company} is in focus after a company-specific development.`,
  },
];

export function buildNewsDriver(
  events: EvidenceEvent[],
  ticker: string,
  companyName?: string,
): NewsDriver | null {
  if (events.length === 0) return null;

  const company = companyName?.trim() || ticker;
  const companyToken = company
    .replace(/[^a-z0-9 ]/gi, " ")
    .split(/\s+/)
    .find((token) => token.length >= 3 && !/^(the|inc|corp|corporation|company|holdings)$/i.test(token));

  // Classify one headline at a time. Combining unrelated roundup headlines can
  // create false narratives (for example, assigning an oil story to Pfizer).
  for (const event of events.slice(0, 5)) {
    const title = event.title;
    const eventText = `${title} ${event.summary}`;
    const isCompanyRelevant = new RegExp(`\\b${ticker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(eventText) ||
      Boolean(companyToken && new RegExp(`\\b${companyToken.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(eventText));
    if (!isCompanyRelevant) continue;

    const searchable = eventText;
    const rule = DRIVER_RULES.find((candidate) => candidate.pattern.test(searchable));

    if (rule) {
      return {
        label: rule.label,
        explanation: rule.explanation(company),
        confidence: rule.confidence,
      };
    }
  }

  return {
    label: "In the news",
    explanation: `${company} has fresh company-specific coverage, but the available headlines do not establish one clear price driver.`,
    confidence: "likely",
  };
}
