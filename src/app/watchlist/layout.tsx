import type { ReactNode } from "react";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

/** Redirect shell only — keep out of the Google index; Portfolio hosts Watchlist. */
export const metadata: Metadata = pageMetadata({
  title: "Watchlist",
  description:
    "Follow the names you care about on Portfolio — today’s dollar and percent moves in one quote board.",
  path: "/portfolio?view=watchlist",
  index: false,
});

export default function WatchlistLayout({ children }: { children: ReactNode }) {
  return children;
}
