"use client";

import { useEffect, useMemo, useState } from "react";
import type { InstitutionalAccumulation } from "@/lib/sec/institutional";
import { classifyClientError, fetchJsonWithTimeout, type EvidenceStatus } from "./evidence-request";

interface InstitutionalConvictionSectionProps {
  ticker: string;
  priority?: "primary" | "compact";
}

interface InstitutionalResponse {
  results: InstitutionalAccumulation[];
  fetchedAt: string;
  status?: "success" | "timeout" | "error";
  message?: string;
}

const GROUPS: Array<{ status: InstitutionalAccumulation["status"]; label: string }> = [
  { status: "New", label: "New positions" },
  { status: "Increased", label: "Increased" },
  { status: "Reduced", label: "Reduced" },
  { status: "Exited", label: "Exits" },
];

function formatShares(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function formatValue(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}B`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}M`;
  return `$${value.toLocaleString()}K`;
}

function describeStatus(row: InstitutionalAccumulation) {
  if (row.status === "New") return "opened";
  if (row.status === "Increased") return "increased";
  if (row.status === "Reduced") return "reduced";
  if (row.status === "Exited") return "exited";
  return "held";
}

export function InstitutionalConvictionSection({
  ticker,
  priority = "compact",
}: InstitutionalConvictionSectionProps) {
  const [rows, setRows] = useState<InstitutionalAccumulation[]>([]);
  const [status, setStatus] = useState<EvidenceStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [requestKey, setRequestKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      setStatus("loading");
      setError(null);
      try {
        const data = await fetchJsonWithTimeout<InstitutionalResponse>(
          `/api/evidence/institutional?ticker=${ticker}`,
          26_000,
          controller.signal,
        );
        if (!cancelled) {
          setRows(data.results ?? []);
          if (data.status === "timeout" || data.status === "error") {
            setStatus(data.status);
            setError(data.message ?? "Institutional filing data is temporarily unavailable.");
          } else {
            setStatus((data.results ?? []).length > 0 ? "success" : "empty");
          }
        }
      } catch (caught) {
        if (!cancelled) {
          const nextStatus = classifyClientError(caught);
          setStatus(nextStatus === "idle" ? "error" : nextStatus);
          setError(nextStatus === "timeout"
            ? "Institutional filing data is temporarily unavailable."
            : nextStatus === "unsupported"
              ? "This issuer is not currently supported."
              : "Institutional data could not be loaded.");
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [ticker, requestKey]);

  const grouped = useMemo(() => {
    const activeRows = rows.filter((row) => row.status !== "Unchanged");
    return GROUPS.map((group) => ({
      ...group,
      rows: activeRows.filter((row) => row.status === group.status),
    }));
  }, [rows]);

  const activeCount = grouped.reduce((sum, group) => sum + group.rows.length, 0);
  const activeRows = rows.filter((row) => row.status !== "Unchanged");
  const positiveRows = activeRows.filter((row) => row.status === "New" || row.status === "Increased");
  const topRows = activeRows.slice(0, priority === "primary" ? 6 : 4);
  const netShareChange = activeRows.reduce((sum, row) => sum + row.shareChange, 0);
  const lead = positiveRows[0] ?? activeRows[0];
  const sectionClass = priority === "primary" ? "institutional-section institutional-section-primary" : "institutional-section";

  return (
    <section className={sectionClass}>
      <div className="section-header mt-16">
        <h2 className="section-title">Institutional conviction</h2>
        <span className="section-count">{status === "loading" || status === "idle" ? "..." : `${activeCount} changes`}</span>
      </div>

      {status === "loading" || status === "idle" ? (
        <div className="institutional-hero loading">
          <div>
            <span className="institutional-eyebrow">SEC Form 13F</span>
            <h3>Checking the 15 tracked managers...</h3>
            <p>Cold SEC reads take a moment. Parsed filings are reused across company lookups.</p>
          </div>
          <div className="institutional-loading-bars" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>
      ) : status === "timeout" || status === "error" || status === "unsupported" ? (
        <div className="evidence-panel">
          <p>{error}</p>
          <button className="retry-button" type="button" onClick={() => setRequestKey((key) => key + 1)}>
            Retry
          </button>
        </div>
      ) : activeCount === 0 ? (
        <div className="institutional-hero">
          <div>
            <span className="institutional-eyebrow">SEC Form 13F</span>
            <h3>No tracked-manager activity found</h3>
            <p>No activity found among the 15 tracked institutional managers.</p>
          </div>
        </div>
      ) : (
        <>
          {priority === "primary" ? (
            <div className="institutional-hero">
              <div>
                <span className="institutional-eyebrow">SEC Form 13F · 15 tracked managers</span>
                <h3>
                  {positiveRows.length > 0
                    ? `${positiveRows.length} manager${positiveRows.length === 1 ? "" : "s"} building conviction`
                    : `${activeCount} tracked-manager changes`}
                </h3>
                <p>
                  {lead
                    ? `${lead.displayName} ${describeStatus(lead)} ${ticker}: ${formatShares(Math.abs(lead.shareChange))} share${Math.abs(lead.shareChange) === 1 ? "" : "s"} changed.`
                    : "No tracked-manager change found."}
                </p>
              </div>
              <div className="institutional-hero-metrics">
                <div>
                  <strong>{positiveRows.length}</strong>
                  <span>building</span>
                </div>
                <div className={netShareChange >= 0 ? "positive" : "negative"}>
                  <strong>{formatShares(netShareChange)}</strong>
                  <span>net shares</span>
                </div>
                <div>
                  <strong>{activeCount}</strong>
                  <span>changes</span>
                </div>
              </div>
            </div>
          ) : null}

          <div className={priority === "primary" ? "institutional-tape" : "institutional-grid"}>
            {priority === "primary" ? (
              topRows.map((row) => (
                <div className={`institutional-row ${row.status.toLowerCase()}`} key={`${row.cik}-${row.status}-${row.cusip}`}>
                  <div>
                    <strong>{row.displayName}</strong>
                    <span>{row.issuer} · {row.classTitle} · {row.cusip}</span>
                  </div>
                  <div className="institutional-metrics">
                    <span>{row.status}</span>
                    <span>{row.shareChange > 0 ? "+" : ""}{formatShares(row.shareChange)} sh</span>
                    <span>{row.filingQuarter}</span>
                  </div>
                </div>
              ))
            ) : (
              grouped.map((group) => (
                <div className="institutional-group" key={group.status}>
                  <div className="institutional-group-title">
                    <span>{group.label}</span>
                    <strong>{group.rows.length}</strong>
                  </div>
                  {group.rows.length ? (
                    group.rows.map((row) => (
                      <div className={`institutional-row ${row.status.toLowerCase()}`} key={`${row.cik}-${row.status}`}>
                        <div>
                          <strong>{row.displayName}</strong>
                          <span>{row.filingQuarter} · filed {row.filingDate}</span>
                          {row.issuer && row.cusip ? (
                            <span>{row.issuer} · {row.classTitle} · {row.cusip}</span>
                          ) : null}
                        </div>
                        <div className="institutional-metrics">
                          <span>{formatShares(row.shares)} sh</span>
                          <span>{row.shareChange > 0 ? "+" : ""}{formatShares(row.shareChange)}</span>
                          <span>{formatValue(row.reportedValue)}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="institutional-empty">None</p>
                  )}
                </div>
              ))
            )}
          </div>

          {priority === "primary" ? (
            <div className="institutional-grid mt-8">
              {grouped.map((group) => (
                <div className="institutional-group" key={group.status}>
                  <div className="institutional-group-title">
                    <span>{group.label}</span>
                    <strong>{group.rows.length}</strong>
                  </div>
                  {group.rows.length ? (
                    group.rows.map((row) => (
                      <div className={`institutional-row ${row.status.toLowerCase()}`} key={`${row.cik}-${row.status}`}>
                        <div>
                          <strong>{row.displayName}</strong>
                          <span>{row.filingQuarter} · filed {row.filingDate}</span>
                        </div>
                        <div className="institutional-metrics">
                          <span>{formatShares(row.shares)} sh</span>
                          <span>{row.shareChange > 0 ? "+" : ""}{formatShares(row.shareChange)}</span>
                          <span>{formatValue(row.reportedValue)}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="institutional-empty">None</p>
                  )}
                </div>
              ))}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
