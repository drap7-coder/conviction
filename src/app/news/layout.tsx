import type { Metadata } from "next";
import type { ReactNode } from "react";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "News",
  description:
    "A featured brief plus market themes — skim what matters, then jump into the tickers behind the story. Not an endless wire dump.",
  path: "/news",
});

export default function NewsLayout({ children }: { children: ReactNode }) {
  return children;
}
