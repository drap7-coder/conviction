import type { ReactNode } from "react";

export function WorkspaceViewContext({
  kicker,
  title,
  detail,
  tone,
  meta,
}: {
  kicker: string;
  title: string;
  detail: string;
  tone: string;
  meta?: ReactNode;
}) {
  return (
    <section className={`workspace-view-context tone-${tone}`} aria-label={`${title} context`}>
      <span className="workspace-view-context-mark" aria-hidden="true" />
      <div>
        <span className="workspace-view-context-kicker">{kicker}</span>
        <strong>{title}</strong>
        <p>{detail}</p>
      </div>
      {meta}
    </section>
  );
}
