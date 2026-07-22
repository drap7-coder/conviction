"use client";

import { useEffect, useState } from "react";
import type { EarningsEvidence } from "@/lib/earnings/types";

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

  return (
    <section className="earnings-evidence">
      <div className="section-header">
        <h2 className="section-title">Earnings momentum</h2>
        <span className="section-count">25% weight</span>
      </div>
      {!data ? <p className="evidence-empty">Checking reported results and estimate changes…</p> : data.status === "unavailable" ? <p className="evidence-empty">{data.message}</p> : (
        <>
          <div className="earnings-hero">
            <div><span>Estimate direction</span><strong>{data.momentum}</strong></div>
            <div><span>Signal score</span><strong>{data.score !== null && data.score > 0 ? "+" : ""}{data.score ?? "—"}</strong></div>
          </div>
          <p className="evidence-help">Why it matters: repeated beats plus rising forecasts can indicate that business expectations are improving.</p>
          <div className="earnings-table">
            <div className="earnings-row header"><span>Quarter</span><span>Actual</span><span>Estimate</span><span>Result</span></div>
            {data.history.map((quarter) => {
              const beat = quarter.actualEps >= quarter.estimatedEps;
              return <div className="earnings-row" key={`${quarter.fiscalQuarter}-${quarter.reportedDate}`}><span>{quarter.fiscalQuarter}</span><span>{quarter.actualEps.toFixed(2)}</span><span>{quarter.estimatedEps.toFixed(2)}</span><strong className={beat ? "positive" : "negative"}>{beat ? "Beat" : "Miss"}</strong></div>;
            })}
          </div>
          <p className="evidence-source">Source: Nasdaq earnings data · revisions cover the last four weeks</p>
        </>
      )}
    </section>
  );
}
