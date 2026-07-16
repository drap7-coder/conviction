"use client";

import type { ReactNode } from "react";
import { useDashboardScroll, type DashboardTab } from "./useDashboardScroll";

/* ── DashboardScroller ── */

export function DashboardScroller({
  children,
  scrollerRef,
}: {
  children: ReactNode;
  scrollerRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="dashboard-scroller" ref={scrollerRef}>
      {children}
    </div>
  );
}

/* ── DashboardPanel ── */

export function DashboardPanel({
  children,
  tab,
  panelRef,
  className,
}: {
  children: ReactNode;
  tab: DashboardTab;
  panelRef: (el: HTMLDivElement | null) => void;
  className?: string;
}) {
  return (
    <div
      id={`dashboard-panel-${tab}`}
      className={`dashboard-panel ${className ?? ""}`}
      ref={panelRef}
      role="tabpanel"
      aria-label={`${tab} panel`}
    >
      {children}
    </div>
  );
}

/* ── DashboardTabs ── */

const TAB_LABELS: Record<DashboardTab, string> = {
  conviction: "Conviction",
  market: "Market",
  evidence: "Evidence",
};

export function DashboardTabs({
  activeTab,
  scrollTo,
}: {
  activeTab: DashboardTab;
  scrollTo: (tab: DashboardTab) => void;
}) {
  return (
    <nav className="dashboard-tabs" role="tablist" aria-label="Dashboard sections">
      {(["conviction", "market", "evidence"] as DashboardTab[]).map((tab) => (
        <button
          key={tab}
          className={`dashboard-tab ${activeTab === tab ? "active" : ""}`}
          onClick={() => scrollTo(tab)}
          role="tab"
          aria-selected={activeTab === tab}
          aria-controls={`dashboard-panel-${tab}`}
          type="button"
        >
          {TAB_LABELS[tab]}
        </button>
      ))}
    </nav>
  );
}

/* ── CompanyDashboard ── */

export function CompanyDashboard({
  children,
  conviction,
  market,
  evidence,
}: {
  children?: ReactNode;
  conviction: ReactNode;
  market: ReactNode;
  evidence: ReactNode;
}) {
  const { activeTab, scrollerRef, setPanelRef, scrollTo } = useDashboardScroll();

  return (
    <div className="company-dashboard">
      <DashboardTabs activeTab={activeTab} scrollTo={scrollTo} />
      <DashboardScroller scrollerRef={scrollerRef}>
        <DashboardPanel tab="conviction" panelRef={setPanelRef("conviction")}>
          {conviction}
        </DashboardPanel>
        <DashboardPanel tab="market" panelRef={setPanelRef("market")}>
          {market}
        </DashboardPanel>
        <DashboardPanel tab="evidence" panelRef={setPanelRef("evidence")}>
          {evidence}
        </DashboardPanel>
      </DashboardScroller>
      {children}
    </div>
  );
}