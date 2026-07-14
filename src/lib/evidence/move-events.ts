export type MoveEventCategory =
  | "earnings-warning"
  | "earnings"
  | "company-news"
  | "sector-pressure"
  | "no-clear-catalyst";

export type MoveEventConfidence = "high" | "medium" | "low";

export interface MoveEventSource {
  label: string;
  url: string;
}

export interface MoveEvent {
  ticker: string;
  companyName: string;
  date: string;
  headline: string;
  answer: string;
  category: MoveEventCategory;
  confidence: MoveEventConfidence;
  marketMove?: string;
  details: string[];
  convictionQuestion: string;
  sources: MoveEventSource[];
  updatedAt: string;
}

const MOVE_EVENTS: Record<string, MoveEvent> = {
  IBM: {
    ticker: "IBM",
    companyName: "International Business Machines",
    date: "2026-07-14",
    headline: "IBM fell after a preliminary Q2 earnings warning.",
    answer:
      "IBM is down because preliminary Q2 revenue and adjusted EPS came in below Wall Street expectations.",
    category: "earnings-warning",
    confidence: "high",
    marketMove: "Reports described the move as a roughly 20%+ selloff and one of IBM's worst trading days.",
    details: [
      "Expected revenue was about $17.2B versus roughly $17.86B expected.",
      "Expected adjusted EPS was about $2.93 versus roughly $3.01-$3.02 expected.",
      "Management pointed to delayed large deals and customer spending shifts toward AI infrastructure.",
    ],
    convictionQuestion:
      "Check whether tracked managers were accumulating before the warning, reducing before it, or simply got caught.",
    sources: [
      {
        label: "AP",
        url: "https://apnews.com/article/2f28030dd13c572ad21a512da77d96cd",
      },
      {
        label: "Barron's",
        url: "https://www.barrons.com/articles/ibm-earnings-stock-price-f78641b2",
      },
      {
        label: "MarketWatch",
        url: "https://www.marketwatch.com/story/ibms-stock-dives-toward-worst-day-in-nearly-40-years-after-the-surprise-release-of-an-earnings-miss-8519741e",
      },
    ],
    updatedAt: "2026-07-14T17:00:00-04:00",
  },
  APLD: {
    ticker: "APLD",
    companyName: "Applied Digital",
    date: "2026-07-13",
    headline: "APLD weakness looks tied to financing and customer-risk concerns.",
    answer:
      "APLD appears pressured by concerns around debt-funded AI data center expansion, customer concentration, losses, and cash burn.",
    category: "company-news",
    confidence: "medium",
    marketMove: "Recent reports described a roughly 30%+ one-month decline into July 13.",
    details: [
      "Investors are questioning the cost of aggressive AI data center expansion.",
      "Customer concentration around major hyperscale/AI tenants remains a core risk.",
      "The company is still loss-making, so financing terms and execution risk matter more.",
    ],
    convictionQuestion:
      "Treat the drop as a balance-sheet and execution-risk question, then check whether tracked managers are adding or backing away.",
    sources: [
      {
        label: "Zacks",
        url: "https://www.zacks.com/stock/news/2952637/apld-dips-33-in-a-month-should-you-hold-or-fold-the-stock",
      },
      {
        label: "Applied Digital IR",
        url: "https://ir.applieddigital.com/sec-filings",
      },
      {
        label: "Tickeron",
        url: "https://tickeron.com/blogs/applied-digital-apld-shares-drop-32-amid-expanding-debt-load-and-customer-risks-14706/",
      },
    ],
    updatedAt: "2026-07-14T17:00:00-04:00",
  },
};

export function getMoveEvent(ticker: string, companyName?: string): MoveEvent {
  const upperTicker = ticker.toUpperCase();
  const event = MOVE_EVENTS[upperTicker];
  if (event) return event;

  return {
    ticker: upperTicker,
    companyName: companyName ?? upperTicker,
    date: new Date().toISOString().slice(0, 10),
    headline: "No clear move explanation loaded.",
    answer:
      "Conviction does not have a sourced same-day catalyst for this move yet.",
    category: "no-clear-catalyst",
    confidence: "low",
    details: [
      "Check earnings, guidance, SEC filings, analyst notes, sector moves, and macro headlines before assuming the move is company-specific.",
    ],
    convictionQuestion:
      "Do not infer meaning from price alone. Compare the move against tracked manager activity before changing the thesis.",
    sources: [],
    updatedAt: new Date().toISOString(),
  };
}
