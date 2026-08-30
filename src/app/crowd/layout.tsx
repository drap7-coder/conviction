import type { ReactNode } from "react";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Crowd",
  description:
    "See which names members hold and watch most often — a simple aggregate across IQBulls books.",
  path: "/crowd",
});

export default function CrowdLayout({ children }: { children: ReactNode }) {
  return children;
}
