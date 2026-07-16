"use client";

import { useEffect, useState } from "react";
import type { EvidenceEvent } from "@/lib/evidence/types";
import { classifyClientError, fetchJsonWithTimeout, type EvidenceStatus } from "./evidence-request";

interface NewsEvidenceResponse {
  events: EvidenceEvent[];
  status?: "success" | "empty" | "unsupported" | "timeout" | "error";
  source?: string;
  message?: string;
}

interface MaterialNewsCardProps {
  ticker: string;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

export function MaterialNewsCard({ ticker }: MaterialNewsCardProps) {
  const [events, setEvents] = useState<EvidenceEvent[]>([]);
  const [source, setSource] = useState<string | null>(null);
  const [status, setStatus] = useState<EvidenceStatus>("idle");

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      setStatus("loading");
      try {
        const data = await fetchJsonWithTimeout<NewsEvidenceResponse>(
          `/api/evidence/news?ticker=${ticker}`,
          8_000,
          controller.signal,
        );
        if (!cancelled) {
          setEvents(data.events ?? []);
          setSource(data.source ?? null);
          setStatus(
            data.status === "timeout" || data.status === "error" || data.status === "unsupported"
              ? data.status
              : (data.events ?? []).length > 0
                ? "success"
                : "empty",
          );
        }
      } catch (caught) {
        if (!cancelled) {
          setStatus(classifyClientError(caught) === "idle" ? "error" : classifyClientError(caught));
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [ticker]);

  const copy = status === "loading" || status === "idle"
    ? "Checking for material news."
    : status === "timeout" || status === "error"
      ? "Material news temporarily unavailable."
      : events.length > 0
        ? source === "yahoo-finance-rss"
          ? `${events.length} recent headline${events.length === 1 ? "" : "s"} from Yahoo Finance RSS.`
          : `${events.length} sourced material news event found.`
        : "No recent headlines found.";

  return (
    <div className="evidence-family-card material-news-card">
      <div className="evidence-family-header">
        <div>
          <span className="move-eyebrow">Material news</span>
          <strong>{copy}</strong>
        </div>
        <span className="move-confidence move-confidence-inline">
          {status === "loading" ? "Checking" : source === "yahoo-finance-rss" ? "RSS" : "Sourced"}
        </span>
      </div>
      {events.length > 0 ? (
        <div className="evidence-line-list">
          {events.slice(0, 5).map((newsEvent) => (
            <a
              className={`evidence-line ${newsEvent.isContradiction ? "contradicting" : "supporting"}`}
              href={newsEvent.sourceUrl}
              key={newsEvent.id}
              rel="noreferrer"
              target="_blank"
            >
              <span>{newsEvent.isContradiction ? "Contradicting evidence" : "Context evidence"} · {formatDate(newsEvent.date)}</span>
              <strong>{newsEvent.title}</strong>
              <small>{newsEvent.metadata?.transactionClass ?? "Source"} · Strength: {Math.round(newsEvent.strength * 100)}</small>
              <p>{newsEvent.aiExplanation}</p>
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}