import type { ReactNode } from "react";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Smart Money",
  description:
    "Open filed 13F books for Berkshire, Pershing Square, Third Point, and peers — plus STOCK Act political disclosures. Lagged evidence, not live portfolios.",
  path: "/smart-money",
});

export default function SmartMoneyLayout({ children }: { children: ReactNode }) {
  return children;
}
