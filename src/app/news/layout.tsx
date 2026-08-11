import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "News",
  description: "The market stories that matter now, ranked by relevance, source quality, freshness, and confirming price action.",
  alternates: {
    canonical: "/news",
  },
};

export default function NewsLayout({ children }: { children: ReactNode }) {
  return children;
}
