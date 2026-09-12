import type { ReactNode } from "react";
import type { Metadata } from "next";
import { pageMetadata, pulsePageJsonLd } from "@/lib/seo";
import {
  PULSE_DESCRIPTION,
  PULSE_OG_TITLE,
  PULSE_TITLE,
} from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: PULSE_TITLE,
  description: PULSE_DESCRIPTION,
  path: "/pulse",
  absoluteTitle: true,
  openGraphTitle: PULSE_OG_TITLE,
});

export default function PulseLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pulsePageJsonLd()) }}
      />
      {children}
    </>
  );
}
