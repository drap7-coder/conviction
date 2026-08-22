import type { ReactNode } from "react";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Pulse",
  description:
    "Market heatmaps for indexes and sectors, plus breadth and trending names.",
  path: "/pulse",
});

export default function PulseLayout({ children }: { children: ReactNode }) {
  return children;
}
