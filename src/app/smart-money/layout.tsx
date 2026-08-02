import type { ReactNode } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Smart Money",
  description:
    "Institutional 13F ownership moves and STOCK Act political trade disclosures — where capital is being put to work.",
  alternates: {
    canonical: "/smart-money",
  },
};

export default function SmartMoneyLayout({ children }: { children: ReactNode }) {
  return children;
}
