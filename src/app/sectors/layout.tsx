import type { ReactNode } from "react";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Sectors",
  description:
    "U.S. sector ETF moves in one index-style board — Technology, Financials, Health Care, and the rest of the tape.",
  path: "/sectors",
});

export default function SectorsLayout({ children }: { children: ReactNode }) {
  return children;
}
