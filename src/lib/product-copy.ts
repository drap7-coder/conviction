/**
 * Public product copy — describe IQBulls as it ships today.
 * Keep marketing, About, Q&A, and JSON-LD aligned here.
 */

export const PRODUCT_ONE_LINER =
  "Raising your market IQ — Pulse, Crowd, Portfolio, and News.";

export const PRODUCT_ABOUT_LEDE =
  "IQBulls raises your market IQ: the tape, the crowd, your book, and the stories that matter.";

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
    blurb: "Live book, Watchlist, and Study — slicer on Portfolio.",
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
      "IQBulls raises your market IQ. Pulse, Crowd, your portfolio and watchlist, and news — organized around you, not a single research feature.",
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
      "Live quotes and charts come from public market feeds (including Yahoo Finance). Catalyst news uses public RSS and related sources. Some panels can be empty when a source is delayed or blocked.",
  },
  {
    question: "Do I need an account?",
    answer:
      "No. You can use IQBulls as a guest — watchlist and portfolio stay in your browser. Sign in with Google if you want the same lists synced across devices.",
  },
  {
    question: "Is IQBulls investment advice?",
    answer:
      "No. IQBulls is a research and organization tool, not a brokerage or adviser. Quotes, briefs, and portfolio fit are informational. You are responsible for your own decisions.",
  },
  {
    question: "What is Crowd?",
    answer:
      "Crowd is campus head-to-head, community standings, and your My Pick — equal-weight returns over Today, Weekly, Monthly, or YTD. It is competitive fun, not advice, and it never shows who owns what.",
  },
];
