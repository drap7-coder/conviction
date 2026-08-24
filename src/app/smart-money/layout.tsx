import type { ReactNode } from "react";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Smart Money",
  description:
    "See recent filings from leading investors and members of Congress — what they bought, sold, and still hold.",
  path: "/smart-money",
});

export default function SmartMoneyLayout({ children }: { children: ReactNode }) {
  return children;
}
