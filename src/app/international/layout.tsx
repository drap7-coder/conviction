import type { ReactNode } from "react";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

/** Redirect shell only — keep out of the Google index; Pulse Intl owns this board. */
export const metadata: Metadata = pageMetadata({
  title: "International",
  description:
    "Country-level market moves live on Pulse — Japan, China, the UK, India, Taiwan, and Germany.",
  path: "/pulse?view=international",
  index: false,
});

export default function InternationalLayout({ children }: { children: ReactNode }) {
  return children;
}
