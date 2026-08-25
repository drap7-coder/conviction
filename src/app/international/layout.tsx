import type { ReactNode } from "react";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "International",
  description:
    "Country-level market moves — Japan, China, the UK, India, Taiwan, and Germany — in one scan.",
  path: "/international",
});

export default function InternationalLayout({ children }: { children: ReactNode }) {
  return children;
}
