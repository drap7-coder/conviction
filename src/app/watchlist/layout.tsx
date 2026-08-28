import type { ReactNode } from "react";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Watchlist",
  description:
    "Follow the names you care about — today’s dollar and percent moves in one quote board.",
  path: "/watchlist",
});

export default function WatchlistLayout({ children }: { children: ReactNode }) {
  return children;
}
