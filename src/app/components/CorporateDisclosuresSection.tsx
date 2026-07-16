"use client";

import { useEffect, useState } from "react";
import { classifyClientError, fetchJsonWithTimeout, type EvidenceStatus } from "./evidence-request";

interface CorporateDisclosureItem {
  id: string;
  kind: string;
  direction: "supporting" | "context";
  title: string;
  summary: string;
  form: string;
  item: string | null;
  filingDate: string;
  sourceUrl: string;
  sourceLabel: string;
}

interface DisclosureData {
  status: string;
  latestDisclosure: CorporateDisclosureItem | null;
  disclosures: CorporateDisclosureItem[];
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

export function CorporateDisclosuresSection({ ticker }: { ticker: string }) {
  const [data, setData] = useState<DisclosureData | null>(null);
  const [status, setStatus] = useState<EvidenceStatus>("idle");

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      setStatus("loading");
      try {
        const result = await fetchJsonWithTimeout<DisclosureData>(
          `/api/evidence/disclosures?ticker=${ticker}`,
          10_000,
          controller.signal,
        );
        if (!cancelled) {
          setData(result);
          setStatus(result.status === "success" ? "success" : result.status === "empty" ? "empty" : "unsupported");
        }
      } catch (caught) {
        if (!cancelled) setStatus(classifyClientError(caught) === "idle" ? "error" : classifyClientError(caught));
      }
    }

    void load();
    return () => { cancelled = true; controller.abort(); };
  }, [ticker]);

  const latestDisclosure = data?.latestDisclosure ?? null;
  const allDisclosures = data?.disclosures?.slice(0, 5) ?? [];

  return (
    <div className="corporate-disclosures-section">
      <div className="section-header">
        <h2 className="section-title">Corporate disclosures</h2>
        <span className="section-count">SEC</span>
      </div>

      {status === "loading" || status === "idle" ? (
        <p className="move-answer">Checking SEC filings...</p>
      ) : status === "timeout" || status === "error" ? (
        <p className="move-answer">SEC corporate disclosures are temporarily unavailable.</p>
      ) : !latestDisclosure && allDisclosures.length === 0 ? (
        <p className="move-answer">No recent SEC corporate disclosures.</p>
      ) : (
        <div className="evidence-line-list">
          {latestDisclosure ? (
            <div className={`disclosure-evidence-card ${latestDisclosure.direction}`}>
              <div>
                <span className="move-eyebrow">
                  {latestDisclosure.direction === "supporting" ? "Supporting evidence" : "Context evidence"} · {formatDate(latestDisclosure.filingDate)}
                </span>
                <strong>{latestDisclosure.title}</strong>
                <p>{latestDisclosure.summary} Reported {formatDate(latestDisclosure.filingDate)}.</p>
              </div>
              <div className="move-support-metrics">
                <span>{latestDisclosure.form}{latestDisclosure.item ? ` ${latestDisclosure.item}` : ""}</span>
                <a href={latestDisclosure.sourceUrl} rel="noreferrer" target="_blank">
                  {latestDisclosure.sourceLabel}
                </a>
              </div>
            </div>
          ) : null}
          {allDisclosures.filter((d) => d.id !== latestDisclosure?.id).slice(0, 4).map((d) => (
            <a
              key={d.id}
              className={`evidence-line ${d.direction === "supporting" ? "supporting" : ""}`}
              href={d.sourceUrl}
              rel="noreferrer"
              target="_blank"
            >
              <span>{d.direction === "supporting" ? "Supporting evidence" : "Context evidence"} · {formatDate(d.filingDate)}</span>
              <strong>{d.title}</strong>
              <small>{d.form}{d.item ? ` ${d.item}` : ""} · {d.sourceLabel}</small>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}