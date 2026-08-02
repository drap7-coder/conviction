"use client";

import { useEffect, useState } from "react";
import type { AnalystGradeAction, EarningsEvidence } from "@/lib/earnings/types";
import { inkChipClass, type InkTone } from "@/lib/display/ink-tone";

function gradeTone(direction: AnalystGradeAction["direction"]): InkTone {
  if (direction === "upgrade" || direction === "initiate") return "up";
  if (direction === "downgrade") return "down";
  return "quiet";
}

function gradeLabel(action: AnalystGradeAction): string {
  if (action.direction === "upgrade") return "Upgrade";
  if (action.direction === "downgrade") return "Downgrade";
  if (action.direction === "initiate") return "Initiate";
  if (action.direction === "maintain") return "Maintain";
  return "Update";
}

function gradeHeadline(action: AnalystGradeAction): string {
  const firm = action.firm?.trim() || "Analyst";
  if (action.previousGrade && action.newGrade && action.previousGrade !== action.newGrade) {
    return `${firm}: ${action.previousGrade} → ${action.newGrade}`;
  }
  if (action.newGrade) return `${firm}: ${action.newGrade}`;
  return `${firm}: ${action.action}`;
}

export function EarningsMomentumSection({ ticker }: { ticker: string }) {
  const [data, setData] = useState<EarningsEvidence | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/evidence/earnings?ticker=${ticker}`, { signal: controller.signal })
      .then((response) => response.json())
      .then(setData)
      .catch(() => undefined);
    return () => controller.abort();
  }, [ticker]);

  const gradeActions = (data?.gradeActions ?? [])
    .filter((action) => action.direction !== "maintain" && action.direction !== "other")
    .slice(0, 5);

  return (
    <section className="earnings-evidence">
      <div className="section-header">
        <h2 className="section-title">Earnings</h2>
        {data && data.status !== "unavailable" ? (
          <span className="section-count">{data.momentum}</span>
        ) : null}
      </div>
      {!data ? (
        <p className="evidence-empty">Checking results and Street actions…</p>
      ) : data.status === "unavailable" ? (
        <p className="evidence-empty">{data.message}</p>
      ) : (
        <>
          {data.history.length > 0 ? (
            <div className="earnings-table">
              <div className="earnings-row header">
                <span>Quarter</span>
                <span>Actual</span>
                <span>Estimate</span>
                <span>Result</span>
              </div>
              {data.history.map((quarter) => {
                const beat = quarter.actualEps >= quarter.estimatedEps;
                return (
                  <div className="earnings-row" key={`${quarter.fiscalQuarter}-${quarter.reportedDate}`}>
                    <span>{quarter.fiscalQuarter}</span>
                    <span>{quarter.actualEps.toFixed(2)}</span>
                    <span>{quarter.estimatedEps.toFixed(2)}</span>
                    <strong className={inkChipClass(beat ? "up" : "down")}>
                      {beat ? "Beat" : "Miss"}
                    </strong>
                  </div>
                );
              })}
            </div>
          ) : null}

          {gradeActions.length > 0 ? (
            <div className="earnings-grades">
              <div className="earnings-grades-heading">
                <span>Street actions</span>
              </div>
              <ul>
                {gradeActions.map((action) => (
                  <li key={`${action.date}-${action.firm}-${action.action}-${action.newGrade}`}>
                    <span className={inkChipClass(gradeTone(action.direction))}>
                      {gradeLabel(action)}
                    </span>
                    <div>
                      <strong>{gradeHeadline(action)}</strong>
                      <span>{action.date}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
