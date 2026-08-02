"use client";

import { useEffect, useMemo, useState } from "react";
import type { AnalystGradeAction, EarningsEvidence } from "@/lib/earnings/types";
import { catalystFromGradeActions } from "@/lib/evidence/today-catalyst";
import { inkBoxClass, inkChipClass, type InkTone } from "@/lib/display/ink-tone";

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

  const streetCatalyst = useMemo(
    () => catalystFromGradeActions(data?.gradeActions ?? []),
    [data?.gradeActions],
  );

  const gradeActions = data?.gradeActions?.slice(0, 6) ?? [];

  return (
    <section className="earnings-evidence">
      <div className="section-header">
        <h2 className="section-title">Earnings momentum</h2>
        <span className="section-count">25% weight</span>
      </div>
      {!data ? (
        <p className="evidence-empty">Checking reported results and estimate changes…</p>
      ) : data.status === "unavailable" ? (
        <p className="evidence-empty">{data.message}</p>
      ) : (
        <>
          <div className={`earnings-hero ${inkBoxClass("quiet")}`}>
            <div>
              <span>Estimate direction</span>
              <strong>{data.momentum}</strong>
            </div>
            <div>
              <span>Signal score</span>
              <strong>
                {data.score !== null && data.score > 0 ? "+" : ""}
                {data.score ?? "—"}
              </strong>
            </div>
          </div>

          {streetCatalyst ? (
            <p className="earnings-street-catalyst" aria-label="Recent Street action">
              <span className={inkChipClass(
                streetCatalyst.tone === "positive"
                  ? "up"
                  : streetCatalyst.tone === "negative"
                    ? "down"
                    : "amber",
              )}>
                {streetCatalyst.label}
              </span>
              <span>Recent analyst grade action in the last session window.</span>
            </p>
          ) : null}

          <p className="evidence-help">
            Why it matters: repeated beats plus rising forecasts can indicate that business expectations are improving.
          </p>

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
                <small>Recent rating changes</small>
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

          <p className="evidence-source">
            Source: {data.source === "fmp" ? "FMP" : "Nasdaq"} earnings data
            {gradeActions.length > 0 ? " · Street grades from FMP" : " · revisions cover the last four weeks"}
          </p>
        </>
      )}
    </section>
  );
}
