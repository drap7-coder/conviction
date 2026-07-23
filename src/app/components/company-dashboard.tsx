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
        <h2 className="section-title">Supporting evidence</h2>
        <span className="section-count">Scroll · tap to open</span>
      </div>
      <div className="dashboard-evidence-row" aria-label="Supporting evidence cards">
        {children}
      </div>
    </div>
  );
}

/* ── DashboardCard — same look/feel as homepage company-card ── */

export function DashboardCard({
  children,
  className,
  title,
  summary,
}: {
  children: ReactNode;
  className?: string;
  title: string;
  summary: string;
}) {
  return (
    <details className={`dashboard-card ${className ?? ""}`}>
      <summary className="dashboard-card-summary">
        <span className="dashboard-card-kicker">Supporting evidence</span>
        <strong>{title}</strong>
        <span className="dashboard-card-description">{summary}</span>
        <span className="dashboard-card-action" aria-hidden="true">
          <span className="dashboard-card-open-label">View details</span>
          <span className="dashboard-card-close-label">Close</span>
          <span className="dashboard-card-chevron">›</span>
        </span>
      </summary>
      <div className="dashboard-card-detail">
        {children}
      </div>
    </details>
  );
}
