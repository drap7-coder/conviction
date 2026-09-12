import type { ReactNode } from "react";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Crowd",
  description:
    "Campus standings and head-to-head. Lock your pick, track your school’s score, and see who’s winning this week — competitive fun, not advice.",
  path: "/crowd",
});

export default function CrowdLayout({ children }: { children: ReactNode }) {
  return children;
}
