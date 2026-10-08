"use client";

import { useEffect } from "react";
import { Analytics } from "@vercel/analytics/react";
import { trackProductEvent } from "@/lib/product-analytics";

export function ProductAnalytics() {
  useEffect(() => {
    if (navigator.doNotTrack === "1") return;
    try {
      const today = new Date().toISOString().slice(0, 10);
      const lastVisit = localStorage.getItem("iqbulls-last-visit-day");
      if (lastVisit && lastVisit !== today) trackProductEvent("return_visit");
      localStorage.setItem("iqbulls-last-visit-day", today);
    } catch {
      // Storage may be unavailable in private browsing.
    }
  }, []);

  return <Analytics beforeSend={(event) => {
    if (navigator.doNotTrack === "1") return null;
    const url = new URL(event.url);
    // Strip queries, company symbols, and invite codes from page URLs.
    url.search = "";
    url.hash = "";
    if (url.pathname.startsWith("/companies/")) url.pathname = "/companies/[ticker]";
    if (url.pathname.startsWith("/join/")) url.pathname = "/join/[code]";
    event.url = url.toString();
    return event;
  }} />;
}
