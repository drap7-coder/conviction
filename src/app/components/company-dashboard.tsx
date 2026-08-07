import type { ReactNode } from "react";
import { Children } from "react";

/* ── CompanyDashboard ── */

export function CompanyDashboard({
  briefing,
  children,
}: {
  briefing: ReactNode;
  children?: ReactNode;
}) {
  const evidenceItems = Children.toArray(children).filter(Boolean);
  const hasEvidence = evidenceItems.length > 0;

  return (
    <div className="company-dashboard">
      <div className="company-briefing" aria-label="Company briefing">
        {briefing}
      </div>
      {hasEvidence ? (
        <>
          <div className="section-header detail-pages-header">
            <h2 className="section-title">Evidence</h2>
          </div>
          <div className="dashboard-evidence-row" aria-label="Evidence cards">
            {evidenceItems}
          </div>
        </>
      ) : null}
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
    <details className={`dashboard-card ink-box ink-box--quiet ${className ?? ""}`.trim()}>
      <summary className="dashboard-card-summary">
        <strong>{title}</strong>
        <span className="dashboard-card-description">{summary}</span>
        <span className="dashboard-card-action" aria-hidden="true">
          <span className="ink-chip ink-chip--quiet dashboard-card-open-label">View details</span>
          <span className="ink-chip ink-chip--quiet dashboard-card-close-label">Close</span>
          <span className="dashboard-card-chevron">›</span>
        </span>
      </summary>
      <div className="dashboard-card-detail">
        {children}
      </div>
    </details>
  );
}
