import type { ReactNode } from "react";

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
  return (
    <div className="company-dashboard">
      <div className="company-briefing-grid" aria-label="Company briefing">
        <div className="dashboard-panel dashboard-panel-conviction">
          {conviction}
        </div>
        <div className="dashboard-panel dashboard-panel-market">
          {market}
        </div>
      </div>
      <div className="section-header detail-pages-header">
        <h2 className="section-title">Evidence pages</h2>
        <span className="section-count">Scroll sideways</span>
      </div>
      <div className="dashboard-evidence-row" aria-label="Supporting evidence pages">
        {evidence}
      </div>
      {children}
    </div>
  );
}
