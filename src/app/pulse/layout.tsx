import type { ReactNode } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pulse",
  description:
    "Market heatmaps for indexes, sectors, and trending names — plus session breadth.",
  alternates: {
    canonical: "/pulse",
  },
};

export default function PulseLayout({ children }: { children: ReactNode }) {
  return children;
}
