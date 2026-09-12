import type { ReactNode } from "react";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

/** Redirect shell only — keep out of the Google index; Portfolio hosts Watchlist. */
export const metadata: Metadata = pageMetadata({
  title: "Watchlist",
  description:
    "Follow the tickers that matter with today’s dollar and percent moves — open any name for quote, chart, and context.",
  path: "/portfolio?view=watchlist",
  index: false,
});

export default function WatchlistLayout({ children }: { children: ReactNode }) {
  return children;
}
