import type { ReactNode } from "react";

/* ── CompanyDashboard ── */

export function CompanyDashboard({
  briefing,
  children,
}: {
  briefing: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="company-dashboard">
      <div className="company-briefing" aria-label="Company briefing">
        {briefing}
      </div>
      <div className="section-header detail-pages-header">
        <h2 className="section-title">Evidence pages</h2>
        <span className="section-count">Scroll sideways</span>
      </div>
      <div className="dashboard-evidence-row" aria-label="Supporting evidence pages">
        {children}
      </div>
    </div>
  );
}

/* ── DashboardPage ── */

export function DashboardPage({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`dashboard-page ${className ?? ""}`}>
      {children}
    </div>
  );
}