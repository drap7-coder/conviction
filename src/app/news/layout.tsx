import type { Metadata } from "next";
import type { ReactNode } from "react";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "News",
  description: "The market stories that matter most, organized into a quick daily read.",
  path: "/news",
});

export default function NewsLayout({ children }: { children: ReactNode }) {
  return children;
}
