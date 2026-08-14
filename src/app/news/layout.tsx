import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "News",
  description: "Market stories ranked by investing consequence — Brief for the few that matter, Headlines for the wire.",
  alternates: {
    canonical: "/news",
  },
};

export default function NewsLayout({ children }: { children: ReactNode }) {
  return children;
}
