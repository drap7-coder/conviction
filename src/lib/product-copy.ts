/**
 * Public product copy — describe CONVICTION as it ships today.
 * Keep marketing, About, Q&A, and JSON-LD aligned here.
 */

export const PRODUCT_ONE_LINER =
  "Your daily market workspace — Pulse, Crowd, Portfolio (with Watchlist), News, and Smart Money.";

export const PRODUCT_ABOUT_LEDE =
  "CONVICTION organizes the stock market around how you actually look at it: the tape first, what members hold together, the book and names you follow, the stories that matter, and filings from institutions and lawmakers.";

export const PRODUCT_SURFACES: Array<{ name: string; href: string; blurb: string }> = [
  {
    name: "Pulse",
    href: "/pulse",
    blurb: "Markets, sectors, and international boards — slicer at the top of the home screen.",
  },
  {
    name: "Crowd",
    href: "/crowd",
    blurb: "Most held and most watched names across member books.",
  },
  {
    name: "Portfolio",
    href: "/portfolio",
    blurb: "Live book, Watchlist, and Study templates — slicer at the top of Portfolio.",
  },
  {
    name: "Watchlist",
    href: "/portfolio?view=watchlist",
    blurb: "The names you follow — on Portfolio behind the Live / Watchlist / Study slicer.",
  },
  {
    name: "News",
    href: "/news",
    blurb: "A featured brief and the themes that matter, not a wire dump.",
  },
  {
    name: "Smart Money",
    href: "/smart-money",
    blurb: "Institution filings and political trades under Menu → More.",
  },
];

export type FaqItem = {
  question: string;
  answer: string;
};

/** Q&A for the FAQ page and FAQPage JSON-LD. */
export const PRODUCT_FAQ: FaqItem[] = [
  {
    question: "What is CONVICTION?",
    answer:
      "CONVICTION is a daily stock-market workspace. It brings together Pulse (indexes and movers), Crowd (what members hold and watch), a Portfolio tab with your live book and Watchlist, news briefs, sector and international boards, and smart-money filings — organized around you, not a single research feature.",
  },
  {
    question: "What is Pulse?",
    answer:
      "Pulse is the home screen. Use the Markets / Sectors / International slicer at the top. Markets opens with VIX and 10Y gauges, then Major Indexes, Market Movers, Commodities, and Crypto. Sectors and International swap in their scoreboards without leaving Pulse.",
  },
  {
    question: "How is Watchlist different from Portfolio?",
    answer:
      "Both live on the Portfolio tab. Watchlist is the names you follow day to day. Live Portfolio is the book you own — value, today’s move, sector mix, concentration, and compare-against guidance. Use the Live / Watchlist / Study slicer to switch. Edit either from Manage.",
  },
  {
    question: "What is Study Mode on Portfolio?",
    answer:
      "Study Mode shows sample allocation templates (like Three-Fund or 60/40) with design briefs and target weights so you can compare ideas against your live book. It is educational, not a trade.",
  },
  {
    question: "Where does the market data come from?",
    answer:
      "Live quotes and charts come from public market feeds (including Yahoo Finance). Filings and ownership data use SEC EDGAR and related public sources. Some panels can be empty when a source is delayed or blocked.",
  },
  {
    question: "Do I need an account?",
    answer:
      "No. You can use CONVICTION as a guest — watchlist and portfolio stay in your browser. Sign in with Google if you want the same lists synced across devices.",
  },
  {
    question: "Is CONVICTION investment advice?",
    answer:
      "No. CONVICTION is a research and organization tool, not a brokerage or adviser. Quotes, briefs, portfolio fit, and filings are informational. You are responsible for your own decisions.",
  },
  {
    question: "What is Smart Money?",
    answer:
      "Smart Money (under Menu → More) shows recent institutional 13F-style activity and political trades so you can see what notable investors and lawmakers reported buying, selling, or holding.",
  },
  {
    question: "What is Crowd?",
    answer:
      "Crowd is a daily tab that ranks names by how often they appear in member portfolios and watchlists — a simple “most held / most watched” board. Starter books fill the board while membership is small. It is an aggregate, not advice, and it never shows who owns what.",
  },
];
