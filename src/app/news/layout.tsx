import type { Metadata } from "next";
import type { ReactNode } from "react";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "News",
  description: "Market stories ranked by investing consequence — theme, headline, and why it matters.",
  path: "/news",
});

export default function NewsLayout({ children }: { children: ReactNode }) {
  return children;
}
