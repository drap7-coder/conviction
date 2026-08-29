import type { ReactNode } from "react";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

/** Redirect shell only — keep out of the Google index; Pulse Markets owns sectors. */
export const metadata: Metadata = pageMetadata({
  title: "Sectors",
  description:
    "U.S. sector ETF moves live on Pulse Markets — Technology, Financials, Health Care, and the rest of the tape.",
  path: "/pulse",
  index: false,
});

export default function SectorsLayout({ children }: { children: ReactNode }) {
  return children;
}
