"use client";

import { useEffect, useRef, useState } from "react";

export type DashboardTab = "conviction" | "market" | "evidence";

const TABS: DashboardTab[] = ["conviction", "market", "evidence"];

const TAB_IDS: Record<DashboardTab, string> = {
  conviction: "dashboard-panel-conviction",
  market: "dashboard-panel-market",
  evidence: "dashboard-panel-evidence",
};

export function useDashboardScroll() {
  const [activeTab, setActiveTab] = useState<DashboardTab>("conviction");
  const scrollerRef = useRef<HTMLDivElement>(null);
  const panelRefs = useRef<Record<DashboardTab, HTMLDivElement | null>>({
    conviction: null,
    market: null,
    evidence: null,
  });

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const panels = TABS.map((tab) => panelRefs.current[tab]).filter(Boolean) as HTMLDivElement[];

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the panel with the largest intersection ratio
        let best: { tab: DashboardTab; ratio: number } | null = null;
        for (const entry of entries) {
          const tab = TABS.find((t) => panelRefs.current[t] === entry.target) ?? null;
          if (!tab) continue;
          if (!best || entry.intersectionRatio > best.ratio) {
            best = { tab, ratio: entry.intersectionRatio };
          }
        }
        if (best && best.ratio > 0) {
          setActiveTab(best.tab);
        }
      },
      {
        root: scroller,
        rootMargin: "0px",
        threshold: [0.1, 0.3, 0.5, 0.7, 0.9],
      },
    );

    for (const panel of panels) {
      observer.observe(panel);
    }

    return () => observer.disconnect();
  }, []);

  const scrollTo = (tab: DashboardTab) => {
    const panel = panelRefs.current[tab];
    if (panel) {
      panel.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
    }
  };

  const setPanelRef = (tab: DashboardTab) => (el: HTMLDivElement | null) => {
    panelRefs.current[tab] = el;
  };

  return { activeTab, scrollerRef, setPanelRef, scrollTo };
}