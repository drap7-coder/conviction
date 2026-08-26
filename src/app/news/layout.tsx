import type { Metadata } from "next";
import type { ReactNode } from "react";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "News",
  description:
    "Market news briefs and themes that matter today — a featured story first, then the rest of the tape.",
  path: "/news",
});

export default function NewsLayout({ children }: { children: ReactNode }) {
  return children;
}
