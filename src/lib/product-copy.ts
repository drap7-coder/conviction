/**
 * Public product copy — describe IQBulls as it ships today.
 * Keep marketing, About, Q&A, and JSON-LD aligned here.
 */

export const PRODUCT_ONE_LINER =
  "See the tape, campus conviction, and your book in one free workspace.";

export const PRODUCT_ABOUT_LEDE =
  "IQBulls is built to raise your market IQ in practice: check what’s moving, see what your campus is picking, and keep your portfolio and watchlist honest — with news that ties back to the names you care about.";

export const PRODUCT_SURFACES: Array<{ name: string; href: string; blurb: string }> = [
  {
    name: "Home",
    href: "/",
    blurb: "Public market telemetry — VIX and 10Y, major indexes, commodities, and sectors.",
  },
  {
    name: "Pulse",
    href: "/pulse",
    blurb: "Full public tape — indexes, movers, crypto, and intl on one slicer.",
  },
  {
    name: "Crowd",
    href: "/crowd",
    blurb: "Make your campus pick, track standings, and see who’s winning head-to-head.",
  },
  {
    name: "Portfolio",
    href: "/portfolio",
    blurb: "Your positions only — value, sector mix, concentration, and today’s move.",
  },
  {
    name: "Watchlist",
    href: "/portfolio?view=watchlist",
    blurb: "Personal daily brief plus movers on the names you own and watch.",
  },
  {
    name: "News",
    href: "/news",
    blurb: "A featured brief plus themes — skim what matters, not an endless wire.",
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
      "IQBulls is a free market workspace. Home and Pulse cover public market telemetry; Portfolio is your personal book and watchlist brief; Crowd covers campus picks and standings; News briefs the market — not a single research gimmick.",
  },
  {
    question: "What is Pulse?",
    answer:
      "Pulse is the full public markets workspace on the tab bar (also linked from Home). Use the Markets / Movers / Crypto / Intl slicer. Markets opens with VIX and 10Y gauges, Major Indexes, Commodities, and US Sectors. Movers, Crypto, and Intl each swap in their board without leaving Pulse. Personal holdings stay on Portfolio.",
  },
  {
    question: "How is Watchlist different from Portfolio?",
    answer:
      "Watchlist lives on the Portfolio tab (and the same personal daily brief also appears on Home under the macro tape). Never on Pulse. Watchlist opens with your personal daily brief plus today’s movers on names you follow. Live Portfolio is the book you own — value, today’s move, sector mix, and concentration. Use the Live / Watchlist / Study slicer to switch. Edit either from Manage.",
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
      "Crowd is campus head-to-head, community standings, and your My Pick — equal-weight returns on a $100,000 book per player. It is competitive fun, not advice, and it never shows who owns what.",
  },
];
