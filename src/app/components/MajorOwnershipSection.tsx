"use client";

import { useEffect, useState } from "react";
import { classifyClientError, fetchJsonWithTimeout, type EvidenceStatus } from "./evidence-request";

interface MajorOwnershipFiling {
  id: string;
  ticker: string;
  kind: "13d" | "13g";
  title: string;
  summary: string;
  form: string;
  filingDate: string;
  sourceLabel: string;
  sourceUrl: string;
}

interface OwnershipResponse {
  ticker: string;
  status?: "success" | "empty" | "unsupported" | "timeout" | "error";
  filings: MajorOwnershipFiling[];
  latestFiling: MajorOwnershipFiling | null;
  message?: string;
}

function formatDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** 13D / 13G proof list mounted inside an Evidence lane. */
export function MajorOwnershipSection({ ticker }: { ticker: string }) {
  const [filings, setFilings] = useState<MajorOwnershipFiling[]>([]);
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
        const data = await fetchJsonWithTimeout<OwnershipResponse>(
          `/api/evidence/ownership?ticker=${encodeURIComponent(ticker)}`,
          10_000,
          controller.signal,
        );
        if (cancelled) return;
        setFilings((data.filings ?? []).slice(0, 5));
        if (data.status === "timeout" || data.status === "error" || data.status === "unsupported") {
          setStatus(data.status);
          setError(data.message ?? "SEC major ownership filings are temporarily unavailable.");
        } else {
          setStatus((data.filings ?? []).length > 0 ? "success" : "empty");
        }
      } catch (caught) {
        if (!cancelled) {
          const next = classifyClientError(caught);
          setStatus(next === "idle" ? "error" : next);
          setError("SEC major ownership filings could not be loaded.");
          setFilings([]);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [ticker, requestKey]);

  if (status === "loading" || status === "idle") {
    return <p className="move-answer">Checking Schedule 13D / 13G filings…</p>;
  }

  if (status === "timeout" || status === "error" || status === "unsupported") {
    return (
      <div>
        <p className="move-answer">{error}</p>
        <button className="retry-button" type="button" onClick={() => setRequestKey((key) => key + 1)}>
          Retry
        </button>
      </div>
    );
  }

  if (filings.length === 0) {
    return <p className="move-answer">No recent Schedule 13D or 13G filings.</p>;
  }

  return (
    <div className="evidence-line-list">
      {filings.map((filing) => (
        <a
          className="evidence-line"
          href={filing.sourceUrl}
          key={filing.id}
          rel="noreferrer"
          target="_blank"
        >
          <span>{filing.title}</span>
          <strong>
            {filing.summary} Filed {formatDate(filing.filingDate)}.
          </strong>
          <small>{filing.sourceLabel}</small>
        </a>
      ))}
    </div>
  );
}
