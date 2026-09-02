/**
 * Public product copy — describe IQBulls as it ships today.
 * Keep marketing, About, Q&A, and JSON-LD aligned here.
 */

export const PRODUCT_ONE_LINER =
  "Raising your market IQ — Pulse, Crowd, Portfolio, News, and Smart Money.";

export const PRODUCT_ABOUT_LEDE =
  "IQBulls raises your market IQ: the tape, the crowd, your book, the stories that matter, and the filings behind them.";

export const PRODUCT_SURFACES: Array<{ name: string; href: string; blurb: string }> = [
  {
    name: "Pulse",
    href: "/pulse",
    blurb: "Markets, movers, crypto, and intl — slicer at the top of the home screen.",
  },
  {
    name: "Crowd",
    href: "/crowd",
    blurb: "Campus head-to-head, standings, and My Pick — slicer at the top of Crowd.",
  },
  {
    name: "Portfolio",
    href: "/portfolio",
    blurb: "Live book, Watchlist, Most held / watched, and Study — slicer on Portfolio.",
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
    blurb: "Institution filings and political trades.",
  },
];

export type FaqItem = {
  question: string;
  answer: string;
};

/** Q&A for the FAQ page and FAQPage JSON-LD. */
export const PRODUCT_FAQ: FaqItem[] = [
  {
    question: "What is IQBulls?",
    answer:
      "IQBulls raises your market IQ. Pulse, Crowd, your portfolio and watchlist, news, and smart-money filings — organized around you, not a single research feature.",
  },
  {
    question: "What is Pulse?",
    answer:
      "Pulse is the home screen. Use the Markets / Movers / Crypto / Intl slicer at the top. Markets opens with VIX and 10Y gauges, then Major Indexes, Commodities, and US Sectors. Movers, Crypto, and Intl each swap in their board without leaving Pulse.",
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
      "No. You can use IQBulls as a guest — watchlist and portfolio stay in your browser. Sign in with Google if you want the same lists synced across devices.",
  },
  {
    question: "Is IQBulls investment advice?",
    answer:
      "No. IQBulls is a research and organization tool, not a brokerage or adviser. Quotes, briefs, portfolio fit, and filings are informational. You are responsible for your own decisions.",
  },
  {
    question: "What is Smart Money?",
    answer:
      "Smart Money shows recent institutional 13F-style activity and political trades so you can see what notable investors and lawmakers reported buying, selling, or holding.",
  },
  {
    question: "What is Crowd?",
    answer:
      "Crowd is campus head-to-head, community standings, and your My Pick — equal-weight returns over Today, Weekly, Monthly, or YTD. Starter books fill the board while membership is small. It is an aggregate, not advice, and it never shows who owns what.",
  },
  {
    question: "Where are Most held and Most watched?",
    answer:
      "On Portfolio. Use the Live / Watchlist / Most held / Most watched / Study slicer. Crowd is for campus picks and standings — not the member holdings board.",
  },
];
