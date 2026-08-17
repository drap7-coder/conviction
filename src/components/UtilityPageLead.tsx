import type { ReactNode } from "react";

export function UtilityPageLead({
  eyebrow,
  title,
  summary,
  actions,
}: {
  eyebrow: string;
  title: string;
  summary: string;
  actions?: ReactNode;
}) {
  return (
    <header className="utility-page-lead">
      <div>
        <span>{eyebrow}</span>
        <h1>{title}</h1>
        <p>{summary}</p>
      </div>
      {actions ? <div className="utility-page-lead-actions">{actions}</div> : null}
    </header>
  );
}
