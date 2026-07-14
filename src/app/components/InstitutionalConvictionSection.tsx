"use client";

import { useEffect, useMemo, useState } from "react";
import type { InstitutionalAccumulation } from "@/lib/sec/institutional";

interface InstitutionalConvictionSectionProps {
  ticker: string;
}

interface InstitutionalResponse {
  results: InstitutionalAccumulation[];
  fetchedAt: string;
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

export function InstitutionalConvictionSection({ ticker }: InstitutionalConvictionSectionProps) {
  const [rows, setRows] = useState<InstitutionalAccumulation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/evidence/institutional?ticker=${ticker}`);
        if (!response.ok) throw new Error("Failed to load institutional data");
        const data = (await response.json()) as InstitutionalResponse;
        if (!cancelled) setRows(data.results ?? []);
      } catch {
        if (!cancelled) setError("Institutional data unavailable.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  const grouped = useMemo(() => {
    const activeRows = rows.filter((row) => row.status !== "Unchanged");
    return GROUPS.map((group) => ({
      ...group,
      rows: activeRows.filter((row) => row.status === group.status),
    }));
  }, [rows]);

  const activeCount = grouped.reduce((sum, group) => sum + group.rows.length, 0);

  return (
    <section className="institutional-section">
      <div className="section-header mt-16">
        <h2 className="section-title">Institutional conviction</h2>
        <span className="section-count">{loading ? "..." : `${activeCount} changes`}</span>
      </div>

      {loading ? (
        <div className="evidence-panel">
          <p>Checking activity among 15 tracked institutional managers...</p>
        </div>
      ) : error ? (
        <div className="evidence-panel">
          <p>{error}</p>
        </div>
      ) : activeCount === 0 ? (
        <div className="evidence-panel">
          <p>No activity found among the tracked managers.</p>
        </div>
      ) : (
        <div className="institutional-grid">
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
          ))}
        </div>
      )}
    </section>
  );
}
