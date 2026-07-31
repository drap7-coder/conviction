"use client";

import { useEffect, useMemo, useState } from "react";
import {
  filterAccumulationsByFundKind,
  type InstitutionalAccumulation,
} from "@/lib/sec/institutional";
import {
  FUND_KIND_LABELS,
  INSTITUTIONAL_MANAGERS,
  managerCountForKind,
  type FundKind,
} from "@/lib/sec/institutional-managers";
import { classifyClientError, fetchJsonWithTimeout, type EvidenceStatus } from "./evidence-request";

interface InstitutionalConvictionSectionProps {
  ticker: string;
  fundKind: FundKind;
  priority?: "primary" | "compact";
  /** When provided, skip the network fetch and render these rows. */
  rows?: InstitutionalAccumulation[];
  status?: EvidenceStatus;
  error?: string | null;
  onRetry?: () => void;
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
  fundKind,
  priority = "compact",
  rows: controlledRows,
  status: controlledStatus,
  error: controlledError,
  onRetry,
}: InstitutionalConvictionSectionProps) {
  const isControlled = controlledRows !== undefined;
  const [fetchedRows, setFetchedRows] = useState<InstitutionalAccumulation[]>([]);
  const [fetchedStatus, setFetchedStatus] = useState<EvidenceStatus>("idle");
  const [fetchedError, setFetchedError] = useState<string | null>(null);
  const [requestKey, setRequestKey] = useState(0);

  const managerCount = managerCountForKind(fundKind);
  const kindLabel = FUND_KIND_LABELS[fundKind];
  const kindLabelLower = kindLabel.toLowerCase();

  useEffect(() => {
    if (isControlled) return;
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      setFetchedStatus("loading");
      setFetchedError(null);
      try {
        const data = await fetchJsonWithTimeout<InstitutionalResponse>(
          `/api/evidence/institutional?ticker=${ticker}`,
          26_000,
          controller.signal,
        );
        if (!cancelled) {
          setFetchedRows(data.results ?? []);
          if (data.status === "timeout" || data.status === "error") {
            setFetchedStatus(data.status);
            setFetchedError(data.message ?? `${kindLabel} filing data is temporarily unavailable.`);
          } else {
            const filtered = filterAccumulationsByFundKind(data.results ?? [], fundKind);
            setFetchedStatus(filtered.length > 0 ? "success" : "empty");
          }
        }
      } catch (caught) {
        if (!cancelled) {
          const nextStatus = classifyClientError(caught);
          setFetchedStatus(nextStatus === "idle" ? "error" : nextStatus);
          setFetchedError(nextStatus === "timeout"
            ? `${kindLabel} filing data is temporarily unavailable.`
            : nextStatus === "unsupported"
              ? "This issuer is not currently supported."
              : `${kindLabel} data could not be loaded.`);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [ticker, requestKey, fundKind, kindLabel, isControlled]);

  const allRows = isControlled ? controlledRows : fetchedRows;
  const rows = useMemo(
    () => filterAccumulationsByFundKind(allRows, fundKind),
    [allRows, fundKind],
  );
  const status = isControlled ? (controlledStatus ?? "success") : fetchedStatus;
  const error = isControlled ? (controlledError ?? null) : fetchedError;

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
  const handleRetry = onRetry ?? (() => setRequestKey((key) => key + 1));

  return (
    <section className={sectionClass}>
      <div className="section-header mt-16">
        <h2 className="section-title">{kindLabel}</h2>
        <span className="section-count">{status === "loading" || status === "idle" ? "..." : `${activeCount} changes`}</span>
      </div>

      {status === "loading" || status === "idle" ? (
        <div className="institutional-hero loading">
          <div>
            <span className="institutional-eyebrow">SEC Form 13F</span>
            <h3>Checking {managerCount} tracked {kindLabelLower}...</h3>
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
          <button className="retry-button" type="button" onClick={handleRetry}>
            Retry
          </button>
        </div>
      ) : activeCount === 0 ? (
        <div className="institutional-hero">
          <div>
            <span className="institutional-eyebrow">SEC Form 13F</span>
            <h3>No tracked {kindLabelLower.slice(0, -1)} activity found</h3>
            <p>No activity found among the {managerCount} tracked {kindLabelLower}.</p>
          </div>
        </div>
      ) : (
        <>
          {priority === "primary" ? (
            <div className="institutional-hero">
              <div>
                <span className="institutional-eyebrow">SEC Form 13F · {managerCount} tracked {kindLabelLower}</span>
                <h3>
                  {positiveRows.length > 0
                    ? `${positiveRows.length} manager${positiveRows.length === 1 ? "" : "s"} added or opened positions`
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
                  <span>adding</span>
                </div>
                <div>
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
                <div className="institutional-row" key={`${row.cik}-${row.status}-${row.cusip}`}>
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
                      <div className="institutional-row" key={`${row.cik}-${row.status}`}>
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
                      <div className="institutional-row" key={`${row.cik}-${row.status}`}>
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

/** Fetches 13F once and renders hedge + investment fund cards. */
export function FundActivityCards({ ticker }: { ticker: string }) {
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
            setError(data.message ?? "Fund filing data is temporarily unavailable.");
          } else {
            setStatus((data.results ?? []).length > 0 ? "success" : "empty");
          }
        }
      } catch (caught) {
        if (!cancelled) {
          const nextStatus = classifyClientError(caught);
          setStatus(nextStatus === "idle" ? "error" : nextStatus);
          setError(nextStatus === "timeout"
            ? "Fund filing data is temporarily unavailable."
            : nextStatus === "unsupported"
              ? "This issuer is not currently supported."
              : "Fund filing data could not be loaded.");
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [ticker, requestKey]);

  const retry = () => setRequestKey((key) => key + 1);
  const totalManagers = INSTITUTIONAL_MANAGERS.length;

  return (
    <>
      <details className="dashboard-card dashboard-card-institutional">
        <summary className="dashboard-card-summary">
          <span className="dashboard-card-kicker">Supporting evidence</span>
          <strong>Hedge fund activity</strong>
          <span className="dashboard-card-description">
            Recent 13F position changes from {managerCountForKind("hedge_fund")} tracked hedge funds.
          </span>
          <span className="dashboard-card-action" aria-hidden="true">
            <span className="dashboard-card-open-label">View details</span>
            <span className="dashboard-card-close-label">Close</span>
            <span className="dashboard-card-chevron">›</span>
          </span>
        </summary>
        <div className="dashboard-card-detail">
          <InstitutionalConvictionSection
            ticker={ticker}
            fundKind="hedge_fund"
            priority="primary"
            rows={rows}
            status={status}
            error={error}
            onRetry={retry}
          />
        </div>
      </details>

      <details className="dashboard-card dashboard-card-institutional">
        <summary className="dashboard-card-summary">
          <span className="dashboard-card-kicker">Supporting evidence</span>
          <strong>Investment fund activity</strong>
          <span className="dashboard-card-description">
            Recent 13F position changes from {managerCountForKind("investment_fund")} tracked investment funds
            (Berkshire, Baron, ARK). {totalManagers} managers tracked overall.
          </span>
          <span className="dashboard-card-action" aria-hidden="true">
            <span className="dashboard-card-open-label">View details</span>
            <span className="dashboard-card-close-label">Close</span>
            <span className="dashboard-card-chevron">›</span>
          </span>
        </summary>
        <div className="dashboard-card-detail">
          <InstitutionalConvictionSection
            ticker={ticker}
            fundKind="investment_fund"
            priority="primary"
            rows={rows}
            status={status}
            error={error}
            onRetry={retry}
          />
        </div>
      </details>
    </>
  );
}
